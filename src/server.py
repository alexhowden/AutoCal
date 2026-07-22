import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from .agent import agent_call, agent_stream

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
