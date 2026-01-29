"""
Advance Shipping Notice (ASN) Models

Pre-arrival notifications for incoming shipments.

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
# ADVANCE SHIPPING NOTICE (ASN)
# ============================================================================

class AdvanceShippingNoticeBase(SQLModel):
    """Base fields for ASN (snake_case for DB mapping)"""
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
    """Create schema (camelCase for API input)"""
    locationId: UUID
    externalAsnNo: Optional[str] = None
    externalPoId: Optional[UUID] = None
    purchaseOrderId: Optional[UUID] = None
    vendorId: Optional[UUID] = None
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    shipDate: Optional[date] = None
    expectedArrival: Optional[date] = None
    totalCartons: Optional[int] = None
    totalPallets: Optional[int] = None
    totalWeightKg: Optional[Decimal] = None
    remarks: Optional[str] = None
    items: Optional[List["ASNItemCreate"]] = None


class AdvanceShippingNoticeUpdate(SQLModel):
    """Update schema (camelCase for API input)"""
    externalAsnNo: Optional[str] = None
    externalPoId: Optional[UUID] = None
    purchaseOrderId: Optional[UUID] = None
    vendorId: Optional[UUID] = None
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    status: Optional[str] = None
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    shipDate: Optional[date] = None
    expectedArrival: Optional[date] = None
    actualArrival: Optional[datetime] = None
    totalCartons: Optional[int] = None
    totalPallets: Optional[int] = None
    totalWeightKg: Optional[Decimal] = None
    remarks: Optional[str] = None


class AdvanceShippingNoticeRead(SQLModel):
    """Read schema (camelCase for API output)"""
    id: UUID
    companyId: UUID
    locationId: UUID
    asnNo: str
    externalAsnNo: Optional[str] = None
    externalPoId: Optional[UUID] = None
    purchaseOrderId: Optional[UUID] = None
    vendorId: Optional[UUID] = None
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    status: str
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    shipDate: Optional[date] = None
    expectedArrival: Optional[date] = None
    actualArrival: Optional[datetime] = None
    totalCartons: Optional[int] = None
    totalPallets: Optional[int] = None
    totalWeightKg: Optional[Decimal] = None
    source: str
    remarks: Optional[str] = None
    totalLines: int
    totalExpectedQty: int
    totalReceivedQty: int
    pendingQty: Optional[int] = None
    goodsReceiptId: Optional[UUID] = None
    createdAt: datetime
    updatedAt: datetime

    # Computed
    locationName: Optional[str] = None
    externalPoNumber: Optional[str] = None
    items: Optional[List["ASNItemRead"]] = None

    @field_validator("pendingQty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            expected = info.data.get("totalExpectedQty", 0)
            received = info.data.get("totalReceivedQty", 0)
            return expected - received
        return v


# ============================================================================
# ASN ITEMS
# ============================================================================

class ASNItemBase(SQLModel):
    """Base fields for ASN Item (snake_case for DB mapping)"""
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
    """Create schema for item (camelCase for API input)"""
    skuId: Optional[UUID] = None
    externalSkuCode: Optional[str] = None
    externalSkuName: Optional[str] = None
    externalPoItemId: Optional[UUID] = None
    expectedQty: int
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[date] = None
    mfgDate: Optional[date] = None
    cartons: Optional[int] = None
    unitsPerCarton: Optional[int] = None


class ASNItemUpdate(SQLModel):
    """Update schema for item (camelCase for API input)"""
    skuId: Optional[UUID] = None
    externalSkuCode: Optional[str] = None
    externalSkuName: Optional[str] = None
    expectedQty: Optional[int] = None
    receivedQty: Optional[int] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[date] = None
    mfgDate: Optional[date] = None
    cartons: Optional[int] = None
    unitsPerCarton: Optional[int] = None
    status: Optional[str] = None


class ASNItemRead(SQLModel):
    """Read schema for item (camelCase for API output)"""
    id: UUID
    asnId: UUID
    skuId: Optional[UUID] = None
    externalSkuCode: Optional[str] = None
    externalSkuName: Optional[str] = None
    externalPoItemId: Optional[UUID] = None
    expectedQty: int
    receivedQty: int
    pendingQty: Optional[int] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[date] = None
    mfgDate: Optional[date] = None
    cartons: Optional[int] = None
    unitsPerCarton: Optional[int] = None
    status: str
    createdAt: datetime

    # Computed
    skuCode: Optional[str] = None
    skuName: Optional[str] = None

    @field_validator("pendingQty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            expected = info.data.get("expectedQty", 0)
            received = info.data.get("receivedQty", 0)
            return expected - received
        return v


# Forward references
AdvanceShippingNoticeCreate.model_rebuild()
AdvanceShippingNoticeRead.model_rebuild()
