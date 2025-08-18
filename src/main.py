from typing import TypedDict, Annotated, Sequence, List, Dict
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import random
from langchain_tavily import TavilySearch

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import datetime
import os.path

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
			flow = InstalledAppFlow.from_client_secrets_file(
				'credentials.json', SCOPES
			)
			creds = flow.run_local_server(port=0)

	with open('token.json', 'w') as token:
		token.write(creds.to_json())

	return creds

class AgentState(TypedDict):
	messages: Annotated[Sequence[BaseMessage], add_messages]

@tool
def cal_view_events(maxResults: int, timeMin: str):
	'''Returns next (maxResults) events on the user's calendar starting at (timeMin, RFC3339 format). Default to 10 results if no number specified.'''

	creds = cal_auth()

	try:
		service = build('calendar', 'v3', credentials=creds)

		events = service.events().list(
			calendarId='primary',
			timeMin=timeMin,
			maxResults=maxResults,
			singleEvents=True,
			orderBy='startTime'
		).execute()

		if not events:
			return 'No upcoming events found.'

		return events

	except HttpError as error:
		return f'An error occurred: {error}'

@tool
def cal_add_event(summary: str, location: str, description: str, timeMin: str, timeMax: str, timezone: str, recurrence: List[str], attendees: List[Dict[str, str]]):
	'''
	This node creates a google calendar event with the specified information.
	Clarify for critical fields, otherwise it's ok if you leave certain fields blank.
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
	'''

	creds = cal_auth()

	try:
		service = build('calendar', 'v3', credentials=creds)

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
		}

		event = service.events().insert(calendarId='primary', body=body).execute()
		return f'Event created: {event}'

	except HttpError as error:
		return f'An error occurred: {error}'

# @tool
# def cal_check_availability(start: str, end: str, timezone: str):
# 	'''This node checks calendar availability. 'start' and 'end' are of RFC3339 format.'''

# 	creds = cal_auth()

# 	try:
# 		service = build('calendar', 'v3', credentials=creds)

# 		body = {
# 			'timeMin': start,
# 			'timeMax': end,
# 			'timeZone': timezone,
# 			# 'groupExpansionMax': , (max num of cal ids)
# 			# 'calendarExpansionMax': , (max num of calendars)
# 			'items': [{'id': 'primary'}]
# 		}

# 		events = service.freebusy().query(body=body).execute()

# 		return events

# 	except HttpError as error:
# 		return f'An error occurred: {error}'

@tool
def cal_get_event(eventId: str):
	'''This node retrieves an existing google calendar event using its eventId'''

	creds = cal_auth()

	try:
		service = build('calendar', 'v3', credentials=creds)

		event = service.events().get(calendarId='primary', eventId=eventId).execute()

		return event

	except HttpError as error:
		return f'An error occurred: {error}'

# @tool
# def cal_edit_event(eventId: str):
# 	'''This node edits an existing google calendar event using the eventId'''

# 	creds = cal_auth()

# 	try:
# 		service = build('calendar', 'v3', credentials=creds)

# 		body = {

# 		}

# 		events = service.events().update(calendarId='primary', eventId=eventId, body=body).execute()

# 		return events

# 	except HttpError as error:
# 		return f'An error occurred: {error}'

tavily_search = TavilySearch()

tools = [tavily_search, cal_view_events, cal_add_event, cal_get_event]

llm = ChatGoogleGenerativeAI(
    model='gemini-2.0-flash-lite',
    # model='gemini-2.5-flash',
    temperature=0
).bind_tools(tools)

def model_call(state: AgentState) -> AgentState:
	now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
	system_prompt = SystemMessage(content=f'You are an AI agent, primarily centered around google calendar (scheduling, checking availability, etc.). Use the given tools to best support the user. You should also function as a regular chatbot and match the energy of the user. For calendar-related requests, only clarify on critical fields, otherwise do your best without. Before creating events, check for conficting events and inform the user of anything that falls within 30 minutes of the new event. Here is the current date and time as a reference point: {now}')
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

app = graph.compile()

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

		print_stream(app.stream(state, stream_mode='values'))

		state = app.invoke(state)

		# if not state['messages'][-1].tool_calls:
		# 	break

if __name__ == '__main__':
	mainloop()
