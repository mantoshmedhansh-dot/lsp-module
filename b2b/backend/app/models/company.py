"""
Company Model for B2B Logistics
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, JSON
from uuid import UUID

from .base import BaseModel, ResponseBase, CreateBase

if TYPE_CHECKING:
    from .user import User


class Company(BaseModel, table=True):
    """Company model - represents tenant organizations"""
    __tablename__ = "Company"

    code: str = Field(
        sa_column=Column(String, unique=True, nullable=False, index=True)
    )
    name: str = Field(sa_column=Column(String, nullable=False))
    legalName: Optional[str] = Field(default=None)

    gst: Optional[str] = Field(default=None)
    pan: Optional[str] = Field(default=None)

    logo: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)

    address: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    settings: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    isActive: bool = Field(default=True)

    users: List["User"] = Relationship(back_populates="company")


class CompanyCreate(CreateBase):
    code: str
    name: str
    legalName: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None


class CompanyResponse(ResponseBase):
    id: UUID
    code: str
    name: str
    legalName: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    settings: Optional[dict] = None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime
