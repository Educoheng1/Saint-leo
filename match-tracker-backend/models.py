from sqlalchemy import MetaData, Table, Column, Integer, String, DateTime, JSON
from sqlalchemy import create_engine
from databases import Database

DATABASE_URL = "sqlite:///./matches.db"

database = Database(DATABASE_URL)
engine = create_engine(DATABASE_URL)
metadata = MetaData()

# Define tables
matches = Table(
    "matches",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("date", DateTime, nullable=False),
    Column("opponent", String, nullable=False),
    Column("location", String, nullable=True),
    Column("status", String, default="scheduled"),
    Column("team_score", JSON, nullable=True),
    Column("box_score", JSON, nullable=True),
)

players = Table(
    "players",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String),
    Column("year", String),  # e.g., Freshman, Sophomore, Junior, Senior
    Column("singles_season", String),       # e.g., "6-3"
    Column("singles_all_time", String),     # e.g., "22-12"
    Column("doubles_season", String),       # e.g., "5-4"
    Column("doubles_all_time", String),     # e.g., "18-15"
)

match_lineups = Table(
    "match_lineups",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("match_id", Integer),
    Column("player_id", Integer),
)
