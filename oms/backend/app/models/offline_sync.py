"""
Offline Sync Models: Queue, Checkpoint, Conflict resolution, Batch processing
For mobile offline-first operations
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class SyncOperationType(str, Enum):
    """Sync operation types"""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class SyncStatus(str, Enum):
    """Sync status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CONFLICT = "CONFLICT"


class SyncEntityType(str, Enum):
    """Entities that can be synced"""
    TASK = "TASK"
    TASK_LINE = "TASK_LINE"
    INVENTORY = "INVENTORY"
    SCAN_LOG = "SCAN_LOG"
    LOCATION_LOG = "LOCATION_LOG"
    CYCLE_COUNT = "CYCLE_COUNT"
    PUTAWAY = "PUTAWAY"
    PICKING = "PICKING"


class ConflictResolution(str, Enum):
    """Conflict resolution strategies"""
    SERVER_WINS = "SERVER_WINS"
    CLIENT_WINS = "CLIENT_WINS"
    MANUAL = "MANUAL"
    MERGE = "MERGE"


# ============================================================================
# OfflineSyncQueue
# ============================================================================

class OfflineSyncQueueBase(SQLModel):
    """Offline sync queue base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    sessionId: Optional[UUID] = Field(default=None, foreign_key="MobileSession.id")
    operationType: SyncOperationType = Field(index=True)
    entityType: SyncEntityType = Field(index=True)
    entityId: Optional[UUID] = None
    localId: Optional[str] = Field(default=None, max_length=100, index=True)
    payload: dict = Field(sa_column=Column(JSON))
    status: SyncStatus = Field(default=SyncStatus.PENDING, index=True)
    priority: int = Field(default=0)
    retryCount: int = Field(default=0)
    maxRetries: int = Field(default=3)
    queuedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    processedAt: Optional[datetime] = None
    errorMessage: Optional[str] = Field(default=None, sa_column=Column(Text))
    serverEntityId: Optional[UUID] = None


class OfflineSyncQueue(OfflineSyncQueueBase, BaseModel, table=True):
    """Offline sync queue model"""
    __tablename__ = "OfflineSyncQueue"


class OfflineSyncQueueCreate(SQLModel):
    """Schema for sync queue creation"""
    operationType: SyncOperationType
    entityType: SyncEntityType
    entityId: Optional[UUID] = None
    localId: Optional[str] = None
    payload: dict
    priority: int = 0


class OfflineSyncQueueResponse(OfflineSyncQueueBase):
    """Response schema for sync queue"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SyncCheckpoint
# ============================================================================

class SyncCheckpointBase(SQLModel):
    """Sync checkpoint base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    entityType: SyncEntityType = Field(index=True)
    lastSyncedAt: datetime = Field(default_factory=datetime.utcnow)
    lastSyncedId: Optional[UUID] = None
    syncVersion: int = Field(default=0)
    recordCount: int = Field(default=0)
    checkpointData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class SyncCheckpoint(SyncCheckpointBase, BaseModel, table=True):
    """Sync checkpoint model"""
    __tablename__ = "SyncCheckpoint"


class SyncCheckpointCreate(SQLModel):
    """Schema for checkpoint creation"""
    entityType: SyncEntityType
    lastSyncedId: Optional[UUID] = None


class SyncCheckpointResponse(SyncCheckpointBase):
    """Response schema for checkpoint"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SyncConflict
# ============================================================================

class SyncConflictBase(SQLModel):
    """Sync conflict base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    syncQueueId: UUID = Field(foreign_key="OfflineSyncQueue.id", index=True)
    entityType: SyncEntityType = Field(index=True)
    entityId: UUID
    clientData: dict = Field(sa_column=Column(JSON))
    serverData: dict = Field(sa_column=Column(JSON))
    conflictFields: List[str] = Field(default=[], sa_column=Column(JSON))
    resolution: Optional[ConflictResolution] = None
    resolvedData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    resolvedAt: Optional[datetime] = None
    resolvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    isResolved: bool = Field(default=False)


class SyncConflict(SyncConflictBase, BaseModel, table=True):
    """Sync conflict model"""
    __tablename__ = "SyncConflict"


class SyncConflictResolve(SQLModel):
    """Schema for conflict resolution"""
    resolution: ConflictResolution
    resolvedData: Optional[dict] = None


class SyncConflictResponse(SyncConflictBase):
    """Response schema for conflict"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SyncBatch
# ============================================================================

class SyncBatchBase(SQLModel):
    """Sync batch base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    batchNo: str = Field(max_length=50, unique=True, index=True)
    status: SyncStatus = Field(default=SyncStatus.PENDING, index=True)
    direction: str = Field(max_length=10)  # PUSH or PULL
    totalOperations: int = Field(default=0)
    completedOperations: int = Field(default=0)
    failedOperations: int = Field(default=0)
    conflictCount: int = Field(default=0)
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    errorSummary: Optional[str] = Field(default=None, sa_column=Column(Text))


class SyncBatch(SyncBatchBase, BaseModel, table=True):
    """Sync batch model"""
    __tablename__ = "SyncBatch"


class SyncBatchResponse(SyncBatchBase):
    """Response schema for batch"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Request/Response Schemas
# ============================================================================

class SyncPullRequest(SQLModel):
    """Request for pulling changes from server"""
    entityTypes: List[SyncEntityType]
    sinceVersion: Optional[int] = None
    sinceTimestamp: Optional[datetime] = None
    limit: int = 100


class SyncPullResponse(SQLModel):
    """Response for pull request"""
    entityType: SyncEntityType
    records: List[dict]
    syncVersion: int
    hasMore: bool
    nextCursor: Optional[str] = None


class SyncPushRequest(SQLModel):
    """Request for pushing changes to server"""
    operations: List[OfflineSyncQueueCreate]


class SyncPushResponse(SQLModel):
    """Response for push request"""
    batchId: UUID
    totalOperations: int
    successCount: int
    failedCount: int
    conflictCount: int
    errors: List[dict] = []
    conflicts: List[UUID] = []
