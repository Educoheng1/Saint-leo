# Stdlib
import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Literal
from datetime import  timezone
from zoneinfo import ZoneInfo
from fastapi import Depends, HTTPException


# FastAPI
from fastapi import FastAPI, Depends, HTTPException, Request, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

# Pydantic
from pydantic import BaseModel, Field, validator, EmailStr, field_validator

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
from db_setup import engine, SessionLocal, database
from models import players,metadata, matches, scores as scores_tbl, users

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
  first_name: str
  last_name: str
  
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
    gender: Literal["men", "women"]
    year: Optional[str] = None

    doubles_all_time: Optional[int] = None
    doubles_season: Optional[int] = None
    singles_season: Optional[int] = None
    singles_all_time: Optional[int] = None

    model_config = {"extra": "ignore"}  # ignore unknown fields

    @field_validator("*", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        return None if v == "" else v

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
    current_serve: Optional[str] = None  # 0 for player1/team, 1 for opponent
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
    current_game: int | list[int] | None = None 
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
    player1: str
    opponent1: str
    player2: Optional[str] = None
    opponent2: Optional[str] = None
    current_serve: Optional[str] = "0"  # ✅ INT, not string

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


DEFAULT_ROLE = "user"

@app.post("/auth/register")
async def register_user(payload: RegisterUser):
    try:
        # Hash the password
        password_hash = pwd.hash(payload.password)
        print("Password during registration:", payload.password)
        print("Hashed password during registration:", password_hash)

        # Insert the new user into the database
        query = users.insert().values(
            email=payload.email,
            password_hash=password_hash,
            # only include these if your users table has these columns:
            first_name=getattr(payload, "first_name", None),
            last_name=getattr(payload, "last_name", None),
            role=DEFAULT_ROLE,   # 👈 hardcoded backend-controlled role
        )

        new_user_id = await database.execute(query)

        return {"id": new_user_id, "email": payload.email, "role": DEFAULT_ROLE}
    except IntegrityError:
        raise HTTPException(status_code=400, detail="User with this email already exists")

@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    print("Raw username repr:", repr(form.username))

    rows = db.execute(sa.select(users)).mappings().all()

    clean_username = form.username.strip().lower()

    row = (
        db.execute(
            sa.select(users).where(func.lower(users.c.email) == clean_username)
        )
        .mappings()
        .first()
    )
    print("Query result:", row)

    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not pwd.verify(form.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(sub=row["id"], role=row["role"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "role": row["role"],
            "first_name": row["first_name"],   # 👈 add
            "last_name": row["last_name"],     # 👈 add
        },
    }


@app.get("/auth/me")
def me(user = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "role": user["role"]}

# Example: admin-only endpoint
@app.post("/admin/players")
def create_player(payload: dict, user = Depends(admin_required), db=Depends(get_db)):
    # ...perform insert/update using Core...
    current_user = Depends(admin_required)
    return {"ok": True, "by": user["email"]}
from datetime import datetime, timezone

def row_to_iso(row):
    d = dict(row)
    raw = d.get("date")

    if isinstance(raw, datetime):
        # ensure UTC + explicit timezone for frontend
        d["date"] = (
            raw.astimezone(timezone.utc)
               .isoformat(timespec="seconds")
               .replace("+00:00", "Z")
        )
    elif isinstance(raw, str) and raw:
        # fallback (should rarely happen now)
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            d["date"] = (
                dt.astimezone(timezone.utc)
                  .isoformat(timespec="seconds")
                  .replace("+00:00", "Z")
            )
        except Exception:
            d["date"] = raw
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



NY = ZoneInfo("America/New_York")

@app.post("/schedule")
async def create_match(match: Match, ):
    # match.date should be an ISO string like "2026-01-29T13:00:00"
    # Interpret it as New York local time if it has no tzinfo, then convert to UTC.
    dt = datetime.fromisoformat(match.date)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=NY)  # treat input as local NY time

    dt_utc = dt.astimezone(timezone.utc)  # store UTC in DB

    query = matches.insert().values(
        date=dt_utc,
        gender=match.gender,
        opponent=match.opponent,
        location=match.location,
        status=match.status or "scheduled",
        match_number=match.match_number,
        winner=match.winner,
    )

    try:
        new_id = await database.execute(query)
    except Exception as e:
        print("ERROR CREATING MATCH:", e)
        raise HTTPException(status_code=400, detail=str(e))

    return {"id": new_id, "message": "Match created"}


@app.get("/schedule")
async def list_schedule(status: Optional[str] = Query(None)):
    try:
        # build query
        q = matches.select().order_by(matches.c.date.desc())
        if status:
            q = q.where(func.lower(matches.c.status) == status.lower())

        rows = await database.fetch_all(q)
        data = [row_to_iso(r) for r in rows]
        return data

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        # TEMP: show the error so we can debug Render
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "traceback": tb,
            },
        )

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

