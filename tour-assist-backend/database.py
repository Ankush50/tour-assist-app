from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# --- FIX: Changed relative import to absolute ---
from settings import settings
# ------------------------------------------------

# Create the engine from our settings file
engine = create_engine(settings.DATABASE_URL)

# This is the "session" that your app will use to talk to the DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# This is a base class that our models will inherit from
Base = declarative_base()

# This is a "dependency" function that gives a DB session to 
# each API request and then closes it.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()