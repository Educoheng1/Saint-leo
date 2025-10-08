from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
from sqlalchemy import create_engine
from models import players, matches, database,sets, scores # SQLAlchemy tables
from db_setup import  metadata # shared db + metadata
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import Depends
from models import  database
from sqlalchemy import select, insert, update, Column, String
from models import database, scores as scores_tbl

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

@app.get("/")
async def root():
    return {"message": "Match Tracker API is running!"}


class Match(BaseModel):
    date: str  # or datetime if you use from datetime import datetime
    gender: str
    opponent: str
    location: str
    status: str = "scheduled"  # Optional default
    match_number: int
    winner: Optional[str] = None  # Add winner field

class Player(BaseModel):
    name: str
    gender: Literal["men","women"] | str
    year: Optional[str] = None 


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

class scores(BaseModel):
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
    started: bool = False  # Whether the scores has started
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

@app.post("/schedule")
async def create_match(match: Match):
    query = matches.insert().values(
        date=datetime.fromisoformat(match.date),
        gender=match.gender,
        opponent=match.opponent,
        location=match.location,
        status=match.status or "scheduled",
        match_number=match.match_number,
        winner=match.winner  # Add winner field
    )
    new_id = await database.execute(query)
    return {"id": new_id, "message": "Match created"}

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

@app.post("/schedule/{match_id}/start")
async def start_match(match_id: int):
    query = matches.update().where(matches.c.id == match_id).values(
        status="live"
    )
    result = await database.execute(query)
    if result:
        updated_match = await database.fetch_one(matches.select().where(matches.c.id == match_id))
        return {"message": "Match started", "match": updated_match}
    raise HTTPException(status_code=404, detail="Match not found")

@app.post("/schedule/{match_id}/complete")
async def complete_match(match_id: int, winner: str):
    query = matches.update().where(matches.c.id == match_id).values(
        status="completed",
        winner=winner  # Add the winner to the match
    )
    result = await database.execute(query)
    if result:
        updated_match = await database.fetch_one(matches.select().where(matches.c.id == match_id))
        return {"message": "Match completed", "match": updated_match}
    raise HTTPException(status_code=404, detail="Match not found")

@app.delete("/schedule/{match_id}")
async def delete_match_and_scores(match_id: int):
    from models import scores  # Lazy import to avoid circular dependency

    # Delete all scores related to this match
    delete_scores_query = scores.delete().where(scores.c.match_id == match_id)
    await database.execute(delete_scores_query)

    # Then delete the match itself
    delete_match_query = matches.delete().where(matches.c.id == match_id)
    await database.execute(delete_match_query)

    return {"message": f"Match {match_id} and its scores deleted successfully"}


@app.post("/players")
async def create_player(player: Player):
    query = players.insert().values(
        name=player.name,
        year=player.year,
        gender=player.gender, 
    )
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/players")
async def get_players():
    query = players.select()
    return await database.fetch_all(query)


@app.put("/players/{player_id}")
async def update_player(player_id: int, payload: dict):
    query = players.update().where(players.c.id == player_id).values(**payload)
    await database.execute(query)
    return {"message": "Player updated"}


@app.delete("/players/{player_id}")
async def delete_player(player_id: int):
    query = players.delete().where(players.c.id == player_id)
    result = await database.execute(query)

    if result:
        return {"message": "Player deleted"}
    else:
        raise HTTPException(status_code=404, detail="Player not found")

@app.get("/livescore")
def get_livescore():
    return live_scores




@app.post("/scores/{match_id}")
async def start_scores(match_id: int, scores_data: dict):
    # check if exists (one row per match)
    existing = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.match_id == match_id)
    )
    if existing:
        return {"id": existing["id"], "message": "Scores already exists", "scores": existing}

    # normalize types: started -> 0/1, current_serve -> 0/1
    started_val = int(bool(scores_data.get("started", 0)))
    serve_val = scores_data.get("current_serve")
    if isinstance(serve_val, str):
        serve_val = 0 if serve_val == "player1" else 1 if serve_val == "player2" else None

    q = insert(scores_tbl).values(
        match_id=match_id,
        player1=scores_data.get("player1"),
        player2=scores_data.get("player2"),
        sets=scores_data.get("sets", [[0, 0]]),
        current_game=scores_data.get("current_game", [0, 0]),
        status=scores_data.get("status", "pending"),
        started=started_val,
        current_serve=serve_val,
    )
    new_id = await database.execute(q)
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == new_id))
    return {"id": new_id, "message": "Scorebox created", "scores": row}

