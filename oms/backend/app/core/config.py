"""
Application Configuration
Loads settings from environment variables with validation
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "CJDQuick OMS API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = Field(default="development")

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/oms"
    )
    # Direct URL for migrations (bypasses connection pooler)
    DIRECT_URL: Optional[str] = None

    # Security
    SECRET_KEY: str = Field(default="change-me-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    FRONTEND_URL: str = Field(default="http://localhost:3000")
    ALLOWED_ORIGINS: list[str] = Field(default=[
        "http://localhost:3000",
        "https://oms-sable.vercel.app",
        "https://cjdquick-oms.vercel.app"
    ])

    # Stripe Billing
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "CJDQuick OMS <noreply@cjdquick.com>"

    # Database Pool Settings
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic)"""
        url = self.DIRECT_URL or self.DATABASE_URL
        # Remove pgbouncer parameter if present
        if "pgbouncer=true" in url:
            url = url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
        return url

    @property
    def database_url_async(self) -> str:
        """Get async database URL (for SQLModel async operations)"""
        url = self.database_url_sync
        # Convert postgresql:// to postgresql+asyncpg://
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
