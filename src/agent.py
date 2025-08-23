from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_tavily import TavilySearch
from langgraph.checkpoint.memory import InMemorySaver

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from datetime import datetime
import os.path
from dotenv import load_dotenv
from typing import TypedDict, Annotated, Sequence, List, Dict
from zoneinfo import ZoneInfo

load_dotenv()
SCOPES = ['https://www.googleapis.com/auth/calendar']

def cal_auth():
	creds = None

	if os.path.exists('token.json'):
		creds = Credentials.from_authorized_user_file('token.json', SCOPES)

	if not creds or not creds.valid:
		if creds and creds.expired and creds.refresh_token:
			creds.refresh(Request())
		else:
			BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
			creds_path = os.path.join(BASE_DIR, 'credentials.json')
			flow = InstalledAppFlow.from_client_secrets_file(
				creds_path, SCOPES
			)
			creds = flow.run_local_server(port=0)

	with open('token.json', 'w') as token:
		token.write(creds.to_json())

	return creds

creds = cal_auth()
service = build('calendar', 'v3', credentials=creds)

class AgentState(TypedDict):
	messages: Annotated[Sequence[BaseMessage], add_messages]

@tool
def get_time(zone: str='America/New_York'):
	'''This node returns the current time for a particular timezone.'''
	tz = ZoneInfo(zone)
	curr_time = datetime.now(tz)
	return curr_time.isoformat()

@tool
def cal_view_events(timeMin: str, maxResults: int=10):
	'''Returns next (maxResults) events on the user's calendar starting at (timeMin, RFC3339 format). Default to 10 results if no number specified.'''
	global service

	try:
		events = service.events().list(
			calendarId='primary',
			timeMin=timeMin,
			maxResults=maxResults,
			singleEvents=True,
			orderBy='startTime'
		).execute()
		return events

	except HttpError as error:
		return f'An error occurred: {error}'

@tool
def cal_add_event(summary: str, location: str, description: str, timeMin: str, timeMax: str, recurrence: List[str], attendees: List[Dict[str, str]], colorId: str, timezone: str='America/New_York'):
	'''
	This node creates a google calendar event with the specified information.
	summary: title of the event
	location: location of the event, blank string if unspecified
	description: description of event, blank string unless user specifies details such as room number, attire, reminders, etc
	timeMin: starting time of event using the RFC3339 format, critical
	timeMax: ending time of event using RFC3339 format, set to one hour after timeMin if unspecified
	timezone: timezone, default to 'America/New_York'
	recurrence: recurrences, blank list if nonrepeating, follows the iCalendar (RFC 5545) standard
	attendees: list of dictionaries of attendees (emails), here's an example: [
			{'email': 'lpage@example.com'},
			{'email': 'sbrin@example.com'},
		], will usually be empty
	colorId: color of the event. if not specified, use the following guidelines:
	- 9 for classes
	- 3 for academics (anything school related but not specifically class/labs, such as office hours)
	- 5 for social (club meetings, activities, events)
	- 11 for important things (advisor meetings, interviews, calls, exams, etc)
	- 8 if I specify that I am not going to that event, but want it in my calendar
	- 7 for anything else
	'''
	global service

	try:
		body = {
			'summary': summary,
			'location': location,
			'description': description,
			'start': {
				'dateTime': timeMin,
				'timeZone': timezone,
			},
			'end': {
				'dateTime': timeMax,
				'timeZone': timezone,
			},
			'recurrence': recurrence,
			'attendees': attendees,
			'reminders': {
				'useDefault': True,
				# 'overrides': [
				# 	{'method': 'email', 'minutes': 24 * 60},
				# 	{'method': 'popup', 'minutes': 10},
				# ],
			},
			'colorId': colorId
		}

		event = service.events().insert(calendarId='primary', body=body).execute()
		return f'Event created: {event}'

	except HttpError as error:
		return f'An error occurred: {error}'

@tool
def cal_get_event(eventId: str):
	'''This node retrieves an existing google calendar event using its eventId'''
	global service

	try:
		event = service.events().get(calendarId='primary', eventId=eventId).execute()
		return event

	except HttpError as error:
		return f'An error occurred: {error}'

