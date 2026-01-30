"""
Marketplace Integration Models
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class MarketplaceType(str, Enum):
    """Supported marketplaces"""
    AMAZON = "AMAZON"
    FLIPKART = "FLIPKART"
    MYNTRA = "MYNTRA"
    AJIO = "AJIO"
    NYKAA = "NYKAA"
    MEESHO = "MEESHO"
    SHOPIFY = "SHOPIFY"


class ConnectionStatus(str, Enum):
    """Connection status"""
    PENDING = "PENDING"
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    ERROR = "ERROR"
    EXPIRED = "EXPIRED"


class SyncStatus(str, Enum):
    """Sync operation status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class ListingStatus(str, Enum):
    """Listing status"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUPPRESSED = "SUPPRESSED"
    DELETED = "DELETED"


class ReturnStatus(str, Enum):
    """Return status"""
    INITIATED = "INITIATED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    PROCESSED = "PROCESSED"
    REFUNDED = "REFUNDED"


# Database Models
class MarketplaceConnection(BaseModel, table=True):
    """OAuth/API credentials"""
    __tablename__ = "marketplace_connections"

    marketplace: MarketplaceType = Field(index=True)
    accountId: str = Field(max_length=100, index=True)
    accountName: str = Field(max_length=255)
    status: ConnectionStatus = Field(default=ConnectionStatus.PENDING, index=True)
    warehouseId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    apiKey: Optional[str] = Field(default=None, max_length=500)
    apiSecret: Optional[str] = Field(default=None, max_length=500)
    accessToken: Optional[str] = Field(default=None, max_length=1000)
    refreshToken: Optional[str] = Field(default=None, max_length=1000)
    tokenExpiresAt: Optional[datetime] = Field(default=None)
    sellerId: Optional[str] = Field(default=None, max_length=100)
    region: Optional[str] = Field(default="IN", max_length=10)
    webhookUrl: Optional[str] = Field(default=None, max_length=500)
    webhookSecret: Optional[str] = Field(default=None, max_length=255)
    settings: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    lastSyncAt: Optional[datetime] = Field(default=None)
    errorMessage: Optional[str] = Field(default=None, max_length=500)


class MarketplaceListing(BaseModel, table=True):
    """Product listings"""
    __tablename__ = "marketplace_listings"

    connectionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    marketplace: MarketplaceType = Field(index=True)
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sku: str = Field(max_length=100, index=True)
    marketplaceSku: Optional[str] = Field(default=None, max_length=100, index=True)
    asin: Optional[str] = Field(default=None, max_length=20)
    fsn: Optional[str] = Field(default=None, max_length=50)
    listingId: Optional[str] = Field(default=None, max_length=100)
    status: ListingStatus = Field(default=ListingStatus.DRAFT, index=True)
    title: Optional[str] = Field(default=None, max_length=500)
    price: float = Field(default=0.0)
    salePrice: Optional[float] = Field(default=None)
    currency: str = Field(default="INR", max_length=3)
    quantity: int = Field(default=0)
    fulfillmentChannel: Optional[str] = Field(default=None, max_length=20)
    lastSyncAt: Optional[datetime] = Field(default=None)
    syncStatus: SyncStatus = Field(default=SyncStatus.PENDING)
    errorMessage: Optional[str] = Field(default=None, max_length=500)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class MarketplaceOrderSync(BaseModel, table=True):
    """Order sync log"""
    __tablename__ = "marketplace_orders_sync"

    connectionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    marketplace: MarketplaceType = Field(index=True)
    marketplaceOrderId: str = Field(max_length=100, index=True)
    orderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    orderNumber: Optional[str] = Field(default=None, max_length=50)
    syncStatus: SyncStatus = Field(default=SyncStatus.PENDING, index=True)
    syncDirection: str = Field(default="INBOUND", max_length=20)
    orderDate: datetime
    orderAmount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    syncedAt: Optional[datetime] = Field(default=None)
    errorMessage: Optional[str] = Field(default=None, max_length=500)
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceInventorySync(BaseModel, table=True):
    """Inventory push log"""
    __tablename__ = "marketplace_inventory_sync"

    connectionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    listingId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    marketplace: MarketplaceType = Field(index=True)
    sku: str = Field(max_length=100, index=True)
    previousQuantity: int = Field(default=0)
    newQuantity: int = Field(default=0)
    syncStatus: SyncStatus = Field(default=SyncStatus.PENDING, index=True)
    syncedAt: Optional[datetime] = Field(default=None)
    acknowledgedAt: Optional[datetime] = Field(default=None)
    errorMessage: Optional[str] = Field(default=None, max_length=500)


class MarketplaceReturn(BaseModel, table=True):
    """Return sync"""
    __tablename__ = "marketplace_returns"

    connectionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    marketplace: MarketplaceType = Field(index=True)
    marketplaceReturnId: str = Field(max_length=100, index=True)
    marketplaceOrderId: str = Field(max_length=100, index=True)
    orderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    returnId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    status: ReturnStatus = Field(default=ReturnStatus.INITIATED, index=True)
    returnReason: Optional[str] = Field(default=None, max_length=255)
    returnType: Optional[str] = Field(default=None, max_length=50)
    refundAmount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    initiatedDate: datetime
    receivedDate: Optional[datetime] = Field(default=None)
    processedDate: Optional[datetime] = Field(default=None)
    syncStatus: SyncStatus = Field(default=SyncStatus.PENDING)
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MarketplaceSettlement(BaseModel, table=True):
    """Settlement import"""
    __tablename__ = "marketplace_settlements"

    connectionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    marketplace: MarketplaceType = Field(index=True)
    settlementId: str = Field(max_length=100, unique=True, index=True)
    settlementDate: datetime = Field(index=True)
    periodStart: datetime
    periodEnd: datetime
    totalAmount: float = Field(default=0.0)
    ordersAmount: float = Field(default=0.0)
    refundsAmount: float = Field(default=0.0)
    feesAmount: float = Field(default=0.0)
    otherAmount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    transactionCount: int = Field(default=0)
    syncStatus: SyncStatus = Field(default=SyncStatus.PENDING)
    importedAt: Optional[datetime] = Field(default=None)
    rawData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


# Request/Response Schemas
class MarketplaceConnectionCreate(SQLModel):
    """Schema for creating connection"""
    marketplace: MarketplaceType
    accountId: str
    accountName: str
    warehouseId: Optional[UUID] = None
    apiKey: Optional[str] = None
    apiSecret: Optional[str] = None
    sellerId: Optional[str] = None
    region: str = "IN"


class MarketplaceConnectionResponse(SQLModel):
    """Response for connection"""
    id: UUID
    marketplace: MarketplaceType
    accountId: str
    accountName: str
    status: ConnectionStatus
    warehouseId: Optional[UUID]
    lastSyncAt: Optional[datetime]
    createdAt: datetime


class OAuthConnectRequest(SQLModel):
    """Request for OAuth flow"""
    connectionId: UUID
    redirectUri: str


class OAuthConnectResponse(SQLModel):
    """Response for OAuth flow"""
    authorizationUrl: str
    state: str


class SyncOrdersRequest(SQLModel):
    """Request to sync orders"""
    connectionId: UUID
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    orderIds: Optional[List[str]] = None


class SyncOrdersResponse(SQLModel):
    """Response for order sync"""
    connectionId: UUID
    marketplace: MarketplaceType
    totalOrders: int
    synced: int
    failed: int
    syncedAt: datetime


class PushInventoryRequest(SQLModel):
    """Request to push inventory"""
    connectionId: UUID
    skus: Optional[List[str]] = None
    fullSync: bool = False


class PushInventoryResponse(SQLModel):
    """Response for inventory push"""
    connectionId: UUID
    marketplace: MarketplaceType
    totalListings: int
    updated: int
    failed: int
    syncedAt: datetime


class ListingResponse(SQLModel):
    """Response for listing"""
    id: UUID
    connectionId: UUID
    marketplace: MarketplaceType
    sku: str
    marketplaceSku: Optional[str]
    status: ListingStatus
    title: Optional[str]
    price: float
    quantity: int
    lastSyncAt: Optional[datetime]


class UpdateListingRequest(SQLModel):
    """Request to update listing"""
    price: Optional[float] = None
    salePrice: Optional[float] = None
    quantity: Optional[int] = None
    status: Optional[ListingStatus] = None


class MarketplaceReturnResponse(SQLModel):
    """Response for return"""
    id: UUID
    marketplace: MarketplaceType
    marketplaceReturnId: str
    marketplaceOrderId: str
    status: ReturnStatus
    returnReason: Optional[str]
    refundAmount: float
    initiatedDate: datetime
