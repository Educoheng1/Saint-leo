from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy import create_engine
from models import players, matches, match_lineups, database,sets # SQLAlchemy tables
from db_setup import  metadata # shared db + metadata
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import Depends
from models import scoreboxes, database

# Setup SQLite database
DATABASE_URL = "sqlite:///./matches.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create tables
metadata.create_all(engine)

# Initialize FastAPI
app = FastAPI()

LIVE_MATCHES = [
    {"matchType": "Doubles", "matchNumber": 1, "status": "pending"},
    {"matchType": "Doubles", "matchNumber": 2, "status": "pending"},
    {"matchType": "Doubles", "matchNumber": 3, "status": "pending"},
    {"matchType": "Singles", "matchNumber": 1, "status": "pending"},
    {"matchType": "Singles", "matchNumber": 2, "status": "pending"},
    {"matchType": "Singles", "matchNumber": 3, "status": "pending"},
    {"matchType": "Singles", "matchNumber": 4, "status": "pending"},
    {"matchType": "Singles", "matchNumber": 5, "status": "pending"},
    {"matchType": "Singles", "matchNumber": 6, "status": "pending"},
]

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
    year: str
    singles_season: str
    singles_all_time: str
    doubles_season: str
    doubles_all_time: str

class ScoreUpdate(BaseModel):
    player1: str
    player2: str
    set1: list
    set2: list

class ScoreBox(BaseModel):
    match_id: int
    player1_id: int
    player2_id: Optional[int] = None
    opponent1_id: int
    opponent2_id: Optional[int] = None
    match_number: int
    match_type: str  # "singles" or "doubles"
    winner: Optional[str] = None  # "team", "opponent", or None

class SetInput(BaseModel):
    set_number: int
    team_score: int
    opponent_score: int

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
    query = players.insert().values(
        name=player.name,
        year=player.year,
        singles_season=player.singles_season,
        singles_all_time=player.singles_all_time,
        doubles_season=player.doubles_season,
        doubles_all_time=player.doubles_all_time,
    )
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


@app.post("/livescore/{match_number}")
async def update_livescore(match_number: int, match_data: dict):
    for i, match in enumerate(LIVE_MATCHES):
        if match.get("matchNumber") == match_number:
            LIVE_MATCHES[i].update(match_data)
            return {"message": "Match updated", "match": LIVE_MATCHES[i]}
    raise HTTPException(status_code=404, detail="Match not found")

@app.post("/scoreboxes")
async def create_scorebox(entry: ScoreBox):
    query = scoreboxes.insert().values(
        match_id=entry.match_id,
        player1_id=entry.player1_id,
        player2_id=entry.player2_id,
        opponent1_id=entry.opponent1_id,
        opponent2_id=entry.opponent2_id,
        match_number=entry.match_number,
        match_type=entry.match_type,
        winner=entry.winner
    )
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/scoreboxes/{match_id}")
async def get_scoreboxes(match_id: int):
    query = scoreboxes.select().where(scoreboxes.c.match_id == match_id)
    results = await database.fetch_all(query)
    return results

@app.post("/scoreboxes/{scorebox_id}/sets")
async def add_sets(scorebox_id: int, sets_input: List[SetInput]):
    queries = [
        sets.insert().values(
            scorebox_id=scorebox_id,
            set_number=s.set_number,
            team_score=s.team_score,
            opponent_score=s.opponent_score,
        )
        for s in sets_input
    ]
    for query in queries:
        await database.execute(query)
    return {"message": f"{len(queries)} sets added for scorebox {scorebox_id}"}

@app.get("/scoreboxes/{scorebox_id}/sets")
async def get_sets(scorebox_id: int):
    query = sets.select().where(sets.c.scorebox_id == scorebox_id)
    result = await database.fetch_all(query)
    return result
