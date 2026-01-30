"""
Marketplace Adapter Factory
Factory pattern for instantiating marketplace-specific adapters
"""
from typing import Dict, Type, Optional
from uuid import UUID
import logging

from sqlmodel import Session, select

from app.models import MarketplaceConnection, MarketplaceType
from .base_adapter import MarketplaceAdapter, MarketplaceConfig, MarketplaceCredentials

logger = logging.getLogger(__name__)

# Registry of marketplace adapters
_adapter_registry: Dict[str, Type[MarketplaceAdapter]] = {}


def register_adapter(marketplace: str):
    """
    Decorator to register a marketplace adapter class.

    Usage:
        @register_adapter("AMAZON")
        class AmazonAdapter(MarketplaceAdapter):
            ...
    """
    def decorator(cls: Type[MarketplaceAdapter]):
        _adapter_registry[marketplace.upper()] = cls
        logger.info(f"Registered adapter for marketplace: {marketplace}")
        return cls
    return decorator


class AdapterFactory:
    """
    Factory class for creating marketplace adapters.

    Supports dynamic adapter registration and lazy loading.
    """

    @staticmethod
    def get_supported_marketplaces() -> list:
        """Get list of supported marketplaces."""
        return list(_adapter_registry.keys())

    @staticmethod
    def is_supported(marketplace: str) -> bool:
        """Check if marketplace is supported."""
        return marketplace.upper() in _adapter_registry

    @staticmethod
    def create_adapter(
        marketplace: str,
        config: MarketplaceConfig
    ) -> MarketplaceAdapter:
        """
        Create an adapter instance for the specified marketplace.

        Args:
            marketplace: Marketplace name (e.g., "AMAZON", "FLIPKART")
            config: Marketplace configuration

        Returns:
            MarketplaceAdapter instance

        Raises:
            ValueError: If marketplace is not supported
        """
        marketplace_upper = marketplace.upper()

        if marketplace_upper not in _adapter_registry:
            # Try to load adapter dynamically
            AdapterFactory._load_adapter(marketplace_upper)

        if marketplace_upper not in _adapter_registry:
            raise ValueError(
                f"Unsupported marketplace: {marketplace}. "
                f"Supported: {list(_adapter_registry.keys())}"
            )

        adapter_class = _adapter_registry[marketplace_upper]
        return adapter_class(config)

    @staticmethod
    def _load_adapter(marketplace: str):
        """
        Dynamically load adapter module if not already registered.

        This allows adapters to be loaded only when needed.
        """
        try:
            if marketplace == "AMAZON":
                from app.services.marketplaces.amazon import AmazonAdapter
            elif marketplace == "FLIPKART":
                from app.services.marketplaces.flipkart import FlipkartAdapter
            elif marketplace == "SHOPIFY":
                from app.services.marketplaces.shopify import ShopifyAdapter
            elif marketplace == "MYNTRA":
                from app.services.marketplaces.myntra import MyntraAdapter
            elif marketplace == "AJIO":
                from app.services.marketplaces.ajio import AjioAdapter
            elif marketplace == "MEESHO":
                from app.services.marketplaces.meesho import MeeshoAdapter
            elif marketplace == "NYKAA":
                from app.services.marketplaces.nykaa import NykaaAdapter
            elif marketplace == "TATA_CLIQ":
                from app.services.marketplaces.tatacliq import TataCliqAdapter
            elif marketplace == "JIOMART":
                from app.services.marketplaces.jiomart import JioMartAdapter
            elif marketplace == "WOOCOMMERCE":
                from app.services.marketplaces.woocommerce import WooCommerceAdapter
            elif marketplace == "MAGENTO":
                from app.services.marketplaces.magento import MagentoAdapter
        except ImportError as e:
            logger.warning(f"Failed to load adapter for {marketplace}: {e}")

    @staticmethod
    def create_from_connection(
        connection: MarketplaceConnection
    ) -> MarketplaceAdapter:
        """
        Create an adapter from a MarketplaceConnection database record.

        Args:
            connection: MarketplaceConnection model instance

        Returns:
            MarketplaceAdapter instance
        """
        # Build credentials from connection
        credentials = MarketplaceCredentials(
            seller_id=connection.sellerId,
            access_token=connection.accessToken,
            refresh_token=connection.refreshToken,
            store_url=connection.apiEndpoint,
            region=connection.region,
            additional=connection.credentials or {}
        )

        # Extract specific credential fields if present
        if connection.credentials:
            creds = connection.credentials
            credentials.client_id = creds.get("client_id")
            credentials.client_secret = creds.get("client_secret")
            credentials.api_key = creds.get("api_key")
            credentials.api_secret = creds.get("api_secret")

        # Build config
        config = MarketplaceConfig(
            connection_id=connection.id,
            company_id=connection.companyId,
            marketplace=connection.marketplace.value,
            credentials=credentials,
            api_endpoint=connection.apiEndpoint,
            webhook_url=connection.webhookUrl,
            sync_settings=connection.syncSettings or {},
            is_sandbox=connection.credentials.get("sandbox", False) if connection.credentials else False
        )

        return AdapterFactory.create_adapter(connection.marketplace.value, config)


def get_adapter(
    connection_id: UUID,
    session: Session
) -> Optional[MarketplaceAdapter]:
    """
    Convenience function to get adapter for a connection.

    Args:
        connection_id: MarketplaceConnection ID
        session: Database session

    Returns:
        MarketplaceAdapter instance or None if not found
    """
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        logger.warning(f"Connection not found: {connection_id}")
        return None

    if not connection.isActive:
        logger.warning(f"Connection is not active: {connection_id}")
        return None

    try:
        return AdapterFactory.create_from_connection(connection)
    except ValueError as e:
        logger.error(f"Failed to create adapter for {connection_id}: {e}")
        return None


def get_adapters_for_company(
    company_id: UUID,
    session: Session,
    marketplace: Optional[str] = None,
    active_only: bool = True
) -> list:
    """
    Get all adapters for a company.

    Args:
        company_id: Company ID
        session: Database session
        marketplace: Filter by marketplace type
        active_only: Only return active connections

    Returns:
        List of MarketplaceAdapter instances
    """
    query = select(MarketplaceConnection).where(
        MarketplaceConnection.companyId == company_id
    )

    if active_only:
        query = query.where(MarketplaceConnection.isActive == True)

    if marketplace:
        query = query.where(MarketplaceConnection.marketplace == marketplace)

    connections = session.exec(query).all()

    adapters = []
    for conn in connections:
        try:
            adapter = AdapterFactory.create_from_connection(conn)
            adapters.append(adapter)
        except ValueError as e:
            logger.warning(f"Skipping connection {conn.id}: {e}")

    return adapters
