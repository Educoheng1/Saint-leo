from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import database
from sqlalchemy import select, asc
from models import matches, lines
from datetime import datetime
from models import matches
from datetime import date
from sqlalchemy import create_engine
from models import metadata  # import your MetaData from models.py
from typing import Optional,List

DATABASE_URL = "sqlite:///./matches.db"
engine = create_engine(DATABASE_URL)

# This will create all tables defined in metadata (including matches_table)
metadata.create_all(engine)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React runs here
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class LineCreate(BaseModel):
    line_type: str           # "singles" or "doubles"
    line_number: int
    player1: str
    player2: Optional[str] = None
    opponent1: str
    opponent2: Optional[str] = None
    score: Optional[str] = None
    status: Optional[str] = "scheduled"

class MatchCreate(BaseModel):
    date: datetime
    opponent: str
    location: Optional[str] = None
    status: Optional[str] = "scheduled"
    lines: List[LineCreate]


class Match(BaseModel):
    date: str
    opponent: str
    location: str

class Player(BaseModel):
    name: str

class Lineup(BaseModel):
    match_id: int
    player_id: int


@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/")
async def root():
    return {"message": "Match Tracker API is running!"}

@app.get("/matches")
async def get_matches():
    query = matches.select()
    return await database.fetch_all(query)

@app.post("/matches")
async def create_match(match: Match):
    query = matches.insert().values(
        date=date.fromisoformat(match.date),
        opponent=match.opponent,
        location=match.location
    )
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/matches/live")
async def get_next_match():
    now = datetime.now()
    # Find the next match
    match_query = (
        select(matches)
        .where(matches.c.date >= now)
        .where(matches.c.status != "completed")
        .order_by(asc(matches.c.date))
        .limit(1)
    )
    match_result = await database.fetch_one(match_query)
    if not match_result:
        return {}

    # Get all lines for that match
    lines_query = (
        select(lines)
        .where(lines.c.match_id == match_result.id)
        .order_by(asc(lines.c.line_type), asc(lines.c.line_number))
    )
    lines_result = await database.fetch_all(lines_query)

    return {
        "match": dict(match_result),
        "lines": [dict(line) for line in lines_result]
    }

@app.post("/matches/")
async def create_match(match: MatchCreate):
    # Insert match
    query = matches.insert().values(
        date=match.date,
        opponent=match.opponent,
        location=match.location,
        status=match.status
    )
    match_id = await database.execute(query)

    # Insert all lines
    for line in match.lines:
        line_query = lines.insert().values(
            match_id=match_id,
            line_type=line.line_type,
            line_number=line.line_number,
            player1=line.player1,
            player2=line.player2,
            opponent1=line.opponent1,
            opponent2=line.opponent2,
            score=line.score,
            status=line.status
        )
        await database.execute(line_query)

    return {"id": match_id}

@app.get("/matches/schedule")
async def get_full_schedule():
    from models import matches
    query = matches.select().order_by(matches.c.date)
    return await database.fetch_all(query)

@app.post("/players")
async def create_player(player: Player):
    from models import players
    query = players.insert().values(name=player.name)
    new_id = await database.execute(query)
    return {"id": new_id}

@app.post("/lineups")
async def create_lineup(lineup: Lineup):
    from models import lineups
    query = lineups.insert().values(
        match_id=lineup.match_id,
        player_id=lineup.player_id
    )
    new_id = await database.execute(query)
    return {"id": new_id}

@app.get("/players")
async def get_players():
    from models import players
    query = players.select()
    return await database.fetch_all(query)

@app.get("/lineups")
async def get_lineups():
    from models import lineups
    query = lineups.select()
    return await database.fetch_all(query)
