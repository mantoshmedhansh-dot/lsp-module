"""
Return Models - SQLModel Implementation
Customer returns and RTO processing

Phase 4: Enhanced with WMS receiving workflow integration
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, NUMERIC

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import ReturnType, ReturnStatus, QCStatus

if TYPE_CHECKING:
    from .order import Order
    from .sku import SKU
    from .location import Location
    from .goods_receipt import GoodsReceipt


# ============================================================================
# Database Models
# ============================================================================

class Return(BaseModel, table=True):
    """
    Return model - Customer returns and RTOs.
    Tracks return lifecycle from initiation to processing.
    """
    __tablename__ = "Return"

    # Identity
    returnNo: str = Field(sa_column=Column(String, unique=True, nullable=False))

    # Type & Status
    type: ReturnType = Field(sa_column=Column(String, nullable=False, index=True))
    status: ReturnStatus = Field(
        default=ReturnStatus.INITIATED,
        sa_column=Column(String, default="INITIATED", index=True)
    )

    # Foreign Keys
    orderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Order.id"),
            index=True
        )
    )
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # Tracking
    awbNo: Optional[str] = Field(default=None)
    reason: Optional[str] = Field(default=None)
    remarks: Optional[str] = Field(default=None)

    # QC
    qcStatus: Optional[QCStatus] = Field(
        default=None,
        sa_column=Column(String, index=True)
    )
    qcCompletedAt: Optional[datetime] = Field(default=None)
    qcCompletedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True))
    )
    qcRemarks: Optional[str] = Field(default=None)

    # Timestamps
    initiatedAt: datetime = Field(
        default_factory=lambda: datetime.utcnow(),
        sa_column=Column(nullable=False)
    )
    receivedAt: Optional[datetime] = Field(default=None)
    processedAt: Optional[datetime] = Field(default=None)

    # Refund
    refundAmount: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )
    refundStatus: Optional[str] = Field(default=None)

    # Phase 4: WMS Integration
    locationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            index=True
        )
    )
    goodsReceiptId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("GoodsReceipt.id")
        )
    )
    destinationZoneId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Zone.id")
        )
    )

    # Receiving details
    vehicleNumber: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    driverName: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    driverPhone: Optional[str] = Field(default=None, sa_column=Column(String(20)))
    receivedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("User.id"))
    )

    # Relationships
    order: Optional["Order"] = Relationship()
    items: List["ReturnItem"] = Relationship(back_populates="return_")


class ReturnItem(BaseModel, table=True):
    """
    ReturnItem model - Line item in a return.
    Individual SKU return with QC grading.
    """
    __tablename__ = "ReturnItem"

    # Foreign Keys
    returnId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Return.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
    skuId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("SKU.id"),
            nullable=False
        )
    )

    # Quantities
    quantity: int = Field(default=0)
    receivedQty: int = Field(default=0)
    restockedQty: int = Field(default=0)
    disposedQty: int = Field(default=0)

    # QC
    qcStatus: Optional[str] = Field(default=None)
    qcGrade: Optional[str] = Field(default=None)
    qcRemarks: Optional[str] = Field(default=None)

    # Action
    action: Optional[str] = Field(default=None)  # RESTOCK, REFURBISH, DISPOSE, RETURN_TO_VENDOR

    # Phase 4: WMS Integration - Bin references
    destinationBinId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Bin.id"))
    )
    restockedBinId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Bin.id"))
    )
    disposedBinId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Bin.id"))
    )
    restockedInventoryId: Optional[UUID] = Field(default=None)

    # Batch/Lot traceability
    batchNo: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    lotNo: Optional[str] = Field(default=None, sa_column=Column(String(100)))

    # Relationships
    return_: Optional["Return"] = Relationship(back_populates="items")
    sku: Optional["SKU"] = Relationship()


class ReturnZoneRouting(BaseModel, table=True):
    """
    QC-based zone routing configuration for returns.
    Maps QC grades to destination zones and actions.
    """
    __tablename__ = "return_zone_routing"

    companyId: UUID = Field(
        sa_column=Column(
            "company_id",
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
    locationId: UUID = Field(
        sa_column=Column(
            "location_id",
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            nullable=False,
            index=True
        )
    )
    qcGrade: str = Field(
        sa_column=Column("qc_grade", String(50), nullable=False)
    )  # A, B, C, DEFECTIVE, DAMAGED

    destinationZoneId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            "destination_zone_id",
            PG_UUID(as_uuid=True),
            ForeignKey("Zone.id")
        )
    )
    action: str = Field(
        default="RESTOCK",
        sa_column=Column(String(50), nullable=False, default="RESTOCK")
    )  # RESTOCK, REFURBISH, DISPOSE, RETURN_TO_VENDOR

    priority: int = Field(default=100)
    isActive: bool = Field(
        default=True,
        sa_column=Column("is_active", Boolean, default=True)
    )


# ============================================================================
# Request/Response Schemas
# ============================================================================

# --- Return Schemas ---

class ReturnCreate(CreateBase):
    """Schema for creating return"""
    returnNo: str
    type: ReturnType
    companyId: UUID
    orderId: Optional[UUID] = None
    locationId: Optional[UUID] = None  # Phase 4: Receiving location
    awbNo: Optional[str] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None


class ReturnUpdate(UpdateBase):
    """Schema for updating return"""
    status: Optional[ReturnStatus] = None
    awbNo: Optional[str] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None
    qcStatus: Optional[QCStatus] = None
    qcCompletedAt: Optional[datetime] = None
    qcCompletedBy: Optional[UUID] = None
    qcRemarks: Optional[str] = None
    receivedAt: Optional[datetime] = None
    processedAt: Optional[datetime] = None
    refundAmount: Optional[Decimal] = None
    refundStatus: Optional[str] = None
    # Phase 4
    locationId: Optional[UUID] = None
    destinationZoneId: Optional[UUID] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None


class ReturnResponse(ResponseBase):
    """Schema for return API responses"""
    id: UUID
    returnNo: str
    type: ReturnType
    status: ReturnStatus
    orderId: Optional[UUID] = None
    companyId: Optional[UUID] = None
    awbNo: Optional[str] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None
    qcStatus: Optional[QCStatus] = None
    qcCompletedAt: Optional[datetime] = None
    qcCompletedBy: Optional[UUID] = None
    qcRemarks: Optional[str] = None
    initiatedAt: datetime
    receivedAt: Optional[datetime] = None
    processedAt: Optional[datetime] = None
    refundAmount: Optional[Decimal] = None
    refundStatus: Optional[str] = None
    # Phase 4: WMS fields
    locationId: Optional[UUID] = None
    goodsReceiptId: Optional[UUID] = None
    destinationZoneId: Optional[UUID] = None
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    receivedBy: Optional[UUID] = None
    # Computed
    locationName: Optional[str] = None
    destinationZoneName: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class ReturnBrief(ResponseBase):
    """Brief return info for lists"""
    id: UUID
    returnNo: str
    type: ReturnType
    status: ReturnStatus
    initiatedAt: datetime


# --- ReturnItem Schemas ---

class ReturnItemCreate(CreateBase):
    """Schema for creating return item"""
    returnId: UUID
    skuId: UUID
    quantity: int


class ReturnItemUpdate(UpdateBase):
    """Schema for updating return item"""
    receivedQty: Optional[int] = None
    qcStatus: Optional[str] = None
    qcGrade: Optional[str] = None
    qcRemarks: Optional[str] = None
    action: Optional[str] = None
    restockedQty: Optional[int] = None
    disposedQty: Optional[int] = None
    # Phase 4
    destinationBinId: Optional[UUID] = None
    restockedBinId: Optional[UUID] = None
    disposedBinId: Optional[UUID] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None


class ReturnItemResponse(ResponseBase):
    """Schema for return item API responses"""
    id: UUID
    returnId: UUID
    skuId: UUID
    quantity: int
    receivedQty: int
    restockedQty: int
    disposedQty: int
    qcStatus: Optional[str] = None
    qcGrade: Optional[str] = None
    qcRemarks: Optional[str] = None
    action: Optional[str] = None
    # Phase 4
    destinationBinId: Optional[UUID] = None
    restockedBinId: Optional[UUID] = None
    disposedBinId: Optional[UUID] = None
    restockedInventoryId: Optional[UUID] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    # Computed
    skuCode: Optional[str] = None
    skuName: Optional[str] = None
    destinationBinCode: Optional[str] = None
    restockedBinCode: Optional[str] = None
    pendingQty: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime


# --- Summary Schemas ---

class ReturnSummary(SQLModel):
    """Return summary statistics"""
    totalReturns: int
    pendingReturns: int
    receivedReturns: int
    processedReturns: int
    totalRefundAmount: Decimal
    avgProcessingTime: Optional[float] = None
    byType: dict
    byStatus: dict


# ============================================================================
# Phase 4: WMS Workflow Schemas
# ============================================================================

class ReturnReceiveRequest(SQLModel):
    """Request to receive a return at warehouse"""
    locationId: UUID
    vehicleNumber: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    createGrn: bool = True  # Whether to auto-create GRN
    remarks: Optional[str] = None
    items: Optional[List["ReturnItemReceive"]] = None


class ReturnItemReceive(SQLModel):
    """Item receive details for return"""
    itemId: UUID
    receivedQty: int
    destinationBinId: Optional[UUID] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    remarks: Optional[str] = None


class ReturnQCRequest(SQLModel):
    """Request to perform QC on return items"""
    items: List["ReturnItemQC"]
    remarks: Optional[str] = None


class ReturnItemQC(SQLModel):
    """QC details for a return item"""
    itemId: UUID
    qcStatus: str  # PASSED, FAILED
    qcGrade: Optional[str] = None  # A, B, C, DEFECTIVE, DAMAGED
    action: str  # RESTOCK, REFURBISH, DISPOSE, RETURN_TO_VENDOR
    remarks: Optional[str] = None


class ReturnRestockRequest(SQLModel):
    """Request to restock QC-passed return items"""
    items: List["ReturnItemRestock"]
    remarks: Optional[str] = None


class ReturnItemRestock(SQLModel):
    """Restock details for a return item"""
    itemId: UUID
    restockQty: int
    destinationBinId: UUID
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None


class ReturnZoneRoutingCreate(SQLModel):
    """Create zone routing rule"""
    locationId: UUID
    qcGrade: str
    destinationZoneId: Optional[UUID] = None
    action: str = "RESTOCK"
    priority: int = 100


class ReturnZoneRoutingResponse(SQLModel):
    """Zone routing rule response"""
    id: UUID
    companyId: UUID
    locationId: UUID
    qcGrade: str
    destinationZoneId: Optional[UUID] = None
    action: str
    priority: int
    isActive: bool
    # Computed
    locationName: Optional[str] = None
    destinationZoneName: Optional[str] = None


# Forward references
ReturnReceiveRequest.model_rebuild()
ReturnQCRequest.model_rebuild()
ReturnRestockRequest.model_rebuild()
