"""
Cross-Dock Models: Rules, Orders, Allocations, Staging Areas
For cross-docking workflows
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class CrossDockRuleType(str, Enum):
    """Cross-dock rule types"""
    CHANNEL_BASED = "CHANNEL_BASED"
    CUSTOMER_BASED = "CUSTOMER_BASED"
    SKU_BASED = "SKU_BASED"
    ORDER_TYPE = "ORDER_TYPE"
    TIME_BASED = "TIME_BASED"


class CrossDockStatus(str, Enum):
    """Cross-dock order/allocation status"""
    PENDING = "PENDING"
    ELIGIBLE = "ELIGIBLE"
    ALLOCATED = "ALLOCATED"
    RECEIVING = "RECEIVING"
    STAGED = "STAGED"
    LOADING = "LOADING"
    SHIPPED = "SHIPPED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class StagingAreaStatus(str, Enum):
    """Staging area status"""
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    IN_USE = "IN_USE"
    MAINTENANCE = "MAINTENANCE"


# ============================================================================
# CrossDockRule
# ============================================================================

class CrossDockRuleBase(SQLModel):
    """Cross-dock rule base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    ruleName: str = Field(max_length=100)
    ruleType: CrossDockRuleType = Field(index=True)
    isActive: bool = Field(default=True)
    priority: int = Field(default=0, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    conditions: dict = Field(default={}, sa_column=Column(JSON))
    channels: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    customerIds: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    skuCategories: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    minOrderValue: Optional[Decimal] = None
    maxOrderAge: Optional[int] = None  # hours
    targetStagingArea: Optional[str] = Field(default=None, max_length=50)
    autoAllocate: bool = Field(default=True)
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None


class CrossDockRule(CrossDockRuleBase, BaseModel, table=True):
    """Cross-dock rule model"""
    __tablename__ = "CrossDockRule"


class CrossDockRuleCreate(SQLModel):
    """Schema for rule creation"""
    locationId: UUID
    ruleName: str
    ruleType: CrossDockRuleType
    priority: int = 0
    description: Optional[str] = None
    conditions: dict = {}
    channels: Optional[List[str]] = None
    customerIds: Optional[List[str]] = None
    skuCategories: Optional[List[str]] = None
    minOrderValue: Optional[Decimal] = None
    maxOrderAge: Optional[int] = None
    targetStagingArea: Optional[str] = None
    autoAllocate: bool = True
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None


class CrossDockRuleUpdate(SQLModel):
    """Schema for rule update"""
    ruleName: Optional[str] = None
    isActive: Optional[bool] = None
    priority: Optional[int] = None
    description: Optional[str] = None
    conditions: Optional[dict] = None
    channels: Optional[List[str]] = None
    autoAllocate: Optional[bool] = None


class CrossDockRuleResponse(CrossDockRuleBase):
    """Response schema for rule"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# CrossDockOrder
# ============================================================================

class CrossDockOrderBase(SQLModel):
    """Cross-dock order base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    orderId: UUID = Field(foreign_key="Order.id", index=True)
    orderNo: str = Field(max_length=50, index=True)
    status: CrossDockStatus = Field(default=CrossDockStatus.PENDING, index=True)
    ruleId: Optional[UUID] = Field(default=None, foreign_key="CrossDockRule.id")
    inboundAsnId: Optional[UUID] = None
    inboundExpectedAt: Optional[datetime] = None
    inboundReceivedAt: Optional[datetime] = None
    stagingAreaId: Optional[UUID] = None
    stagedAt: Optional[datetime] = None
    outboundManifestId: Optional[UUID] = None
    shippedAt: Optional[datetime] = None
    totalItems: int = Field(default=0)
    allocatedItems: int = Field(default=0)
    receivedItems: int = Field(default=0)
    loadedItems: int = Field(default=0)
    priority: int = Field(default=0)
    notes: Optional[str] = Field(default=None, max_length=500)


class CrossDockOrder(CrossDockOrderBase, BaseModel, table=True):
    """Cross-dock order model"""
    __tablename__ = "CrossDockOrder"


class CrossDockOrderResponse(CrossDockOrderBase):
    """Response schema for order"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# CrossDockAllocation
# ============================================================================

class CrossDockAllocationBase(SQLModel):
    """Cross-dock allocation base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    crossDockOrderId: UUID = Field(foreign_key="CrossDockOrder.id", index=True)
    orderId: UUID = Field(foreign_key="Order.id", index=True)
    orderItemId: UUID = Field(foreign_key="OrderItem.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    inboundLineId: Optional[UUID] = None
    allocatedQuantity: Decimal
    receivedQuantity: Decimal = Field(default=Decimal("0"))
    loadedQuantity: Decimal = Field(default=Decimal("0"))
    status: CrossDockStatus = Field(default=CrossDockStatus.ALLOCATED, index=True)
    stagingLocation: Optional[str] = Field(default=None, max_length=50)
    lotNo: Optional[str] = Field(default=None, max_length=100)
    serialNumbers: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    allocatedAt: datetime = Field(default_factory=datetime.utcnow)
    receivedAt: Optional[datetime] = None
    loadedAt: Optional[datetime] = None


class CrossDockAllocation(CrossDockAllocationBase, BaseModel, table=True):
    """Cross-dock allocation model"""
    __tablename__ = "CrossDockAllocation"


class CrossDockAllocationCreate(SQLModel):
    """Schema for allocation creation"""
    crossDockOrderId: UUID
    orderId: UUID
    orderItemId: UUID
    skuId: UUID
    inboundLineId: Optional[UUID] = None
    allocatedQuantity: Decimal
    stagingLocation: Optional[str] = None
    lotNo: Optional[str] = None


class CrossDockAllocationResponse(CrossDockAllocationBase):
    """Response schema for allocation"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# StagingArea
# ============================================================================

class StagingAreaBase(SQLModel):
    """Staging area base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    areaCode: str = Field(max_length=50, unique=True, index=True)
    areaName: str = Field(max_length=100)
    areaType: str = Field(default="CROSS_DOCK", max_length=50)
    status: StagingAreaStatus = Field(default=StagingAreaStatus.AVAILABLE, index=True)
    capacity: int = Field(default=100)
    currentCount: int = Field(default=0)
    dockDoor: Optional[str] = Field(default=None, max_length=20)
    assignedTransporterId: Optional[UUID] = Field(default=None, foreign_key="Transporter.id")
    assignedRoute: Optional[str] = Field(default=None, max_length=100)
    reservedUntil: Optional[datetime] = None
    isActive: bool = Field(default=True)
    notes: Optional[str] = Field(default=None, max_length=500)


class StagingArea(StagingAreaBase, BaseModel, table=True):
    """Staging area model"""
    __tablename__ = "StagingArea"


class StagingAreaCreate(SQLModel):
    """Schema for staging area creation"""
    locationId: UUID
    areaCode: str
    areaName: str
    areaType: str = "CROSS_DOCK"
    capacity: int = 100
    dockDoor: Optional[str] = None
    notes: Optional[str] = None


class StagingAreaUpdate(SQLModel):
    """Schema for staging area update"""
    areaName: Optional[str] = None
    status: Optional[StagingAreaStatus] = None
    capacity: Optional[int] = None
    dockDoor: Optional[str] = None
    assignedTransporterId: Optional[UUID] = None
    assignedRoute: Optional[str] = None
    reservedUntil: Optional[datetime] = None
    isActive: Optional[bool] = None


class StagingAreaResponse(StagingAreaBase):
    """Response schema for staging area"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
