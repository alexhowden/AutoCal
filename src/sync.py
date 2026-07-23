'''Local mirror of google calendar + tasks.

A background loop refetches a bounded window every few minutes into data/cache.json;
reads are served from the mirror, writes go through to google and patch the mirror
in place. syncToken is deliberately not used: it cannot be combined with a time
range, which would force full-history sync plus local recurrence expansion.'''

import asyncio
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .agent import get_accounts, get_service
from .store import get_cache, get_settings, save_cache

WINDOW_PAST_DAYS = 30
WINDOW_FUTURE_DAYS = 120
REFRESH_SECONDS = 300
DEBOUNCE_SECONDS = 2.0

_refresh_lock = asyncio.Lock()
_debounce_pending = False

def _now():
	return datetime.now(timezone.utc)

def _window():
	now = _now()
	return (
		(now - timedelta(days=WINDOW_PAST_DAYS)).isoformat(),
		(now + timedelta(days=WINDOW_FUTURE_DAYS)).isoformat(),
	)

def _event_sort_key(ev):
	start = ev.get('start', {})
	return start.get('dateTime', start.get('date', ''))

def _fetch_account_events(email, time_min, time_max):
	service = get_service(account=email, interactive=False)
	items, page_token = [], None
	while True:
		result = service.events().list(
			calendarId='primary',
			timeMin=time_min,
			timeMax=time_max,
			maxResults=250,
			singleEvents=True,
			orderBy='startTime',
			pageToken=page_token,
		).execute()
		for ev in result.get('items', []):
			ev['account'] = email
			items.append(ev)
		page_token = result.get('nextPageToken')
		if not page_token:
			return items

def _fetch_events(time_min, time_max):
	'''Full-window pull across accounts; an account that fails (expired token,
	network) keeps its previously mirrored events instead of vanishing.'''
	old = (get_cache('events') or {}).get('items', [])
	merged = []
	for acct in get_accounts():
		email = acct.get('email', '')
		try:
			merged.extend(_fetch_account_events(email, time_min, time_max))
		except Exception as e:
			print(f"[sync] events for {email or 'account'} failed, keeping mirror: {e}")
			merged.extend(ev for ev in old if ev.get('account') == email)
	merged.sort(key=_event_sort_key)
	return merged

def _fetch_tasks():
	result = get_service('tasks', interactive=False).tasks().list(
		tasklist='@default', showCompleted=True, showHidden=False, maxResults=100
	).execute()
	return result.get('items', [])

async def refresh():
	'''One full mirror pull; concurrent callers coalesce on the lock.'''
	async with _refresh_lock:
		time_min, time_max = _window()
		fetched = _now().isoformat()
		try:
			items = await asyncio.to_thread(_fetch_events, time_min, time_max)
			save_cache('events', {'items': items, 'timeMin': time_min, 'timeMax': time_max, 'fetchedAt': fetched})
		except Exception as e:
			print(f'[sync] events refresh failed: {e}')
		try:
			tasks = await asyncio.to_thread(_fetch_tasks)
			save_cache('tasks', {'items': tasks, 'fetchedAt': fetched})
		except Exception as e:
			print(f'[sync] tasks refresh failed: {e}')

def schedule_refresh():
	'''Debounced fire-and-forget reconcile - safe to call after every write.'''
	global _debounce_pending
	if _debounce_pending:
		return
	_debounce_pending = True

	async def run():
		global _debounce_pending
		try:
			await asyncio.sleep(DEBOUNCE_SECONDS)
			_debounce_pending = False
			await refresh()
		except Exception:
			_debounce_pending = False

	asyncio.get_running_loop().create_task(run())

async def sync_loop():
	while True:
		await refresh()
		await asyncio.sleep(REFRESH_SECONDS)

def last_sync():
	return {
		'events': (get_cache('events') or {}).get('fetchedAt'),
		'tasks': (get_cache('tasks') or {}).get('fetchedAt'),
	}

def _parse(ts, tz):
	dt = datetime.fromisoformat(ts)
	return dt if dt.tzinfo else dt.replace(tzinfo=tz)

def _boundary(obj, tz):
	'''Event start/end object -> aware datetime; all-day dates pin to local midnight.'''
	if 'dateTime' in obj:
		return _parse(obj['dateTime'], tz)
	return datetime.fromisoformat(obj['date']).replace(tzinfo=tz)

def cached_events(time_min, time_max):
	'''Mirrored events intersecting [time_min, time_max), or None on a miss
	(never synced, or the request reaches outside the mirrored window).'''
	payload = get_cache('events')
	if not payload:
		return None
	tz = ZoneInfo(get_settings()['timezone'])
	try:
		req_min = _parse(time_min, tz)
		req_max = _parse(time_max, tz)
		win_min = _parse(payload['timeMin'], tz)
		win_max = _parse(payload['timeMax'], tz)
	except (KeyError, ValueError):
		return None
	if req_min < win_min or req_max > win_max:
		return None
	out = []
	for ev in payload.get('items', []):
		try:
			if _boundary(ev['end'], tz) > req_min and _boundary(ev['start'], tz) < req_max:
				out.append(ev)
		except (KeyError, ValueError):
			out.append(ev)
	return out

def cached_tasks():
	payload = get_cache('tasks')
	return payload.get('items', []) if payload else None
