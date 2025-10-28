from fastapi import FastAPI, HTTPException, Request
import json
from sqlalchemy.sql import func  # Add this import
import re
from typing import Optional, List
from fastapi import Query, HTTPException
from datetime import datetime
from typing import Dict, List, Literal, Optional
from sqlalchemy import create_engine, delete, insert, select, update
from db_setup import metadata  # shared db + metadata
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
from sqlalchemy import create_engine
from models import players, matches # SQLAlchemy tables
from db_setup import  metadata # shared db + metadata
from datetime import datetime
from fastapi import Depends
from sqlalchemy import select, insert, update, Column, String
from models import database, scores as scores_tbl,players, matches 

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
        "http://localhost:3000", "http://127.0.0.1:3000",  # local React dev server
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
    opponent1_id: str
    opponent2_id: Optional[str] = None
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
    opponent1_id: str  # FK to players.id
    opponent2_id: Optional[str] = None  # FK to players.id (nullable for singles)
    match_number: int  # e.g., 1 for Singles 1, 2 for Doubles 1, etc.
    match_type: str  # "singles" or "doubles"
    sets: List[Dict[str, int]] = []  # List of sets with scores (team vs opponent)
    current_game: List[int] = [0, 0]  # Current game score [team, opponent]
    status: str = "pending"  # "live", "completed", or "pending"
    started: bool = False  # Whether the scores has started
    current_serve: Optional[int] = None  # 0 for player1/team, 1 for opponent
    winner: Optional[str] = None 

class UpdateScore(BaseModel):
    player1: Optional[str] = None
    player2: Optional[str] = None
    opponent1: Optional[str] = None
    opponent2: Optional[str] = None
    match_type: Optional[str] = None
    status: Optional[str] = None
    winner: Optional[str] = None
    line_no: Optional[int] = None
    sets: Optional[List[List[int]]] = None
    current_game: Optional[List[int]] = None
    started: Optional[bool] = None
    current_serve: Optional[str] = None

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

class WinnerBody(BaseModel):
    winner: str 

def row_to_iso(row):
    d = dict(row)
    raw = d.get("date")
    if isinstance(raw, datetime):
        d["date"] = raw.replace(tzinfo=None).isoformat(timespec="seconds")
    elif isinstance(raw, str) and raw:
        # "YYYY-MM-DD HH:MM:SS.ffffff" -> "YYYY-MM-DDTHH:MM:SS"
        isoish = raw.replace(" ", "T").split(".")[0]
        try:
            dt = datetime.fromisoformat(isoish)
            d["date"] = dt.isoformat(timespec="seconds")
        except Exception:
            d["date"] = isoish
    else:
        d["date"] = None
    return d

def _looks_live(row):
    st = str(row.get("status") or "").lower()
    started = bool(row.get("started") or 0)
    return (st in {"live", "in_progress", "in-progress"} or started) and st != "completed"
def _coerce_sets(value):
    if value in (None, ""):
        return []
    data = value
    if isinstance(data, str):
        text = data.strip()
        if not text:
            return []
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            scores = []
            for chunk in text.split(","):
                chunk = chunk.strip()
                if not chunk:
                    continue
                parts = re.split(r"[-–]", chunk)
                if len(parts) != 2:
                    continue
                try:
                    team = int(parts[0].strip())
                except ValueError:
                    team = 0
                try:
                    opp = int(parts[1].strip())
                except ValueError:
                    opp = 0
                scores.append([team, opp])
            return scores
    if isinstance(data, dict):
        data = data.get("sets", [])
    if not isinstance(data, list):
        return []
    normalized = []
    for item in data:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            normalized.append([int(item[0] or 0), int(item[1] or 0)])
        elif isinstance(item, dict):
            team = item.get("team")
            if team is None:
                team = item.get("team_score")
            if team is None:
                team = item.get("a")
            opp = item.get("opp")
            if opp is None:
                opp = item.get("opponent_score")
            if opp is None:
                opp = item.get("b")
            normalized.append([int(team or 0), int(opp or 0)])
    return normalized

def _coerce_current_game(value):
    if value in (None, ""):
        return [0, 0]
    data = value
    if isinstance(data, str):
        text = data.strip()
        if not text:
            return [0, 0]
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            digits = [p for p in re.split(r"[^0-9]", text) if p.strip()]
            if len(digits) >= 2:
                try:
                    return [int(digits[0]), int(digits[1])]
                except ValueError:
                    return [0, 0]
            return [0, 0]
    if isinstance(data, dict):
        team = data.get("team")
        if team is None:
            team = data.get("team_score")
        if team is None:
            team = data.get("a")
        opp = data.get("opp")
        if opp is None:
            opp = data.get("opponent_score")
        if opp is None:
            opp = data.get("b")
        return [int(team or 0), int(opp or 0)]
    if isinstance(data, (list, tuple)) and len(data) >= 2:
        return [int(data[0] or 0), int(data[1] or 0)]
    return [0, 0]

