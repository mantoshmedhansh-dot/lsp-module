"""
Channel Models: Channel Config, Order Import, Marketplace Integration
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text

from .base import BaseModel
from .enums import Channel, SyncFrequency, ImportStatus


# ============================================================================
# Additional Marketplace Enums
# ============================================================================

class MarketplaceType(str, Enum):
    """Marketplace types"""
    AMAZON = "AMAZON"
    FLIPKART = "FLIPKART"
    MYNTRA = "MYNTRA"
    AJIO = "AJIO"
    NYKAA = "NYKAA"
    MEESHO = "MEESHO"
    SHOPIFY = "SHOPIFY"
    WOOCOMMERCE = "WOOCOMMERCE"
    MAGENTO = "MAGENTO"
    TATA_CLIQ = "TATA_CLIQ"
    JIOMART = "JIOMART"


class ConnectionStatus(str, Enum):
    """Marketplace connection status"""
    PENDING = "PENDING"
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    ERROR = "ERROR"
    EXPIRED = "EXPIRED"


class ListingStatus(str, Enum):
    """Marketplace listing status"""
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUPPRESSED = "SUPPRESSED"
    DELETED = "DELETED"


class MarketplaceReturnStatus(str, Enum):
    """Marketplace return status"""
    INITIATED = "INITIATED"
    APPROVED = "APPROVED"
    PICKED_UP = "PICKED_UP"
    RECEIVED = "RECEIVED"
    REFUNDED = "REFUNDED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


# ============================================================================
# Channel Config
# ============================================================================

class ChannelConfigBase(SQLModel):
    """Channel Config base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    channel: Channel = Field(index=True)
    displayName: Optional[str] = None
    isActive: bool = Field(default=True)
    credentials: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    settings: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    lastSyncAt: Optional[datetime] = None
    syncFrequency: SyncFrequency = Field(default=SyncFrequency.HOURLY)
    nextSyncAt: Optional[datetime] = None
    syncStatus: Optional[ImportStatus] = None
    webhookUrl: Optional[str] = None
    webhookSecret: Optional[str] = None
    mappingConfig: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    retryCount: int = Field(default=0)
    lastErrorMessage: Optional[str] = None
    lastErrorAt: Optional[datetime] = None


class ChannelConfig(ChannelConfigBase, BaseModel, table=True):
    """Channel Config model"""
    __tablename__ = "ChannelConfig"


class ChannelConfigCreate(SQLModel):
    """Channel Config creation schema"""
    channel: Channel
    displayName: Optional[str] = None
    credentials: Optional[dict] = None
    settings: Optional[dict] = None
    syncFrequency: SyncFrequency = SyncFrequency.HOURLY
    webhookUrl: Optional[str] = None
    mappingConfig: Optional[dict] = None


class ChannelConfigUpdate(SQLModel):
    """Channel Config update schema"""
    displayName: Optional[str] = None
    isActive: Optional[bool] = None
    credentials: Optional[dict] = None
    settings: Optional[dict] = None
    syncFrequency: Optional[SyncFrequency] = None
    webhookUrl: Optional[str] = None
    webhookSecret: Optional[str] = None
    mappingConfig: Optional[dict] = None


class ChannelConfigResponse(ChannelConfigBase):
    """Channel Config response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Order Import
# ============================================================================

class OrderImportBase(SQLModel):
    """Order Import base fields"""
    importNo: str = Field(unique=True, index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    channel: Optional[Channel] = None
    status: ImportStatus = Field(default=ImportStatus.PENDING, index=True)
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None
    totalRows: int = Field(default=0)
    processedRows: int = Field(default=0)
    successRows: int = Field(default=0)
    errorRows: int = Field(default=0)
    errors: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdById: UUID = Field(foreign_key="User.id")


class OrderImport(OrderImportBase, BaseModel, table=True):
    """Order Import model"""
    __tablename__ = "OrderImport"


class OrderImportCreate(SQLModel):
    """Order Import creation schema"""
    locationId: Optional[UUID] = None
    channel: Optional[Channel] = None
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None


class OrderImportUpdate(SQLModel):
    """Order Import update schema"""
    status: Optional[ImportStatus] = None
    totalRows: Optional[int] = None
    processedRows: Optional[int] = None
    successRows: Optional[int] = None
    errorRows: Optional[int] = None
    errors: Optional[dict] = None


class OrderImportResponse(OrderImportBase):
    """Order Import response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class OrderImportSummary(SQLModel):
    """Order Import summary"""
    pending: int = 0
    inProgress: int = 0
    completed: int = 0
    failed: int = 0
    totalOrders: int = 0


