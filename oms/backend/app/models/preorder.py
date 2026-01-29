"""
Pre-order Models: Pre-orders, Pre-order lines, Pre-order inventory
For pre-order management and inventory reservation
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

class PreorderStatus(str, Enum):
    """Pre-order status"""
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PARTIALLY_ALLOCATED = "PARTIALLY_ALLOCATED"
    FULLY_ALLOCATED = "FULLY_ALLOCATED"
    CONVERTED = "CONVERTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


# ============================================================================
# Preorder
# ============================================================================

class PreorderBase(SQLModel):
    """Pre-order base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    preorderNo: str = Field(max_length=50, unique=True, index=True)
    customerId: Optional[UUID] = Field(default=None, foreign_key="Customer.id", index=True)
    customerName: Optional[str] = Field(default=None, max_length=255)
    customerEmail: Optional[str] = Field(default=None, max_length=255)
    customerPhone: Optional[str] = Field(default=None, max_length=20)
    channel: Optional[str] = Field(default=None, max_length=50, index=True)
    externalOrderId: Optional[str] = Field(default=None, max_length=100)
    status: PreorderStatus = Field(default=PreorderStatus.DRAFT, index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    expectedAvailableDate: Optional[date] = None
    expiryDate: Optional[date] = None
    totalItems: int = Field(default=0)
    subtotal: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    discountAmount: Decimal = Field(default=Decimal("0"))
    totalAmount: Decimal = Field(default=Decimal("0"))
    depositAmount: Decimal = Field(default=Decimal("0"))
    depositPaidAt: Optional[datetime] = None
    convertedOrderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    convertedAt: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class Preorder(PreorderBase, BaseModel, table=True):
    """Pre-order model"""
    __tablename__ = "Preorder"

    # Relationships
    lines: List["PreorderLine"] = Relationship(back_populates="preorder")


class PreorderCreate(SQLModel):
    """Schema for pre-order creation"""
    customerId: Optional[UUID] = None
    customerName: Optional[str] = None
    customerEmail: Optional[str] = None
    customerPhone: Optional[str] = None
    channel: Optional[str] = None
    externalOrderId: Optional[str] = None
    locationId: UUID
    expectedAvailableDate: Optional[date] = None
    expiryDate: Optional[date] = None
    depositAmount: Decimal = Decimal("0")
    notes: Optional[str] = None


class PreorderUpdate(SQLModel):
    """Schema for pre-order update"""
    status: Optional[PreorderStatus] = None
    expectedAvailableDate: Optional[date] = None
    expiryDate: Optional[date] = None
    depositAmount: Optional[Decimal] = None
    depositPaidAt: Optional[datetime] = None
    notes: Optional[str] = None


class PreorderResponse(PreorderBase):
    """Response schema for pre-order"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# PreorderLine
# ============================================================================

class PreorderLineBase(SQLModel):
    """Pre-order line base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    preorderId: UUID = Field(foreign_key="Preorder.id", index=True)
    lineNo: int = Field(default=1)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    skuCode: str = Field(max_length=100)
    skuName: Optional[str] = Field(default=None, max_length=255)
    quantity: Decimal
    allocatedQuantity: Decimal = Field(default=Decimal("0"))
    unitPrice: Decimal
    taxRate: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    discountAmount: Decimal = Field(default=Decimal("0"))
    lineTotal: Decimal
    expectedAvailableDate: Optional[date] = None
    isAllocated: bool = Field(default=False)
    notes: Optional[str] = Field(default=None, max_length=500)


class PreorderLine(PreorderLineBase, BaseModel, table=True):
    """Pre-order line model"""
    __tablename__ = "PreorderLine"

    # Relationships
    preorder: Optional["Preorder"] = Relationship(back_populates="lines")


class PreorderLineCreate(SQLModel):
    """Schema for line creation"""
    skuId: UUID
    skuCode: str
    skuName: Optional[str] = None
    quantity: Decimal
    unitPrice: Decimal
    taxRate: Decimal = Decimal("0")
    discountAmount: Decimal = Decimal("0")
    expectedAvailableDate: Optional[date] = None
    notes: Optional[str] = None


class PreorderLineResponse(PreorderLineBase):
    """Response schema for line"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# PreorderInventory
# ============================================================================

class PreorderInventoryBase(SQLModel):
    """Pre-order inventory reservation base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    preorderId: UUID = Field(foreign_key="Preorder.id", index=True)
    preorderLineId: UUID = Field(foreign_key="PreorderLine.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    reservedQuantity: Decimal
    fulfilledQuantity: Decimal = Field(default=Decimal("0"))
    reservedAt: datetime = Field(default_factory=datetime.utcnow)
    expectedArrivalDate: Optional[date] = None
    sourceType: Optional[str] = Field(default=None, max_length=50)  # PO, ASN, TRANSFER
    sourceId: Optional[UUID] = None
    expiresAt: Optional[datetime] = None
    isActive: bool = Field(default=True)
    notes: Optional[str] = Field(default=None, max_length=500)


class PreorderInventory(PreorderInventoryBase, BaseModel, table=True):
    """Pre-order inventory model"""
    __tablename__ = "PreorderInventory"


class PreorderInventoryResponse(PreorderInventoryBase):
    """Response schema for inventory"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Request/Response Schemas
# ============================================================================

class PreorderConvertRequest(SQLModel):
    """Request to convert pre-order to order"""
    preorderId: UUID
    shippingAddressId: Optional[UUID] = None
    billingAddressId: Optional[UUID] = None
    notes: Optional[str] = None


class PreorderInventoryStatusResponse(SQLModel):
    """Response for pre-order inventory status"""
    preorderId: UUID
    totalLines: int
    fullyAllocatedLines: int
    partiallyAllocatedLines: int
    unallocatedLines: int
    totalQuantity: Decimal
    allocatedQuantity: Decimal
    percentageAllocated: Decimal
    estimatedFulfillmentDate: Optional[date] = None
    pendingInbounds: List[dict] = []
