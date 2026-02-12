"""
Amazon SP-API Adapter
Complete implementation of MarketplaceAdapter for Amazon Selling Partner API.

Covers:
- LWA OAuth2 authentication (Login with Amazon)
- Orders API v0 (fetch, get, ship-confirm via Feeds)
- Feeds API (POST_ORDER_FULFILLMENT_DATA, POST_INVENTORY_AVAILABILITY_DATA)
- FBA Inventory API v1 (summaries)
- Finances API v0 (financial event groups)
- Reports API 2021-06-30 (FBA / FBM returns)
- Catalog Items API 2022-04-01
- Notifications API v1 (subscriptions)
- Sellers API v1 (health check via marketplaceParticipations)
- SQS / EventBridge webhook verification
- Rate-limit tracking via x-amzn-RateLimit-Limit header
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import hashlib
import hmac
import json
import time
import asyncio
import xml.etree.ElementTree as ET
from urllib.parse import urlencode, quote

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
# Region / Marketplace constants
# ---------------------------------------------------------------------------
AMAZON_ENDPOINTS: Dict[str, str] = {
    "na": "https://sellingpartnerapi-na.amazon.com",
    "eu": "https://sellingpartnerapi-eu.amazon.com",
    "fe": "https://sellingpartnerapi-fe.amazon.com",
    # India uses the EU endpoint
    "in": "https://sellingpartnerapi-eu.amazon.com",
}

AMAZON_MARKETPLACE_IDS: Dict[str, str] = {
    "in": "A21TJRUUN4KGV",      # Amazon.in
    "us": "ATVPDKIKX0DER",      # Amazon.com
    "ca": "A2EUQ1WTGCTBG2",     # Amazon.ca
    "mx": "A1AM78C64UM0Y8",     # Amazon.com.mx
    "br": "A2Q3Y263D00KWC",     # Amazon.com.br
    "uk": "A1F83G8C2ARO7P",     # Amazon.co.uk
    "de": "A1PA6795UKMFR9",     # Amazon.de
    "fr": "A13V1IB3VIYZZH",     # Amazon.fr
    "it": "APJ6JRA9NG5V4",      # Amazon.it
    "es": "A1RKKUPIHCS9HS",     # Amazon.es
    "nl": "A1805IZSGTT6HS",     # Amazon.nl
    "se": "A2NODRKZP88ZB9",     # Amazon.se
    "pl": "A1C3SOZRARQ6R3",     # Amazon.pl
    "jp": "A1VC38T7YXB528",     # Amazon.co.jp
    "au": "A39IBJ37TRP1C6",     # Amazon.com.au
    "sg": "A19VAU5U5O7RUS",     # Amazon.sg
}

# Seller Central authorize URLs per region (used for OAuth consent)
SELLER_CENTRAL_URLS: Dict[str, str] = {
    "in": "https://sellercentral.amazon.in",
    "us": "https://sellercentral.amazon.com",
    "uk": "https://sellercentral.amazon.co.uk",
    "de": "https://sellercentral.amazon.de",
    "jp": "https://sellercentral.amazon.co.jp",
    "au": "https://sellercentral.amazon.com.au",
}

# LWA (Login With Amazon) token endpoint
LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"
LWA_AUTHORIZE_URL = "https://www.amazon.com/ap/oa"

# Amazon order status -> normalised OMS status
AMAZON_STATUS_MAP: Dict[str, str] = {
    "Pending": "PENDING",
    "Unshipped": "CONFIRMED",
    "PartiallyShipped": "PARTIALLY_SHIPPED",
    "Shipped": "SHIPPED",
    "InvoiceUnconfirmed": "PENDING",
    "Canceled": "CANCELLED",
    "Unfulfillable": "CANCELLED",
}

# Default rate-limit back-off (seconds)
DEFAULT_RATE_LIMIT_BACKOFF = 2.0
MAX_RETRIES = 3


# ---------------------------------------------------------------------------
# XML feed builders (minimal; kept inside the module)
# ---------------------------------------------------------------------------

def _build_fulfillment_feed(
    seller_id: str,
    order_id: str,
    ship_date: datetime,
    carrier_code: str,
    tracking_number: Optional[str],
    items: Optional[List[str]] = None,
) -> str:
    """Build POST_ORDER_FULFILLMENT_DATA XML envelope."""
    ship_date_str = ship_date.strftime("%Y-%m-%dT%H:%M:%S")
    item_xml = ""
    if items:
        for line_id in items:
            item_xml += f"""
            <Item>
                <AmazonOrderItemCode>{line_id}</AmazonOrderItemCode>
            </Item>"""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
    <Header>
        <DocumentVersion>1.01</DocumentVersion>
        <MerchantIdentifier>{seller_id}</MerchantIdentifier>
    </Header>
    <MessageType>OrderFulfillment</MessageType>
    <Message>
        <MessageID>1</MessageID>
        <OrderFulfillment>
            <AmazonOrderID>{order_id}</AmazonOrderID>
            <FulfillmentDate>{ship_date_str}</FulfillmentDate>
            <FulfillmentData>
                <CarrierCode>{carrier_code}</CarrierCode>
                <ShippingMethod>Standard</ShippingMethod>
                {f'<ShipperTrackingNumber>{tracking_number}</ShipperTrackingNumber>' if tracking_number else ''}
            </FulfillmentData>{item_xml}
        </OrderFulfillment>
    </Message>
</AmazonEnvelope>"""


