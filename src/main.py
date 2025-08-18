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
def add(a: int, b: int):
	'''This node adds two numbers'''
	return a + b
@tool
def subtract(a: int, b: int):
	'''This node subtracts two numbers'''
	return a - b
@tool
def multiply(a: int, b: int):
	'''This node multiplies two numbers'''
	return a * b
@tool
def rand_num(a: int, b: int):
	'''This node returns a random number'''
	return random.randint(a, b)
@tool
def cal_view_events(num_events: int):
	'''	Prints the start and name of the next (num_events) events on the user's calendar. Default to 10 if no number specified.'''
	creds = cal_auth()

	try:
		service = build('calendar', 'v3', credentials=creds)

		now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()

		events_result = (
			service.events()
			.list(
				calendarId='primary',
				timeMin=now,
				maxResults=10,
				singleEvents=True,
				orderBy='startTime',
			)
			.execute()
		)
		events = events_result.get('items', [])

		if not events:
			return 'No upcoming events found.'

		return events

		# formatted_events = []

		# for event in events:
		# 	start = event['start'].get('dateTime', event['start'].get('date'))
		# 	summary = event['summary']
		# 	formatted_events.append(event)

		# return formatted_events

	except HttpError as error:
		return f'An error occurred: {error}'
@tool
def cal_add_event(summary: str, location: str, description: str, start_time: str, end_time: str, timezone: str, recurrence: List[str], attendees: List[Dict[str, str]]):
	'''
	This node creates a google calendar event with the specified information.
	Clarify for critical fields, otherwise it's ok if you leave certain fields blank.
	summary: title of the event, critical
	location: location of the event, not critical
	description: description of event, leave blank unless user specifies details such as room number, attire, reminders, etc
	start_time: starting time of event, in the form '2015-05-28T09:00:00-07:00', critical
	end_time: same deal as start_time, critical
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

		event = {
			'summary': summary,
			'location': location,
			'description': description,
			'start': {
				'dateTime': start_time,
				'timeZone': timezone,
			},
			'end': {
				'dateTime': end_time,
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

		event = service.events().insert(calendarId='primary', body=event).execute()
		return f'Event created: {event}'

	except HttpError as error:
		return f'An error occurred: {error}'

tavily_search = TavilySearch()

tools = [add, subtract, multiply, rand_num, tavily_search, cal_view_events, cal_add_event]

llm = ChatGoogleGenerativeAI(
    # model='gemini-2.0-flash-lite',
    model='gemini-2.5-flash',
    temperature=0
).bind_tools(tools)

def model_call(state: AgentState) -> AgentState:
	now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
	system_prompt = SystemMessage(content=f'You are my AI assistant, please answer my query to the best of your ability. For calendar-related inquiries, only clarify on critical fields, otherwise do your best without. They will know what they want. Here is the current date and time as a reference point: {now}')
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
