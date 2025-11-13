import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from models import metadata  # your Core metadata

DATABASE_URL = "sqlite:///./test.db"

engine = sa.create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # needed for SQLite + threads
)

# Session factory for FastAPI Depends(get_db)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Create tables if they don't exist
metadata.create_all(engine)