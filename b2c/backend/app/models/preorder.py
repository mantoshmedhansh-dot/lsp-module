"""
Pre-order Models for Advanced Order Management
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class PreorderStatus(str, Enum):
    """Pre-order status"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PARTIALLY_AVAILABLE = "PARTIALLY_AVAILABLE"
    READY_TO_SHIP = "READY_TO_SHIP"
    CONVERTED = "CONVERTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class InventoryReservationType(str, Enum):
    """Inventory reservation type"""
    SOFT = "SOFT"  # Can be released
    HARD = "HARD"  # Committed
    PARTIAL = "PARTIAL"


# Database Models
class Preorder(BaseModel, table=True):
    """Pre-order records"""
    __tablename__ = "preorders"

    preorderNumber: str = Field(max_length=50, unique=True, index=True)
    customerId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    status: PreorderStatus = Field(default=PreorderStatus.PENDING, index=True)
    expectedReleaseDate: Optional[datetime] = Field(default=None, index=True)
    actualReleaseDate: Optional[datetime] = Field(default=None)
    convertedOrderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    totalAmount: float = Field(default=0.0)
    depositAmount: float = Field(default=0.0)
    depositPaid: bool = Field(default=False)
    currency: str = Field(default="INR", max_length=3)
    shippingAddressId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    billingAddressId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    notificationSent: bool = Field(default=False)
    notificationSentAt: Optional[datetime] = Field(default=None)
    cancelledAt: Optional[datetime] = Field(default=None)
    cancelReason: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class PreorderLine(BaseModel, table=True):
    """Pre-order line items"""
    __tablename__ = "preorder_lines"

    preorderId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    lineNumber: int = Field(default=1)
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sku: str = Field(max_length=100, index=True)
    itemName: Optional[str] = Field(default=None, max_length=255)
    quantity: int = Field(default=1)
    reservedQuantity: int = Field(default=0)
    availableQuantity: int = Field(default=0)
    unitPrice: float = Field(default=0.0)
    totalPrice: float = Field(default=0.0)
    expectedDate: Optional[datetime] = Field(default=None)


class PreorderInventory(BaseModel, table=True):
    """Reserved inventory for pre-orders"""
    __tablename__ = "preorder_inventory"

    preorderLineId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    locationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    reservationType: InventoryReservationType = Field(default=InventoryReservationType.SOFT)
    reservedQuantity: int = Field(default=0)
    reservedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiresAt: Optional[datetime] = Field(default=None)
    releasedAt: Optional[datetime] = Field(default=None)
    lotNumber: Optional[str] = Field(default=None, max_length=100)
    serialNumber: Optional[str] = Field(default=None, max_length=100)


# Request/Response Schemas
class PreorderCreate(SQLModel):
    """Schema for creating a pre-order"""
    customerId: UUID
    warehouseId: UUID
    expectedReleaseDate: Optional[datetime] = None
    depositAmount: float = 0.0
    shippingAddressId: Optional[UUID] = None
    billingAddressId: Optional[UUID] = None
    notes: Optional[str] = None
    lines: List[dict]


class PreorderResponse(SQLModel):
    """Response for pre-order"""
    id: UUID
    preorderNumber: str
    customerId: UUID
    warehouseId: UUID
    status: PreorderStatus
    expectedReleaseDate: Optional[datetime]
    totalAmount: float
    depositAmount: float
    depositPaid: bool
    createdAt: datetime


class PreorderLineResponse(SQLModel):
    """Response for pre-order line"""
    id: UUID
    preorderId: UUID
    lineNumber: int
    itemId: UUID
    sku: str
    itemName: Optional[str]
    quantity: int
    reservedQuantity: int
    availableQuantity: int
    unitPrice: float
    totalPrice: float


class PreorderConvertRequest(SQLModel):
    """Request to convert pre-order to order"""
    preorderId: UUID
    paymentMethod: Optional[str] = None
    shippingMethod: Optional[str] = None


class PreorderConvertResponse(SQLModel):
    """Response for pre-order conversion"""
    success: bool
    preorderId: UUID
    orderId: Optional[UUID]
    orderNumber: Optional[str]
    message: str


class PreorderInventoryStatusResponse(SQLModel):
    """Response for pre-order inventory status"""
    preorderId: UUID
    preorderNumber: str
    totalLines: int
    fullyReservedLines: int
    partiallyReservedLines: int
    unavailableLines: int
    readyToConvert: bool
    lines: List[dict]
