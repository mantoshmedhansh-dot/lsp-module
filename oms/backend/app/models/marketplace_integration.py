"""
Marketplace Integration Models
Extended models for omni-channel OMS: SKU mapping, OAuth tokens, webhooks, sync jobs
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text

from .base import BaseModel
from .channels import MarketplaceType


# ============================================================================
# Additional Enums
# ============================================================================

class SkuMappingStatus(str, Enum):
    """SKU mapping listing status"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BLOCKED = "BLOCKED"
    PENDING = "PENDING"
    DELETED = "DELETED"


class SyncJobType(str, Enum):
    """Sync job types"""
    ORDER_PULL = "ORDER_PULL"
    INVENTORY_PUSH = "INVENTORY_PUSH"
    SETTLEMENT_FETCH = "SETTLEMENT_FETCH"
    RETURN_FETCH = "RETURN_FETCH"
    LISTING_SYNC = "LISTING_SYNC"
    PRICE_UPDATE = "PRICE_UPDATE"
    TOKEN_REFRESH = "TOKEN_REFRESH"


class SyncJobStatus(str, Enum):
    """Sync job status"""
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    PARTIAL = "PARTIAL"


class WebhookEventStatus(str, Enum):
    """Webhook event processing status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"
    IGNORED = "IGNORED"
    RETRYING = "RETRYING"


class WebhookEventType(str, Enum):
    """Webhook event types"""
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_UPDATED = "ORDER_UPDATED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    ORDER_SHIPPED = "ORDER_SHIPPED"
    RETURN_INITIATED = "RETURN_INITIATED"
    RETURN_RECEIVED = "RETURN_RECEIVED"
    INVENTORY_ALERT = "INVENTORY_ALERT"
    LISTING_UPDATED = "LISTING_UPDATED"
    SETTLEMENT_AVAILABLE = "SETTLEMENT_AVAILABLE"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"


class ReconciliationStatus(str, Enum):
    """Settlement reconciliation status"""
    PENDING = "PENDING"
    MATCHED = "MATCHED"
    PARTIAL = "PARTIAL"
    EXCESS = "EXCESS"
    MISSING = "MISSING"
    UNMATCHED = "UNMATCHED"
    DISPUTED = "DISPUTED"


class SyncTrigger(str, Enum):
    """What triggered the sync"""
    SCHEDULED = "SCHEDULED"
    MANUAL = "MANUAL"
    WEBHOOK = "WEBHOOK"
    INVENTORY_CHANGE = "INVENTORY_CHANGE"
    ORDER_UPDATE = "ORDER_UPDATE"
    API_REQUEST = "API_REQUEST"


# ============================================================================
# Marketplace SKU Mapping
# ============================================================================

class MarketplaceSkuMappingBase(SQLModel):
    """SKU Mapping base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    connectionId: Optional[UUID] = Field(default=None, foreign_key="MarketplaceConnection.id")
    channel: str = Field(max_length=50, index=True)
    marketplaceSku: str = Field(max_length=100, index=True)
    marketplaceSkuName: Optional[str] = Field(default=None, max_length=255)
    listingStatus: SkuMappingStatus = Field(default=SkuMappingStatus.ACTIVE)
    marketplaceListingId: Optional[str] = Field(default=None, max_length=255)
    price: Optional[Decimal] = Field(default=None)
    mrp: Optional[Decimal] = Field(default=None)
    currency: str = Field(default="INR", max_length=10)
    lastSyncedAt: Optional[datetime] = None
    lastPriceUpdateAt: Optional[datetime] = None
    lastInventoryUpdateAt: Optional[datetime] = None
    syncEnabled: bool = Field(default=True)
    attributes: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceSkuMapping(MarketplaceSkuMappingBase, BaseModel, table=True):
    """Marketplace SKU Mapping model"""
    __tablename__ = "MarketplaceSkuMapping"


class MarketplaceSkuMappingCreate(SQLModel):
    """Create SKU mapping"""
    skuId: UUID
    connectionId: Optional[UUID] = None
    channel: str
    marketplaceSku: str
    marketplaceSkuName: Optional[str] = None
    marketplaceListingId: Optional[str] = None
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    currency: str = "INR"
    syncEnabled: bool = True
    attributes: Optional[dict] = None