def _build_inventory_feed(
    seller_id: str,
    updates: List[InventoryUpdate],
) -> str:
    """Build POST_INVENTORY_AVAILABILITY_DATA XML envelope."""
    messages = []
    for idx, update in enumerate(updates, start=1):
        messages.append(f"""
    <Message>
        <MessageID>{idx}</MessageID>
        <OperationType>Update</OperationType>
        <Inventory>
            <SKU>{update.marketplace_sku}</SKU>
            <Quantity>{update.quantity}</Quantity>
            <FulfillmentLatency>1</FulfillmentLatency>
        </Inventory>
    </Message>""")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
    <Header>
        <DocumentVersion>1.01</DocumentVersion>
        <MerchantIdentifier>{seller_id}</MerchantIdentifier>
    </Header>
    <MessageType>Inventory</MessageType>{''.join(messages)}
</AmazonEnvelope>"""


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register_adapter("AMAZON")
class AmazonAdapter(MarketplaceAdapter):
    """
    Amazon Selling Partner API (SP-API) adapter.

    Implements the full MarketplaceAdapter interface with:
    - LWA OAuth2 authentication & token refresh
    - Orders API v0 (fetch, get, status update via Feeds)
    - Feeds API v2021-06-30 (fulfillment and inventory feeds)
    - FBA Inventory API v1
    - Finances API v0
    - Reports API 2021-06-30 (returns data)
    - Catalog Items API 2022-04-01
    - Notifications API v1
    - Sellers API v1 (health check)
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)

        self.region: str = (config.credentials.region or "in").lower()
        self.endpoint: str = (
            config.api_endpoint
            or AMAZON_ENDPOINTS.get(self.region, AMAZON_ENDPOINTS["in"])
        )
        self.marketplace_id: str = (
            config.credentials.additional.get("marketplace_id")
            or AMAZON_MARKETPLACE_IDS.get(self.region, AMAZON_MARKETPLACE_IDS["in"])
        )
        self.seller_id: str = config.credentials.seller_id or ""
        self._http_client: Optional[httpx.AsyncClient] = None
        self._token_expires_at: Optional[datetime] = None

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:
        return "Amazon"

    @property
    def supported_operations(self) -> List[str]:
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
            "fetch_listings",
            "verify_webhook_signature",
            "parse_webhook_event",
            "health_check",
        ]

    # ------------------------------------------------------------------
    # HTTP client helpers
    # ------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        """Return (or create) a shared async HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(30.0, connect=10.0),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "CJDQuick-OMS/1.0",
                },
            )
        return self._http_client

    async def _close_client(self) -> None:
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    def _is_token_expired(self) -> bool:
        """Check whether the current access token has expired."""
        if not self._token_expires_at:
            return True
        # Refresh 60s before actual expiry to avoid edge-case failures
        return datetime.utcnow() >= (self._token_expires_at - timedelta(seconds=60))

    async def _ensure_authenticated(self) -> None:
        """Ensure we have a valid access token, refreshing if needed."""
        if not self.credentials.access_token or self._is_token_expired():
            result = await self.authenticate()
            if not result.success:
                raise Exception(f"Authentication failed: {result.error_message}")

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Any] = None,
        content: Optional[bytes] = None,
        extra_headers: Optional[Dict[str, str]] = None,
        retry_count: int = 0,
    ) -> Dict[str, Any]:
        """
        Make an authenticated request to Amazon SP-API.

        Handles:
        - Auto-authentication / token refresh
        - Rate-limit header tracking
        - 429 back-off with retry
        - 403 token-expired retry
        """
        await self._ensure_authenticated()

        client = await self._get_client()
        url = f"{self.endpoint}{path}"

        headers: Dict[str, str] = {
            "x-amz-access-token": self.credentials.access_token or "",
            "x-amz-date": datetime.utcnow().strftime("%Y%m%dT%H%M%SZ"),
        }
        if extra_headers:
            headers.update(extra_headers)

        start_time = time.time()

        try:
            kwargs: Dict[str, Any] = {"params": params, "headers": headers}
            if content is not None:
                kwargs["content"] = content
            elif body is not None:
                kwargs["json"] = body

            response = await client.request(method, url, **kwargs)

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # ---- rate-limit tracking ----
            rate_header = response.headers.get("x-amzn-RateLimit-Limit")
            if rate_header:
                try:
                    self._rate_limit_remaining = int(float(rate_header))
                except (ValueError, TypeError):
                    pass

            # ---- 429 Too Many Requests ----
            if response.status_code == 429:
                if retry_count < MAX_RETRIES:
                    retry_after = float(
                        response.headers.get("Retry-After", DEFAULT_RATE_LIMIT_BACKOFF)
                    )
                    self._rate_limit_reset = datetime.utcnow() + timedelta(seconds=retry_after)
                    logger.warning(
                        f"[Amazon] Rate-limited on {method} {path}. "
                        f"Retrying in {retry_after}s (attempt {retry_count + 1}/{MAX_RETRIES})"
                    )
                    await asyncio.sleep(retry_after)
                    return await self._make_request(
                        method, path, params=params, body=body,
                        content=content, extra_headers=extra_headers,
                        retry_count=retry_count + 1,
                    )
                raise Exception(f"Rate-limited after {MAX_RETRIES} retries on {method} {path}")

            # ---- 403 Forbidden (expired token) ----
            if response.status_code == 403 and retry_count < 1:
                logger.info("[Amazon] Got 403, refreshing token and retrying")
                self.is_authenticated = False
                self.credentials.access_token = None
                return await self._make_request(
                    method, path, params=params, body=body,
                    content=content, extra_headers=extra_headers,
                    retry_count=retry_count + 1,
                )

            # ---- General error ----
            if response.status_code >= 400:
                error_body = response.json() if response.content else {}
                errors = error_body.get("errors", [])
                msg = errors[0].get("message", "Unknown error") if errors else str(error_body)
                raise Exception(f"SP-API {response.status_code} on {method} {path}: {msg}")

            if not response.content:
                return {}
            return response.json()

        except httpx.TimeoutException:
            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, 0, duration_ms)
            raise Exception(f"Request timed out: {method} {path}")
        except httpx.RequestError as exc:
            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, 0, duration_ms)
            raise Exception(f"Request failed: {method} {path} - {exc}")

    # ==================================================================
    # Authentication
    # ==================================================================

    async def authenticate(self) -> AuthResult:
        """
        Authenticate with Amazon via LWA refresh_token grant.

        If no refresh_token is available, returns a failure result so the
        caller can initiate the OAuth consent flow instead.
        """
        try:
            if not self.credentials.refresh_token:
                return AuthResult(
                    success=False,
                    error_message="No refresh token available. Initiate OAuth consent flow.",
                )
            return await self.refresh_token()
        except Exception as exc:
            self._log_error("authenticate", exc)
            return AuthResult(success=False, error_message=str(exc))

    async def refresh_token(self) -> AuthResult:
        """
        Refresh the access_token by POSTing to the LWA token endpoint
        with grant_type=refresh_token.
        """
        try:
            client = await self._get_client()

            payload = {
                "grant_type": "refresh_token",
                "refresh_token": self.credentials.refresh_token,
                "client_id": self.credentials.client_id,
                "client_secret": self.credentials.client_secret,
            }

            response = await client.post(
                LWA_TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                return AuthResult(
                    success=False,
                    error_message=error_data.get(
                        "error_description",
                        f"LWA token refresh failed ({response.status_code})",
                    ),
                )

            data = response.json()
            expires_in = int(data.get("expires_in", 3600))
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            # Persist on instance
            self.credentials.access_token = data["access_token"]
            self._token_expires_at = expires_at
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                refresh_token=self.credentials.refresh_token,  # LWA keeps the same refresh token
                expires_at=expires_at,
                token_type=data.get("token_type", "bearer"),
            )

        except Exception as exc:
            self._log_error("refresh_token", exc)
            return AuthResult(success=False, error_message=str(exc))

    def get_oauth_authorize_url(self, redirect_uri: str, state: str) -> str:
        """
        Build the LWA OAuth2 authorization URL used by Seller Central
        app-authorization flow.
        """
        seller_central = SELLER_CENTRAL_URLS.get(self.region, SELLER_CENTRAL_URLS["in"])
        application_id = self.credentials.additional.get("application_id", "")

        # Amazon SP-API uses the Seller Central consent page
        params = {
            "application_id": application_id,
            "state": state,
            "redirect_uri": redirect_uri,
        }
        return f"{seller_central}/apps/authorize/consent?{urlencode(params)}"

    async def exchange_code_for_token(self, code: str, redirect_uri: str) -> AuthResult:
        """
        Exchange an authorization_code (from the OAuth callback) for
        access_token + refresh_token via LWA.
        """
        try:
            client = await self._get_client()

            payload = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.credentials.client_id,
                "client_secret": self.credentials.client_secret,
            }

            response = await client.post(
                LWA_TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                return AuthResult(
                    success=False,
                    error_message=error_data.get(
                        "error_description",
                        f"Token exchange failed ({response.status_code})",
                    ),
                )

            data = response.json()
            expires_in = int(data.get("expires_in", 3600))
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            # Persist on instance
            self.credentials.access_token = data["access_token"]
            self.credentials.refresh_token = data["refresh_token"]
            self._token_expires_at = expires_at
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                refresh_token=data["refresh_token"],
                expires_at=expires_at,
                token_type=data.get("token_type", "bearer"),
            )

        except Exception as exc:
            self._log_error("exchange_code_for_token", exc)
            return AuthResult(success=False, error_message=str(exc))

    # ==================================================================
    # Orders
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
        Fetch orders via GET /orders/v0/orders.

        Paginates using Amazon's NextToken mechanism.  Each order is enriched
        with its line items via a follow-up orderItems call.
        """
        try:
            params: Dict[str, Any] = {
                "MarketplaceIds": self.marketplace_id,
                "CreatedAfter": from_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "MaxResultsPerPage": min(limit, 100),  # SP-API max is 100
            }

            if to_date:
                params["CreatedBefore"] = to_date.strftime("%Y-%m-%dT%H:%M:%SZ")

            if status:
                # Amazon accepts comma-separated statuses
                params["OrderStatuses"] = status

            if cursor:
                params["NextToken"] = cursor

            response = await self._make_request("GET", "/orders/v0/orders", params=params)
            payload = response.get("payload", {})

            orders: List[MarketplaceOrder] = []
            for order_data in payload.get("Orders", []):
                order = self._parse_order(order_data)
                if order is None:
                    continue

                # Fetch line items
                try:
                    items_resp = await self._make_request(
                        "GET",
                        f"/orders/v0/orders/{order_data['AmazonOrderId']}/orderItems",
                    )
                    raw_items = items_resp.get("payload", {}).get("OrderItems", [])
                    parsed_items = [self._parse_order_item(it) for it in raw_items]
                    order.items = parsed_items

                    # Recompute totals from items
                    order.subtotal = sum(
                        float(it.get("unit_price", 0)) * int(it.get("quantity", 1))
                        for it in parsed_items
                    )
                    order.tax_amount = sum(
                        float(it.get("tax_amount", 0)) for it in parsed_items
                    )
                    order.shipping_amount = sum(
                        float(it.get("shipping_amount", 0)) for it in parsed_items
                    )
                    order.discount_amount = sum(
                        float(it.get("discount_amount", 0)) for it in parsed_items
                    )
                except Exception as items_err:
                    logger.warning(
                        f"[Amazon] Could not fetch items for order "
                        f"{order_data.get('AmazonOrderId')}: {items_err}"
                    )

                orders.append(order)

            next_token: Optional[str] = payload.get("NextToken")
            return orders, next_token

        except Exception as exc:
            self._log_error("fetch_orders", exc)
            raise

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """
        Get a single order by ID via GET /orders/v0/orders/{orderId},
        then enrich with orderItems.
        """
        try:
            response = await self._make_request(
                "GET", f"/orders/v0/orders/{marketplace_order_id}"
            )
            order_data = response.get("payload")
            if not order_data:
                return None

            order = self._parse_order(order_data)
            if order is None:
                return None

            # Fetch line items
            items_resp = await self._make_request(
                "GET", f"/orders/v0/orders/{marketplace_order_id}/orderItems"
            )
            raw_items = items_resp.get("payload", {}).get("OrderItems", [])
            parsed_items = [self._parse_order_item(it) for it in raw_items]
            order.items = parsed_items

            # Recompute totals
            order.subtotal = sum(
                float(it.get("unit_price", 0)) * int(it.get("quantity", 1))
                for it in parsed_items
            )
            order.tax_amount = sum(float(it.get("tax_amount", 0)) for it in parsed_items)
            order.shipping_amount = sum(float(it.get("shipping_amount", 0)) for it in parsed_items)
            order.discount_amount = sum(float(it.get("discount_amount", 0)) for it in parsed_items)

            return order

        except Exception as exc:
            self._log_error("get_order", exc)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Mark an order as shipped by submitting a POST_ORDER_FULFILLMENT_DATA
        feed via the Feeds API (v2021-06-30).

        Steps:
        1. Create a feed document (get an upload URL).
        2. Upload the fulfillment XML to the pre-signed URL.
        3. Create a feed referencing the feed document.
        """
        try:
            feed_xml = _build_fulfillment_feed(
                seller_id=self.seller_id,
                order_id=update.marketplace_order_id,
                ship_date=update.ship_date or datetime.utcnow(),
                carrier_code=update.carrier_name or "Other",
                tracking_number=update.tracking_number,
                items=update.items,
            )

            feed_doc_id = await self._create_and_upload_feed(
                feed_xml, "POST_ORDER_FULFILLMENT_DATA"
            )
            if not feed_doc_id:
                return False

            logger.info(
                f"[Amazon] Fulfillment feed submitted for order "
                f"{update.marketplace_order_id} (feedDocId={feed_doc_id})"
            )
            return True

        except Exception as exc:
            self._log_error("update_order_status", exc)
            return False

    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None,
    ) -> bool:
        """
        Cancel an order on Amazon.

        Amazon SP-API does not provide a direct seller-initiated cancellation
        endpoint for marketplace orders.  Sellers can only acknowledge
        cancellations that buyers have initiated.  Return False to signal
        that the operation is not supported.
        """
        logger.warning(
            f"[Amazon] Direct order cancellation is not supported via SP-API. "
            f"Order {marketplace_order_id} must be cancelled through Seller Central "
            f"or will be auto-cancelled if not shipped by deadline. Reason: {reason}"
        )
        return False

    # ------------------------------------------------------------------
    # Order parsing helpers
    # ------------------------------------------------------------------

    def _parse_order(self, data: Dict[str, Any]) -> Optional[MarketplaceOrder]:
        """Convert raw Amazon order JSON to MarketplaceOrder."""
        try:
            shipping_address = data.get("ShippingAddress", {})
            order_total = data.get("OrderTotal", {})

            raw_status = data.get("OrderStatus", "Pending")
            normalised_status = AMAZON_STATUS_MAP.get(raw_status, "PENDING")

            # Parse dates safely
            order_date = self._parse_iso_date(data.get("PurchaseDate"))
            promised_date = self._parse_iso_date(data.get("LatestDeliveryDate"))
            ship_by = self._parse_iso_date(data.get("LatestShipDate"))

            fulfillment_channel = data.get("FulfillmentChannel", "MFN")
            fulfillment_type = (
                FulfillmentType.MARKETPLACE
                if fulfillment_channel == "AFN"
                else FulfillmentType.SELLER
            )

            payment_method = data.get("PaymentMethod", "Other")
            is_cod = payment_method == "COD"

            return MarketplaceOrder(
                marketplace_order_id=data["AmazonOrderId"],
                marketplace="AMAZON",
                order_status=normalised_status,
                order_date=order_date or datetime.utcnow(),
                customer_name=shipping_address.get("Name", "Amazon Customer"),
                customer_email=data.get("BuyerEmail"),
                customer_phone=shipping_address.get("Phone"),
                shipping_address={
                    "name": shipping_address.get("Name"),
                    "address_line1": shipping_address.get("AddressLine1"),
                    "address_line2": shipping_address.get("AddressLine2"),
                    "address_line3": shipping_address.get("AddressLine3"),
                    "city": shipping_address.get("City"),
                    "district": shipping_address.get("District"),
                    "state": shipping_address.get("StateOrRegion"),
                    "postal_code": shipping_address.get("PostalCode"),
                    "country": shipping_address.get("CountryCode"),
                    "phone": shipping_address.get("Phone"),
                },
                total_amount=self._safe_float(order_total.get("Amount", 0)),
                currency=order_total.get("CurrencyCode", "INR"),
                payment_method=payment_method,
                is_cod=is_cod,
                fulfillment_type=fulfillment_type,
                promised_delivery_date=promised_date,
                ship_by_date=ship_by,
                raw_data=data,
            )
        except Exception as exc:
            logger.error(f"[Amazon] Failed to parse order: {exc}", exc_info=True)
            return None

    def _parse_order_item(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert raw Amazon OrderItem to a normalised dict."""
        quantity = int(data.get("QuantityOrdered", 1))
        unit_price = self._safe_float(data.get("ItemPrice", {}).get("Amount", 0))
        # Amazon ItemPrice is already total for all units; derive unit price
        if quantity > 0 and unit_price > 0:
            per_unit = round(unit_price / quantity, 2)
        else:
            per_unit = unit_price

        return {
            "marketplace_line_id": data.get("OrderItemId", ""),
            "marketplace_sku": data.get("SellerSKU", ""),
            "asin": data.get("ASIN", ""),
            "title": data.get("Title", ""),
            "quantity": quantity,
            "unit_price": per_unit,
            "total_price": unit_price,
            "tax_amount": self._safe_float(data.get("ItemTax", {}).get("Amount", 0)),
            "discount_amount": self._safe_float(
                data.get("PromotionDiscount", {}).get("Amount", 0)
            ),
            "shipping_amount": self._safe_float(
                data.get("ShippingPrice", {}).get("Amount", 0)
            ),
            "shipping_tax": self._safe_float(
                data.get("ShippingTax", {}).get("Amount", 0)
            ),
            "shipping_discount": self._safe_float(
                data.get("ShippingDiscount", {}).get("Amount", 0)
            ),
            "item_status": data.get("QuantityShipped", 0) > 0 and "SHIPPED" or "UNSHIPPED",
            "fulfillment_type": (
                "MARKETPLACE" if data.get("FulfillmentChannel") == "AFN" else "SELLER"
            ),
            "condition": data.get("ConditionId"),
        }

    # ==================================================================
    # Inventory
    # ==================================================================

    async def push_inventory(
        self, updates: List[InventoryUpdate]
    ) -> List[InventoryUpdateResult]:
        """
        Push inventory quantities to Amazon using the Feeds API with
        POST_INVENTORY_AVAILABILITY_DATA feed type.
        """
        results: List[InventoryUpdateResult] = []

        if not updates:
            return results

        try:
            feed_xml = _build_inventory_feed(self.seller_id, updates)
            feed_doc_id = await self._create_and_upload_feed(
                feed_xml, "POST_INVENTORY_AVAILABILITY_DATA"
            )

            if feed_doc_id:
                for update in updates:
                    results.append(
                        InventoryUpdateResult(
                            marketplace_sku=update.marketplace_sku,
                            success=True,
                            new_qty=update.quantity,
                            raw_response={"feedDocumentId": feed_doc_id},
                        )
                    )
            else:
                for update in updates:
                    results.append(
                        InventoryUpdateResult(
                            marketplace_sku=update.marketplace_sku,
                            success=False,
                            error_message="Feed document creation failed",
                        )
                    )

        except Exception as exc:
            self._log_error("push_inventory", exc)
            for update in updates:
                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=update.marketplace_sku,
                        success=False,
                        error_message=str(exc),
                    )
                )

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """
        Get current inventory levels via GET /fba/inventory/v1/summaries.

        Note: This returns FBA (AFN) inventory.  For MFN (seller-fulfilled)
        SKUs the quantity is what the seller last pushed via feed.
        """
        inventory: Dict[str, int] = {}
        if not marketplace_skus:
            return inventory

        try:
            # SP-API limits sellerSkus to 50 per call
            chunk_size = 50
            for i in range(0, len(marketplace_skus), chunk_size):
                chunk = marketplace_skus[i : i + chunk_size]

                params: Dict[str, Any] = {
                    "details": "true",
                    "granularityType": "Marketplace",
                    "granularityId": self.marketplace_id,
                    "sellerSkus": ",".join(chunk),
                }

                response = await self._make_request(
                    "GET", "/fba/inventory/v1/summaries", params=params
                )

                for item in response.get("payload", {}).get("inventorySummaries", []):
                    sku = item.get("sellerSku")
                    if not sku:
                        continue
                    details = item.get("inventoryDetails", {})
                    fulfillable = int(details.get("fulfillableQuantity", 0))
                    inventory[sku] = fulfillable

        except Exception as exc:
            self._log_error("get_inventory", exc)

        return inventory

    # ==================================================================
    # Settlements / Finance
    # ==================================================================

    async def fetch_settlements(
        self, from_date: datetime, to_date: datetime
    ) -> List[Settlement]:
        """
        Fetch financial event groups via GET /finances/v0/financialEventGroups.
        """
        settlements: List[Settlement] = []

        try:
            params: Dict[str, Any] = {
                "FinancialEventGroupStartedAfter": from_date.strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                "FinancialEventGroupStartedBefore": to_date.strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                "MaxResultsPerPage": 100,
            }

            next_token: Optional[str] = None

            while True:
                if next_token:
                    params["NextToken"] = next_token

                response = await self._make_request(
                    "GET", "/finances/v0/financialEventGroups", params=params
                )
                payload = response.get("payload", {})

                for group in payload.get("FinancialEventGroupList", []):
                    group_start = self._parse_iso_date(
                        group.get("FinancialEventGroupStart")
                    )
                    group_end = self._parse_iso_date(
                        group.get("FinancialEventGroupEnd")
                    )

                    original = group.get("OriginalTotal", {})
                    converted = group.get("ConvertedTotal", {})
                    beginning_balance = group.get("BeginningBalance", {})

                    settlement = Settlement(
                        settlement_id=group.get("FinancialEventGroupId", ""),
                        settlement_date=group_end or to_date,
                        period_from=group_start or from_date,
                        period_to=group_end or to_date,
                        total_orders=int(group.get("TraceId", "0") or "0"),
                        gross_sales=self._safe_float(original.get("CurrencyAmount", 0)),
                        net_amount=self._safe_float(converted.get("CurrencyAmount", 0)),
                        currency=converted.get("CurrencyCode", "INR"),
                        raw_data=group,
                    )
                    settlements.append(settlement)

                next_token = payload.get("NextToken")
                if not next_token:
                    break

        except Exception as exc:
            self._log_error("fetch_settlements", exc)

        return settlements

    # ==================================================================
    # Returns
    # ==================================================================

    async def fetch_returns(
        self, from_date: datetime, status: Optional[str] = None
    ) -> List[MarketplaceReturn]:
        """
        Fetch returns using the Reports API.

        Amazon does not expose a real-time returns-list endpoint.  Instead
        we request a GET_FBA_MYI_ALL_INVENTORY_DATA or
        GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE report.

        For simplicity, this implementation requests the report and, if a
        previously-generated report exists, downloads + parses it.  Full
        async report polling is left for the SyncCoordinator.
        """
        returns: List[MarketplaceReturn] = []

        try:
            # Step 1: Request a returns report
            report_type = "GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE"
            report_body = {
                "reportType": report_type,
                "marketplaceIds": [self.marketplace_id],
                "dataStartTime": from_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "dataEndTime": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

            create_resp = await self._make_request(
                "POST", "/reports/2021-06-30/reports", body=report_body
            )
            report_id = create_resp.get("reportId")

            if not report_id:
                logger.warning("[Amazon] Could not create returns report")
                return returns

            # Step 2: Poll for report completion (up to 5 attempts, 10s apart)
            report_doc_id: Optional[str] = None
            for _ in range(5):
                await asyncio.sleep(10)
                report_resp = await self._make_request(
                    "GET", f"/reports/2021-06-30/reports/{report_id}"
                )
                processing_status = report_resp.get("processingStatus", "")
                if processing_status == "DONE":
                    report_doc_id = report_resp.get("reportDocumentId")
                    break
                if processing_status in ("CANCELLED", "FATAL"):
                    logger.error(
                        f"[Amazon] Returns report {report_id} status: {processing_status}"
                    )
                    return returns

            if not report_doc_id:
                logger.warning(f"[Amazon] Returns report {report_id} did not complete in time")
                return returns

            # Step 3: Download report document
            doc_resp = await self._make_request(
                "GET", f"/reports/2021-06-30/documents/{report_doc_id}"
            )
            download_url = doc_resp.get("url")
            if not download_url:
                return returns

            client = await self._get_client()
            dl_response = await client.get(download_url)
            if dl_response.status_code != 200:
                return returns

            # Step 4: Parse tab-delimited report
            returns = self._parse_returns_report(dl_response.text)

        except Exception as exc:
            self._log_error("fetch_returns", exc)

        return returns

    def _parse_returns_report(self, report_text: str) -> List[MarketplaceReturn]:
        """Parse Amazon tab-separated returns report into MarketplaceReturn list."""
        returns: List[MarketplaceReturn] = []
        lines = report_text.strip().split("\n")
        if len(lines) < 2:
            return returns

        headers = lines[0].split("\t")
        header_map = {h.strip().lower().replace(" ", "_").replace("-", "_"): i for i, h in enumerate(headers)}

        for line in lines[1:]:
            cols = line.split("\t")
            if len(cols) < len(headers):
                continue

            def col(name: str, default: str = "") -> str:
                idx = header_map.get(name)
                return cols[idx].strip() if idx is not None and idx < len(cols) else default

            return_date = self._parse_iso_date(col("return_date"))

            returns.append(
                MarketplaceReturn(
                    marketplace_return_id=col("return_request_id", col("order_id")),
                    marketplace_order_id=col("order_id"),
                    return_reason=col("return_reason", "Unknown"),
                    return_sub_reason=col("return_reason_details") or None,
                    customer_comments=col("customer_comments") or None,
                    return_quantity=int(col("quantity", "1") or "1"),
                    refund_amount=self._safe_float(col("refund_amount", "0")),
                    status=col("status", "INITIATED"),
                    initiated_date=return_date,
                    items=[
                        {
                            "sku": col("sku"),
                            "asin": col("asin"),
                            "title": col("product_name"),
                            "quantity": int(col("quantity", "1") or "1"),
                        }
                    ],
                    raw_data={h: cols[i] if i < len(cols) else "" for h, i in header_map.items()},
                )
            )

        return returns

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> bool:
        """
        Update return status on Amazon.

        Amazon SP-API does not expose a direct return-status-update endpoint
        for sellers.  Return processing is handled through Seller Central or
        automated via FBA.
        """
        logger.warning(
            f"[Amazon] Return status update is not supported via SP-API. "
            f"Return {marketplace_return_id} must be handled in Seller Central."
        )
        return False

    # ==================================================================
    # Listings / Catalog (optional)
    # ==================================================================

    async def fetch_listings(
        self, cursor: Optional[str] = None, limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetch catalog items via GET /catalog/2022-04-01/items.
        """
        try:
            params: Dict[str, Any] = {
                "marketplaceIds": self.marketplace_id,
                "sellerId": self.seller_id,
                "pageSize": min(limit, 20),  # Catalog API max pageSize = 20
                "includedData": "summaries,attributes,identifiers,images",
            }
            if cursor:
                params["pageToken"] = cursor

            response = await self._make_request(
                "GET", "/catalog/2022-04-01/items", params=params
            )

            listings: List[Dict[str, Any]] = []
            for item in response.get("items", []):
                summaries = item.get("summaries", [{}])
                summary = summaries[0] if summaries else {}
                identifiers = item.get("identifiers", [{}])
                identifier = identifiers[0] if identifiers else {}

                listings.append(
                    {
                        "asin": item.get("asin", ""),
                        "title": summary.get("itemName", ""),
                        "brand": summary.get("brand", ""),
                        "manufacturer": summary.get("manufacturer", ""),
                        "product_type": summary.get("productType", ""),
                        "marketplace_id": identifier.get("marketplaceId", ""),
                        "images": [
                            img.get("link") for img in item.get("images", [{}])
                            if img.get("link")
                        ],
                        "raw_data": item,
                    }
                )

            next_token = response.get("pagination", {}).get("nextToken")
            return listings, next_token

        except Exception as exc:
            self._log_error("fetch_listings", exc)
            return [], None

    # ==================================================================
    # Webhook / Notifications
    # ==================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str],
    ) -> bool:
        """
        Verify an Amazon EventBridge / SQS notification signature.

        Amazon SP-API notifications delivered via SQS are signed using
        the standard AWS SNS message-signing scheme.  For EventBridge
        the payload comes through the customer's own AWS account and
        trust is implicit.

        This implementation verifies HMAC-SHA256 if a shared signing key
        is configured; otherwise it trusts EventBridge payloads.
        """
        signing_key = self.credentials.additional.get("webhook_signing_key")
        if not signing_key:
            # No signing key configured; assume EventBridge (trusted)
            logger.debug("[Amazon] No webhook signing key; accepting payload as trusted")
            return True

        try:
            expected = hmac.new(
                signing_key.encode("utf-8"),
                payload,
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(expected, signature)
        except Exception as exc:
            logger.error(f"[Amazon] Webhook signature verification failed: {exc}")
            return False

    async def parse_webhook_event(
        self, payload: Dict[str, Any], event_type: str
    ) -> Dict[str, Any]:
        """
        Parse Amazon notification payload into a standardised event dict.

        Handles:
        - ORDER_CHANGE
        - FULFILLMENT_ORDER_STATUS
        - ANY_OFFER_CHANGED (inventory-related)
        - REPORT_PROCESSING_FINISHED
        """
        notification_type = payload.get("NotificationType", event_type)
        notification_payload = payload.get("Payload", payload)

        result: Dict[str, Any] = {
            "event_type": notification_type,
            "marketplace": "AMAZON",
            "notification_id": payload.get("NotificationId"),
            "event_time": payload.get("EventTime"),
        }

        if notification_type == "ORDER_CHANGE":
            order_change = notification_payload.get("OrderChangeNotification", {})
            summary = order_change.get("Summary", {})
            result["data"] = {
                "marketplace_order_id": summary.get("OrderId"),
                "order_status": AMAZON_STATUS_MAP.get(
                    summary.get("OrderStatus", ""), summary.get("OrderStatus")
                ),
                "fulfillment_channel": summary.get("FulfillmentChannel"),
                "order_change_type": order_change.get("NotificationLevel"),
            }

        elif notification_type == "FULFILLMENT_ORDER_STATUS":
            fulfillment = notification_payload.get(
                "FulfillmentOrderStatusNotification", {}
            )
            result["data"] = {
                "seller_fulfillment_order_id": fulfillment.get(
                    "SellerFulfillmentOrderId"
                ),
                "fulfillment_order_status": fulfillment.get(
                    "FulfillmentOrderStatus"
                ),
            }

        elif notification_type == "ANY_OFFER_CHANGED":
            offer_change = notification_payload.get(
                "AnyOfferChangedNotification", {}
            )
            result["data"] = {
                "asin": offer_change.get("OfferChangeTrigger", {}).get("ASIN"),
                "marketplace_id": offer_change.get("OfferChangeTrigger", {}).get(
                    "MarketplaceId"
                ),
            }

        elif notification_type == "REPORT_PROCESSING_FINISHED":
            report_info = notification_payload.get(
                "ReportProcessingFinishedNotification", {}
            )
            result["data"] = {
                "report_id": report_info.get("reportId"),
                "report_type": report_info.get("reportType"),
                "processing_status": report_info.get("processingStatus"),
                "report_document_id": report_info.get("reportDocumentId"),
            }

        else:
            result["data"] = notification_payload

        return result

    # ==================================================================
    # Notification Subscriptions (bonus helper)
    # ==================================================================

    async def subscribe_to_notification(
        self, notification_type: str, destination_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a notification subscription via
        POST /notifications/v1/subscriptions/{notificationType}.

        Useful for ORDER_CHANGE, FULFILLMENT_ORDER_STATUS, etc.
        """
        body: Dict[str, Any] = {}
        if destination_id:
            body["destinationId"] = destination_id

        response = await self._make_request(
            "POST",
            f"/notifications/v1/subscriptions/{notification_type}",
            body=body,
        )
        return response.get("payload", {})

    # ==================================================================
    # Health Check
    # ==================================================================

    async def health_check(self) -> bool:
        """
        Verify connectivity by calling
        GET /sellers/v1/marketplaceParticipations.

        Returns True if the seller has at least one active participation.
        """
        try:
            response = await self._make_request(
                "GET", "/sellers/v1/marketplaceParticipations"
            )
            participations = response.get("payload", [])
            if isinstance(participations, list) and len(participations) > 0:
                logger.info(
                    f"[Amazon] Health check OK. "
                    f"{len(participations)} marketplace participation(s) found."
                )
                return True

            logger.warning("[Amazon] Health check: no marketplace participations found")
            return False

        except Exception as exc:
            logger.error(f"[Amazon] Health check failed: {exc}")
            return False

    # ==================================================================
    # Feeds API helpers
    # ==================================================================

    async def _create_and_upload_feed(
        self, feed_content: str, feed_type: str
    ) -> Optional[str]:
        """
        Generic Feeds API workflow (v2021-06-30):
        1. createFeedDocument  -> returns feedDocumentId + upload URL
        2. Upload XML content to the pre-signed URL
        3. createFeed          -> returns feedId

        Returns the feedId on success, None on failure.
        """
        try:
            # Step 1: Create feed document
            doc_body = {"contentType": "text/xml; charset=UTF-8"}
            doc_resp = await self._make_request(
                "POST", "/feeds/2021-06-30/documents", body=doc_body
            )
            feed_doc_id = doc_resp.get("feedDocumentId")
            upload_url = doc_resp.get("url")

            if not feed_doc_id or not upload_url:
                logger.error("[Amazon] Failed to create feed document")
                return None

            # Step 2: Upload feed content to the pre-signed URL
            client = await self._get_client()
            upload_resp = await client.put(
                upload_url,
                content=feed_content.encode("utf-8"),
                headers={"Content-Type": "text/xml; charset=UTF-8"},
            )
            if upload_resp.status_code not in (200, 204):
                logger.error(
                    f"[Amazon] Feed upload failed: {upload_resp.status_code} "
                    f"{upload_resp.text[:500]}"
                )
                return None

            # Step 3: Create the feed
            feed_body = {
                "feedType": feed_type,
                "marketplaceIds": [self.marketplace_id],
                "inputFeedDocumentId": feed_doc_id,
            }
            feed_resp = await self._make_request(
                "POST", "/feeds/2021-06-30/feeds", body=feed_body
            )

            feed_id = feed_resp.get("feedId")
            logger.info(
                f"[Amazon] Feed created: type={feed_type} feedId={feed_id} "
                f"docId={feed_doc_id}"
            )
            return feed_id

        except Exception as exc:
            self._log_error("_create_and_upload_feed", exc)
            return None

    async def get_feed_status(self, feed_id: str) -> Dict[str, Any]:
        """
        Check the processing status of a submitted feed.

        Returns:
            Dict with processingStatus, resultFeedDocumentId, etc.
        """
        response = await self._make_request(
            "GET", f"/feeds/2021-06-30/feeds/{feed_id}"
        )
        return response

    # ==================================================================
    # Utility methods
    # ==================================================================

    @staticmethod
    def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
        """Safely parse an ISO 8601 date string (handles trailing Z)."""
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def _safe_float(value: Any) -> float:
        """Safely convert a value to float (handles str, Decimal, None)."""
        if value is None:
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
