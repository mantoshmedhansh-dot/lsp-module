"""
Finance Models: COD Reconciliation, COD Transaction, Chargebacks, Escrow, Discrepancies
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON, Text

from .base import BaseModel
from .enums import CODReconciliationStatus, CODTransactionType


# ============================================================================
# Additional Finance Enums
# ============================================================================

class SettlementStatus(str, Enum):
    """Payment settlement status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    MATCHED = "MATCHED"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED"
    UNMATCHED = "UNMATCHED"
    DISPUTED = "DISPUTED"
    COMPLETED = "COMPLETED"


class ChargebackStatus(str, Enum):
    """Chargeback status"""
    RECEIVED = "RECEIVED"
    UNDER_REVIEW = "UNDER_REVIEW"
    EVIDENCE_SUBMITTED = "EVIDENCE_SUBMITTED"
    WON = "WON"
    LOST = "LOST"
    ACCEPTED = "ACCEPTED"


class ChargebackReason(str, Enum):
    """Chargeback reason codes"""
    FRAUD = "FRAUD"
    NOT_RECEIVED = "NOT_RECEIVED"
    NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED"
    DUPLICATE = "DUPLICATE"
    CANCELLED = "CANCELLED"
    CREDIT_NOT_PROCESSED = "CREDIT_NOT_PROCESSED"
    OTHER = "OTHER"


class DiscrepancyType(str, Enum):
    """Reconciliation discrepancy types"""
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    MISSING_PAYMENT = "MISSING_PAYMENT"
    DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT"
    UNKNOWN_ORDER = "UNKNOWN_ORDER"
    TIMING_DIFFERENCE = "TIMING_DIFFERENCE"
    FEE_MISMATCH = "FEE_MISMATCH"
    OTHER = "OTHER"


class EscrowStatus(str, Enum):
    """Escrow hold status"""
    HELD = "HELD"
    PARTIAL_RELEASE = "PARTIAL_RELEASE"
    RELEASED = "RELEASED"
    FORFEITED = "FORFEITED"


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


# ============================================================================
# Payment Settlement
# ============================================================================

class PaymentSettlementBase(SQLModel):
    """Payment settlement base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    settlementNo: str = Field(max_length=50, unique=True, index=True)
    channel: str = Field(max_length=50, index=True)
    transporterId: Optional[UUID] = Field(default=None, foreign_key="Transporter.id")
    status: SettlementStatus = Field(default=SettlementStatus.PENDING, index=True)
    settlementDate: date = Field(index=True)
    periodFrom: date
    periodTo: date
    grossAmount: Decimal = Field(default=Decimal("0"))
    commissionAmount: Decimal = Field(default=Decimal("0"))
    tdsAmount: Decimal = Field(default=Decimal("0"))
    shippingDeduction: Decimal = Field(default=Decimal("0"))
    otherDeductions: Decimal = Field(default=Decimal("0"))
    netAmount: Decimal = Field(default=Decimal("0"))
    totalOrders: int = Field(default=0)
    matchedOrders: int = Field(default=0)
    unmatchedOrders: int = Field(default=0)
    bankReference: Optional[str] = Field(default=None, max_length=100)
    bankAccountNo: Optional[str] = Field(default=None, max_length=50)
    receivedAt: Optional[datetime] = None
    reconciledAt: Optional[datetime] = None
    reconciledById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    fileUrl: Optional[str] = Field(default=None, max_length=500)
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, max_length=1000)


class PaymentSettlement(PaymentSettlementBase, BaseModel, table=True):
    """Payment settlement model"""
    __tablename__ = "PaymentSettlement"


class PaymentSettlementCreate(SQLModel):
    """Schema for settlement creation"""
    channel: str
    transporterId: Optional[UUID] = None
    settlementDate: date
    periodFrom: date
    periodTo: date
    grossAmount: Decimal
    commissionAmount: Decimal = Decimal("0")
    tdsAmount: Decimal = Decimal("0")
    shippingDeduction: Decimal = Decimal("0")
    otherDeductions: Decimal = Decimal("0")
    bankReference: Optional[str] = None
    fileUrl: Optional[str] = None
    notes: Optional[str] = None


class PaymentSettlementResponse(PaymentSettlementBase):
    """Response schema for settlement"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Chargeback
# ============================================================================

