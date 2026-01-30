"""
Marketplace Base Adapter
Abstract base class defining the interface for all marketplace integrations
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from uuid import UUID
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class FulfillmentType(str, Enum):
    """Fulfillment types"""
    SELLER = "SELLER"  # Seller fulfillment
    MARKETPLACE = "MARKETPLACE"  # Marketplace fulfillment (FBA, Flipkart Assured, etc.)
    DROPSHIP = "DROPSHIP"


@dataclass
class MarketplaceCredentials:
    """Credentials for marketplace authentication"""
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    seller_id: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    store_url: Optional[str] = None
    region: Optional[str] = None
    additional: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MarketplaceConfig:
    """Configuration for marketplace connection"""
    connection_id: UUID
    company_id: UUID
    marketplace: str
    credentials: MarketplaceCredentials
    api_endpoint: Optional[str] = None
    webhook_url: Optional[str] = None
    sync_settings: Dict[str, Any] = field(default_factory=dict)
    is_sandbox: bool = False


@dataclass
class MarketplaceOrder:
    """Standardized order data from marketplace"""
    marketplace_order_id: str
    marketplace: str
    order_status: str
    order_date: datetime
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    shipping_address: Dict[str, Any] = field(default_factory=dict)
    billing_address: Dict[str, Any] = field(default_factory=dict)
    items: List[Dict[str, Any]] = field(default_factory=list)
    subtotal: float = 0.0
    shipping_amount: float = 0.0
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float = 0.0
    currency: str = "INR"
    payment_method: str = "PREPAID"
    is_cod: bool = False
    fulfillment_type: FulfillmentType = FulfillmentType.SELLER
    promised_delivery_date: Optional[datetime] = None
    ship_by_date: Optional[datetime] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MarketplaceOrderItem:
    """Standardized order item from marketplace"""
    marketplace_line_id: str
    marketplace_sku: str
    title: str
    quantity: int
    unit_price: float
    total_price: float
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    shipping_amount: float = 0.0
    fulfillment_type: FulfillmentType = FulfillmentType.SELLER
    item_status: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InventoryUpdate:
    """Inventory update to push to marketplace"""
    marketplace_sku: str
    quantity: int
    sku_id: Optional[UUID] = None
    location_id: Optional[UUID] = None


@dataclass
class InventoryUpdateResult:
    """Result of inventory update"""
    marketplace_sku: str
    success: bool
    previous_qty: Optional[int] = None
    new_qty: Optional[int] = None
    acknowledged_qty: Optional[int] = None
    error_message: Optional[str] = None
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OrderStatusUpdate:
    """Order status update to push to marketplace"""
    marketplace_order_id: str
    new_status: str
    tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    ship_date: Optional[datetime] = None
    items: Optional[List[str]] = None  # List of marketplace line IDs
    notes: Optional[str] = None


@dataclass
class Settlement:
    """Settlement data from marketplace"""
    settlement_id: str
    settlement_date: datetime
    period_from: datetime
    period_to: datetime
    total_orders: int = 0
    gross_sales: float = 0.0
    marketplace_fee: float = 0.0
    shipping_fee: float = 0.0
    tax_collected: float = 0.0
    refunds: float = 0.0
    net_amount: float = 0.0
    currency: str = "INR"
    items: List[Dict[str, Any]] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MarketplaceReturn:
    """Return data from marketplace"""
    marketplace_return_id: str
    marketplace_order_id: str
    return_reason: str
    return_sub_reason: Optional[str] = None
    customer_comments: Optional[str] = None
    return_quantity: int = 1
    refund_amount: float = 0.0
    status: str = "INITIATED"
    initiated_date: Optional[datetime] = None
    items: List[Dict[str, Any]] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuthResult:
    """Result of authentication"""
    success: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    token_type: str = "Bearer"
    scope: Optional[str] = None
    error_message: Optional[str] = None


class MarketplaceAdapter(ABC):
    """
    Abstract base class for all marketplace integrations.

    Each marketplace (Amazon, Flipkart, Shopify, etc.) implements this interface
    to provide consistent functionality across the OMS.
    """

    def __init__(self, config: MarketplaceConfig):
        """
        Initialize the adapter with marketplace configuration.

        Args:
            config: Marketplace connection configuration
        """
        self.config = config
        self.connection_id = config.connection_id
        self.company_id = config.company_id
        self.marketplace = config.marketplace
        self.credentials = config.credentials
        self.is_authenticated = False
        self._rate_limit_remaining: Optional[int] = None
        self._rate_limit_reset: Optional[datetime] = None

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the marketplace name."""
        pass

    @property
    @abstractmethod
    def supported_operations(self) -> List[str]:
        """Return list of supported operations."""
        pass

    # =========================================================================
    # Authentication Methods
    # =========================================================================

    @abstractmethod
    async def authenticate(self) -> AuthResult:
        """
        Authenticate with the marketplace.

        For OAuth-based marketplaces, this refreshes tokens if needed.
        For API key-based, this validates the credentials.

        Returns:
            AuthResult with success status and tokens
        """
        pass

    @abstractmethod
    async def refresh_token(self) -> AuthResult:
        """
        Refresh the access token using refresh token.

        Returns:
            AuthResult with new tokens
        """
        pass

    def get_oauth_authorize_url(self, redirect_uri: str, state: str) -> str:
        """
        Get OAuth authorization URL for user consent.

        Args:
            redirect_uri: Callback URL after authorization
            state: State parameter for CSRF protection

        Returns:
            Authorization URL string
        """
        raise NotImplementedError(f"{self.name} does not support OAuth flow")

    async def exchange_code_for_token(self, code: str, redirect_uri: str) -> AuthResult:
        """
        Exchange authorization code for access token.

        Args:
            code: Authorization code from OAuth callback
            redirect_uri: Same redirect URI used in authorization

        Returns:
            AuthResult with tokens
        """
        raise NotImplementedError(f"{self.name} does not support OAuth flow")

    # =========================================================================
    # Order Management
    # =========================================================================

    @abstractmethod
    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: Optional[datetime] = None,
        status: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 50
    ) -> Tuple[List[MarketplaceOrder], Optional[str]]:
        """
        Fetch orders from marketplace.

        Args:
            from_date: Start date for order search
            to_date: End date for order search (default: now)
            status: Filter by order status
            cursor: Pagination cursor
            limit: Maximum orders to fetch

        Returns:
            Tuple of (list of orders, next cursor if more pages)
        """
        pass

    @abstractmethod
    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """
        Get a specific order by ID.

        Args:
            marketplace_order_id: Marketplace order ID

        Returns:
            Order details or None if not found
        """
        pass

    @abstractmethod
    async def update_order_status(
        self,
        update: OrderStatusUpdate
    ) -> bool:
        """
        Update order status on marketplace.

        Args:
            update: Order status update details

        Returns:
            True if update successful
        """
        pass

    @abstractmethod
    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None
    ) -> bool:
        """
        Cancel order on marketplace.

        Args:
            marketplace_order_id: Marketplace order ID
            reason: Cancellation reason
            items: Specific items to cancel (None = all items)

        Returns:
            True if cancellation successful
        """
        pass

    # =========================================================================
    # Inventory Management
    # =========================================================================

    @abstractmethod
    async def push_inventory(
        self,
        updates: List[InventoryUpdate]
    ) -> List[InventoryUpdateResult]:
        """
        Push inventory levels to marketplace.

        Args:
            updates: List of inventory updates

        Returns:
            List of update results
        """
        pass

    @abstractmethod
    async def get_inventory(
        self,
        marketplace_skus: List[str]
    ) -> Dict[str, int]:
        """
        Get current inventory levels from marketplace.

        Args:
            marketplace_skus: List of marketplace SKUs to check

        Returns:
            Dict mapping SKU to quantity
        """
        pass

    # =========================================================================
    # Settlement/Finance
    # =========================================================================

    @abstractmethod
    async def fetch_settlements(
        self,
        from_date: datetime,
        to_date: datetime
    ) -> List[Settlement]:
        """
        Fetch settlement/payment reports.

        Args:
            from_date: Start date for settlement search
            to_date: End date for settlement search

        Returns:
            List of settlements
        """
        pass

    # =========================================================================
    # Returns Management
    # =========================================================================

    @abstractmethod
    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None
    ) -> List[MarketplaceReturn]:
        """
        Fetch return requests from marketplace.

        Args:
            from_date: Start date for return search
            status: Filter by return status

        Returns:
            List of returns
        """
        pass

    @abstractmethod
    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None
    ) -> bool:
        """
        Update return status on marketplace.

        Args:
            marketplace_return_id: Marketplace return ID
            status: New status
            notes: Optional notes

        Returns:
            True if update successful
        """
        pass

    # =========================================================================
    # Listing/Catalog (Optional)
    # =========================================================================

    async def fetch_listings(
        self,
        cursor: Optional[str] = None,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetch product listings from marketplace.

        Args:
            cursor: Pagination cursor
            limit: Maximum listings to fetch

        Returns:
            Tuple of (list of listings, next cursor)
        """
        raise NotImplementedError(f"{self.name} does not support listing fetch")

    async def update_listing_price(
        self,
        marketplace_sku: str,
        price: float,
        mrp: Optional[float] = None
    ) -> bool:
        """
        Update listing price on marketplace.

        Args:
            marketplace_sku: Marketplace SKU
            price: New selling price
            mrp: Maximum retail price (if applicable)

        Returns:
            True if update successful
        """
        raise NotImplementedError(f"{self.name} does not support price update")

    # =========================================================================
    # Webhook Handling
    # =========================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str]
    ) -> bool:
        """
        Verify webhook signature from marketplace.

        Args:
            payload: Raw request body
            signature: Signature from headers
            headers: All request headers

        Returns:
            True if signature is valid
        """
        raise NotImplementedError(f"{self.name} does not support webhook verification")

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str
    ) -> Dict[str, Any]:
        """
        Parse webhook event payload into standardized format.

        Args:
            payload: Webhook payload
            event_type: Type of webhook event

        Returns:
            Standardized event data
        """
        raise NotImplementedError(f"{self.name} does not support webhook parsing")

    # =========================================================================
    # Health Check
    # =========================================================================

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if connection to marketplace is healthy.

        Returns:
            True if connection is healthy
        """
        pass

    # =========================================================================
    # Rate Limiting
    # =========================================================================

    def get_rate_limit_status(self) -> Dict[str, Any]:
        """
        Get current rate limit status.

        Returns:
            Dict with remaining calls and reset time
        """
        return {
            "remaining": self._rate_limit_remaining,
            "reset_at": self._rate_limit_reset.isoformat() if self._rate_limit_reset else None
        }

    def should_throttle(self) -> bool:
        """
        Check if we should throttle requests.

        Returns:
            True if we should wait before making more requests
        """
        if self._rate_limit_remaining is not None and self._rate_limit_remaining <= 5:
            return True
        return False

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _log_api_call(self, method: str, endpoint: str, status: int, duration_ms: float):
        """Log API call for monitoring."""
        logger.info(
            f"[{self.name}] {method} {endpoint} - {status} ({duration_ms:.2f}ms)",
            extra={
                "marketplace": self.name,
                "connection_id": str(self.connection_id),
                "method": method,
                "endpoint": endpoint,
                "status": status,
                "duration_ms": duration_ms
            }
        )

    def _log_error(self, operation: str, error: Exception):
        """Log error for monitoring."""
        logger.error(
            f"[{self.name}] {operation} failed: {str(error)}",
            extra={
                "marketplace": self.name,
                "connection_id": str(self.connection_id),
                "operation": operation,
                "error": str(error)
            },
            exc_info=True
        )