@tool
def cal_edit_event(eventId: str, summary: str, location: str, description: str, timeMin: str, timeMax: str, timezone: str, recurrence: List[str], attendees: List[Dict[str, str]], colorId: str):
	'''
	This node edits an existing google calendar event using the eventId
	Only update the fields that are to be changed, leave everything else the same as the original event

	summary: title of the event, critical
	location: location of the event, not critical
	description: description of event, leave blank unless user specifies details such as room number, attire, reminders, etc
	timeMin: starting time of event using the RFC3339 format, critical
	timeMax: ending time of event using RFC3339 format, set to one hour after timeMin if unspecified
	timezone: unless specified it's going to be 'America/New_York'
	recurrence: recurrences, follows the iCalendar (RFC 5545) standard, use when applicable
	attendees: list of dictionaries of attendees (emails), here's an example: [
			{'email': 'lpage@example.com'},
			{'email': 'sbrin@example.com'},
		], will usually be empty
	colorId: color of the event. if not specified, use the following guidelines:
	- 1 for classes
	- 3 for academics (anything school related but not specifically class/labs, such as office hours)
	- 5 for social (club meetings, activities, events)
	- 11 for important things (advisor meetings, interviews, calls, exams, etc)
	- 8 if I specify that I am not going to that event, but want it in my calendar
	- 9 for anything else
	'''
	global service

	try:
		body = {
			'summary': summary,
			'location': location,
			'description': description,
			'start': {
				'dateTime': timeMin,
				'timeZone': timezone,
			},
			'end': {
				'dateTime': timeMax,
				'timeZone': timezone,
			},
			'recurrence': recurrence,
			'attendees': attendees,
			'reminders': {
				'useDefault': True,
				# 'overrides': [
				# 	{'method': 'email', 'minutes': 24 * 60},
				# 	{'method': 'popup', 'minutes': 10},
				# ],
			},
			'colorId': colorId
		}

		events = service.events().update(calendarId='primary', eventId=eventId, body=body).execute()
		return events

	except HttpError as error:
		return f'An error occurred: {error}'

@tool
def cal_delete_event(eventId: str):
	'''This node deletes an existing calendar event using its eventId'''
	global service

	try:
		events = service.events().delete(calendarId='primary', eventId=eventId).execute()
		return 'Event successfully deleted.'

	except HttpError as error:
		return f'An error occurred: {error}'

tavily_search = TavilySearch()

tools = [tavily_search, get_time, cal_view_events, cal_add_event, cal_get_event, cal_edit_event, cal_delete_event]

llm = ChatGoogleGenerativeAI(
	# model='gemini-2.0-flash',
    # model='gemini-2.0-flash-lite',
    model='gemini-2.5-flash',
    # model='gemini-2.5-flash-lite',
    # model='gemini-2.5-pro',
    temperature=0
).bind_tools(tools)

def model_call(state: AgentState) -> AgentState:
	system_prompt = SystemMessage(content=f'''
		You are an AI agent designed to manage the user's google calendar.
		Use all available tools, and act as a regular chatbot while matching the user's energy.
		For calendar requests, clarify only start time, infer everything else from the user's message.
		For all other fields, take what you can from the user input and minimize follow up questions.
		Answer the user's request as directly as possible. If they ask for today's events, don't give them events happening tomorrow.
		NEVER ask the user for the eventId, always use the cal_view_events tool to find the event and get the id from there.
		Before creating events, check for conficting events happening during/around the new event.
		If an event ends within half an hour of the new event's start time, or starts within half an hour of the new event's end time, check with the user before creating it.
	''')
	response = llm.invoke([system_prompt] + state['messages'])
	return {'messages': [response]}

def conditional_node(state: AgentState) -> AgentState:
	last_message = state['messages'][-1]
	if not last_message.tool_calls:
		return 'end'
	else:
		return 'continue'

graph = StateGraph(AgentState)
graph.add_node('agent', model_call)

tool_node = ToolNode(tools=tools)
graph.add_node('tools', tool_node)

graph.set_entry_point('agent')
graph.add_conditional_edges(
	'agent',
	conditional_node,
	{
		'continue': 'tools',
		'end': END
	}
)

graph.add_edge('tools', 'agent')

app = graph.compile(checkpointer=InMemorySaver())

def print_stream(stream):
	for s in stream:
		message = s['messages'][-1]
		if isinstance(message, tuple):
			print(message)
		else:
			message.pretty_print()

def mainloop():
	state: AgentState = {'messages': []}

	while True:
		user_input = input('\nYou: ')
		if user_input.lower() in ['exit', 'quit', 'e', 'q']:
			break

		state['messages'].append(('user', user_input))
		config = {"configurable": {"thread_id": "1"}}

		print_stream(app.stream(state, stream_mode='values', config=config))

		state = app.invoke(state, config=config)


def agent_call(user_id: str, message: str, state_store: dict):
	state = state_store.get(user_id, {'messages': []})
	state['messages'].append(('user', message))
	config = {'configurable': {'thread_id': user_id}}

	state = app.invoke(state, config=config)
	state_store[user_id] = state
	return state['messages'][-1].content

if __name__ == '__main__':
	mainloop()
