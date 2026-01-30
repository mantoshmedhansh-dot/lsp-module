"""
Amazon Marketplace Adapter
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx

from app.models.marketplace import MarketplaceConnection, MarketplaceType
from .base import MarketplaceAdapter, marketplace_registry


@marketplace_registry.register(MarketplaceType.AMAZON)
class AmazonAdapter(MarketplaceAdapter):
    """
    Amazon Selling Partner API adapter.
    """

    marketplace_type = MarketplaceType.AMAZON

    # Amazon SP-API endpoints
    BASE_URL = "https://sellingpartnerapi-fe.amazon.com"  # India region
    AUTH_URL = "https://api.amazon.com/auth/o2/token"

    def __init__(self, connection: MarketplaceConnection):
        super().__init__(connection)
        self.seller_id = connection.sellerId

    async def authenticate(self) -> bool:
        """Check if current tokens are valid."""
        if not self.connection.accessToken:
            return False

        if self.connection.tokenExpiresAt and self.connection.tokenExpiresAt < datetime.now(timezone.utc):
            return await self.refresh_token()

        return True

    async def refresh_token(self) -> bool:
        """Refresh the access token."""
        if not self.connection.refreshToken:
            return False

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.AUTH_URL,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": self.connection.refreshToken,
                        "client_id": self.connection.apiKey,
                        "client_secret": self.connection.apiSecret
                    }
                )
                response.raise_for_status()
                data = response.json()

                self.connection.accessToken = data.get("access_token")
                self.connection.tokenExpiresAt = datetime.now(timezone.utc) + timedelta(
                    seconds=data.get("expires_in", 3600)
                )
                return True
            except Exception:
                return False

    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Get Amazon OAuth authorization URL."""
        params = {
            "application_id": self.connection.apiKey,
            "redirect_uri": redirect_uri,
            "state": state,
            "version": "beta"
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://sellercentral.amazon.in/apps/authorize/consent?{query}"

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.AUTH_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": self.connection.apiKey,
                    "client_secret": self.connection.apiSecret
                }
            )
            response.raise_for_status()
            return response.json()

    async def fetch_orders(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch orders from Amazon."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - real implementation would call SP-API
        return [
            {
                "AmazonOrderId": "123-4567890-1234567",
                "OrderStatus": "Shipped",
                "PurchaseDate": datetime.now(timezone.utc).isoformat(),
                "OrderTotal": {"Amount": "1299.00", "CurrencyCode": "INR"},
                "ShippingAddress": {
                    "Name": "John Doe",
                    "City": "Mumbai",
                    "StateOrRegion": "Maharashtra",
                    "PostalCode": "400001"
                }
            }
        ]

    async def update_order_status(
        self,
        marketplace_order_id: str,
        status: str,
        tracking_number: Optional[str] = None,
        carrier: Optional[str] = None
    ) -> bool:
        """Update order fulfillment status on Amazon."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def push_inventory(
        self,
        listings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push inventory to Amazon."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return {
            "submitted": len(listings),
            "accepted": len(listings),
            "errors": []
        }

    async def fetch_listings(
        self,
        skus: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch listings from Amazon."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "sku": "SKU-001",
                "asin": "B08XYZ1234",
                "title": "Sample Product",
                "price": 999.00,
                "quantity": 100,
                "status": "Active"
            }
        ]

    async def update_listing(
        self,
        marketplace_sku: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update a listing on Amazon."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def fetch_returns(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch returns from Amazon."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return []

    async def fetch_settlements(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch settlement reports from Amazon."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "settlementId": f"AMZ-{start_date.strftime('%Y%m%d')}-001",
                "settlementStartDate": start_date.isoformat(),
                "settlementEndDate": end_date.isoformat(),
                "totalAmount": 150000.00,
                "currency": "INR"
            }
        ]
