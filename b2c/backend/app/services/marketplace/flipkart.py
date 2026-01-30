"""
Flipkart Marketplace Adapter
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx

from app.models.marketplace import MarketplaceConnection, MarketplaceType
from .base import MarketplaceAdapter, marketplace_registry


@marketplace_registry.register(MarketplaceType.FLIPKART)
class FlipkartAdapter(MarketplaceAdapter):
    """
    Flipkart Seller API adapter.
    """

    marketplace_type = MarketplaceType.FLIPKART

    BASE_URL = "https://api.flipkart.net/sellers"
    AUTH_URL = "https://api.flipkart.net/oauth-service/oauth/token"

    def __init__(self, connection: MarketplaceConnection):
        super().__init__(connection)
        self.seller_id = connection.sellerId

    async def authenticate(self) -> bool:
        """Authenticate with Flipkart API."""
        if not self.connection.apiKey or not self.connection.apiSecret:
            return False

        if self.connection.accessToken and self.connection.tokenExpiresAt:
            if self.connection.tokenExpiresAt > datetime.now(timezone.utc):
                return True

        return await self.refresh_token()

    async def refresh_token(self) -> bool:
        """Get new access token."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.AUTH_URL,
                    params={"grant_type": "client_credentials"},
                    auth=(self.connection.apiKey, self.connection.apiSecret)
                )
                response.raise_for_status()
                data = response.json()

                self.connection.accessToken = data.get("access_token")
                self.connection.tokenExpiresAt = datetime.now(timezone.utc) + timedelta(
                    seconds=data.get("expires_in", 86400)
                )
                return True
            except Exception:
                return False

    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Flipkart uses API key auth, not OAuth."""
        return ""

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Not applicable for Flipkart."""
        return {}

    async def fetch_orders(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch orders from Flipkart."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "orderId": "FK-OD-123456789",
                "orderDate": datetime.now(timezone.utc).isoformat(),
                "orderStatus": "SHIPPED",
                "priceDetails": {
                    "sellingPrice": 1499.00,
                    "shippingCharge": 0,
                    "totalPrice": 1499.00
                },
                "buyerDetails": {
                    "name": "Jane Smith",
                    "city": "Bangalore",
                    "state": "Karnataka",
                    "pincode": "560001"
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
        """Update order on Flipkart."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def push_inventory(
        self,
        listings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push inventory to Flipkart."""
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
        """Fetch listings from Flipkart."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "sku": "FK-SKU-001",
                "fsn": "FSNXYZ12345",
                "productTitle": "Sample Flipkart Product",
                "mrp": 1999.00,
                "sellingPrice": 1499.00,
                "inventory": 50,
                "listingStatus": "ACTIVE"
            }
        ]

    async def update_listing(
        self,
        marketplace_sku: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update listing on Flipkart."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def fetch_returns(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch returns from Flipkart."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return []

    async def fetch_settlements(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch settlements from Flipkart."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "settlementId": f"FK-STL-{start_date.strftime('%Y%m%d')}-001",
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "netPayable": 125000.00,
                "currency": "INR"
            }
        ]
