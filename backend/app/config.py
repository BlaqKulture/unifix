"""Application configuration.

All secrets and environment-specific values are read from environment
variables so the same code runs locally, in tests and in production (Render).
"""
import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///unifix.db")
    # Neon / Render give "postgres://" or "postgresql://" URLs.
    # SQLAlchemy needs the driver name to use psycopg (v3).
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # JWT session management
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me-please-32b")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_EXPIRES_HOURS", "8")))

    # Comma-separated list of allowed frontend origins, e.g. https://unifix.vercel.app
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # File uploads (fault evidence photos), stored in the database
    MAX_CONTENT_LENGTH = 6 * 1024 * 1024  # whole request
    MAX_UPLOAD_BYTES = 3 * 1024 * 1024  # per image
    ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

    # Create tables and seed starter data automatically on start-up
    AUTO_SEED = os.getenv("AUTO_SEED", "true").lower() == "true"


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    AUTO_SEED = False
    BCRYPT_LOG_ROUNDS = 4  # faster hashing in tests
