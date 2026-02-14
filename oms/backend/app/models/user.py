"""
User Model - SQLModel Implementation
Matches Prisma schema exactly
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import UserRole

if TYPE_CHECKING:
    from .company import Company


# ============================================================================
# Database Model
# ============================================================================

class User(BaseModel, table=True):
    """
    User model - represents system users.
    Multi-tenant: filtered by companyId.
    """
    __tablename__ = "User"

    # Basic Info
    email: str = Field(
        sa_column=Column(String, unique=True, nullable=False, index=True)
    )
    password: str = Field(sa_column=Column(String, nullable=False))
    name: str = Field(sa_column=Column(String, nullable=False))
    phone: Optional[str] = Field(default=None)
    avatar: Optional[str] = Field(default=None)

    # Role & Status
    role: UserRole = Field(
        default=UserRole.OPERATOR,
        sa_column=Column(String, default="OPERATOR")
    )
    isActive: bool = Field(default=True)

    # Multi-tenant
    companyId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=True,
            index=True
        )
    )

    # Location Access (array of location UUIDs)
    locationAccess: List[UUID] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(PG_UUID(as_uuid=True)), default=[])
    )

    # Tracking
    lastLoginAt: Optional[datetime] = Field(default=None)

    # Relationships
    company: Optional["Company"] = Relationship(back_populates="users")


# ============================================================================
# Request/Response Schemas
# ============================================================================

class UserBase(SQLModel):
    """Shared user fields"""
    email: str
    name: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    role: UserRole = UserRole.OPERATOR
    isActive: bool = True
    companyId: Optional[UUID] = None
    locationAccess: List[UUID] = []


class UserCreate(CreateBase):
    """Schema for creating a new user"""
    email: str
    password: str
    name: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    role: UserRole = UserRole.OPERATOR
    companyId: Optional[UUID] = None
    locationAccess: List[UUID] = []


class UserUpdate(UpdateBase):
    """Schema for updating a user (all fields optional)"""
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[UserRole] = None
    isActive: Optional[bool] = None
    companyId: Optional[UUID] = None
    locationAccess: Optional[List[UUID]] = None


class UserResponse(ResponseBase):
    """Schema for user API responses"""
    id: UUID
    email: str
    name: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    role: UserRole
    isActive: bool
    companyId: Optional[UUID] = None
    locationAccess: List[UUID] = []
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


class CompanyBrief(SQLModel):
    """Minimal company info embedded in user responses"""
    id: UUID
    name: str
    code: str


class UserBrief(ResponseBase):
    """Brief user info for lists and references"""
    id: UUID
    email: str
    name: str
    role: UserRole
    isActive: bool = True
    companyId: Optional[UUID] = None
    avatar: Optional[str] = None
    createdAt: Optional[datetime] = None
    company: Optional[CompanyBrief] = None


class UserLogin(SQLModel):
    """Schema for login request"""
    email: str
    password: str


class UserLoginResponse(SQLModel):
    """Schema for login response"""
    user: UserResponse
    token: str
    expiresIn: int
