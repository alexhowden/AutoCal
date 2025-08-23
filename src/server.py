from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import uvicorn
from .agent import agent_call

state_store: Dict[str, dict] = {}

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
	reply = agent_call(request.user_id, request.message, state_store)
	return AgentResponse(reply=reply)

if __name__ == "__main__":
	uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
