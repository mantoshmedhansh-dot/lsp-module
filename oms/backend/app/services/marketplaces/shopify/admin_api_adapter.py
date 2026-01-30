"""
Shopify Admin API Adapter
Implementation of MarketplaceAdapter for Shopify Admin API
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


# Shopify API version
SHOPIFY_API_VERSION = "2024-01"


@register_adapter("SHOPIFY")
class ShopifyAdapter(MarketplaceAdapter):
    """
    Shopify Admin API Adapter.

    Implements Shopify Admin API for D2C stores:
    - Orders API (order fetch, fulfillment, cancellation)
    - Inventory API (inventory levels, adjustments)
    - Products API (product/variant management)
    - Webhooks (real-time notifications)
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.store_url = self._normalize_store_url(config.credentials.store_url)
        self._http_client = None
        self._location_id = config.sync_settings.get("location_id")

    def _normalize_store_url(self, url: Optional[str]) -> str:
        """Normalize store URL to API endpoint format."""
        if not url:
            return ""
        url = url.strip().rstrip("/")
        if not url.startswith("https://"):
            url = f"https://{url}"
        if ".myshopify.com" not in url:
            url = f"{url}.myshopify.com"
        return url

    @property
    def name(self) -> str:
        return "SHOPIFY"

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
            "fetch_listings",
            "update_listing_price",
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        """Get HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            )
        return self._http_client

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """Validate Shopify credentials."""
        try:
            # For private apps, just validate the token works
            if self.credentials.access_token:
                # Test the token
                healthy = await self.health_check()
                if healthy:
                    self.is_authenticated = True
                    return AuthResult(
                        success=True,
                        access_token=self.credentials.access_token
                    )
                else:
                    return AuthResult(
                        success=False,
                        error_message="Token validation failed"
                    )

            return AuthResult(
                success=False,
                error_message="No access token provided"
            )

        except Exception as e:
            logger.error(f"Shopify authentication failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """Refresh OAuth token."""
        try:
            if not self.credentials.refresh_token:
                return AuthResult(
                    success=False,
                    error_message="No refresh token available"
                )

            client = await self._get_client()

            response = await client.post(
                f"{self.store_url}/admin/oauth/access_token",
                json={
                    "client_id": self.credentials.client_id,
                    "client_secret": self.credentials.client_secret,
                    "refresh_token": self.credentials.refresh_token,
                    "grant_type": "refresh_token",
                }
            )

            if response.status_code != 200:
                return AuthResult(
                    success=False,
                    error_message="Token refresh failed"
                )

            data = response.json()
            self.credentials.access_token = data["access_token"]
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                expires_at=datetime.utcnow() + timedelta(days=365)  # Shopify tokens don't expire
            )

        except Exception as e:
            logger.error(f"Shopify token refresh failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    def get_oauth_authorize_url(self, redirect_uri: str, state: str) -> str:
        """Get Shopify OAuth authorization URL."""
        scopes = "read_orders,write_orders,read_products,write_products,read_inventory,write_inventory"
        return (
            f"{self.store_url}/admin/oauth/authorize"
            f"?client_id={self.credentials.client_id}"
            f"&scope={scopes}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
        )

    async def exchange_code_for_token(self, code: str, redirect_uri: str) -> AuthResult:
        """Exchange authorization code for access token."""
        try:
            client = await self._get_client()

            response = await client.post(
                f"{self.store_url}/admin/oauth/access_token",
                json={
                    "client_id": self.credentials.client_id,
                    "client_secret": self.credentials.client_secret,
                    "code": code,
                }
            )

            if response.status_code != 200:
                return AuthResult(
                    success=False,
                    error_message="Token exchange failed"
                )

            data = response.json()
            self.credentials.access_token = data["access_token"]
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                scope=data.get("scope")
            )

        except Exception as e:
            logger.error(f"Shopify token exchange failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to Shopify API."""
        if not self.credentials.access_token:
            raise Exception("Not authenticated")

        client = await self._get_client()
        url = f"{self.store_url}/admin/api/{SHOPIFY_API_VERSION}{path}"

        headers = {
            "X-Shopify-Access-Token": self.credentials.access_token,
        }

        start_time = time.time()

        try:
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(url, params=params, json=body, headers=headers)
            elif method == "PUT":
                response = await client.put(url, params=params, json=body, headers=headers)
            elif method == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", 2))
                self._rate_limit_reset = datetime.utcnow() + timedelta(seconds=retry_after)
                raise Exception(f"Rate limited. Retry after {retry_after}s")

            # Parse API call limit header
            call_limit = response.headers.get("X-Shopify-Shop-Api-Call-Limit", "40/40")
            used, limit = call_limit.split("/")
            self._rate_limit_remaining = int(limit) - int(used)

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                errors = error_data.get("errors", {})
                if isinstance(errors, dict):
                    error_msg = "; ".join(f"{k}: {v}" for k, v in errors.items())
                else:
                    error_msg = str(errors)
                raise Exception(f"API error {response.status_code}: {error_msg}")

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            raise Exception("Request timed out")
        except httpx.RequestError as e:
            raise Exception(f"Request failed: {e}")

    # =========================================================================
    # Orders
    # =========================================================================

    async def fetch_orders(
        self,
        from_date: datetime,
        to_date: Optional[datetime] = None,
        status: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 50
    ) -> Tuple[List[MarketplaceOrder], Optional[str]]:
        """Fetch orders from Shopify."""
        try:
            params = {
                "created_at_min": from_date.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "limit": min(limit, 250),
                "status": "any",
            }

            if to_date:
                params["created_at_max"] = to_date.strftime("%Y-%m-%dT%H:%M:%S%z")

            if status:
                params["fulfillment_status"] = status

            if cursor:
                params["since_id"] = cursor

            response = await self._make_request("GET", "/orders.json", params=params)

            orders = []
            for order_data in response.get("orders", []):
                order = self._parse_order(order_data)
                if order:
                    orders.append(order)

            # Get next cursor (last order ID)
            next_cursor = None
            if orders:
                last_order = response.get("orders", [])[-1]
                next_cursor = str(last_order.get("id"))

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse Shopify order to standardized format."""
        try:
            shipping = data.get("shipping_address", {}) or {}
            billing = data.get("billing_address", {}) or {}

            # Parse line items
            items = []
            for item in data.get("line_items", []):
                items.append({
                    "marketplace_line_id": str(item.get("id")),
                    "marketplace_sku": item.get("sku") or str(item.get("variant_id")),
                    "variant_id": str(item.get("variant_id")),
                    "product_id": str(item.get("product_id")),
                    "title": item.get("name", ""),
                    "quantity": int(item.get("quantity", 1)),
                    "unit_price": float(item.get("price", 0)),
                    "total_price": float(item.get("price", 0)) * int(item.get("quantity", 1)),
                    "tax_amount": sum(float(t.get("price", 0)) for t in item.get("tax_lines", [])),
                    "discount_amount": sum(float(d.get("amount", 0)) for d in item.get("discount_allocations", [])),
                    "fulfillment_status": item.get("fulfillment_status"),
                })

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("id")),
                marketplace="SHOPIFY",
                order_status=data.get("fulfillment_status") or "unfulfilled",
                order_date=datetime.fromisoformat(
                    data.get("created_at", datetime.utcnow().isoformat())
                    .replace("Z", "+00:00")
                ),
                customer_name=f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip(),
                customer_email=data.get("email"),
                customer_phone=shipping.get("phone"),
                shipping_address={
                    "name": shipping.get("name"),
                    "address_line1": shipping.get("address1"),
                    "address_line2": shipping.get("address2"),
                    "city": shipping.get("city"),
                    "state": shipping.get("province"),
                    "postal_code": shipping.get("zip"),
                    "country": shipping.get("country_code"),
                    "phone": shipping.get("phone"),
                },
                billing_address={
                    "name": billing.get("name"),
                    "address_line1": billing.get("address1"),
                    "city": billing.get("city"),
                    "state": billing.get("province"),
                    "postal_code": billing.get("zip"),
                    "country": billing.get("country_code"),
                },
                items=items,
                subtotal=float(data.get("subtotal_price", 0)),
                shipping_amount=sum(float(l.get("price", 0)) for l in data.get("shipping_lines", [])),
                tax_amount=float(data.get("total_tax", 0)),
                discount_amount=float(data.get("total_discounts", 0)),
                total_amount=float(data.get("total_price", 0)),
                currency=data.get("currency", "INR"),
                payment_method=data.get("gateway", ""),
                is_cod=data.get("gateway") == "Cash on Delivery (COD)",
                fulfillment_type=FulfillmentType.SELLER,
                raw_data=data
            )

        except Exception as e:
            logger.error(f"Failed to parse Shopify order: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order."""
        try:
            response = await self._make_request(
                "GET",
                f"/orders/{marketplace_order_id}.json"
            )

            return self._parse_order(response.get("order", {}))

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """Create fulfillment for order (ship)."""
        try:
            # Get order to find fulfillment order ID
            order = await self._make_request(
                "GET",
                f"/orders/{update.marketplace_order_id}.json"
            )

            # Get line item IDs
            line_items = [
                {
                    "id": item["id"],
                    "quantity": item["quantity"]
                }
                for item in order.get("order", {}).get("line_items", [])
            ]

            # Create fulfillment
            fulfillment_data = {
                "fulfillment": {
                    "line_items_by_fulfillment_order": [
                        {
                            "fulfillment_order_id": update.marketplace_order_id,
                            "fulfillment_order_line_items": line_items
                        }
                    ],
                    "tracking_info": {
                        "number": update.tracking_number,
                        "company": update.carrier_name,
                    },
                    "notify_customer": True,
                }
            }

            await self._make_request(
                "POST",
                "/fulfillments.json",
                body=fulfillment_data
            )

            return True

        except Exception as e:
            self._log_error("update_order_status", e)
            return False

    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None
    ) -> bool:
        """Cancel order on Shopify."""
        try:
            body = {
                "reason": reason,
                "email": True,
            }

            await self._make_request(
                "POST",
                f"/orders/{marketplace_order_id}/cancel.json",
                body=body
            )

            return True

        except Exception as e:
            self._log_error("cancel_order", e)
            return False

    # =========================================================================
    # Inventory
    # =========================================================================

    async def push_inventory(
        self,
        updates: List[InventoryUpdate]
    ) -> List[InventoryUpdateResult]:
        """Push inventory updates to Shopify."""
        results = []

        # Get location ID if not set
        if not self._location_id:
            await self._fetch_primary_location()

        for update in updates:
            try:
                # Get inventory item ID from SKU (variant)
                inventory_item_id = await self._get_inventory_item_id(update.marketplace_sku)

                if not inventory_item_id:
                    results.append(InventoryUpdateResult(
                        marketplace_sku=update.marketplace_sku,
                        success=False,
                        error_message="Product/variant not found"
                    ))
                    continue

                # Set inventory level
                body = {
                    "location_id": self._location_id,
                    "inventory_item_id": inventory_item_id,
                    "available": update.quantity,
                }

                await self._make_request(
                    "POST",
                    "/inventory_levels/set.json",
                    body=body
                )

                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=True,
                    new_qty=update.quantity
                ))

            except Exception as e:
                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=False,
                    error_message=str(e)
                ))

        return results

    async def _fetch_primary_location(self):
        """Fetch primary location ID."""
        try:
            response = await self._make_request("GET", "/locations.json")
            locations = response.get("locations", [])
            if locations:
                # Get primary location
                for loc in locations:
                    if loc.get("primary"):
                        self._location_id = loc["id"]
                        break
                if not self._location_id:
                    self._location_id = locations[0]["id"]

        except Exception as e:
            logger.error(f"Failed to fetch locations: {e}")

    async def _get_inventory_item_id(self, sku: str) -> Optional[int]:
        """Get inventory item ID from SKU."""
        try:
            # Search by SKU
            response = await self._make_request(
                "GET",
                "/variants.json",
                params={"sku": sku, "limit": 1}
            )

            variants = response.get("variants", [])
            if variants:
                return variants[0].get("inventory_item_id")

            return None

        except Exception as e:
            logger.error(f"Failed to get inventory item ID: {e}")
            return None

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Shopify."""
        inventory = {}

        if not self._location_id:
            await self._fetch_primary_location()

        for sku in marketplace_skus:
            try:
                inventory_item_id = await self._get_inventory_item_id(sku)
                if inventory_item_id:
                    response = await self._make_request(
                        "GET",
                        "/inventory_levels.json",
                        params={
                            "inventory_item_ids": inventory_item_id,
                            "location_ids": self._location_id
                        }
                    )

                    levels = response.get("inventory_levels", [])
                    if levels:
                        inventory[sku] = levels[0].get("available", 0)

            except Exception as e:
                logger.warning(f"Failed to get inventory for {sku}: {e}")

        return inventory

    # =========================================================================
    # Settlements
    # =========================================================================

    async def fetch_settlements(
        self,
        from_date: datetime,
        to_date: datetime
    ) -> List[Settlement]:
        """Fetch settlements from Shopify (payouts)."""
        settlements = []

        try:
            params = {
                "date_min": from_date.strftime("%Y-%m-%d"),
                "date_max": to_date.strftime("%Y-%m-%d"),
            }

            response = await self._make_request(
                "GET",
                "/shopify_payments/payouts.json",
                params=params
            )

            for payout in response.get("payouts", []):
                settlement = Settlement(
                    settlement_id=str(payout.get("id")),
                    settlement_date=datetime.fromisoformat(
                        payout.get("date", datetime.utcnow().isoformat())
                    ),
                    period_from=from_date,
                    period_to=to_date,
                    net_amount=float(payout.get("amount", 0)),
                    currency=payout.get("currency", "INR"),
                    raw_data=payout
                )
                settlements.append(settlement)

        except Exception as e:
            self._log_error("fetch_settlements", e)

        return settlements

    # =========================================================================
    # Returns
    # =========================================================================

    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None
    ) -> List[MarketplaceReturn]:
        """Fetch refunds/returns from Shopify."""
        returns = []

        try:
            # Shopify uses refunds, not returns
            params = {
                "created_at_min": from_date.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "status": "any",
            }

            response = await self._make_request(
                "GET",
                "/orders.json",
                params=params
            )

            for order in response.get("orders", []):
                for refund in order.get("refunds", []):
                    ret = MarketplaceReturn(
                        marketplace_return_id=str(refund.get("id")),
                        marketplace_order_id=str(order.get("id")),
                        return_reason=refund.get("note", ""),
                        refund_amount=sum(
                            float(t.get("amount", 0))
                            for t in refund.get("transactions", [])
                        ),
                        status="REFUNDED",
                        initiated_date=datetime.fromisoformat(
                            refund.get("created_at", datetime.utcnow().isoformat())
                            .replace("Z", "+00:00")
                        ),
                        raw_data=refund
                    )
                    returns.append(ret)

        except Exception as e:
            self._log_error("fetch_returns", e)

        return returns

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None
    ) -> bool:
        """Update return status - not applicable for Shopify refunds."""
        logger.warning("Shopify refunds cannot be updated")
        return False

    # =========================================================================
    # Listings
    # =========================================================================

    async def fetch_listings(
        self,
        cursor: Optional[str] = None,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Fetch product listings from Shopify."""
        try:
            params = {
                "limit": min(limit, 250),
            }

            if cursor:
                params["since_id"] = cursor

            response = await self._make_request("GET", "/products.json", params=params)

            listings = []
            for product in response.get("products", []):
                for variant in product.get("variants", []):
                    listings.append({
                        "product_id": str(product.get("id")),
                        "variant_id": str(variant.get("id")),
                        "sku": variant.get("sku"),
                        "title": f"{product.get('title')} - {variant.get('title')}",
                        "price": float(variant.get("price", 0)),
                        "inventory_quantity": variant.get("inventory_quantity", 0),
                        "status": product.get("status"),
                    })

            next_cursor = None
            products = response.get("products", [])
            if products:
                next_cursor = str(products[-1].get("id"))

            return listings, next_cursor

        except Exception as e:
            self._log_error("fetch_listings", e)
            raise

    async def update_listing_price(
        self,
        marketplace_sku: str,
        price: float,
        mrp: Optional[float] = None
    ) -> bool:
        """Update product price on Shopify."""
        try:
            # Get variant by SKU
            response = await self._make_request(
                "GET",
                "/variants.json",
                params={"sku": marketplace_sku, "limit": 1}
            )

            variants = response.get("variants", [])
            if not variants:
                return False

            variant_id = variants[0]["id"]

            # Update price
            body = {
                "variant": {
                    "id": variant_id,
                    "price": str(price),
                }
            }

            if mrp:
                body["variant"]["compare_at_price"] = str(mrp)

            await self._make_request(
                "PUT",
                f"/variants/{variant_id}.json",
                body=body
            )

            return True

        except Exception as e:
            self._log_error("update_listing_price", e)
            return False

    # =========================================================================
    # Webhook Verification
    # =========================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str]
    ) -> bool:
        """Verify Shopify webhook signature."""
        try:
            if not self.credentials.api_secret:
                return False

            # Calculate HMAC
            calculated = base64.b64encode(
                hmac.new(
                    self.credentials.api_secret.encode(),
                    payload,
                    hashlib.sha256
                ).digest()
            ).decode()

            return hmac.compare_digest(calculated, signature)

        except Exception as e:
            logger.error(f"Webhook verification failed: {e}")
            return False

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str
    ) -> Dict[str, Any]:
        """Parse Shopify webhook payload."""
        return {
            "event_type": event_type,
            "marketplace": "SHOPIFY",
            "order_id": payload.get("id"),
            "data": payload
        }

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Shopify connection is healthy."""
        try:
            await self._make_request("GET", "/shop.json")
            return True

        except Exception as e:
            logger.error(f"Shopify health check failed: {e}")
            return False