class MarketplaceSkuMappingUpdate(SQLModel):
    """Update SKU mapping"""
    marketplaceSku: Optional[str] = None
    marketplaceSkuName: Optional[str] = None
    listingStatus: Optional[SkuMappingStatus] = None
    marketplaceListingId: Optional[str] = None
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    syncEnabled: Optional[bool] = None
    attributes: Optional[dict] = None


class MarketplaceSkuMappingResponse(MarketplaceSkuMappingBase):
    """Response for SKU mapping"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class MarketplaceSkuMappingBulkCreate(SQLModel):
    """Bulk create SKU mappings"""
    mappings: List[MarketplaceSkuMappingCreate]


class MarketplaceSkuMappingBulkResponse(SQLModel):
    """Response for bulk SKU mapping creation"""
    created: int
    updated: int
    failed: int
    errors: List[dict] = []


# ============================================================================
# Marketplace OAuth Token
# ============================================================================

class MarketplaceOAuthTokenBase(SQLModel):
    """OAuth Token base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    accessToken: str = Field(sa_column=Column(Text))
    refreshToken: Optional[str] = Field(default=None, sa_column=Column(Text))
    tokenType: str = Field(default="Bearer", max_length=50)
    expiresAt: Optional[datetime] = None
    refreshExpiresAt: Optional[datetime] = None
    scope: Optional[str] = Field(default=None, sa_column=Column(Text))
    tokenMetadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isValid: bool = Field(default=True)
    lastRefreshedAt: Optional[datetime] = None
    refreshCount: int = Field(default=0)


class MarketplaceOAuthToken(MarketplaceOAuthTokenBase, BaseModel, table=True):
    """Marketplace OAuth Token model"""
    __tablename__ = "MarketplaceOAuthToken"


class MarketplaceOAuthTokenCreate(SQLModel):
    """Create OAuth token"""
    connectionId: UUID
    accessToken: str
    refreshToken: Optional[str] = None
    tokenType: str = "Bearer"
    expiresAt: Optional[datetime] = None
    refreshExpiresAt: Optional[datetime] = None
    scope: Optional[str] = None
    tokenMetadata: Optional[dict] = None


class MarketplaceOAuthTokenResponse(SQLModel):
    """Response for OAuth token (sanitized)"""
    id: UUID
    connectionId: UUID
    tokenType: str
    expiresAt: Optional[datetime]
    isValid: bool
    lastRefreshedAt: Optional[datetime]
    refreshCount: int
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Webhook Event
# ============================================================================

class MarketplaceWebhookEventBase(SQLModel):
    """Webhook Event base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: Optional[UUID] = Field(default=None, foreign_key="MarketplaceConnection.id")
    channel: str = Field(max_length=50, index=True)
    eventType: str = Field(max_length=100, index=True)
    eventId: Optional[str] = Field(default=None, max_length=255)
    payload: dict = Field(sa_column=Column(JSON))
    headers: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    status: WebhookEventStatus = Field(default=WebhookEventStatus.PENDING, index=True)
    retryCount: int = Field(default=0)
    maxRetries: int = Field(default=3)
    nextRetryAt: Optional[datetime] = None
    processedAt: Optional[datetime] = None
    errorMessage: Optional[str] = Field(default=None, sa_column=Column(Text))
    errorDetails: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    idempotencyKey: Optional[str] = Field(default=None, max_length=255)


class MarketplaceWebhookEvent(MarketplaceWebhookEventBase, BaseModel, table=True):
    """Marketplace Webhook Event model"""
    __tablename__ = "MarketplaceWebhookEvent"


class MarketplaceWebhookEventCreate(SQLModel):
    """Create webhook event"""
    connectionId: Optional[UUID] = None
    channel: str
    eventType: str
    eventId: Optional[str] = None
    payload: dict
    headers: Optional[dict] = None
    idempotencyKey: Optional[str] = None


class MarketplaceWebhookEventResponse(MarketplaceWebhookEventBase):
    """Response for webhook event"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Sync Job
# ============================================================================

