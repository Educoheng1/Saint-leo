from sqlalchemy import MetaData, Table, Column, Integer, String, DateTime, JSON,ForeignKey
from sqlalchemy import create_engine
from databases import Database
from typing import Optional
from pydantic import BaseModel
from typing import List
import sqlalchemy as sa
DATABASE_URL = "sqlite:///./matches.db"

database = Database(DATABASE_URL)
engine = create_engine(DATABASE_URL)
metadata = sa.MetaData()


matches = Table(
    "matches",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("gender", String, nullable=False),
    Column("date", DateTime, nullable=False),
    Column("opponent", String, nullable=False),
    Column("location", String, nullable=True),
    Column("status", String, default="scheduled"),
    Column("team_score", JSON, nullable=True),
    Column("box_score", JSON, nullable=True),
    Column("match_number", Integer, nullable=False),  # Add match_number column
    Column("winner", String, nullable=True),  # Add winner column
)

players = Table(
    "players",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String, nullable=False),        # required
    Column("gender", String, nullable=False),      # required
    Column("year", String, nullable=True),         # FR/SO/JR/SR or 1–4

    # New record/stat columns
    Column("doubles_all_time", Integer, nullable=True),
    Column("doubles_season", Integer, nullable=True),
    Column("singles_season", Integer, nullable=True),
    Column("singles_all_time", Integer, nullable=True),
)


scoreboxes = Table(
    "scoreboxes",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("match_id", Integer),         # FK to matches.id (you can enforce FK manually if needed)
    Column("player1_id", Integer),       # FK to players.id
    Column("player2_id", Integer, nullable=True),
    Column("opponent1_id", Integer),
    Column("opponent2_id", Integer, nullable=True),
    Column("match_number", Integer),     # e.g., 1 for Singles 1, 2 for Doubles 1, etc.
    Column("match_type", String),        # 'singles' or 'doubles'
    Column("winner", String, nullable=True),  # 'team', 'opponent', or null
)

sets = Table(
    "sets",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("scorebox_id", Integer, ForeignKey("scoreboxes.id")),
    Column("set_number", Integer),
    Column("team_score", Integer),
    Column("opponent_score", Integer),
)
scores = Table(
    "scores",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("match_id", Integer, ForeignKey("matches.id"), nullable=False),  # FK to matches table
    Column("match_type", String, nullable=True),
    Column("line_no", Integer, nullable=False, default=1),
    Column("status", String, nullable=False, default="pending"),  # e.g., 'live', 'completed'
    Column("player1", String, nullable=True),
    Column("player2", String, nullable=True),
    Column("opponent1", String, nullable=True),  # Ensure this column exists
    Column("opponent2", String, nullable=True),
    Column("sets", JSON, nullable=True),       # JSON to store sets data
    Column("current_game", Integer, nullable=True),
    Column("started", Integer, nullable=False, default=0),  # Use Integer for boolean (0 = False, 1 = True)
    Column("current_serve", String, nullable=True),  # 0 for player1, 1 for player2
    Column("winner", String),
    
    
)
scores_tbl = scores
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
    current_game: Optional[int] = None
    started: Optional[bool] = None
    current_serve: Optional[str] = None

    # models.py
users = sa.Table(
    "users",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("email", sa.String, nullable=False, unique=True, index=True),
    sa.Column("password_hash", sa.String, nullable=False),
    sa.Column("first_name", sa.String, nullable=False),
    sa.Column("last_name", sa.String, nullable=False),
    sa.Column("role", sa.String, nullable=False, server_default="user"),  # "admin" or "user"
)
