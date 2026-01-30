"""
Nykaa Marketplace Adapter
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx

from app.models.marketplace import MarketplaceConnection, MarketplaceType
from .base import MarketplaceAdapter, marketplace_registry


@marketplace_registry.register(MarketplaceType.NYKAA)
class NykaaAdapter(MarketplaceAdapter):
    """
    Nykaa Seller API adapter for beauty and cosmetics.
    """

    marketplace_type = MarketplaceType.NYKAA

    BASE_URL = "https://seller.nykaa.com/api/v1"
    AUTH_URL = "https://seller.nykaa.com/oauth/token"

    def __init__(self, connection: MarketplaceConnection):
        super().__init__(connection)
        self.seller_id = connection.sellerId

    async def authenticate(self) -> bool:
        """Authenticate with Nykaa API."""
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
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.connection.apiKey,
                        "client_secret": self.connection.apiSecret
                    }
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
        """Nykaa uses API key auth."""
        return ""

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Not applicable for Nykaa."""
        return {}

    async def fetch_orders(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch orders from Nykaa."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - beauty/cosmetics orders
        return [
            {
                "orderId": "NYK-OD-789456123",
                "orderDate": datetime.now(timezone.utc).isoformat(),
                "orderStatus": "CONFIRMED",
                "priceDetails": {
                    "mrp": 1299.00,
                    "sellingPrice": 999.00,
                    "discount": 300.00,
                    "totalPrice": 999.00
                },
                "customerDetails": {
                    "name": "Anita Patel",
                    "city": "Hyderabad",
                    "state": "Telangana",
                    "pincode": "500001"
                },
                "category": "SKINCARE"
            }
        ]

    async def update_order_status(
        self,
        marketplace_order_id: str,
        status: str,
        tracking_number: Optional[str] = None,
        carrier: Optional[str] = None
    ) -> bool:
        """Update order on Nykaa."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def push_inventory(
        self,
        listings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push inventory to Nykaa."""
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
        """Fetch listings from Nykaa."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - beauty products
        return [
            {
                "sku": "NYK-SKU-001",
                "productId": "NYK-PRD-12345",
                "productTitle": "Premium Face Serum",
                "brand": "Sample Beauty Brand",
                "mrp": 1299.00,
                "sellingPrice": 999.00,
                "inventory": 100,
                "listingStatus": "ACTIVE",
                "category": "SKINCARE",
                "expiryDate": "2026-12-31"
            }
        ]

    async def update_listing(
        self,
        marketplace_sku: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update listing on Nykaa."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def fetch_returns(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch returns from Nykaa."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation - beauty returns are usually lower
        return []

    async def fetch_settlements(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch settlements from Nykaa."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "settlementId": f"NYK-STL-{start_date.strftime('%Y%m%d')}-001",
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "netPayable": 75000.00,
                "commission": 12000.00,
                "currency": "INR"
            }
        ]
