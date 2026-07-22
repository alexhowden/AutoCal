from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .agent import agent_call

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
