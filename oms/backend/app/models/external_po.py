"""
External Purchase Order Models

For 3PL clients who don't manage POs in our system but need to reference them.
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
    """Base fields for External PO"""
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


class ExternalPurchaseOrderCreate(ExternalPurchaseOrderBase):
    """Create schema"""
    location_id: UUID
    items: Optional[List["ExternalPOItemCreate"]] = None


class ExternalPurchaseOrderUpdate(SQLModel):
    """Update schema"""
    external_vendor_code: Optional[str] = None
    external_vendor_name: Optional[str] = None
    vendor_id: Optional[UUID] = None
    status: Optional[str] = None
    po_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    remarks: Optional[str] = None


class ExternalPurchaseOrderRead(ExternalPurchaseOrderBase):
    """Read schema"""
    id: UUID
    company_id: UUID
    location_id: UUID
    total_lines: int
    total_expected_qty: int
    total_received_qty: int
    total_amount: Decimal
    pending_qty: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Nested
    location_name: Optional[str] = None
    items: Optional[List["ExternalPOItemRead"]] = None

    @field_validator("pending_qty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            expected = info.data.get("total_expected_qty", 0)
            received = info.data.get("total_received_qty", 0)
            return expected - received
        return v


# ============================================================================
# EXTERNAL PO ITEMS
# ============================================================================

class ExternalPOItemBase(SQLModel):
    """Base fields for External PO Item"""
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
    """Create schema for item"""
    external_sku_code: str
    external_sku_name: Optional[str] = None
    sku_id: Optional[UUID] = None
    ordered_qty: int
    unit_price: Optional[Decimal] = None


class ExternalPOItemUpdate(SQLModel):
    """Update schema for item"""
    external_sku_name: Optional[str] = None
    sku_id: Optional[UUID] = None
    ordered_qty: Optional[int] = None
    received_qty: Optional[int] = None
    unit_price: Optional[Decimal] = None
    status: Optional[str] = None


class ExternalPOItemRead(ExternalPOItemBase):
    """Read schema for item"""
    id: UUID
    external_po_id: UUID
    pending_qty: Optional[int] = None
    sku_code: Optional[str] = None
    sku_name: Optional[str] = None
    created_at: datetime

    @field_validator("pending_qty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            ordered = info.data.get("ordered_qty", 0)
            received = info.data.get("received_qty", 0)
            return ordered - received
        return v


# Forward references
ExternalPurchaseOrderCreate.model_rebuild()
ExternalPurchaseOrderRead.model_rebuild()
