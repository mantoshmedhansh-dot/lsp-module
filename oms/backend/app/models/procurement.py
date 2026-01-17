"""
Procurement Models: Purchase Orders, Vendors
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel
from .enums import POStatus


# ============================================================================
# Vendor
# ============================================================================

class VendorBase(SQLModel):
    """Vendor base fields"""
    code: str = Field(index=True)
    name: str
    contactPerson: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    bankDetails: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    paymentTerms: Optional[str] = None
    leadTimeDays: Optional[int] = None
    isActive: bool = Field(default=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)


class Vendor(VendorBase, BaseModel, table=True):
    """Vendor/Supplier model"""
    __tablename__ = "Vendor"

    # Relationships
    purchaseOrders: List["PurchaseOrder"] = Relationship(back_populates="vendor")


class VendorCreate(VendorBase):
    """Vendor creation schema"""
    pass


class VendorUpdate(SQLModel):
    """Vendor update schema"""
    code: Optional[str] = None
    name: Optional[str] = None
    contactPerson: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[dict] = None
    bankDetails: Optional[dict] = None
    paymentTerms: Optional[str] = None
    leadTimeDays: Optional[int] = None
    isActive: Optional[bool] = None


class VendorResponse(VendorBase):
    """Vendor response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class VendorBrief(SQLModel):
    """Vendor brief schema"""
    id: UUID
    code: str
    name: str


# ============================================================================
# Purchase Order
# ============================================================================

class PurchaseOrderBase(SQLModel):
    """Purchase Order base fields"""
    poNumber: str = Field(unique=True)
    vendorId: UUID = Field(foreign_key="Vendor.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    status: POStatus = Field(default=POStatus.DRAFT, index=True)
    orderDate: datetime
    expectedDate: Optional[datetime] = None
    totalAmount: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    remarks: Optional[str] = None


class PurchaseOrder(PurchaseOrderBase, BaseModel, table=True):
    """Purchase Order model"""
    __tablename__ = "PurchaseOrder"

    # Relationships
    vendor: Optional["Vendor"] = Relationship(back_populates="purchaseOrders")
    items: List["POItem"] = Relationship(back_populates="purchaseOrder")


class PurchaseOrderCreate(SQLModel):
    """Purchase Order creation schema"""
    poNumber: Optional[str] = None  # Auto-generated if not provided
    vendorId: UUID
    locationId: UUID
    orderDate: Optional[datetime] = None
    expectedDate: Optional[datetime] = None
    remarks: Optional[str] = None
    items: Optional[List["POItemCreate"]] = None


class PurchaseOrderUpdate(SQLModel):
    """Purchase Order update schema"""
    vendorId: Optional[UUID] = None
    locationId: Optional[UUID] = None
    status: Optional[POStatus] = None
    expectedDate: Optional[datetime] = None
    remarks: Optional[str] = None


class PurchaseOrderResponse(PurchaseOrderBase):
    """Purchase Order response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    vendor: Optional[VendorBrief] = None
    items: Optional[List["POItemResponse"]] = None


# ============================================================================
# PO Item
# ============================================================================

class POItemBase(SQLModel):
    """PO Item base fields"""
    purchaseOrderId: UUID = Field(foreign_key="PurchaseOrder.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    quantity: int = Field(default=0)
    unitPrice: Decimal = Field(default=Decimal("0"))
    taxRate: Optional[Decimal] = None
    receivedQty: int = Field(default=0)


class POItem(POItemBase, BaseModel, table=True):
    """PO Item model"""
    __tablename__ = "POItem"

    # Relationships
    purchaseOrder: Optional["PurchaseOrder"] = Relationship(back_populates="items")


class POItemCreate(SQLModel):
    """PO Item creation schema"""
    skuId: UUID
    quantity: int
    unitPrice: Decimal
    taxRate: Optional[Decimal] = None


class POItemUpdate(SQLModel):
    """PO Item update schema"""
    quantity: Optional[int] = None
    unitPrice: Optional[Decimal] = None
    taxRate: Optional[Decimal] = None
    receivedQty: Optional[int] = None


class POItemResponse(POItemBase):
    """PO Item response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
