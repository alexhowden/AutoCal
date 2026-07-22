import asyncio
import json
import os.path
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from claude_agent_sdk import (
	AssistantMessage,
	ClaudeAgentOptions,
	ClaudeSDKClient,
	ResultMessage,
	StreamEvent,
	TextBlock,
	create_sdk_mcp_server,
	tool,
)

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .store import get_settings, log_activity, list_accounts, save_accounts

load_dotenv()
SCOPES = [
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/tasks',
]
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_services: dict[str, object] = {}
_service_lock = threading.Lock()
API_VERSIONS = {'calendar': 'v3', 'tasks': 'v1'}

def get_accounts():
	'''Registry of linked google accounts; migrates the original token.json in place.'''
	accounts = list_accounts()
	if not accounts and os.path.exists(os.path.join(BASE_DIR, 'token.json')):
		accounts = [{'email': '', 'token': 'token.json'}]
		save_accounts(accounts)
	return accounts

def _run_consent_flow():
	creds_path = os.path.join(BASE_DIR, 'credentials.json')
	flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
	return flow.run_local_server(port=0, timeout_seconds=180)

def account_creds(entry):
	'''Valid credentials for one account; refreshes silently, re-consents interactively.'''
	token_path = os.path.join(BASE_DIR, entry['token'])
	creds = None

	if os.path.exists(token_path):
		# no scopes arg: creds.scopes must reflect what the token was GRANTED,
		# not what we are requesting, or the stale-scope check below always passes
		creds = Credentials.from_authorized_user_file(token_path)
		if not creds.scopes or not set(SCOPES).issubset(set(creds.scopes)):
			creds = None

	if not creds or not creds.valid:
		if creds and creds.expired and creds.refresh_token:
			try:
				creds.refresh(Request())
			except Exception:
				creds = None

		if not creds or not creds.valid:
			creds = _run_consent_flow()

		with open(token_path, 'w') as token:
			token.write(creds.to_json())

	return creds

def get_service(api='calendar', account=None):
	'''Service for one account (by email); defaults to the primary (first linked).'''
	accounts = get_accounts()
	if not accounts:
		raise RuntimeError('no linked google account - use Link account in settings')
	entry = next((a for a in accounts if a.get('email') == account), accounts[0])
	key = (entry['token'], api)
	with _service_lock:
		if key not in _services:
			_services[key] = build(api, API_VERSIONS[api], credentials=account_creds(entry))
		return _services[key]

def _email_for(creds):
	cal = build('calendar', 'v3', credentials=creds).calendarList().get(calendarId='primary').execute()
	return cal.get('id', '')

def google_status():
	'''Per-account link health WITHOUT ever launching the interactive OAuth flow.'''
	statuses = []
	accounts = get_accounts()
	changed = False
	for entry in accounts:
		token_path = os.path.join(BASE_DIR, entry['token'])
		status = {'email': entry.get('email', ''), 'connected': False}
		try:
			if not os.path.exists(token_path):
				status['reason'] = 'no token'
			else:
				creds = Credentials.from_authorized_user_file(token_path)
				if not creds.scopes or not set(SCOPES).issubset(set(creds.scopes)):
					status['reason'] = 'missing scopes'
				else:
					email = _email_for(creds)
					if email and entry.get('email') != email:
						entry['email'] = email
						changed = True
					status.update(
						connected=True,
						email=email,
						scopes=[s.rsplit('/', 1)[-1] for s in creds.scopes],
					)
		except Exception as e:
			status['reason'] = str(e)[:120]
		statuses.append(status)
	if changed:
		save_accounts(accounts)
	return statuses

def link_account():
	'''Runs a consent flow; whichever account the user picks gets linked (or re-linked).'''
	creds = _run_consent_flow()
	email = _email_for(creds)
	accounts = get_accounts()
	entry = next((a for a in accounts if a.get('email') == email), None)
	if entry is None:
		os.makedirs(os.path.join(BASE_DIR, 'data'), exist_ok=True)
		entry = {'email': email, 'token': f'data/token-{len(accounts) + 1}.json'}
		accounts.append(entry)
	with open(os.path.join(BASE_DIR, entry['token']), 'w') as token:
		token.write(creds.to_json())
	save_accounts(accounts)
	with _service_lock:
		_services.clear()
	return email

