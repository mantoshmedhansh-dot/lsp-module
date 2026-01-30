"""
Subscription Models for Recurring Orders
"""
from datetime import datetime, timezone, date
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class SubscriptionStatus(str, Enum):
    """Subscription status"""
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    PENDING_PAYMENT = "PENDING_PAYMENT"


class SubscriptionFrequency(str, Enum):
    """Subscription delivery frequency"""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    BIWEEKLY = "BIWEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    CUSTOM = "CUSTOM"


class ScheduleStatus(str, Enum):
    """Schedule delivery status"""
    SCHEDULED = "SCHEDULED"
    PROCESSING = "PROCESSING"
    GENERATED = "GENERATED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


# Database Models
class Subscription(BaseModel, table=True):
    """Subscription definitions"""
    __tablename__ = "subscriptions"

    subscriptionNumber: str = Field(max_length=50, unique=True, index=True)
    customerId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    status: SubscriptionStatus = Field(default=SubscriptionStatus.ACTIVE, index=True)
    frequency: SubscriptionFrequency = Field(default=SubscriptionFrequency.MONTHLY)
    customIntervalDays: Optional[int] = Field(default=None)
    startDate: datetime = Field(index=True)
    endDate: Optional[datetime] = Field(default=None)
    nextDeliveryDate: Optional[datetime] = Field(default=None, index=True)
    lastDeliveryDate: Optional[datetime] = Field(default=None)
    totalDeliveries: int = Field(default=0)
    deliveriesRemaining: Optional[int] = Field(default=None)
    shippingAddressId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    billingAddressId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    paymentMethodId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    totalAmount: float = Field(default=0.0)
    discount: float = Field(default=0.0)
    discountType: Optional[str] = Field(default=None, max_length=20)
    currency: str = Field(default="INR", max_length=3)
    pausedAt: Optional[datetime] = Field(default=None)
    pauseReason: Optional[str] = Field(default=None, max_length=500)
    resumeDate: Optional[datetime] = Field(default=None)
    cancelledAt: Optional[datetime] = Field(default=None)
    cancelReason: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class SubscriptionLine(BaseModel, table=True):
    """Subscription line items"""
    __tablename__ = "subscription_lines"

    subscriptionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    lineNumber: int = Field(default=1)
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sku: str = Field(max_length=100, index=True)
    itemName: Optional[str] = Field(default=None, max_length=255)
    quantity: int = Field(default=1)
    unitPrice: float = Field(default=0.0)
    totalPrice: float = Field(default=0.0)
    isActive: bool = Field(default=True)


class SubscriptionSchedule(BaseModel, table=True):
    """Delivery schedules"""
    __tablename__ = "subscription_schedules"

    subscriptionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    scheduledDate: datetime = Field(index=True)
    status: ScheduleStatus = Field(default=ScheduleStatus.SCHEDULED, index=True)
    generatedOrderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    generatedOrderNumber: Optional[str] = Field(default=None, max_length=50)
    processedAt: Optional[datetime] = Field(default=None)
    failureReason: Optional[str] = Field(default=None, max_length=500)
    skipReason: Optional[str] = Field(default=None, max_length=500)
    amount: float = Field(default=0.0)
    attemptCount: int = Field(default=0)
    nextAttemptAt: Optional[datetime] = Field(default=None)


class SubscriptionHistory(BaseModel, table=True):
    """Subscription change history"""
    __tablename__ = "subscription_history"

    subscriptionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    action: str = Field(max_length=50)
    previousStatus: Optional[str] = Field(default=None, max_length=30)
    newStatus: Optional[str] = Field(default=None, max_length=30)
    changedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    changeReason: Optional[str] = Field(default=None, max_length=500)
    details: Optional[dict] = Field(default=None, sa_column=Column(JSON))


# Request/Response Schemas
class SubscriptionCreate(SQLModel):
    """Schema for creating a subscription"""
    customerId: UUID
    warehouseId: UUID
    frequency: SubscriptionFrequency = SubscriptionFrequency.MONTHLY
    customIntervalDays: Optional[int] = None
    startDate: datetime
    endDate: Optional[datetime] = None
    deliveriesRemaining: Optional[int] = None
    shippingAddressId: Optional[UUID] = None
    billingAddressId: Optional[UUID] = None
    paymentMethodId: Optional[UUID] = None
    discount: float = 0.0
    discountType: Optional[str] = None
    notes: Optional[str] = None
    lines: List[dict]


class SubscriptionResponse(SQLModel):
    """Response for subscription"""
    id: UUID
    subscriptionNumber: str
    customerId: UUID
    warehouseId: UUID
    status: SubscriptionStatus
    frequency: SubscriptionFrequency
    startDate: datetime
    endDate: Optional[datetime]
    nextDeliveryDate: Optional[datetime]
    lastDeliveryDate: Optional[datetime]
    totalDeliveries: int
    deliveriesRemaining: Optional[int]
    totalAmount: float
    discount: float
    createdAt: datetime


class SubscriptionLineResponse(SQLModel):
    """Response for subscription line"""
    id: UUID
    subscriptionId: UUID
    lineNumber: int
    itemId: UUID
    sku: str
    itemName: Optional[str]
    quantity: int
    unitPrice: float
    totalPrice: float
    isActive: bool


class SubscriptionScheduleResponse(SQLModel):
    """Response for schedule"""
    id: UUID
    subscriptionId: UUID
    scheduledDate: datetime
    status: ScheduleStatus
    generatedOrderId: Optional[UUID]
    generatedOrderNumber: Optional[str]
    amount: float


class SubscriptionPauseRequest(SQLModel):
    """Request to pause subscription"""
    reason: Optional[str] = None
    resumeDate: Optional[datetime] = None


class SubscriptionResumeRequest(SQLModel):
    """Request to resume subscription"""
    nextDeliveryDate: Optional[datetime] = None


class GenerateOrdersRequest(SQLModel):
    """Request to generate recurring orders"""
    warehouseId: Optional[UUID] = None
    date: Optional[datetime] = None
    maxOrders: int = 100


class GenerateOrdersResponse(SQLModel):
    """Response for order generation"""
    processedSubscriptions: int
    generatedOrders: int
    failedOrders: int
    skippedOrders: int
    generatedAt: datetime
    results: List[dict]


class UpcomingDeliveriesResponse(SQLModel):
    """Response for upcoming deliveries"""
    totalUpcoming: int
    deliveries: List[dict]
    startDate: datetime
    endDate: datetime
