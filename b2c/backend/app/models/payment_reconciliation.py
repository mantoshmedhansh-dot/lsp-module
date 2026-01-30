"""
Payment Reconciliation Models
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class SettlementStatus(str, Enum):
    """Settlement status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    MATCHED = "MATCHED"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED"
    RECONCILED = "RECONCILED"
    DISPUTED = "DISPUTED"


class CODStatus(str, Enum):
    """COD remittance status"""
    COLLECTED = "COLLECTED"
    PENDING_REMITTANCE = "PENDING_REMITTANCE"
    REMITTED = "REMITTED"
    PARTIALLY_REMITTED = "PARTIALLY_REMITTED"
    DISPUTED = "DISPUTED"


class ChargebackStatus(str, Enum):
    """Chargeback status"""
    INITIATED = "INITIATED"
    PENDING_RESPONSE = "PENDING_RESPONSE"
    RESPONDED = "RESPONDED"
    WON = "WON"
    LOST = "LOST"
    ACCEPTED = "ACCEPTED"


class ChargebackReason(str, Enum):
    """Chargeback reason codes"""
    PRODUCT_NOT_RECEIVED = "PRODUCT_NOT_RECEIVED"
    PRODUCT_NOT_AS_DESCRIBED = "PRODUCT_NOT_AS_DESCRIBED"
    UNAUTHORIZED_TRANSACTION = "UNAUTHORIZED_TRANSACTION"
    DUPLICATE_CHARGE = "DUPLICATE_CHARGE"
    REFUND_NOT_PROCESSED = "REFUND_NOT_PROCESSED"
    OTHER = "OTHER"


class DiscrepancyType(str, Enum):
    """Discrepancy types"""
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    MISSING_PAYMENT = "MISSING_PAYMENT"
    DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT"
    FEE_DISCREPANCY = "FEE_DISCREPANCY"
    TIMING_DIFFERENCE = "TIMING_DIFFERENCE"


class EscrowStatus(str, Enum):
    """Escrow status"""
    HELD = "HELD"
    RELEASED = "RELEASED"
    PARTIALLY_RELEASED = "PARTIALLY_RELEASED"
    FORFEITED = "FORFEITED"


# Database Models
class PaymentSettlement(BaseModel, table=True):
    """Settlement batches"""
    __tablename__ = "payment_settlements"

    settlementId: str = Field(max_length=100, unique=True, index=True)
    paymentGateway: str = Field(max_length=50, index=True)
    marketplace: Optional[str] = Field(default=None, max_length=50, index=True)
    status: SettlementStatus = Field(default=SettlementStatus.PENDING, index=True)
    settlementDate: datetime = Field(index=True)
    periodStart: datetime
    periodEnd: datetime
    totalAmount: float = Field(default=0.0)
    totalOrders: int = Field(default=0)
    matchedAmount: float = Field(default=0.0)
    matchedOrders: int = Field(default=0)
    unmatchedAmount: float = Field(default=0.0)
    unmatchedOrders: int = Field(default=0)
    feeAmount: float = Field(default=0.0)
    taxAmount: float = Field(default=0.0)
    netAmount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    bankReference: Optional[str] = Field(default=None, max_length=100)
    importedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reconciledAt: Optional[datetime] = Field(default=None)
    reconciledBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class CODRemittance(BaseModel, table=True):
    """COD collection tracking"""
    __tablename__ = "cod_remittances"

    remittanceId: str = Field(max_length=100, unique=True, index=True)
    courierPartner: str = Field(max_length=50, index=True)
    status: CODStatus = Field(default=CODStatus.COLLECTED, index=True)
    collectionDate: datetime = Field(index=True)
    remittanceDate: Optional[datetime] = Field(default=None)
    totalCollected: float = Field(default=0.0)
    totalOrders: int = Field(default=0)
    remittedAmount: float = Field(default=0.0)
    pendingAmount: float = Field(default=0.0)
    deductions: float = Field(default=0.0)
    deductionDetails: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    currency: str = Field(default="INR", max_length=3)
    bankReference: Optional[str] = Field(default=None, max_length=100)
    orderIds: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class Chargeback(BaseModel, table=True):
    """Chargeback management"""
    __tablename__ = "chargebacks"

    chargebackId: str = Field(max_length=100, unique=True, index=True)
    orderId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    orderNumber: str = Field(max_length=50, index=True)
    transactionId: str = Field(max_length=100, index=True)
    paymentGateway: str = Field(max_length=50)
    status: ChargebackStatus = Field(default=ChargebackStatus.INITIATED, index=True)
    reason: ChargebackReason = Field(index=True)
    reasonDetails: Optional[str] = Field(default=None, max_length=500)
    amount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    initiatedDate: datetime = Field(index=True)
    responseDeadline: Optional[datetime] = Field(default=None)
    respondedAt: Optional[datetime] = Field(default=None)
    resolvedAt: Optional[datetime] = Field(default=None)
    resolution: Optional[str] = Field(default=None, max_length=50)
    evidence: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class EscrowHold(BaseModel, table=True):
    """Escrow tracking"""
    __tablename__ = "escrow_holds"

    escrowId: str = Field(max_length=100, unique=True, index=True)
    orderId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    orderNumber: str = Field(max_length=50, index=True)
    marketplace: str = Field(max_length=50, index=True)
    status: EscrowStatus = Field(default=EscrowStatus.HELD, index=True)
    holdAmount: float = Field(default=0.0)
    releasedAmount: float = Field(default=0.0)
    forfeitedAmount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    holdDate: datetime = Field(index=True)
    expectedReleaseDate: Optional[datetime] = Field(default=None)
    actualReleaseDate: Optional[datetime] = Field(default=None)
    holdReason: Optional[str] = Field(default=None, max_length=255)
    releaseConditions: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class ReconciliationDiscrepancy(BaseModel, table=True):
    """Mismatches tracking"""
    __tablename__ = "reconciliation_discrepancies"

    settlementId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    orderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    orderNumber: Optional[str] = Field(default=None, max_length=50)
    discrepancyType: DiscrepancyType = Field(index=True)
    expectedAmount: float = Field(default=0.0)
    actualAmount: float = Field(default=0.0)
    differenceAmount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    status: str = Field(default="OPEN", max_length=20, index=True)
    detectedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolvedAt: Optional[datetime] = Field(default=None)
    resolvedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    resolution: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


