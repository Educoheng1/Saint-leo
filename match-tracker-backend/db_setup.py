# db_setup.py
import os
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from databases import Database

# Import the ONE shared metadata from models (where tables are defined)
from models import metadata

# Read DB URL from env; fallback to local SQLite for development
RAW_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./matches.db")

# Normalize old postgres scheme if needed (just in case)
if RAW_DATABASE_URL.startswith("postgres://"):
    RAW_DATABASE_URL = RAW_DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

# This is the async URL used by `databases.Database`
database = Database(RAW_DATABASE_URL)

# Build a sync URL for SQLAlchemy engine (remove +asyncpg if present)
if "+asyncpg" in RAW_DATABASE_URL:
    SYNC_DATABASE_URL = RAW_DATABASE_URL.replace("+asyncpg", "")
else:
    SYNC_DATABASE_URL = RAW_DATABASE_URL

# For SQLite we need connect_args; for Postgres we don't
connect_args = {}
if SYNC_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(SYNC_DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
