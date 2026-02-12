"""
Magento REST API v1 Adapter
Implementation of MarketplaceAdapter for Magento 2 REST API
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import time
from urllib.parse import quote

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


@register_adapter("MAGENTO")
class MagentoAdapter(MarketplaceAdapter):
    """
    Magento 2 REST API Adapter.

    Implements Magento REST API V1 for:
    - Orders API (order fetch, shipment creation)
    - Inventory/Stock API (product stock updates)
    - Returns: Not built-in to core Magento, returns empty list

    Authentication: Bearer token approach.
    - Pre-configured bearer token from integration, OR
    - POST /integration/admin/token with username/password to obtain token

    Base URL: {store_url}/rest/V1/
    The store_url is provided via credentials.store_url.
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        store_url = (config.credentials.store_url or config.api_endpoint or "").rstrip("/")
        self.base_url = f"{store_url}/rest/V1" if store_url else ""
        self.store_url = store_url
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "Magento"

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
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        return self._http_client

    def _auth_headers(self) -> Dict[str, str]:
        """Build Bearer token authentication headers."""
        return {
            "Authorization": f"Bearer {self.credentials.access_token or ''}",
        }

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Any] = None,
    ) -> Any:
        """Make authenticated request to Magento REST API."""
        if not self.credentials.access_token:
            auth_result = await self.authenticate()
            if not auth_result.success:
                raise Exception(f"Magento authentication failed: {auth_result.error_message}")

        client = await self._get_client()
        url = f"{self.base_url}{path}"
        headers = self._auth_headers()

        start_time = time.time()

        try:
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(url, json=body, headers=headers)
            elif method == "PUT":
                response = await client.put(url, json=body, headers=headers)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # Handle token expiry
            if response.status_code == 401:
                self.is_authenticated = False
                self.credentials.access_token = None
                auth_result = await self.authenticate()
                if auth_result.success:
                    headers = self._auth_headers()
                    if method == "GET":
                        response = await client.get(url, params=params, headers=headers)
                    elif method == "POST":
                        response = await client.post(url, json=body, headers=headers)
                    elif method == "PUT":
                        response = await client.put(url, json=body, headers=headers)
                    elif method == "DELETE":
                        response = await client.delete(url, headers=headers)

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                message = error_data.get("message", "Unknown error")
                raise Exception(f"Magento API error {response.status_code}: {message}")

            if response.content:
                return response.json()
            return {}

        except httpx.TimeoutException:
            raise Exception("Magento API request timed out")
        except httpx.RequestError as e:
            raise Exception(f"Magento API request failed: {e}")

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """
        Authenticate with Magento.

        Strategy:
        1. If a pre-configured access_token (integration token) is available, validate it.
        2. Otherwise, obtain a token via POST /integration/admin/token with
           username (client_id) and password (client_secret).
        """
        try:
            if not self.base_url:
                return AuthResult(
                    success=False,
                    error_message="store_url is required for Magento integration",
                )

            # If we already have a pre-configured bearer token, validate it
            if self.credentials.access_token:
                client = await self._get_client()
                headers = self._auth_headers()
                response = await client.get(
                    f"{self.base_url}/store/storeConfigs",
                    headers=headers,
                )

                if response.status_code < 400:
                    self.is_authenticated = True
                    return AuthResult(
                        success=True,
                        access_token=self.credentials.access_token,
                        token_type="Bearer",
                    )

            # No valid token -- obtain one via admin credentials
            if not self.credentials.client_id or not self.credentials.client_secret:
                return AuthResult(
                    success=False,
                    error_message=(
                        "Either a pre-configured Bearer token or "
                        "admin username (client_id) and password (client_secret) are required"
                    ),
                )

            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/integration/admin/token",
                json={
                    "username": self.credentials.client_id,
                    "password": self.credentials.client_secret,
                },
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                return AuthResult(
                    success=False,
                    error_message=error_data.get("message", "Token request failed"),
                )

            # Magento returns the token as a plain JSON string
            token = response.json()
            if isinstance(token, str):
                self.credentials.access_token = token
            else:
                self.credentials.access_token = str(token)

            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=self.credentials.access_token,
                token_type="Bearer",
                # Magento admin tokens last 4 hours by default
                expires_at=datetime.utcnow() + timedelta(hours=4),
            )

        except Exception as e:
            logger.error(f"Magento authentication failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        Refresh the access token.

        Magento integration tokens do not expire. Admin tokens expire after 4h.
        Re-authenticate to get a new token.
        """
        self.credentials.access_token = None
        return await self.authenticate()

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
        Fetch orders from Magento using searchCriteria.

        Magento uses query-string-based search criteria:
        GET /orders?searchCriteria[filter_groups][0][filters][0][field]=created_at&...
        """
        try:
            current_page = int(cursor) if cursor else 1

            params: Dict[str, str] = {
                # Filter: created_at >= from_date
                "searchCriteria[filter_groups][0][filters][0][field]": "created_at",
                "searchCriteria[filter_groups][0][filters][0][value]": from_date.strftime("%Y-%m-%d %H:%M:%S"),
                "searchCriteria[filter_groups][0][filters][0][conditionType]": "gteq",
                # Pagination
                "searchCriteria[pageSize]": str(limit),
                "searchCriteria[currentPage]": str(current_page),
                # Sort by created_at desc
                "searchCriteria[sortOrders][0][field]": "created_at",
                "searchCriteria[sortOrders][0][direction]": "DESC",
            }

            filter_idx = 1

            if to_date:
                params[f"searchCriteria[filter_groups][{filter_idx}][filters][0][field]"] = "created_at"
                params[f"searchCriteria[filter_groups][{filter_idx}][filters][0][value]"] = (
                    to_date.strftime("%Y-%m-%d %H:%M:%S")
                )
                params[f"searchCriteria[filter_groups][{filter_idx}][filters][0][conditionType]"] = "lteq"
                filter_idx += 1

            if status:
                params[f"searchCriteria[filter_groups][{filter_idx}][filters][0][field]"] = "status"
                params[f"searchCriteria[filter_groups][{filter_idx}][filters][0][value]"] = status
                params[f"searchCriteria[filter_groups][{filter_idx}][filters][0][conditionType]"] = "eq"

            response = await self._make_request("GET", "/orders", params=params)

            orders: List[MarketplaceOrder] = []
            raw_orders = response.get("items", [])

            for raw in raw_orders:
                order = self._parse_order(raw)
                if order:
                    orders.append(order)

            # Determine next cursor
            next_cursor = None
            total_count = response.get("total_count", 0)
            if current_page * limit < total_count:
                next_cursor = str(current_page + 1)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse a Magento order response into the standardized MarketplaceOrder."""
        try:
            # Magento order structure
            billing = data.get("billing_address", {})
            extension = data.get("extension_attributes", {})
            shipping_assignments = extension.get("shipping_assignments", [])

            # Extract shipping address from first shipping assignment
            shipping_address_raw = {}
            if shipping_assignments:
                shipping_obj = shipping_assignments[0].get("shipping", {})
                shipping_address_raw = shipping_obj.get("address", {})

            items_raw = data.get("items", [])

            # Filter out configurable parent items (they have children)
            actual_items = [
                item for item in items_raw
                if item.get("product_type") != "configurable"
            ]

            subtotal = float(data.get("subtotal", 0))
            shipping = float(data.get("shipping_amount", 0))
            tax = float(data.get("tax_amount", 0))
            discount = abs(float(data.get("discount_amount", 0)))
            total = float(data.get("grand_total", 0))

            order_date_str = data.get("created_at")
            if order_date_str:
                order_date = datetime.fromisoformat(order_date_str.replace("Z", "+00:00"))
            else:
                order_date = datetime.utcnow()

            customer_name = (
                f"{data.get('customer_firstname', '')} {data.get('customer_lastname', '')}".strip()
                or billing.get("firstname", "") + " " + billing.get("lastname", "")
            )

            payment = data.get("payment", {})
            payment_method = payment.get("method", "")
            is_cod = payment_method.lower() in ("cashondelivery", "cod", "cash_on_delivery")

            def _build_address(addr: Dict) -> Dict[str, Any]:
                street = addr.get("street", [])
                return {
                    "name": f"{addr.get('firstname', '')} {addr.get('lastname', '')}".strip(),
                    "address_line1": street[0] if len(street) > 0 else "",
                    "address_line2": street[1] if len(street) > 1 else "",
                    "city": addr.get("city", ""),
                    "state": addr.get("region", addr.get("region_code", "")),
                    "postal_code": addr.get("postcode", ""),
                    "country": addr.get("country_id", ""),
                    "phone": addr.get("telephone", ""),
                }

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("entity_id", data.get("increment_id", ""))),
                marketplace="MAGENTO",
                order_status=data.get("status", "pending"),
                order_date=order_date,
                customer_name=customer_name,
                customer_email=data.get("customer_email"),
                customer_phone=billing.get("telephone"),
                shipping_address=_build_address(shipping_address_raw) if shipping_address_raw else _build_address(billing),
                billing_address=_build_address(billing),
                items=[
                    {
                        "marketplace_line_id": str(item.get("item_id", "")),
                        "marketplace_sku": item.get("sku", ""),
                        "title": item.get("name", ""),
                        "quantity": int(item.get("qty_ordered", 1)),
                        "unit_price": float(item.get("price", 0)),
                        "total_price": float(item.get("row_total", 0)),
                        "tax_amount": float(item.get("tax_amount", 0)),
                        "discount_amount": abs(float(item.get("discount_amount", 0))),
                    }
                    for item in actual_items
                ],
                subtotal=subtotal,
                shipping_amount=shipping,
                tax_amount=tax,
                discount_amount=discount,
                total_amount=total,
                currency=data.get("order_currency_code", data.get("base_currency_code", "INR")),
                payment_method=payment_method,
                is_cod=is_cod,
                fulfillment_type=FulfillmentType.SELLER,
                raw_data=data,
            )

        except Exception as e:
            logger.error(f"Failed to parse Magento order: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order by ID from Magento via GET /orders/{id}."""
        try:
            response = await self._make_request("GET", f"/orders/{marketplace_order_id}")
            return self._parse_order(response)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Create a shipment for an order on Magento.

        Uses POST /order/{id}/ship with tracking info.
        """
        try:
            body: Dict[str, Any] = {}

            if update.tracking_number and update.carrier_name:
                body["tracks"] = [
                    {
                        "track_number": update.tracking_number,
                        "title": update.carrier_name,
                        "carrier_code": update.carrier_name.lower().replace(" ", "_"),
                    }
                ]

            if update.notes:
                body["comment"] = {
                    "comment": update.notes,
                    "is_visible_on_front": 0,
                }

            # Magento shipment creation: items are auto-populated if not specified
            if update.items:
                body["items"] = [
                    {"order_item_id": int(item_id), "qty": 1}
                    for item_id in update.items
                ]

            response = await self._make_request(
                "POST",
                f"/order/{update.marketplace_order_id}/ship",
                body=body,
            )

            # Magento returns the shipment ID (integer) on success
            return response is not None and response != {}

        except Exception as e:
            self._log_error("update_order_status", e)
            return False

    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None,
    ) -> bool:
        """Cancel an order on Magento via POST /orders/{id}/cancel."""
        try:
            response = await self._make_request(
                "POST",
                f"/orders/{marketplace_order_id}/cancel",
            )

            # Magento returns true on successful cancellation
            return response is True or response == "true"

        except Exception as e:
            self._log_error("cancel_order", e)
            return False

    # =========================================================================
    # Inventory
    # =========================================================================

    async def push_inventory(
        self,
        updates: List[InventoryUpdate],
    ) -> List[InventoryUpdateResult]:
        """
        Push inventory updates to Magento.

        Uses PUT /products/{sku} with extension_attributes.stock_item.qty
        to update stock quantity per SKU.
        """
        results: List[InventoryUpdateResult] = []

        for update in updates:
            try:
                encoded_sku = quote(update.marketplace_sku, safe="")

                body = {
                    "product": {
                        "extension_attributes": {
                            "stock_item": {
                                "qty": update.quantity,
                                "is_in_stock": update.quantity > 0,
                            }
                        }
                    }
                }

                response = await self._make_request(
                    "PUT",
                    f"/products/{encoded_sku}",
                    body=body,
                )

                # Magento returns the full product object on success
                success = response is not None and "id" in (response if isinstance(response, dict) else {})
                stock_item = (
                    response.get("extension_attributes", {}).get("stock_item", {})
                    if isinstance(response, dict)
                    else {}
                )

                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=success,
                    previous_qty=int(stock_item.get("qty", 0)) if not success else None,
                    new_qty=update.quantity if success else None,
                    acknowledged_qty=int(stock_item.get("qty", update.quantity)) if success else None,
                    error_message=None if success else "Failed to update stock",
                    raw_response=response if isinstance(response, dict) else {},
                ))

            except Exception as e:
                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=False,
                    error_message=str(e),
                ))

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """
        Get current inventory levels from Magento.

        Uses GET /stockItems/{productSku} for each SKU.
        """
        inventory: Dict[str, int] = {}

        for sku in marketplace_skus:
            try:
                encoded_sku = quote(sku, safe="")
                response = await self._make_request("GET", f"/stockItems/{encoded_sku}")

                if isinstance(response, dict):
                    inventory[sku] = int(response.get("qty", 0))
                else:
                    inventory[sku] = 0

            except Exception as e:
                logger.warning(f"Failed to get inventory for SKU {sku} on Magento: {e}")
                inventory[sku] = 0

        return inventory

    # =========================================================================
    # Settlements
    # =========================================================================

    async def fetch_settlements(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[Settlement]:
        """
        Fetch settlements from Magento.

        Magento does not have a built-in settlements API like marketplace sellers.
        Returns invoices as a proxy for settlement data.
        """
        settlements: List[Settlement] = []

        try:
            params: Dict[str, str] = {
                "searchCriteria[filter_groups][0][filters][0][field]": "created_at",
                "searchCriteria[filter_groups][0][filters][0][value]": from_date.strftime("%Y-%m-%d %H:%M:%S"),
                "searchCriteria[filter_groups][0][filters][0][conditionType]": "gteq",
                "searchCriteria[filter_groups][1][filters][0][field]": "created_at",
                "searchCriteria[filter_groups][1][filters][0][value]": to_date.strftime("%Y-%m-%d %H:%M:%S"),
                "searchCriteria[filter_groups][1][filters][0][conditionType]": "lteq",
                "searchCriteria[pageSize]": "100",
            }

            response = await self._make_request("GET", "/invoices", params=params)

            for item in response.get("items", []):
                invoice_date_str = item.get("created_at")
                invoice_date = (
                    datetime.fromisoformat(invoice_date_str.replace("Z", "+00:00"))
                    if invoice_date_str
                    else from_date
                )

                settlements.append(Settlement(
                    settlement_id=str(item.get("entity_id", item.get("increment_id", ""))),
                    settlement_date=invoice_date,
                    period_from=from_date,
                    period_to=to_date,
                    total_orders=1,
                    gross_sales=float(item.get("subtotal", 0)),
                    shipping_fee=float(item.get("shipping_amount", 0)),
                    tax_collected=float(item.get("tax_amount", 0)),
                    net_amount=float(item.get("grand_total", 0)),
                    currency=item.get("order_currency_code", "INR"),
                    raw_data=item,
                ))

        except Exception as e:
            self._log_error("fetch_settlements", e)

        return settlements

    # =========================================================================
    # Returns
    # =========================================================================

    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None,
    ) -> List[MarketplaceReturn]:
        """
        Fetch returns from Magento.

        Core Magento does not have a built-in returns/RMA API.
        The RMA module is available in Magento Commerce (Enterprise) only.
        Returns an empty list for Magento Open Source.
        """
        logger.info(
            f"[{self.name}] Returns are not supported in core Magento. "
            "Use Magento Commerce RMA module or a third-party extension."
        )
        return []

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> bool:
        """
        Update return status on Magento.

        Core Magento does not have a built-in returns API.
        Returns False since the operation is not supported.
        """
        logger.warning(
            f"[{self.name}] update_return_status is not supported in core Magento."
        )
        return False

    # =========================================================================
    # Webhooks (Not natively supported)
    # =========================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str],
    ) -> bool:
        """Magento does not natively support webhooks."""
        raise NotImplementedError(
            f"{self.name} does not natively support webhooks. "
            "Use a Magento extension (e.g., Mageplaza Webhook) for webhook functionality."
        )

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str,
    ) -> Dict[str, Any]:
        """Magento does not natively support webhooks."""
        raise NotImplementedError(
            f"{self.name} does not natively support webhooks. "
            "Use a Magento extension (e.g., Mageplaza Webhook) for webhook functionality."
        )

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Magento connection is healthy by fetching store config."""
        try:
            response = await self._make_request("GET", "/store/storeConfigs")

            # Magento returns a list of store configs
            if isinstance(response, list) and len(response) > 0:
                return True
            return False

        except Exception as e:
            logger.error(f"Magento health check failed: {e}")
            return False
