import os

class Config:
    """Base configuration shared across all environments."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-dev-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = 900  # 15 minutes
    JWT_REFRESH_TOKEN_EXPIRES = 2592000  # 30 days
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

class DevelopmentConfig(Config):
    """Local development -- debug on, SQLite file in project root."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///dev.db"

class TestingConfig(Config):
    """Testing -- in-memory SQLite so tests are fast and isolated."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

class ProductionConfig(Config):
    """Production -- reads DATABASE_URL from env, debug off."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")

    def __init__(self):
        if not os.environ.get("SECRET_KEY"):
            raise RuntimeError("SECRET_KEY must be set in production")
        if not os.environ.get("JWT_SECRET_KEY"):
            raise RuntimeError("JWT_SECRET_KEY must be set in production")
        if not os.environ.get("DATABASE_URL"):
            raise RuntimeError("DATABASE_URL must be set in production")
