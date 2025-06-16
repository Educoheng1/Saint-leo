import sqlalchemy
from sqlalchemy import Table, Column, Integer, String, Date, ForeignKey, MetaData,DateTime
from database import metadata


metadata = sqlalchemy.MetaData()



matches = Table(
    "matches",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("date", DateTime, nullable=False),
    Column("opponent", String, nullable=False),
    Column("location", String, nullable=True),
    Column("status", String, default="scheduled"),
    extend_existing=True
)

lines = Table(
    "lines",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("match_id", Integer, ForeignKey('matches.id')),
    Column("line_type", String, nullable=False),  # "singles" or "doubles"
    Column("line_number", Integer, nullable=False),
    Column("player1", String, nullable=False),
    Column("player2", String, nullable=True),         # Only for doubles
    Column("opponent1", String, nullable=False),
    Column("opponent2", String, nullable=True),       # Only for doubles
    Column("score", String, nullable=True),
    Column("status", String, default="scheduled"),
    extend_existing=True
)

players = Table(
    "players",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String),
    extend_existing=True

)

lineups = Table(
    "lineups",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("match_id", ForeignKey("matches.id")),
    Column("player_id", ForeignKey("players.id")),
    extend_existing=True

)
