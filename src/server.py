import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from googleapiclient.errors import HttpError
from pydantic import BaseModel
from .agent import agent_call, agent_stream, get_service

app = FastAPI()

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
	result = await run_gcal(lambda: get_service().events().list(
		calendarId='primary',
		timeMin=timeMin,
		timeMax=timeMax,
		maxResults=maxResults,
		singleEvents=True,
		orderBy='startTime',
	).execute())
	return result.get('items', [])

EVENT_PATCH_FIELDS = {'summary', 'location', 'description', 'start', 'end', 'colorId', 'recurrence', 'attendees'}

@app.patch("/events/{event_id}")
async def patch_event(event_id: str, body: dict):
	body = {k: v for k, v in body.items() if k in EVENT_PATCH_FIELDS}
	return await run_gcal(lambda: get_service().events().patch(
		calendarId='primary', eventId=event_id, body=body
	).execute())

@app.delete("/events/{event_id}")
async def delete_event(event_id: str):
	def op():
		get_service().events().delete(calendarId='primary', eventId=event_id).execute()
		return {'ok': True}
	return await run_gcal(op)

TASK_FIELDS = {'title', 'notes', 'due', 'status', 'completed'}

@app.get("/tasks")
async def list_tasks():
	# showHidden=False keeps cleared history out - matches the Google Tasks app view
	result = await run_gcal(lambda: get_service('tasks').tasks().list(
		tasklist='@default', showCompleted=True, showHidden=False, maxResults=100
	).execute())
	items = result.get('items', [])
	pending = sorted((t for t in items if t.get('status') != 'completed'), key=lambda t: t.get('position', ''))
	done = sorted((t for t in items if t.get('status') == 'completed'), key=lambda t: t.get('completed', ''), reverse=True)
	return pending + done

@app.post("/tasks")
async def create_task(body: dict):
	body = {k: v for k, v in body.items() if k in TASK_FIELDS}
	return await run_gcal(lambda: get_service('tasks').tasks().insert(
		tasklist='@default', body=body
	).execute())

@app.patch("/tasks/{task_id}")
async def patch_task(task_id: str, body: dict):
	body = {k: v for k, v in body.items() if k in TASK_FIELDS}
	return await run_gcal(lambda: get_service('tasks').tasks().patch(
		tasklist='@default', task=task_id, body=body
	).execute())

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
	def op():
		get_service('tasks').tasks().delete(tasklist='@default', task=task_id).execute()
		return {'ok': True}
	return await run_gcal(op)

@app.post("/tasks/{task_id}/move")
async def move_task(task_id: str, previous: str | None = None):
	kwargs = {'previous': previous} if previous else {}
	return await run_gcal(lambda: get_service('tasks').tasks().move(
		tasklist='@default', task=task_id, **kwargs
	).execute())

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
