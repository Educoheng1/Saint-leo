from models import metadata, players
import sqlalchemy

engine = sqlalchemy.create_engine("sqlite:///./test.db")  # match your DB URL
metadata.drop_all(engine)
metadata.create_all(engine)
print("Players table reset.")