"""
User Model for B2B Logistics
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY

from .base import BaseModel, ResponseBase, CreateBase
from .enums import UserRole

if TYPE_CHECKING:
    from .company import Company


class User(BaseModel, table=True):
    """User model for B2B Logistics"""
    __tablename__ = "User"

    email: str = Field(
        sa_column=Column(String, unique=True, nullable=False, index=True)
    )
    password: str = Field(sa_column=Column(String, nullable=False))
    name: str = Field(sa_column=Column(String, nullable=False))
    phone: Optional[str] = Field(default=None)

    role: UserRole = Field(
        default=UserRole.OPERATOR,
        sa_column=Column(String, default="OPERATOR")
    )
    isActive: bool = Field(default=True)

    companyId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=True,
            index=True
        )
    )

    locationAccess: List[UUID] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(PG_UUID(as_uuid=True)), default=[])
    )

    lastLoginAt: Optional[datetime] = Field(default=None)

    company: Optional["Company"] = Relationship(back_populates="users")


class UserCreate(CreateBase):
    """Schema for creating a new user"""
    email: str
    password: str
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.OPERATOR
    companyId: Optional[UUID] = None
    locationAccess: List[UUID] = []


class UserResponse(ResponseBase):
    """Schema for user API responses"""
    id: UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: UserRole
    isActive: bool
    companyId: Optional[UUID] = None
    companyName: Optional[str] = None
    companyCode: Optional[str] = None
    locationAccess: List[UUID] = []
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


class UserLogin(SQLModel):
    """Schema for login request"""
    email: str
    password: str
