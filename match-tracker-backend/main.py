from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from sqlalchemy import create_engine
from models import players, matches  # SQLAlchemy tables
from database import database, metadata  # shared db + metadata
from datetime import datetime
# Setup SQLite database
DATABASE_URL = "sqlite:///./matches.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create tables
metadata.create_all(engine)

# Initialize FastAPI
app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect database on startup/shutdown
@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

# Pydantic models
class Match(BaseModel):
    id: int
    date: datetime
    opponent: str
    location: str

class Player(BaseModel):
    name: str

class ScoreUpdate(BaseModel):
    player1: str
    player2: str
    set1: list
    set2: list


live_scores: List[Dict] = []  # in-memory storage
# Routes
@app.get("/")
async def root():
    return {"message": "Match Tracker API is running!"}


@app.post("/livescore")
async def update_livescore(request: Request):
    data = await request.json()
    global live_scores
    live_scores = data
    return {"status": "updated", "count": len(live_scores)}

@app.get("/livescore")
def get_livescore():
    return live_scores

@app.post("/players")
async def create_player(player: Player):
    query = players.insert().values(name=player.name)
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/players")
async def get_players():
    query = players.select()
    return await database.fetch_all(query)

@app.post("/schedule")
async def create_match(match: Match):
    query = matches.insert().values(
        id=match.id,
        date=match.date,
        opponent=match.opponent,
        location=match.location
    )
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/schedule", response_model=List[Match])
async def get_schedule():
    query = matches.select()
    results = await database.fetch_all(query)
    return results
