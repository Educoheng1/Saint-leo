from models import engine, metadata

# Create all tables from metadata
metadata.create_all(engine)
