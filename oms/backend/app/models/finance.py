"""
Finance Models: COD Reconciliation, COD Transaction
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship

from .base import BaseModel
from .enums import CODReconciliationStatus, CODTransactionType


# ============================================================================
# COD Reconciliation
# ============================================================================

class CODReconciliationBase(SQLModel):
    """COD Reconciliation base fields"""
    reconciliationNo: str = Field(unique=True)
    status: CODReconciliationStatus = Field(default=CODReconciliationStatus.PENDING, index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    transporterId: UUID = Field(foreign_key="Transporter.id", index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    reconciliationDate: datetime
    periodFrom: datetime
    periodTo: datetime
    expectedAmount: Decimal = Field(default=Decimal("0"))
    collectedAmount: Decimal = Field(default=Decimal("0"))
    remittedAmount: Decimal = Field(default=Decimal("0"))
    variance: Decimal = Field(default=Decimal("0"))
    totalOrders: int = Field(default=0)
    deliveredOrders: int = Field(default=0)
    pendingOrders: int = Field(default=0)
    remarks: Optional[str] = None
    approvedAt: Optional[datetime] = None
    approvedBy: Optional[UUID] = Field(default=None, foreign_key="User.id")


class CODReconciliation(CODReconciliationBase, BaseModel, table=True):
    """COD Reconciliation model"""
    __tablename__ = "CODReconciliation"

    # Relationships
    transactions: List["CODTransaction"] = Relationship(back_populates="reconciliation")


class CODReconciliationCreate(SQLModel):
    """COD Reconciliation creation schema"""
    locationId: UUID
    transporterId: UUID
    periodFrom: datetime
    periodTo: datetime
    remarks: Optional[str] = None


class CODReconciliationUpdate(SQLModel):
    """COD Reconciliation update schema"""
    status: Optional[CODReconciliationStatus] = None
    collectedAmount: Optional[Decimal] = None
    remittedAmount: Optional[Decimal] = None
    remarks: Optional[str] = None


class CODReconciliationResponse(CODReconciliationBase):
    """COD Reconciliation response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class CODReconciliationSummary(SQLModel):
    """COD Reconciliation summary"""
    pending: int = 0
    inProgress: int = 0
    reconciled: int = 0
    disputed: int = 0
    totalExpected: Decimal = Decimal("0")
    totalCollected: Decimal = Decimal("0")
    totalVariance: Decimal = Decimal("0")


# ============================================================================
# COD Transaction
# ============================================================================

class CODTransactionBase(SQLModel):
    """COD Transaction base fields"""
    transactionNo: str = Field(unique=True)
    type: CODTransactionType = Field(index=True)
    reconciliationId: Optional[UUID] = Field(default=None, foreign_key="CODReconciliation.id", index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id", index=True)
    deliveryId: Optional[UUID] = Field(default=None, foreign_key="Delivery.id")
    awbNo: Optional[str] = None
    amount: Decimal
    paymentMode: Optional[str] = None
    paymentRef: Optional[str] = None
    paymentDate: Optional[datetime] = None
    remarks: Optional[str] = None
    transactionDate: datetime


class CODTransaction(CODTransactionBase, BaseModel, table=True):
    """COD Transaction model"""
    __tablename__ = "CODTransaction"

    # Relationships
    reconciliation: Optional["CODReconciliation"] = Relationship(back_populates="transactions")


class CODTransactionCreate(SQLModel):
    """COD Transaction creation schema"""
    type: CODTransactionType
    reconciliationId: Optional[UUID] = None
    orderId: Optional[UUID] = None
    deliveryId: Optional[UUID] = None
    awbNo: Optional[str] = None
    amount: Decimal
    paymentMode: Optional[str] = None
    paymentRef: Optional[str] = None
    paymentDate: Optional[datetime] = None
    remarks: Optional[str] = None


class CODTransactionResponse(CODTransactionBase):
    """COD Transaction response schema"""
    id: UUID
    createdAt: datetime
