import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from databases import Database

# Import the ONE shared metadata from models
from models import metadata  # this is where players, matches, etc. are defined

DATABASE_URL = "sqlite:///./matches.db"

# Sync engine for SQLAlchemy Core/ORM
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# SessionLocal for any ORM usage
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async DB for `databases` library – same file
database = Database(DATABASE_URL)
