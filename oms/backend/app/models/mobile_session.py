"""
Mobile Session Models: Session management, Task tracking for mobile WMS
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class SessionStatus(str, Enum):
    """Mobile session status"""
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ENDED = "ENDED"
    EXPIRED = "EXPIRED"


class TaskType(str, Enum):
    """Mobile task types"""
    RECEIVING = "RECEIVING"
    PUTAWAY = "PUTAWAY"
    PICKING = "PICKING"
    PACKING = "PACKING"
    COUNTING = "COUNTING"
    REPLENISHMENT = "REPLENISHMENT"
    TRANSFER = "TRANSFER"
    LOADING = "LOADING"
    QC = "QC"


class TaskStatus(str, Enum):
    """Mobile task status"""
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TaskPriority(str, Enum):
    """Task priority levels"""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


# ============================================================================
# MobileSession
# ============================================================================

class MobileSessionBase(SQLModel):
    """Mobile session base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    sessionToken: str = Field(max_length=500, unique=True, index=True)
    status: SessionStatus = Field(default=SessionStatus.ACTIVE, index=True)
    startedAt: datetime = Field(default_factory=datetime.utcnow)
    endedAt: Optional[datetime] = None
    lastActivityAt: datetime = Field(default_factory=datetime.utcnow)
    currentZone: Optional[str] = Field(default=None, max_length=50)
    currentAisle: Optional[str] = Field(default=None, max_length=20)
    tasksCompleted: int = Field(default=0)
    itemsProcessed: int = Field(default=0)
    sessionData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MobileSession(MobileSessionBase, BaseModel, table=True):
    """Mobile session model"""
    __tablename__ = "MobileSession"

    # Relationships
    tasks: List["MobileTask"] = Relationship(back_populates="session")


class MobileSessionCreate(SQLModel):
    """Schema for session creation"""
    deviceId: UUID
    locationId: UUID


class MobileSessionUpdate(SQLModel):
    """Schema for session update"""
    status: Optional[SessionStatus] = None
    currentZone: Optional[str] = None
    currentAisle: Optional[str] = None


class MobileSessionResponse(MobileSessionBase):
    """Response schema for session"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# MobileTask
# ============================================================================

class MobileTaskBase(SQLModel):
    """Mobile task base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    sessionId: Optional[UUID] = Field(default=None, foreign_key="MobileSession.id", index=True)
    taskNo: str = Field(max_length=50, unique=True, index=True)
    taskType: TaskType = Field(index=True)
    status: TaskStatus = Field(default=TaskStatus.PENDING, index=True)
    priority: TaskPriority = Field(default=TaskPriority.NORMAL, index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    assignedUserId: Optional[UUID] = Field(default=None, foreign_key="User.id", index=True)
    sourceEntityType: Optional[str] = Field(default=None, max_length=50)
    sourceEntityId: Optional[UUID] = None
    sourceZone: Optional[str] = Field(default=None, max_length=50)
    sourceBin: Optional[str] = Field(default=None, max_length=50)
    targetZone: Optional[str] = Field(default=None, max_length=50)
    targetBin: Optional[str] = Field(default=None, max_length=50)
    totalLines: int = Field(default=0)
    completedLines: int = Field(default=0)
    totalQuantity: Decimal = Field(default=Decimal("0"))
    completedQuantity: Decimal = Field(default=Decimal("0"))
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    estimatedDuration: Optional[int] = None
    actualDuration: Optional[int] = None
    instructions: Optional[str] = Field(default=None, max_length=1000)
    taskData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MobileTask(MobileTaskBase, BaseModel, table=True):
    """Mobile task model"""
    __tablename__ = "MobileTask"

    # Relationships
    session: Optional["MobileSession"] = Relationship(back_populates="tasks")
    lines: List["MobileTaskLine"] = Relationship(back_populates="task")


class MobileTaskCreate(SQLModel):
    """Schema for task creation"""
    taskType: TaskType
    priority: TaskPriority = TaskPriority.NORMAL
    locationId: UUID
    assignedUserId: Optional[UUID] = None
    sourceEntityType: Optional[str] = None
    sourceEntityId: Optional[UUID] = None
    sourceZone: Optional[str] = None
    sourceBin: Optional[str] = None
    targetZone: Optional[str] = None
    targetBin: Optional[str] = None
    instructions: Optional[str] = None


class MobileTaskUpdate(SQLModel):
    """Schema for task update"""
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignedUserId: Optional[UUID] = None
    targetZone: Optional[str] = None
    targetBin: Optional[str] = None


class MobileTaskResponse(MobileTaskBase):
    """Response schema for task"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# MobileTaskLine
# ============================================================================

class MobileTaskLineBase(SQLModel):
    """Mobile task line base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    taskId: UUID = Field(foreign_key="MobileTask.id", index=True)
    lineNo: int = Field(default=1)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    skuCode: str = Field(max_length=100)
    skuName: Optional[str] = Field(default=None, max_length=255)
    barcode: Optional[str] = Field(default=None, max_length=100)
    requiredQuantity: Decimal
    completedQuantity: Decimal = Field(default=Decimal("0"))
    sourceBin: Optional[str] = Field(default=None, max_length=50)
    targetBin: Optional[str] = Field(default=None, max_length=50)
    lotNo: Optional[str] = Field(default=None, max_length=100)
    serialNo: Optional[str] = Field(default=None, max_length=100)
    expiryDate: Optional[datetime] = None
    isCompleted: bool = Field(default=False)
    completedAt: Optional[datetime] = None
    completedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    notes: Optional[str] = Field(default=None, max_length=500)


class MobileTaskLine(MobileTaskLineBase, BaseModel, table=True):
    """Mobile task line model"""
    __tablename__ = "MobileTaskLine"

    # Relationships
    task: Optional["MobileTask"] = Relationship(back_populates="lines")


class MobileTaskLineCreate(SQLModel):
    """Schema for task line creation"""
    skuId: UUID
    skuCode: str
    skuName: Optional[str] = None
    barcode: Optional[str] = None
    requiredQuantity: Decimal
    sourceBin: Optional[str] = None
    targetBin: Optional[str] = None
    lotNo: Optional[str] = None
    serialNo: Optional[str] = None
    expiryDate: Optional[datetime] = None


class MobileTaskLineResponse(MobileTaskLineBase):
    """Response schema for task line"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
