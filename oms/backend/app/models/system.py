"""
System Models: Audit Log, Exception, Sequence, Session, Brand User
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

from .base import BaseModel
from .enums import BrandUserRole


# ============================================================================
# Audit Log
# ============================================================================

class AuditLogBase(SQLModel):
    """Audit Log base fields"""
    entityType: str = Field(index=True)
    entityId: UUID = Field(index=True)
    action: str = Field(index=True)  # CREATE, UPDATE, DELETE
    changes: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    userId: Optional[UUID] = Field(default=None, foreign_key="User.id", index=True)
    ipAddress: Optional[str] = None
    userAgent: Optional[str] = None


class AuditLog(AuditLogBase, BaseModel, table=True):
    """Audit Log model"""
    __tablename__ = "AuditLog"


class AuditLogCreate(SQLModel):
    """Audit Log creation schema"""
    entityType: str
    entityId: UUID
    action: str
    changes: Optional[dict] = None
    ipAddress: Optional[str] = None
    userAgent: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    """Audit Log response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Exception
# ============================================================================

class ExceptionBase(SQLModel):
    """Exception base fields"""
    exceptionCode: str = Field(unique=True, index=True)
    type: str = Field(index=True)  # ORDER, INVENTORY, SHIPPING, etc.
    source: str  # SYSTEM, USER, API
    severity: str = Field(index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id", index=True)
    title: str
    description: Optional[str] = None
    originalValue: Optional[str] = None
    expectedValue: Optional[str] = None
    aiSuggestion: Optional[str] = None
    aiConfidence: Optional[float] = None
    autoResolvable: bool = Field(default=False)
    status: str = Field(default="OPEN", index=True)  # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    priority: int = Field(default=0)
    resolution: Optional[str] = None
    resolvedBy: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    assignedTo: Optional[UUID] = Field(default=None, foreign_key="User.id")
    escalatedTo: Optional[UUID] = Field(default=None, foreign_key="User.id")
    escalatedAt: Optional[datetime] = None
    companyId: UUID = Field(foreign_key="Company.id", index=True)


class Exception(ExceptionBase, BaseModel, table=True):
    """Exception model"""
    __tablename__ = "Exception"


class ExceptionCreate(SQLModel):
    """Exception creation schema"""
    type: str
    source: str
    severity: str
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    orderId: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    originalValue: Optional[str] = None
    expectedValue: Optional[str] = None
    autoResolvable: bool = False
    priority: int = 0


class ExceptionUpdate(SQLModel):
    """Exception update schema"""
    status: Optional[str] = None
    priority: Optional[int] = None
    resolution: Optional[str] = None
    assignedTo: Optional[UUID] = None


class ExceptionResponse(ExceptionBase):
    """Exception response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Sequence (for generating sequence numbers)
# ============================================================================

class SequenceBase(SQLModel):
    """Sequence base fields"""
    name: str = Field(unique=True, index=True)
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    currentValue: int = Field(default=0)
    increment: int = Field(default=1)


class Sequence(SequenceBase, BaseModel, table=True):
    """Sequence model for generating sequential numbers"""
    __tablename__ = "Sequence"


class SequenceCreate(SQLModel):
    """Sequence creation schema"""
    name: str
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    currentValue: int = 0
    increment: int = 1


class SequenceResponse(SequenceBase):
    """Sequence response schema"""
    id: UUID


# ============================================================================
# Session
# ============================================================================

class SessionBase(SQLModel):
    """Session base fields"""
    userId: UUID = Field(foreign_key="User.id", index=True)
    token: str = Field(unique=True, index=True)
    expiresAt: datetime
    ipAddress: Optional[str] = None


class Session(SessionBase, BaseModel, table=True):
    """Session model"""
    __tablename__ = "Session"


class SessionCreate(SQLModel):
    """Session creation schema"""
    userId: UUID
    token: str
    expiresAt: datetime
    ipAddress: Optional[str] = None


class SessionResponse(SessionBase):
    """Session response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Brand User (for brand portal access)
# ============================================================================

class BrandUserBase(SQLModel):
    """Brand User base fields"""
    brandId: UUID = Field(foreign_key="Brand.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    role: BrandUserRole = Field(default=BrandUserRole.VIEWER)
    dashboardConfig: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isActive: bool = Field(default=True)


class BrandUser(BrandUserBase, BaseModel, table=True):
    """Brand User model for brand portal access control"""
    __tablename__ = "BrandUser"


class BrandUserCreate(SQLModel):
    """Brand User creation schema"""
    brandId: UUID
    userId: UUID
    role: BrandUserRole = BrandUserRole.VIEWER
    dashboardConfig: Optional[dict] = None


class BrandUserUpdate(SQLModel):
    """Brand User update schema"""
    role: Optional[BrandUserRole] = None
    dashboardConfig: Optional[dict] = None
    isActive: Optional[bool] = None


class BrandUserResponse(BrandUserBase):
    """Brand User response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
