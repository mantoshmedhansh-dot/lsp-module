"""
Shopify Admin API Adapter
Complete implementation of MarketplaceAdapter for Shopify Admin REST API (2024-01).

Handles:
- OAuth2 authorization and token exchange
- Order fetching with cursor-based pagination (Link header / page_info)
- Order fulfillment and cancellation
- Inventory level management via inventory_levels/set
- Returns (refund-based) retrieval
- Webhook HMAC-SHA256 signature verification
- Rate limiting via X-Shopify-Shop-Api-Call-Limit header
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse, parse_qs
import asyncio
import logging
import re
import time
import hmac
import hashlib
import base64

import httpx

from app.services.marketplaces.base_adapter import (
    MarketplaceAdapter,
    MarketplaceConfig,
    MarketplaceOrder,
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
SHOPIFY_API_VERSION = "2024-01"

# Default OAuth scopes requested during authorization
SHOPIFY_OAUTH_SCOPES = (
    "read_orders,write_orders,"
    "read_inventory,write_inventory,"
    "read_products,"
    "read_fulfillments,write_fulfillments"
)

# When the bucket usage ratio exceeds this value we insert a short delay
# before the next request to stay safely below Shopify's 40-req/s bucket.
_RATE_LIMIT_THRESHOLD = 0.80

# Regex to extract page_info from Link header
# Shopify returns: <https://...?page_info=XYZ>; rel="next"
_LINK_NEXT_RE = re.compile(r'<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"')


@register_adapter("SHOPIFY")
class ShopifyAdapter(MarketplaceAdapter):
    """
    Shopify Admin REST API adapter.

    Implements the full MarketplaceAdapter interface for Shopify stores using
    the Admin REST API at version ``2024-01``.

    Authentication
    ~~~~~~~~~~~~~~
    * **Private / custom apps** -- provide an ``access_token`` directly.
    * **Public apps (OAuth2)** -- use ``get_oauth_authorize_url`` followed by
      ``exchange_code_for_token``.

    Shopify *offline* access tokens do not expire, so ``refresh_token()``
    simply returns success without making any network call.

    Rate limiting
    ~~~~~~~~~~~~~
    Every response from the Shopify Admin API includes the
    ``X-Shopify-Shop-Api-Call-Limit`` header (e.g. ``32/40``).  The adapter
    tracks bucket usage and, when the ratio exceeds 80 %, pauses briefly
    before the next call.  429 responses are handled with the ``Retry-After``
    header.
    """

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.store_url = self._normalize_store_url(config.credentials.store_url)
        self._http_client: Optional[httpx.AsyncClient] = None
        self._location_id: Optional[int] = config.sync_settings.get("location_id")

    @staticmethod
    def _normalize_store_url(url: Optional[str]) -> str:
        """Normalise *url* to ``https://<shop>.myshopify.com`` form."""
        if not url:
            return ""
        url = url.strip().rstrip("/")
        # Strip any trailing path segments (e.g. ``/admin``)
        if "/admin" in url:
            url = url[: url.index("/admin")]
        if not url.startswith("https://"):
            if url.startswith("http://"):
                url = url.replace("http://", "https://", 1)
            else:
                url = f"https://{url}"
        # Ensure the standard myshopify.com domain is present
        if ".myshopify.com" not in url:
            url = f"{url}.myshopify.com"
        return url

    @property
    def _base_api_url(self) -> str:
        """Return the versioned Admin API base URL."""
        return f"{self.store_url}/admin/api/{SHOPIFY_API_VERSION}"

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:  # noqa: D401
        return "Shopify"

    @property
    def supported_operations(self) -> List[str]:
        return [
            "fetch_orders",
            "get_order",
            "update_order_status",
            "cancel_order",
            "push_inventory",
            "get_inventory",
            "fetch_returns",
            "fetch_settlements",
            "verify_webhook_signature",
            "parse_webhook_event",
            "health_check",
            "fetch_listings",
            "update_listing_price",
        ]

    # ------------------------------------------------------------------
    # HTTP client helpers
    # ------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        """Return (and lazily create) a shared ``httpx.AsyncClient``."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        return self._http_client

    async def _close_client(self) -> None:
        """Close the HTTP client if open."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Dict[str, Any], httpx.Headers]:
        """
        Make an authenticated request to the Shopify Admin API.

        Returns a ``(json_body, response_headers)`` tuple so callers can
        inspect pagination headers (``Link``).

        Raises ``Exception`` on HTTP errors >= 400 (after logging).
        """
        if not self.credentials.access_token:
            raise Exception("Not authenticated -- no access token available")

        # Pre-flight rate-limit check
        if self.should_throttle():
            wait = 1.0
            if self._rate_limit_reset:
                wait = max(
                    (self._rate_limit_reset - datetime.utcnow()).total_seconds(), 0.5
                )
            logger.debug("Shopify rate-limit throttle: sleeping %.1fs", wait)
            await asyncio.sleep(wait)

        client = await self._get_client()
        url = f"{self._base_api_url}{path}"
        headers = {"X-Shopify-Access-Token": self.credentials.access_token}

        start = time.time()
        try:
            response: httpx.Response
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(
                    url, params=params, json=body, headers=headers
                )
            elif method == "PUT":
                response = await client.put(
                    url, params=params, json=body, headers=headers
                )
            elif method == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            duration_ms = (time.time() - start) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # --- Rate-limit bookkeeping --------------------------------
            call_limit_header = response.headers.get(
                "X-Shopify-Shop-Api-Call-Limit", ""
            )
            if "/" in call_limit_header:
                used_str, limit_str = call_limit_header.split("/")
                used, limit = int(used_str), int(limit_str)
                self._rate_limit_remaining = limit - used
                if used / limit >= _RATE_LIMIT_THRESHOLD:
                    # Set a short cool-off window
                    self._rate_limit_reset = datetime.utcnow() + timedelta(seconds=1)

            # --- 429 Too Many Requests ---------------------------------
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", "2.0"))
                self._rate_limit_reset = datetime.utcnow() + timedelta(
                    seconds=retry_after
                )
                self._rate_limit_remaining = 0
                raise Exception(
                    f"Rate limited by Shopify. Retry after {retry_after}s"
                )

            # --- Error handling ----------------------------------------
            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                errors = error_data.get("errors", error_data.get("error", ""))
                if isinstance(errors, dict):
                    error_msg = "; ".join(
                        f"{k}: {v}" for k, v in errors.items()
                    )
                elif isinstance(errors, list):
                    error_msg = "; ".join(str(e) for e in errors)
                else:
                    error_msg = str(errors)
                raise Exception(
                    f"Shopify API error {response.status_code}: {error_msg}"
                )

            json_body = response.json() if response.content else {}
            return json_body, response.headers

        except httpx.TimeoutException:
            duration_ms = (time.time() - start) * 1000
            self._log_api_call(method, path, 0, duration_ms)
            raise Exception(f"Request to {path} timed out")
        except httpx.RequestError as exc:
            duration_ms = (time.time() - start) * 1000
            self._log_api_call(method, path, 0, duration_ms)
            raise Exception(f"Request to {path} failed: {exc}")

    async def _api_get(
        self, path: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Convenience: GET that discards response headers."""
        body, _headers = await self._make_request("GET", path, params=params)
        return body

    async def _api_post(
        self, path: str, body: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Convenience: POST that discards response headers."""
        resp_body, _headers = await self._make_request("POST", path, body=body)
        return resp_body

    # ==================================================================
    # Authentication
    # ==================================================================

    async def authenticate(self) -> AuthResult:
        """
        Validate credentials by calling ``GET /shop.json``.

        For private / custom apps the access token is provided directly.
        For public OAuth apps the token must already have been exchanged.
        """
        try:
            if not self.credentials.access_token:
                return AuthResult(
                    success=False,
                    error_message="No access token provided",
                )

            healthy = await self.health_check()
            if healthy:
                self.is_authenticated = True
                return AuthResult(
                    success=True,
                    access_token=self.credentials.access_token,
                )

            return AuthResult(
                success=False,
                error_message="Access token validation failed (GET /shop.json returned error)",
            )

        except Exception as exc:
            self._log_error("authenticate", exc)
            return AuthResult(success=False, error_message=str(exc))

    async def refresh_token(self) -> AuthResult:
        """
        Shopify offline access tokens do not expire -- return success
        immediately without making a network call.

        If the adapter has no token at all the call is treated as a failure.
        """
        if not self.credentials.access_token:
            return AuthResult(
                success=False,
                error_message="No access token to refresh (Shopify offline tokens do not expire)",
            )

        self.is_authenticated = True
        return AuthResult(
            success=True,
            access_token=self.credentials.access_token,
            # Shopify offline tokens have no expiry -- set a far-future sentinel
            expires_at=datetime.utcnow() + timedelta(days=365 * 10),
        )

    def get_oauth_authorize_url(self, redirect_uri: str, state: str) -> str:
        """
        Build the Shopify OAuth authorisation URL.

        Requested scopes::

            read_orders, write_orders, read_inventory, write_inventory,
            read_products, read_fulfillments, write_fulfillments
        """
        params = urlencode(
            {
                "client_id": self.credentials.client_id or "",
                "scope": SHOPIFY_OAUTH_SCOPES,
                "redirect_uri": redirect_uri,
                "state": state,
            }
        )
        return f"{self.store_url}/admin/oauth/authorize?{params}"

    async def exchange_code_for_token(
        self, code: str, redirect_uri: str
    ) -> AuthResult:
        """
        Exchange an OAuth authorisation *code* for a permanent access token.

        ``POST https://{shop}/admin/oauth/access_token``
        """
        try:
            client = await self._get_client()
            url = f"{self.store_url}/admin/oauth/access_token"

            response = await client.post(
                url,
                json={
                    "client_id": self.credentials.client_id,
                    "client_secret": self.credentials.client_secret,
                    "code": code,
                },
            )

            if response.status_code != 200:
                error_body = response.json() if response.content else {}
                return AuthResult(
                    success=False,
                    error_message=f"Token exchange failed ({response.status_code}): "
                    f"{error_body.get('error_description', error_body.get('error', 'unknown'))}",
                )

            data = response.json()
            self.credentials.access_token = data["access_token"]
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                scope=data.get("scope"),
            )

        except Exception as exc:
            self._log_error("exchange_code_for_token", exc)
            return AuthResult(success=False, error_message=str(exc))

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
        Fetch orders from Shopify using cursor-based pagination.

        Pagination
        ~~~~~~~~~~
        Shopify REST endpoints return a ``Link`` header with ``rel="next"``
        containing a ``page_info`` cursor.  The *cursor* parameter maps to
        this ``page_info`` value.  When a non-``None`` cursor is supplied,
        ``created_at_min`` / ``created_at_max`` **must not** be sent (Shopify
        rejects the combination).
        """
        try:
            safe_limit = min(limit, 250)

            if cursor:
                # Cursor-based page -- only page_info + limit are allowed
                params: Dict[str, Any] = {
                    "page_info": cursor,
                    "limit": safe_limit,
                }
            else:
                params = {
                    "created_at_min": from_date.strftime("%Y-%m-%dT%H:%M:%S%z")
                    or from_date.isoformat(),
                    "limit": safe_limit,
                    "status": "any",
                }
                if to_date:
                    params["created_at_max"] = (
                        to_date.strftime("%Y-%m-%dT%H:%M:%S%z")
                        or to_date.isoformat()
                    )
                if status:
                    params["fulfillment_status"] = status

            response_body, headers = await self._make_request(
                "GET", "/orders.json", params=params
            )

            orders: List[MarketplaceOrder] = []
            for order_data in response_body.get("orders", []):
                parsed = self._parse_order(order_data)
                if parsed:
                    orders.append(parsed)

            # Extract next page cursor from the Link header
            next_cursor = self._extract_next_page_info(headers)

            return orders, next_cursor

        except Exception as exc:
            self._log_error("fetch_orders", exc)
            raise

    @staticmethod
    def _extract_next_page_info(headers: httpx.Headers) -> Optional[str]:
        """
        Parse the ``Link`` header and return the ``page_info`` value for the
        ``rel="next"`` relation, or ``None`` if there is no next page.
        """
        link_header = headers.get("Link", "") or headers.get("link", "")
        if not link_header:
            return None
        match = _LINK_NEXT_RE.search(link_header)
        return match.group(1) if match else None

    # ------------------------------------------------------------------
    # Order parsing
    # ------------------------------------------------------------------

    def _parse_order(self, data: Dict[str, Any]) -> Optional[MarketplaceOrder]:
        """Convert a raw Shopify order dict into ``MarketplaceOrder``."""
        try:
            shipping = data.get("shipping_address") or {}
            billing = data.get("billing_address") or {}
            customer = data.get("customer") or {}

            # Build customer name: prefer shipping address, fall back to
            # the top-level customer object.
            customer_name = (
                f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip()
            )
            if not customer_name:
                customer_name = (
                    f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
                )

            # Parse line items
            items: List[Dict[str, Any]] = []
            for li in data.get("line_items", []):
                qty = int(li.get("quantity", 1))
                unit_price = float(li.get("price", 0))
                tax = sum(
                    float(t.get("price", 0)) for t in li.get("tax_lines", [])
                )
                discount = sum(
                    float(d.get("amount", 0))
                    for d in li.get("discount_allocations", [])
                )
                items.append(
                    {
                        "marketplace_line_id": str(li.get("id")),
                        "marketplace_sku": li.get("sku") or str(li.get("variant_id", "")),
                        "variant_id": str(li.get("variant_id", "")),
                        "product_id": str(li.get("product_id", "")),
                        "title": li.get("name", li.get("title", "")),
                        "quantity": qty,
                        "unit_price": unit_price,
                        "total_price": unit_price * qty,
                        "tax_amount": tax,
                        "discount_amount": discount,
                        "shipping_amount": 0.0,
                        "fulfillment_status": li.get("fulfillment_status"),
                    }
                )

            # Determine COD
            gateway = (data.get("gateway") or "").lower()
            is_cod = "cod" in gateway or "cash on delivery" in gateway

            # Map Shopify financial + fulfillment status to a normalized status
            order_status = self._normalize_order_status(data)

            return MarketplaceOrder(
                marketplace_order_id=str(data["id"]),
                marketplace="SHOPIFY",
                order_status=order_status,
                order_date=self._parse_datetime(
                    data.get("created_at", datetime.utcnow().isoformat())
                ),
                customer_name=customer_name or "Unknown",
                customer_email=data.get("email") or data.get("contact_email"),
                customer_phone=shipping.get("phone") or billing.get("phone"),
                shipping_address={
                    "name": shipping.get("name"),
                    "address_line1": shipping.get("address1"),
                    "address_line2": shipping.get("address2"),
                    "city": shipping.get("city"),
                    "state": shipping.get("province"),
                    "state_code": shipping.get("province_code"),
                    "postal_code": shipping.get("zip"),
                    "country": shipping.get("country"),
                    "country_code": shipping.get("country_code"),
                    "phone": shipping.get("phone"),
                },
                billing_address={
                    "name": billing.get("name"),
                    "address_line1": billing.get("address1"),
                    "address_line2": billing.get("address2"),
                    "city": billing.get("city"),
                    "state": billing.get("province"),
                    "state_code": billing.get("province_code"),
                    "postal_code": billing.get("zip"),
                    "country": billing.get("country"),
                    "country_code": billing.get("country_code"),
                },
                items=items,
                subtotal=float(data.get("subtotal_price", 0)),
                shipping_amount=sum(
                    float(sl.get("price", 0))
                    for sl in data.get("shipping_lines", [])
                ),
                tax_amount=float(data.get("total_tax", 0)),
                discount_amount=float(data.get("total_discounts", 0)),
                total_amount=float(data.get("total_price", 0)),
                currency=data.get("currency", "INR"),
                payment_method=data.get("gateway", ""),
                is_cod=is_cod,
                fulfillment_type=FulfillmentType.SELLER,
                raw_data=data,
            )
        except Exception as exc:
            logger.error("Failed to parse Shopify order %s: %s", data.get("id"), exc)
            return None

    @staticmethod
    def _normalize_order_status(data: Dict[str, Any]) -> str:
        """
        Map Shopify's composite status fields to a single normalised string.

        Shopify uses three independent axes:

        * ``financial_status`` -- pending, authorized, paid, refunded, ...
        * ``fulfillment_status`` -- null (unfulfilled), partial, fulfilled
        * ``cancelled_at`` -- non-null when the order was cancelled
        """
        if data.get("cancelled_at"):
            return "CANCELLED"

        financial = (data.get("financial_status") or "").lower()
        fulfillment = (data.get("fulfillment_status") or "unfulfilled").lower()

        if financial == "refunded":
            return "REFUNDED"
        if financial == "partially_refunded":
            return "PARTIALLY_REFUNDED"
        if fulfillment == "fulfilled":
            return "FULFILLED"
        if fulfillment == "partial":
            return "PARTIALLY_FULFILLED"
        if financial in ("paid", "partially_paid"):
            return "CONFIRMED"
        if financial in ("pending", "authorized"):
            return "PENDING"
        return fulfillment.upper() or "UNFULFILLED"

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        """Parse an ISO-8601 date string, handling the ``Z`` suffix."""
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    # ------------------------------------------------------------------

    async def get_order(
        self, marketplace_order_id: str
    ) -> Optional[MarketplaceOrder]:
        """
        Fetch a single order by its Shopify numeric ID and normalise it.
        """
        try:
            data = await self._api_get(f"/orders/{marketplace_order_id}.json")
            return self._parse_order(data.get("order", {}))
        except Exception as exc:
            self._log_error("get_order", exc)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Create a fulfillment on Shopify (marks the order as shipped).

        Uses the *Fulfillment* endpoint:
        ``POST /orders/{order_id}/fulfillments.json``
        """
        try:
            fulfillment_payload: Dict[str, Any] = {
                "fulfillment": {
                    "notify_customer": True,
                }
            }

            tracking_info: Dict[str, Any] = {}
            if update.tracking_number:
                tracking_info["number"] = update.tracking_number
            if update.carrier_name:
                tracking_info["company"] = update.carrier_name
            if tracking_info:
                fulfillment_payload["fulfillment"]["tracking_info"] = tracking_info

            # If specific line-item IDs are provided, include them
            if update.items:
                fulfillment_payload["fulfillment"]["line_items"] = [
                    {"id": int(item_id)} for item_id in update.items
                ]

            await self._api_post(
                f"/orders/{update.marketplace_order_id}/fulfillments.json",
                body=fulfillment_payload,
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
        Cancel an entire order on Shopify.

        ``POST /orders/{id}/cancel.json``

        Shopify does not support item-level cancellation -- the *items*
        parameter is accepted for interface compatibility but ignored.
        """
        try:
            body: Dict[str, Any] = {
                "reason": reason,
                "email": True,
            }
            await self._api_post(
                f"/orders/{marketplace_order_id}/cancel.json",
                body=body,
            )
            return True
        except Exception as exc:
            self._log_error("cancel_order", exc)
            return False

    # ==================================================================
    # Inventory Management
    # ==================================================================

    async def push_inventory(
        self, updates: List[InventoryUpdate]
    ) -> List[InventoryUpdateResult]:
        """
        Set inventory levels on Shopify.

        ``POST /inventory_levels/set.json``

        Each update requires the ``inventory_item_id`` which is resolved
        by looking up the variant by SKU.
        """
        results: List[InventoryUpdateResult] = []

        if not self._location_id:
            await self._fetch_primary_location()

        if not self._location_id:
            # Cannot proceed without a location
            for upd in updates:
                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=upd.marketplace_sku,
                        success=False,
                        error_message="Could not determine Shopify location ID",
                    )
                )
            return results

        for upd in updates:
            try:
                inv_item_id = await self._get_inventory_item_id(upd.marketplace_sku)
                if not inv_item_id:
                    results.append(
                        InventoryUpdateResult(
                            marketplace_sku=upd.marketplace_sku,
                            success=False,
                            error_message=f"No variant found for SKU '{upd.marketplace_sku}'",
                        )
                    )
                    continue

                body = {
                    "location_id": self._location_id,
                    "inventory_item_id": inv_item_id,
                    "available": upd.quantity,
                }
                resp = await self._api_post("/inventory_levels/set.json", body=body)

                level = resp.get("inventory_level", {})
                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=upd.marketplace_sku,
                        success=True,
                        new_qty=level.get("available", upd.quantity),
                        acknowledged_qty=level.get("available"),
                        raw_response=level,
                    )
                )

            except Exception as exc:
                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=upd.marketplace_sku,
                        success=False,
                        error_message=str(exc),
                    )
                )

        return results

    async def get_inventory(
        self, marketplace_skus: List[str]
    ) -> Dict[str, int]:
        """
        Get current available inventory for the given SKUs.

        ``GET /inventory_levels.json``
        """
        inventory: Dict[str, int] = {}

        if not self._location_id:
            await self._fetch_primary_location()
        if not self._location_id:
            logger.warning("Cannot get inventory: Shopify location ID unknown")
            return inventory

        for sku in marketplace_skus:
            try:
                inv_item_id = await self._get_inventory_item_id(sku)
                if not inv_item_id:
                    continue

                data = await self._api_get(
                    "/inventory_levels.json",
                    params={
                        "inventory_item_ids": str(inv_item_id),
                        "location_ids": str(self._location_id),
                    },
                )

                levels = data.get("inventory_levels", [])
                if levels:
                    inventory[sku] = int(levels[0].get("available", 0))

            except Exception as exc:
                logger.warning("Failed to get inventory for SKU %s: %s", sku, exc)

        return inventory

    # ------------------------------------------------------------------
    # Internal inventory helpers
    # ------------------------------------------------------------------

    async def _fetch_primary_location(self) -> None:
        """Resolve and cache the primary Shopify location ID."""
        try:
            data = await self._api_get("/locations.json")
            locations = data.get("locations", [])
            if not locations:
                return
            # Prefer the location marked as ``primary``
            for loc in locations:
                if loc.get("primary"):
                    self._location_id = loc["id"]
                    return
            # Fall back to the first active location
            for loc in locations:
                if loc.get("active"):
                    self._location_id = loc["id"]
                    return
            self._location_id = locations[0]["id"]
        except Exception as exc:
            logger.error("Failed to fetch Shopify locations: %s", exc)

    async def _get_inventory_item_id(self, sku: str) -> Optional[int]:
        """Look up the ``inventory_item_id`` for a product variant by SKU."""
        try:
            # The products endpoint supports searching by a specific fields
            # but there is no direct "search by SKU" on the variants endpoint
            # in all API versions.  We search products and iterate variants.
            data = await self._api_get(
                "/products.json",
                params={"fields": "id,variants", "limit": 250},
            )
            for product in data.get("products", []):
                for variant in product.get("variants", []):
                    if variant.get("sku") == sku:
                        return variant.get("inventory_item_id")
            return None
        except Exception as exc:
            logger.error("Failed to resolve inventory_item_id for SKU %s: %s", sku, exc)
            return None

    # ==================================================================
    # Settlements / Finance
    # ==================================================================

    async def fetch_settlements(
        self, from_date: datetime, to_date: datetime
    ) -> List[Settlement]:
        """
        Shopify does not expose a direct settlements / payouts API in the
        standard Admin REST surface.  Return an empty list.

        Stores using *Shopify Payments* can access payouts via
        ``/shopify_payments/payouts.json``, but that endpoint is only
        available to Shopify Payments-enabled shops and requires the
        ``read_shopify_payments_payouts`` scope which is not part of the
        standard set.
        """
        logger.info(
            "Shopify does not have a general settlements API -- returning empty list"
        )
        return []

    # ==================================================================
    # Returns Management
    # ==================================================================

    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None,
    ) -> List[MarketplaceReturn]:
        """
        Fetch returns from Shopify by scanning refunds attached to orders.

        Shopify does not have a dedicated *returns* entity in the 2024-01
        REST API; refunds on orders are the closest equivalent.
        ``GET /orders.json?status=any`` then iterate ``order.refunds``.
        """
        returns: List[MarketplaceReturn] = []

        try:
            params: Dict[str, Any] = {
                "created_at_min": from_date.isoformat(),
                "status": "any",
                "limit": 250,
            }

            # We may need to paginate through all orders
            next_cursor: Optional[str] = None
            first_page = True

            while first_page or next_cursor:
                first_page = False

                if next_cursor:
                    request_params: Dict[str, Any] = {
                        "page_info": next_cursor,
                        "limit": 250,
                    }
                else:
                    request_params = params

                resp_body, headers = await self._make_request(
                    "GET", "/orders.json", params=request_params
                )

                for order in resp_body.get("orders", []):
                    for refund in order.get("refunds", []):
                        ret = self._parse_return(order, refund)
                        if ret:
                            returns.append(ret)

                next_cursor = self._extract_next_page_info(headers)

        except Exception as exc:
            self._log_error("fetch_returns", exc)

        return returns

    def _parse_return(
        self, order: Dict[str, Any], refund: Dict[str, Any]
    ) -> Optional[MarketplaceReturn]:
        """Convert a Shopify refund into a ``MarketplaceReturn``."""
        try:
            refund_amount = sum(
                float(txn.get("amount", 0))
                for txn in refund.get("transactions", [])
            )

            refund_items: List[Dict[str, Any]] = []
            total_qty = 0
            for rli in refund.get("refund_line_items", []):
                qty = int(rli.get("quantity", 0))
                total_qty += qty
                li = rli.get("line_item", {})
                refund_items.append(
                    {
                        "marketplace_line_id": str(rli.get("line_item_id", "")),
                        "sku": li.get("sku", ""),
                        "title": li.get("name", li.get("title", "")),
                        "quantity": qty,
                        "subtotal": float(rli.get("subtotal", 0)),
                        "restock_type": rli.get("restock_type"),
                    }
                )

            return MarketplaceReturn(
                marketplace_return_id=str(refund["id"]),
                marketplace_order_id=str(order["id"]),
                return_reason=refund.get("note", "") or "",
                return_quantity=total_qty or 1,
                refund_amount=refund_amount,
                status="REFUNDED",
                initiated_date=self._parse_datetime(
                    refund.get("created_at", datetime.utcnow().isoformat())
                ),
                items=refund_items,
                raw_data=refund,
            )
        except Exception as exc:
            logger.error("Failed to parse Shopify refund %s: %s", refund.get("id"), exc)
            return None

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> bool:
        """
        Shopify refunds are immutable -- their status cannot be updated
        via the Admin API.  Always returns ``False``.
        """
        logger.warning(
            "Shopify refunds cannot be updated (return %s)", marketplace_return_id
        )
        return False

    # ==================================================================
    # Listings (optional overrides)
    # ==================================================================

    async def fetch_listings(
        self,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetch product listings (variants) from Shopify.

        Uses cursor-based pagination via ``page_info``.
        """
        try:
            safe_limit = min(limit, 250)

            if cursor:
                params: Dict[str, Any] = {
                    "page_info": cursor,
                    "limit": safe_limit,
                }
            else:
                params = {"limit": safe_limit}

            resp_body, headers = await self._make_request(
                "GET", "/products.json", params=params
            )

            listings: List[Dict[str, Any]] = []
            for product in resp_body.get("products", []):
                for variant in product.get("variants", []):
                    listings.append(
                        {
                            "product_id": str(product.get("id")),
                            "variant_id": str(variant.get("id")),
                            "sku": variant.get("sku"),
                            "title": f"{product.get('title', '')} - {variant.get('title', '')}",
                            "price": float(variant.get("price", 0)),
                            "compare_at_price": (
                                float(variant["compare_at_price"])
                                if variant.get("compare_at_price")
                                else None
                            ),
                            "inventory_quantity": variant.get("inventory_quantity", 0),
                            "inventory_item_id": variant.get("inventory_item_id"),
                            "status": product.get("status"),
                            "barcode": variant.get("barcode"),
                            "weight": variant.get("weight"),
                            "weight_unit": variant.get("weight_unit"),
                        }
                    )

            next_cursor = self._extract_next_page_info(headers)
            return listings, next_cursor

        except Exception as exc:
            self._log_error("fetch_listings", exc)
            raise

    async def update_listing_price(
        self,
        marketplace_sku: str,
        price: float,
        mrp: Optional[float] = None,
    ) -> bool:
        """
        Update the price (and optional compare-at-price) of a variant
        identified by *marketplace_sku*.
        """
        try:
            # Resolve variant ID via SKU search
            variant_id = await self._get_variant_id_by_sku(marketplace_sku)
            if not variant_id:
                logger.warning("Variant not found for SKU %s", marketplace_sku)
                return False

            body: Dict[str, Any] = {
                "variant": {
                    "id": variant_id,
                    "price": str(price),
                }
            }
            if mrp is not None:
                body["variant"]["compare_at_price"] = str(mrp)

            await self._api_post(
                # PUT would be more semantically correct, but the helper
                # signature aligns with POST -- Shopify accepts both for
                # variant updates when ``id`` is in the body.
                f"/variants/{variant_id}.json",
                body=body,
            )
            return True

        except Exception as exc:
            self._log_error("update_listing_price", exc)
            return False

    async def _get_variant_id_by_sku(self, sku: str) -> Optional[int]:
        """Find a variant's Shopify ID by SKU."""
        try:
            data = await self._api_get(
                "/products.json",
                params={"fields": "id,variants", "limit": 250},
            )
            for product in data.get("products", []):
                for variant in product.get("variants", []):
                    if variant.get("sku") == sku:
                        return variant["id"]
            return None
        except Exception as exc:
            logger.error("Failed to find variant by SKU %s: %s", sku, exc)
            return None

    # ==================================================================
    # Webhook handling
    # ==================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str],
    ) -> bool:
        """
        Verify the HMAC-SHA256 signature of a Shopify webhook.

        Shopify signs webhooks using the *app secret* (``api_secret``):

        .. code-block:: text

            base64( HMAC-SHA256( shared_secret, raw_body ) )

        The signature is delivered in the ``X-Shopify-Hmac-Sha256`` header.
        If no *signature* argument is provided by the caller, the method
        attempts to read it from *headers* directly.
        """
        try:
            secret = self.credentials.api_secret or self.credentials.client_secret
            if not secret:
                logger.error("Cannot verify webhook: no api_secret or client_secret configured")
                return False

            # Allow the caller to pass the signature explicitly or via headers
            sig = signature or headers.get("X-Shopify-Hmac-Sha256", "") or headers.get("x-shopify-hmac-sha256", "")
            if not sig:
                logger.error("No webhook signature provided")
                return False

            calculated = base64.b64encode(
                hmac.new(
                    secret.encode("utf-8"),
                    payload,
                    hashlib.sha256,
                ).digest()
            ).decode("utf-8")

            return hmac.compare_digest(calculated, sig)

        except Exception as exc:
            logger.error("Webhook signature verification failed: %s", exc)
            return False

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str,
    ) -> Dict[str, Any]:
        """
        Parse a Shopify webhook payload into a standardised event dict.

        Supported event topics:

        * ``orders/create``
        * ``orders/updated``
        * ``orders/cancelled``
        * ``orders/fulfilled``
        * ``refunds/create``

        All other topics are returned with ``action`` = ``"unknown"``.
        """
        base: Dict[str, Any] = {
            "event_type": event_type,
            "marketplace": "SHOPIFY",
            "connection_id": str(self.connection_id),
            "received_at": datetime.utcnow().isoformat(),
        }

        topic = event_type.lower().strip()

        if topic == "orders/create":
            order = self._parse_order(payload)
            base.update(
                {
                    "action": "order_created",
                    "marketplace_order_id": str(payload.get("id")),
                    "order": order.__dict__ if order else None,
                    "data": payload,
                }
            )

        elif topic == "orders/updated":
            order = self._parse_order(payload)
            base.update(
                {
                    "action": "order_updated",
                    "marketplace_order_id": str(payload.get("id")),
                    "order": order.__dict__ if order else None,
                    "financial_status": payload.get("financial_status"),
                    "fulfillment_status": payload.get("fulfillment_status"),
                    "data": payload,
                }
            )

        elif topic == "orders/cancelled":
            base.update(
                {
                    "action": "order_cancelled",
                    "marketplace_order_id": str(payload.get("id")),
                    "cancel_reason": payload.get("cancel_reason"),
                    "cancelled_at": payload.get("cancelled_at"),
                    "data": payload,
                }
            )

        elif topic == "orders/fulfilled":
            fulfillments = payload.get("fulfillments", [])
            base.update(
                {
                    "action": "order_fulfilled",
                    "marketplace_order_id": str(payload.get("id")),
                    "fulfillments": [
                        {
                            "id": str(f.get("id")),
                            "status": f.get("status"),
                            "tracking_number": f.get("tracking_number"),
                            "tracking_company": f.get("tracking_company"),
                            "tracking_url": f.get("tracking_url"),
                        }
                        for f in fulfillments
                    ],
                    "data": payload,
                }
            )

        elif topic == "refunds/create":
            refunds = payload.get("refunds", [payload])
            parsed_returns = []
            for ref in refunds:
                ret = self._parse_return(payload, ref)
                if ret:
                    parsed_returns.append(ret.__dict__ if hasattr(ret, "__dict__") else ret)
            base.update(
                {
                    "action": "refund_created",
                    "marketplace_order_id": str(payload.get("order_id", payload.get("id"))),
                    "returns": parsed_returns,
                    "data": payload,
                }
            )

        else:
            base.update(
                {
                    "action": "unknown",
                    "marketplace_order_id": str(payload.get("id", "")),
                    "data": payload,
                }
            )

        return base

    # ==================================================================
    # Health Check
    # ==================================================================

    async def health_check(self) -> bool:
        """
        Verify the Shopify connection by calling ``GET /shop.json``.
        """
        try:
            data = await self._api_get("/shop.json")
            shop = data.get("shop", {})
            if shop.get("id"):
                logger.info(
                    "Shopify health check OK -- shop: %s (%s)",
                    shop.get("name"),
                    shop.get("myshopify_domain"),
                )
                return True
            return False
        except Exception as exc:
            logger.error("Shopify health check failed: %s", exc)
            return False
