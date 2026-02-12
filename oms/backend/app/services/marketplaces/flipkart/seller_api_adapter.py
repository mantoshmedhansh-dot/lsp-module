"""
Flipkart Seller API Adapter
Complete implementation of MarketplaceAdapter for Flipkart Seller Hub API.

Flipkart Seller API docs:
- Base URL (production): https://api.flipkart.net/sellers
- Base URL (sandbox):    https://sandbox-api.flipkart.net/sellers
- Auth (OAuth2 client_credentials): https://api.flipkart.net/oauth-service/oauth/token

Covers:
- Orders API (v3 shipments: filter, dispatch, cancel)
- Listings API (v3: search, update for inventory)
- Returns API (v3: filter, action)
- Settlements API (v3: date-range query)
- Webhook signature verification & event parsing
- Health check via seller details
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import asyncio
import hashlib
import hmac
import logging
import time
import base64

import httpx

from app.services.marketplaces.base_adapter import (
    MarketplaceAdapter,
    MarketplaceConfig,
    MarketplaceOrder,
    MarketplaceOrderItem,
    InventoryUpdate,
    InventoryUpdateResult,
    OrderStatusUpdate,
    Settlement,
    MarketplaceReturn,
    AuthResult,
    FulfillmentType,
)
from app.services.marketplaces.adapter_factory import register_adapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FLIPKART_SANDBOX_URL = "https://sandbox-api.flipkart.net/sellers"
FLIPKART_PRODUCTION_URL = "https://api.flipkart.net/sellers"
FLIPKART_AUTH_URL = "https://api.flipkart.net/oauth-service/oauth/token"
FLIPKART_NAPI_URL = "https://seller.flipkart.com/napi"

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30.0

# Maximum number of retries on 429 rate-limit responses
MAX_RATE_LIMIT_RETRIES = 3

# Base backoff seconds when rate-limited
RATE_LIMIT_BACKOFF_BASE = 2.0

# Flipkart order-status → OMS normalized status
FLIPKART_STATUS_MAP: Dict[str, str] = {
    "APPROVED": "CONFIRMED",
    "PACKING_IN_PROGRESS": "PROCESSING",
    "PACKED": "PACKED",
    "READY_TO_DISPATCH": "READY_TO_SHIP",
    "SHIPPED": "SHIPPED",
    "DELIVERED": "DELIVERED",
    "CANCELLED": "CANCELLED",
    "RETURN_REQUESTED": "RETURN_REQUESTED",
}

# Reverse map: OMS status → Flipkart status (for push operations)
OMS_TO_FLIPKART_STATUS: Dict[str, str] = {v: k for k, v in FLIPKART_STATUS_MAP.items()}

# Webhook event-type mapping
FLIPKART_WEBHOOK_EVENT_MAP: Dict[str, str] = {
    "order_approved": "ORDER_CONFIRMED",
    "order_cancelled": "ORDER_CANCELLED",
    "return_initiated": "RETURN_INITIATED",
    "shipment_delivered": "ORDER_DELIVERED",
    "listing_update": "LISTING_UPDATED",
}


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register_adapter("FLIPKART")
class FlipkartAdapter(MarketplaceAdapter):
    """
    Flipkart Seller Hub API Adapter.

    Implements the full MarketplaceAdapter interface for Flipkart:
    - OAuth2 client_credentials authentication with auto-refresh
    - Orders API (fetch, get, dispatch, cancel)
    - Listings/Inventory API (push, get)
    - Returns API (fetch, update)
    - Settlements API
    - Webhook verification and event parsing
    - Health check
    - Rate-limit handling with exponential backoff
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.is_sandbox = config.is_sandbox
        self.endpoint = (
            FLIPKART_SANDBOX_URL if self.is_sandbox else FLIPKART_PRODUCTION_URL
        )
        self._http_client: Optional[httpx.AsyncClient] = None
        self._token_expires_at: Optional[datetime] = None

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:
        """Return the marketplace display name."""
        return "Flipkart"

    @property
    def supported_operations(self) -> List[str]:
        """Return list of all supported operations."""
        return [
            "fetch_orders",
            "get_order",
            "update_order_status",
            "cancel_order",
            "push_inventory",
            "get_inventory",
            "fetch_settlements",
            "fetch_returns",
            "update_return_status",
            "verify_webhook_signature",
            "parse_webhook_event",
            "health_check",
        ]

    # ------------------------------------------------------------------
    # HTTP client management
    # ------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        """Return a reusable async HTTP client, creating one if needed."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=DEFAULT_TIMEOUT,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        return self._http_client

    async def close(self):
        """Close the underlying HTTP client (for graceful shutdown)."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    # ==================================================================
    # Authentication
    # ==================================================================

    async def authenticate(self) -> AuthResult:
        """
        Authenticate with Flipkart using OAuth2 client_credentials grant.

        POST https://api.flipkart.net/oauth-service/oauth/token
        Authorization: Basic base64(client_id:client_secret)
        Content-Type: application/x-www-form-urlencoded
        Body: grant_type=client_credentials&scope=Seller_Api
        """
        try:
            client = await self._get_client()

            if not self.credentials.client_id or not self.credentials.client_secret:
                return AuthResult(
                    success=False,
                    error_message="Missing client_id or client_secret in credentials",
                )

            # Basic auth header
            raw_creds = f"{self.credentials.client_id}:{self.credentials.client_secret}"
            basic_auth = base64.b64encode(raw_creds.encode()).decode()

            response = await client.post(
                FLIPKART_AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "scope": "Seller_Api",
                },
                headers={
                    "Authorization": f"Basic {basic_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get(
                    "error_description",
                    error_data.get("error", f"HTTP {response.status_code}"),
                )
                logger.error(f"Flipkart auth failed ({response.status_code}): {error_msg}")
                return AuthResult(success=False, error_message=error_msg)

            data = response.json()
            expires_in = data.get("expires_in", 43200)  # default 12 hours
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            # Store token in credentials and local cache
            self.credentials.access_token = data["access_token"]
            self._token_expires_at = expires_at
            self.is_authenticated = True

            logger.info(
                f"Flipkart authenticated successfully. "
                f"Token expires in {expires_in}s at {expires_at.isoformat()}"
            )

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer"),
                scope=data.get("scope"),
            )

        except Exception as e:
            self._log_error("authenticate", e)
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        Refresh the access token.

        Flipkart uses client_credentials grant, so refresh is simply
        re-authenticating with the same client_id/client_secret.
        """
        return await self.authenticate()

    def _is_token_expired(self) -> bool:
        """Check whether the cached token has expired (or is about to)."""
        if not self._token_expires_at:
            return True
        # Refresh 5 minutes before actual expiry to avoid race conditions
        return datetime.utcnow() >= (self._token_expires_at - timedelta(minutes=5))

    async def _ensure_authenticated(self):
        """Ensure we have a valid access token, refreshing if needed."""
        if not self.credentials.access_token or self._is_token_expired():
            result = await self.authenticate()
            if not result.success:
                raise Exception(f"Authentication failed: {result.error_message}")

    # ==================================================================
    # Core HTTP request helper
    # ==================================================================

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None,
        *,
        full_url: Optional[str] = None,
        retry_count: int = 0,
    ) -> Dict[str, Any]:
        """
        Make an authenticated request to the Flipkart Seller API.

        Handles:
        - Automatic token refresh on 401
        - Rate-limit retry with exponential backoff on 429
        - Logging of every API call
        """
        await self._ensure_authenticated()

        client = await self._get_client()
        url = full_url if full_url else f"{self.endpoint}{path}"

        headers = {
            "Authorization": f"Bearer {self.credentials.access_token}",
        }

        start_time = time.time()

        try:
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(url, params=params, json=body, headers=headers)
            elif method == "PUT":
                response = await client.put(url, params=params, json=body, headers=headers)
            elif method == "PATCH":
                response = await client.patch(url, params=params, json=body, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, url, response.status_code, duration_ms)

            # -- Track rate-limit headers if present --
            rl_remaining = response.headers.get("X-RateLimit-Remaining")
            rl_reset = response.headers.get("X-RateLimit-Reset")
            if rl_remaining is not None:
                self._rate_limit_remaining = int(rl_remaining)
            if rl_reset is not None:
                try:
                    self._rate_limit_reset = datetime.utcfromtimestamp(int(rl_reset))
                except (ValueError, OSError):
                    pass

            # -- Handle 401: token expired, re-auth and retry once --
            if response.status_code == 401:
                self.is_authenticated = False
                self.credentials.access_token = None
                self._token_expires_at = None

                auth_result = await self.authenticate()
                if auth_result.success:
                    headers["Authorization"] = f"Bearer {self.credentials.access_token}"
                    if method == "GET":
                        response = await client.get(url, params=params, headers=headers)
                    elif method == "POST":
                        response = await client.post(url, params=params, json=body, headers=headers)
                    elif method == "PUT":
                        response = await client.put(url, params=params, json=body, headers=headers)
                    elif method == "PATCH":
                        response = await client.patch(url, params=params, json=body, headers=headers)
                else:
                    raise Exception(
                        f"Re-authentication failed: {auth_result.error_message}"
                    )

            # -- Handle 429: rate-limited, backoff and retry --
            if response.status_code == 429 and retry_count < MAX_RATE_LIMIT_RETRIES:
                retry_after = response.headers.get("Retry-After")
                if retry_after:
                    wait_seconds = float(retry_after)
                else:
                    wait_seconds = RATE_LIMIT_BACKOFF_BASE * (2 ** retry_count)

                logger.warning(
                    f"[Flipkart] Rate-limited on {method} {path}. "
                    f"Retrying in {wait_seconds:.1f}s (attempt {retry_count + 1}/{MAX_RATE_LIMIT_RETRIES})"
                )
                await asyncio.sleep(wait_seconds)
                return await self._make_request(
                    method, path, params=params, body=body,
                    full_url=full_url, retry_count=retry_count + 1,
                )

            # -- Handle other error status codes --
            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                error_msg = (
                    error_data.get("message")
                    or error_data.get("error_description")
                    or error_data.get("error")
                    or f"HTTP {response.status_code}"
                )
                raise Exception(
                    f"Flipkart API error {response.status_code} on {method} {path}: {error_msg}"
                )

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"[Flipkart] Timeout on {method} {path} after {duration_ms:.0f}ms")
            raise Exception(f"Flipkart API request timed out: {method} {path}")
        except httpx.RequestError as e:
            raise Exception(f"Flipkart API request failed: {e}")

    # ==================================================================
    # Order Management
    # ==================================================================

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: Optional[datetime] = None,
        status: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> Tuple[List[MarketplaceOrder], Optional[str]]:
        """
        Fetch orders from Flipkart using the shipments filter API.

        Flipkart uses POST /v3/shipments/filter with filter body.
        Pagination is handled via Flipkart's ``nextPageUrl`` (a full URL) or
        a page-number based cursor that we manage.

        Args:
            from_date: Start date for order search
            to_date: End date (default: now)
            status: Flipkart order status filter (e.g. APPROVED, SHIPPED)
            cursor: Either a nextPageUrl from a previous response or a page number string
            limit: Max orders per page

        Returns:
            Tuple of (orders, next_cursor)
        """
        try:
            # If cursor is a full Flipkart URL (nextPageUrl), call it directly
            if cursor and cursor.startswith("http"):
                response = await self._make_request(
                    "GET", "", full_url=cursor,
                )
            else:
                # Build filter payload
                states = [status] if status else ["APPROVED", "PACKED", "READY_TO_DISPATCH"]
                filter_body: Dict[str, Any] = {
                    "filter": {
                        "type": "preDispatch",
                        "states": states,
                        "orderDate": {
                            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        },
                    },
                    "pagination": {
                        "pageSize": min(limit, 20),  # Flipkart max page size is typically 20
                    },
                }

                if to_date:
                    filter_body["filter"]["orderDate"]["toDate"] = to_date.strftime(
                        "%Y-%m-%dT%H:%M:%S.000Z"
                    )

                # If cursor is a page number string
                if cursor and cursor.isdigit():
                    filter_body["pagination"]["pageNumber"] = int(cursor)

                response = await self._make_request(
                    "POST", "/v3/shipments/filter", body=filter_body,
                )

            # Parse shipments
            orders: List[MarketplaceOrder] = []
            shipments = response.get("shipments", [])

            for shipment_data in shipments:
                order = self._parse_shipment_to_order(shipment_data)
                if order:
                    orders.append(order)

            # Determine next cursor
            # Flipkart returns a nextPageUrl when more pages are available
            next_cursor: Optional[str] = response.get("nextPageUrl")
            if not next_cursor and response.get("hasMore"):
                # Fallback: increment page number
                current_page = int(cursor) if (cursor and cursor.isdigit()) else 1
                next_cursor = str(current_page + 1)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """
        Get a specific order/shipment by its ID.

        GET /v3/shipments/{shipmentId}
        """
        try:
            response = await self._make_request(
                "GET", f"/v3/shipments/{marketplace_order_id}",
            )
            return self._parse_shipment_to_order(response)
        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Update order status on Flipkart — specifically dispatch a shipment.

        POST /v3/shipments/dispatch with shipment details including
        tracking number (AWB), carrier, and invoice info.
        """
        try:
            # Build dispatch body
            shipment_entry: Dict[str, Any] = {
                "shipmentId": update.marketplace_order_id,
                "deliveryPartner": update.carrier_name or "FLIPKART",
                "trackingDetails": {
                    "trackingId": update.tracking_number or "",
                    "dispatchedDate": (
                        update.ship_date or datetime.utcnow()
                    ).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                },
                "invoiceDetails": {
                    "invoiceNumber": update.marketplace_order_id,
                    "invoiceDate": (
                        update.ship_date or datetime.utcnow()
                    ).strftime("%Y-%m-%d"),
                },
            }

            # If specific order items were provided, include them
            if update.items:
                shipment_entry["orderItems"] = [
                    {"orderItemId": item_id} for item_id in update.items
                ]

            body = {"shipments": [shipment_entry]}

            response = await self._make_request(
                "POST", "/v3/shipments/dispatch", body=body,
            )

            # Check response for success
            shipment_statuses = response.get("shipments", [])
            if shipment_statuses:
                first = shipment_statuses[0]
                status = first.get("status", "").upper()
                if status in ("SUCCESS", "DISPATCHED", "OK"):
                    logger.info(
                        f"Flipkart shipment {update.marketplace_order_id} dispatched "
                        f"with AWB {update.tracking_number}"
                    )
                    return True
                else:
                    error_msg = first.get("errorMessage", first.get("error", "Unknown"))
                    logger.error(
                        f"Flipkart dispatch failed for {update.marketplace_order_id}: {error_msg}"
                    )
                    return False

            # If no shipments array in response, check top-level status
            return response.get("status", "").upper() in ("SUCCESS", "OK")

        except Exception as e:
            self._log_error("update_order_status", e)
            return False

    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None,
    ) -> bool:
        """
        Cancel an order/shipment on Flipkart.

        POST /v2/shipments/cancel
        Body includes shipmentId and cancellation reason.
        If specific items are provided, cancel only those orderItemIds.
        """
        try:
            shipment_entry: Dict[str, Any] = {
                "shipmentId": marketplace_order_id,
                "cancellationReason": reason,
            }

            # If specific item IDs were provided, cancel those only
            if items:
                shipment_entry["orderItems"] = [
                    {"orderItemId": item_id, "cancellationReason": reason}
                    for item_id in items
                ]

            body = {"shipments": [shipment_entry]}

            response = await self._make_request(
                "POST", "/v2/shipments/cancel", body=body,
            )

            shipment_statuses = response.get("shipments", [])
            if shipment_statuses:
                first = shipment_statuses[0]
                status = first.get("status", "").upper()
                if status in ("SUCCESS", "CANCELLED", "OK"):
                    logger.info(f"Flipkart order {marketplace_order_id} cancelled: {reason}")
                    return True
                else:
                    error_msg = first.get("errorMessage", first.get("error", "Unknown"))
                    logger.error(
                        f"Flipkart cancel failed for {marketplace_order_id}: {error_msg}"
                    )
                    return False

            return response.get("status", "").upper() in ("SUCCESS", "OK")

        except Exception as e:
            self._log_error("cancel_order", e)
            return False

    # ==================================================================
    # Inventory Management
    # ==================================================================

    async def push_inventory(
        self,
        updates: List[InventoryUpdate],
    ) -> List[InventoryUpdateResult]:
        """
        Push inventory levels to Flipkart via Listings API v3.

        POST /v3/listings/update with SKU-level inventory data.
        Flipkart expects a product-keyed object where each SKU maps to its
        attribute updates (including stock count).
        """
        results: List[InventoryUpdateResult] = []

        if not updates:
            return results

        try:
            # Build the listings update payload
            # Flipkart Listings v3 format:
            # { "listings": { "<sku>": { "inventory": { "stock": <qty> } } } }
            listings_payload: Dict[str, Any] = {}
            for upd in updates:
                listings_payload[upd.marketplace_sku] = {
                    "inventory": {
                        "stock": upd.quantity,
                    },
                }

            body = {"listings": listings_payload}

            response = await self._make_request(
                "POST", "/v3/listings/update", body=body,
            )

            # Parse response — Flipkart returns per-SKU status
            response_listings = response.get("listings", {})

            for upd in updates:
                sku_status = response_listings.get(upd.marketplace_sku, {})
                status_str = (sku_status.get("status") or "").upper()
                success = status_str in ("SUCCESS", "OK")

                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=upd.marketplace_sku,
                        success=success,
                        new_qty=upd.quantity if success else None,
                        acknowledged_qty=upd.quantity if success else None,
                        error_message=(
                            sku_status.get("errorMessage")
                            or sku_status.get("errors", [{}])[0].get("message")
                            if not success
                            else None
                        ),
                        raw_response=sku_status,
                    )
                )

        except Exception as e:
            self._log_error("push_inventory", e)
            # Mark all as failed
            for upd in updates:
                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=upd.marketplace_sku,
                        success=False,
                        error_message=str(e),
                    )
                )

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """
        Get current inventory levels from Flipkart via Listings API v3.

        POST /v3/listings/fetch with a list of SKU IDs, then extract
        the inventory/stock from each listing response.
        """
        inventory: Dict[str, int] = {}

        if not marketplace_skus:
            return inventory

        try:
            # Flipkart expects a POST with SKU IDs to fetch listing details
            body = {"skuIds": marketplace_skus}

            response = await self._make_request(
                "POST", "/v3/listings/fetch", body=body,
            )

            listings = response.get("listings", [])
            # listings can be a list of objects or a dict keyed by SKU
            if isinstance(listings, list):
                for listing in listings:
                    sku = listing.get("sku") or listing.get("skuId")
                    if sku:
                        stock = (
                            listing.get("inventory", {}).get("stock")
                            if isinstance(listing.get("inventory"), dict)
                            else listing.get("inventory", 0)
                        )
                        inventory[sku] = int(stock or 0)
            elif isinstance(listings, dict):
                for sku, listing_data in listings.items():
                    stock = (
                        listing_data.get("inventory", {}).get("stock")
                        if isinstance(listing_data.get("inventory"), dict)
                        else listing_data.get("inventory", 0)
                    )
                    inventory[sku] = int(stock or 0)

        except Exception as e:
            self._log_error("get_inventory", e)

        return inventory

    # ==================================================================
    # Settlements / Finance
    # ==================================================================

    async def fetch_settlements(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[Settlement]:
        """
        Fetch settlement reports from Flipkart.

        GET /v3/settlements?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
        """
        settlements: List[Settlement] = []

        try:
            params = {
                "fromDate": from_date.strftime("%Y-%m-%d"),
                "toDate": to_date.strftime("%Y-%m-%d"),
            }

            response = await self._make_request(
                "GET", "/v3/settlements", params=params,
            )

            for item in response.get("settlements", []):
                settlement_date_raw = item.get("settlementDate")
                settlement_date = self._parse_datetime(
                    settlement_date_raw, fallback=datetime.utcnow()
                )

                settlement = Settlement(
                    settlement_id=item.get("settlementId", ""),
                    settlement_date=settlement_date,
                    period_from=from_date,
                    period_to=to_date,
                    total_orders=int(item.get("totalOrders", 0)),
                    gross_sales=float(item.get("grossSales", 0)),
                    marketplace_fee=float(item.get("marketplaceFee", 0)),
                    shipping_fee=float(item.get("shippingFee", 0)),
                    tax_collected=float(item.get("taxCollected", 0)),
                    refunds=float(item.get("refunds", 0)),
                    net_amount=float(item.get("netAmount", 0)),
                    currency="INR",
                    items=item.get("lineItems", []),
                    raw_data=item,
                )
                settlements.append(settlement)

        except Exception as e:
            self._log_error("fetch_settlements", e)

        return settlements

    # ==================================================================
    # Returns Management
    # ==================================================================

    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None,
    ) -> List[MarketplaceReturn]:
        """
        Fetch return requests from Flipkart.

        POST /v3/returns/filter with date and optional status filter.
        """
        returns: List[MarketplaceReturn] = []

        try:
            filter_body: Dict[str, Any] = {
                "filter": {
                    "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                },
            }

            if status:
                filter_body["filter"]["states"] = [status]

            response = await self._make_request(
                "POST", "/v3/returns/filter", body=filter_body,
            )

            for item in response.get("returns", []):
                initiated_date = self._parse_datetime(
                    item.get("createdDate"), fallback=datetime.utcnow()
                )

                ret = MarketplaceReturn(
                    marketplace_return_id=item.get("returnId", ""),
                    marketplace_order_id=item.get("shipmentId", item.get("orderId", "")),
                    return_reason=item.get("returnReason", ""),
                    return_sub_reason=item.get("returnSubReason"),
                    customer_comments=item.get("customerComments"),
                    return_quantity=int(item.get("quantity", 1)),
                    refund_amount=float(item.get("refundAmount", 0)),
                    status=item.get("status", "INITIATED"),
                    initiated_date=initiated_date,
                    items=item.get("returnItems", []),
                    raw_data=item,
                )
                returns.append(ret)

        except Exception as e:
            self._log_error("fetch_returns", e)

        return returns

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> bool:
        """
        Update a return status on Flipkart.

        POST /v3/returns/action with returnId, action, and optional comments.
        Typical actions: APPROVE, REJECT, COMPLETE.
        """
        try:
            body: Dict[str, Any] = {
                "returnId": marketplace_return_id,
                "action": status,
            }
            if notes:
                body["comments"] = notes

            response = await self._make_request(
                "POST", "/v3/returns/action", body=body,
            )

            result_status = (response.get("status") or "").upper()
            if result_status in ("SUCCESS", "OK"):
                logger.info(
                    f"Flipkart return {marketplace_return_id} updated to '{status}'"
                )
                return True
            else:
                error_msg = response.get("errorMessage", response.get("error", "Unknown"))
                logger.error(
                    f"Flipkart return update failed for {marketplace_return_id}: {error_msg}"
                )
                return False

        except Exception as e:
            self._log_error("update_return_status", e)
            return False

    # ==================================================================
    # Webhook Handling
    # ==================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str],
    ) -> bool:
        """
        Verify a Flipkart webhook/push-notification signature.

        Flipkart signs webhook payloads with HMAC-SHA256 using the
        client_secret as the key. The signature is sent in the
        ``X-Flipkart-Signature`` header (or as the ``signature`` param).
        """
        try:
            secret = self.credentials.client_secret
            if not secret:
                logger.warning("No client_secret available for webhook signature verification")
                return False

            expected = hmac.new(
                secret.encode("utf-8"),
                payload,
                hashlib.sha256,
            ).hexdigest()

            # Constant-time comparison to avoid timing attacks
            return hmac.compare_digest(expected, signature)

        except Exception as e:
            self._log_error("verify_webhook_signature", e)
            return False

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str,
    ) -> Dict[str, Any]:
        """
        Parse a Flipkart webhook event into a standardized format.

        Handles event types:
        - order_approved   -> ORDER_CONFIRMED
        - order_cancelled  -> ORDER_CANCELLED
        - return_initiated -> RETURN_INITIATED
        - shipment_delivered -> ORDER_DELIVERED
        - listing_update   -> LISTING_UPDATED
        """
        normalized_type = FLIPKART_WEBHOOK_EVENT_MAP.get(event_type, event_type.upper())

        event: Dict[str, Any] = {
            "event_type": normalized_type,
            "marketplace": "FLIPKART",
            "raw_event_type": event_type,
            "timestamp": payload.get(
                "timestamp",
                datetime.utcnow().isoformat(),
            ),
        }

        if event_type == "order_approved":
            event["data"] = {
                "marketplace_order_id": payload.get("shipmentId", payload.get("orderId")),
                "order_status": "CONFIRMED",
                "order_items": payload.get("orderItems", []),
            }

        elif event_type == "order_cancelled":
            event["data"] = {
                "marketplace_order_id": payload.get("shipmentId", payload.get("orderId")),
                "order_status": "CANCELLED",
                "cancellation_reason": payload.get("cancellationReason", ""),
                "cancelled_items": payload.get("orderItems", []),
            }

        elif event_type == "return_initiated":
            event["data"] = {
                "marketplace_return_id": payload.get("returnId"),
                "marketplace_order_id": payload.get("shipmentId", payload.get("orderId")),
                "return_reason": payload.get("returnReason", ""),
                "return_quantity": payload.get("quantity", 1),
                "return_items": payload.get("returnItems", []),
            }

        elif event_type == "shipment_delivered":
            event["data"] = {
                "marketplace_order_id": payload.get("shipmentId", payload.get("orderId")),
                "order_status": "DELIVERED",
                "delivery_date": payload.get("deliveryDate"),
            }

        elif event_type == "listing_update":
            event["data"] = {
                "sku": payload.get("sku"),
                "fsn": payload.get("fsn"),
                "update_type": payload.get("updateType"),
                "new_values": payload.get("updatedAttributes", {}),
            }

        else:
            # Unknown event type — pass raw payload through
            event["data"] = payload

        return event

    # ==================================================================
    # Health Check
    # ==================================================================

    async def health_check(self) -> bool:
        """
        Check if the connection to Flipkart is healthy.

        Uses GET /v3/seller/details (lightweight endpoint) to confirm
        the token is valid and the API is reachable.
        """
        try:
            await self._make_request("GET", "/v3/seller/details")
            return True
        except Exception as e:
            logger.error(f"Flipkart health check failed: {e}")
            return False

    # ==================================================================
    # Optional: Listings / Catalog
    # ==================================================================

    async def fetch_listings(
        self,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetch product listings from Flipkart Listings API v3.

        GET /v3/listings/search with pagination.
        """
        try:
            params: Dict[str, Any] = {
                "pageSize": min(limit, 20),
            }
            if cursor:
                params["pageNumber"] = int(cursor)

            response = await self._make_request(
                "GET", "/v3/listings/search", params=params,
            )

            listings = response.get("listings", [])
            has_more = response.get("hasMore", False)
            next_cursor: Optional[str] = None
            if has_more:
                current_page = int(cursor) if cursor else 1
                next_cursor = str(current_page + 1)

            return listings, next_cursor

        except Exception as e:
            self._log_error("fetch_listings", e)
            raise

    async def update_listing_price(
        self,
        marketplace_sku: str,
        price: float,
        mrp: Optional[float] = None,
    ) -> bool:
        """
        Update listing price on Flipkart.

        POST /v3/listings/update with price attributes.
        """
        try:
            listing_data: Dict[str, Any] = {
                "pricing": {
                    "sellingPrice": price,
                },
            }
            if mrp is not None:
                listing_data["pricing"]["mrp"] = mrp

            body = {
                "listings": {
                    marketplace_sku: listing_data,
                },
            }

            response = await self._make_request(
                "POST", "/v3/listings/update", body=body,
            )

            sku_status = response.get("listings", {}).get(marketplace_sku, {})
            return (sku_status.get("status") or "").upper() in ("SUCCESS", "OK")

        except Exception as e:
            self._log_error("update_listing_price", e)
            return False

    # ==================================================================
    # Private helpers
    # ==================================================================

    def _normalize_status(self, flipkart_status: str) -> str:
        """
        Map a Flipkart order status to the OMS normalized status.

        Falls back to the original status string (uppercased) if no mapping
        is found.
        """
        return FLIPKART_STATUS_MAP.get(flipkart_status.upper(), flipkart_status.upper())

    def _parse_shipment_to_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """
        Parse a Flipkart shipment response into a standardized MarketplaceOrder.

        Handles the Flipkart v3 shipment format with:
        - orderItems[]  (each has priceComponents, SKU, quantity, etc.)
        - deliveryAddress
        - dispatchByDate, orderDate
        - paymentType, fulfillmentType
        """
        try:
            order_items_raw = data.get("orderItems", [])
            if not order_items_raw:
                return None

            address = data.get("deliveryAddress", {})

            # Customer name
            first_name = address.get("firstName", "")
            last_name = address.get("lastName", "")
            customer_name = f"{first_name} {last_name}".strip() or "Unknown"

            # Parse items and compute totals
            items: List[Dict[str, Any]] = []
            subtotal = 0.0
            shipping_total = 0.0
            tax_total = 0.0
            discount_total = 0.0

            for item in order_items_raw:
                price_components = item.get("priceComponents", {})
                selling_price = float(price_components.get("sellingPrice", 0))
                shipping_charge = float(price_components.get("shippingCharge", 0))
                tax = float(price_components.get("taxAmount", 0))
                discount = float(price_components.get("discount", 0))
                quantity = int(item.get("quantity", 1))

                subtotal += selling_price * quantity
                shipping_total += shipping_charge
                tax_total += tax
                discount_total += discount

                items.append({
                    "marketplace_line_id": item.get("orderItemId", ""),
                    "marketplace_sku": item.get("sku", ""),
                    "fsn": item.get("fsn", ""),
                    "title": item.get("title", item.get("productTitle", "")),
                    "quantity": quantity,
                    "unit_price": selling_price,
                    "total_price": selling_price * quantity,
                    "tax_amount": tax,
                    "discount_amount": discount,
                    "shipping_amount": shipping_charge,
                    "hsn_code": item.get("hsnCode"),
                    "item_status": item.get("status"),
                })

            total_amount = subtotal + shipping_total + tax_total - discount_total

            # Dates
            order_date = self._parse_datetime(
                data.get("orderDate"), fallback=datetime.utcnow()
            )
            ship_by_date = self._parse_datetime(data.get("dispatchByDate"))
            promised_delivery_date = self._parse_datetime(
                data.get("deliveryDate") or data.get("promisedDeliveryDate")
            )

            # Fulfillment type
            fk_fulfillment = data.get("fulfillmentType", "SELLER")
            if fk_fulfillment in ("FA", "FLIPKART_ASSURED", "MARKETPLACE"):
                fulfillment = FulfillmentType.MARKETPLACE
            else:
                fulfillment = FulfillmentType.SELLER

            # Normalize status
            raw_status = data.get("status", "PENDING")
            normalized_status = self._normalize_status(raw_status)

            return MarketplaceOrder(
                marketplace_order_id=data.get("shipmentId", data.get("orderId", "")),
                marketplace="FLIPKART",
                order_status=normalized_status,
                order_date=order_date,
                customer_name=customer_name,
                customer_email=address.get("email"),
                customer_phone=address.get("phone"),
                shipping_address={
                    "name": customer_name,
                    "address_line1": address.get("addressLine1", ""),
                    "address_line2": address.get("addressLine2", ""),
                    "city": address.get("city", ""),
                    "state": address.get("state", ""),
                    "postal_code": address.get("pincode", ""),
                    "country": "IN",
                    "phone": address.get("phone"),
                    "landmark": address.get("landmark"),
                },
                billing_address={
                    "name": customer_name,
                    "address_line1": address.get("addressLine1", ""),
                    "city": address.get("city", ""),
                    "state": address.get("state", ""),
                    "postal_code": address.get("pincode", ""),
                    "country": "IN",
                },
                items=items,
                subtotal=round(subtotal, 2),
                shipping_amount=round(shipping_total, 2),
                tax_amount=round(tax_total, 2),
                discount_amount=round(discount_total, 2),
                total_amount=round(total_amount, 2),
                currency="INR",
                payment_method=data.get("paymentType", "PREPAID"),
                is_cod=(data.get("paymentType", "").upper() == "COD"),
                fulfillment_type=fulfillment,
                promised_delivery_date=promised_delivery_date,
                ship_by_date=ship_by_date,
                raw_data=data,
            )

        except Exception as e:
            logger.error(f"Failed to parse Flipkart shipment data: {e}", exc_info=True)
            return None

    @staticmethod
    def _parse_datetime(
        value: Optional[str], *, fallback: Optional[datetime] = None
    ) -> Optional[datetime]:
        """
        Safely parse an ISO-8601 / Flipkart datetime string.

        Handles:
        - "2026-01-15T10:30:00.000Z"
        - "2026-01-15T10:30:00+05:30"
        - "2026-01-15"
        """
        if not value:
            return fallback
        try:
            # Replace trailing 'Z' with UTC offset for fromisoformat
            cleaned = value.replace("Z", "+00:00")
            return datetime.fromisoformat(cleaned)
        except (ValueError, TypeError):
            try:
                return datetime.strptime(value, "%Y-%m-%d")
            except (ValueError, TypeError):
                return fallback
