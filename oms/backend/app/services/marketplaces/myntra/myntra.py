"""
Myntra Partner API V4 Adapter (PPMP Model)
Implementation of MarketplaceAdapter for Myntra Partner Portal API
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

# Myntra API endpoints
MYNTRA_BASE_URL = "https://seller.myntra.com/api/v4"


@register_adapter("MYNTRA")
class MyntraAdapter(MarketplaceAdapter):
    """
    Myntra Partner API V4 Adapter (PPMP Model).

    Implements Myntra Partner Portal API for:
    - Orders API (order fetch, pack, dispatch)
    - Inventory API (stock updates)
    - Returns API (return handling)

    Authentication: API Key + Seller ID in headers (no OAuth).
    Webhook support: None (pull-based only).
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.base_url = config.api_endpoint or MYNTRA_BASE_URL
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "Myntra"

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
        """Return Myntra-specific authentication headers."""
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
        """Make authenticated request to Myntra API."""
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
                    f"Myntra API error {response.status_code}: "
                    f"{error_data.get('message', error_data.get('error', 'Unknown error'))}"
                )

            return response.json() if response.content else {}

        except httpx.TimeoutException:
            raise Exception("Myntra API request timed out")
        except httpx.RequestError as e:
            raise Exception(f"Myntra API request failed: {e}")

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """
        Validate API key by calling the account/profile endpoint.
        Myntra uses API Key + Seller ID (no OAuth).
        """
        try:
            response = await self._make_request("GET", "/account/profile")

            self.is_authenticated = True
            return AuthResult(
                success=True,
                access_token=self.credentials.api_key,
                token_type="ApiKey",
            )

        except Exception as e:
            logger.error(f"Myntra authentication failed: {e}")
            self.is_authenticated = False
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """
        No token refresh needed for API key-based auth.
        Return success immediately.
        """
        return AuthResult(
            success=True,
            access_token=self.credentials.api_key,
            token_type="ApiKey",
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
        """Fetch orders from Myntra with date range and pagination."""
        try:
            params: Dict[str, Any] = {
                "dateFrom": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "pageSize": limit,
            }

            if to_date:
                params["dateTo"] = to_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            if status:
                params["status"] = status
            if cursor:
                params["pageNumber"] = int(cursor)

            response = await self._make_request("GET", "/orders", params=params)

            orders: List[MarketplaceOrder] = []
            raw_orders = response.get("orders", [])

            for raw in raw_orders:
                order = self._parse_order(raw)
                if order:
                    orders.append(order)

            # Determine next cursor
            next_cursor: Optional[str] = None
            total_pages = response.get("totalPages", 1)
            current_page = int(cursor) if cursor else 1
            if current_page < total_pages:
                next_cursor = str(current_page + 1)

            return orders, next_cursor

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse Myntra order payload into standardized MarketplaceOrder."""
        try:
            address = data.get("shippingAddress", {})
            order_items = data.get("orderItems", data.get("items", []))

            subtotal = sum(
                float(item.get("sellingPrice", 0)) * int(item.get("quantity", 1))
                for item in order_items
            )
            shipping = float(data.get("shippingCharge", 0))
            tax = float(data.get("taxAmount", 0))
            discount = float(data.get("discount", 0))
            total = float(data.get("totalAmount", subtotal + shipping + tax - discount))

            return MarketplaceOrder(
                marketplace_order_id=str(data.get("orderId", "")),
                marketplace="MYNTRA",
                order_status=data.get("status", "PENDING"),
                order_date=datetime.fromisoformat(
                    data.get("orderDate", datetime.utcnow().isoformat())
                    .replace("Z", "+00:00")
                ),
                customer_name=address.get("name", ""),
                customer_email=data.get("customerEmail"),
                customer_phone=address.get("phone"),
                shipping_address={
                    "name": address.get("name", ""),
                    "address_line1": address.get("addressLine1", ""),
                    "address_line2": address.get("addressLine2", ""),
                    "city": address.get("city", ""),
                    "state": address.get("state", ""),
                    "postal_code": address.get("pincode", ""),
                    "country": "IN",
                    "phone": address.get("phone", ""),
                },
                billing_address=data.get("billingAddress", {}),
                items=[
                    {
                        "marketplace_line_id": str(item.get("orderItemId", "")),
                        "marketplace_sku": item.get("sku", ""),
                        "style_id": item.get("styleId", ""),
                        "title": item.get("productName", item.get("title", "")),
                        "size": item.get("size", ""),
                        "quantity": int(item.get("quantity", 1)),
                        "unit_price": float(item.get("sellingPrice", 0)),
                        "mrp": float(item.get("mrp", 0)),
                        "discount": float(item.get("discount", 0)),
                    }
                    for item in order_items
                ],
                subtotal=subtotal,
                shipping_amount=shipping,
                tax_amount=tax,
                discount_amount=discount,
                total_amount=total,
                currency="INR",
                payment_method=data.get("paymentMethod", "PREPAID"),
                is_cod=data.get("paymentMethod", "").upper() == "COD",
                fulfillment_type=FulfillmentType.SELLER,
                promised_delivery_date=(
                    datetime.fromisoformat(data["promisedDeliveryDate"].replace("Z", "+00:00"))
                    if data.get("promisedDeliveryDate")
                    else None
                ),
                ship_by_date=(
                    datetime.fromisoformat(data["shipByDate"].replace("Z", "+00:00"))
                    if data.get("shipByDate")
                    else None
                ),
                raw_data=data,
            )

        except Exception as e:
            logger.error(f"Failed to parse Myntra order: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a single order by ID from Myntra."""
        try:
            response = await self._make_request("GET", f"/orders/{marketplace_order_id}")
            order_data = response.get("order", response)
            return self._parse_order(order_data)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """
        Update order status on Myntra.
        Myntra uses a two-step fulfillment: pack then dispatch.
        """
        try:
            status_lower = update.new_status.lower()

            if status_lower in ("packed", "pack", "ready_to_ship"):
                # Step 1: Pack the order
                body: Dict[str, Any] = {
                    "orderId": update.marketplace_order_id,
                }
                if update.items:
                    body["orderItemIds"] = update.items

                await self._make_request(
                    "POST",
                    f"/orders/{update.marketplace_order_id}/pack",
                    body=body,
                )

            elif status_lower in ("dispatched", "dispatch", "shipped"):
                # Step 2: Dispatch with tracking
                body = {
                    "orderId": update.marketplace_order_id,
                    "trackingNumber": update.tracking_number or "",
                    "carrierName": update.carrier_name or "",
                }
                if update.ship_date:
                    body["dispatchDate"] = update.ship_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")

                await self._make_request(
                    "POST",
                    f"/orders/{update.marketplace_order_id}/dispatch",
                    body=body,
                )

            else:
                logger.warning(f"Myntra: unsupported status transition '{update.new_status}'")
                return False

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
        """Cancel an order on Myntra."""
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
        """Push inventory updates to Myntra."""
        results: List[InventoryUpdateResult] = []

        try:
            payload = {
                "inventoryUpdates": [
                    {
                        "sku": u.marketplace_sku,
                        "quantity": u.quantity,
                    }
                    for u in updates
                ]
            }

            response = await self._make_request("PUT", "/inventory/update", body=payload)

            response_items = response.get("results", [])
            response_map: Dict[str, Dict] = {
                item.get("sku", ""): item for item in response_items
            }

            for u in updates:
                item_result = response_map.get(u.marketplace_sku, {})
                success = item_result.get("status", "").upper() == "SUCCESS"
                results.append(InventoryUpdateResult(
                    marketplace_sku=u.marketplace_sku,
                    success=success,
                    new_qty=u.quantity if success else None,
                    acknowledged_qty=item_result.get("acknowledgedQuantity"),
                    error_message=item_result.get("errorMessage") if not success else None,
                    raw_response=item_result,
                ))

        except Exception as e:
            for u in updates:
                results.append(InventoryUpdateResult(
                    marketplace_sku=u.marketplace_sku,
                    success=False,
                    error_message=str(e),
                ))

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Myntra."""
        inventory: Dict[str, int] = {}

        try:
            params = {"skus": ",".join(marketplace_skus)}
            response = await self._make_request("GET", "/inventory", params=params)

            for item in response.get("inventory", []):
                sku = item.get("sku", "")
                qty = int(item.get("quantity", 0))
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
        """
        Fetch settlements from Myntra.
        Myntra PPMP has limited settlement API; return empty list if unavailable.
        """
        settlements: List[Settlement] = []

        try:
            params = {
                "fromDate": from_date.strftime("%Y-%m-%d"),
                "toDate": to_date.strftime("%Y-%m-%d"),
            }

            response = await self._make_request("GET", "/settlements", params=params)

            for item in response.get("settlements", []):
                settlements.append(Settlement(
                    settlement_id=str(item.get("settlementId", "")),
                    settlement_date=datetime.fromisoformat(
                        item.get("settlementDate", datetime.utcnow().isoformat())
                    ),
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
                    raw_data=item,
                ))

        except Exception as e:
            # Settlement API may not be available for all Myntra sellers
            logger.warning(f"Myntra settlements fetch failed (may not be supported): {e}")

        return settlements

    # =========================================================================
    # Returns
    # =========================================================================

    async def fetch_returns(
        self,
        from_date: datetime,
        status: Optional[str] = None,
    ) -> List[MarketplaceReturn]:
        """Fetch returns from Myntra."""
        returns: List[MarketplaceReturn] = []

        try:
            params: Dict[str, Any] = {
                "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            }
            if status:
                params["status"] = status

            response = await self._make_request("GET", "/returns", params=params)

            for item in response.get("returns", []):
                returns.append(MarketplaceReturn(
                    marketplace_return_id=str(item.get("returnId", "")),
                    marketplace_order_id=str(item.get("orderId", "")),
                    return_reason=item.get("returnReason", ""),
                    return_sub_reason=item.get("returnSubReason"),
                    customer_comments=item.get("customerComments"),
                    return_quantity=int(item.get("quantity", 1)),
                    refund_amount=float(item.get("refundAmount", 0)),
                    status=item.get("status", "INITIATED"),
                    initiated_date=(
                        datetime.fromisoformat(
                            item["createdDate"].replace("Z", "+00:00")
                        )
                        if item.get("createdDate")
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
        """Update return status on Myntra."""
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
        """Myntra does not support webhooks. Always returns False."""
        return False

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str,
    ) -> Dict[str, Any]:
        """Myntra does not support webhooks."""
        raise NotImplementedError("Myntra does not support webhook events (pull-based only)")

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Myntra connection is healthy by calling account endpoint."""
        try:
            await self._make_request("GET", "/account/profile")
            return True

        except Exception as e:
            logger.error(f"Myntra health check failed: {e}")
            return False
