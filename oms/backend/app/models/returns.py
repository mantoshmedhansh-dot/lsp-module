"""
Return Models - SQLModel Implementation
Customer returns and RTO processing
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, NUMERIC

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import ReturnType, ReturnStatus, QCStatus

if TYPE_CHECKING:
    from .order import Order
    from .sku import SKU


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
    action: Optional[str] = Field(default=None)

    # Relationships
    return_: Optional["Return"] = Relationship(back_populates="items")
    sku: Optional["SKU"] = Relationship()


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
