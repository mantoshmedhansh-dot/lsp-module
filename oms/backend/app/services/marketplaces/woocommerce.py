"""
WooCommerce REST API v3 Adapter
Implementation of MarketplaceAdapter for WooCommerce stores
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
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


# WooCommerce status mapping to OMS normalized statuses
WC_STATUS_MAP = {
    "pending": "PENDING",
    "processing": "PROCESSING",
    "on-hold": "ON_HOLD",
    "completed": "COMPLETED",
    "cancelled": "CANCELLED",
    "refunded": "REFUNDED",
    "failed": "FAILED",
    "trash": "DELETED",
}

# Reverse mapping: OMS status to WooCommerce status
OMS_TO_WC_STATUS = {
    "PROCESSING": "processing",
    "COMPLETED": "completed",
    "CANCELLED": "cancelled",
    "ON_HOLD": "on-hold",
    "SHIPPED": "completed",
}


@register_adapter("WOOCOMMERCE")
class WooCommerceAdapter(MarketplaceAdapter):
    """
    WooCommerce REST API v3 Adapter.

    Implements WooCommerce REST API for self-hosted WooCommerce stores:
    - Orders API (order fetch, status update, cancellation)
    - Products API (inventory/stock management)
    - Webhooks (HMAC-SHA256 signature verification)
    - Refunds API (return management)

    Authentication: Consumer Key + Consumer Secret via HTTP Basic Auth.
    Base URL pattern: {store_url}/wp-json/wc/v3/
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.store_url = self._normalize_store_url(config.credentials.store_url)
        self.base_api_url = f"{self.store_url}/wp-json/wc/v3"
        self._http_client: Optional[httpx.AsyncClient] = None
        # Consumer key / secret used for Basic Auth
        self._consumer_key = (
            config.credentials.api_key
            or config.credentials.additional.get("consumer_key", "")
        )
        self._consumer_secret = (
            config.credentials.api_secret
            or config.credentials.additional.get("consumer_secret", "")
        )
        # Webhook secret (different from consumer secret; used for signature verification)
        self._webhook_secret = config.credentials.additional.get("webhook_secret", "")

    # =========================================================================
    # Internal helpers
    # =========================================================================

    def _normalize_store_url(self, url: Optional[str]) -> str:
        """Normalize store URL, stripping trailing slashes and ensuring scheme."""
        if not url:
            return ""
        url = url.strip().rstrip("/")
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"
        return url

    @property
    def name(self) -> str:
        return "WooCommerce"

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
            "update_return_status",
            "verify_webhook_signature",
            "parse_webhook_event",
            "health_check",
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client with Basic Auth."""
        if self._http_client is None or self._http_client.is_closed:
            # WooCommerce REST API v3 uses HTTP Basic Auth with consumer key/secret.
            # For HTTPS endpoints this is safe. For plain HTTP, WooCommerce also
            # supports query-param auth (?consumer_key=...&consumer_secret=...),
            # but Basic Auth is the preferred approach.
            auth = (self._consumer_key, self._consumer_secret)
            self._http_client = httpx.AsyncClient(
                auth=auth,
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "CJDQuick-OMS/1.0 (WooCommerce Adapter)",
                },
            )
        return self._http_client

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        Make an authenticated request to the WooCommerce REST API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            path: API path relative to /wp-json/wc/v3 (e.g. "/orders")
            params: Query parameters
            body: JSON body for POST/PUT

        Returns:
            Parsed JSON response (dict or list depending on endpoint)
        """
        client = await self._get_client()

        # Build full URL — path should start with "/"
        url = f"{self.base_api_url}{path}"

        start_time = time.time()

        try:
            if method == "GET":
                response = await client.get(url, params=params)
            elif method == "POST":
                response = await client.post(url, params=params, json=body)
            elif method == "PUT":
                response = await client.put(url, params=params, json=body)
            elif method == "DELETE":
                response = await client.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # Handle rate limiting (WooCommerce doesn't have formal rate limits
            # but some hosts enforce them via HTTP 429)
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", 5))
                self._rate_limit_reset = datetime.utcnow() + timedelta(
                    seconds=retry_after
                )
                raise Exception(
                    f"Rate limited by WooCommerce host. Retry after {retry_after}s"
                )

            # Parse pagination headers (WP style)
            total_pages = response.headers.get("X-WP-TotalPages")
            total_items = response.headers.get("X-WP-Total")
            if total_pages:
                # Rough heuristic: if we haven't exhausted pages, remain > 0
                self._rate_limit_remaining = max(int(total_pages) - 1, 0)

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                error_code = error_data.get("code", "unknown")
                error_msg = error_data.get("message", "Unknown error")
                raise Exception(
                    f"WooCommerce API error {response.status_code}: "
                    f"[{error_code}] {error_msg}"
                )

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, 0, duration_ms)
            raise Exception(f"WooCommerce request timed out: {method} {path}")
        except httpx.RequestError as e:
            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, 0, duration_ms)
            raise Exception(f"WooCommerce request failed: {e}")

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """
        Validate WooCommerce credentials by hitting the store root endpoint.

        WooCommerce uses permanent API keys (consumer key/secret), so
        "authentication" is simply verifying that the credentials are valid.
        We do this by calling GET / (system status summary).
        """
        try:
            if not self._consumer_key or not self._consumer_secret:
                return AuthResult(
                    success=False,
                    error_message="Consumer key and consumer secret are required",
                )

            # Hit the WC REST root to validate credentials
            response = await self._make_request("GET", "")
            # If we get here without exception, credentials are valid
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=self._consumer_key,  # Store key as "token" for consistency
                token_type="Basic",
            )

        except Exception as e:
            self._log_error("authenticate", e)
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        WooCommerce uses permanent API keys; no token refresh is needed.

        Returns a success result immediately.
        """
        return AuthResult(
            success=True,
            access_token=self._consumer_key,
            token_type="Basic",
        )

    # =========================================================================
    # Orders
    # =========================================================================

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: Optional[datetime] = None,
        status: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> Tuple[List[MarketplaceOrder], Optional[str]]:
        """
        Fetch orders from WooCommerce.

        Uses WC REST API v3 GET /orders with date filtering and page-based pagination.
        The `cursor` is used as a page number (string representation of int).
        """
        try:
            page = int(cursor) if cursor else 1
            per_page = min(limit, 100)  # WooCommerce max per_page is 100

            params: Dict[str, Any] = {
                "after": from_date.strftime("%Y-%m-%dT%H:%M:%S"),
                "per_page": per_page,
                "page": page,
                "orderby": "date",
                "order": "desc",
            }

            if to_date:
                params["before"] = to_date.strftime("%Y-%m-%dT%H:%M:%S")

            if status:
                # Map OMS status back to WC status if needed
                wc_status = OMS_TO_WC_STATUS.get(status.upper(), status.lower())
                params["status"] = wc_status

            response = await self._make_request("GET", "/orders", params=params)

            orders: List[MarketplaceOrder] = []
            # WooCommerce returns a list of orders directly (not wrapped in a key)
            order_list = response if isinstance(response, list) else []

            for order_data in order_list:
                order = self._parse_order(order_data)
                if order:
                    orders.append(order)

            # Determine next cursor: if we got a full page, there may be more
            next_cursor = None
            if len(order_list) >= per_page:
                next_cursor = str(page + 1)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict[str, Any]) -> Optional[MarketplaceOrder]:
        """Parse a WooCommerce order JSON object to the standardized MarketplaceOrder."""
        try:
            billing = data.get("billing", {}) or {}
            shipping = data.get("shipping", {}) or {}

            # Customer name: prefer shipping, fall back to billing
            customer_name = (
                f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip()
                or f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip()
                or "Unknown"
            )

            # Parse line items
            items: List[Dict[str, Any]] = []
            for item in data.get("line_items", []):
                items.append(
                    {
                        "marketplace_line_id": str(item.get("id", "")),
                        "marketplace_sku": item.get("sku") or str(item.get("product_id", "")),
                        "product_id": str(item.get("product_id", "")),
                        "variation_id": str(item.get("variation_id", 0)),
                        "title": item.get("name", ""),
                        "quantity": int(item.get("quantity", 1)),
                        "unit_price": float(item.get("price", 0)),
                        "total_price": float(item.get("total", 0)),
                        "tax_amount": float(item.get("total_tax", 0)),
                        "discount_amount": abs(
                            float(item.get("subtotal", 0)) - float(item.get("total", 0))
                        ),
                        "item_status": data.get("status", ""),
                    }
                )

            # Compute shipping total from shipping_lines
            shipping_total = float(data.get("shipping_total", 0))

            # Determine payment type
            payment_method = data.get("payment_method_title", "") or data.get(
                "payment_method", ""
            )
            is_cod = data.get("payment_method", "").lower() in ("cod", "cheque")

            # Map WooCommerce status to OMS status
            wc_status = data.get("status", "pending")
            order_status = WC_STATUS_MAP.get(wc_status, wc_status.upper())

            # Parse order date
            date_created = data.get("date_created", "")
            if date_created:
                order_date = datetime.fromisoformat(
                    date_created.replace("Z", "+00:00")
                )
            else:
                order_date = datetime.utcnow()

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("id", "")),
                marketplace="WOOCOMMERCE",
                order_status=order_status,
                order_date=order_date,
                customer_name=customer_name,
                customer_email=billing.get("email"),
                customer_phone=billing.get("phone") or shipping.get("phone"),
                shipping_address={
                    "name": f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip(),
                    "address_line1": shipping.get("address_1"),
                    "address_line2": shipping.get("address_2"),
                    "city": shipping.get("city"),
                    "state": shipping.get("state"),
                    "postal_code": shipping.get("postcode"),
                    "country": shipping.get("country"),
                    "phone": shipping.get("phone") or billing.get("phone"),
                    "company": shipping.get("company"),
                },
                billing_address={
                    "name": f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip(),
                    "address_line1": billing.get("address_1"),
                    "address_line2": billing.get("address_2"),
                    "city": billing.get("city"),
                    "state": billing.get("state"),
                    "postal_code": billing.get("postcode"),
                    "country": billing.get("country"),
                    "email": billing.get("email"),
                    "phone": billing.get("phone"),
                    "company": billing.get("company"),
                },
                items=items,
                subtotal=float(data.get("subtotal", 0)) if data.get("subtotal") else sum(
                    float(li.get("subtotal", 0)) for li in data.get("line_items", [])
                ),
                shipping_amount=shipping_total,
                tax_amount=float(data.get("total_tax", 0)),
                discount_amount=float(data.get("discount_total", 0)),
                total_amount=float(data.get("total", 0)),
                currency=data.get("currency", "INR"),
                payment_method=payment_method,
                is_cod=is_cod,
                fulfillment_type=FulfillmentType.SELLER,
                raw_data=data,
            )

        except Exception as e:
            logger.error(f"Failed to parse WooCommerce order: {e}", exc_info=True)
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order by WooCommerce order ID."""
        try:
            response = await self._make_request(
                "GET", f"/orders/{marketplace_order_id}"
            )
            return self._parse_order(response)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Update order status on WooCommerce.

        Maps the OMS status to a WooCommerce status (e.g. "processing", "completed")
        and optionally adds a tracking note.
        """
        try:
            wc_status = OMS_TO_WC_STATUS.get(
                update.new_status.upper(), update.new_status.lower()
            )

            body: Dict[str, Any] = {"status": wc_status}

            await self._make_request(
                "PUT",
                f"/orders/{update.marketplace_order_id}",
                body=body,
            )

            # If tracking info is provided, add an order note
            if update.tracking_number or update.carrier_name:
                note_parts = []
                if update.carrier_name:
                    note_parts.append(f"Carrier: {update.carrier_name}")
                if update.tracking_number:
                    note_parts.append(f"Tracking: {update.tracking_number}")
                if update.ship_date:
                    note_parts.append(
                        f"Shipped: {update.ship_date.strftime('%Y-%m-%d')}"
                    )
                if update.notes:
                    note_parts.append(update.notes)

                note_body = {
                    "note": " | ".join(note_parts),
                    "customer_note": True,
                }

                await self._make_request(
                    "POST",
                    f"/orders/{update.marketplace_order_id}/notes",
                    body=note_body,
                )

            return True

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
        Cancel an order on WooCommerce by setting its status to 'cancelled'.

        Also adds a note with the cancellation reason.
        """
        try:
            # Set order status to cancelled
            body: Dict[str, Any] = {"status": "cancelled"}
            await self._make_request(
                "PUT", f"/orders/{marketplace_order_id}", body=body
            )

            # Add cancellation reason as an order note
            note_body = {
                "note": f"Order cancelled. Reason: {reason}",
                "customer_note": False,
            }
            await self._make_request(
                "POST",
                f"/orders/{marketplace_order_id}/notes",
                body=note_body,
            )

            return True

        except Exception as e:
            self._log_error("cancel_order", e)
            return False

    # =========================================================================
    # Inventory
    # =========================================================================

    async def push_inventory(
        self, updates: List[InventoryUpdate]
    ) -> List[InventoryUpdateResult]:
        """
        Push inventory (stock quantity) updates to WooCommerce.

        For simple products: PUT /products/{id} with stock_quantity.
        For variations: PUT /products/{product_id}/variations/{variation_id}.

        The marketplace_sku is expected to be in one of these formats:
        - "{product_id}" for simple products
        - "{product_id}:{variation_id}" for variable products
        - A literal SKU string (looked up via GET /products?sku=...)
        """
        results: List[InventoryUpdateResult] = []

        for update in updates:
            try:
                product_id, variation_id = self._parse_sku_identifier(
                    update.marketplace_sku
                )

                # If neither product_id nor variation_id were parsed, look up by SKU
                if not product_id:
                    product_id, variation_id = await self._lookup_product_by_sku(
                        update.marketplace_sku
                    )

                if not product_id:
                    results.append(
                        InventoryUpdateResult(
                            marketplace_sku=update.marketplace_sku,
                            success=False,
                            error_message=f"Product not found for SKU: {update.marketplace_sku}",
                        )
                    )
                    continue

                stock_body: Dict[str, Any] = {
                    "stock_quantity": update.quantity,
                    "manage_stock": True,
                }

                if variation_id:
                    # Variable product: update the variation
                    response = await self._make_request(
                        "PUT",
                        f"/products/{product_id}/variations/{variation_id}",
                        body=stock_body,
                    )
                else:
                    # Simple product: update the product directly
                    response = await self._make_request(
                        "PUT",
                        f"/products/{product_id}",
                        body=stock_body,
                    )

                acknowledged_qty = response.get("stock_quantity", update.quantity)

                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=update.marketplace_sku,
                        success=True,
                        new_qty=update.quantity,
                        acknowledged_qty=acknowledged_qty,
                        raw_response=response if isinstance(response, dict) else {},
                    )
                )

            except Exception as e:
                results.append(
                    InventoryUpdateResult(
                        marketplace_sku=update.marketplace_sku,
                        success=False,
                        error_message=str(e),
                    )
                )

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """
        Get current stock quantities from WooCommerce for the given SKUs.

        Looks up products by SKU and returns their stock_quantity values.
        """
        inventory: Dict[str, int] = {}

        for sku in marketplace_skus:
            try:
                # Try parsing as product_id or product_id:variation_id first
                product_id, variation_id = self._parse_sku_identifier(sku)

                if product_id and variation_id:
                    # Fetch variation directly
                    response = await self._make_request(
                        "GET",
                        f"/products/{product_id}/variations/{variation_id}",
                    )
                    inventory[sku] = int(response.get("stock_quantity", 0) or 0)

                elif product_id:
                    # Fetch product directly
                    response = await self._make_request(
                        "GET", f"/products/{product_id}"
                    )
                    inventory[sku] = int(response.get("stock_quantity", 0) or 0)

                else:
                    # Search by SKU string
                    response = await self._make_request(
                        "GET", "/products", params={"sku": sku, "per_page": 1}
                    )
                    products = response if isinstance(response, list) else []
                    if products:
                        inventory[sku] = int(
                            products[0].get("stock_quantity", 0) or 0
                        )

            except Exception as e:
                logger.warning(
                    f"Failed to get WooCommerce inventory for SKU {sku}: {e}"
                )

        return inventory

    def _parse_sku_identifier(
        self, sku: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse a SKU identifier that may be in the format:
        - "{product_id}" (simple product, numeric)
        - "{product_id}:{variation_id}" (variation, numeric:numeric)
        - A literal SKU string (non-numeric) -> returns (None, None)
        """
        if ":" in sku:
            parts = sku.split(":", 1)
            if parts[0].isdigit() and parts[1].isdigit():
                return parts[0], parts[1]
        elif sku.isdigit():
            return sku, None
        return None, None

    async def _lookup_product_by_sku(
        self, sku: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Look up a product/variation by its WooCommerce SKU field.

        Returns (product_id, variation_id) or (product_id, None) for simple products.
        """
        try:
            response = await self._make_request(
                "GET", "/products", params={"sku": sku, "per_page": 1}
            )
            products = response if isinstance(response, list) else []
            if products:
                product = products[0]
                product_id = str(product.get("id", ""))

                # Check if this is a variable product and the SKU belongs to a variation
                if product.get("type") == "variable":
                    # Search variations
                    var_response = await self._make_request(
                        "GET",
                        f"/products/{product_id}/variations",
                        params={"sku": sku, "per_page": 1},
                    )
                    variations = (
                        var_response if isinstance(var_response, list) else []
                    )
                    if variations:
                        return product_id, str(variations[0].get("id", ""))

                return product_id, None

        except Exception as e:
            logger.warning(f"SKU lookup failed for '{sku}': {e}")

        return None, None

    # =========================================================================
    # Settlements
    # =========================================================================

    async def fetch_settlements(
        self, from_date: datetime, to_date: datetime
    ) -> List[Settlement]:
        """
        WooCommerce does not have a built-in settlements/payouts API.

        Payment processing is handled by third-party gateways (Stripe, PayPal, etc.)
        which have their own settlement reports.

        Returns an empty list.
        """
        logger.info(
            "WooCommerce does not provide a settlements API. "
            "Use the payment gateway's settlement reports instead."
        )
        return []

    # =========================================================================
    # Returns / Refunds
    # =========================================================================

    async def fetch_returns(
        self, from_date: datetime, status: Optional[str] = None
    ) -> List[MarketplaceReturn]:
        """
        Fetch refunded orders from WooCommerce.

        WooCommerce models returns as refunds on orders. We fetch orders with
        status=refunded and then extract their refund records.
        """
        returns: List[MarketplaceReturn] = []

        try:
            page = 1
            per_page = 100

            while True:
                params: Dict[str, Any] = {
                    "after": from_date.strftime("%Y-%m-%dT%H:%M:%S"),
                    "status": "refunded",
                    "per_page": per_page,
                    "page": page,
                }

                response = await self._make_request(
                    "GET", "/orders", params=params
                )
                order_list = response if isinstance(response, list) else []

                if not order_list:
                    break

                for order_data in order_list:
                    order_id = str(order_data.get("id", ""))

                    # Fetch refunds for this order
                    try:
                        refund_response = await self._make_request(
                            "GET", f"/orders/{order_id}/refunds"
                        )
                        refund_list = (
                            refund_response
                            if isinstance(refund_response, list)
                            else []
                        )

                        for refund in refund_list:
                            # Parse refund items
                            refund_items: List[Dict[str, Any]] = []
                            total_qty = 0
                            for ri in refund.get("line_items", []):
                                qty = abs(int(ri.get("quantity", 0)))
                                total_qty += qty
                                refund_items.append(
                                    {
                                        "marketplace_line_id": str(ri.get("id", "")),
                                        "sku": ri.get("sku", ""),
                                        "name": ri.get("name", ""),
                                        "quantity": qty,
                                        "total": float(ri.get("total", 0)),
                                    }
                                )

                            refund_date_str = refund.get("date_created", "")
                            refund_date = None
                            if refund_date_str:
                                refund_date = datetime.fromisoformat(
                                    refund_date_str.replace("Z", "+00:00")
                                )

                            returns.append(
                                MarketplaceReturn(
                                    marketplace_return_id=str(
                                        refund.get("id", "")
                                    ),
                                    marketplace_order_id=order_id,
                                    return_reason=refund.get("reason", "")
                                    or "Refund",
                                    refund_amount=abs(
                                        float(refund.get("amount", 0))
                                    ),
                                    return_quantity=total_qty or 1,
                                    status="REFUNDED",
                                    initiated_date=refund_date,
                                    items=refund_items,
                                    raw_data=refund,
                                )
                            )

                    except Exception as refund_err:
                        logger.warning(
                            f"Failed to fetch refunds for WC order {order_id}: {refund_err}"
                        )

                # Pagination: if fewer results than per_page, we've reached the end
                if len(order_list) < per_page:
                    break

                page += 1

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
        Update a refund on WooCommerce.

        WooCommerce refunds are somewhat immutable once created, but we can
        attempt to delete and re-create or add notes. The return ID is expected
        in the format "{order_id}:{refund_id}".

        Returns True if the operation succeeds, False otherwise.
        """
        try:
            # Expect marketplace_return_id as "order_id:refund_id"
            if ":" in marketplace_return_id:
                order_id, refund_id = marketplace_return_id.split(":", 1)
            else:
                logger.warning(
                    "WooCommerce update_return_status requires "
                    "'order_id:refund_id' format"
                )
                return False

            # WooCommerce does not have a PATCH/PUT for refunds, but we can
            # add a note to the order indicating the return status update
            if notes or status:
                note_text = f"Return {refund_id} status updated to: {status}"
                if notes:
                    note_text += f" | {notes}"

                await self._make_request(
                    "POST",
                    f"/orders/{order_id}/notes",
                    body={
                        "note": note_text,
                        "customer_note": False,
                    },
                )

            return True

        except Exception as e:
            self._log_error("update_return_status", e)
            return False

    # =========================================================================
    # Webhooks
    # =========================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str],
    ) -> bool:
        """
        Verify WooCommerce webhook signature.

        WooCommerce signs webhook payloads with HMAC-SHA256 using the webhook
        secret. The signature is sent in the `X-WC-Webhook-Signature` header
        as a base64-encoded digest.
        """
        try:
            # Determine the webhook secret to use
            secret = self._webhook_secret or self._consumer_secret
            if not secret:
                logger.error("No webhook secret configured for signature verification")
                return False

            # The signature may come from the headers dict or the signature param
            sig = signature or headers.get("X-WC-Webhook-Signature", "")
            if not sig:
                logger.warning("No webhook signature found in request")
                return False

            # Calculate expected signature
            calculated = base64.b64encode(
                hmac.new(
                    secret.encode("utf-8"),
                    payload,
                    hashlib.sha256,
                ).digest()
            ).decode("utf-8")

            return hmac.compare_digest(calculated, sig)

        except Exception as e:
            logger.error(f"WooCommerce webhook verification failed: {e}")
            return False

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str,
    ) -> Dict[str, Any]:
        """
        Parse a WooCommerce webhook event into a standardized format.

        WooCommerce webhook topics follow the pattern "resource.action":
        - order.created, order.updated, order.deleted
        - product.created, product.updated, product.deleted
        - customer.created, etc.

        Args:
            payload: The webhook JSON payload (the resource object itself)
            event_type: The webhook topic (e.g. "order.created")

        Returns:
            Standardized event dict with type, marketplace, IDs, and data.
        """
        parts = event_type.split(".", 1)
        resource = parts[0] if parts else "unknown"
        action = parts[1] if len(parts) > 1 else "unknown"

        result: Dict[str, Any] = {
            "event_type": event_type,
            "resource": resource,
            "action": action,
            "marketplace": "WOOCOMMERCE",
            "data": payload,
        }

        if resource == "order":
            result["order_id"] = str(payload.get("id", ""))
            result["order_status"] = WC_STATUS_MAP.get(
                payload.get("status", ""), payload.get("status", "")
            )

            # Parse the order into normalized form for downstream consumers
            if action in ("created", "updated"):
                order = self._parse_order(payload)
                if order:
                    result["normalized_order"] = {
                        "marketplace_order_id": order.marketplace_order_id,
                        "order_status": order.order_status,
                        "total_amount": order.total_amount,
                        "currency": order.currency,
                        "customer_name": order.customer_name,
                        "item_count": len(order.items),
                    }

        elif resource == "product":
            result["product_id"] = str(payload.get("id", ""))
            result["sku"] = payload.get("sku", "")
            result["stock_quantity"] = payload.get("stock_quantity")

        elif resource == "customer":
            result["customer_id"] = str(payload.get("id", ""))

        return result

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """
        Check if the WooCommerce connection is healthy.

        Calls GET /system_status which requires valid authentication and
        returns store information if the connection is working.
        """
        try:
            response = await self._make_request("GET", "/system_status")
            # If we get a response without error, the connection is healthy
            return isinstance(response, dict) and bool(response)

        except Exception as e:
            logger.error(f"WooCommerce health check failed: {e}")
            return False