def unlink_account(email):
	'''Drops an account: revokes the grant (best effort), deletes the token, updates the registry.'''
	accounts = get_accounts()
	entry = next((a for a in accounts if a.get('email') == email), None)
	if entry is None:
		return False
	token_path = os.path.join(BASE_DIR, entry['token'])
	try:
		import requests
		creds = Credentials.from_authorized_user_file(token_path)
		requests.post(
			'https://oauth2.googleapis.com/revoke',
			params={'token': creds.refresh_token or creds.token},
			timeout=10,
		)
	except Exception:
		pass
	try:
		os.remove(token_path)
	except FileNotFoundError:
		pass
	save_accounts([a for a in accounts if a.get('email') != email])
	with _service_lock:
		_services.clear()
	return True

async def gcal(op, log=None):
	'''Runs blocking Google API work off the event loop so a slow call
	(or a pending OAuth consent) never freezes the server.
	log: optional result -> (kind, text) for the activity feed, on success only.'''
	try:
		result = await asyncio.to_thread(op)
		if log:
			try:
				kind, text = log(result)
				log_activity(kind, text, 'agent')
			except Exception:
				pass
		return tool_result(result)
	except HttpError as error:
		return tool_result(f'An error occurred: {error}')

def tool_result(data):
	text = data if isinstance(data, str) else json.dumps(data)
	return {'content': [{'type': 'text', 'text': text}]}

@tool(
	'get_time',
	"Returns the current time for a particular IANA timezone. Defaults to the user's configured timezone.",
	{
		'type': 'object',
		'properties': {
			'zone': {'type': 'string', 'description': 'IANA timezone, e.g. America/New_York'},
		},
		'required': [],
	},
)
async def get_time(args):
	tz = ZoneInfo(args.get('zone', get_settings()['timezone']))
	return tool_result(datetime.now(tz).isoformat())

@tool(
	'cal_view_events',
	"Returns the next events on the user's calendar starting at timeMin (RFC3339 format). Defaults to 10 results if no number specified.",
	{
		'type': 'object',
		'properties': {
			'timeMin': {'type': 'string', 'description': 'start of the search window, RFC3339 format'},
			'maxResults': {'type': 'integer', 'description': 'number of events to return, default 10'},
		},
		'required': ['timeMin'],
	},
)
async def cal_view_events(args):
	def op():
		merged = []
		for acct in get_accounts():
			email = acct.get('email', '')
			events = get_service(account=email).events().list(
				calendarId='primary',
				timeMin=args['timeMin'],
				maxResults=args.get('maxResults', 10),
				singleEvents=True,
				orderBy='startTime'
			).execute()
			for ev in events.get('items', []):
				ev['account'] = email
				merged.append(ev)
		merged.sort(key=lambda e: e['start'].get('dateTime', e['start'].get('date', '')))
		return {'items': merged}

	return await gcal(
		op,
		log=lambda r: ('SEARCH', f"scanned from {args['timeMin'][:16]} // {len(r.get('items', []))} results"),
	)

@tool(
	'cal_add_event',
	'''Creates a google calendar event with the specified information.
	timeMax defaults to one hour after timeMin if the user gives no end time.
	For colorId, follow the event color protocol from your system instructions.''',
	{
		'type': 'object',
		'properties': {
			'summary': {'type': 'string', 'description': 'title of the event'},
			'location': {'type': 'string', 'description': 'location of the event, blank string if unspecified'},
			'description': {'type': 'string', 'description': 'description of event, blank string unless user specifies details such as room number, attire, reminders, etc'},
			'timeMin': {'type': 'string', 'description': 'starting time of event using the RFC3339 format, critical'},
			'timeMax': {'type': 'string', 'description': 'ending time of event using RFC3339 format'},
			'timezone': {'type': 'string', 'description': "IANA timezone, default 'America/New_York'"},
			'recurrence': {
				'type': 'array',
				'items': {'type': 'string'},
				'description': 'recurrence rules following the iCalendar (RFC 5545) standard, empty list if nonrepeating',
			},
			'attendees': {
				'type': 'array',
				'items': {
					'type': 'object',
					'properties': {'email': {'type': 'string'}},
					'required': ['email'],
				},
				'description': "list of attendee emails, e.g. [{'email': 'lpage@example.com'}], will usually be empty",
			},
			'colorId': {'type': 'string', 'description': 'color of the event, see tool description for guidelines'},
			'account': {'type': 'string', 'description': 'email of the google account to use; omit for the primary account'},
		},
		'required': ['summary', 'timeMin', 'timeMax', 'colorId'],
	},
)
async def cal_add_event(args):
	tz = args.get('timezone', get_settings()['timezone'])
	body = {
		'summary': args['summary'],
		'location': args.get('location', ''),
		'description': args.get('description', ''),
		'start': {
			'dateTime': args['timeMin'],
			'timeZone': tz,
		},
		'end': {
			'dateTime': args['timeMax'],
			'timeZone': tz,
		},
		'recurrence': args.get('recurrence', []),
		'attendees': args.get('attendees', []),
		'reminders': {
			'useDefault': True,
		},
		'colorId': args['colorId']
	}

	return await gcal(
		lambda: get_service(account=args.get('account')).events().insert(calendarId='primary', body=body).execute(),
		log=lambda r: ('CREATE', f"EVT {r.get('summary')} // {r['start'].get('dateTime', '')[:16]} // colorId {r.get('colorId', '-')}"),
	)

