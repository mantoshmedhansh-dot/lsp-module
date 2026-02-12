"""
Nykaa Partner/Seller API Adapter
Implementation of MarketplaceAdapter for Nykaa Seller API
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import time

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

NYKAA_BASE_URL = "https://seller.nykaa.com/api/v1"


@register_adapter("NYKAA")
class NykaaAdapter(MarketplaceAdapter):
    """
    Nykaa Partner/Seller API Adapter.

    Implements Nykaa Seller API for:
    - Orders API (order fetch, dispatch, cancellation)
    - Inventory API (stock updates)
    - Returns API (return handling)
    - Settlements API (financial data)

    Authentication: API Key + Seller ID in headers (no OAuth).
    No webhook support (pull-based integration).
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.base_url = config.api_endpoint or NYKAA_BASE_URL
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "Nykaa"

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
        """Build authentication headers with API Key and Seller ID."""
        return {
            "X-Api-Key": self.credentials.api_key or "",
            "X-Seller-Id": self.credentials.seller_id or "",
        }

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Make authenticated request to Nykaa API."""
        client = await self._get_client()
        url = f"{self.base_url}{path}"
        headers = self._auth_headers()

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
                raise ValueError(f"Unsupported HTTP method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise Exception(
                    f"Nykaa API error {response.status_code}: "
                    f"{error_data.get('message', error_data.get('error', 'Unknown error'))}"
                )

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            raise Exception("Nykaa API request timed out")
        except httpx.RequestError as e:
            raise Exception(f"Nykaa API request failed: {e}")

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """
        Validate API Key credentials with Nykaa.

        Nykaa uses API Key + Seller ID authentication (no OAuth).
        This method verifies the credentials are valid by making a test call.
        """
        try:
            if not self.credentials.api_key or not self.credentials.seller_id:
                return AuthResult(
                    success=False,
                    error_message="API Key and Seller ID are required for Nykaa",
                )

            # Validate credentials by hitting a lightweight endpoint
            client = await self._get_client()
            url = f"{self.base_url}/orders"
            headers = self._auth_headers()

            response = await client.get(
                url,
                params={"limit": 1},
                headers=headers,
            )

            if response.status_code == 401 or response.status_code == 403:
                return AuthResult(
                    success=False,
                    error_message="Invalid API Key or Seller ID",
                )

            self.is_authenticated = True
            return AuthResult(
                success=True,
                access_token=self.credentials.api_key,
                token_type="ApiKey",
            )

        except Exception as e:
            logger.error(f"Nykaa authentication failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        Refresh token -- not applicable for API Key auth.

        Nykaa uses static API Key + Seller ID; no token refresh is needed.
        Re-validates credentials instead.
        """
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
        """Fetch orders from Nykaa with date range and optional status filter."""
        try:
            params: Dict[str, Any] = {
                "from_date": from_date.strftime("%Y-%m-%d"),
                "to_date": (to_date or datetime.utcnow()).strftime("%Y-%m-%d"),
                "limit": limit,
            }

            if status:
                params["status"] = status

            if cursor:
                params["page"] = int(cursor)

            response = await self._make_request("GET", "/orders", params=params)

            orders: List[MarketplaceOrder] = []
            raw_orders = response.get("orders", response.get("data", []))

            for raw in raw_orders:
                order = self._parse_order(raw)
                if order:
                    orders.append(order)

            # Determine next cursor
            next_cursor = None
            pagination = response.get("pagination", {})
            if pagination.get("has_next") or len(raw_orders) >= limit:
                current_page = int(cursor) if cursor else 1
                next_cursor = str(current_page + 1)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse a Nykaa order response into the standardized MarketplaceOrder."""
        try:
            address = data.get("shipping_address", {})
            items_raw = data.get("items", data.get("order_items", []))

            subtotal = sum(float(item.get("selling_price", 0)) * int(item.get("quantity", 1))
                          for item in items_raw)
            shipping = float(data.get("shipping_charge", 0))
            tax = float(data.get("tax_amount", 0))
            discount = float(data.get("discount", 0))
            total = float(data.get("total_amount", subtotal + shipping + tax - discount))

            order_date_str = data.get("order_date") or data.get("created_at")
            if order_date_str:
                order_date = datetime.fromisoformat(
                    order_date_str.replace("Z", "+00:00")
                )
            else:
                order_date = datetime.utcnow()

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("order_id", data.get("id", ""))),
                marketplace="NYKAA",
                order_status=data.get("status", "PENDING"),
                order_date=order_date,
                customer_name=data.get("customer_name", address.get("name", "")),
                customer_email=data.get("customer_email"),
                customer_phone=data.get("customer_phone", address.get("phone")),
                shipping_address={
                    "name": address.get("name", ""),
                    "address_line1": address.get("address_line1", address.get("address1", "")),
                    "address_line2": address.get("address_line2", address.get("address2", "")),
                    "city": address.get("city", ""),
                    "state": address.get("state", ""),
                    "postal_code": address.get("pincode", address.get("zip", "")),
                    "country": address.get("country", "IN"),
                    "phone": address.get("phone", ""),
                },
                billing_address=data.get("billing_address", {}),
                items=[
                    {
                        "marketplace_line_id": str(item.get("line_id", item.get("item_id", ""))),
                        "marketplace_sku": item.get("sku", ""),
                        "title": item.get("product_name", item.get("title", "")),
                        "quantity": int(item.get("quantity", 1)),
                        "unit_price": float(item.get("selling_price", 0)),
                        "total_price": float(item.get("selling_price", 0)) * int(item.get("quantity", 1)),
                        "tax_amount": float(item.get("tax", 0)),
                        "discount_amount": float(item.get("discount", 0)),
                    }
                    for item in items_raw
                ],
                subtotal=subtotal,
                shipping_amount=shipping,
                tax_amount=tax,
                discount_amount=discount,
                total_amount=total,
                currency="INR",
                payment_method=data.get("payment_method", "PREPAID"),
                is_cod=data.get("payment_method", "").upper() == "COD",
                fulfillment_type=FulfillmentType.SELLER,
                promised_delivery_date=(
                    datetime.fromisoformat(data["promised_delivery_date"].replace("Z", "+00:00"))
                    if data.get("promised_delivery_date")
                    else None
                ),
                ship_by_date=(
                    datetime.fromisoformat(data["ship_by_date"].replace("Z", "+00:00"))
                    if data.get("ship_by_date")
                    else None
                ),
                raw_data=data,
            )

        except Exception as e:
            logger.error(f"Failed to parse Nykaa order: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order by ID from Nykaa."""
        try:
            response = await self._make_request("GET", f"/orders/{marketplace_order_id}")
            order_data = response.get("order", response)
            return self._parse_order(order_data)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Dispatch/ship an order on Nykaa.

        Uses POST /orders/{id}/dispatch with AWB and carrier info.
        """
        try:
            body: Dict[str, Any] = {
                "status": update.new_status,
            }

            if update.tracking_number:
                body["awb_number"] = update.tracking_number
            if update.carrier_name:
                body["carrier"] = update.carrier_name
            if update.ship_date:
                body["dispatch_date"] = update.ship_date.strftime("%Y-%m-%d")
            if update.items:
                body["items"] = update.items
            if update.notes:
                body["notes"] = update.notes

            response = await self._make_request(
                "POST",
                f"/orders/{update.marketplace_order_id}/dispatch",
                body=body,
            )

            return response.get("success", False) or response.get("status") == "SUCCESS"

        except Exception as e:
            self._log_error("update_order_status", e)
            return False

    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None,
    ) -> bool:
        """Cancel an order on Nykaa."""
        try:
            body: Dict[str, Any] = {
                "cancellation_reason": reason,
            }
            if items:
                body["items"] = items

            response = await self._make_request(
                "POST",
                f"/orders/{marketplace_order_id}/cancel",
                body=body,
            )

            return response.get("success", False) or response.get("status") == "SUCCESS"

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
        """Push inventory updates to Nykaa via PUT /inventory/update."""
        results: List[InventoryUpdateResult] = []

        try:
            payload = {
                "inventory": [
                    {
                        "sku": update.marketplace_sku,
                        "quantity": update.quantity,
                    }
                    for update in updates
                ]
            }

            response = await self._make_request("PUT", "/inventory/update", body=payload)

            response_items = response.get("results", response.get("data", []))
            response_map: Dict[str, Dict] = {}
            for item in response_items:
                sku = item.get("sku", "")
                response_map[sku] = item

            for update in updates:
                item_resp = response_map.get(update.marketplace_sku, {})
                success = item_resp.get("success", True) if item_resp else True

                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=success,
                    new_qty=update.quantity if success else None,
                    acknowledged_qty=item_resp.get("acknowledged_qty"),
                    error_message=item_resp.get("error") if not success else None,
                    raw_response=item_resp,
                ))

        except Exception as e:
            for update in updates:
                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=False,
                    error_message=str(e),
                ))

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Nykaa."""
        inventory: Dict[str, int] = {}

        try:
            params = {"skus": ",".join(marketplace_skus)}
            response = await self._make_request("GET", "/inventory", params=params)

            for item in response.get("inventory", response.get("data", [])):
                sku = item.get("sku", "")
                qty = int(item.get("quantity", item.get("stock", 0)))
                if sku:
                    inventory[sku] = qty

        except Exception as e:
            self._log_error("get_inventory", e)

        return inventory

    # =========================================================================
    # Settlements
    # =========================================================================

    async def fetch_settlements(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[Settlement]:
        """Fetch settlement/payment reports from Nykaa."""
        settlements: List[Settlement] = []

        try:
            params = {
                "from_date": from_date.strftime("%Y-%m-%d"),
                "to_date": to_date.strftime("%Y-%m-%d"),
            }

            response = await self._make_request("GET", "/settlements", params=params)

            for item in response.get("settlements", response.get("data", [])):
                settlement_date_str = item.get("settlement_date", item.get("date"))
                settlement_date = (
                    datetime.fromisoformat(settlement_date_str.replace("Z", "+00:00"))
                    if settlement_date_str
                    else from_date
                )

                settlements.append(Settlement(
                    settlement_id=str(item.get("settlement_id", item.get("id", ""))),
                    settlement_date=settlement_date,
                    period_from=from_date,
                    period_to=to_date,
                    total_orders=int(item.get("total_orders", 0)),
                    gross_sales=float(item.get("gross_sales", 0)),
                    marketplace_fee=float(item.get("marketplace_fee", item.get("commission", 0))),
                    shipping_fee=float(item.get("shipping_fee", 0)),
                    tax_collected=float(item.get("tax_collected", item.get("tcs", 0))),
                    refunds=float(item.get("refunds", 0)),
                    net_amount=float(item.get("net_amount", item.get("payout", 0))),
                    currency="INR",
                    items=item.get("line_items", []),
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
        """Fetch return requests from Nykaa via GET /returns."""
        returns: List[MarketplaceReturn] = []

        try:
            params: Dict[str, Any] = {
                "from_date": from_date.strftime("%Y-%m-%d"),
            }
            if status:
                params["status"] = status

            response = await self._make_request("GET", "/returns", params=params)

            for item in response.get("returns", response.get("data", [])):
                initiated_str = item.get("initiated_date", item.get("created_at"))
                initiated_date = (
                    datetime.fromisoformat(initiated_str.replace("Z", "+00:00"))
                    if initiated_str
                    else None
                )

                returns.append(MarketplaceReturn(
                    marketplace_return_id=str(item.get("return_id", item.get("id", ""))),
                    marketplace_order_id=str(item.get("order_id", "")),
                    return_reason=item.get("reason", item.get("return_reason", "")),
                    return_sub_reason=item.get("sub_reason"),
                    customer_comments=item.get("customer_comments"),
                    return_quantity=int(item.get("quantity", 1)),
                    refund_amount=float(item.get("refund_amount", 0)),
                    status=item.get("status", "INITIATED"),
                    initiated_date=initiated_date,
                    items=item.get("items", []),
                    raw_data=item,
                ))

        except Exception as e:
            self._log_error("fetch_returns", e)

        return returns

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> bool:
        """Update return status on Nykaa."""
        try:
            body: Dict[str, Any] = {
                "status": status,
            }
            if notes:
                body["notes"] = notes

            response = await self._make_request(
                "POST",
                f"/returns/{marketplace_return_id}/action",
                body=body,
            )

            return response.get("success", False) or response.get("status") == "SUCCESS"

        except Exception as e:
            self._log_error("update_return_status", e)
            return False

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Nykaa connection is healthy."""
        try:
            client = await self._get_client()
            url = f"{self.base_url}/orders"
            headers = self._auth_headers()

            response = await client.get(url, params={"limit": 1}, headers=headers)
            return response.status_code < 400

        except Exception as e:
            logger.error(f"Nykaa health check failed: {e}")
            return False
