from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy import create_engine
from models import players, matches, match_lineups, database # SQLAlchemy tables
from db_setup import  metadata # shared db + metadata
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import Depends

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

class LineupInput(BaseModel):
    players: list[int]

class Match(BaseModel):
    id: int
    date: datetime
    opponent: str
    location: str
    status: Optional[str] = "scheduled"
    team_score: Optional[List[int]] = None
    box_score: Optional[List[Dict]] = None


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
        location=match.location,
        status=match.status or "scheduled"  # Add status here
    )
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/schedule", response_model=List[Match])
async def get_schedule():
    query = matches.select()
    results = await database.fetch_all(query)
    return results

@app.delete("/players/{player_id}")
async def delete_player(player_id: int):
    query = players.delete().where(players.c.id == player_id)
    result = await database.execute(query)

    if result:
        return {"message": "Player deleted"}
    else:
        raise HTTPException(status_code=404, detail="Player not found")


# Delete a match by ID
from fastapi import HTTPException

@app.delete("/schedule/{match_id}")
async def delete_match(match_id: int):
    query = matches.delete().where(matches.c.id == match_id)
    result = await database.execute(query)

    if result:
        return {"message": "Match deleted"}
    raise HTTPException(status_code=404, detail="Match not found")

@app.get("/schedule/{match_id}/lineup")
async def get_schedule_lineup(match_id: int):
    query = match_lineups.select().where(match_lineups.c.match_id == match_id)
    result = await database.fetch_all(query)
    player_ids = [row["player_id"] for row in result]
    return {"players": player_ids}

@app.post("/schedule/{match_id}/lineup")
async def set_schedule_lineup(match_id: int, lineup: LineupInput):
    delete_query = match_lineups.delete().where(match_lineups.c.match_id == match_id)
    await database.execute(delete_query)

    values = [{"match_id": match_id, "player_id": pid} for pid in lineup.players]
    if values:
        insert_query = match_lineups.insert()
        await database.execute_many(insert_query, values)

    return {"message": "Lineup updated"}