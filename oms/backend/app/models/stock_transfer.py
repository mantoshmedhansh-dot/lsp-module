"""
Stock Transfer Order (STO) Models

For inter-warehouse/location stock transfers.

NAMING CONVENTION:
- Table models use snake_case (matches database columns)
- Read/Response schemas use camelCase (matches frontend expectations)
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel, Relationship
from pydantic import field_validator


# ============================================================================
# STOCK TRANSFER ORDER
# ============================================================================

class StockTransferOrderBase(SQLModel):
    """Base fields for Stock Transfer Order (snake_case for DB mapping)"""
    # Status
    status: str = Field(default="DRAFT", max_length=50)
    # DRAFT, APPROVED, PICKING, PICKED, IN_TRANSIT, RECEIVED, CANCELLED

    # Dates
    required_by_date: Optional[datetime] = None
    shipped_date: Optional[datetime] = None
    received_date: Optional[datetime] = None

    # Shipping details
    carrier: Optional[str] = Field(default=None, max_length=100)
    tracking_number: Optional[str] = Field(default=None, max_length=100)
    vehicle_number: Optional[str] = Field(default=None, max_length=50)
    driver_name: Optional[str] = Field(default=None, max_length=100)
    driver_phone: Optional[str] = Field(default=None, max_length=20)

    # Priority
    priority: str = Field(default="NORMAL", max_length=20)  # LOW, NORMAL, HIGH, URGENT

    remarks: Optional[str] = None


class StockTransferOrder(StockTransferOrderBase, table=True):
    """Stock Transfer Order - for inter-location transfers"""
    __tablename__ = "stock_transfer_orders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="Company.id", index=True)

    # STO Number
    sto_no: str = Field(max_length=50, index=True)

    # Source & Destination
    source_location_id: UUID = Field(foreign_key="Location.id", index=True)
    destination_location_id: UUID = Field(foreign_key="Location.id", index=True)

    # Totals (auto-calculated)
    total_items: int = Field(default=0)
    total_requested_qty: int = Field(default=0)
    total_shipped_qty: int = Field(default=0)
    total_received_qty: int = Field(default=0)

    # Related Documents
    source_gate_pass_id: Optional[UUID] = None  # Gate pass at source
    destination_grn_id: Optional[UUID] = None  # GRN at destination

    # Requestor/Approver
    requested_by: Optional[UUID] = Field(default=None, foreign_key="User.id")
    approved_by: Optional[UUID] = Field(default=None, foreign_key="User.id")
    approved_at: Optional[datetime] = None

    # Source tracking
    source: str = Field(default="MANUAL", max_length=50)  # MANUAL, UPLOAD, API
    upload_batch_id: Optional[UUID] = Field(default=None, foreign_key="upload_batches.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    items: List["STOItem"] = Relationship(
        back_populates="stock_transfer_order",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class StockTransferOrderCreate(SQLModel):
    """Create schema (camelCase for API input)"""
    sourceLocationId: UUID
    destinationLocationId: UUID
    requiredByDate: Optional[datetime] = None
    priority: str = "NORMAL"
    remarks: Optional[str] = None
    items: Optional[List["STOItemCreate"]] = None


class StockTransferOrderUpdate(SQLModel):
    """Update schema (camelCase for API input)"""
    status: Optional[str] = None
    requiredByDate: Optional[datetime] = None
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None


class StockTransferOrderRead(SQLModel):
    """Read schema (camelCase for API output)"""
    id: UUID
    companyId: UUID
    stoNo: str
    sourceLocationId: UUID
    destinationLocationId: UUID
    status: str
    requiredByDate: Optional[datetime] = None
    shippedDate: Optional[datetime] = None
    receivedDate: Optional[datetime] = None
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    priority: str
    remarks: Optional[str] = None
    totalItems: int
    totalRequestedQty: int
    totalShippedQty: int
    totalReceivedQty: int
    pendingQty: Optional[int] = None
    sourceGatePassId: Optional[UUID] = None
    destinationGrnId: Optional[UUID] = None
    requestedBy: Optional[UUID] = None
    approvedBy: Optional[UUID] = None
    approvedAt: Optional[datetime] = None
    source: str
    createdAt: datetime
    updatedAt: datetime

    # Computed
    sourceLocationName: Optional[str] = None
    destinationLocationName: Optional[str] = None
    requestedByName: Optional[str] = None
    approvedByName: Optional[str] = None
    items: Optional[List["STOItemRead"]] = None

    @field_validator("pendingQty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            requested = info.data.get("totalRequestedQty", 0)
            received = info.data.get("totalReceivedQty", 0)
            return requested - received
        return v


# ============================================================================
# STO ITEMS
# ============================================================================

class STOItemBase(SQLModel):
    """Base fields for STO Item (snake_case for DB mapping)"""
    # Quantities
    requested_qty: int = Field(default=0, ge=0)
    shipped_qty: int = Field(default=0, ge=0)
    received_qty: int = Field(default=0, ge=0)
    damaged_qty: int = Field(default=0, ge=0)

    # Batch/Lot (for traceability)
    batch_no: Optional[str] = Field(default=None, max_length=100)
    lot_no: Optional[str] = Field(default=None, max_length=100)

    # Status
    status: str = Field(default="PENDING", max_length=50)
    # PENDING, PICKED, SHIPPED, RECEIVED, PARTIALLY_RECEIVED

    remarks: Optional[str] = None


class STOItem(STOItemBase, table=True):
    """STO Line Item"""
    __tablename__ = "sto_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    stock_transfer_order_id: UUID = Field(foreign_key="stock_transfer_orders.id", index=True)

    # SKU
    sku_id: UUID = Field(foreign_key="SKU.id")

    # Source Bin (picked from)
    source_bin_id: Optional[UUID] = Field(default=None, foreign_key="Bin.id")

    # Destination Bin (putaway to)
    destination_bin_id: Optional[UUID] = Field(default=None, foreign_key="Bin.id")

    # Inventory reference (for FIFO tracking)
    source_inventory_id: Optional[UUID] = None
    fifo_sequence: Optional[int] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    stock_transfer_order: Optional[StockTransferOrder] = Relationship(back_populates="items")


class STOItemCreate(SQLModel):
    """Create schema for item (camelCase for API input)"""
    skuId: UUID
    requestedQty: int
    sourceBinId: Optional[UUID] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    remarks: Optional[str] = None


class STOItemUpdate(SQLModel):
    """Update schema for item (camelCase for API input)"""
    requestedQty: Optional[int] = None
    shippedQty: Optional[int] = None
    receivedQty: Optional[int] = None
    damagedQty: Optional[int] = None
    sourceBinId: Optional[UUID] = None
    destinationBinId: Optional[UUID] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class STOItemRead(SQLModel):
    """Read schema for item (camelCase for API output)"""
    id: UUID
    stockTransferOrderId: UUID
    skuId: UUID
    sourceBinId: Optional[UUID] = None
    destinationBinId: Optional[UUID] = None
    sourceInventoryId: Optional[UUID] = None
    fifoSequence: Optional[int] = None
    requestedQty: int
    shippedQty: int
    receivedQty: int
    damagedQty: int
    pendingQty: Optional[int] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    status: str
    remarks: Optional[str] = None
    createdAt: datetime

    # Computed
    skuCode: Optional[str] = None
    skuName: Optional[str] = None
    sourceBinCode: Optional[str] = None
    destinationBinCode: Optional[str] = None

    @field_validator("pendingQty", mode="before")
    @classmethod
    def calc_pending(cls, v, info):
        if v is None and info.data:
            requested = info.data.get("requestedQty", 0)
            received = info.data.get("receivedQty", 0)
            return requested - received
        return v


# ============================================================================
# WORKFLOW SCHEMAS (camelCase for API)
# ============================================================================

class STOApproveRequest(SQLModel):
    """Request to approve an STO"""
    remarks: Optional[str] = None


class STOShipRequest(SQLModel):
    """Request to mark STO as shipped"""
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    remarks: Optional[str] = None


class STOReceiveRequest(SQLModel):
    """Request to receive STO at destination"""
    items: List["STOItemReceive"]
    vehicleNumber: Optional[str] = None
    remarks: Optional[str] = None


class STOItemReceive(SQLModel):
    """Item receive details"""
    itemId: UUID
    receivedQty: int
    damagedQty: int = 0
    destinationBinId: Optional[UUID] = None
    remarks: Optional[str] = None


# Forward references
StockTransferOrderCreate.model_rebuild()
StockTransferOrderRead.model_rebuild()
