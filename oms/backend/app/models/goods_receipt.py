"""
Goods Receipt Model - SQLModel Implementation
Handles goods receipt (MIGO-style) for inbound processing
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import GoodsReceiptStatus


if TYPE_CHECKING:
    from .company import Location
    from .sku import SKU
    from .user import User


# ============================================================================
# GoodsReceipt Model
# ============================================================================

class GoodsReceipt(BaseModel, table=True):
    """
    Goods Receipt document for receiving inventory.
    Similar to SAP MIGO transaction.
    """
    __tablename__ = "GoodsReceipt"

    # Document Number (auto-generated)
    grNo: str = Field(
        sa_column=Column(String, unique=True, nullable=False, index=True)
    )

    # Reference Documents
    inboundId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Inbound.id"))
    )
    purchaseOrderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("PurchaseOrder.id"))
    )
    asnNo: Optional[str] = Field(default=None)  # Advance Shipping Notice (legacy)

    # Phase 2: Enhanced references
    externalPoId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("external_purchase_orders.id"))
    )
    asnId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("advance_shipping_notices.id"))
    )
    returnId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Return.id"))
    )
    stockTransferId: Optional[UUID] = Field(default=None)

    # External reference (for display/search)
    externalReferenceType: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    externalReferenceNo: Optional[str] = Field(default=None, sa_column=Column(String(100)))

    # Inbound source type
    inboundSource: str = Field(
        default="PURCHASE",
        sa_column=Column(String(50), nullable=False, default="PURCHASE")
    )  # PURCHASE, RETURN_SALES, RETURN_RTO, TRANSFER_IN, etc.

    # Status
    status: str = Field(
        default=GoodsReceiptStatus.DRAFT.value,
        sa_column=Column(String, nullable=False, default="DRAFT")
    )

    # Movement Type (SAP-style)
    movementType: str = Field(
        default="101",
        sa_column=Column(String, nullable=False, default="101")
    )  # 101=GR, 102=Reversal, 103=Return

    # Totals
    totalQty: int = Field(default=0, sa_column=Column(Integer, default=0))
    totalValue: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric(12, 2), default=0)
    )

    # Location
    locationId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            nullable=False,
            index=True
        )
    )

    # Multi-tenant
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # Audit
    receivedById: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("User.id"))
    )
    postedById: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("User.id"))
    )
    receivedAt: Optional[datetime] = Field(default=None)
    postedAt: Optional[datetime] = Field(default=None)

    # Notes
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Vehicle/Delivery Details (Phase 2)
    vehicleNumber: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    driverName: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    gateEntryNo: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    gateEntryTime: Optional[datetime] = Field(default=None)

    # Quality Summary (Phase 2)
    totalAcceptedQty: int = Field(default=0, sa_column=Column(Integer, default=0))
    totalRejectedQty: int = Field(default=0, sa_column=Column(Integer, default=0))

    # Source tracking (Phase 2)
    source: str = Field(
        default="MANUAL",
        sa_column=Column(String(50), nullable=False, default="MANUAL")
    )  # MANUAL, UPLOAD, API, ASN, EXTERNAL_PO
    uploadBatchId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("upload_batches.id"))
    )

    # Relationships
    items: List["GoodsReceiptItem"] = Relationship(back_populates="goodsReceipt")


# ============================================================================
# GoodsReceiptItem Model
# ============================================================================

class GoodsReceiptItem(BaseModel, table=True):
    """
    Line items for Goods Receipt document.
    """
    __tablename__ = "GoodsReceiptItem"

    # Parent
    goodsReceiptId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("GoodsReceipt.id"),
            nullable=False,
            index=True
        )
    )

    # Item
    skuId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("SKU.id"),
            nullable=False
        )
    )

    # Quantities
    expectedQty: int = Field(default=0, sa_column=Column(Integer, default=0))
    receivedQty: int = Field(default=0, sa_column=Column(Integer, default=0))
    acceptedQty: int = Field(default=0, sa_column=Column(Integer, default=0))
    rejectedQty: int = Field(default=0, sa_column=Column(Integer, default=0))

    # Batch/Lot Tracking
    batchNo: Optional[str] = Field(default=None, sa_column=Column(String))
    lotNo: Optional[str] = Field(default=None, sa_column=Column(String))
    expiryDate: Optional[datetime] = Field(default=None)
    mfgDate: Optional[datetime] = Field(default=None)

    # Serial Numbers (for serialized items)
    serialNumbers: List[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), default=[])
    )

    # Pricing
    mrp: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2))
    )
    costPrice: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2))
    )

    # Target Bin (for putaway)
    targetBinId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Bin.id"))
    )

    # QC
    qcStatus: Optional[str] = Field(default=None, sa_column=Column(String))
    qcRemarks: Optional[str] = Field(default=None, sa_column=Column(Text))

    # FIFO Sequence (assigned when posted)
    fifoSequence: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer)
    )

    # Relationships
    goodsReceipt: Optional["GoodsReceipt"] = Relationship(back_populates="items")


# ============================================================================
# Request/Response Schemas
# ============================================================================

# GoodsReceipt Schemas
class GoodsReceiptCreate(CreateBase):
    inboundId: Optional[UUID] = None
    purchaseOrderId: Optional[UUID] = None
    asnNo: Optional[str] = None
    movementType: str = "101"
    locationId: UUID
    companyId: UUID
    notes: Optional[str] = None
    # Phase 2 fields
    externalPoId: Optional[UUID] = None
    asnId: Optional[UUID] = None
    returnId: Optional[UUID] = None
    stockTransferId: Optional[UUID] = None
    externalReferenceType: Optional[str] = None
    externalReferenceNo: Optional[str] = None
    inboundSource: str = "PURCHASE"
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    gateEntryNo: Optional[str] = None
    gateEntryTime: Optional[datetime] = None
    source: str = "MANUAL"


class GoodsReceiptUpdate(UpdateBase):
    asnNo: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    # Phase 2 fields
    externalReferenceType: Optional[str] = None
    externalReferenceNo: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    gateEntryNo: Optional[str] = None
    gateEntryTime: Optional[datetime] = None


class GoodsReceiptResponse(ResponseBase):
    id: UUID
    grNo: str
    inboundId: Optional[UUID] = None
    purchaseOrderId: Optional[UUID] = None
    asnNo: Optional[str] = None
    status: str
    movementType: str
    totalQty: int
    totalValue: Decimal
    locationId: UUID
    companyId: UUID
    receivedById: Optional[UUID] = None
    postedById: Optional[UUID] = None
    receivedAt: Optional[datetime] = None
    postedAt: Optional[datetime] = None
    notes: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    # Phase 2 fields
    externalPoId: Optional[UUID] = None
    asnId: Optional[UUID] = None
    returnId: Optional[UUID] = None
    stockTransferId: Optional[UUID] = None
    externalReferenceType: Optional[str] = None
    externalReferenceNo: Optional[str] = None
    inboundSource: str = "PURCHASE"
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    gateEntryNo: Optional[str] = None
    gateEntryTime: Optional[datetime] = None
    totalAcceptedQty: int = 0
    totalRejectedQty: int = 0
    source: str = "MANUAL"
    # Computed
    itemCount: Optional[int] = None
    externalPoNumber: Optional[str] = None
    asnNumber: Optional[str] = None


class GoodsReceiptBrief(ResponseBase):
    id: UUID
    grNo: str
    status: str
    totalQty: int
    createdAt: datetime


class GoodsReceiptWithItems(GoodsReceiptResponse):
    items: List["GoodsReceiptItemResponse"] = []


# GoodsReceiptItem Schemas
class GoodsReceiptItemCreate(CreateBase):
    goodsReceiptId: UUID
    skuId: UUID
    expectedQty: int = 0
    receivedQty: int = 0
    acceptedQty: int = 0
    rejectedQty: int = 0
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    serialNumbers: List[str] = []
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    targetBinId: Optional[UUID] = None


class GoodsReceiptItemUpdate(UpdateBase):
    receivedQty: Optional[int] = None
    acceptedQty: Optional[int] = None
    rejectedQty: Optional[int] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    serialNumbers: Optional[List[str]] = None
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    targetBinId: Optional[UUID] = None
    qcStatus: Optional[str] = None
    qcRemarks: Optional[str] = None


class GoodsReceiptItemResponse(ResponseBase):
    id: UUID
    goodsReceiptId: UUID
    skuId: UUID
    expectedQty: int
    receivedQty: int
    acceptedQty: int
    rejectedQty: int
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    serialNumbers: List[str] = []
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    targetBinId: Optional[UUID] = None
    qcStatus: Optional[str] = None
    qcRemarks: Optional[str] = None
    fifoSequence: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime
    # Computed
    skuCode: Optional[str] = None
    skuName: Optional[str] = None


# ============================================================================
# Phase 2: Create from Source Schemas
# ============================================================================

class GRNFromExternalPOCreate(SQLModel):
    """Create GRN from External Purchase Order"""
    external_po_id: UUID
    location_id: UUID
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    gate_entry_no: Optional[str] = None
    notes: Optional[str] = None
    # If not provided, all pending items from PO will be included
    item_ids: Optional[List[UUID]] = None


class GRNFromASNCreate(SQLModel):
    """Create GRN from Advance Shipping Notice"""
    asn_id: UUID
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    gate_entry_no: Optional[str] = None
    notes: Optional[str] = None


class GRNFromReturnCreate(SQLModel):
    """Create GRN from Return"""
    return_id: UUID
    location_id: UUID
    notes: Optional[str] = None


class GRNFromSTOCreate(SQLModel):
    """Create GRN from Stock Transfer Order"""
    sto_id: UUID
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None


# Update forward reference
GoodsReceiptWithItems.model_rebuild()
