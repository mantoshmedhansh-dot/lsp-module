"""
Inventory Model - SQLModel Implementation
Stock quantities and batch tracking
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY, NUMERIC

from .base import BaseModel, CompanyMixin, ResponseBase, CreateBase, UpdateBase
from .enums import InventoryValuationMethod

if TYPE_CHECKING:
    from .sku import SKU
    from .company import Bin, Location


# ============================================================================
# Database Model
# ============================================================================

class Inventory(BaseModel, table=True):
    """
    Inventory model - Stock quantities at bin level.
    Tracks quantity, batch, serial numbers, and valuation.
    Note: Company filtering is done via locationId -> Location.companyId
    """
    __tablename__ = "Inventory"

    # Quantities
    quantity: int = Field(default=0)
    reservedQty: int = Field(default=0)

    # Batch tracking
    batchNo: Optional[str] = Field(default=None)
    lotNo: Optional[str] = Field(default=None)
    expiryDate: Optional[datetime] = Field(default=None)
    mfgDate: Optional[datetime] = Field(default=None)

    # Pricing
    mrp: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )
    costPrice: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )

    # Serial numbers (for serialised items)
    serialNumbers: List[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), default=[])
    )

    # Valuation
    valuationMethod: InventoryValuationMethod = Field(
        default=InventoryValuationMethod.FIFO,
        sa_column=Column(String, default="FIFO")
    )
    fifoSequence: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, index=True)
    )

    # Foreign Keys
    skuId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("SKU.id"),
            nullable=False,
            index=True
        )
    )
    binId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Bin.id"),
            nullable=False,
            index=True
        )
    )
    locationId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            nullable=False,
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

    # Relationships
    sku: Optional["SKU"] = Relationship(back_populates="inventory")
    bin: Optional["Bin"] = Relationship()
    location: Optional["Location"] = Relationship()

    @property
    def availableQty(self) -> int:
        """Available quantity (total - reserved)"""
        return self.quantity - self.reservedQty


# ============================================================================
# Request/Response Schemas
# ============================================================================

class InventoryBase(SQLModel):
    """Shared inventory fields"""
    quantity: int = 0
    reservedQty: int = 0
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    serialNumbers: List[str] = []
    valuationMethod: InventoryValuationMethod = InventoryValuationMethod.FIFO


class InventoryCreate(CreateBase):
    """Schema for creating inventory record"""
    quantity: int
    reservedQty: int = 0
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    serialNumbers: List[str] = []
    valuationMethod: InventoryValuationMethod = InventoryValuationMethod.FIFO
    skuId: UUID
    binId: UUID
    locationId: UUID
    companyId: Optional[UUID] = None  # Will be auto-filled from location if not provided


class InventoryUpdate(UpdateBase):
    """Schema for updating inventory"""
    quantity: Optional[int] = None
    reservedQty: Optional[int] = None
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    serialNumbers: Optional[List[str]] = None


class InventoryResponse(ResponseBase):
    """Schema for inventory API responses"""
    id: UUID
    quantity: int
    reservedQty: int
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[datetime] = None
    mfgDate: Optional[datetime] = None
    mrp: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    serialNumbers: Optional[List[str]] = None
    valuationMethod: Optional[InventoryValuationMethod] = None
    fifoSequence: Optional[int] = None
    skuId: UUID
    binId: UUID
    locationId: UUID
    createdAt: datetime
    updatedAt: datetime

    # Computed field
    availableQty: int = 0


class InventoryAdjustment(SQLModel):
    """Schema for inventory adjustment"""
    skuId: UUID
    binId: UUID
    locationId: UUID
    adjustmentQty: int  # Positive for add, negative for subtract
    reason: str
    batchNo: Optional[str] = None
    serialNumbers: Optional[List[str]] = None
    remarks: Optional[str] = None


class InventoryTransfer(SQLModel):
    """Schema for inventory transfer between bins"""
    skuId: UUID
    fromBinId: UUID
    toBinId: UUID
    quantity: int
    batchNo: Optional[str] = None
    serialNumbers: Optional[List[str]] = None
    remarks: Optional[str] = None


class InventorySummary(SQLModel):
    """Inventory summary by SKU"""
    skuId: UUID
    skuCode: str
    skuName: str
    totalQuantity: int
    reservedQuantity: int
    availableQuantity: int
    locationCount: int
    binCount: int
