"""
Stock Transfer Order (STO) Models

For inter-warehouse/location stock transfers.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel, Relationship


# ============================================================================
# STOCK TRANSFER ORDER
# ============================================================================

class StockTransferOrderBase(SQLModel):
    """Base fields for Stock Transfer Order"""
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
    """Create schema"""
    source_location_id: UUID
    destination_location_id: UUID
    required_by_date: Optional[datetime] = None
    priority: str = "NORMAL"
    remarks: Optional[str] = None
    items: Optional[List["STOItemCreate"]] = None


class StockTransferOrderUpdate(SQLModel):
    """Update schema"""
    status: Optional[str] = None
    required_by_date: Optional[datetime] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None


class StockTransferOrderRead(StockTransferOrderBase):
    """Read schema"""
    id: UUID
    company_id: UUID
    sto_no: str
    source_location_id: UUID
    destination_location_id: UUID
    total_items: int
    total_requested_qty: int
    total_shipped_qty: int
    total_received_qty: int
    source_gate_pass_id: Optional[UUID] = None
    destination_grn_id: Optional[UUID] = None
    requested_by: Optional[UUID] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Computed
    source_location_name: Optional[str] = None
    destination_location_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    approved_by_name: Optional[str] = None
    pending_qty: Optional[int] = None
    items: Optional[List["STOItemRead"]] = None


# ============================================================================
# STO ITEMS
# ============================================================================

class STOItemBase(SQLModel):
    """Base fields for STO Item"""
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
    """Create schema for item"""
    sku_id: UUID
    requested_qty: int
    source_bin_id: Optional[UUID] = None
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    remarks: Optional[str] = None


class STOItemUpdate(SQLModel):
    """Update schema for item"""
    requested_qty: Optional[int] = None
    shipped_qty: Optional[int] = None
    received_qty: Optional[int] = None
    damaged_qty: Optional[int] = None
    source_bin_id: Optional[UUID] = None
    destination_bin_id: Optional[UUID] = None
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class STOItemRead(STOItemBase):
    """Read schema for item"""
    id: UUID
    stock_transfer_order_id: UUID
    sku_id: UUID
    source_bin_id: Optional[UUID] = None
    destination_bin_id: Optional[UUID] = None
    source_inventory_id: Optional[UUID] = None
    fifo_sequence: Optional[int] = None
    created_at: datetime

    # Computed
    sku_code: Optional[str] = None
    sku_name: Optional[str] = None
    source_bin_code: Optional[str] = None
    destination_bin_code: Optional[str] = None
    pending_qty: Optional[int] = None


# ============================================================================
# WORKFLOW SCHEMAS
# ============================================================================

class STOApproveRequest(SQLModel):
    """Request to approve an STO"""
    remarks: Optional[str] = None


class STOShipRequest(SQLModel):
    """Request to mark STO as shipped"""
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    remarks: Optional[str] = None


class STOReceiveRequest(SQLModel):
    """Request to receive STO at destination"""
    items: List["STOItemReceive"]
    vehicle_number: Optional[str] = None
    remarks: Optional[str] = None


class STOItemReceive(SQLModel):
    """Item receive details"""
    item_id: UUID
    received_qty: int
    damaged_qty: int = 0
    destination_bin_id: Optional[UUID] = None
    remarks: Optional[str] = None


# Forward references
StockTransferOrderCreate.model_rebuild()
StockTransferOrderRead.model_rebuild()
