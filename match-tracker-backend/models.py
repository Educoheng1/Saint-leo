from sqlalchemy import MetaData, Table, Column, Integer, String, DateTime, JSON,ForeignKey
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