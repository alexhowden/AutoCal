import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from googleapiclient.errors import HttpError
from pydantic import BaseModel
from . import sync
from .agent import (
	agent_call,
	agent_stream,
	close_session,
	get_accounts,
	get_service,
	google_status,
	link_account,
	resolve_account,
	set_primary_account,
	unlink_account,
	_clients,
)
from .store import (
	cache_remove_event,
	cache_remove_task,
	cache_upsert_event,
	cache_upsert_task,
	log_activity,
	read_activity,
	list_notes,
	create_note,
	update_note,
	delete_note,
	get_settings,
	update_settings,
)

@asynccontextmanager
async def lifespan(app):
	loop = asyncio.create_task(sync.sync_loop())
	yield
	loop.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

class AgentRequest(BaseModel):
	user_id: str
	message: str

class AgentResponse(BaseModel):
	reply: str

@app.post("/chat", response_model=AgentResponse)
async def chat(request: AgentRequest):
	reply = await agent_call(request.user_id, request.message)
	return AgentResponse(reply=reply)

async def run_gcal(op):
	'''Blocking Google client work goes to a worker thread; API errors become HTTP errors.'''
	try:
		return await asyncio.to_thread(op)
	except HttpError as error:
		raise HTTPException(status_code=error.resp.status, detail=str(error))

@app.get("/events")
async def list_events(timeMin: str, timeMax: str, maxResults: int = 250):
	cached = sync.cached_events(timeMin, timeMax)
	if cached is not None:
		return cached[:maxResults]

	# outside the mirrored window (or never synced) - fall through to a live pull
	def op():
		merged = []
		for acct in get_accounts():
			email = acct.get('email', '')
			result = get_service(account=email).events().list(
				calendarId='primary',
				timeMin=timeMin,
				timeMax=timeMax,
				maxResults=maxResults,
				singleEvents=True,
				orderBy='startTime',
			).execute()
			for ev in result.get('items', []):
				ev['account'] = email
				merged.append(ev)
		merged.sort(key=lambda e: e['start'].get('dateTime', e['start'].get('date', '')))
		return merged

	return await run_gcal(op)

EVENT_PATCH_FIELDS = {'summary', 'location', 'description', 'start', 'end', 'colorId', 'recurrence', 'attendees'}

@app.post("/events")
async def create_event(body: dict, account: str | None = None):
	body = {k: v for k, v in body.items() if k in EVENT_PATCH_FIELDS}
	event = await run_gcal(lambda: get_service(account=account).events().insert(
		calendarId='primary', body=body
	).execute())
	event['account'] = resolve_account(account)
	cache_upsert_event(event)
	sync.schedule_refresh()
	log_activity('CREATE', f"EVT {event.get('summary')} // {event['start'].get('dateTime', event['start'].get('date', ''))[:16]}", 'ui')
	return event

@app.patch("/events/{event_id}")
async def patch_event(event_id: str, body: dict, account: str | None = None):
	body = {k: v for k, v in body.items() if k in EVENT_PATCH_FIELDS}
	event = await run_gcal(lambda: get_service(account=account).events().patch(
		calendarId='primary', eventId=event_id, body=body
	).execute())
	event['account'] = resolve_account(account)
	cache_upsert_event(event)
	sync.schedule_refresh()
	log_activity('EDIT', f"EVT {event.get('summary')} updated", 'ui')
	return event

@app.delete("/events/{event_id}")
async def delete_event(event_id: str, account: str | None = None):
	def op():
		get_service(account=account).events().delete(calendarId='primary', eventId=event_id).execute()
		return {'ok': True}
	result = await run_gcal(op)
	cache_remove_event(event_id)
	sync.schedule_refresh()
	log_activity('DELETE', f'EVT {event_id} removed', 'ui')
	return result

TASK_FIELDS = {'title', 'notes', 'due', 'status', 'completed'}

def _sort_tasks(items):
	pending = sorted((t for t in items if t.get('status') != 'completed'), key=lambda t: t.get('position', ''))
	done = sorted((t for t in items if t.get('status') == 'completed'), key=lambda t: t.get('completed', ''), reverse=True)
	return pending + done

@app.get("/tasks")
async def list_tasks():
	items = sync.cached_tasks()
	if items is None:
		# showHidden=False keeps cleared history out - matches the Google Tasks app view
		result = await run_gcal(lambda: get_service('tasks').tasks().list(
			tasklist='@default', showCompleted=True, showHidden=False, maxResults=100
		).execute())
		items = result.get('items', [])
	return _sort_tasks(items)

