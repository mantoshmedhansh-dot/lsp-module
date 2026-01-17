"""
WMS Extended Models: Cycle Count, Gate Pass, Stock Adjustment, Inventory Movement
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel
from .enums import CycleCountStatus, GatePassType, GatePassStatus


# ============================================================================
# Cycle Count
# ============================================================================

class CycleCountBase(SQLModel):
    """Cycle Count base fields"""
    cycleCountNo: str = Field(unique=True)
    status: CycleCountStatus = Field(default=CycleCountStatus.PLANNED, index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    zoneId: Optional[UUID] = Field(default=None, foreign_key="Zone.id")
    initiatedById: UUID = Field(foreign_key="User.id")
    verifiedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    scheduledDate: datetime
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    varianceFound: bool = Field(default=False)
    varianceValue: Optional[Decimal] = None
    remarks: Optional[str] = None


class CycleCount(CycleCountBase, BaseModel, table=True):
    """Cycle Count model"""
    __tablename__ = "CycleCount"

    # Relationships
    items: List["CycleCountItem"] = Relationship(back_populates="cycleCount")


class CycleCountCreate(SQLModel):
    """Cycle Count creation schema"""
    locationId: UUID
    zoneId: Optional[UUID] = None
    scheduledDate: datetime
    remarks: Optional[str] = None


class CycleCountUpdate(SQLModel):
    """Cycle Count update schema"""
    status: Optional[CycleCountStatus] = None
    scheduledDate: Optional[datetime] = None
    remarks: Optional[str] = None


class CycleCountResponse(CycleCountBase):
    """Cycle Count response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    items: Optional[List["CycleCountItemResponse"]] = None


# ============================================================================
# Cycle Count Item
# ============================================================================

