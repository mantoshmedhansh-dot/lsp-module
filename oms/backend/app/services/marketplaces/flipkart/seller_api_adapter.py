"""
Flipkart Seller API Adapter
Implementation of MarketplaceAdapter for Flipkart Seller Hub API
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import time
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


# Flipkart API endpoints
FLIPKART_SANDBOX_URL = "https://sandbox-api.flipkart.net/sellers"
FLIPKART_PRODUCTION_URL = "https://api.flipkart.net/sellers"
FLIPKART_AUTH_URL = "https://api.flipkart.net/oauth-service/oauth/token"


@register_adapter("FLIPKART")
class FlipkartAdapter(MarketplaceAdapter):
    """
    Flipkart Seller Hub API Adapter.

    Implements Flipkart Seller API for:
    - Orders API (order fetch, dispatch, cancellation)
    - Listings API (inventory management)
    - Returns API (return handling)
    - Settlements API (financial data)
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.is_sandbox = config.is_sandbox
        self.endpoint = FLIPKART_SANDBOX_URL if self.is_sandbox else FLIPKART_PRODUCTION_URL
        self._http_client = None

    @property
    def name(self) -> str:
        return "FLIPKART"

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
        """Authenticate with Flipkart using client credentials."""
        try:
            client = await self._get_client()

            # Create Basic auth header
            credentials = f"{self.credentials.client_id}:{self.credentials.client_secret}"
            basic_auth = base64.b64encode(credentials.encode()).decode()

            response = await client.post(
                FLIPKART_AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "scope": "Seller_Api",
                },
                headers={
                    "Authorization": f"Basic {basic_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                return AuthResult(
                    success=False,
                    error_message=error_data.get("error_description", "Authentication failed")
                )

            data = response.json()
            expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 86400))

            self.credentials.access_token = data["access_token"]
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                expires_at=expires_at,
                token_type=data.get("token_type", "Bearer")
            )

        except Exception as e:
            logger.error(f"Flipkart authentication failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """Refresh token - Flipkart uses client credentials, so just re-authenticate."""
        return await self.authenticate()

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to Flipkart API."""
        if not self.credentials.access_token:
            auth_result = await self.authenticate()
            if not auth_result.success:
                raise Exception(f"Authentication failed: {auth_result.error_message}")

        client = await self._get_client()
        url = f"{self.endpoint}{path}"

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
            else:
                raise ValueError(f"Unsupported method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            if response.status_code == 401:
                # Token expired, re-authenticate
                self.is_authenticated = False
                auth_result = await self.authenticate()
                if auth_result.success:
                    # Retry request
                    headers["Authorization"] = f"Bearer {self.credentials.access_token}"
                    if method == "GET":
                        response = await client.get(url, params=params, headers=headers)
                    elif method == "POST":
                        response = await client.post(url, params=params, json=body, headers=headers)
                    elif method == "PUT":
                        response = await client.put(url, params=params, json=body, headers=headers)

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise Exception(
                    f"API error {response.status_code}: "
                    f"{error_data.get('message', 'Unknown error')}"
                )

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
        """Fetch orders from Flipkart."""
        try:
            # Flipkart uses filter-based order search
            filter_data = {
                "filter": {
                    "type": "preDispatch",  # or postDispatch
                    "states": [status] if status else ["APPROVED"],
                    "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                }
            }

            if to_date:
                filter_data["filter"]["toDate"] = to_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")

            if cursor:
                filter_data["pagination"] = {"pageNumber": int(cursor)}

            response = await self._make_request(
                "POST",
                "/v3/shipments/filter",
                body=filter_data
            )

            orders = []
            shipments = response.get("shipments", [])

            for shipment in shipments:
                order = self._parse_shipment(shipment)
                if order:
                    orders.append(order)

            # Get next page token
            next_page = None
            if len(shipments) >= limit:
                current_page = int(cursor) if cursor else 1
                next_page = str(current_page + 1)

            return orders, next_page

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_shipment(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse Flipkart shipment to standardized order format."""
        try:
            order_items = data.get("orderItems", [])
            if not order_items:
                return None

            first_item = order_items[0]
            address = data.get("deliveryAddress", {})

            # Calculate totals
            subtotal = sum(float(item.get("priceComponents", {}).get("sellingPrice", 0))
                         for item in order_items)
            shipping = sum(float(item.get("priceComponents", {}).get("shippingCharge", 0))
                          for item in order_items)

            return MarketplaceOrder(
                marketplace_order_id=data.get("shipmentId", ""),
                marketplace="FLIPKART",
                order_status=data.get("status", "PENDING"),
                order_date=datetime.fromisoformat(
                    data.get("orderDate", datetime.utcnow().isoformat())
                    .replace("Z", "+00:00")
                ),
                customer_name=address.get("firstName", "") + " " + address.get("lastName", ""),
                customer_phone=address.get("phone"),
                shipping_address={
                    "name": address.get("firstName", "") + " " + address.get("lastName", ""),
                    "address_line1": address.get("addressLine1"),
                    "address_line2": address.get("addressLine2"),
                    "city": address.get("city"),
                    "state": address.get("state"),
                    "postal_code": address.get("pincode"),
                    "country": "IN",
                    "phone": address.get("phone"),
                    "landmark": address.get("landmark"),
                },
                items=[
                    {
                        "marketplace_line_id": item.get("orderItemId"),
                        "marketplace_sku": item.get("sku"),
                        "fsn": item.get("fsn"),
                        "title": item.get("title", ""),
                        "quantity": int(item.get("quantity", 1)),
                        "unit_price": float(item.get("priceComponents", {}).get("sellingPrice", 0)),
                        "shipping_amount": float(item.get("priceComponents", {}).get("shippingCharge", 0)),
                    }
                    for item in order_items
                ],
                subtotal=subtotal,
                shipping_amount=shipping,
                total_amount=subtotal + shipping,
                currency="INR",
                payment_method=data.get("paymentType", "PREPAID"),
                is_cod=data.get("paymentType") == "COD",
                fulfillment_type=(
                    FulfillmentType.MARKETPLACE
                    if data.get("fulfillmentType") == "FA"
                    else FulfillmentType.SELLER
                ),
                ship_by_date=(
                    datetime.fromisoformat(data["dispatchByDate"].replace("Z", "+00:00"))
                    if data.get("dispatchByDate")
                    else None
                ),
                raw_data=data
            )

        except Exception as e:
            logger.error(f"Failed to parse Flipkart shipment: {e}")
            return None

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order."""
        try:
            response = await self._make_request(
                "GET",
                f"/v3/shipments/{marketplace_order_id}"
            )

            return self._parse_shipment(response)

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """Dispatch/ship order on Flipkart."""
        try:
            # Flipkart dispatch API
            body = {
                "shipments": [
                    {
                        "shipmentId": update.marketplace_order_id,
                        "invoiceDetails": {
                            "invoiceNumber": update.marketplace_order_id,
                            "invoiceDate": datetime.utcnow().strftime("%Y-%m-%d"),
                        },
                        "trackingDetails": {
                            "trackingId": update.tracking_number,
                            "dispatchedDate": (update.ship_date or datetime.utcnow()).strftime("%Y-%m-%d"),
                        },
                        "deliveryPartner": update.carrier_name or "FLIPKART",
                    }
                ]
            }

            response = await self._make_request(
                "POST",
                "/v3/shipments/dispatch",
                body=body
            )

            return response.get("status") == "SUCCESS"

        except Exception as e:
            self._log_error("update_order_status", e)
            return False

    async def cancel_order(
        self,
        marketplace_order_id: str,
        reason: str,
        items: Optional[List[str]] = None
    ) -> bool:
        """Cancel order on Flipkart."""
        try:
            body = {
                "shipments": [
                    {
                        "shipmentId": marketplace_order_id,
                        "cancellationReason": reason,
                    }
                ]
            }

            response = await self._make_request(
                "POST",
                "/v2/shipments/cancel",
                body=body
            )

            return response.get("status") == "SUCCESS"

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
        """Push inventory updates to Flipkart."""
        results = []

        try:
            # Flipkart inventory update API
            listings_update = {
                "listings": [
                    {
                        "sku": update.marketplace_sku,
                        "inventory": update.quantity,
                    }
                    for update in updates
                ]
            }

            response = await self._make_request(
                "POST",
                "/v3/listings/update",
                body=listings_update
            )

            # Parse response
            for update in updates:
                status = response.get("listings", {}).get(update.marketplace_sku, {})
                success = status.get("status") == "SUCCESS"

                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=success,
                    new_qty=update.quantity if success else None,
                    error_message=status.get("errorMessage") if not success else None,
                    raw_response=status
                ))

        except Exception as e:
            for update in updates:
                results.append(InventoryUpdateResult(
                    marketplace_sku=update.marketplace_sku,
                    success=False,
                    error_message=str(e)
                ))

        return results

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Flipkart."""
        inventory = {}

        try:
            body = {"skuIds": marketplace_skus}

            response = await self._make_request(
                "POST",
                "/v3/listings/fetch",
                body=body
            )

            for listing in response.get("listings", []):
                sku = listing.get("sku")
                qty = listing.get("inventory", 0)
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
        to_date: datetime
    ) -> List[Settlement]:
        """Fetch settlements from Flipkart."""
        settlements = []

        try:
            params = {
                "fromDate": from_date.strftime("%Y-%m-%d"),
                "toDate": to_date.strftime("%Y-%m-%d"),
            }

            response = await self._make_request(
                "GET",
                "/v3/settlements",
                params=params
            )

            for item in response.get("settlements", []):
                settlement = Settlement(
                    settlement_id=item.get("settlementId", ""),
                    settlement_date=datetime.fromisoformat(
                        item.get("settlementDate", datetime.utcnow().isoformat())
                    ),
                    period_from=from_date,
                    period_to=to_date,
                    gross_sales=float(item.get("grossSales", 0)),
                    marketplace_fee=float(item.get("marketplaceFee", 0)),
                    shipping_fee=float(item.get("shippingFee", 0)),
                    net_amount=float(item.get("netAmount", 0)),
                    currency="INR",
                    raw_data=item
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
        """Fetch returns from Flipkart."""
        returns = []

        try:
            body = {
                "filter": {
                    "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                }
            }

            if status:
                body["filter"]["states"] = [status]

            response = await self._make_request(
                "POST",
                "/v3/returns/filter",
                body=body
            )

            for item in response.get("returns", []):
                ret = MarketplaceReturn(
                    marketplace_return_id=item.get("returnId", ""),
                    marketplace_order_id=item.get("shipmentId", ""),
                    return_reason=item.get("returnReason", ""),
                    return_sub_reason=item.get("returnSubReason"),
                    customer_comments=item.get("customerComments"),
                    return_quantity=int(item.get("quantity", 1)),
                    refund_amount=float(item.get("refundAmount", 0)),
                    status=item.get("status", "INITIATED"),
                    initiated_date=datetime.fromisoformat(
                        item.get("createdDate", datetime.utcnow().isoformat())
                        .replace("Z", "+00:00")
                    ),
                    raw_data=item
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
        """Update return status on Flipkart."""
        try:
            body = {
                "returnId": marketplace_return_id,
                "action": status,
                "comments": notes or "",
            }

            response = await self._make_request(
                "POST",
                "/v3/returns/action",
                body=body
            )

            return response.get("status") == "SUCCESS"

        except Exception as e:
            self._log_error("update_return_status", e)
            return False

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Flipkart connection is healthy."""
        try:
            # Make a simple API call to verify connectivity
            await self._make_request("GET", "/v3/listings/count")
            return True

        except Exception as e:
            logger.error(f"Flipkart health check failed: {e}")
            return False
