from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import ArgumentError
import os

# --- FIX: Changed relative import to absolute ---
from settings import settings
# ------------------------------------------------

# Validate DATABASE_URL before creating engine
database_url = settings.DATABASE_URL

if not database_url or database_url.strip() == "":
    raise ValueError(
        "DATABASE_URL is not set. Please set it in your environment variables or .env file. "
        "Format: postgresql+psycopg://user:password@host:port/database"
    )

# Create the engine from our settings file
# For Neon and other cloud databases, we need to ensure SSL is properly configured
try:
    # Convert postgresql:// to postgresql+psycopg:// if needed for SQLAlchemy
    if database_url.startswith("postgresql://") and "postgresql+psycopg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    # For Neon databases, ensure SSL is required if not already in URL
    connect_args = {}
    if "neon.tech" in database_url and "sslmode" not in database_url:
        connect_args["sslmode"] = "require"
    
    engine = create_engine(
        database_url, 
        pool_pre_ping=True,
        connect_args=connect_args
    )
except ArgumentError as e:
    raise ValueError(
        f"Invalid DATABASE_URL format: {database_url}. "
        f"Expected format: postgresql+psycopg://user:password@host:port/database. "
        f"Error: {str(e)}"
    )

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