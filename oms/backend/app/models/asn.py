"""
Advance Shipping Notice (ASN) Models

Pre-arrival notifications for incoming shipments.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel, Relationship


# ============================================================================
# ADVANCE SHIPPING NOTICE (ASN)
# ============================================================================

class AdvanceShippingNoticeBase(SQLModel):
    """Base fields for ASN"""
    external_asn_no: Optional[str] = Field(default=None, max_length=100)

    # References
    external_po_id: Optional[UUID] = Field(default=None, foreign_key="external_purchase_orders.id")
    purchase_order_id: Optional[UUID] = Field(default=None, foreign_key="purchase_orders.id")
    vendor_id: Optional[UUID] = Field(default=None, foreign_key="vendors.id")
    external_vendor_code: Optional[str] = Field(default=None, max_length=100)
    external_vendor_name: Optional[str] = Field(default=None, max_length=255)

    # Status
    status: str = Field(default="EXPECTED", max_length=50)
    # EXPECTED, IN_TRANSIT, ARRIVED, RECEIVING, RECEIVED, CANCELLED

    # Shipping Details
    carrier: Optional[str] = Field(default=None, max_length=100)
    tracking_number: Optional[str] = Field(default=None, max_length=100)
    vehicle_number: Optional[str] = Field(default=None, max_length=50)
    driver_name: Optional[str] = Field(default=None, max_length=100)
    driver_phone: Optional[str] = Field(default=None, max_length=20)

    # Dates
    ship_date: Optional[date] = None
    expected_arrival: Optional[date] = None

    # Packing info
    total_cartons: Optional[int] = None
    total_pallets: Optional[int] = None
    total_weight_kg: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=3)

    # Source
    source: str = Field(default="MANUAL", max_length=50)  # MANUAL, UPLOAD, API, EDI

    remarks: Optional[str] = None


class AdvanceShippingNotice(AdvanceShippingNoticeBase, table=True):
    """Advance Shipping Notice"""
    __tablename__ = "advance_shipping_notices"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    location_id: UUID = Field(foreign_key="locations.id", index=True)
    asn_no: str = Field(max_length=50, index=True)

    # Actual arrival
    actual_arrival: Optional[datetime] = None

    # Totals (auto-calculated by trigger)
    total_lines: int = Field(default=0)
    total_expected_qty: int = Field(default=0)
    total_received_qty: int = Field(default=0)

    # Upload tracking
    upload_batch_id: Optional[UUID] = Field(default=None, foreign_key="upload_batches.id")

    # Related GRN
    goods_receipt_id: Optional[UUID] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    items: List["ASNItem"] = Relationship(
        back_populates="asn",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class AdvanceShippingNoticeCreate(SQLModel):
    """Create schema"""
    location_id: UUID
    external_asn_no: Optional[str] = None
    external_po_id: Optional[UUID] = None
    purchase_order_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    external_vendor_code: Optional[str] = None
    external_vendor_name: Optional[str] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    ship_date: Optional[date] = None
    expected_arrival: Optional[date] = None
    total_cartons: Optional[int] = None
    total_pallets: Optional[int] = None
    total_weight_kg: Optional[Decimal] = None
    remarks: Optional[str] = None
    items: Optional[List["ASNItemCreate"]] = None


class AdvanceShippingNoticeUpdate(SQLModel):
    """Update schema"""
    external_asn_no: Optional[str] = None
    external_po_id: Optional[UUID] = None
    purchase_order_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    external_vendor_code: Optional[str] = None
    external_vendor_name: Optional[str] = None
    status: Optional[str] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    ship_date: Optional[date] = None
    expected_arrival: Optional[date] = None
    actual_arrival: Optional[datetime] = None
    total_cartons: Optional[int] = None
    total_pallets: Optional[int] = None
    total_weight_kg: Optional[Decimal] = None
    remarks: Optional[str] = None


class AdvanceShippingNoticeRead(AdvanceShippingNoticeBase):
    """Read schema"""
    id: UUID
    company_id: UUID
    location_id: UUID
    asn_no: str
    actual_arrival: Optional[datetime] = None
    total_lines: int
    total_expected_qty: int
    total_received_qty: int
    goods_receipt_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    # Nested
    location_name: Optional[str] = None
    external_po_number: Optional[str] = None
    items: Optional[List["ASNItemRead"]] = None


# ============================================================================
# ASN ITEMS
# ============================================================================

class ASNItemBase(SQLModel):
    """Base fields for ASN Item"""
    sku_id: Optional[UUID] = Field(default=None, foreign_key="skus.id")
    external_sku_code: Optional[str] = Field(default=None, max_length=100)
    external_sku_name: Optional[str] = Field(default=None, max_length=255)
    external_po_item_id: Optional[UUID] = Field(default=None, foreign_key="external_po_items.id")

    expected_qty: int = Field(default=0, ge=0)
    received_qty: int = Field(default=0, ge=0)

    # Batch/Lot Info
    batch_no: Optional[str] = Field(default=None, max_length=100)
    lot_no: Optional[str] = Field(default=None, max_length=100)
    expiry_date: Optional[date] = None
    mfg_date: Optional[date] = None

    # Packing
    cartons: Optional[int] = None
    units_per_carton: Optional[int] = None

    status: str = Field(default="EXPECTED", max_length=50)  # EXPECTED, RECEIVED, PARTIALLY_RECEIVED


class ASNItem(ASNItemBase, table=True):
    """ASN Line Item"""
    __tablename__ = "asn_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    asn_id: UUID = Field(foreign_key="advance_shipping_notices.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    asn: Optional[AdvanceShippingNotice] = Relationship(back_populates="items")


class ASNItemCreate(SQLModel):
    """Create schema for item"""
    sku_id: Optional[UUID] = None
    external_sku_code: Optional[str] = None
    external_sku_name: Optional[str] = None
    external_po_item_id: Optional[UUID] = None
    expected_qty: int
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    expiry_date: Optional[date] = None
    mfg_date: Optional[date] = None
    cartons: Optional[int] = None
    units_per_carton: Optional[int] = None


class ASNItemUpdate(SQLModel):
    """Update schema for item"""
    sku_id: Optional[UUID] = None
    external_sku_code: Optional[str] = None
    external_sku_name: Optional[str] = None
    expected_qty: Optional[int] = None
    received_qty: Optional[int] = None
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    expiry_date: Optional[date] = None
    mfg_date: Optional[date] = None
    cartons: Optional[int] = None
    units_per_carton: Optional[int] = None
    status: Optional[str] = None


class ASNItemRead(ASNItemBase):
    """Read schema for item"""
    id: UUID
    asn_id: UUID
    sku_code: Optional[str] = None
    sku_name: Optional[str] = None
    created_at: datetime


# Forward references
AdvanceShippingNoticeCreate.model_rebuild()
AdvanceShippingNoticeRead.model_rebuild()
