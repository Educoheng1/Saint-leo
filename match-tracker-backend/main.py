from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import database
from models import matches
import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React runs here
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        date=datetime.date.fromisoformat(match.date),
        opponent=match.opponent,
        location=match.location
    )
    new_id = await database.execute(query)
    return {"id": new_id}

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
