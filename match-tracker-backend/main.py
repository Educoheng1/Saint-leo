# Stdlib
import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Literal

# FastAPI
from fastapi import FastAPI, Depends, HTTPException, Request, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

# Pydantic
from pydantic import BaseModel, Field, validator, EmailStr

# SQLAlchemy
import sqlalchemy as sa
from sqlalchemy import create_engine, delete, insert, select, update, Column, String, and_
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

# JWT / password hashing
from jose import jwt, JWTError
from passlib.context import CryptContext

# App modules
from db_setup import engine, SessionLocal, metadata, database
from models import players, matches, scores as scores_tbl, users

# Create tables
app = FastAPI()
metadata.create_all(bind=engine)



SECRET_KEY = "change-me"  # make sure this is the SAME everywhere
ALGO = "HS256"

pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local React development server
        "http://127.0.0.1:3000",  # Alternative localhost
        "https://saint-leo-live-scores.onrender.com", 
         "https://saint-leo-live-score.onrender.com",
    ],
    allow_credentials=True,  # Correct argument name
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)


class RegisterUser(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"

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
class CompleteScorePayload(BaseModel):
    winner: Literal["team", "opponent", "unfinished"]

# ----- helper (consistent with your _coerce_* style) -----
def _coerce_winner(w: Optional[str]):
    if w is None:
        return None
    s = str(w).strip().lower()
    if s in ("team", "home", "0"):
        return 0
    if s in ("opponent", "away", "1"):
        return 1
    if s in ("unfinished", "", "none", "null"):
        return None
    raise HTTPException(status_code=422, detail="winner must be 'team', 'opponent', or 'unfinished'")

class StartScorePayload(BaseModel):
    player1: str = Field(..., min_length=1)
    opponent1: str = Field(..., min_length=1)
    player2: Optional[str] = None      # required for doubles; ignored for singles
    opponent2: Optional[str] = None    # required for doubles; ignored for singles
    current_serve: Optional[int] = 0   # 0=home,1=away (tweak if you use different)

    @validator("player1", "opponent1", pre=True)
    def strip_basic(cls, v):
        return v.strip() if isinstance(v, str) else v

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

def create_access_token(sub: int, role: str, hours: int = 12):
    payload = {
        "sub": str(sub),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=hours),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGO)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2), db=Depends(get_db)):
    

    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGO])
       

        uid = payload.get("sub")
        role = payload.get("role")
       

        if uid is None or role is None:
            print("MISSING uid/role IN TOKEN → 401")
            raise cred_exc

        uid = int(uid)  # <-- cast to int for DB lookup
    except (JWTError, ValueError) as e:
        print("JWT DECODE / UID ERROR:", repr(e))
        raise cred_exc

    row = db.execute(sa.select(users).where(users.c.id == uid)).mappings().first()
    print("USER ROW FROM DB:", row)

    if not row:
        print("NO USER FOUND FOR ID", uid, "→ 401")
        raise cred_exc

    return row