class MarketplaceSyncJobBase(SQLModel):
    """Sync Job base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    jobType: SyncJobType = Field(index=True)
    status: SyncJobStatus = Field(default=SyncJobStatus.PENDING, index=True)
    priority: int = Field(default=0)
    scheduledAt: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    recordsTotal: int = Field(default=0)
    recordsProcessed: int = Field(default=0)
    recordsSuccess: int = Field(default=0)
    recordsFailed: int = Field(default=0)
    recordsSkipped: int = Field(default=0)
    syncFromDate: Optional[datetime] = None
    syncToDate: Optional[datetime] = None
    lastCursor: Optional[str] = Field(default=None, max_length=500)
    errorLog: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    resultSummary: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    triggeredBy: Optional[str] = Field(default=None, max_length=50)
    triggeredById: Optional[UUID] = None
    parentJobId: Optional[UUID] = Field(default=None, foreign_key="MarketplaceSyncJob.id")


class MarketplaceSyncJob(MarketplaceSyncJobBase, BaseModel, table=True):
    """Marketplace Sync Job model"""
    __tablename__ = "MarketplaceSyncJob"


class MarketplaceSyncJobCreate(SQLModel):
    """Create sync job"""
    connectionId: UUID
    jobType: SyncJobType
    priority: int = 0
    scheduledAt: Optional[datetime] = None
    syncFromDate: Optional[datetime] = None
    syncToDate: Optional[datetime] = None
    triggeredBy: Optional[str] = None
    triggeredById: Optional[UUID] = None


class MarketplaceSyncJobUpdate(SQLModel):
    """Update sync job"""
    status: Optional[SyncJobStatus] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    recordsTotal: Optional[int] = None
    recordsProcessed: Optional[int] = None
    recordsSuccess: Optional[int] = None
    recordsFailed: Optional[int] = None
    recordsSkipped: Optional[int] = None
    lastCursor: Optional[str] = None
    errorLog: Optional[dict] = None
    resultSummary: Optional[dict] = None


class MarketplaceSyncJobResponse(MarketplaceSyncJobBase):
    """Response for sync job"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Settlement
# ============================================================================

class MarketplaceSettlementBase(SQLModel):
    """Settlement base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    channel: Optional[str] = Field(default=None, max_length=50)
    settlementId: str = Field(max_length=100, index=True)
    settlementDate: datetime
    periodStart: Optional[datetime] = None
    periodEnd: Optional[datetime] = None
    currency: str = Field(default="INR", max_length=10)
    totalAmount: Decimal = Field(default=Decimal("0"))
    orderAmount: Decimal = Field(default=Decimal("0"))
    refundAmount: Decimal = Field(default=Decimal("0"))
    commissionAmount: Decimal = Field(default=Decimal("0"))
    shippingFee: Decimal = Field(default=Decimal("0"))
    otherFees: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    netAmount: Decimal = Field(default=Decimal("0"))
    reconciliationStatus: ReconciliationStatus = Field(default=ReconciliationStatus.PENDING)
    matchedCount: int = Field(default=0)
    unmatchedCount: int = Field(default=0)
    discrepancyCount: int = Field(default=0)
    reconciledAt: Optional[datetime] = None
    reconciledBy: Optional[UUID] = Field(default=None, foreign_key="User.id")
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceSettlement(MarketplaceSettlementBase, BaseModel, table=True):
    """Marketplace Settlement model"""
    __tablename__ = "MarketplaceSettlement"


class MarketplaceSettlementCreate(SQLModel):
    """Create settlement"""
    connectionId: UUID
    settlementId: str
    settlementDate: datetime
    periodStart: Optional[datetime] = None
    periodEnd: Optional[datetime] = None
    currency: str = "INR"
    totalAmount: Decimal
    orderAmount: Decimal = Decimal("0")
    refundAmount: Decimal = Decimal("0")
    commissionAmount: Decimal = Decimal("0")
    shippingFee: Decimal = Decimal("0")
    otherFees: Decimal = Decimal("0")
    taxAmount: Decimal = Decimal("0")
    netAmount: Decimal
    rawData: Optional[dict] = None


class MarketplaceSettlementUpdate(SQLModel):
    """Update settlement"""
    reconciliationStatus: Optional[ReconciliationStatus] = None
    matchedCount: Optional[int] = None
    unmatchedCount: Optional[int] = None
    discrepancyCount: Optional[int] = None
    notes: Optional[str] = None


class MarketplaceSettlementResponse(MarketplaceSettlementBase):
    """Response for settlement"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Settlement Item
