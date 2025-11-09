# from pydantic_settings import BaseSettings

# class Settings(BaseSettings):
#     # Format: postgresql+psycopg://USER:PASSWORD@HOST/DB_NAME
#     # It will look for an environment variable first,
#     # or use this default value.
#     DATABASE_URL: str = "postgresql+psycopg://myuser:8218@localhost/tour"

# settings = Settings()



from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # This tells Pydantic to load variables from a .env file
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # These variables will be loaded from your .env file locally,
    # or from Render's "Environment" section when deployed.
    # Default values for local development (will be overridden by env vars)
    DATABASE_URL: str = Field(
        default="postgresql+psycopg://myuser:8218@localhost/tour",
        description="PostgreSQL database connection URL"
    )
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        description="Frontend application URL for CORS"
    )

settings = Settings()