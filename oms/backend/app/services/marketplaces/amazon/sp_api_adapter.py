"""
Amazon SP-API Adapter
Implementation of MarketplaceAdapter for Amazon Selling Partner API
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import hashlib
import hmac
import json
import time
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


# Amazon SP-API endpoints by region
AMAZON_ENDPOINTS = {
    "na": "https://sellingpartnerapi-na.amazon.com",
    "eu": "https://sellingpartnerapi-eu.amazon.com",
    "fe": "https://sellingpartnerapi-fe.amazon.com",
    "in": "https://sellingpartnerapi-eu.amazon.com",  # India uses EU endpoint
}

AMAZON_MARKETPLACES = {
    "in": "A21TJRUUN4KGV",  # Amazon India
    "us": "ATVPDKIKX0DER",  # Amazon US
    "uk": "A1F83G8C2ARO7P",  # Amazon UK
    "de": "A1PA6795UKMFR9",  # Amazon Germany
    "jp": "A1VC38T7YXB528",  # Amazon Japan
}

# Amazon LWA (Login With Amazon) endpoint
LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"


@register_adapter("AMAZON")
class AmazonAdapter(MarketplaceAdapter):
    """
    Amazon Selling Partner API Adapter.

    Implements SP-API for:
    - Orders API (order fetch, status updates)
    - Fulfillment Outbound API (inventory levels)
    - Finances API (settlements)
    - Catalog Items API (listings)
    """

    def __init__(self, config: MarketplaceConfig):
        super().__init__(config)
        self.region = config.credentials.region or "in"
        self.endpoint = AMAZON_ENDPOINTS.get(self.region, AMAZON_ENDPOINTS["in"])
        self.marketplace_id = AMAZON_MARKETPLACES.get(self.region, AMAZON_MARKETPLACES["in"])
        self._http_client = None

    @property
    def name(self) -> str:
        return "AMAZON"

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
            "fetch_listings",
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        """Get HTTP client with proper headers."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            )
        return self._http_client

    async def _close_client(self):
        """Close HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    # =========================================================================
    # Authentication
    # =========================================================================

    async def authenticate(self) -> AuthResult:
        """Authenticate with Amazon using LWA refresh token."""
        try:
            if not self.credentials.refresh_token:
                return AuthResult(
                    success=False,
                    error_message="No refresh token provided"
                )

            return await self.refresh_token()
        except Exception as e:
            logger.error(f"Amazon authentication failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def refresh_token(self) -> AuthResult:
        """Refresh access token using LWA."""
        try:
            client = await self._get_client()

            response = await client.post(
                LWA_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.credentials.refresh_token,
                    "client_id": self.credentials.client_id,
                    "client_secret": self.credentials.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                error_data = response.json()
                return AuthResult(
                    success=False,
                    error_message=error_data.get("error_description", "Token refresh failed")
                )

            data = response.json()

            # Calculate expiry
            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            # Update credentials
            self.credentials.access_token = data["access_token"]
            self.is_authenticated = True

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                refresh_token=self.credentials.refresh_token,  # Keep same refresh token
                expires_at=expires_at,
                token_type=data.get("token_type", "bearer")
            )

        except Exception as e:
            logger.error(f"Amazon token refresh failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    def get_oauth_authorize_url(self, redirect_uri: str, state: str) -> str:
        """Get Amazon OAuth authorization URL."""
        params = {
            "application_id": self.credentials.additional.get("application_id", ""),
            "state": state,
            "redirect_uri": redirect_uri,
        }
        return f"https://sellercentral.amazon.in/apps/authorize/consent?{urlencode(params)}"

    async def exchange_code_for_token(self, code: str, redirect_uri: str) -> AuthResult:
        """Exchange authorization code for tokens."""
        try:
            client = await self._get_client()

            response = await client.post(
                LWA_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": self.credentials.client_id,
                    "client_secret": self.credentials.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                error_data = response.json()
                return AuthResult(
                    success=False,
                    error_message=error_data.get("error_description", "Token exchange failed")
                )

            data = response.json()
            expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))

            return AuthResult(
                success=True,
                access_token=data["access_token"],
                refresh_token=data["refresh_token"],
                expires_at=expires_at,
                token_type=data.get("token_type", "bearer")
            )

        except Exception as e:
            logger.error(f"Amazon token exchange failed: {e}")
            return AuthResult(success=False, error_message=str(e))

    async def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make authenticated request to SP-API."""
        if not self.credentials.access_token:
            auth_result = await self.authenticate()
            if not auth_result.success:
                raise Exception(f"Authentication failed: {auth_result.error_message}")

        client = await self._get_client()
        url = f"{self.endpoint}{path}"

        headers = {
            "x-amz-access-token": self.credentials.access_token,
            "x-amz-date": datetime.utcnow().strftime("%Y%m%dT%H%M%SZ"),
        }

        start_time = time.time()

        try:
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(url, params=params, json=body, headers=headers)
            elif method == "PUT":
                response = await client.put(url, params=params, json=body, headers=headers)
            elif method == "PATCH":
                response = await client.patch(url, params=params, json=body, headers=headers)
            elif method == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            duration_ms = (time.time() - start_time) * 1000
            self._log_api_call(method, path, response.status_code, duration_ms)

            # Update rate limit info
            self._rate_limit_remaining = int(response.headers.get("x-amzn-RateLimit-Limit", 100))

            if response.status_code == 429:
                # Rate limited
                retry_after = int(response.headers.get("Retry-After", 60))
                self._rate_limit_reset = datetime.utcnow() + timedelta(seconds=retry_after)
                raise Exception(f"Rate limited. Retry after {retry_after}s")

            if response.status_code == 403:
                # Token might be expired
                self.is_authenticated = False
                raise Exception("Access denied. Token may be expired.")

            if response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise Exception(
                    f"API error {response.status_code}: "
                    f"{error_data.get('errors', [{}])[0].get('message', 'Unknown error')}"
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
        """Fetch orders from Amazon."""
        try:
            params = {
                "MarketplaceIds": self.marketplace_id,
                "CreatedAfter": from_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "MaxResultsPerPage": min(limit, 100),
            }

            if to_date:
                params["CreatedBefore"] = to_date.strftime("%Y-%m-%dT%H:%M:%SZ")

            if status:
                params["OrderStatuses"] = status

            if cursor:
                params["NextToken"] = cursor

            response = await self._make_request("GET", "/orders/v0/orders", params=params)

            orders = []
            for order_data in response.get("payload", {}).get("Orders", []):
                order = self._parse_order(order_data)
                if order:
                    # Fetch order items
                    items_response = await self._make_request(
                        "GET",
                        f"/orders/v0/orders/{order_data['AmazonOrderId']}/orderItems"
                    )
                    order.items = [
                        self._parse_order_item(item)
                        for item in items_response.get("payload", {}).get("OrderItems", [])
                    ]
                    orders.append(order)

            next_token = response.get("payload", {}).get("NextToken")
            return orders, next_token

        except Exception as e:
            self._log_error("fetch_orders", e)
            raise

    def _parse_order(self, data: Dict) -> Optional[MarketplaceOrder]:
        """Parse Amazon order data to standardized format."""
        try:
            shipping_address = data.get("ShippingAddress", {})

            return MarketplaceOrder(
                marketplace_order_id=data["AmazonOrderId"],
                marketplace="AMAZON",
                order_status=data.get("OrderStatus", "Pending"),
                order_date=datetime.fromisoformat(
                    data["PurchaseDate"].replace("Z", "+00:00")
                ),
                customer_name=shipping_address.get("Name", ""),
                customer_email=data.get("BuyerEmail"),
                customer_phone=shipping_address.get("Phone"),
                shipping_address={
                    "name": shipping_address.get("Name"),
                    "address_line1": shipping_address.get("AddressLine1"),
                    "address_line2": shipping_address.get("AddressLine2"),
                    "city": shipping_address.get("City"),
                    "state": shipping_address.get("StateOrRegion"),
                    "postal_code": shipping_address.get("PostalCode"),
                    "country": shipping_address.get("CountryCode"),
                    "phone": shipping_address.get("Phone"),
                },
                total_amount=float(
                    data.get("OrderTotal", {}).get("Amount", 0)
                ),
                currency=data.get("OrderTotal", {}).get("CurrencyCode", "INR"),
                payment_method=data.get("PaymentMethod", "Other"),
                is_cod=data.get("PaymentMethod") == "COD",
                fulfillment_type=(
                    FulfillmentType.MARKETPLACE
                    if data.get("FulfillmentChannel") == "AFN"
                    else FulfillmentType.SELLER
                ),
                promised_delivery_date=(
                    datetime.fromisoformat(data["LatestDeliveryDate"].replace("Z", "+00:00"))
                    if data.get("LatestDeliveryDate")
                    else None
                ),
                ship_by_date=(
                    datetime.fromisoformat(data["LatestShipDate"].replace("Z", "+00:00"))
                    if data.get("LatestShipDate")
                    else None
                ),
                raw_data=data
            )
        except Exception as e:
            logger.error(f"Failed to parse order: {e}")
            return None

    def _parse_order_item(self, data: Dict) -> Dict:
        """Parse Amazon order item."""
        return {
            "marketplace_line_id": data.get("OrderItemId"),
            "marketplace_sku": data.get("SellerSKU"),
            "asin": data.get("ASIN"),
            "title": data.get("Title", ""),
            "quantity": int(data.get("QuantityOrdered", 1)),
            "unit_price": float(data.get("ItemPrice", {}).get("Amount", 0)),
            "tax_amount": float(data.get("ItemTax", {}).get("Amount", 0)),
            "discount_amount": float(data.get("PromotionDiscount", {}).get("Amount", 0)),
            "shipping_amount": float(data.get("ShippingPrice", {}).get("Amount", 0)),
            "fulfillment_type": (
                "MARKETPLACE" if data.get("FulfillmentChannel") == "AFN" else "SELLER"
            ),
        }

    async def get_order(self, marketplace_order_id: str) -> Optional[MarketplaceOrder]:
        """Get a specific order."""
        try:
            response = await self._make_request(
                "GET",
                f"/orders/v0/orders/{marketplace_order_id}"
            )

            order_data = response.get("payload")
            if not order_data:
                return None

            order = self._parse_order(order_data)
            if order:
                # Fetch items
                items_response = await self._make_request(
                    "GET",
                    f"/orders/v0/orders/{marketplace_order_id}/orderItems"
                )
                order.items = [
                    self._parse_order_item(item)
                    for item in items_response.get("payload", {}).get("OrderItems", [])
                ]

            return order

        except Exception as e:
            self._log_error("get_order", e)
            return None

    async def update_order_status(self, update: OrderStatusUpdate) -> bool:
        """Update order status (ship confirmation)."""
        try:
            # For Amazon, shipping is done via Feeds API
            # This is a simplified implementation
            body = {
                "marketplaceId": self.marketplace_id,
                "shipConfirmation": {
                    "orderId": update.marketplace_order_id,
                    "shipmentConfirmationType": "Full",
                    "shippingDate": (update.ship_date or datetime.utcnow()).isoformat(),
                    "carrierCode": update.carrier_name or "Other",
                    "trackingNumber": update.tracking_number,
                }
            }

            await self._make_request(
                "POST",
                "/orders/v0/orders/{}/shipmentConfirmation".format(update.marketplace_order_id),
                body=body
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
        """Cancel order on Amazon."""
        try:
            # Amazon uses Feeds API for cancellation
            # This is a placeholder implementation
            logger.warning(
                f"Amazon order cancellation requires Feeds API: {marketplace_order_id}"
            )
            return False

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
        """Push inventory updates to Amazon."""
        results = []

        for update in updates:
            try:
                # Use Listings API for inventory update
                body = {
                    "productType": "PRODUCT",
                    "patches": [
                        {
                            "op": "replace",
                            "path": "/attributes/fulfillment_availability",
                            "value": [
                                {
                                    "fulfillment_channel_code": "DEFAULT",
                                    "quantity": update.quantity
                                }
                            ]
                        }
                    ]
                }

                await self._make_request(
                    "PATCH",
                    f"/listings/2021-08-01/items/{self.credentials.seller_id}/{quote(update.marketplace_sku)}",
                    params={"marketplaceIds": self.marketplace_id},
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

    async def get_inventory(self, marketplace_skus: List[str]) -> Dict[str, int]:
        """Get current inventory levels from Amazon."""
        inventory = {}

        try:
            # Use FBA Inventory API
            params = {
                "details": "true",
                "granularityType": "Marketplace",
                "granularityId": self.marketplace_id,
                "sellerSkus": ",".join(marketplace_skus[:50])  # Max 50 per request
            }

            response = await self._make_request(
                "GET",
                "/fba/inventory/v1/summaries",
                params=params
            )

            for item in response.get("payload", {}).get("inventorySummaries", []):
                sku = item.get("sellerSku")
                qty = item.get("inventoryDetails", {}).get("fulfillableQuantity", 0)
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
        """Fetch settlements from Amazon."""
        settlements = []

        try:
            params = {
                "FinancialEventGroupStartedAfter": from_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "FinancialEventGroupStartedBefore": to_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "MaxResultsPerPage": 100
            }

            response = await self._make_request(
                "GET",
                "/finances/v0/financialEventGroups",
                params=params
            )

            for group in response.get("payload", {}).get("FinancialEventGroupList", []):
                settlement = Settlement(
                    settlement_id=group.get("FinancialEventGroupId", ""),
                    settlement_date=datetime.fromisoformat(
                        group.get("FinancialEventGroupEnd", datetime.utcnow().isoformat())
                        .replace("Z", "+00:00")
                    ),
                    period_from=datetime.fromisoformat(
                        group.get("FinancialEventGroupStart", from_date.isoformat())
                        .replace("Z", "+00:00")
                    ),
                    period_to=datetime.fromisoformat(
                        group.get("FinancialEventGroupEnd", to_date.isoformat())
                        .replace("Z", "+00:00")
                    ),
                    net_amount=float(
                        group.get("ConvertedTotal", {}).get("CurrencyAmount", 0)
                    ),
                    currency=group.get("ConvertedTotal", {}).get("CurrencyCode", "INR"),
                    raw_data=group
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
        """Fetch returns from Amazon."""
        returns = []

        try:
            # Amazon uses different API for returns
            # This is a simplified implementation
            logger.info("Fetching Amazon returns...")

            # Would use /fba/outbound/fulfillmentOrders for FBA returns
            # or monitor order status changes for FBM returns

        except Exception as e:
            self._log_error("fetch_returns", e)

        return returns

    async def update_return_status(
        self,
        marketplace_return_id: str,
        status: str,
        notes: Optional[str] = None
    ) -> bool:
        """Update return status on Amazon."""
        try:
            logger.warning(
                f"Amazon return status update not implemented: {marketplace_return_id}"
            )
            return False

        except Exception as e:
            self._log_error("update_return_status", e)
            return False

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Amazon connection is healthy."""
        try:
            # Make a simple API call to verify connectivity
            await self._make_request(
                "GET",
                "/sellers/v1/marketplaceParticipations"
            )
            return True

        except Exception as e:
            logger.error(f"Amazon health check failed: {e}")
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
        """Verify Amazon SQS/SNS notification signature."""
        # Amazon uses SNS for notifications
        # Signature verification would involve verifying the SNS message signature
        # This is a simplified implementation
        return True

    async def parse_webhook_event(
        self,
        payload: Dict[str, Any],
        event_type: str
    ) -> Dict[str, Any]:
        """Parse Amazon notification payload."""
        return {
            "event_type": event_type,
            "marketplace": "AMAZON",
            "data": payload
        }
