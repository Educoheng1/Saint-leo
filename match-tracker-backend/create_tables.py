from database import engine, metadata
from models import matches, players, lineups

metadata.create_all(engine)