def _sets_for_response(value):
    return [{"team": pair[0], "opp": pair[1]} for pair in _coerce_sets(value)]

def _score_row_to_dict(row):
    data = dict(row)
    data["sets"] = [{"team": pair[0], "opp": pair[1]} for pair in _coerce_sets(data.get("sets"))]
    return data

def _coerce_serve(value):
    if value in (None, ""):
        return None
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"team", "player1", "0"}:
            return 0
        if text in {"opponent", "player2", "1"}:
            return 1
        try:
            return int(text)
        except ValueError:
            return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

async def _fetch_match_scores(match_id: int):
    rows = await database.fetch_all(
        select(scores_tbl)
        .where(scores_tbl.c.match_id == match_id)
        .order_by(scores_tbl.c.line_no.asc(), scores_tbl.c.id.asc())
    )
    return [_score_row_to_dict(r) for r in rows]


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

@app.get("/schedule")
async def list_schedule(status: Optional[str] = Query(None)):
    # build query
    q = matches.select().order_by(matches.c.date.desc())
    if status:
        q = q.where(func.lower(matches.c.status) == status.lower())

    rows = await database.fetch_all(q)
    # row_to_iso should handle datetime/date → isoformat; if you don't have it, convert here
    data = [row_to_iso(r) for r in rows]
    return data


@app.get("/schedule/{id}")
async def get_schedule_by_id(id: int):
    query = matches.select().where(matches.c.id == id)
    result = await database.fetch_one(query)
    if not result:
        raise HTTPException(status_code=404, detail="Match not found")
    return row_to_iso(result)
live_scores: List[Dict] = []  # in-memory storage

@app.post("/schedule/{match_id}/start")
async def start_match(match_id: int):
    # Check if the match exists
    existing = await database.fetch_one(matches.select().where(matches.c.id == match_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Match not found")

    # Update the match status to "live"
    await database.execute(
        matches.update().where(matches.c.id == match_id).values(status="live")
    )

    # Automatically create 9 scores (3 doubles, 6 singles)
    scores_to_create = []
    for i in range(1, 10):
        if i <= 3:
            # First 3 are doubles (1 set each)
            scores_to_create.append({
                "match_id": match_id,
                "line_no": i,
                "match_type": "doubles",
                "player1": f"Doubles Player {i}A",
                "player2": f"Doubles Player {i}B",
                "opponent1": f"Doubles Opponent {i}A",
                "opponent2": f"Doubles Opponent {i}B",
                "sets": [[0, 0]],  # 1 set for doubles
                "current_game": [0, 0],
                "status": "live",
                "started": True,
                "current_serve": 0,
                "winner": None,
            })
        else:
            # Next 6 are singles (3 sets each)
            line_no = i - 3
            scores_to_create.append({
                "match_id": match_id,
                "line_no": i,
                "match_type": "singles",
                "player1": f"Singles Player {line_no}",
                "player2": None,
                "opponent1": f"Singles Opponent {line_no}",
                "opponent2": None,
                "sets": [[0, 0], [0, 0], [0, 0]],  # 3 sets for singles
                "current_game": [0, 0],
                "status": "live",
                "started": True,
                "current_serve": 0,
                "winner": None,
            })

    # Insert all scores into the database
    await database.execute_many(scores_tbl.insert(), scores_to_create)

    # Fetch the updated match
    updated_match = await database.fetch_one(matches.select().where(matches.c.id == match_id))
    return {
        "message": "Match started and scores created",
        "match": row_to_iso(updated_match),
        "scores": scores_to_create,
    }
@app.post("/schedule/{match_id}/complete")
async def complete_match(match_id: int, winner: Literal["team", "opponent"]):
    match = await database.fetch_one(matches.select().where(matches.c.id == match_id))
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    await database.execute(
        matches.update().where(matches.c.id == match_id).values(status="completed", winner=winner)
    )
    return {"message": f"Match {match_id} completed; winner set to '{winner}'."}

@app.delete("/schedule/{match_id}")
async def delete_match_and_scores(match_id: int):
    existing = await database.fetch_one(matches.select().where(matches.c.id == match_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Match not found")

    await database.execute(
        scores_tbl.delete().where(scores_tbl.c.match_id == match_id)
    )
    await database.execute(matches.delete().where(matches.c.id == match_id))

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
        return {
            "id": existing["id"],
            "message": "Scores already exists",
            "scores": _score_row_to_dict(existing),
        }

    # normalize types: started -> 0/1, current_serve -> 0/1
    started_val = int(bool(scores_data.get("started", 0)))
    serve_val = _coerce_serve(scores_data.get("current_serve"))
    line_no = scores_data.get("line_no")
    try:
        line_no = int(line_no)
    except (TypeError, ValueError):
        line_no = 1

    q = insert(scores_tbl).values(
        match_id=match_id,
        line_no=line_no,
        match_type=scores_data.get("match_type"),
        player1=scores_data.get("player1"),
        player2=scores_data.get("player2"),
        opponent1=scores_data.get("opponent1"),
        opponent2=scores_data.get("opponent2"),
        sets=_coerce_sets(scores_data.get("sets") or [[0, 0]]),
        current_game=_coerce_current_game(scores_data.get("current_game")),
        status=scores_data.get("status", "pending"),
        started=started_val,
        current_serve=serve_val,
        winner=scores_data.get("winner"),
    )
    new_id = await database.execute(q)
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == new_id))
    return {"id": new_id, "message": "Scorebox created", "scores": _score_row_to_dict(row)}

@app.post("/scores")
async def create_scores(scores_data: dict):
    sets = _coerce_sets(scores_data.get("sets"))
    q = insert(scores_tbl).values(
        match_id=scores_data["match_id"],
        line_no=scores_data.get("line_no"),
        match_type=scores_data.get("match_type"),
        player1=scores_data.get("player1"),
        player2=scores_data.get("player2"),
        opponent1=scores_data.get("opponent1"),
        opponent2=scores_data.get("opponent2"),
        sets=sets,  # Normalize sets
        current_game=_coerce_current_game(scores_data.get("current_game")),
        status=scores_data.get("status", "live"),
        started=int(bool(scores_data.get("started", 0))),
        current_serve=_coerce_serve(scores_data.get("current_serve")),
        winner=scores_data.get("winner"),
    )
    new_id = await database.execute(q)
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == new_id))
    return {"id": new_id, "message": "scores created", "scores": _score_row_to_dict(row)}