@app.post("/tasks")
async def create_task(body: dict):
	body = {k: v for k, v in body.items() if k in TASK_FIELDS}
	task = await run_gcal(lambda: get_service('tasks').tasks().insert(
		tasklist='@default', body=body
	).execute())
	cache_upsert_task(task)
	sync.schedule_refresh()
	log_activity('CREATE', f"TASK {task.get('title')}", 'ui')
	return task

@app.patch("/tasks/{task_id}")
async def patch_task(task_id: str, body: dict):
	body = {k: v for k, v in body.items() if k in TASK_FIELDS}
	task = await run_gcal(lambda: get_service('tasks').tasks().patch(
		tasklist='@default', task=task_id, body=body
	).execute())
	cache_upsert_task(task)
	sync.schedule_refresh()
	verb = 'completed' if task.get('status') == 'completed' else 'updated'
	log_activity('EDIT', f"TASK {task.get('title')} {verb}", 'ui')
	return task

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
	def op():
		get_service('tasks').tasks().delete(tasklist='@default', task=task_id).execute()
		return {'ok': True}
	result = await run_gcal(op)
	cache_remove_task(task_id)
	sync.schedule_refresh()
	log_activity('DELETE', f'TASK {task_id} removed', 'ui')
	return result

@app.get("/settings")
async def settings_get():
	return get_settings()

@app.patch("/settings")
async def settings_patch(body: dict):
	return update_settings(body)

@app.get("/status")
async def status():
	return {
		'agent': {'ready': True, 'sessions': len(_clients)},
		'google': await asyncio.to_thread(google_status),
		'sync': sync.last_sync(),
	}

@app.post("/sync")
async def force_sync():
	await sync.refresh()
	return {'ok': True, **sync.last_sync()}

@app.post("/auth/google")
async def auth_google():
	try:
		email = await asyncio.to_thread(link_account)
	except Exception as e:
		raise HTTPException(status_code=502, detail=f'consent flow failed: {e}')
	log_activity('SYNC', f'google account {email} linked', 'ui')
	sync.schedule_refresh()
	return {'ok': True, 'email': email}

@app.post("/accounts/{email}/primary")
async def account_primary(email: str):
	if not await asyncio.to_thread(set_primary_account, email):
		raise HTTPException(status_code=404, detail='account not linked')
	log_activity('SYNC', f'{email} set as primary account', 'ui')
	return {'ok': True}

@app.delete("/accounts/{email}")
async def account_unlink(email: str):
	removed = await asyncio.to_thread(unlink_account, email)
	if not removed:
		raise HTTPException(status_code=404, detail='account not linked')
	log_activity('SYNC', f'google account {email} unlinked', 'ui')
	sync.schedule_refresh()
	return {'ok': True}

@app.get("/activity")
async def activity(limit: int = 200):
	return read_activity(limit)

@app.get("/notes")
async def notes_index():
	return list_notes()

@app.post("/notes")
async def notes_create(body: dict):
	return create_note(body.get('text', ''))

@app.patch("/notes/{note_id}")
async def notes_update(note_id: str, body: dict):
	note = update_note(note_id, body.get('text', ''))
	if note is None:
		raise HTTPException(status_code=404, detail='note not found')
	return note

@app.delete("/notes/{note_id}")
async def notes_delete(note_id: str):
	delete_note(note_id)
	return {'ok': True}

@app.post("/tasks/{task_id}/move")
async def move_task(task_id: str, previous: str | None = None):
	kwargs = {'previous': previous} if previous else {}
	task = await run_gcal(lambda: get_service('tasks').tasks().move(
		tasklist='@default', task=task_id, **kwargs
	).execute())
	cache_upsert_task(task)
	sync.schedule_refresh()
	return task

@app.delete("/chat/sessions/{user_id}")
async def chat_close(user_id: str):
	await close_session(user_id)
	return {'ok': True}

@app.post("/chat/stream")
async def chat_stream(request: AgentRequest):
	async def gen():
		async for event in agent_stream(request.user_id, request.message):
			yield f"data: {json.dumps(event)}\n\n"

	return StreamingResponse(
		gen(),
		media_type="text/event-stream",
		headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
	)