@app.get("/schedule/upcoming")
async def get_upcoming_match():
    rows = await database.fetch_all(matches.select())
    upcoming = []

    now = datetime.now(timezone.utc)

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

        # if dt is naive, assume it's UTC (or NY if you prefer)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        dt_utc = dt.astimezone(timezone.utc)

        if dt_utc >= now:
            upcoming.append((dt_utc, item))

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
    # Check if the match exists
    existing = await database.fetch_one(
        matches.select().where(matches.c.id == match_id)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Match not found")

    # Update the match status to "live"
    await database.execute(
        matches.update().where(matches.c.id == match_id).values(status="live")
    )

    scores_to_create = []
    for i in range(1, 10):
        if i <= 3:
            # doubles
            scores_to_create.append({
                "match_id": match_id,
                "line_no": i,
                "match_type": "doubles",
                "player1": f"Doubles Player {i}A",
                "player2": f"Doubles Player {i}B",
                "opponent1": f"Doubles Opponent {i}A",
                "opponent2": f"Doubles Opponent {i}B",
                "sets": [[0, 0], [0, 0], [0, 0]],
                "current_game": 0,     # ✅ int
                "status": "Scheduled",
                "started": 1,
                "current_serve": "0",    
                "winner": None,
            })
        else:
            # singles (lines 1–6)
            line_no = i - 3
            scores_to_create.append({
                "match_id": match_id,
                "line_no": line_no,
                "match_type": "singles",
                "player1": f"Singles Player {line_no}",
                "player2": None,
                "opponent1": f"Singles Opponent {line_no}",
                "opponent2": None,
                "sets": [[0, 0], [0, 0], [0, 0]],
                "current_game": 0,     # ✅ int
                "status": "Scheduled",
                "started": 1,
                "current_serve": "0",    
                "winner": None,
            })

    await database.execute_many(scores_tbl.insert(), scores_to_create)

    return {"message": f"Match {match_id} started and scores created successfully"}

@app.post("/schedule/{match_id}/complete")
async def complete_match(match_id: int, body: WinnerBody):
    # This Depends here does nothing – FastAPI won't run it like this.
    # If you want auth later, we can move it into the function parameters.
    current_user = Depends(admin_required)

    # Make sure winner is string-friendly for the DB
    winner_val = body.winner
    if winner_val is not None:
        winner_val = str(winner_val)

    # Update the match
    query = (
        matches.update()
        .where(matches.c.id == match_id)
        .values(
            status="completed",
            winner=winner_val,
        )
    )
    await database.execute(query)

    # Now check if the match exists after update
    updated_match = await database.fetch_one(
        matches.select().where(matches.c.id == match_id)
    )

    if not updated_match:
        raise HTTPException(status_code=404, detail="Match not found")

    return {
        "message": "Match completed",
        "match": dict(updated_match),
    }


@app.delete("/schedule/{match_id}")
async def delete_match_and_scores(match_id: int):
    current_user = Depends(admin_required)
    existing = await database.fetch_one(matches.select().where(matches.c.id == match_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Match not found")

    await database.execute(
        scores_tbl.delete().where(scores_tbl.c.match_id == match_id)
    )
    await database.execute(matches.delete().where(matches.c.id == match_id))

    return {"message": f"Match {match_id} and its scores deleted successfully"}

PLAYER_COLUMNS = {
    "name", "gender", "year",
     "doubles_all_time", "doubles_season",
    "singles_season", "singles_all_time",
}
@app.post("/players")
async def create_player(player: Player, current_user: str = Depends(admin_required)):
    # Convert missing fields to NULL
    data = {
        "name": player.name,
        "gender": player.gender,
        "year": player.year if player.year is not None else None,
    }

    query = players.insert().values(**data)
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/players")
async def get_players():
    query = players.select()
    return await database.fetch_all(query)


@app.put("/players/{player_id}")
async def update_player(player_id: int, payload: dict, current_user: str = Depends(admin_required)):
    # Keep ONLY valid columns (avoid "Unconsumed column names" error)
    clean_payload = {k: (v if v not in ["", None] else None) 
                     for k, v in payload.items() if k in PLAYER_COLUMNS}

    # If nothing valid was sent → still safe, but does no update
    if not clean_payload:
        clean_payload = {"year": None, "gender": None, "name": None}

    query = players.update().where(players.c.id == player_id).values(**clean_payload)
    await database.execute(query)

    return {"message": "Player updated", "updated": clean_payload}


@app.delete("/players/{player_id}")
async def delete_player(player_id: int):
    current_user = Depends(admin_required)
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
        body.player2 = None
        body.opponent2 = None

    # ✅ force current_serve to int (works for "0", 0, None, etc.)
    serve_val = body.current_serve if body.current_serve is not None else row["current_serve"]
    serve_val = "0" if serve_val is None else str(serve_val)

    if serve_val not in ("0", "1"):
     raise HTTPException(status_code=422, detail="current_serve must be '0' or '1'")

    updates = {
        "player1": body.player1,
        "opponent1": body.opponent1,
        "player2": body.player2,
        "opponent2": body.opponent2,
        "current_serve": serve_val,  # ✅ int
        "status": "live",
        "started": 1,
    }

    await database.execute(
        update(scores_tbl).where(scores_tbl.c.id == score_id).values(**updates)
    )

    updated = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.id == score_id)
    )
    return {"message": "Score started", "score": _score_row_to_dict(updated)}
# helper – make sure this returns STR, not int
def _coerce_winner(winner):
    # frontend sends: "team" | "opponent" | "unfinished"
    if winner in ("team", "1", 1):
        return "1"          # string
    if winner in ("opponent", "2", 2):
        return "2"          # string
    return None             # unfinished / no winner yet

@app.post("/scores/{score_id}/complete")
async def complete_score(score_id: int, body: CompleteScorePayload):
    print("=== COMPLETE SCORE CALLED ===")
    print("score_id:", score_id)
    print("raw body.winner:", body.winner, type(body.winner))

    row = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.id == score_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Score row not found")

    print("row status before:", row["status"])
    print("row winner before:", row["winner"])

    winner_val = _coerce_winner(body.winner)
    print("coerced winner_val:", winner_val, type(winner_val))

    if str(row["status"]).lower() in ("completed", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot complete a {row['status']} score",
        )

    await database.execute(
        update(scores_tbl)
        .where(scores_tbl.c.id == score_id)
        .values(
            status="completed",
            winner=winner_val,
        )
    )

    updated = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.id == score_id)
    )

    print("row status after:", updated["status"])
    print("row winner after:", updated["winner"])
    print("=== COMPLETE SCORE END ===")

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
async def update_scores(scores_id: int, payload: UpdateScore):
    print("Received payload:", payload)
    values = {}

    # --- allow editing meta fields (names, type, line, etc.) ---
    if payload.match_type is not None:
        values["match_type"] = payload.match_type

    if payload.line_no is not None:
        values["line_no"] = int(payload.line_no)

    if payload.player1 is not None:
        values["player1"] = payload.player1

    if payload.player2 is not None:
        values["player2"] = payload.player2

    if payload.opponent1 is not None:
        values["opponent1"] = payload.opponent1

    if payload.opponent2 is not None:
        values["opponent2"] = payload.opponent2

    # --- sets + current_game ---
    if payload.sets is not None:
        values["sets"] = payload.sets

        # recompute total games from sets (only if sets provided)
        try:
            values["current_game"] = sum((team + opp) for team, opp in payload.sets)
        except Exception:
            raise HTTPException(
                status_code=422,
                detail="Invalid sets format; expected [[team, opponent], ...]"
            )

    # allow overriding current_game explicitly
    if payload.current_game is not None:
        values["current_game"] = int(payload.current_game)

    # --- status / serve / winner ---
    if payload.status is not None:
        values["status"] = payload.status

    if payload.current_serve is not None:
        values["current_serve"] = str(payload.current_serve)

    if "winner" in payload.model_fields_set:
        values["winner"] = payload.winner

    if not values:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    stmt = (
        update(scores_tbl)
        .where(scores_tbl.c.id == scores_id)
        .values(**values)
    )
    await database.execute(stmt)

    updated_row = await database.fetch_one(
        select(scores_tbl).where(scores_tbl.c.id == scores_id)
    )
    if not updated_row:
        raise HTTPException(status_code=404, detail="Score row not found")

    return {
        "message": "Score updated successfully",
        "score": _score_row_to_dict(updated_row),
    }

@app.delete("/scores/{scores_id}")
async def delete_scores(scores_id: int):
    current_user = Depends(admin_required)
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
    current_user = Depends(admin_required)
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


