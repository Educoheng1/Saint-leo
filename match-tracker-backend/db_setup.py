import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from models import metadata  # your Core metadata
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from databases import Database

DATABASE_URL = "sqlite:///./matches.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
metadata = MetaData()
database = Database(DATABASE_URL)