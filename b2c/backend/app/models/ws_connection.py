"""
WebSocket Connection Models for Real-time Operations
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class WSConnectionStatus(str, Enum):
    """WebSocket connection status"""
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    RECONNECTING = "RECONNECTING"


class WSEventType(str, Enum):
    """WebSocket event types"""
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_UPDATED = "ORDER_UPDATED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED"
    INVENTORY_UPDATED = "INVENTORY_UPDATED"
    INVENTORY_LOW_STOCK = "INVENTORY_LOW_STOCK"
    INVENTORY_OUT_OF_STOCK = "INVENTORY_OUT_OF_STOCK"
    PICKING_TASK_ASSIGNED = "PICKING_TASK_ASSIGNED"
    PICKING_TASK_STARTED = "PICKING_TASK_STARTED"
    PICKING_TASK_COMPLETED = "PICKING_TASK_COMPLETED"
    PICKING_TASK_PAUSED = "PICKING_TASK_PAUSED"
    DASHBOARD_METRICS_UPDATE = "DASHBOARD_METRICS_UPDATE"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    USER_NOTIFICATION = "USER_NOTIFICATION"


class WSTopicType(str, Enum):
    """WebSocket subscription topics"""
    ORDERS = "orders"
    INVENTORY = "inventory"
    PICKING = "picking"
    DASHBOARD = "dashboard"
    ALERTS = "alerts"
    ALL = "all"


# Database Models
class WSConnection(BaseModel, table=True):
    """Track active WebSocket connections"""
    __tablename__ = "ws_connections"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    connectionId: str = Field(max_length=255, index=True)
    clientIp: Optional[str] = Field(default=None, max_length=45)
    userAgent: Optional[str] = Field(default=None, max_length=500)
    status: WSConnectionStatus = Field(default=WSConnectionStatus.CONNECTED)
    connectedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    disconnectedAt: Optional[datetime] = Field(default=None)
    lastPingAt: Optional[datetime] = Field(default=None)
    connectionMeta: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class WSSubscription(BaseModel, table=True):
    """Topic subscriptions per connection"""
    __tablename__ = "ws_subscriptions"

    connectionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    topic: WSTopicType = Field(index=True)
    filters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    subscribedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    isActive: bool = Field(default=True)


class WSEvent(BaseModel, table=True):
    """Event log for replay/debugging"""
    __tablename__ = "ws_events"

    eventType: WSEventType = Field(index=True)
    topic: WSTopicType = Field(index=True)
    payload: dict = Field(sa_column=Column(JSON, nullable=False))
    targetUserIds: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    broadcastedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    acknowledgedBy: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    expiresAt: Optional[datetime] = Field(default=None)
    retryCount: int = Field(default=0)


# Request/Response Schemas
class WSConnectionResponse(SQLModel):
    """Response schema for WebSocket connection"""
    id: UUID
    userId: UUID
    connectionId: str
    status: WSConnectionStatus
    connectedAt: datetime
    lastPingAt: Optional[datetime]


class WSSubscriptionCreate(SQLModel):
    """Schema for creating a subscription"""
    topic: WSTopicType
    filters: Optional[dict] = None


class WSSubscriptionResponse(SQLModel):
    """Response schema for subscription"""
    id: UUID
    connectionId: UUID
    topic: WSTopicType
    filters: Optional[dict]
    subscribedAt: datetime
    isActive: bool


class WSEventCreate(SQLModel):
    """Schema for creating an event"""
    eventType: WSEventType
    topic: WSTopicType
    payload: dict
    targetUserIds: Optional[List[str]] = None
    expiresAt: Optional[datetime] = None


class WSEventResponse(SQLModel):
    """Response schema for event"""
    id: UUID
    eventType: WSEventType
    topic: WSTopicType
    payload: dict
    broadcastedAt: datetime
    retryCount: int


class WSMessage(SQLModel):
    """WebSocket message format"""
    type: str
    event: Optional[WSEventType] = None
    topic: Optional[WSTopicType] = None
    data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
