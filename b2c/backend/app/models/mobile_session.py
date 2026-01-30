"""
Mobile Session Models for WMS Operations
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class SessionStatus(str, Enum):
    """Mobile session status"""
    ACTIVE = "ACTIVE"
    IDLE = "IDLE"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"


class TaskType(str, Enum):
    """Mobile task types"""
    RECEIVING = "RECEIVING"
    PUTAWAY = "PUTAWAY"
    PICKING = "PICKING"
    PACKING = "PACKING"
    SHIPPING = "SHIPPING"
    CYCLE_COUNT = "CYCLE_COUNT"
    REPLENISHMENT = "REPLENISHMENT"
    TRANSFER = "TRANSFER"
    ADJUSTMENT = "ADJUSTMENT"


class TaskStatus(str, Enum):
    """Task status"""
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


# Database Models
class MobileSession(BaseModel, table=True):
    """Active sessions with device info"""
    __tablename__ = "mobile_sessions"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    warehouseId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    status: SessionStatus = Field(default=SessionStatus.ACTIVE)
    startedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    endedAt: Optional[datetime] = Field(default=None)
    lastActivityAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    currentTaskId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    currentZone: Optional[str] = Field(default=None, max_length=50)
    ipAddress: Optional[str] = Field(default=None, max_length=45)
    appVersion: Optional[str] = Field(default=None, max_length=50)
    sessionData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MobileTask(BaseModel, table=True):
    """Mobile tasks for warehouse operations"""
    __tablename__ = "mobile_tasks"

    taskType: TaskType = Field(index=True)
    taskNumber: str = Field(max_length=50, unique=True, index=True)
    status: TaskStatus = Field(default=TaskStatus.PENDING, index=True)
    priority: TaskPriority = Field(default=TaskPriority.NORMAL)
    assignedUserId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    assignedDeviceId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sourceLocationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    destinationLocationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    orderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    itemId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    quantity: Optional[int] = Field(default=None)
    completedQuantity: int = Field(default=0)
    instructions: Optional[str] = Field(default=None, sa_column=Column(Text))
    dueDate: Optional[datetime] = Field(default=None)
    startedAt: Optional[datetime] = Field(default=None)
    completedAt: Optional[datetime] = Field(default=None)
    estimatedMinutes: Optional[int] = Field(default=None)
    actualMinutes: Optional[int] = Field(default=None)
    taskData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MobileTaskLine(BaseModel, table=True):
    """Individual lines within a task"""
    __tablename__ = "mobile_task_lines"

    taskId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    lineNumber: int = Field(default=1)
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    sku: str = Field(max_length=100, index=True)
    itemName: Optional[str] = Field(default=None, max_length=255)
    sourceLocationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    sourceLocation: Optional[str] = Field(default=None, max_length=100)
    destinationLocationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    destinationLocation: Optional[str] = Field(default=None, max_length=100)
    requestedQuantity: int = Field(default=1)
    completedQuantity: int = Field(default=0)
    uom: str = Field(default="EACH", max_length=20)
    lotNumber: Optional[str] = Field(default=None, max_length=100)
    serialNumber: Optional[str] = Field(default=None, max_length=100)
    expirationDate: Optional[datetime] = Field(default=None)
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    completedAt: Optional[datetime] = Field(default=None)
    completedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


# Request/Response Schemas
class MobileSessionCreate(SQLModel):
    """Schema for creating a session"""
    deviceId: UUID
    userId: UUID
    warehouseId: Optional[UUID] = None
    appVersion: Optional[str] = None


class MobileSessionResponse(SQLModel):
    """Response schema for session"""
    id: UUID
    deviceId: UUID
    userId: UUID
    warehouseId: Optional[UUID]
    status: SessionStatus
    startedAt: datetime
    lastActivityAt: datetime
    currentTaskId: Optional[UUID]
    currentZone: Optional[str]


class MobileTaskCreate(SQLModel):
    """Schema for creating a task"""
    taskType: TaskType
    warehouseId: UUID
    priority: TaskPriority = TaskPriority.NORMAL
    assignedUserId: Optional[UUID] = None
    sourceLocationId: Optional[UUID] = None
    destinationLocationId: Optional[UUID] = None
    orderId: Optional[UUID] = None
    itemId: Optional[UUID] = None
    quantity: Optional[int] = None
    instructions: Optional[str] = None
    dueDate: Optional[datetime] = None
    estimatedMinutes: Optional[int] = None


class MobileTaskResponse(SQLModel):
    """Response schema for task"""
    id: UUID
    taskType: TaskType
    taskNumber: str
    status: TaskStatus
    priority: TaskPriority
    assignedUserId: Optional[UUID]
    warehouseId: UUID
    sourceLocationId: Optional[UUID]
    destinationLocationId: Optional[UUID]
    orderId: Optional[UUID]
    quantity: Optional[int]
    completedQuantity: int
    instructions: Optional[str]
    dueDate: Optional[datetime]
    startedAt: Optional[datetime]
    completedAt: Optional[datetime]


class MobileTaskLineResponse(SQLModel):
    """Response schema for task line"""
    id: UUID
    taskId: UUID
    lineNumber: int
    sku: str
    itemName: Optional[str]
    sourceLocation: Optional[str]
    destinationLocation: Optional[str]
    requestedQuantity: int
    completedQuantity: int
    uom: str
    lotNumber: Optional[str]
    serialNumber: Optional[str]
    status: TaskStatus


class TaskCompleteRequest(SQLModel):
    """Request to complete a task"""
    completedQuantity: Optional[int] = None
    notes: Optional[str] = None
    actualMinutes: Optional[int] = None


class InventoryLookupRequest(SQLModel):
    """Request for inventory lookup"""
    barcode: Optional[str] = None
    sku: Optional[str] = None
    locationCode: Optional[str] = None


class InventoryLookupResponse(SQLModel):
    """Response for inventory lookup"""
    itemId: Optional[UUID]
    sku: Optional[str]
    itemName: Optional[str]
    locationId: Optional[UUID]
    locationCode: Optional[str]
    quantityOnHand: int = 0
    quantityAvailable: int = 0
    quantityReserved: int = 0
    lotNumber: Optional[str] = None
    expirationDate: Optional[datetime] = None
    uom: str = "EACH"


class PutawayRequest(SQLModel):
    """Request for putaway operation"""
    itemId: UUID
    locationId: UUID
    quantity: int
    lotNumber: Optional[str] = None
    serialNumber: Optional[str] = None
    licensePlate: Optional[str] = None


class PutawayResponse(SQLModel):
    """Response for putaway operation"""
    success: bool
    message: str
    transactionId: Optional[UUID] = None
    itemId: UUID
    locationId: UUID
    quantity: int


class PickRequest(SQLModel):
    """Request for pick operation"""
    taskId: UUID
    lineId: UUID
    locationId: UUID
    quantity: int
    lotNumber: Optional[str] = None
    serialNumber: Optional[str] = None


class PickResponse(SQLModel):
    """Response for pick operation"""
    success: bool
    message: str
    transactionId: Optional[UUID] = None
    taskId: UUID
    lineId: UUID
    pickedQuantity: int
    remainingQuantity: int


class CycleCountRequest(SQLModel):
    """Request for cycle count"""
    locationId: UUID
    itemId: UUID
    countedQuantity: int
    lotNumber: Optional[str] = None
    reason: Optional[str] = None


class CycleCountResponse(SQLModel):
    """Response for cycle count"""
    success: bool
    message: str
    transactionId: Optional[UUID] = None
    locationId: UUID
    itemId: UUID
    countedQuantity: int
    systemQuantity: int
    variance: int