@tool(
	'cal_get_event',
	'Retrieves an existing google calendar event using its eventId.',
	{
		'type': 'object',
		'properties': {
			'eventId': {'type': 'string'},
			'account': {'type': 'string', 'description': 'email of the google account to use; omit for the primary account'},
		},
		'required': ['eventId'],
	},
)
async def cal_get_event(args):
	return await gcal(lambda: get_service(account=args.get('account')).events().get(calendarId='primary', eventId=args['eventId']).execute())

@tool(
	'cal_edit_event',
	'''Edits an existing google calendar event using its eventId.
	Only pass the fields that should change; all other fields are preserved automatically.
	timeMin and timeMax use the RFC3339 format.
	For colorId, follow the event color protocol from your system instructions.''',
	{
		'type': 'object',
		'properties': {
			'eventId': {'type': 'string'},
			'account': {'type': 'string', 'description': 'email of the google account to use; omit for the primary account'},
			'summary': {'type': 'string'},
			'location': {'type': 'string'},
			'description': {'type': 'string'},
			'timeMin': {'type': 'string'},
			'timeMax': {'type': 'string'},
			'timezone': {'type': 'string'},
			'recurrence': {'type': 'array', 'items': {'type': 'string'}},
			'attendees': {
				'type': 'array',
				'items': {
					'type': 'object',
					'properties': {'email': {'type': 'string'}},
					'required': ['email'],
				},
			},
			'colorId': {'type': 'string'},
		},
		'required': ['eventId'],
	},
)
async def cal_edit_event(args):
	body = {}
	for key in ('summary', 'location', 'description', 'recurrence', 'attendees', 'colorId'):
		if key in args:
			body[key] = args[key]

	timezone = args.get('timezone', get_settings()['timezone'])
	if 'timeMin' in args:
		body['start'] = {'dateTime': args['timeMin'], 'timeZone': timezone}
	if 'timeMax' in args:
		body['end'] = {'dateTime': args['timeMax'], 'timeZone': timezone}

	return await gcal(
		lambda: get_service(account=args.get('account')).events().patch(calendarId='primary', eventId=args['eventId'], body=body).execute(),
		log=lambda r: ('EDIT', f"EVT {r.get('summary')} updated"),
	)

@tool(
	'cal_delete_event',
	'Deletes an existing calendar event using its eventId.',
	{
		'type': 'object',
		'properties': {
			'eventId': {'type': 'string'},
			'account': {'type': 'string', 'description': 'email of the google account to use; omit for the primary account'},
		},
		'required': ['eventId'],
	},
)
async def cal_delete_event(args):
	def op():
		get_service(account=args.get('account')).events().delete(calendarId='primary', eventId=args['eventId']).execute()
		return 'Event successfully deleted.'
	return await gcal(op, log=lambda r: ('DELETE', f"EVT {args['eventId']} removed"))

calendar_server = create_sdk_mcp_server(
	name='calendar',
	version='1.0.0',
	tools=[get_time, cal_view_events, cal_add_event, cal_get_event, cal_edit_event, cal_delete_event],
)

SYSTEM_PROMPT = '''
You are AutoCal, an AI agent designed to manage the user's google calendar.
Use all available tools, and act as a regular chatbot while matching the user's energy.
For calendar requests, clarify only start time, infer everything else from the user's message.
For all other fields, take what you can from the user input and minimize follow up questions.
Answer the user's request as directly as possible. If they ask for today's events, don't give them events happening tomorrow.
NEVER ask the user for the eventId, always use the cal_view_events tool to find the event and get the id from there.
'''

CONFLICT_CLAUSE = '''Before creating events, check for conflicting events happening during/around the new event.
If an event ends within half an hour of the new event's start time, or starts within half an hour of the new event's end time, check with the user before creating it.'''

