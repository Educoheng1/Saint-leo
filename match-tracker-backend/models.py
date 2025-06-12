from sqlalchemy import Table, Column, Integer, String, Date, ForeignKey
from database import metadata

matches = Table(
    "matches",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("date", Date),
    Column("opponent", String),
    Column("location", String),
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