# ============================================================================

class MarketplaceSettlementItemBase(SQLModel):
    """Settlement Item base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    settlementId: UUID = Field(foreign_key="MarketplaceSettlement.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    marketplaceOrderId: str = Field(max_length=100, index=True)
    skuId: Optional[UUID] = Field(default=None, foreign_key="SKU.id")
    marketplaceSku: Optional[str] = Field(default=None, max_length=100)
    quantity: int = Field(default=1)
    itemPrice: Decimal = Field(default=Decimal("0"))
    shippingCharge: Decimal = Field(default=Decimal("0"))
    giftWrapCharge: Decimal = Field(default=Decimal("0"))
    marketplaceFee: Decimal = Field(default=Decimal("0"))
    commission: Decimal = Field(default=Decimal("0"))
    fixedFee: Decimal = Field(default=Decimal("0"))
    closingFee: Decimal = Field(default=Decimal("0"))
    pickPackFee: Decimal = Field(default=Decimal("0"))
    weightHandlingFee: Decimal = Field(default=Decimal("0"))
    taxCollected: Decimal = Field(default=Decimal("0"))
    taxRemitted: Decimal = Field(default=Decimal("0"))
    tcs: Decimal = Field(default=Decimal("0"))
    tds: Decimal = Field(default=Decimal("0"))
    promotionDiscount: Decimal = Field(default=Decimal("0"))
    sellerDiscount: Decimal = Field(default=Decimal("0"))
    refundAmount: Decimal = Field(default=Decimal("0"))
    netAmount: Decimal = Field(default=Decimal("0"))
    reconciliationStatus: ReconciliationStatus = Field(default=ReconciliationStatus.PENDING)
    reconciledAt: Optional[datetime] = None
    discrepancyAmount: Optional[Decimal] = None
    discrepancyReason: Optional[str] = Field(default=None, max_length=255)
    transactionDate: Optional[date] = None
    settlementDate: Optional[date] = None
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceSettlementItem(MarketplaceSettlementItemBase, BaseModel, table=True):
    """Marketplace Settlement Item model"""
    __tablename__ = "MarketplaceSettlementItem"


class MarketplaceSettlementItemCreate(SQLModel):
    """Create settlement item"""
    settlementId: UUID
    connectionId: UUID
    orderId: Optional[UUID] = None
    marketplaceOrderId: str
    skuId: Optional[UUID] = None
    marketplaceSku: Optional[str] = None
    quantity: int = 1
    itemPrice: Decimal = Decimal("0")
    shippingCharge: Decimal = Decimal("0")
    marketplaceFee: Decimal = Decimal("0")
    taxCollected: Decimal = Decimal("0")
    netAmount: Decimal = Decimal("0")
    transactionDate: Optional[date] = None
    settlementDate: Optional[date] = None
    rawData: Optional[dict] = None


class MarketplaceSettlementItemResponse(MarketplaceSettlementItemBase):
    """Response for settlement item"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Order Line Sync
# ============================================================================