@app.post("/scores")
async def create_scores(scores_data: dict):
    # Check if the match is live
    match = await database.fetch_one(select(matches).where(matches.c.id == scores_data["match_id"]))
    if not match:
        raise HTTPException(status_code=404, detail=f"Match {scores_data['match_id']} not found")
    if match["status"] != "live":
        raise HTTPException(status_code=400, detail=f"Match {scores_data['match_id']} is not live. Cannot add scores.")

    # Get the next available line_no for the match_id
    existing_scores = await database.fetch_all(
        select(scores_tbl).where(scores_tbl.c.match_id == scores_data["match_id"])
    )
    next_line_no = len(existing_scores) + 1

    started_val = int(bool(scores_data.get("started", 1)))
    serve_val = scores_data.get("current_serve")
    if isinstance(serve_val, str):
        serve_val = 0 if serve_val == "player1" else 1 if serve_val == "player2" else None

    q = insert(scores_tbl).values(
        match_id=scores_data["match_id"],
        line_no=next_line_no,  # Dynamically calculated
        match_type=scores_data.get("match_type"),
        player1=scores_data.get("player1"),
        player2=scores_data.get("player2"),
        sets=scores_data.get("sets", [[0, 0]]),
        current_game=scores_data.get("current_game", [0, 0]),
        status=scores_data.get("status", "live"),
        started=started_val,
        current_serve=serve_val,
        winner=scores_data.get("winner")  # Ensure this is correct
    )
    new_id = await database.execute(q)
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == new_id))
    return {"id": new_id, "message": "scores created", "scores": row}

@app.get("/scores/{scores_id}")
async def get_scores(scores_id: int):
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == scores_id))
    if row: 
        return row
    raise HTTPException(status_code=404, detail="scores not found")

@app.put("/scores/{scores_id}")
async def update_scores(scores_id: int, scores_data: dict):
    exists = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == scores_id))
    if not exists:
        raise HTTPException(status_code=404, detail="scores not found")

    # build partial update dict (don’t write None to NOT NULL cols)
    values = {}
    for k in ("player1", "player2", "sets", "current_game", "status", "winner"):
        if k in scores_data and scores_data[k] is not None:
            values[k] = scores_data[k]

    if "started" in scores_data and scores_data["started"] is not None:
        values["started"] = int(bool(scores_data["started"]))

    if "current_serve" in scores_data and scores_data["current_serve"] is not None:
        cs = scores_data["current_serve"]
        if isinstance(cs, str):
            cs = 0 if cs == "player1" else 1 if cs == "player2" else None
        if cs is not None:
            values["current_serve"] = cs

    if values:
        await database.execute(
            update(scores_tbl).where(scores_tbl.c.id == scores_id).values(**values)
        )

    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == scores_id))
    return {"message": "scores updated", "scores": row}

@app.get("/scores/match/{match_id}/all")
async def get_all_scores_for_match(match_id: int):
    # Query to fetch all scores for the given match_id
    query = scores_tbl.select().where(scores_tbl.c.match_id == match_id)
    scores_list = await database.fetch_all(query)

    if not scores_list:
        raise HTTPException(status_code=404, detail=f"No scores found for match {match_id}")

    return {"match_id": match_id, "scores": scores_list}

@app.post("/scores/match/{match_id}/complete")
async def complete_match_and_transfer_scores(match_id: int):
    # Fetch all scores for the given match_id
    scores_query = scores_tbl.select().where(scores_tbl.c.match_id == match_id)
    scores_list = await database.fetch_all(scores_query)

    if not scores_list:
        raise HTTPException(status_code=404, detail=f"No scores found for match {match_id}")

    # Check if all scores are completed
    incomplete_scores = [score for score in scores_list if score["status"] != "completed"]
    if incomplete_scores:
        raise HTTPException(
            status_code=400,
            detail=f"Not all scores are completed for match {match_id}. Complete all scores before proceeding."
        )
    # Update the match status to "completed"
    update_match_query = matches.update().where(matches.c.id == match_id).values(status="completed")
    await database.execute(update_match_query)

    return {"message": f"Match {match_id} completed, scores transferred to scoreboxes, and match status updated to 'completed'."}