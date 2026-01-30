"""
Base Marketplace Adapter
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.models.marketplace import (
    MarketplaceConnection, MarketplaceListing,
    MarketplaceOrderSync, MarketplaceInventorySync,
    MarketplaceType, SyncStatus
)


class MarketplaceAdapter(ABC):
    """
    Base class for marketplace integrations.
    Subclasses implement marketplace-specific logic.
    """

    marketplace_type: MarketplaceType

    def __init__(self, connection: MarketplaceConnection):
        self.connection = connection

    @abstractmethod
    async def authenticate(self) -> bool:
        """Authenticate with the marketplace."""
        pass

    @abstractmethod
    async def refresh_token(self) -> bool:
        """Refresh OAuth token if expired."""
        pass

    @abstractmethod
    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Get OAuth authorization URL."""
        pass

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        pass

    @abstractmethod
    async def fetch_orders(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch orders from marketplace."""
        pass

    @abstractmethod
    async def update_order_status(
        self,
        marketplace_order_id: str,
        status: str,
        tracking_number: Optional[str] = None,
        carrier: Optional[str] = None
    ) -> bool:
        """Update order status on marketplace."""
        pass

    @abstractmethod
    async def push_inventory(
        self,
        listings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Push inventory updates to marketplace."""
        pass

    @abstractmethod
    async def fetch_listings(
        self,
        skus: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Fetch product listings from marketplace."""
        pass

    @abstractmethod
    async def update_listing(
        self,
        marketplace_sku: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update a product listing."""
        pass

    @abstractmethod
    async def fetch_returns(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch returns from marketplace."""
        pass

    @abstractmethod
    async def fetch_settlements(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch settlement reports."""
        pass

    def _make_headers(self) -> Dict[str, str]:
        """Create API request headers."""
        return {
            "Authorization": f"Bearer {self.connection.accessToken}",
            "Content-Type": "application/json"
        }


class MarketplaceRegistry:
    """Registry for marketplace adapters."""

    def __init__(self):
        self._adapters: Dict[MarketplaceType, type] = {}

    def register(self, marketplace_type: MarketplaceType):
        """Decorator to register an adapter."""
        def decorator(cls):
            self._adapters[marketplace_type] = cls
            return cls
        return decorator

    def get_adapter(
        self,
        connection: MarketplaceConnection
    ) -> MarketplaceAdapter:
        """Get adapter instance for a connection."""
        adapter_class = self._adapters.get(connection.marketplace)
        if not adapter_class:
            raise ValueError(f"No adapter for marketplace: {connection.marketplace}")
        return adapter_class(connection)

    def supported_marketplaces(self) -> List[MarketplaceType]:
        """Get list of supported marketplaces."""
        return list(self._adapters.keys())


# Global registry
marketplace_registry = MarketplaceRegistry()