class MarketplaceOrderLineSyncBase(SQLModel):
    """Order Line Sync base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    orderSyncId: UUID = Field(foreign_key="MarketplaceOrderSync.id", index=True)
    orderItemId: Optional[UUID] = Field(default=None, foreign_key="OrderItem.id")
    marketplaceLineId: Optional[str] = Field(default=None, max_length=100)
    marketplaceSku: str = Field(max_length=100)
    skuId: Optional[UUID] = Field(default=None, foreign_key="SKU.id")
    skuMappingId: Optional[UUID] = Field(default=None, foreign_key="MarketplaceSkuMapping.id")
    quantity: int = Field(default=1)
    unitPrice: Decimal = Field(default=Decimal("0"))
    totalPrice: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    discountAmount: Decimal = Field(default=Decimal("0"))
    shippingCharge: Decimal = Field(default=Decimal("0"))
    giftWrapCharge: Decimal = Field(default=Decimal("0"))
    fulfillmentType: Optional[str] = Field(default=None, max_length=50)
    itemStatus: Optional[str] = Field(default=None, max_length=50)
    lineData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceOrderLineSync(MarketplaceOrderLineSyncBase, BaseModel, table=True):
    """Marketplace Order Line Sync model"""
    __tablename__ = "MarketplaceOrderLineSync"


class MarketplaceOrderLineSyncCreate(SQLModel):
    """Create order line sync"""
    orderSyncId: UUID
    marketplaceLineId: Optional[str] = None
    marketplaceSku: str
    skuId: Optional[UUID] = None
    skuMappingId: Optional[UUID] = None
    quantity: int = 1
    unitPrice: Decimal = Decimal("0")
    totalPrice: Decimal = Decimal("0")
    taxAmount: Decimal = Decimal("0")
    discountAmount: Decimal = Decimal("0")
    fulfillmentType: Optional[str] = None
    itemStatus: Optional[str] = None
    lineData: Optional[dict] = None


class MarketplaceOrderLineSyncResponse(MarketplaceOrderLineSyncBase):
    """Response for order line sync"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Inventory Sync Log
# ============================================================================

class MarketplaceInventorySyncLogBase(SQLModel):
    """Inventory Sync Log base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    syncJobId: Optional[UUID] = Field(default=None, foreign_key="MarketplaceSyncJob.id")
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    skuMappingId: Optional[UUID] = Field(default=None, foreign_key="MarketplaceSkuMapping.id")
    marketplaceSku: str = Field(max_length=100)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    previousQty: int = Field(default=0)
    calculatedQty: int = Field(default=0)
    bufferApplied: int = Field(default=0)
    pushedQty: int = Field(default=0)
    marketplaceAcknowledgedQty: Optional[int] = None
    syncStatus: SyncJobStatus = Field(default=SyncJobStatus.PENDING)
    syncedAt: Optional[datetime] = None
    acknowledgedAt: Optional[datetime] = None
    errorMessage: Optional[str] = Field(default=None, sa_column=Column(Text))
    requestPayload: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    responsePayload: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceInventorySyncLog(MarketplaceInventorySyncLogBase, BaseModel, table=True):
    """Marketplace Inventory Sync Log model"""
    __tablename__ = "MarketplaceInventorySyncLog"


class MarketplaceInventorySyncLogCreate(SQLModel):
    """Create inventory sync log"""
    connectionId: UUID
    syncJobId: Optional[UUID] = None
    skuId: UUID
    skuMappingId: Optional[UUID] = None
    marketplaceSku: str
    locationId: Optional[UUID] = None
    previousQty: int = 0
    calculatedQty: int = 0
    bufferApplied: int = 0
    pushedQty: int = 0


class MarketplaceInventorySyncLogResponse(MarketplaceInventorySyncLogBase):
    """Response for inventory sync log"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Request/Response Schemas for API Operations
# ============================================================================

class TriggerSyncRequest(SQLModel):
    """Request to trigger a sync operation"""
    connectionId: UUID
    jobType: SyncJobType
    fromDate: Optional[datetime] = None
    toDate: Optional[datetime] = None
    skuIds: Optional[List[UUID]] = None
    fullSync: bool = False


class TriggerSyncResponse(SQLModel):
    """Response for sync trigger"""
    jobId: UUID
    connectionId: UUID
    jobType: SyncJobType
    status: SyncJobStatus
    message: str


class UnmappedSkuResponse(SQLModel):
    """Response for unmapped SKUs"""
    skuId: UUID
    skuCode: str
    skuName: Optional[str]
    channels: List[str]


class SkuMappingSummary(SQLModel):
    """Summary of SKU mappings"""
    totalMappings: int
    activeMappings: int
    unmappedSkus: int
    byChannel: dict


class SyncStatusResponse(SQLModel):
    """Overall sync status response"""
    lastOrderSync: Optional[datetime]
    lastInventorySync: Optional[datetime]
    lastSettlementSync: Optional[datetime]
    pendingJobs: int
    failedJobs: int
    totalOrders: int
    totalInventoryUpdates: int
