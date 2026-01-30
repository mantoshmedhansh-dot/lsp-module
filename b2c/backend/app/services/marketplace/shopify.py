"""
Shopify Marketplace Adapter
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx
from urllib.parse import urlencode

from app.models.marketplace import MarketplaceConnection, MarketplaceType
from .base import MarketplaceAdapter, marketplace_registry


@marketplace_registry.register(MarketplaceType.SHOPIFY)
class ShopifyAdapter(MarketplaceAdapter):
    """
    Shopify Admin API adapter.
    Supports OAuth 2.0 for public apps.
    """

    marketplace_type = MarketplaceType.SHOPIFY

    API_VERSION = "2024-01"

    def __init__(self, connection: MarketplaceConnection):
        super().__init__(connection)
        self.shop_domain = connection.accountId  # e.g., "mystore.myshopify.com"

    @property
    def base_url(self) -> str:
        return f"https://{self.shop_domain}/admin/api/{self.API_VERSION}"

    @property
    def auth_url(self) -> str:
        return f"https://{self.shop_domain}/admin/oauth/authorize"

    @property
    def token_url(self) -> str:
        return f"https://{self.shop_domain}/admin/oauth/access_token"

    async def authenticate(self) -> bool:
        """Check if we have valid access token."""
        if not self.connection.accessToken:
            return False
        # Shopify tokens don't expire, but can be revoked
        return True

    async def refresh_token(self) -> bool:
        """Shopify tokens don't expire."""
        return bool(self.connection.accessToken)

    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate OAuth authorization URL."""
        scopes = [
            "read_orders", "write_orders",
            "read_products", "write_products",
            "read_inventory", "write_inventory",
            "read_fulfillments", "write_fulfillments",
            "read_returns"
        ]
        params = {
            "client_id": self.connection.apiKey,
            "scope": ",".join(scopes),
            "redirect_uri": redirect_uri,
            "state": state
        }
        return f"{self.auth_url}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.token_url,
                    json={
                        "client_id": self.connection.apiKey,
                        "client_secret": self.connection.apiSecret,
                        "code": code
                    }
                )
                response.raise_for_status()
                data = response.json()
                return {
                    "access_token": data.get("access_token"),
                    "scope": data.get("scope")
                }
            except Exception:
                return {}

    def _get_headers(self) -> Dict[str, str]:
        """Get API headers with access token."""
        return {
            "X-Shopify-Access-Token": self.connection.accessToken,
            "Content-Type": "application/json"
        }

    async def fetch_orders(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch orders from Shopify."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "orderId": "5678901234",
                "orderNumber": "#1001",
                "orderDate": datetime.now(timezone.utc).isoformat(),
                "financialStatus": "paid",
                "fulfillmentStatus": "unfulfilled",
                "priceDetails": {
                    "subtotal": 2500.00,
                    "shipping": 100.00,
                    "tax": 450.00,
                    "totalPrice": 3050.00
                },
                "customer": {
                    "email": "customer@example.com",
                    "firstName": "John",
                    "lastName": "Doe"
                },
                "shippingAddress": {
                    "city": "Pune",
                    "province": "Maharashtra",
                    "zip": "411001",
                    "country": "India"
                },
                "lineItems": [
                    {
                        "id": "123456789",
                        "title": "Sample Product",
                        "sku": "SHOP-SKU-001",
                        "quantity": 2,
                        "price": 1250.00
                    }
                ]
            }
        ]

    async def update_order_status(
        self,
        marketplace_order_id: str,
        status: str,
        tracking_number: Optional[str] = None,
        carrier: Optional[str] = None
    ) -> bool:
        """Create fulfillment for Shopify order."""
        if not await self.authenticate():
            return False

        # Mock implementation - would create fulfillment via API
        return True

    async def push_inventory(
        self,
        listings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Update inventory levels in Shopify."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - would use inventory_levels/set endpoint
        return {
            "submitted": len(listings),
            "accepted": len(listings),
            "errors": []
        }

    async def fetch_listings(
        self,
        skus: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch products from Shopify."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "id": "9876543210",
                "sku": "SHOP-SKU-001",
                "title": "Sample Shopify Product",
                "vendor": "My Store",
                "productType": "Electronics",
                "variants": [
                    {
                        "id": "45678901234",
                        "sku": "SHOP-SKU-001-VAR1",
                        "title": "Default",
                        "price": 1250.00,
                        "inventoryQuantity": 50,
                        "inventoryItemId": "inv_123456"
                    }
                ],
                "status": "active"
            }
        ]

    async def update_listing(
        self,
        marketplace_sku: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update product in Shopify."""
        if not await self.authenticate():
            return False

        # Mock implementation - would use products/{id}.json endpoint
        return True

    async def fetch_returns(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch returns from Shopify (requires Shopify Plus or Returns app)."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - Shopify returns API
        return [
            {
                "returnId": "SHOP-RET-001",
                "orderId": "5678901234",
                "status": "REQUESTED",
                "returnLineItems": [
                    {
                        "lineItemId": "123456789",
                        "quantity": 1,
                        "returnReason": "SIZE_TOO_LARGE"
                    }
                ]
            }
        ]

    async def fetch_settlements(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch payouts from Shopify Payments."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - would use shopify_payments/payouts endpoint
        return [
            {
                "settlementId": f"SHOP-PAY-{start_date.strftime('%Y%m%d')}-001",
                "payoutId": "payout_123456",
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "amount": 125000.00,
                "currency": "INR",
                "status": "paid"
            }
        ]

    async def create_webhook(self, topic: str, address: str) -> Dict[str, Any]:
        """Create webhook subscription in Shopify."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return {
            "webhookId": "webhook_123456",
            "topic": topic,
            "address": address,
            "format": "json"
        }
