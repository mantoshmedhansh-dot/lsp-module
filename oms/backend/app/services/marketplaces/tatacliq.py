"""
Tata CLiQ Seller API Adapter
Implementation of MarketplaceAdapter for Tata CLiQ Seller API v2
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

TATA_CLIQ_BASE_URL = "https://seller.tatacliq.com/api/v2"
TATA_CLIQ_TOKEN_URL = "https://seller.tatacliq.com/oauth/token"


@register_adapter("TATA_CLIQ")
class TataCliqAdapter(MarketplaceAdapter):
    """
    Tata CLiQ Seller API v2 Adapter.

    Implements Tata CLiQ Seller API for:
    - Orders API (order fetch, shipping, cancellation)
    - Inventory/Stock API (product stock updates)
    - Returns API (return handling)
    - Settlements API (financial data)

    Authentication: OAuth2 client_credentials flow.
    Token endpoint: POST /oauth/token
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.base_url = config.api_endpoint or TATA_CLIQ_BASE_URL
        self._token_expires_at: Optional[datetime] = None
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "Tata CLiQ"

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

    def _is_token_valid(self) -> bool:
        """Check if the current access token is still valid."""
        if not self.credentials.access_token:
            return False
        if self._token_expires_at and datetime.utcnow() >= self._token_expires_at:
            return False
        return True

    async def _ensure_authenticated(self) -> None:
        """Ensure we have a valid access token, refreshing if needed."""
        if not self._is_token_valid():
            result = await self.authenticate()
            if not result.success:
                raise Exception(f"Tata CLiQ authentication failed: {result.error_message}")

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Make authenticated request to Tata CLiQ API."""
        await self._ensure_authenticated()

        client = await self._get_client()
        url = f"{self.base_url}{path}"
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
            elif method == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # Handle token expiry mid-session
            if response.status_code == 401:
                self.is_authenticated = False
                self.credentials.access_token = None
                await self._ensure_authenticated()

                headers["Authorization"] = f"Bearer {self.credentials.access_token}"
                if method == "GET":
                    response = await client.get(url, params=params, headers=headers)
                elif method == "POST":
                    response = await client.post(url, params=params, json=body, headers=headers)
                elif method == "PUT":
                    response = await client.put(url, params=params, json=body, headers=headers)
                elif method == "DELETE":
                    response = await client.delete(url, params=params, headers=headers)

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise Exception(
                    f"Tata CLiQ API error {response.status_code}: "
                    f"{error_data.get('message', error_data.get('error', 'Unknown error'))}"
                )

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            raise Exception("Tata CLiQ API request timed out")
        except httpx.RequestError as e:
            raise Exception(f"Tata CLiQ API request failed: {e}")

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """
        Authenticate with Tata CLiQ using OAuth2 client_credentials grant.

        Posts to /oauth/token with client_id and client_secret to obtain
        a Bearer access token.
        """
        try:
            if not self.credentials.client_id or not self.credentials.client_secret:
                return AuthResult(
                    success=False,
                    error_message="client_id and client_secret are required for Tata CLiQ",
                )

            client = await self._get_client()

            response = await client.post(
                TATA_CLIQ_TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.credentials.client_id,
                    "client_secret": self.credentials.client_secret,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                return AuthResult(
                    success=False,
                    error_message=error_data.get(
                        "error_description",
                        error_data.get("error", "OAuth2 token request failed"),
                    ),
                )

            data = response.json()
            expires_in = int(data.get("expires_in", 3600))
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)  # 60s safety margin

            self.credentials.access_token = data["access_token"]
            self._token_expires_at = expires_at
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token"),
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer"),
                scope=data.get("scope"),
            )

        except Exception as e:
            logger.error(f"Tata CLiQ authentication failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        Refresh access token.

        Tata CLiQ uses client_credentials which doesn't issue refresh tokens.
        Re-authenticates with client credentials.
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
        """Fetch orders from Tata CLiQ with date range and pagination."""
        try:
            params: Dict[str, Any] = {
                "from_date": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "to_date": (to_date or datetime.utcnow()).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "page_size": limit,
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

            # Pagination
            next_cursor = None
            pagination = response.get("pagination", {})
            total_pages = pagination.get("total_pages", 0)
            current_page = int(cursor) if cursor else 1
            if current_page < total_pages or len(raw_orders) >= limit:
                next_cursor = str(current_page + 1)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse a Tata CLiQ order response into the standardized MarketplaceOrder."""
        try:
            address = data.get("shipping_address", data.get("delivery_address", {}))
            items_raw = data.get("items", data.get("order_items", []))

            subtotal = sum(
                float(item.get("selling_price", item.get("price", 0)))
                * int(item.get("quantity", 1))
                for item in items_raw
            )
            shipping = float(data.get("shipping_charge", data.get("delivery_charge", 0)))
            tax = float(data.get("tax_amount", 0))
            discount = float(data.get("discount", 0))
            total = float(data.get("total_amount", data.get("order_total", subtotal + shipping + tax - discount)))

            order_date_str = data.get("order_date", data.get("created_at"))
            if order_date_str:
                order_date = datetime.fromisoformat(order_date_str.replace("Z", "+00:00"))
            else:
                order_date = datetime.utcnow()

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("order_id", data.get("id", ""))),
                marketplace="TATA_CLIQ",
                order_status=data.get("status", data.get("order_status", "PENDING")),
                order_date=order_date,
                customer_name=data.get("customer_name", address.get("name", "")),
                customer_email=data.get("customer_email"),
                customer_phone=data.get("customer_phone", address.get("phone")),
                shipping_address={
                    "name": address.get("name", ""),
                    "address_line1": address.get("address_line1", address.get("line1", "")),
                    "address_line2": address.get("address_line2", address.get("line2", "")),
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
                        "marketplace_sku": item.get("sku", item.get("seller_sku", "")),
                        "title": item.get("product_name", item.get("title", "")),
                        "quantity": int(item.get("quantity", 1)),
                        "unit_price": float(item.get("selling_price", item.get("price", 0))),
                        "total_price": (
                            float(item.get("selling_price", item.get("price", 0)))
                            * int(item.get("quantity", 1))
                        ),
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
                payment_method=data.get("payment_method", data.get("payment_type", "PREPAID")),
                is_cod=data.get("payment_method", data.get("payment_type", "")).upper() == "COD",
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
            logger.error(f"Failed to parse Tata CLiQ order: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order by ID from Tata CLiQ."""
        try:
            response = await self._make_request("GET", f"/orders/{marketplace_order_id}")
            order_data = response.get("order", response)
            return self._parse_order(order_data)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Ship/dispatch an order on Tata CLiQ.

        Uses POST /orders/{id}/ship with tracking information.
        """
        try:
            body: Dict[str, Any] = {
                "status": update.new_status,
            }

            if update.tracking_number:
                body["tracking_number"] = update.tracking_number
            if update.carrier_name:
                body["carrier_name"] = update.carrier_name
            if update.ship_date:
                body["ship_date"] = update.ship_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            if update.items:
                body["items"] = update.items
            if update.notes:
                body["notes"] = update.notes

            response = await self._make_request(
                "POST",
                f"/orders/{update.marketplace_order_id}/ship",
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
        """Cancel an order on Tata CLiQ."""
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
        """Push inventory updates to Tata CLiQ via PUT /products/{id}/stock."""
        results: List[InventoryUpdateResult] = []

        for update in updates:
            try:
                body = {
                    "quantity": update.quantity,
                }

                response = await self._make_request(
                    "PUT",
                    f"/products/{update.marketplace_sku}/stock",
                    body=body,
                )

                success = response.get("success", False) or response.get("status") == "SUCCESS"

                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=success,
                    previous_qty=response.get("previous_quantity"),
                    new_qty=update.quantity if success else None,
                    acknowledged_qty=response.get("acknowledged_quantity"),
                    error_message=response.get("error") if not success else None,
                    raw_response=response,
                ))

            except Exception as e:
                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=False,
                    error_message=str(e),
                ))

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Tata CLiQ."""
        inventory: Dict[str, int] = {}

        for sku in marketplace_skus:
            try:
                response = await self._make_request("GET", f"/products/{sku}/stock")
                qty = int(response.get("quantity", response.get("stock", 0)))
                inventory[sku] = qty

            except Exception as e:
                logger.warning(f"Failed to get inventory for SKU {sku} on Tata CLiQ: {e}")
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
        """Fetch settlement/payment reports from Tata CLiQ."""
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
        """Fetch return requests from Tata CLiQ via GET /returns."""
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
        """Update return status on Tata CLiQ."""
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
        """Check if Tata CLiQ connection is healthy by verifying the OAuth token."""
        try:
            await self._ensure_authenticated()
            # Make a lightweight call to verify connectivity
            await self._make_request("GET", "/orders", params={"page_size": 1})
            return True

        except Exception as e:
            logger.error(f"Tata CLiQ health check failed: {e}")
            return False
