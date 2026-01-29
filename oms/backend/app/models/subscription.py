"""
Subscription Models: Subscriptions, Lines, Schedules, History
For recurring order management
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class SubscriptionStatus(str, Enum):
    """Subscription status"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"


class SubscriptionFrequency(str, Enum):
    """Subscription frequency"""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    BIWEEKLY = "BIWEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"
    CUSTOM = "CUSTOM"


class ScheduleStatus(str, Enum):
    """Schedule status"""
    SCHEDULED = "SCHEDULED"
    GENERATING = "GENERATING"
    GENERATED = "GENERATED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


# ============================================================================
# Subscription
# ============================================================================

class SubscriptionBase(SQLModel):
    """Subscription base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    subscriptionNo: str = Field(max_length=50, unique=True, index=True)
    customerId: UUID = Field(foreign_key="Customer.id", index=True)
    customerName: Optional[str] = Field(default=None, max_length=255)
    customerEmail: Optional[str] = Field(default=None, max_length=255)
    customerPhone: Optional[str] = Field(default=None, max_length=20)
    status: SubscriptionStatus = Field(default=SubscriptionStatus.DRAFT, index=True)
    frequency: SubscriptionFrequency = Field(index=True)
    customIntervalDays: Optional[int] = None
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    shippingAddressId: Optional[UUID] = None
    billingAddressId: Optional[UUID] = None
    startDate: date
    endDate: Optional[date] = None
    nextDeliveryDate: Optional[date] = None
    lastDeliveryDate: Optional[date] = None
    totalDeliveries: int = Field(default=0)
    completedDeliveries: int = Field(default=0)
    maxDeliveries: Optional[int] = None
    subtotal: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    discountAmount: Decimal = Field(default=Decimal("0"))
    shippingAmount: Decimal = Field(default=Decimal("0"))
    totalAmount: Decimal = Field(default=Decimal("0"))
    paymentMethod: Optional[str] = Field(default=None, max_length=50)
    paymentTokenId: Optional[str] = Field(default=None, max_length=255)
    autoRenew: bool = Field(default=True)
    reminderDays: int = Field(default=3)
    pausedAt: Optional[datetime] = None
    pausedUntil: Optional[date] = None
    cancelledAt: Optional[datetime] = None
    cancellationReason: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("extraData", JSON))


class Subscription(SubscriptionBase, BaseModel, table=True):
    """Subscription model"""
    __tablename__ = "Subscription"

    # Relationships
    lines: List["SubscriptionLine"] = Relationship(back_populates="subscription")
    schedules: List["SubscriptionSchedule"] = Relationship(back_populates="subscription")


class SubscriptionCreate(SQLModel):
    """Schema for subscription creation"""
    customerId: UUID
    customerName: Optional[str] = None
    customerEmail: Optional[str] = None
    customerPhone: Optional[str] = None
    frequency: SubscriptionFrequency
    customIntervalDays: Optional[int] = None
    locationId: UUID
    shippingAddressId: Optional[UUID] = None
    billingAddressId: Optional[UUID] = None
    startDate: date
    endDate: Optional[date] = None
    maxDeliveries: Optional[int] = None
    paymentMethod: Optional[str] = None
    autoRenew: bool = True
    reminderDays: int = 3
    notes: Optional[str] = None


class SubscriptionUpdate(SQLModel):
    """Schema for subscription update"""
    status: Optional[SubscriptionStatus] = None
    frequency: Optional[SubscriptionFrequency] = None
    customIntervalDays: Optional[int] = None
    shippingAddressId: Optional[UUID] = None
    billingAddressId: Optional[UUID] = None
    endDate: Optional[date] = None
    nextDeliveryDate: Optional[date] = None
    maxDeliveries: Optional[int] = None
    autoRenew: Optional[bool] = None
    reminderDays: Optional[int] = None
    notes: Optional[str] = None


class SubscriptionResponse(SubscriptionBase):
    """Response schema for subscription"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SubscriptionLine
# ============================================================================