def admin_required(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user



@app.post("/auth/register")
async def register_user(payload: RegisterUser, db=Depends(get_db)):
    try:
        # Hash the password
        password_hash = pwd.hash(payload.password)
        print("Password during registration:", payload.password)
        print("Hashed password during registration:", password_hash)

        # Insert the new user into the database
        query = users.insert().values(email=payload.email, password_hash=password_hash, role=payload.role)
        new_user_id = await database.execute(query)

        return {"id": new_user_id, "email": payload.email, "role": payload.role}
    except IntegrityError:
        raise HTTPException(status_code=400, detail="User with this email already exists")

@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    print("Raw username repr:", repr(form.username))

    # DEBUG: list all users this app sees
    rows = db.execute(sa.select(users)).mappings().all()


    clean_username = form.username.strip().lower()

    row = db.execute(
        sa.select(users).where(func.lower(users.c.email) == clean_username)
    ).mappings().first()
    print("Query result:", row)

    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password")


    if not pwd.verify(form.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(sub=row["id"], role=row["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": row["id"], "email": row["email"], "role": row["role"]},
    }


@app.get("/auth/me")
def me(user = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "role": user["role"]}

# Example: admin-only endpoint
@app.post("/admin/players")
def create_player(payload: dict, user = Depends(admin_required), db=Depends(get_db)):
    # ...perform insert/update using Core...
    current_user = Depends(admin_required),
    return {"ok": True, "by": user["email"]}

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
    current_user = Depends(admin_required),
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
    current_user = Depends(admin_required),
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
            # First 3 are doubles
            scores_to_create.append({
                "match_id": match_id,
                "line_no": i,
                "match_type": "doubles",
                "player1": f"Doubles Player {i}A",
                "player2": f"Doubles Player {i}B",
                "opponent1": f"Doubles Opponent {i}A",
                "opponent2": f"Doubles Opponent {i}B",
                "sets": [],  # Empty sets to start
                "current_game": [0, 0],
                "status": "Scheduled",
                "started": 1,
                "current_serve": 0,
                "winner": None,
            })
        else:
            # Next 6 are singles
            line_no = i - 3
            scores_to_create.append({
                "match_id": match_id,
                "line_no": line_no,
                "match_type": "singles",
                "player1": f"Singles Player {line_no}",
                "player2": None,
                "opponent1": f"Singles Opponent {line_no}",
                "opponent2": None,
                "sets": [],  # Empty sets to start
                "current_game": [0, 0],
                "status": "Scheduled",
                "started": 1,
                "current_serve": 0,
                "winner": None,
            })

    # Insert the scores into the database
    await database.execute_many(scores_tbl.insert(), scores_to_create)

    return {"message": f"Match {match_id} started and scores created successfully"}


@app.post("/schedule/{match_id}/complete")
async def complete_match(match_id: int, body: WinnerBody):
    current_user = Depends(admin_required),
    # update DB
    query = (
        matches.update()
        .where(matches.c.id == match_id)
        .values(
            status="completed",
            winner=body.winner,
        )
    )
    result = await database.execute(query)

    if result:
        updated_match = await database.fetch_one(
            matches.select().where(matches.c.id == match_id)
        )
        return {
            "message": "Match completed",
            "match": dict(updated_match) if updated_match else None,
        }

    raise HTTPException(status_code=404, detail="Match not found")

@app.delete("/schedule/{match_id}")
async def delete_match_and_scores(match_id: int):
    current_user = Depends(admin_required),
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
    current_user = Depends(admin_required),
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
    current_user = Depends(admin_required),
    query = players.update().where(players.c.id == player_id).values(**payload)
    await database.execute(query)
    return {"message": "Player updated"}


@app.delete("/players/{player_id}")
async def delete_player(player_id: int):
    current_user = Depends(admin_required),
    query = players.delete().where(players.c.id == player_id)
    result = await database.execute(query)

    if result:
        return {"message": "Player deleted"}
    else:
        raise HTTPException(status_code=404, detail="Player not found")

@app.get("/livescore")
def get_livescore():
    return live_scores

@app.post("/scores/{score_id}/start")
async def start_score(score_id: int, body: StartScorePayload):
    current_user = Depends(admin_required),
    # fetch the row
    row = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.id == score_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Score row not found")

    match_type = row["match_type"]  # "doubles" | "singles"
    if row["status"] in ("finished", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Cannot start a {row['status']} score")

    # require partner/opponent2 for doubles
    if match_type == "doubles":
        if not body.player2 or not body.opponent2:
            raise HTTPException(
                status_code=422,
                detail="player2 and opponent2 are required for doubles"
            )
    else:
        # ensure singles stays null
        body.player2 = None
        body.opponent2 = None

    # build updates: set names + start flags (leave sets/current_game as-is)
    updates = {
        "player1": body.player1,
        "opponent1": body.opponent1,
        "player2": body.player2,
        "opponent2": body.opponent2,
        "current_serve": body.current_serve if body.current_serve is not None else row["current_serve"],
        "status": "live",   # align with your matches.status
        "started": 1,
    }

    await database.execute(
        update(scores_tbl).where(scores_tbl.c.id == score_id).values(**updates)
    )

    updated = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.id == score_id)
    )
    return {
        "message": "Score started",
        "score": _score_row_to_dict(updated),
    }
@app.post("/scores/{score_id}/complete")
async def complete_score(score_id: int, body: CompleteScorePayload):
    current_user = Depends(admin_required),
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == score_id))
    if not row:
        raise HTTPException(status_code=404, detail="Score row not found")

    winner_val = _coerce_winner(body.winner)

    # Optional guard: block completing already completed/cancelled rows
    if str(row["status"]).lower() in ("completed", "cancelled"):
        # You can switch to 200 idempotent if you prefer
        raise HTTPException(status_code=409, detail=f"Cannot complete a {row['status']} score")

    await database.execute(
        update(scores_tbl)
        .where(scores_tbl.c.id == score_id)
        .values(status="completed", winner=winner_val)
    )

    updated = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == score_id))
    return {
        "message": "Score completed",
        "score": _score_row_to_dict(updated),
    }
@app.get("/scores/{scores_id}")
async def get_scores_by_id(scores_id: int):
    row = await database.fetch_one(select(scores_tbl).where(scores_tbl.c.id == scores_id))
    if row:
        return _score_row_to_dict(row)
    raise HTTPException(status_code=404, detail="scores not found")


@app.put("/scores/{scores_id}")
async def update_scores(scores_id: int, scores_data: UpdateScore):
    current_user = Depends(admin_required),
    # build the fields we actually want to update
    values = {}

    if scores_data.sets is not None:
        # normalize before saving if needed
        values["sets"] = _coerce_sets(scores_data.sets)

    # prevent empty UPDATE (this is what causes "near WHERE": syntax error)
    if not values:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    # run the UPDATE on the correct row
    stmt = (
        update(scores_tbl)
        .where(
            and_(
                scores_tbl.c.id == scores_id,
            )
        )
        .values(**values)
    )

    await database.execute(stmt)

    # now fetch the updated row to return it
    row_query = (
        select(scores_tbl)
        .where(
            and_(
                scores_tbl.c.id == scores_id,
            )
        )
    )

    updated_row = await database.fetch_one(row_query)

    if not updated_row:
        # means that line (scores_id) doesn't belong to that match_id
        raise HTTPException(status_code=404, detail="Score row not found")

    return {
        "message": "Score updated successfully",
        "score": _score_row_to_dict(updated_row),
    }

@app.delete("/scores/{scores_id}")
async def delete_scores(scores_id: int):
    current_user = Depends(admin_required),
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
    current_user = Depends(admin_required),
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


