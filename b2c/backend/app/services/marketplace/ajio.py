"""
AJIO Marketplace Adapter
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx

from app.models.marketplace import MarketplaceConnection, MarketplaceType
from .base import MarketplaceAdapter, marketplace_registry


@marketplace_registry.register(MarketplaceType.AJIO)
class AjioAdapter(MarketplaceAdapter):
    """
    AJIO Seller API adapter (Reliance Retail).
    """

    marketplace_type = MarketplaceType.AJIO

    BASE_URL = "https://seller.ajio.com/api/v1"
    AUTH_URL = "https://seller.ajio.com/oauth/token"

    def __init__(self, connection: MarketplaceConnection):
        super().__init__(connection)
        self.seller_id = connection.sellerId

    async def authenticate(self) -> bool:
        """Authenticate with AJIO API."""
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
        """AJIO uses API key auth."""
        return ""

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Not applicable for AJIO."""
        return {}

    async def fetch_orders(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch orders from AJIO."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "orderId": "AJIO-OD-456789123",
                "orderDate": datetime.now(timezone.utc).isoformat(),
                "orderStatus": "PROCESSING",
                "priceDetails": {
                    "mrp": 3499.00,
                    "sellingPrice": 2799.00,
                    "discount": 700.00,
                    "totalPrice": 2799.00
                },
                "customerDetails": {
                    "name": "Rahul Kumar",
                    "city": "Delhi",
                    "state": "Delhi",
                    "pincode": "110001"
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
        """Update order on AJIO."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def push_inventory(
        self,
        listings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push inventory to AJIO."""
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
        """Fetch listings from AJIO."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "sku": "AJIO-SKU-001",
                "productId": "AJIO-PRD-67890",
                "productTitle": "Sample AJIO Product",
                "mrp": 3499.00,
                "sellingPrice": 2799.00,
                "inventory": 40,
                "listingStatus": "ACTIVE"
            }
        ]

    async def update_listing(
        self,
        marketplace_sku: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update listing on AJIO."""
        if not await self.authenticate():
            return False

        # Mock implementation
        return True

    async def fetch_returns(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch returns from AJIO."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return []

    async def fetch_settlements(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch settlements from AJIO."""
        if not await self.authenticate():
            raise Exception("Authentication failed")

        # Mock implementation
        return [
            {
                "settlementId": f"AJIO-STL-{start_date.strftime('%Y%m%d')}-001",
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "netPayable": 95000.00,
                "commission": 8000.00,
                "currency": "INR"
            }
        ]