# ============================================================================
# Marketplace Connection
# ============================================================================

class MarketplaceConnectionBase(SQLModel):
    """Marketplace connection base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    marketplace: MarketplaceType = Field(index=True)
    connectionName: str = Field(max_length=100)
    status: ConnectionStatus = Field(default=ConnectionStatus.PENDING, index=True)
    sellerId: Optional[str] = Field(default=None, max_length=100)
    sellerName: Optional[str] = Field(default=None, max_length=255)
    region: Optional[str] = Field(default=None, max_length=50)
    apiEndpoint: Optional[str] = Field(default=None, max_length=500)
    credentials: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    accessToken: Optional[str] = Field(default=None, max_length=2000)
    refreshToken: Optional[str] = Field(default=None, max_length=2000)
    tokenExpiresAt: Optional[datetime] = None
    lastSyncAt: Optional[datetime] = None
    syncSettings: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    webhookUrl: Optional[str] = Field(default=None, max_length=500)
    webhookSecret: Optional[str] = Field(default=None, max_length=255)
    isActive: bool = Field(default=True)
    errorMessage: Optional[str] = Field(default=None, max_length=1000)
    errorAt: Optional[datetime] = None


class MarketplaceConnection(MarketplaceConnectionBase, BaseModel, table=True):
    """Marketplace connection model"""
    __tablename__ = "MarketplaceConnection"


class MarketplaceConnectionCreate(SQLModel):
    """Schema for connection creation"""
    marketplace: MarketplaceType
    connectionName: str
    sellerId: Optional[str] = None
    sellerName: Optional[str] = None
    region: Optional[str] = None
    apiEndpoint: Optional[str] = None
    syncSettings: Optional[dict] = None


class MarketplaceConnectionUpdate(SQLModel):
    """Schema for connection update"""
    connectionName: Optional[str] = None
    status: Optional[ConnectionStatus] = None
    sellerId: Optional[str] = None
    sellerName: Optional[str] = None
    syncSettings: Optional[dict] = None
    isActive: Optional[bool] = None


class MarketplaceConnectionResponse(MarketplaceConnectionBase):
    """Response schema for connection"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Listing
# ============================================================================

class MarketplaceListingBase(SQLModel):
    """Marketplace listing base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    marketplace: MarketplaceType = Field(index=True)
    listingId: str = Field(max_length=255, index=True)
    asin: Optional[str] = Field(default=None, max_length=50)
    fsn: Optional[str] = Field(default=None, max_length=50)
    styleId: Optional[str] = Field(default=None, max_length=50)
    status: ListingStatus = Field(default=ListingStatus.DRAFT, index=True)
    title: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    price: Decimal = Field(default=Decimal("0"))
    mrp: Decimal = Field(default=Decimal("0"))
    currency: str = Field(default="INR", max_length=10)
    stockQuantity: int = Field(default=0)
    isInStock: bool = Field(default=True)
    fulfillmentType: Optional[str] = Field(default=None, max_length=50)
    category: Optional[str] = Field(default=None, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=100)
    imageUrls: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    attributes: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    lastSyncedAt: Optional[datetime] = None
    suppressedReason: Optional[str] = Field(default=None, max_length=500)


class MarketplaceListing(MarketplaceListingBase, BaseModel, table=True):
    """Marketplace listing model"""
    __tablename__ = "MarketplaceListing"


class MarketplaceListingCreate(SQLModel):
    """Schema for listing creation"""
    connectionId: UUID
    skuId: UUID
    marketplace: MarketplaceType
    listingId: str
    asin: Optional[str] = None
    fsn: Optional[str] = None
    title: Optional[str] = None
    price: Decimal
    mrp: Decimal
    stockQuantity: int = 0
    category: Optional[str] = None
    brand: Optional[str] = None


class MarketplaceListingResponse(MarketplaceListingBase):
    """Response schema for listing"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Marketplace Order Sync
# ============================================================================