@app.get("/scores/{scores_id}")
async def get_scores_by_id(scores_id: int):
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == scores_id))
    if row:
        return _score_row_to_dict(row)
    raise HTTPException(status_code=404, detail="scores not found")

@app.put("/scores/match/{match_id}")
async def update_scores(match_id: int, scores_data: UpdateScore):
    values = {}
    if "sets" in scores_data and scores_data["sets"] is not None:
        values["sets"] = _coerce_sets(scores_data["sets"])
    await database.execute(
        update(scores_tbl).where(scores_tbl.c.id == match_id).values(**values)
    )
    updated_row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == match_id))
    return {"message": "Score updated successfully", "score": _score_row_to_dict(updated_row)}

@app.delete("/scores/{scores_id}")
async def delete_scores(scores_id: int):
    exists = await database.fetch_one(select(scores_tbl.c.id).where(scores_tbl.c.id == scores_id))
    if not exists:
        raise HTTPException(status_code=404, detail="scores not found")

    await database.execute(scores_tbl.delete().where(scores_tbl.c.id == scores_id))
    return {"message": "scores deleted"}

@app.get("/scores/match/{match_id}/all")
async def get_scores_for_match(match_id: int):
    return await _fetch_match_scores(match_id)

@app.get("/scores/match/{match_id}")
async def get_scores_by_match(match_id: int):
    rows = await _fetch_match_scores(match_id)
    if not rows:
        raise HTTPException(status_code=404, detail=f"No scores found for match {match_id}")
    return rows


@app.post("/scores/match/{match_id}/complete")
async def complete_scores_match(match_id: int, winner: Literal["team", "opponent"]):
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

    # Update the match: set status and winner
    update_match_query = (
        matches.update()
        .where(matches.c.id == match_id)
        .values(status="completed", winner=winner)
    )
    await database.execute(update_match_query)

    return {"message": f"Match {match_id} completed; winner set to '{winner}'."}

@app.get("/matches/{match_id}")
async def get_match(match_id: int):
    row = await database.fetch_one(matches.select().where(matches.c.id == match_id))
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")

    data = row_to_iso(row)
    scores = await _fetch_match_scores(match_id)
    if scores:
        data["scores"] = scores
    return data


@app.get("/matches/{match_id}/scores")
async def get_match_scores(match_id: int):
    return await _fetch_match_scores(match_id)


@app.get("/events/match/{match_id}")
async def get_events_for_match(match_id: int):
    return await _fetch_match_scores(match_id)


@app.get("/schedule/upcoming")
async def get_upcoming_match():
    rows = await database.fetch_all(matches.select())
    upcoming: List[Dict] = []
    now = datetime.utcnow()

    for row in rows:
        item = row_to_iso(row)
        status = str(item.get("status") or "").lower()
        if status == "completed":
            continue
        date_str = item.get("date")
        if not date_str:
            continue
        try:
            dt = datetime.fromisoformat(date_str)
        except ValueError:
            continue
        if dt >= now:
            upcoming.append((dt, item))

    if not upcoming:
        return None

    upcoming.sort(key=lambda pair: pair[0])
    return upcoming[0][1]