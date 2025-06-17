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



players = Table(
    "players",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String),
    extend_existing=True

)