def build_options():
	settings = get_settings()
	prompt = SYSTEM_PROMPT + f"The user's default timezone is {settings['timezone']}. Use it whenever they give no explicit zone.\n"
	cats = settings['categories']
	proto = '\n'.join(f"- {c['colorId']} for {c['name']}" for c in cats)
	prompt += (
		'Event color protocol - colorId to use when the user does not specify a color:\n'
		f"{proto}\n- {cats[-1]['colorId']} for anything that fits no category\n"
	)
	accounts = get_accounts()
	if len(accounts) > 1:
		names = ', '.join(
			f"{a.get('email') or 'unknown'}{' (primary)' if i == 0 else ''}" for i, a in enumerate(accounts)
		)
		prompt += (
			f"Linked google accounts: {names}. cal_view_events merges all of them and tags each event "
			"with its account. Pass the account param to create/edit/delete on a specific account; "
			"the primary is used when omitted. Match the account to the context (school vs personal).\n"
		)
	if settings['conflictCheck']:
		prompt += CONFLICT_CLAUSE
	return ClaudeAgentOptions(
		system_prompt=prompt,
		mcp_servers={'calendar': calendar_server},
		include_partial_messages=True,
		disallowed_tools=['Bash', 'Write', 'Edit', 'NotebookEdit'],
		allowed_tools=[
			'WebSearch',
			'mcp__calendar__get_time',
			'mcp__calendar__cal_view_events',
			'mcp__calendar__cal_add_event',
			'mcp__calendar__cal_get_event',
			'mcp__calendar__cal_edit_event',
			'mcp__calendar__cal_delete_event',
		],
	)

_clients: dict[str, ClaudeSDKClient] = {}
_locks: dict[str, asyncio.Lock] = {}

async def get_client(user_id: str) -> ClaudeSDKClient:
	client = _clients.get(user_id)
	if client is None:
		client = ClaudeSDKClient(options=build_options())
		await client.connect()
		_clients[user_id] = client
	return client

HARNESS_TOOLS = {'ToolSearch', 'Agent', 'Task', 'TodoWrite'}

def display_tool_name(name: str) -> str:
	return name.removeprefix('mcp__calendar__')

async def agent_stream(user_id: str, message: str):
	'''Yields event dicts for one agent turn:
	{'type': 'text', 'text': delta} - streamed text
	{'type': 'tool', 'name': tool_name} - a tool call started
	{'type': 'break'} - a new assistant turn started after emitted text
	{'type': 'done', 'result': full_text}
	{'type': 'error', 'message': str}
	'''
	lock = _locks.setdefault(user_id, asyncio.Lock())
	async with lock:
		try:
			client = await get_client(user_id)
			await client.query(message)

			emitted_text = False
			async for msg in client.receive_response():
				if isinstance(msg, StreamEvent):
					ev = msg.event
					if ev.get('type') == 'content_block_delta':
						delta = ev.get('delta', {})
						if delta.get('type') == 'text_delta':
							yield {'type': 'text', 'text': delta['text']}
							emitted_text = True
					elif ev.get('type') == 'content_block_start':
						block = ev.get('content_block', {})
						# harness-internal tools are noise in the chat transcript
						if block.get('type') == 'tool_use' and block.get('name') not in HARNESS_TOOLS:
							yield {'type': 'tool', 'name': display_tool_name(block.get('name', ''))}
					elif ev.get('type') == 'message_start' and emitted_text:
						yield {'type': 'break'}
				elif isinstance(msg, ResultMessage):
					yield {'type': 'done', 'result': msg.result or ''}

		except Exception as e:
			yield {'type': 'error', 'message': str(e)}

async def close_session(user_id: str):
	client = _clients.pop(user_id, None)
	_locks.pop(user_id, None)
	if client:
		await client.disconnect()

async def agent_call(user_id: str, message: str) -> str:
	lock = _locks.setdefault(user_id, asyncio.Lock())
	async with lock:
		client = await get_client(user_id)
		await client.query(message)

		texts = []
		final = None
		async for msg in client.receive_response():
			if isinstance(msg, AssistantMessage):
				for block in msg.content:
					if isinstance(block, TextBlock):
						texts.append(block.text)
			elif isinstance(msg, ResultMessage):
				final = msg.result

		return final or '\n'.join(texts)

async def mainloop():
	while True:
		user_input = input('\nYou: ')
		if user_input.lower() in ['exit', 'quit', 'e', 'q']:
			break

		reply = await agent_call('cli', user_input)
		print(f'\nAutoCal: {reply}')

if __name__ == '__main__':
	asyncio.run(mainloop())
