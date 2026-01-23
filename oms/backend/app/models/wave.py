"""
Wave Models - SQLModel Implementation
Wave picking, picklists, and fulfillment workflow
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING, Any
from uuid import UUID

from pydantic import field_validator
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import WaveType, WaveStatus, PicklistStatus

if TYPE_CHECKING:
    from .company import Location, Bin
    from .sku import SKU
    from .order import Order
    from .user import User


# ============================================================================
# Database Models
# ============================================================================

class Wave(BaseModel, table=True):
    """
    Wave model - Batch picking wave for multiple orders.
    Groups orders for efficient picking workflow.
    """
    __tablename__ = "Wave"

    # Identity
    waveNo: str = Field(sa_column=Column(String, unique=True, nullable=False))
    name: Optional[str] = Field(default=None)

    # Wave configuration
    type: WaveType = Field(
        default=WaveType.BATCH_PICK,
        sa_column=Column(String, default="BATCH_PICK")
    )
    status: WaveStatus = Field(
        default=WaveStatus.DRAFT,
        sa_column=Column(String, default="DRAFT", index=True)
    )

    # Foreign Keys
    locationId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            nullable=False,
            index=True
        )
    )
    assignedToId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("User.id"),
            index=True
        )
    )
    createdById: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # Limits & filters
    maxOrders: int = Field(default=50)
    maxItems: int = Field(default=500)
    priorityFrom: Optional[int] = Field(default=None)
    priorityTo: Optional[int] = Field(default=None)
    cutoffTime: Optional[datetime] = Field(default=None)
    zones: List[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), default=[])
    )

    # Counts
    totalOrders: int = Field(default=0)
    totalItems: int = Field(default=0)
    totalUnits: int = Field(default=0)
    pickedOrders: int = Field(default=0)
    pickedItems: int = Field(default=0)
    pickedUnits: int = Field(default=0)

    # Timestamps
    plannedStartAt: Optional[datetime] = Field(default=None)
    releasedAt: Optional[datetime] = Field(default=None)
    startedAt: Optional[datetime] = Field(default=None)
    completedAt: Optional[datetime] = Field(default=None)

    # Route optimization
    optimizedRoute: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )
    estimatedTime: Optional[int] = Field(default=None)
    actualTime: Optional[int] = Field(default=None)

    # Remarks
    remarks: Optional[str] = Field(default=None)

    # Relationships
    location: Optional["Location"] = Relationship()
    assignedTo: Optional["User"] = Relationship()
    items: List["WaveItem"] = Relationship(back_populates="wave")
    orders: List["WaveOrder"] = Relationship(back_populates="wave")


class WaveItem(BaseModel, table=True):
    """
    WaveItem model - SKU picking task within a wave.
    Aggregates quantities from multiple orders for the same SKU/bin.
    """
    __tablename__ = "WaveItem"

    # Foreign Keys
    waveId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Wave.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
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
    pickedById: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True))
    )

    # Quantities
    totalQty: int = Field(default=0)
    pickedQty: int = Field(default=0)

    # Sequence & location info
    sequence: int = Field(default=0, sa_column=Column(Integer, index=True))
    zoneCode: Optional[str] = Field(default=None)
    aisle: Optional[str] = Field(default=None)
    rack: Optional[str] = Field(default=None)
    level: Optional[str] = Field(default=None)

    # Timestamp
    pickedAt: Optional[datetime] = Field(default=None)

    # Relationships
    wave: Optional["Wave"] = Relationship(back_populates="items")
    sku: Optional["SKU"] = Relationship()
    bin: Optional["Bin"] = Relationship()
    distributions: List["WaveItemDistribution"] = Relationship(back_populates="waveItem")


class WaveItemDistribution(BaseModel, table=True):
    """
    WaveItemDistribution model - Maps wave item quantities to individual orders.
    Tracks how picked items are distributed to fulfilling orders.
    """
    __tablename__ = "WaveItemDistribution"

    # Foreign Keys
    waveItemId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("WaveItem.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
    orderId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            nullable=False,
            index=True
        )
    )
    orderItemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )

    # Quantity
    quantity: int = Field(default=0)

    # Relationships
    waveItem: Optional["WaveItem"] = Relationship(back_populates="distributions")


class WaveOrder(BaseModel, table=True):
    """
    WaveOrder model - Order assignment to a wave.
    Tracks order picking status within a wave.
    """
    __tablename__ = "WaveOrder"
    __table_args__ = (
        UniqueConstraint("waveId", "orderId", name="wave_order_unique"),
    )

    # Foreign Keys
    waveId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Wave.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
    orderId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Order.id"),
            nullable=False,
            index=True
        )
    )

    # Status
    sequence: int = Field(default=0)
    status: str = Field(default="PENDING")

    # Timestamps
    startedAt: Optional[datetime] = Field(default=None)
    completedAt: Optional[datetime] = Field(default=None)

    # Relationships
    wave: Optional["Wave"] = Relationship(back_populates="orders")
    order: Optional["Order"] = Relationship()


class Picklist(BaseModel, table=True):
    """
    Picklist model - Individual order picking task.
    Used for single-order picking workflow.
    """
    __tablename__ = "Picklist"

    # Identity
    picklistNo: str = Field(sa_column=Column(String, unique=True, nullable=False))

    # Status
    status: PicklistStatus = Field(
        default=PicklistStatus.PENDING,
        sa_column=Column(String, default="PENDING", index=True)
    )

    # Foreign Keys
    orderId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Order.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
    assignedToId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("User.id"),
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

    # Timestamps
    startedAt: Optional[datetime] = Field(default=None)
    completedAt: Optional[datetime] = Field(default=None)

    # Relationships
    order: Optional["Order"] = Relationship()
    assignedTo: Optional["User"] = Relationship()
    items: List["PicklistItem"] = Relationship(back_populates="picklist")


class PicklistItem(BaseModel, table=True):
    """
    PicklistItem model - Line item in a picklist.
    Individual SKU pick task from specific bin.
    """
    __tablename__ = "PicklistItem"

    # Foreign Keys
    picklistId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Picklist.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
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
            nullable=False
        )
    )

    # Quantities
    requiredQty: int = Field(default=0)
    pickedQty: int = Field(default=0)

    # Batch/Serial
    batchNo: Optional[str] = Field(default=None)
    serialNumbers: List[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), default=[])
    )

    # Timestamp
    pickedAt: Optional[datetime] = Field(default=None)

    # Relationships
    picklist: Optional["Picklist"] = Relationship(back_populates="items")
    sku: Optional["SKU"] = Relationship()
    bin: Optional["Bin"] = Relationship()


# ============================================================================
# Request/Response Schemas
# ============================================================================

# --- Wave Schemas ---

class WaveCreate(CreateBase):
    """Schema for creating a wave"""
    waveNo: Optional[str] = None  # Auto-generated if not provided
    name: Optional[str] = None
    type: WaveType = WaveType.BATCH_PICK
    locationId: Optional[UUID] = None  # Uses user's default location if not provided
    createdById: Optional[UUID] = None  # Set from current user if not provided
    maxOrders: int = 50
    maxItems: int = 500
    priorityFrom: Optional[int] = None
    priorityTo: Optional[int] = None
    cutoffTime: Optional[datetime] = None
    zones: List[str] = []
    plannedStartAt: Optional[datetime] = None
    remarks: Optional[str] = None


class WaveUpdate(UpdateBase):
    """Schema for updating a wave"""
    name: Optional[str] = None
    status: Optional[WaveStatus] = None
    assignedToId: Optional[UUID] = None
    maxOrders: Optional[int] = None
    maxItems: Optional[int] = None
    priorityFrom: Optional[int] = None
    priorityTo: Optional[int] = None
    cutoffTime: Optional[datetime] = None
    zones: Optional[List[str]] = None
    plannedStartAt: Optional[datetime] = None
    releasedAt: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    optimizedRoute: Optional[dict] = None
    estimatedTime: Optional[int] = None
    actualTime: Optional[int] = None
    remarks: Optional[str] = None


class WaveResponse(ResponseBase):
    """Schema for wave API responses"""
    id: UUID
    waveNo: str
    name: Optional[str] = None
    type: WaveType
    status: WaveStatus
    locationId: UUID
    assignedToId: Optional[UUID] = None
    createdById: UUID
    companyId: UUID
    maxOrders: int = 50
    maxItems: int = 500
    priorityFrom: Optional[int] = None
    priorityTo: Optional[int] = None
    cutoffTime: Optional[datetime] = None
    zones: List[str] = []
    totalOrders: int = 0
    totalItems: int = 0
    totalUnits: int = 0
    pickedOrders: int = 0
    pickedItems: int = 0
    pickedUnits: int = 0
    plannedStartAt: Optional[datetime] = None
    releasedAt: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    optimizedRoute: Optional[dict] = None
    estimatedTime: Optional[int] = None
    actualTime: Optional[int] = None
    remarks: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    @field_validator('zones', mode='before')
    @classmethod
    def zones_default(cls, v: Any) -> List[str]:
        """Convert None to empty list for zones"""
        if v is None:
            return []
        return v

    @field_validator('maxOrders', 'maxItems', 'totalOrders', 'totalItems', 'totalUnits',
                     'pickedOrders', 'pickedItems', 'pickedUnits', mode='before')
    @classmethod
    def int_defaults(cls, v: Any) -> int:
        """Convert None to 0 for integer fields"""
        if v is None:
            return 0
        return v


class WaveBrief(ResponseBase):
    """Brief wave info for lists"""
    id: UUID
    waveNo: str
    name: Optional[str] = None
    type: WaveType
    status: WaveStatus
    totalOrders: int
    totalItems: int
    pickedOrders: int


# --- WaveItem Schemas ---

class WaveItemCreate(CreateBase):
    """Schema for creating wave item"""
    waveId: UUID
    skuId: UUID
    binId: UUID
    totalQty: int
    sequence: int = 0
    zoneCode: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None


class WaveItemUpdate(UpdateBase):
    """Schema for updating wave item"""
    pickedQty: Optional[int] = None
    sequence: Optional[int] = None
    pickedAt: Optional[datetime] = None
    pickedById: Optional[UUID] = None


class WaveItemResponse(ResponseBase):
    """Schema for wave item API responses"""
    id: UUID
    waveId: UUID
    skuId: UUID
    binId: UUID
    pickedById: Optional[UUID] = None
    totalQty: int
    pickedQty: int
    sequence: int
    zoneCode: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None
    pickedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


# --- WaveOrder Schemas ---

class WaveOrderCreate(CreateBase):
    """Schema for adding order to wave"""
    waveId: UUID
    orderId: UUID
    sequence: int = 0


class WaveOrderUpdate(UpdateBase):
    """Schema for updating wave order"""
    sequence: Optional[int] = None
    status: Optional[str] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None


class WaveOrderResponse(ResponseBase):
    """Schema for wave order API responses"""
    id: UUID
    waveId: UUID
    orderId: UUID
    sequence: int
    status: str
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


# --- Picklist Schemas ---

class PicklistCreate(CreateBase):
    """Schema for creating picklist"""
    picklistNo: str
    orderId: UUID
    assignedToId: Optional[UUID] = None


class PicklistUpdate(UpdateBase):
    """Schema for updating picklist"""
    status: Optional[PicklistStatus] = None
    assignedToId: Optional[UUID] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None


class PicklistResponse(ResponseBase):
    """Schema for picklist API responses"""
    id: UUID
    picklistNo: str
    status: PicklistStatus
    orderId: UUID
    assignedToId: Optional[UUID] = None
    companyId: UUID
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


# --- PicklistItem Schemas ---

class PicklistItemCreate(CreateBase):
    """Schema for creating picklist item"""
    picklistId: UUID
    skuId: UUID
    binId: UUID
    requiredQty: int
    batchNo: Optional[str] = None


class PicklistItemUpdate(UpdateBase):
    """Schema for updating picklist item"""
    pickedQty: Optional[int] = None
    serialNumbers: Optional[List[str]] = None
    pickedAt: Optional[datetime] = None


class PicklistItemResponse(ResponseBase):
    """Schema for picklist item API responses"""
    id: UUID
    picklistId: UUID
    skuId: UUID
    binId: UUID
    requiredQty: int
    pickedQty: int
    batchNo: Optional[str] = None
    serialNumbers: List[str] = []
    pickedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


# --- Summary Schemas ---

class WaveSummary(SQLModel):
    """Wave picking summary"""
    totalWaves: int
    draftWaves: int
    inProgressWaves: int
    completedWaves: int
    totalOrders: int
    totalItems: int
    pickRate: float


class PicklistSummary(SQLModel):
    """Picklist summary"""
    totalPicklists: int
    pendingPicklists: int
    inProgressPicklists: int
    completedPicklists: int
    avgCompletionTime: Optional[float] = None
