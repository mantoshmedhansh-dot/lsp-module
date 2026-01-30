"""
Marketplace Integration Services
"""
from .base import MarketplaceAdapter, marketplace_registry
from .amazon import AmazonAdapter
from .flipkart import FlipkartAdapter
from .myntra import MyntraAdapter
from .ajio import AjioAdapter
from .nykaa import NykaaAdapter
from .meesho import MeeshoAdapter
from .shopify import ShopifyAdapter

__all__ = [
    "MarketplaceAdapter",
    "marketplace_registry",
    "AmazonAdapter",
    "FlipkartAdapter",
    "MyntraAdapter",
    "AjioAdapter",
    "NykaaAdapter",
    "MeeshoAdapter",
    "ShopifyAdapter"
]
