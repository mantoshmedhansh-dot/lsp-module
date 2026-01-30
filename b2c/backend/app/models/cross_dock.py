"""
Cross-Docking Models for Flow-Through Operations
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class CrossDockRuleType(str, Enum):
    """Cross-dock rule types"""
    AUTO_ALLOCATE = "AUTO_ALLOCATE"
    PRIORITY_CUSTOMER = "PRIORITY_CUSTOMER"
    SAME_DAY = "SAME_DAY"
    EXPRESS = "EXPRESS"
    BULK_TRANSFER = "BULK_TRANSFER"


class CrossDockStatus(str, Enum):
    """Cross-dock order status"""
    PENDING = "PENDING"
    ELIGIBLE = "ELIGIBLE"
    ALLOCATED = "ALLOCATED"
    IN_STAGING = "IN_STAGING"
    LOADING = "LOADING"
    SHIPPED = "SHIPPED"
    CANCELLED = "CANCELLED"


class StagingAreaStatus(str, Enum):
    """Staging area status"""
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    IN_USE = "IN_USE"
    MAINTENANCE = "MAINTENANCE"


# Database Models
class CrossDockRule(BaseModel, table=True):
    """Auto-allocation rules for cross-docking"""
    __tablename__ = "cross_dock_rules"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    ruleName: str = Field(max_length=100)
    ruleType: CrossDockRuleType = Field(index=True)
    priority: int = Field(default=0)
    minOrderValue: Optional[float] = Field(default=None)
    maxOrderAge: Optional[int] = Field(default=None)  # Hours
    customerTiers: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    shippingMethods: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    productCategories: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    originWarehouses: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    autoAllocatePercentage: float = Field(default=100.0)
    conditions: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isActive: bool = Field(default=True)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))


class CrossDockOrder(BaseModel, table=True):
    """Cross-dock eligible orders"""
    __tablename__ = "cross_dock_orders"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    orderId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, unique=True, index=True)
    )
    orderNumber: str = Field(max_length=50, index=True)
    status: CrossDockStatus = Field(default=CrossDockStatus.PENDING, index=True)
    appliedRuleId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    inboundShipmentId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    outboundShipmentId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    stagingAreaId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    expectedArrival: Optional[datetime] = Field(default=None)
    actualArrival: Optional[datetime] = Field(default=None)
    scheduledDeparture: Optional[datetime] = Field(default=None)
    actualDeparture: Optional[datetime] = Field(default=None)
    totalUnits: int = Field(default=0)
    allocatedUnits: int = Field(default=0)
    processedUnits: int = Field(default=0)
    priority: int = Field(default=0)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class CrossDockAllocation(BaseModel, table=True):
    """Inbound-to-outbound mapping"""
    __tablename__ = "cross_dock_allocations"

    crossDockOrderId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    inboundLineId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    outboundLineId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sku: str = Field(max_length=100, index=True)
    allocatedQuantity: int = Field(default=0)
    receivedQuantity: int = Field(default=0)
    shippedQuantity: int = Field(default=0)
    allocationTime: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processedTime: Optional[datetime] = Field(default=None)


class StagingArea(BaseModel, table=True):
    """Cross-dock staging zones"""
    __tablename__ = "staging_areas"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    areaCode: str = Field(max_length=20, unique=True, index=True)
    areaName: str = Field(max_length=100)
    areaType: str = Field(default="CROSS_DOCK", max_length=30)
    status: StagingAreaStatus = Field(default=StagingAreaStatus.AVAILABLE)
    capacityUnits: int = Field(default=100)
    currentUnits: int = Field(default=0)
    capacityPallets: int = Field(default=10)
    currentPallets: int = Field(default=0)
    dockDoor: Optional[str] = Field(default=None, max_length=20)
    assignedCarrier: Optional[str] = Field(default=None, max_length=100)
    reservedUntil: Optional[datetime] = Field(default=None)
    temperature: Optional[str] = Field(default=None, max_length=20)
    isActive: bool = Field(default=True)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


# Request/Response Schemas
class CrossDockRuleCreate(SQLModel):
    """Schema for creating a cross-dock rule"""
    warehouseId: UUID
    ruleName: str
    ruleType: CrossDockRuleType
    priority: int = 0
    minOrderValue: Optional[float] = None
    maxOrderAge: Optional[int] = None
    customerTiers: Optional[List[str]] = None
    shippingMethods: Optional[List[str]] = None
    productCategories: Optional[List[str]] = None
    autoAllocatePercentage: float = 100.0
    description: Optional[str] = None


class CrossDockRuleResponse(SQLModel):
    """Response for cross-dock rule"""
    id: UUID
    warehouseId: UUID
    ruleName: str
    ruleType: CrossDockRuleType
    priority: int
    isActive: bool
    createdAt: datetime


class CrossDockOrderResponse(SQLModel):
    """Response for cross-dock order"""
    id: UUID
    warehouseId: UUID
    orderId: UUID
    orderNumber: str
    status: CrossDockStatus
    inboundShipmentId: Optional[UUID]
    expectedArrival: Optional[datetime]
    scheduledDeparture: Optional[datetime]
    totalUnits: int
    allocatedUnits: int
    processedUnits: int
    priority: int


class CrossDockAllocationCreate(SQLModel):
    """Schema for creating allocation"""
    crossDockOrderId: UUID
    inboundLineId: UUID
    outboundLineId: UUID
    itemId: UUID
    sku: str
    allocatedQuantity: int


class CrossDockAllocationResponse(SQLModel):
    """Response for allocation"""
    id: UUID
    crossDockOrderId: UUID
    itemId: UUID
    sku: str
    allocatedQuantity: int
    receivedQuantity: int
    shippedQuantity: int
    allocationTime: datetime


class StagingAreaResponse(SQLModel):
    """Response for staging area"""
    id: UUID
    warehouseId: UUID
    areaCode: str
    areaName: str
    status: StagingAreaStatus
    capacityUnits: int
    currentUnits: int
    capacityPallets: int
    currentPallets: int
    dockDoor: Optional[str]
    assignedCarrier: Optional[str]
    isActive: bool


class EligibleOrdersResponse(SQLModel):
    """Response for eligible orders query"""
    warehouseId: UUID
    totalEligible: int
    orders: List[CrossDockOrderResponse]
    generatedAt: datetime
