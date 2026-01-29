"""
External Purchase Order Models

For 3PL clients who don't manage POs in our system but need to reference them.

NAMING CONVENTION:
- Table models use snake_case (matches database columns)
- Read/Response schemas use camelCase (matches frontend expectations)
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel, Relationship
from pydantic import field_validator


# ============================================================================
# EXTERNAL PURCHASE ORDER
# ============================================================================

class ExternalPurchaseOrderBase(SQLModel):
    """Base fields for External PO (snake_case for DB mapping)"""
    external_po_number: str = Field(max_length=100, index=True)
    external_vendor_code: Optional[str] = Field(default=None, max_length=100)
    external_vendor_name: Optional[str] = Field(default=None, max_length=255)
    vendor_id: Optional[UUID] = Field(default=None, foreign_key="vendors.id")
    status: str = Field(default="OPEN", max_length=50)  # OPEN, PARTIALLY_RECEIVED, CLOSED, CANCELLED
    po_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    source: str = Field(default="MANUAL", max_length=50)  # MANUAL, UPLOAD, API
    remarks: Optional[str] = None


class ExternalPurchaseOrder(ExternalPurchaseOrderBase, table=True):
    """External Purchase Order - for clients without ERP integration"""
    __tablename__ = "external_purchase_orders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    location_id: UUID = Field(foreign_key="locations.id", index=True)

    # Totals (auto-calculated by trigger)
    total_lines: int = Field(default=0)
    total_expected_qty: int = Field(default=0)
    total_received_qty: int = Field(default=0)
    total_amount: Decimal = Field(default=Decimal("0"), max_digits=14, decimal_places=2)

    # Upload tracking
    upload_batch_id: Optional[UUID] = Field(default=None, foreign_key="upload_batches.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    items: List["ExternalPOItem"] = Relationship(
        back_populates="external_po",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ExternalPurchaseOrderCreate(SQLModel):
    """Create schema (camelCase for API input)"""
    externalPoNumber: str
    locationId: UUID
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    vendorId: Optional[UUID] = None
    poDate: Optional[date] = None
    expectedDeliveryDate: Optional[date] = None
    remarks: Optional[str] = None
    items: Optional[List["ExternalPOItemCreate"]] = None


class ExternalPurchaseOrderUpdate(SQLModel):
    """Update schema (camelCase for API input)"""
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    vendorId: Optional[UUID] = None
    status: Optional[str] = None
    poDate: Optional[date] = None
    expectedDeliveryDate: Optional[date] = None
    remarks: Optional[str] = None


class ExternalPurchaseOrderRead(SQLModel):
    """Read schema (camelCase for API output)"""
    id: UUID
    companyId: UUID
    locationId: UUID
    externalPoNumber: str
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    vendorId: Optional[UUID] = None
    status: str
    poDate: Optional[date] = None
    expectedDeliveryDate: Optional[date] = None
    source: str
    remarks: Optional[str] = None
    totalLines: int
    totalExpectedQty: int
    totalReceivedQty: int
    totalAmount: Decimal
    pendingQty: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime

    # Computed
    locationName: Optional[str] = None
    items: Optional[List["ExternalPOItemRead"]] = None

    @field_validator("pendingQty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            expected = info.data.get("totalExpectedQty", 0)
            received = info.data.get("totalReceivedQty", 0)
            return expected - received
        return v


# ============================================================================
# EXTERNAL PO ITEMS
# ============================================================================

class ExternalPOItemBase(SQLModel):
    """Base fields for External PO Item (snake_case for DB mapping)"""
    external_sku_code: str = Field(max_length=100)
    external_sku_name: Optional[str] = Field(default=None, max_length=255)
    sku_id: Optional[UUID] = Field(default=None, foreign_key="skus.id")
    ordered_qty: int = Field(default=0, ge=0)
    received_qty: int = Field(default=0, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, max_digits=12, decimal_places=2)
    status: str = Field(default="OPEN", max_length=50)  # OPEN, PARTIALLY_RECEIVED, CLOSED


class ExternalPOItem(ExternalPOItemBase, table=True):
    """External PO Line Item"""
    __tablename__ = "external_po_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    external_po_id: UUID = Field(foreign_key="external_purchase_orders.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    external_po: Optional[ExternalPurchaseOrder] = Relationship(back_populates="items")


class ExternalPOItemCreate(SQLModel):
    """Create schema for item (camelCase for API input)"""
    externalSkuCode: str
    externalSkuName: Optional[str] = None
    skuId: Optional[UUID] = None
    orderedQty: int
    unitPrice: Optional[Decimal] = None


class ExternalPOItemUpdate(SQLModel):
    """Update schema for item (camelCase for API input)"""
    externalSkuName: Optional[str] = None
    skuId: Optional[UUID] = None
    orderedQty: Optional[int] = None
    receivedQty: Optional[int] = None
    unitPrice: Optional[Decimal] = None
    status: Optional[str] = None


class ExternalPOItemRead(SQLModel):
    """Read schema for item (camelCase for API output)"""
    id: UUID
    externalPoId: UUID
    externalSkuCode: str
    externalSkuName: Optional[str] = None
    skuId: Optional[UUID] = None
    orderedQty: int
    receivedQty: int
    unitPrice: Optional[Decimal] = None
    status: str
    pendingQty: Optional[int] = None
    skuCode: Optional[str] = None
    skuName: Optional[str] = None
    createdAt: datetime

    @field_validator("pendingQty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            ordered = info.data.get("orderedQty", 0)
            received = info.data.get("receivedQty", 0)
            return ordered - received
        return v


# Forward references
ExternalPurchaseOrderCreate.model_rebuild()
ExternalPurchaseOrderRead.model_rebuild()