class CycleCountItemBase(SQLModel):
    """Cycle Count Item base fields"""
    cycleCountId: UUID = Field(foreign_key="CycleCount.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    binId: UUID = Field(foreign_key="Bin.id", index=True)
    batchNo: Optional[str] = None
    expectedQty: int = Field(default=0)
    countedQty: int = Field(default=0)
    varianceQty: int = Field(default=0)
    status: str = Field(default="PENDING")
    countedAt: Optional[datetime] = None
    countedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    remarks: Optional[str] = None


class CycleCountItem(CycleCountItemBase, BaseModel, table=True):
    """Cycle Count Item model"""
    __tablename__ = "CycleCountItem"

    # Relationships
    cycleCount: Optional["CycleCount"] = Relationship(back_populates="items")


class CycleCountItemCreate(SQLModel):
    """Cycle Count Item creation schema"""
    skuId: UUID
    binId: UUID
    batchNo: Optional[str] = None
    expectedQty: int


class CycleCountItemUpdate(SQLModel):
    """Cycle Count Item update schema"""
    countedQty: Optional[int] = None
    remarks: Optional[str] = None


class CycleCountItemResponse(CycleCountItemBase):
    """Cycle Count Item response schema"""
    id: UUID


# ============================================================================
# Gate Pass
# ============================================================================

class GatePassBase(SQLModel):
    """Gate Pass base fields"""
    gatePassNo: str = Field(unique=True)
    type: GatePassType = Field(index=True)
    status: GatePassStatus = Field(default=GatePassStatus.OPEN, index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    visitorName: Optional[str] = None
    visitorPhone: Optional[str] = None
    visitorIdType: Optional[str] = None
    visitorIdNo: Optional[str] = None
    companyName: Optional[str] = None
    purpose: Optional[str] = None
    transporterId: Optional[UUID] = Field(default=None, foreign_key="Transporter.id")
    awbNo: Optional[str] = None
    poNo: Optional[str] = None
    invoiceNo: Optional[str] = None
    entryTime: Optional[datetime] = None
    exitTime: Optional[datetime] = None
    expectedDuration: Optional[int] = None
    vehicleNumber: Optional[str] = None
    vehicleType: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    sealNumber: Optional[str] = None
    verifiedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    verifiedAt: Optional[datetime] = None
    securityRemarks: Optional[str] = None
    photoUrl: Optional[str] = None


class GatePass(GatePassBase, BaseModel, table=True):
    """Gate Pass model"""
    __tablename__ = "GatePass"

    # Relationships
    items: List["GatePassItem"] = Relationship(back_populates="gatePass")


class GatePassCreate(SQLModel):
    """Gate Pass creation schema"""
    type: GatePassType
    locationId: UUID
    visitorName: Optional[str] = None
    visitorPhone: Optional[str] = None
    visitorIdType: Optional[str] = None
    visitorIdNo: Optional[str] = None
    companyName: Optional[str] = None
    purpose: Optional[str] = None
    transporterId: Optional[UUID] = None
    vehicleNumber: Optional[str] = None
    vehicleType: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None


class GatePassUpdate(SQLModel):
    """Gate Pass update schema"""
    status: Optional[GatePassStatus] = None
    exitTime: Optional[datetime] = None
    sealNumber: Optional[str] = None
    securityRemarks: Optional[str] = None
    photoUrl: Optional[str] = None


class GatePassResponse(GatePassBase):
    """Gate Pass response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    items: Optional[List["GatePassItemResponse"]] = None


# ============================================================================
# Gate Pass Item
# ============================================================================

class GatePassItemBase(SQLModel):
    """Gate Pass Item base fields"""
    gatePassId: UUID = Field(foreign_key="GatePass.id", index=True)
    skuId: Optional[UUID] = Field(default=None, foreign_key="SKU.id")
    description: Optional[str] = None
    quantity: int = Field(default=0)
    remarks: Optional[str] = None


class GatePassItem(GatePassItemBase, BaseModel, table=True):
    """Gate Pass Item model"""
    __tablename__ = "GatePassItem"

    # Relationships
    gatePass: Optional["GatePass"] = Relationship(back_populates="items")


class GatePassItemCreate(SQLModel):
    """Gate Pass Item creation schema"""
    skuId: Optional[UUID] = None
    description: Optional[str] = None
    quantity: int
    remarks: Optional[str] = None


class GatePassItemResponse(GatePassItemBase):
    """Gate Pass Item response schema"""
    id: UUID


# ============================================================================
# Stock Adjustment
# ============================================================================

class StockAdjustmentBase(SQLModel):
    """Stock Adjustment base fields"""
    adjustmentNo: str = Field(unique=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    reason: str = Field(index=True)
    status: str = Field(default="PENDING", index=True)
    remarks: Optional[str] = None
    approvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    approvedAt: Optional[datetime] = None
    createdById: UUID = Field(foreign_key="User.id")


class StockAdjustment(StockAdjustmentBase, BaseModel, table=True):
    """Stock Adjustment model"""
    __tablename__ = "StockAdjustment"

    # Relationships
    items: List["StockAdjustmentItem"] = Relationship(back_populates="adjustment")


class StockAdjustmentCreate(SQLModel):
    """Stock Adjustment creation schema"""
    locationId: UUID
    reason: str
    remarks: Optional[str] = None
    items: Optional[List["StockAdjustmentItemCreate"]] = None


class StockAdjustmentUpdate(SQLModel):
    """Stock Adjustment update schema"""
    status: Optional[str] = None
    remarks: Optional[str] = None


class StockAdjustmentResponse(StockAdjustmentBase):
    """Stock Adjustment response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    items: Optional[List["StockAdjustmentItemResponse"]] = None


# ============================================================================
# Stock Adjustment Item
# ============================================================================

class StockAdjustmentItemBase(SQLModel):
    """Stock Adjustment Item base fields"""
    adjustmentId: UUID = Field(foreign_key="StockAdjustment.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    binId: UUID = Field(foreign_key="Bin.id", index=True)
    batchNo: Optional[str] = None
    quantityBefore: int = Field(default=0)
    quantityChange: int = Field(default=0)
    quantityAfter: int = Field(default=0)


class StockAdjustmentItem(StockAdjustmentItemBase, BaseModel, table=True):
    """Stock Adjustment Item model"""
    __tablename__ = "StockAdjustmentItem"

    # Relationships
    adjustment: Optional["StockAdjustment"] = Relationship(back_populates="items")


class StockAdjustmentItemCreate(SQLModel):
    """Stock Adjustment Item creation schema"""
    skuId: UUID
    binId: UUID
    batchNo: Optional[str] = None
    quantityChange: int


class StockAdjustmentItemResponse(StockAdjustmentItemBase):
    """Stock Adjustment Item response schema"""
    id: UUID


# ============================================================================
# Inventory Movement
# ============================================================================

class InventoryMovementBase(SQLModel):
    """Inventory Movement base fields"""
    movementNo: str = Field(unique=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    fromBinId: Optional[UUID] = Field(default=None, foreign_key="Bin.id")
    toBinId: Optional[UUID] = Field(default=None, foreign_key="Bin.id")
    movementType: str = Field(index=True)  # INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT
    referenceType: Optional[str] = None
    referenceId: Optional[UUID] = None
    quantity: int
    batchNo: Optional[str] = None
    serialNumbers: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    performedById: UUID = Field(foreign_key="User.id")
    performedAt: datetime
    remarks: Optional[str] = None


class InventoryMovement(InventoryMovementBase, BaseModel, table=True):
    """Inventory Movement model for audit trail"""
    __tablename__ = "InventoryMovement"


class InventoryMovementCreate(SQLModel):
    """Inventory Movement creation schema"""
    skuId: UUID
    locationId: UUID
    fromBinId: Optional[UUID] = None
    toBinId: Optional[UUID] = None
    movementType: str
    referenceType: Optional[str] = None
    referenceId: Optional[UUID] = None
    quantity: int
    batchNo: Optional[str] = None
    serialNumbers: Optional[List[str]] = None
    remarks: Optional[str] = None


class InventoryMovementResponse(InventoryMovementBase):
    """Inventory Movement response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Virtual Inventory
# ============================================================================

class VirtualInventoryBase(SQLModel):
    """Virtual Inventory base fields"""
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    channel: Optional[str] = None
    type: str = Field(index=True)  # CHANNEL_RESERVE, PREORDER, PROMOTIONAL, etc.
    quantity: int = Field(default=0)
    reservedQty: int = Field(default=0)
    allocatedQty: int = Field(default=0)
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    referenceType: Optional[str] = None
    referenceId: Optional[UUID] = None
    isActive: bool = Field(default=True)
    remarks: Optional[str] = None
    companyId: UUID = Field(foreign_key="Company.id", index=True)


class VirtualInventory(VirtualInventoryBase, BaseModel, table=True):
    """Virtual Inventory model"""
    __tablename__ = "VirtualInventory"


class VirtualInventoryCreate(SQLModel):
    """Virtual Inventory creation schema"""
    skuId: UUID
    locationId: UUID
    channel: Optional[str] = None
    type: str
    quantity: int
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    referenceType: Optional[str] = None
    referenceId: Optional[UUID] = None
    remarks: Optional[str] = None


class VirtualInventoryUpdate(SQLModel):
    """Virtual Inventory update schema"""
    quantity: Optional[int] = None
    reservedQty: Optional[int] = None
    allocatedQty: Optional[int] = None
    validTo: Optional[datetime] = None
    isActive: Optional[bool] = None
    remarks: Optional[str] = None


class VirtualInventoryResponse(VirtualInventoryBase):
    """Virtual Inventory response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
