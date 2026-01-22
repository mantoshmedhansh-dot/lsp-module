"""
Base Model Configuration for SQLModel
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlmodel import SQLModel, Field
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import ConfigDict


def utc_now() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)


class TimestampMixin(SQLModel):
    """Mixin that adds created/updated timestamps"""
    createdAt: datetime = Field(
        default_factory=utc_now,
        sa_column_kwargs={"server_default": text("now()")}
    )
    updatedAt: datetime = Field(
        default_factory=utc_now,
        sa_column_kwargs={
            "server_default": text("now()"),
            "onupdate": utc_now
        }
    )


class UUIDMixin(SQLModel):
    """Mixin that adds UUID primary key"""
    id: Optional[UUID] = Field(
        default=None,
        primary_key=True,
        sa_type=PG_UUID(as_uuid=True),
        sa_column_kwargs={"server_default": text("gen_random_uuid()")}
    )


class BaseModel(UUIDMixin, TimestampMixin, SQLModel):
    """Base model with UUID primary key and timestamps"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )


class ResponseBase(SQLModel):
    """Base class for API response schemas"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )


class CreateBase(SQLModel):
    """Base class for create request schemas"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )


class UpdateBase(SQLModel):
    """Base class for update request schemas"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )
