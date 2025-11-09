from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Format: postgresql+psycopg://USER:PASSWORD@HOST/DB_NAME
    # It will look for an environment variable first,
    # or use this default value.
    DATABASE_URL: str = "postgresql+psycopg://myuser:8218@localhost/tour"

settings = Settings()
