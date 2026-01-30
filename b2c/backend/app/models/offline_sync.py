"""
Offline Sync Models for Mobile WMS
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class SyncOperationType(str, Enum):
    """Types of sync operations"""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class SyncStatus(str, Enum):
    """Sync operation status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CONFLICT = "CONFLICT"


class SyncEntityType(str, Enum):
    """Entity types that can be synced"""
    TASK = "TASK"
    TASK_LINE = "TASK_LINE"
    INVENTORY = "INVENTORY"
    SCAN = "SCAN"
    LOCATION = "LOCATION"
    ADJUSTMENT = "ADJUSTMENT"
    TRANSFER = "TRANSFER"


class ConflictResolution(str, Enum):
    """Conflict resolution strategies"""
    SERVER_WINS = "SERVER_WINS"
    CLIENT_WINS = "CLIENT_WINS"
    MERGE = "MERGE"
    MANUAL = "MANUAL"


# Database Models
class OfflineSyncQueue(BaseModel, table=True):
    """Pending sync operations from mobile devices"""
    __tablename__ = "offline_sync_queue"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    operationType: SyncOperationType = Field(index=True)
    entityType: SyncEntityType = Field(index=True)
    entityId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    localId: str = Field(max_length=100, index=True)
    payload: dict = Field(sa_column=Column(JSON, nullable=False))
    status: SyncStatus = Field(default=SyncStatus.PENDING, index=True)
    priority: int = Field(default=0)
    clientTimestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    serverTimestamp: Optional[datetime] = Field(default=None)
    processedAt: Optional[datetime] = Field(default=None)
    retryCount: int = Field(default=0)
    maxRetries: int = Field(default=3)
    errorMessage: Optional[str] = Field(default=None, sa_column=Column(Text))
    conflictData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    resolution: Optional[ConflictResolution] = Field(default=None)


class SyncCheckpoint(BaseModel, table=True):
    """Tracks sync state per device"""
    __tablename__ = "sync_checkpoints"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    entityType: SyncEntityType = Field(index=True)
    lastSyncAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lastEntityId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    syncVersion: int = Field(default=0)
    checksum: Optional[str] = Field(default=None, max_length=64)


class SyncConflict(BaseModel, table=True):
    """Records sync conflicts for resolution"""
    __tablename__ = "sync_conflicts"

    syncQueueId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    entityType: SyncEntityType = Field(index=True)
    entityId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    clientData: dict = Field(sa_column=Column(JSON, nullable=False))
    serverData: dict = Field(sa_column=Column(JSON, nullable=False))
    conflictFields: List[str] = Field(sa_column=Column(JSON, nullable=False))
    resolution: Optional[ConflictResolution] = Field(default=None)
    resolvedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    resolvedAt: Optional[datetime] = Field(default=None)
    resolvedData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class SyncBatch(BaseModel, table=True):
    """Tracks batch sync operations"""
    __tablename__ = "sync_batches"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    batchType: str = Field(max_length=20)  # 'push' or 'pull'
    status: SyncStatus = Field(default=SyncStatus.PROCESSING)
    totalOperations: int = Field(default=0)
    completedOperations: int = Field(default=0)
    failedOperations: int = Field(default=0)
    conflictOperations: int = Field(default=0)
    startedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completedAt: Optional[datetime] = Field(default=None)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


# Request/Response Schemas
class SyncPullRequest(SQLModel):
    """Request for pulling changes from server"""
    entityTypes: Optional[List[SyncEntityType]] = None
    lastSyncAt: Optional[datetime] = None
    limit: int = 100


class SyncPullResponse(SQLModel):
    """Response containing changes to pull"""
    entities: List[dict]
    entityType: SyncEntityType
    totalCount: int
    hasMore: bool
    syncTimestamp: datetime
    checksum: Optional[str] = None


class SyncPushOperation(SQLModel):
    """Single sync operation in a push batch"""
    operationType: SyncOperationType
    entityType: SyncEntityType
    localId: str
    entityId: Optional[UUID] = None
    payload: dict
    clientTimestamp: datetime


class SyncPushRequest(SQLModel):
    """Request for pushing changes to server"""
    operations: List[SyncPushOperation]
    batchId: Optional[str] = None


class SyncPushResult(SQLModel):
    """Result of a single push operation"""
    localId: str
    entityId: Optional[UUID]
    status: SyncStatus
    errorMessage: Optional[str] = None
    conflictId: Optional[UUID] = None


class SyncPushResponse(SQLModel):
    """Response for push operation"""
    batchId: UUID
    totalOperations: int
    successful: int
    failed: int
    conflicts: int
    results: List[SyncPushResult]


class ConflictResolutionRequest(SQLModel):
    """Request to resolve a sync conflict"""
    conflictId: UUID
    resolution: ConflictResolution
    resolvedData: Optional[dict] = None


class ConflictResolutionResponse(SQLModel):
    """Response for conflict resolution"""
    conflictId: UUID
    resolution: ConflictResolution
    entityId: UUID
    success: bool
    message: str


class SyncStatusResponse(SQLModel):
    """Response for sync status check"""
    deviceId: UUID
    lastSyncAt: Optional[datetime]
    pendingPushCount: int
    pendingPullCount: int
    conflictCount: int
    isOnline: bool