class SubscriptionLineBase(SQLModel):
    """Subscription line base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    subscriptionId: UUID = Field(foreign_key="Subscription.id", index=True)
    lineNo: int = Field(default=1)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    skuCode: str = Field(max_length=100)
    skuName: Optional[str] = Field(default=None, max_length=255)
    quantity: Decimal
    unitPrice: Decimal
    taxRate: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    discountAmount: Decimal = Field(default=Decimal("0"))
    lineTotal: Decimal
    isActive: bool = Field(default=True)
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class SubscriptionLine(SubscriptionLineBase, BaseModel, table=True):
    """Subscription line model"""
    __tablename__ = "SubscriptionLine"

    # Relationships
    subscription: Optional["Subscription"] = Relationship(back_populates="lines")


class SubscriptionLineCreate(SQLModel):
    """Schema for line creation"""
    skuId: UUID
    skuCode: str
    skuName: Optional[str] = None
    quantity: Decimal
    unitPrice: Decimal
    taxRate: Decimal = Decimal("0")
    discountAmount: Decimal = Decimal("0")
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    notes: Optional[str] = None


class SubscriptionLineResponse(SubscriptionLineBase):
    """Response schema for line"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SubscriptionSchedule
# ============================================================================

class SubscriptionScheduleBase(SQLModel):
    """Subscription schedule base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    subscriptionId: UUID = Field(foreign_key="Subscription.id", index=True)
    sequenceNo: int
    scheduledDate: date = Field(index=True)
    status: ScheduleStatus = Field(default=ScheduleStatus.SCHEDULED, index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    orderNo: Optional[str] = Field(default=None, max_length=50)
    generatedAt: Optional[datetime] = None
    processedAt: Optional[datetime] = None
    errorMessage: Optional[str] = Field(default=None, max_length=500)
    skipReason: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=500)


class SubscriptionSchedule(SubscriptionScheduleBase, BaseModel, table=True):
    """Subscription schedule model"""
    __tablename__ = "SubscriptionSchedule"

    # Relationships
    subscription: Optional["Subscription"] = Relationship(back_populates="schedules")


class SubscriptionScheduleCreate(SQLModel):
    """Schema for schedule creation"""
    subscriptionId: UUID
    sequenceNo: int
    scheduledDate: date
    notes: Optional[str] = None


class SubscriptionScheduleResponse(SubscriptionScheduleBase):
    """Response schema for schedule"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SubscriptionHistory
# ============================================================================

class SubscriptionHistoryBase(SQLModel):
    """Subscription history base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    subscriptionId: UUID = Field(foreign_key="Subscription.id", index=True)
    actionType: str = Field(max_length=50, index=True)
    actionDate: datetime = Field(default_factory=datetime.utcnow, index=True)
    userId: Optional[UUID] = Field(default=None, foreign_key="User.id")
    previousStatus: Optional[str] = Field(default=None, max_length=50)
    newStatus: Optional[str] = Field(default=None, max_length=50)
    changes: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, max_length=500)


class SubscriptionHistory(SubscriptionHistoryBase, BaseModel, table=True):
    """Subscription history model"""
    __tablename__ = "SubscriptionHistory"


class SubscriptionHistoryResponse(SubscriptionHistoryBase):
    """Response schema for history"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Request/Response Schemas
# ============================================================================

class SubscriptionPauseRequest(SQLModel):
    """Request to pause subscription"""
    pauseUntil: Optional[date] = None
    reason: Optional[str] = None


class SubscriptionResumeRequest(SQLModel):
    """Request to resume subscription"""
    nextDeliveryDate: Optional[date] = None


class SubscriptionGenerateOrdersRequest(SQLModel):
    """Request to generate subscription orders"""
    subscriptionIds: Optional[List[UUID]] = None
    scheduledDate: Optional[date] = None
    generateUntil: Optional[date] = None


class SubscriptionGenerateOrdersResponse(SQLModel):
    """Response for generate orders"""
    totalSchedules: int
    generatedOrders: int
    skippedSchedules: int
    failedSchedules: int
    errors: List[dict] = []


class SubscriptionUpcomingResponse(SQLModel):
    """Response for upcoming deliveries"""
    subscriptionId: UUID
    subscriptionNo: str
    customerName: Optional[str]
    nextDeliveryDate: Optional[date]
    frequency: SubscriptionFrequency
    totalAmount: Decimal
    status: SubscriptionStatus
    items: List[dict] = []