# Request/Response Schemas
class SettlementImportRequest(SQLModel):
    """Request to import settlement file"""
    paymentGateway: str
    marketplace: Optional[str] = None
    settlementDate: datetime
    periodStart: datetime
    periodEnd: datetime
    fileData: Optional[dict] = None


class SettlementResponse(SQLModel):
    """Response for settlement"""
    id: UUID
    settlementId: str
    paymentGateway: str
    marketplace: Optional[str]
    status: SettlementStatus
    settlementDate: datetime
    totalAmount: float
    totalOrders: int
    matchedAmount: float
    unmatchedAmount: float
    netAmount: float


class CODRemittanceResponse(SQLModel):
    """Response for COD remittance"""
    id: UUID
    remittanceId: str
    courierPartner: str
    status: CODStatus
    collectionDate: datetime
    totalCollected: float
    remittedAmount: float
    pendingAmount: float


class ChargebackResponse(SQLModel):
    """Response for chargeback"""
    id: UUID
    chargebackId: str
    orderId: UUID
    orderNumber: str
    status: ChargebackStatus
    reason: ChargebackReason
    amount: float
    initiatedDate: datetime
    responseDeadline: Optional[datetime]


class DiscrepancyResponse(SQLModel):
    """Response for discrepancy"""
    id: UUID
    settlementId: UUID
    orderId: Optional[UUID]
    orderNumber: Optional[str]
    discrepancyType: DiscrepancyType
    expectedAmount: float
    actualAmount: float
    differenceAmount: float
    status: str
    detectedAt: datetime


class MatchPaymentRequest(SQLModel):
    """Request to match payments"""
    settlementId: UUID
    autoMatch: bool = True
    tolerancePercentage: float = 1.0


class MatchPaymentResponse(SQLModel):
    """Response for payment matching"""
    settlementId: UUID
    totalProcessed: int
    matched: int
    unmatched: int
    discrepancies: int


class ResolveDiscrepancyRequest(SQLModel):
    """Request to resolve discrepancy"""
    resolution: str
    notes: Optional[str] = None


class ReconciliationReportResponse(SQLModel):
    """Response for reconciliation report"""
    periodStart: datetime
    periodEnd: datetime
    totalSettlements: int
    totalAmount: float
    matchedAmount: float
    unmatchedAmount: float
    openDiscrepancies: int
    resolvedDiscrepancies: int
    chargebacks: int
    chargebackAmount: float
