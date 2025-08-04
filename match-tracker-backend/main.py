from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy import create_engine
from models import players, matches, match_lineups, database,sets, events # SQLAlchemy tables
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
    allow_origins=[
        "http://localhost:3000",  # local React dev server
        "https://saint-leo-live-scores.onrender.com"  # your deployed frontend
    ],
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
    date: str  # or datetime if you use from datetime import datetime
    opponent: str
    location: str
    status: str = "scheduled"  # Optional default
    match_number: int

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

class Event(BaseModel):
    match_id: int  # FK to matches.id
    player1_id: int  # FK to players.id
    player2_id: Optional[int] = None  # FK to players.id (nullable for singles)
    opponent1_id: int  # FK to players.id
    opponent2_id: Optional[int] = None  # FK to players.id (nullable for singles)
    match_number: int  # e.g., 1 for Singles 1, 2 for Doubles 1, etc.
    match_type: str  # "singles" or "doubles"
    sets: List[Dict[str, int]] = []  # List of sets with scores (team vs opponent)
    current_game: List[int] = [0, 0]  # Current game score [team, opponent]
    status: str = "pending"  # "live", "completed", or "pending"
    started: bool = False  # Whether the event has started
    current_serve: Optional[int] = None  # 0 for player1/team, 1 for opponent
    winner: Optional[str] = None 

class MatchIn(BaseModel):
    id: int
    date: str
    opponent: str
    location: str
    status: str
    match_number: int

class MatchOut(BaseModel):
    id: int
    date: datetime
    opponent: str
    location: str
    status: str
    match_number: int

@app.get("/schedule", response_model=List[MatchOut])
async def get_schedule():
    query = matches.select()
    results = await database.fetch_all(query)
    return results


@app.get("/schedule/{id}")
async def get_schedule_by_id(id: int):
    query = matches.select().where(matches.c.id == id)
    result = await database.fetch_one(query)
    return result
live_scores: List[Dict] = []  # in-memory storage
# Routes
@app.get("/")
async def root():
    return {"message": "Match Tracker API is running!"}



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
        date=datetime.fromisoformat(match.date),
        opponent=match.opponent,
        location=match.location,
        status=match.status or "scheduled",
        match_number=match.match_number,
    )
    new_id = await database.execute(query)
    return {"id": new_id, "message": "Match created"}


@app.delete("/players/{player_id}")
async def delete_player(player_id: int):
    query = players.delete().where(players.c.id == player_id)
    result = await database.execute(query)

    if result:
        return {"message": "Player deleted"}
    else:
        raise HTTPException(status_code=404, detail="Player not found")


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
@app.post("/events/{match_id}")
async def start_event(match_id: int, event_data: dict):
    # Check if an event already exists for the given match_id
    existing_event = await database.fetch_one(events.select().where(events.c.match_id == match_id))
    if existing_event:
        return {"id": existing_event["id"], "message": "Event already exists", "event": existing_event}

    # Create a new event if none exists
    query = events.insert().values(
        match_id=match_id,
        player1=event_data.get("player1"),
        player2=event_data.get("player2"),
        sets=event_data.get("sets", [[0, 0]]),
        current_game=event_data.get("current_game", [0, 0]),
        status=event_data.get("status", "pending"),
        started=event_data.get("started", False),
        current_serve=event_data.get("current_serve"),
    )
    new_id = await database.execute(query)
    new_event = await database.fetch_one(events.select().where(events.c.id == new_id))
    return {"id": new_id, "message": "Event created", "event": new_event}

@app.post("/events")
async def create_event(event_data: dict):
    query = events.insert().values(
        match_id=event_data["match_id"],  # taken from body
        player1=event_data.get("player1"),
        player2=event_data.get("player2"),
        sets=event_data.get("sets", [[0, 0]]),
        current_game=event_data.get("current_game", [0, 0]),
        status=event_data.get("status", "live"),
        started=event_data.get("started", True),
        current_serve=event_data.get("current_serve"),
    )
    new_id = await database.execute(query)
    new_event = await database.fetch_one(events.select().where(events.c.id == new_id))
    return {"id": new_id, "message": "Event created", "event": new_event}

@app.get("/events/{event_id}")
async def get_event(event_id: int):
    query = events.select().where(events.c.id == event_id)
    event = await database.fetch_one(query)
    if event:
        return event
    raise HTTPException(status_code=404, detail="Event not found")

@app.post("/schedule/{match_id}/start")
async def start_event(match_id: int):
    query = matches.update().where(matches.c.id == match_id).values(
        status="live"
    )
    result = await database.execute(query)
    if result:
        updated_match = await database.fetch_one(matches.select().where(matches.c.id == match_id))
        return {"message": "Match started", "match": updated_match}
    raise HTTPException(status_code=404, detail="Match not found")

@app.put("/events/{event_id}")
async def update_event(event_id: int, event_data: dict):
    existing_event = await database.fetch_one(events.select().where(events.c.id == event_id))
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")

    query = events.update().where(events.c.id == event_id).values(
        player1=event_data.get("player1"),
        player2=event_data.get("player2"),
        sets=event_data.get("sets"),
        current_game=event_data.get("current_game"),
        status=event_data.get("status"),
        started=event_data.get("started"),
        current_serve=event_data.get("current_serve"),
        winner=event_data.get("winner"),  # ✅ Add this
    )
    await database.execute(query)

    updated_event = await database.fetch_one(events.select().where(events.c.id == event_id))
    return {"message": "Event updated", "event": updated_event}


@app.get("/events/match/{match_id}")
async def get_events_for_match(match_id: int):
    query = events.select().where(events.c.match_id == match_id)
    events_list = await database.fetch_all(query)
    return events_list

@app.post("/schedule/{match_id}/complete")
async def complete_event(match_id: int):
    query = matches.update().where(matches.c.id == match_id).values(
        status="completed"
    )
    result = await database.execute(query)
    if result:
        updated_match = await database.fetch_one(matches.select().where(matches.c.id == match_id))
        return {"message": "Match completed", "match": updated_match}
    raise HTTPException(status_code=404, detail="Match not found")
@app.delete("/events/match/{match_id}")
async def delete_events_by_match_id(match_id: int):
    query = events.delete().where(events.c.match_id == match_id)
    await database.execute(query)
    return {"message": f"Events for match {match_id} deleted"}

@app.delete("/schedule/{match_id}")
async def delete_match_and_events(match_id: int):
    # Delete all events related to this match
    delete_events_query = events.delete().where(events.c.match_id == match_id)
    await database.execute(delete_events_query)

    # Then delete the match itself
    delete_match_query = matches.delete().where(matches.c.id == match_id)
    await database.execute(delete_match_query)

    return {"message": f"Match {match_id} and its events deleted successfully"}

@app.put("/players/{player_id}")
async def update_player(player_id: int, payload: dict):
    query = players.update().where(players.c.id == player_id).values(**payload)
    await database.execute(query)
    return {"message": "Player updated"}
