"""
WebSocket Models: Connection tracking, Subscriptions, Events
For real-time OMS/WMS operations
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

class WSConnectionStatus(str, Enum):
    """WebSocket connection status"""
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    RECONNECTING = "RECONNECTING"


class WSEventType(str, Enum):
    """WebSocket event types"""
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_UPDATED = "ORDER_UPDATED"
    ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED"
    INVENTORY_UPDATED = "INVENTORY_UPDATED"
    INVENTORY_LOW_STOCK = "INVENTORY_LOW_STOCK"
    PICKING_TASK_ASSIGNED = "PICKING_TASK_ASSIGNED"
    PICKING_TASK_COMPLETED = "PICKING_TASK_COMPLETED"
    SHIPMENT_UPDATE = "SHIPMENT_UPDATE"
    NDR_RECEIVED = "NDR_RECEIVED"
    ALERT = "ALERT"
    SYSTEM = "SYSTEM"


class WSTopicType(str, Enum):
    """WebSocket subscription topics"""
    ORDERS = "ORDERS"
    INVENTORY = "INVENTORY"
    PICKING = "PICKING"
    PACKING = "PACKING"
    SHIPPING = "SHIPPING"
    RETURNS = "RETURNS"
    DASHBOARD = "DASHBOARD"
    ALERTS = "ALERTS"
    ALL = "ALL"


# ============================================================================
# WSConnection
# ============================================================================

class WSConnectionBase(SQLModel):
    """WebSocket connection base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    connectionId: str = Field(max_length=255, unique=True, index=True)
    clientType: Optional[str] = Field(default=None, max_length=50)
    clientVersion: Optional[str] = Field(default=None, max_length=50)
    userAgent: Optional[str] = Field(default=None, max_length=500)
    ipAddress: Optional[str] = Field(default=None, max_length=50)
    status: WSConnectionStatus = Field(default=WSConnectionStatus.CONNECTED, index=True)
    connectedAt: datetime = Field(default_factory=datetime.utcnow)
    disconnectedAt: Optional[datetime] = None
    lastPingAt: Optional[datetime] = None
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class WSConnection(WSConnectionBase, BaseModel, table=True):
    """WebSocket connection model"""
    __tablename__ = "WSConnection"


class WSConnectionResponse(WSConnectionBase):
    """WebSocket connection response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# WSSubscription
# ============================================================================

class WSSubscriptionBase(SQLModel):
    """WebSocket subscription base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="WSConnection.id", index=True)
    topic: WSTopicType = Field(index=True)
    entityType: Optional[str] = Field(default=None, max_length=50)
    entityId: Optional[UUID] = None
    filters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isActive: bool = Field(default=True)
    subscribedAt: datetime = Field(default_factory=datetime.utcnow)


class WSSubscription(WSSubscriptionBase, BaseModel, table=True):
    """WebSocket subscription model"""
    __tablename__ = "WSSubscription"


class WSSubscriptionCreate(SQLModel):
    """WebSocket subscription creation schema"""
    topic: WSTopicType
    entityType: Optional[str] = None
    entityId: Optional[UUID] = None
    filters: Optional[dict] = None


class WSSubscriptionResponse(WSSubscriptionBase):
    """WebSocket subscription response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# WSEvent
# ============================================================================

class WSEventBase(SQLModel):
    """WebSocket event base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    eventType: WSEventType = Field(index=True)
    topic: WSTopicType = Field(index=True)
    entityType: Optional[str] = Field(default=None, max_length=50)
    entityId: Optional[UUID] = None
    payload: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    broadcastedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    recipientCount: int = Field(default=0)
    deliveredCount: int = Field(default=0)


class WSEvent(WSEventBase, BaseModel, table=True):
    """WebSocket event model"""
    __tablename__ = "WSEvent"


class WSEventCreate(SQLModel):
    """WebSocket event creation schema"""
    eventType: WSEventType
    topic: WSTopicType
    entityType: Optional[str] = None
    entityId: Optional[UUID] = None
    payload: Optional[dict] = None


class WSEventResponse(WSEventBase):
    """WebSocket event response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Request/Response Schemas
# ============================================================================

class WSMessage(SQLModel):
    """WebSocket message format"""
    type: str
    topic: Optional[str] = None
    event: Optional[str] = None
    data: Optional[dict] = None
    timestamp: Optional[datetime] = None