class ChargebackBase(SQLModel):
    """Chargeback base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    chargebackNo: str = Field(max_length=50, unique=True, index=True)
    orderId: UUID = Field(foreign_key="Order.id", index=True)
    orderNo: str = Field(max_length=50, index=True)
    channel: str = Field(max_length=50, index=True)
    status: ChargebackStatus = Field(default=ChargebackStatus.RECEIVED, index=True)
    reason: ChargebackReason = Field(index=True)
    reasonDetail: Optional[str] = Field(default=None, max_length=500)
    chargebackAmount: Decimal
    originalAmount: Decimal
    currency: str = Field(default="INR", max_length=10)
    chargebackDate: date = Field(index=True)
    deadlineDate: Optional[date] = None
    paymentGatewayRef: Optional[str] = Field(default=None, max_length=100)
    cardLast4: Optional[str] = Field(default=None, max_length=4)
    evidenceSubmittedAt: Optional[datetime] = None
    evidenceData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    resolvedAt: Optional[datetime] = None
    resolvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    outcome: Optional[str] = Field(default=None, max_length=50)
    outcomeAmount: Optional[Decimal] = None
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class Chargeback(ChargebackBase, BaseModel, table=True):
    """Chargeback model"""
    __tablename__ = "Chargeback"


class ChargebackCreate(SQLModel):
    """Schema for chargeback creation"""
    orderId: UUID
    orderNo: str
    channel: str
    reason: ChargebackReason
    reasonDetail: Optional[str] = None
    chargebackAmount: Decimal
    originalAmount: Decimal
    chargebackDate: date
    deadlineDate: Optional[date] = None
    paymentGatewayRef: Optional[str] = None
    notes: Optional[str] = None


class ChargebackUpdate(SQLModel):
    """Schema for chargeback update"""
    status: Optional[ChargebackStatus] = None
    evidenceData: Optional[dict] = None
    notes: Optional[str] = None


class ChargebackResponse(ChargebackBase):
    """Response schema for chargeback"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Escrow Hold
# ============================================================================

class EscrowHoldBase(SQLModel):
    """Escrow hold base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    escrowNo: str = Field(max_length=50, unique=True, index=True)
    channel: str = Field(max_length=50, index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    orderNo: Optional[str] = Field(default=None, max_length=50)
    status: EscrowStatus = Field(default=EscrowStatus.HELD, index=True)
    holdReason: str = Field(max_length=100)
    holdAmount: Decimal
    releasedAmount: Decimal = Field(default=Decimal("0"))
    currency: str = Field(default="INR", max_length=10)
    holdDate: date = Field(index=True)
    expectedReleaseDate: Optional[date] = None
    actualReleaseDate: Optional[date] = None
    releasedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    partialReleases: Optional[List[dict]] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, max_length=1000)


class EscrowHold(EscrowHoldBase, BaseModel, table=True):
    """Escrow hold model"""
    __tablename__ = "EscrowHold"


class EscrowHoldCreate(SQLModel):
    """Schema for escrow creation"""
    channel: str
    orderId: Optional[UUID] = None
    orderNo: Optional[str] = None
    holdReason: str
    holdAmount: Decimal
    holdDate: date
    expectedReleaseDate: Optional[date] = None
    notes: Optional[str] = None


class EscrowHoldResponse(EscrowHoldBase):
    """Response schema for escrow"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Reconciliation Discrepancy
# ============================================================================

class ReconciliationDiscrepancyBase(SQLModel):
    """Reconciliation discrepancy base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    settlementId: Optional[UUID] = Field(default=None, foreign_key="PaymentSettlement.id", index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    orderNo: Optional[str] = Field(default=None, max_length=50, index=True)
    discrepancyType: DiscrepancyType = Field(index=True)
    channel: str = Field(max_length=50, index=True)
    expectedAmount: Decimal
    actualAmount: Decimal
    differenceAmount: Decimal
    currency: str = Field(default="INR", max_length=10)
    detectedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    isResolved: bool = Field(default=False, index=True)
    resolvedAt: Optional[datetime] = None
    resolvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    resolution: Optional[str] = Field(default=None, max_length=500)
    systemData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    settlementData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, max_length=1000)


class ReconciliationDiscrepancy(ReconciliationDiscrepancyBase, BaseModel, table=True):
    """Reconciliation discrepancy model"""
    __tablename__ = "ReconciliationDiscrepancy"


class ReconciliationDiscrepancyCreate(SQLModel):
    """Schema for discrepancy creation"""
    settlementId: Optional[UUID] = None
    orderId: Optional[UUID] = None
    orderNo: Optional[str] = None
    discrepancyType: DiscrepancyType
    channel: str
    expectedAmount: Decimal
    actualAmount: Decimal
    systemData: Optional[dict] = None
    settlementData: Optional[dict] = None
    notes: Optional[str] = None


class ReconciliationDiscrepancyResponse(ReconciliationDiscrepancyBase):
    """Response schema for discrepancy"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Request/Response Schemas for Finance Operations
# ============================================================================

class SettlementImportRequest(SQLModel):
    """Request for importing settlement file"""
    channel: str
    fileUrl: str
    periodFrom: date
    periodTo: date


class MatchPaymentRequest(SQLModel):
    """Request for matching payments"""
    settlementId: UUID
    autoMatch: bool = True


class MatchPaymentResponse(SQLModel):
    """Response for match payment"""
    settlementId: UUID
    totalOrders: int
    matchedOrders: int
    unmatchedOrders: int
    discrepanciesFound: int


class ResolveDiscrepancyRequest(SQLModel):
    """Request to resolve discrepancy"""
    resolution: str
    adjustmentAmount: Optional[Decimal] = None
    notes: Optional[str] = None


class ReconciliationReportResponse(SQLModel):
    """Response for reconciliation report"""
    periodFrom: date
    periodTo: date
    totalSettlements: int
    totalGrossAmount: Decimal
    totalNetAmount: Decimal
    totalDiscrepancies: int
    unresolvedDiscrepancies: int
    discrepancyAmount: Decimal
    chargebackCount: int
    chargebackAmount: Decimal
    escrowHeld: Decimal
