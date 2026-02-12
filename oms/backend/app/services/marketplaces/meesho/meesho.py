"""
Meesho Partner/Seller API Adapter
Implementation of MarketplaceAdapter for Meesho Seller API V2
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
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

# Meesho API endpoints
MEESHO_BASE_URL = "https://seller.meesho.com/api/v2"


@register_adapter("MEESHO")
class MeeshoAdapter(MarketplaceAdapter):
    """
    Meesho Partner/Seller API Adapter.

    Implements Meesho Seller API V2 for:
    - Orders API (order fetch, ship with AWB)
    - Inventory API (product inventory updates)
    - Returns API (return handling)

    Authentication: API Token in Authorization header (`Token {api_token}`).
    Webhook support: None (pull-based only).
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.base_url = config.api_endpoint or MEESHO_BASE_URL
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "Meesho"

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
            "health_check",
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            )
        return self._http_client

    def _auth_headers(self) -> Dict[str, str]:
        """Return Meesho-specific authentication headers."""
        api_token = (
            self.credentials.api_key
            or self.credentials.access_token
            or ""
        )
        return {
            "Authorization": f"Token {api_token}",
        }

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Make authenticated request to Meesho API."""
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
                    f"Meesho API error {response.status_code}: "
                    f"{error_data.get('message', error_data.get('error', 'Unknown error'))}"
                )

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            raise Exception("Meesho API request timed out")
        except httpx.RequestError as e:
            raise Exception(f"Meesho API request failed: {e}")

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """
        Validate API token by calling the account/profile endpoint.
        Meesho uses a static API Token (no OAuth).
        """
        try:
            response = await self._make_request("GET", "/account/profile")

            self.is_authenticated = True
            return AuthResult(
                success=True,
                access_token=self.credentials.api_key or self.credentials.access_token,
                token_type="Token",
            )

        except Exception as e:
            logger.error(f"Meesho authentication failed: {e}")
            self.is_authenticated = False
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        No token refresh needed for API token-based auth.
        Return success immediately.
        """
        return AuthResult(
            success=True,
            access_token=self.credentials.api_key or self.credentials.access_token,
            token_type="Token",
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
        """Fetch orders from Meesho with date range and pagination."""
        try:
            params: Dict[str, Any] = {
                "created_after": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "limit": limit,
            }

            if to_date:
                params["created_before"] = to_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            if status:
                params["status"] = status
            if cursor:
                params["offset"] = int(cursor)

            response = await self._make_request("GET", "/orders", params=params)

            orders: List[MarketplaceOrder] = []
            raw_orders = response.get("orders", response.get("data", []))

            for raw in raw_orders:
                order = self._parse_order(raw)
                if order:
                    orders.append(order)

            # Determine next cursor
            next_cursor: Optional[str] = None
            total_count = response.get("total", response.get("totalCount", 0))
            current_offset = int(cursor) if cursor else 0
            if current_offset + limit < total_count:
                next_cursor = str(current_offset + limit)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse Meesho order payload into standardized MarketplaceOrder."""
        try:
            address = data.get("shippingAddress", data.get("delivery_address", {}))
            order_items = data.get("orderItems", data.get("sub_orders", []))

            subtotal = sum(
                float(item.get("selling_price", item.get("sellingPrice", 0)))
                * int(item.get("quantity", 1))
                for item in order_items
            )
            shipping = float(data.get("shippingCharge", data.get("shipping_charge", 0)))
            tax = float(data.get("taxAmount", data.get("gst_amount", 0)))
            discount = float(data.get("discount", 0))
            total = float(data.get("totalAmount", data.get("order_total", subtotal + shipping + tax - discount)))

            customer_name = (
                address.get("name", "")
                or f"{address.get('first_name', '')} {address.get('last_name', '')}".strip()
            )

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("orderId", data.get("order_id", ""))),
                marketplace="MEESHO",
                order_status=data.get("status", data.get("order_status", "PENDING")),
                order_date=datetime.fromisoformat(
                    data.get("orderDate", data.get("created_at", datetime.utcnow().isoformat()))
                    .replace("Z", "+00:00")
                ),
                customer_name=customer_name,
                customer_email=data.get("customerEmail"),
                customer_phone=address.get("phone", address.get("mobile", "")),
                shipping_address={
                    "name": customer_name,
                    "address_line1": address.get("addressLine1", address.get("address_line1", "")),
                    "address_line2": address.get("addressLine2", address.get("address_line2", "")),
                    "city": address.get("city", ""),
                    "state": address.get("state", ""),
                    "postal_code": address.get("pincode", address.get("pin_code", "")),
                    "country": "IN",
                    "phone": address.get("phone", address.get("mobile", "")),
                },
                billing_address=data.get("billingAddress", {}),
                items=[
                    {
                        "marketplace_line_id": str(
                            item.get("orderItemId", item.get("sub_order_id", ""))
                        ),
                        "marketplace_sku": item.get("sku", item.get("supplier_sku", "")),
                        "product_id": str(item.get("product_id", "")),
                        "title": item.get("productName", item.get("product_name", "")),
                        "variation": item.get("variation", ""),
                        "quantity": int(item.get("quantity", 1)),
                        "unit_price": float(
                            item.get("selling_price", item.get("sellingPrice", 0))
                        ),
                        "gst_amount": float(item.get("gst_amount", 0)),
                    }
                    for item in order_items
                ],
                subtotal=subtotal,
                shipping_amount=shipping,
                tax_amount=tax,
                discount_amount=discount,
                total_amount=total,
                currency="INR",
                payment_method=data.get("paymentMethod", data.get("payment_mode", "PREPAID")),
                is_cod=data.get("paymentMethod", data.get("payment_mode", "")).upper() == "COD",
                fulfillment_type=FulfillmentType.SELLER,
                promised_delivery_date=(
                    datetime.fromisoformat(
                        data["promisedDeliveryDate"].replace("Z", "+00:00")
                    )
                    if data.get("promisedDeliveryDate")
                    else None
                ),
                ship_by_date=(
                    datetime.fromisoformat(
                        data["shipByDate"].replace("Z", "+00:00")
                    )
                    if data.get("shipByDate")
                    else None
                ),
                raw_data=data,
            )

        except Exception as e:
            logger.error(f"Failed to parse Meesho order: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a single order by ID from Meesho."""
        try:
            response = await self._make_request("GET", f"/orders/{marketplace_order_id}")
            order_data = response.get("order", response)
            return self._parse_order(order_data)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Update order status on Meesho.
        Meesho requires AWB and carrier info for shipping.
        """
        try:
            body: Dict[str, Any] = {
                "orderId": update.marketplace_order_id,
                "awb": update.tracking_number or "",
                "carrier": update.carrier_name or "",
            }
            if update.ship_date:
                body["shipDate"] = update.ship_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            if update.items:
                body["orderItemIds"] = update.items

            await self._make_request(
                "POST",
                f"/orders/{update.marketplace_order_id}/ship",
                body=body,
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
        """Cancel an order on Meesho."""
        try:
            body: Dict[str, Any] = {
                "orderId": marketplace_order_id,
                "cancellationReason": reason,
            }
            if items:
                body["orderItemIds"] = items

            await self._make_request(
                "POST",
                f"/orders/{marketplace_order_id}/cancel",
                body=body,
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
        updates: List[InventoryUpdate],
    ) -> List[InventoryUpdateResult]:
        """Push inventory updates to Meesho (per-product endpoint)."""
        results: List[InventoryUpdateResult] = []

        for u in updates:
            try:
                # Meesho uses product_id-based inventory endpoint
                # The marketplace_sku is expected to map to a product_id
                body = {
                    "sku": u.marketplace_sku,
                    "quantity": u.quantity,
                }

                response = await self._make_request(
                    "PUT",
                    f"/products/{u.marketplace_sku}/inventory",
                    body=body,
                )

                success = response.get("status", "").upper() in ("SUCCESS", "OK", "UPDATED")
                results.append(InventoryUpdateResult(
                    marketplace_sku=u.marketplace_sku,
                    success=success,
                    new_qty=u.quantity if success else None,
                    acknowledged_qty=response.get("acknowledgedQuantity"),
                    error_message=response.get("errorMessage") if not success else None,
                    raw_response=response,
                ))

            except Exception as e:
                results.append(InventoryUpdateResult(
                    marketplace_sku=u.marketplace_sku,
                    success=False,
                    error_message=str(e),
                ))

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Meesho."""
        inventory: Dict[str, int] = {}

        for sku in marketplace_skus:
            try:
                response = await self._make_request(
                    "GET",
                    f"/products/{sku}/inventory",
                )
                qty = int(response.get("quantity", response.get("stock", 0)))
                inventory[sku] = qty

            except Exception as e:
                logger.warning(f"Meesho: failed to get inventory for SKU {sku}: {e}")
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
        Fetch settlements from Meesho.
        Meesho has limited public settlement API; return empty list if unavailable.
        """
        settlements: List[Settlement] = []

        try:
            params = {
                "from_date": from_date.strftime("%Y-%m-%d"),
                "to_date": to_date.strftime("%Y-%m-%d"),
            }

            response = await self._make_request("GET", "/settlements", params=params)

            for item in response.get("settlements", response.get("data", [])):
                settlements.append(Settlement(
                    settlement_id=str(item.get("settlement_id", item.get("id", ""))),
                    settlement_date=datetime.fromisoformat(
                        item.get("settlement_date", datetime.utcnow().isoformat())
                    ),
                    period_from=from_date,
                    period_to=to_date,
                    total_orders=int(item.get("total_orders", 0)),
                    gross_sales=float(item.get("gross_sales", 0)),
                    marketplace_fee=float(item.get("commission", item.get("marketplace_fee", 0))),
                    shipping_fee=float(item.get("shipping_fee", 0)),
                    tax_collected=float(item.get("tds", item.get("tax_collected", 0))),
                    refunds=float(item.get("refunds", 0)),
                    net_amount=float(item.get("net_amount", item.get("payout_amount", 0))),
                    currency="INR",
                    raw_data=item,
                ))

        except Exception as e:
            logger.warning(f"Meesho settlements fetch failed (may not be supported): {e}")

        return settlements

    # =========================================================================
    # Returns
    # =========================================================================

    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None,
    ) -> List[MarketplaceReturn]:
        """Fetch returns from Meesho."""
        returns: List[MarketplaceReturn] = []

        try:
            params: Dict[str, Any] = {
                "created_after": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            }
            if status:
                params["status"] = status

            response = await self._make_request("GET", "/returns", params=params)

            for item in response.get("returns", response.get("data", [])):
                returns.append(MarketplaceReturn(
                    marketplace_return_id=str(
                        item.get("returnId", item.get("return_id", ""))
                    ),
                    marketplace_order_id=str(
                        item.get("orderId", item.get("order_id", ""))
                    ),
                    return_reason=item.get("return_reason", item.get("returnReason", "")),
                    return_sub_reason=item.get("return_sub_reason", item.get("returnSubReason")),
                    customer_comments=item.get("customer_comments", item.get("customerComments")),
                    return_quantity=int(item.get("quantity", 1)),
                    refund_amount=float(item.get("refund_amount", item.get("refundAmount", 0))),
                    status=item.get("status", "INITIATED"),
                    initiated_date=(
                        datetime.fromisoformat(
                            item["created_at"].replace("Z", "+00:00")
                        )
                        if item.get("created_at")
                        else None
                    ),
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
        """Update return status on Meesho."""
        try:
            body: Dict[str, Any] = {
                "returnId": marketplace_return_id,
                "action": status,
            }
            if notes:
                body["comments"] = notes

            await self._make_request(
                "POST",
                f"/returns/{marketplace_return_id}/action",
                body=body,
            )
            return True

        except Exception as e:
            self._log_error("update_return_status", e)
            return False

    # =========================================================================
    # Webhooks (Not Supported)
    # =========================================================================

    async def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        headers: Dict[str, str],
    ) -> bool:
        """Meesho does not support webhooks. Always returns False."""
        return False

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str,
    ) -> Dict[str, Any]:
        """Meesho does not support webhooks."""
        raise NotImplementedError("Meesho does not support webhook events (pull-based only)")

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Meesho connection is healthy by calling account endpoint."""
        try:
            await self._make_request("GET", "/account/profile")
            return True

        except Exception as e:
            logger.error(f"Meesho health check failed: {e}")
            return False
