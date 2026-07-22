import asyncio
import json
import os.path
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from claude_agent_sdk import (
	AssistantMessage,
	ClaudeAgentOptions,
	ClaudeSDKClient,
	ResultMessage,
	TextBlock,
	create_sdk_mcp_server,
	tool,
)

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

load_dotenv()
SCOPES = ['https://www.googleapis.com/auth/calendar']
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_service = None

def cal_auth():
	creds = None
	token_path = os.path.join(BASE_DIR, 'token.json')

	if os.path.exists(token_path):
		creds = Credentials.from_authorized_user_file(token_path, SCOPES)

	if not creds or not creds.valid:
		if creds and creds.expired and creds.refresh_token:
			creds.refresh(Request())
		else:
			creds_path = os.path.join(BASE_DIR, 'credentials.json')
			flow = InstalledAppFlow.from_client_secrets_file(
				creds_path, SCOPES
			)
			creds = flow.run_local_server(port=0)

		with open(token_path, 'w') as token:
			token.write(creds.to_json())

	return creds

def get_service():
	global _service
	if _service is None:
		_service = build('calendar', 'v3', credentials=cal_auth())
	return _service

def tool_result(data):
	text = data if isinstance(data, str) else json.dumps(data)
	return {'content': [{'type': 'text', 'text': text}]}

@tool(
	'get_time',
	'Returns the current time for a particular IANA timezone. Defaults to America/New_York.',
	{
		'type': 'object',
		'properties': {
			'zone': {'type': 'string', 'description': 'IANA timezone, e.g. America/New_York'},
		},
		'required': [],
	},
)
async def get_time(args):
	tz = ZoneInfo(args.get('zone', 'America/New_York'))
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
	try:
		events = get_service().events().list(
			calendarId='primary',
			timeMin=args['timeMin'],
			maxResults=args.get('maxResults', 10),
			singleEvents=True,
			orderBy='startTime'
		).execute()
		return tool_result(events)

	except HttpError as error:
		return tool_result(f'An error occurred: {error}')

@tool(
	'cal_add_event',
	'''Creates a google calendar event with the specified information.
	timeMax defaults to one hour after timeMin if the user gives no end time.
	colorId guidelines when the user does not specify a color:
	- 9 for classes
	- 3 for academics (anything school related but not specifically class/labs, such as office hours)
	- 5 for social (club meetings, activities, events)
	- 11 for important things (advisor meetings, interviews, calls, exams, etc)
	- 8 if the user says they are not going to the event, but want it in the calendar
	- 7 for anything else''',
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
		},
		'required': ['summary', 'timeMin', 'timeMax', 'colorId'],
	},
)
async def cal_add_event(args):
	try:
		body = {
			'summary': args['summary'],
			'location': args.get('location', ''),
			'description': args.get('description', ''),
			'start': {
				'dateTime': args['timeMin'],
				'timeZone': args.get('timezone', 'America/New_York'),
			},
			'end': {
				'dateTime': args['timeMax'],
				'timeZone': args.get('timezone', 'America/New_York'),
			},
			'recurrence': args.get('recurrence', []),
			'attendees': args.get('attendees', []),
			'reminders': {
				'useDefault': True,
			},
			'colorId': args['colorId']
		}

		event = get_service().events().insert(calendarId='primary', body=body).execute()
		return tool_result(f'Event created: {event}')

	except HttpError as error:
		return tool_result(f'An error occurred: {error}')

@tool(
	'cal_get_event',
	'Retrieves an existing google calendar event using its eventId.',
	{
		'type': 'object',
		'properties': {
			'eventId': {'type': 'string'},
		},
		'required': ['eventId'],
	},
)
async def cal_get_event(args):
	try:
		event = get_service().events().get(calendarId='primary', eventId=args['eventId']).execute()
		return tool_result(event)

	except HttpError as error:
		return tool_result(f'An error occurred: {error}')

@tool(
	'cal_edit_event',
	'''Edits an existing google calendar event using its eventId.
	Only pass the fields that should change; all other fields are preserved automatically.
	timeMin and timeMax use the RFC3339 format.
	colorId guidelines are the same as cal_add_event.''',
	{
		'type': 'object',
		'properties': {
			'eventId': {'type': 'string'},
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
	try:
		body = {}
		for key in ('summary', 'location', 'description', 'recurrence', 'attendees', 'colorId'):
			if key in args:
				body[key] = args[key]

		timezone = args.get('timezone', 'America/New_York')
		if 'timeMin' in args:
			body['start'] = {'dateTime': args['timeMin'], 'timeZone': timezone}
		if 'timeMax' in args:
			body['end'] = {'dateTime': args['timeMax'], 'timeZone': timezone}

		event = get_service().events().patch(calendarId='primary', eventId=args['eventId'], body=body).execute()
		return tool_result(event)

	except HttpError as error:
		return tool_result(f'An error occurred: {error}')

@tool(
	'cal_delete_event',
	'Deletes an existing calendar event using its eventId.',
	{
		'type': 'object',
		'properties': {
			'eventId': {'type': 'string'},
		},
		'required': ['eventId'],
	},
)
async def cal_delete_event(args):
	try:
		get_service().events().delete(calendarId='primary', eventId=args['eventId']).execute()
		return tool_result('Event successfully deleted.')

	except HttpError as error:
		return tool_result(f'An error occurred: {error}')

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
Before creating events, check for conflicting events happening during/around the new event.
If an event ends within half an hour of the new event's start time, or starts within half an hour of the new event's end time, check with the user before creating it.
'''

def build_options():
	return ClaudeAgentOptions(
		system_prompt=SYSTEM_PROMPT,
		mcp_servers={'calendar': calendar_server},
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

async def agent_call(user_id: str, message: str) -> str:
	client = _clients.get(user_id)
	if client is None:
		client = ClaudeSDKClient(options=build_options())
		await client.connect()
		_clients[user_id] = client

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
