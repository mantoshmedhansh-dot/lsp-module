"""
Base model classes for B2C
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class BaseModel(SQLModel):
    """Base model with common fields"""
    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True
    )
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResponseBase(SQLModel):
    """Base class for API response schemas"""
    pass


class CreateBase(SQLModel):
    """Base class for creation schemas"""
    pass