class MarketplaceOrderSyncBase(SQLModel):
    """Marketplace order sync base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    marketplace: MarketplaceType = Field(index=True)
    marketplaceOrderId: str = Field(max_length=100, index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    orderNo: Optional[str] = Field(default=None, max_length=50)
    syncStatus: ImportStatus = Field(default=ImportStatus.PENDING, index=True)
    syncDirection: str = Field(default="INBOUND", max_length=20)
    orderData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    syncedAt: datetime = Field(default_factory=datetime.utcnow)
    errorMessage: Optional[str] = Field(default=None, max_length=1000)
    retryCount: int = Field(default=0)


class MarketplaceOrderSync(MarketplaceOrderSyncBase, BaseModel, table=True):
    """Marketplace order sync model"""
    __tablename__ = "MarketplaceOrderSync"


class MarketplaceOrderSyncResponse(MarketplaceOrderSyncBase):
    """Response schema for order sync"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Marketplace Inventory Sync
# ============================================================================

class MarketplaceInventorySyncBase(SQLModel):
    """Marketplace inventory sync base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    listingId: UUID = Field(foreign_key="MarketplaceListing.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    marketplace: MarketplaceType = Field(index=True)
    previousQuantity: int = Field(default=0)
    newQuantity: int = Field(default=0)
    syncStatus: ImportStatus = Field(default=ImportStatus.PENDING, index=True)
    syncedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    acknowledgedAt: Optional[datetime] = None
    errorMessage: Optional[str] = Field(default=None, max_length=500)


class MarketplaceInventorySync(MarketplaceInventorySyncBase, BaseModel, table=True):
    """Marketplace inventory sync model"""
    __tablename__ = "MarketplaceInventorySync"


class MarketplaceInventorySyncResponse(MarketplaceInventorySyncBase):
    """Response schema for inventory sync"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Marketplace Return
# ============================================================================

class MarketplaceReturnBase(SQLModel):
    """Marketplace return base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    connectionId: UUID = Field(foreign_key="MarketplaceConnection.id", index=True)
    marketplace: MarketplaceType = Field(index=True)
    marketplaceReturnId: str = Field(max_length=100, index=True)
    marketplaceOrderId: str = Field(max_length=100, index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    returnId: Optional[UUID] = Field(default=None, foreign_key="Return.id")
    status: MarketplaceReturnStatus = Field(default=MarketplaceReturnStatus.INITIATED, index=True)
    returnReason: Optional[str] = Field(default=None, max_length=255)
    returnSubReason: Optional[str] = Field(default=None, max_length=255)
    customerComments: Optional[str] = Field(default=None, max_length=1000)
    returnQuantity: int = Field(default=1)
    refundAmount: Decimal = Field(default=Decimal("0"))
    refundStatus: Optional[str] = Field(default=None, max_length=50)
    refundedAt: Optional[datetime] = None
    pickupScheduledAt: Optional[datetime] = None
    pickedUpAt: Optional[datetime] = None
    receivedAt: Optional[datetime] = None
    returnData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    lastSyncedAt: datetime = Field(default_factory=datetime.utcnow)


class MarketplaceReturn(MarketplaceReturnBase, BaseModel, table=True):
    """Marketplace return model"""
    __tablename__ = "MarketplaceReturn"


class MarketplaceReturnResponse(MarketplaceReturnBase):
    """Response schema for return"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Request/Response Schemas for Marketplace Operations
# ============================================================================

class OAuthConnectRequest(SQLModel):
    """Request for OAuth connection"""
    marketplace: MarketplaceType
    authCode: Optional[str] = None
    sellerId: Optional[str] = None
    region: Optional[str] = None


class OAuthConnectResponse(SQLModel):
    """Response for OAuth connection"""
    connectionId: UUID
    status: ConnectionStatus
    authUrl: Optional[str] = None
    message: str


class SyncOrdersRequest(SQLModel):
    """Request for syncing orders"""
    connectionId: UUID
    fromDate: Optional[datetime] = None
    toDate: Optional[datetime] = None
    orderIds: Optional[List[str]] = None


class SyncOrdersResponse(SQLModel):
    """Response for sync orders"""
    connectionId: UUID
    totalOrders: int
    newOrders: int
    updatedOrders: int
    failedOrders: int
    errors: List[dict] = []


class PushInventoryRequest(SQLModel):
    """Request for pushing inventory"""
    connectionId: UUID
    skuIds: Optional[List[UUID]] = None
    fullSync: bool = False


class PushInventoryResponse(SQLModel):
    """Response for push inventory"""
    connectionId: UUID
    totalSkus: int
    successCount: int
    failedCount: int
    errors: List[dict] = []


class UpdateListingRequest(SQLModel):
    """Request to update listing"""
    listingId: UUID
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    stockQuantity: Optional[int] = None
    status: Optional[ListingStatus] = None
    attributes: Optional[dict] = None
