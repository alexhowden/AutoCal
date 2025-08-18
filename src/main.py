from typing import TypedDict, Annotated, Sequence
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import random
from langchain_tavily import TavilySearch

load_dotenv()

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

tavily_search = TavilySearch()

tools = [add, subtract, multiply, rand_num, tavily_search]

llm = ChatGoogleGenerativeAI(
    # model='gemini-2.0-flash-lite',
    model='gemini-2.5-flash',
    temperature=0
).bind_tools(tools)

def model_call(state: AgentState) -> AgentState:
	system_prompt = SystemMessage(content='You are my AI assistant, please answer my query to the best of your ability.')
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
