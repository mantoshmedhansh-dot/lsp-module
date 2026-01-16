"""
NDR Models - SQLModel Implementation
NDR (Non-Delivery Report), Outreach, and AI Action tracking
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, Boolean, Float, JSON, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import (
    NDRReason, NDRStatus, NDRPriority, ResolutionType,
    OutreachChannel, OutreachStatus, AIActionType, AIActionStatus
)

if TYPE_CHECKING:
    from .order import Order, Delivery


# ============================================================================
# Database Models
# ============================================================================

class NDR(BaseModel, table=True):
    """
    NDR model - Non-Delivery Reports for failed delivery attempts.
    Tracks delivery failures, reasons, and resolution workflow.
    """
    __tablename__ = "NDR"

    # Identity
    ndrCode: str = Field(sa_column=Column(String, unique=True, nullable=False))

    # Foreign Keys
    deliveryId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Delivery.id"),
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
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            nullable=False,
            index=True
        )
    )

    # Carrier info
    carrierNDRCode: Optional[str] = Field(default=None)
    carrierRemark: Optional[str] = Field(default=None)

    # Attempt tracking
    attemptNumber: int = Field(default=1)
    attemptDate: datetime = Field(sa_column=Column(nullable=False))

    # Classification
    reason: NDRReason = Field(sa_column=Column(String, nullable=False))
    aiClassification: Optional[str] = Field(default=None)
    confidence: Optional[float] = Field(default=None, sa_column=Column(Float))

    # Status & Priority
    status: NDRStatus = Field(
        default=NDRStatus.OPEN,
        sa_column=Column(String, default="OPEN", index=True)
    )
    priority: NDRPriority = Field(
        default=NDRPriority.MEDIUM,
        sa_column=Column(String, default="MEDIUM", index=True)
    )
    riskScore: Optional[int] = Field(default=None)

    # Resolution
    resolutionType: Optional[ResolutionType] = Field(
        default=None,
        sa_column=Column(String)
    )
    resolvedAt: Optional[datetime] = Field(default=None)
    resolvedBy: Optional[str] = Field(default=None)
    resolutionNotes: Optional[str] = Field(default=None)

    # Reattempt scheduling
    reattemptDate: Optional[datetime] = Field(default=None)
    reattemptSlot: Optional[str] = Field(default=None)

    # Customer response
    customerResponse: Optional[str] = Field(default=None)
    preferredSlot: Optional[str] = Field(default=None)
    updatedAddress: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )
    updatedPhone: Optional[str] = Field(default=None)

    # Relationships
    delivery: Optional["Delivery"] = Relationship()
    order: Optional["Order"] = Relationship()
    outreaches: List["NDROutreach"] = Relationship(back_populates="ndr")
    aiActionLogs: List["AIActionLog"] = Relationship(back_populates="ndr")


class NDROutreach(BaseModel, table=True):
    """
    NDROutreach model - Customer communication attempts for NDR resolution.
    Tracks SMS, Email, WhatsApp, Voice outreach attempts.
    """
    __tablename__ = "NDROutreach"

    # Foreign Key
    ndrId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("NDR.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )

    # Channel & attempt
    channel: OutreachChannel = Field(sa_column=Column(String, nullable=False, index=True))
    attemptNumber: int = Field(default=1)

    # Template & content
    templateId: Optional[str] = Field(default=None)
    messageContent: Optional[str] = Field(default=None)

    # Status
    status: OutreachStatus = Field(
        default=OutreachStatus.PENDING,
        sa_column=Column(String, default="PENDING", index=True)
    )

    # Timestamps
    sentAt: Optional[datetime] = Field(default=None)
    deliveredAt: Optional[datetime] = Field(default=None)
    readAt: Optional[datetime] = Field(default=None)
    respondedAt: Optional[datetime] = Field(default=None)

    # Response
    response: Optional[str] = Field(default=None)
    sentiment: Optional[str] = Field(default=None)
    sentimentScore: Optional[float] = Field(default=None, sa_column=Column(Float))

    # Voice call specific
    callDuration: Optional[int] = Field(default=None)
    callRecordingUrl: Optional[str] = Field(default=None)
    transcription: Optional[str] = Field(default=None)

    # Error tracking
    errorCode: Optional[str] = Field(default=None)
    errorMessage: Optional[str] = Field(default=None)

    # Provider reference
    providerMessageId: Optional[str] = Field(default=None)

    # Relationships
    ndr: Optional["NDR"] = Relationship(back_populates="outreaches")


class AIActionLog(BaseModel, table=True):
    """
    AIActionLog model - Tracks AI-driven decisions and actions.
    Supports NDR classification, fraud detection, demand forecasting.
    """
    __tablename__ = "AIActionLog"

    # Action details
    actionType: AIActionType = Field(
        sa_column=Column(String, nullable=False, index=True)
    )
    entityType: str = Field(sa_column=Column(String, nullable=False))
    entityId: str = Field(sa_column=Column(String, nullable=False))

    # Foreign Keys
    ndrId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("NDR.id"))
    )
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            nullable=False,
            index=True
        )
    )

    # Decision
    decision: str = Field(default="Auto-generated")
    reasoning: str = Field(default="Automated action")
    confidence: Optional[float] = Field(default=None, sa_column=Column(Float))
    riskLevel: str = Field(default="LOW")
    impactScore: Optional[int] = Field(default=None)

    # Approval workflow
    status: AIActionStatus = Field(
        default=AIActionStatus.PENDING_APPROVAL,
        sa_column=Column(String, default="PENDING_APPROVAL")
    )
    approvalRequired: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    approvedBy: Optional[str] = Field(default=None)
    approvedAt: Optional[datetime] = Field(default=None)
    rejectionReason: Optional[str] = Field(default=None)

    # Execution
    executedAt: Optional[datetime] = Field(default=None)
    executionResult: Optional[str] = Field(default=None)
    executionError: Optional[str] = Field(default=None)

    # AI details
    recommendations: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )
    actionDetails: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )
    processingTime: Optional[int] = Field(default=None)

    # Feedback
    feedbackScore: Optional[int] = Field(default=None)
    feedbackNotes: Optional[str] = Field(default=None)

    # Relationships
    ndr: Optional["NDR"] = Relationship(back_populates="aiActionLogs")


# ============================================================================
# Request/Response Schemas
# ============================================================================

# --- NDR Schemas ---

class NDRCreate(CreateBase):
    """Schema for creating NDR"""
    ndrCode: str
    deliveryId: UUID
    orderId: UUID
    companyId: UUID
    attemptDate: datetime
    reason: NDRReason
    carrierNDRCode: Optional[str] = None
    carrierRemark: Optional[str] = None
    attemptNumber: int = 1
    status: NDRStatus = NDRStatus.OPEN
    priority: NDRPriority = NDRPriority.MEDIUM


class NDRUpdate(UpdateBase):
    """Schema for updating NDR"""
    status: Optional[NDRStatus] = None
    priority: Optional[NDRPriority] = None
    aiClassification: Optional[str] = None
    confidence: Optional[float] = None
    riskScore: Optional[int] = None
    resolutionType: Optional[ResolutionType] = None
    resolvedAt: Optional[datetime] = None
    resolvedBy: Optional[str] = None
    resolutionNotes: Optional[str] = None
    reattemptDate: Optional[datetime] = None
    reattemptSlot: Optional[str] = None
    customerResponse: Optional[str] = None
    preferredSlot: Optional[str] = None
    updatedAddress: Optional[dict] = None
    updatedPhone: Optional[str] = None


class NDRResponse(ResponseBase):
    """Schema for NDR API responses"""
    id: UUID
    ndrCode: str
    deliveryId: UUID
    orderId: UUID
    companyId: UUID
    carrierNDRCode: Optional[str] = None
    carrierRemark: Optional[str] = None
    attemptNumber: int
    attemptDate: datetime
    reason: NDRReason
    aiClassification: Optional[str] = None
    confidence: Optional[float] = None
    status: NDRStatus
    priority: NDRPriority
    riskScore: Optional[int] = None
    resolutionType: Optional[ResolutionType] = None
    resolvedAt: Optional[datetime] = None
    resolvedBy: Optional[str] = None
    resolutionNotes: Optional[str] = None
    reattemptDate: Optional[datetime] = None
    reattemptSlot: Optional[str] = None
    customerResponse: Optional[str] = None
    preferredSlot: Optional[str] = None
    updatedAddress: Optional[dict] = None
    updatedPhone: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class NDRBrief(ResponseBase):
    """Brief NDR info for lists"""
    id: UUID
    ndrCode: str
    reason: NDRReason
    status: NDRStatus
    priority: NDRPriority
    attemptNumber: int
    attemptDate: datetime


# --- NDROutreach Schemas ---

class NDROutreachCreate(CreateBase):
    """Schema for creating NDR outreach"""
    ndrId: UUID
    channel: OutreachChannel
    attemptNumber: int
    templateId: Optional[str] = None
    messageContent: Optional[str] = None


class NDROutreachUpdate(UpdateBase):
    """Schema for updating NDR outreach"""
    status: Optional[OutreachStatus] = None
    sentAt: Optional[datetime] = None
    deliveredAt: Optional[datetime] = None
    readAt: Optional[datetime] = None
    respondedAt: Optional[datetime] = None
    response: Optional[str] = None
    sentiment: Optional[str] = None
    sentimentScore: Optional[float] = None
    callDuration: Optional[int] = None
    callRecordingUrl: Optional[str] = None
    transcription: Optional[str] = None
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    providerMessageId: Optional[str] = None


class NDROutreachResponse(ResponseBase):
    """Schema for NDR outreach API responses"""
    id: UUID
    ndrId: UUID
    channel: OutreachChannel
    attemptNumber: int
    templateId: Optional[str] = None
    messageContent: Optional[str] = None
    status: OutreachStatus
    sentAt: Optional[datetime] = None
    deliveredAt: Optional[datetime] = None
    readAt: Optional[datetime] = None
    respondedAt: Optional[datetime] = None
    response: Optional[str] = None
    sentiment: Optional[str] = None
    sentimentScore: Optional[float] = None
    callDuration: Optional[int] = None
    callRecordingUrl: Optional[str] = None
    transcription: Optional[str] = None
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    providerMessageId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


# --- AIActionLog Schemas ---

class AIActionLogCreate(CreateBase):
    """Schema for creating AI action log"""
    actionType: AIActionType
    entityType: str
    entityId: str
    companyId: UUID
    ndrId: Optional[UUID] = None
    decision: str = "Auto-generated"
    reasoning: str = "Automated action"
    confidence: Optional[float] = None
    riskLevel: str = "LOW"
    impactScore: Optional[int] = None
    approvalRequired: bool = False
    recommendations: Optional[dict] = None
    actionDetails: Optional[dict] = None


class AIActionLogUpdate(UpdateBase):
    """Schema for updating AI action log"""
    status: Optional[AIActionStatus] = None
    approvedBy: Optional[str] = None
    approvedAt: Optional[datetime] = None
    rejectionReason: Optional[str] = None
    executedAt: Optional[datetime] = None
    executionResult: Optional[str] = None
    executionError: Optional[str] = None
    processingTime: Optional[int] = None
    feedbackScore: Optional[int] = None
    feedbackNotes: Optional[str] = None


class AIActionLogResponse(ResponseBase):
    """Schema for AI action log API responses"""
    id: UUID
    actionType: AIActionType
    entityType: str
    entityId: str
    ndrId: Optional[UUID] = None
    companyId: UUID
    decision: str
    reasoning: str
    confidence: Optional[float] = None
    riskLevel: str
    impactScore: Optional[int] = None
    status: AIActionStatus
    approvalRequired: bool
    approvedBy: Optional[str] = None
    approvedAt: Optional[datetime] = None
    rejectionReason: Optional[str] = None
    executedAt: Optional[datetime] = None
    executionResult: Optional[str] = None
    executionError: Optional[str] = None
    recommendations: Optional[dict] = None
    actionDetails: Optional[dict] = None
    processingTime: Optional[int] = None
    feedbackScore: Optional[int] = None
    feedbackNotes: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


# --- List Response Schemas (for OpenAPI documentation) ---

class NDROrderInfo(SQLModel):
    """Order info embedded in NDR list response"""
    id: str
    orderNo: str
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    shippingAddress: Optional[dict] = None
    paymentMode: str
    totalAmount: float


class NDRDeliveryInfo(SQLModel):
    """Delivery info embedded in NDR list response"""
    id: str
    deliveryNo: str
    awbNo: str
    status: str
    transporter: Optional[dict] = None


class NDRListItem(SQLModel):
    """Single NDR item in list response"""
    id: str
    ndrCode: str
    reason: str
    aiClassification: Optional[str] = None
    confidence: Optional[float] = None
    status: str
    priority: str
    riskScore: Optional[int] = None
    attemptNumber: int
    attemptDate: Optional[str] = None
    carrierRemark: Optional[str] = None
    createdAt: Optional[str] = None
    order: Optional[NDROrderInfo] = None
    delivery: Optional[NDRDeliveryInfo] = None
    outreachAttempts: List[dict] = []
    _count: Optional[dict] = None


class NDRListResponse(SQLModel):
    """
    Response schema for NDR list endpoint.
    Includes paginated NDRs with aggregated statistics.
    """
    ndrs: List[NDRListItem]
    total: int
    statusCounts: dict
    priorityCounts: dict
    reasonCounts: dict
    avgResolutionHours: float
    outreachSuccessRate: float


# --- Summary Schemas ---

class NDRSummary(SQLModel):
    """NDR summary statistics"""
    totalNDRs: int
    openNDRs: int
    resolvedNDRs: int
    rtoNDRs: int
    byReason: dict
    byPriority: dict
    avgResolutionTime: Optional[float] = None


class OutreachSummary(SQLModel):
    """Outreach summary statistics"""
    totalOutreaches: int
    successfulOutreaches: int
    pendingOutreaches: int
    failedOutreaches: int
    byChannel: dict
    responseRate: float
