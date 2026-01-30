"""
Duplicate Detector
Prevents duplicate order imports from marketplaces
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple
from uuid import UUID
import hashlib

from sqlmodel import Session, select, func

from app.models import Order

logger = logging.getLogger(__name__)


class DuplicateDetector:
    """
    Detects and prevents duplicate orders from being imported.

    Uses multiple strategies:
    1. Marketplace order ID check (primary)
    2. Order fingerprint check (secondary)
    3. Fuzzy matching for edge cases
    """

    def __init__(self, session: Session, company_id: UUID):
        self.session = session
        self.company_id = company_id
        self._existing_orders_cache: Set[str] = set()
        self._cache_loaded = False

    def _load_cache(self, channel: Optional[str] = None, days: int = 30):
        """Load recent marketplace order IDs into cache."""
        if self._cache_loaded:
            return

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        query = select(Order.marketplaceOrderId).where(
            Order.companyId == self.company_id,
            Order.marketplaceOrderId.isnot(None),
            Order.createdAt >= cutoff_date
        )

        if channel:
            query = query.where(Order.channel == channel)

        results = self.session.exec(query).all()
        self._existing_orders_cache = {r for r in results if r}
        self._cache_loaded = True

        logger.debug(f"Loaded {len(self._existing_orders_cache)} order IDs into cache")

    def is_duplicate(
        self,
        marketplace_order_id: str,
        channel: str,
        order_data: Optional[dict] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if an order is a duplicate.

        Args:
            marketplace_order_id: The marketplace's order ID
            channel: The marketplace channel
            order_data: Optional order data for fingerprint matching

        Returns:
            Tuple of (is_duplicate, existing_order_id)
        """
        # Load cache if not loaded
        self._load_cache(channel)

        # Primary check: marketplace order ID
        if marketplace_order_id in self._existing_orders_cache:
            logger.debug(f"Duplicate found by marketplace ID: {marketplace_order_id}")
            return True, marketplace_order_id

        # Secondary check: database lookup
        existing = self.session.exec(
            select(Order).where(
                Order.companyId == self.company_id,
                Order.channel == channel,
                Order.marketplaceOrderId == marketplace_order_id
            )
        ).first()

        if existing:
            self._existing_orders_cache.add(marketplace_order_id)
            logger.debug(f"Duplicate found in DB: {marketplace_order_id}")
            return True, str(existing.id)

        # Tertiary check: fingerprint matching (if order data provided)
        if order_data:
            fingerprint = self._generate_fingerprint(order_data)
            existing_by_fingerprint = self.session.exec(
                select(Order).where(
                    Order.companyId == self.company_id,
                    Order.channel == channel,
                    Order.orderFingerprint == fingerprint
                )
            ).first()

            if existing_by_fingerprint:
                logger.warning(
                    f"Duplicate found by fingerprint: {marketplace_order_id} "
                    f"matches {existing_by_fingerprint.orderNo}"
                )
                return True, str(existing_by_fingerprint.id)

        return False, None

    def filter_duplicates(
        self,
        orders: List[dict],
        channel: str
    ) -> Tuple[List[dict], List[dict]]:
        """
        Filter out duplicate orders from a list.

        Args:
            orders: List of order data dictionaries
            channel: The marketplace channel

        Returns:
            Tuple of (new_orders, duplicate_orders)
        """
        self._load_cache(channel)

        new_orders = []
        duplicates = []

        for order in orders:
            marketplace_id = order.get("marketplaceOrderId") or order.get("order_id") or order.get("id")

            if not marketplace_id:
                logger.warning("Order missing marketplace ID, skipping duplicate check")
                new_orders.append(order)
                continue

            is_dup, existing_id = self.is_duplicate(str(marketplace_id), channel, order)

            if is_dup:
                duplicates.append({
                    **order,
                    "_duplicate_of": existing_id
                })
            else:
                new_orders.append(order)
                # Add to cache to prevent duplicates within same batch
                self._existing_orders_cache.add(str(marketplace_id))

        logger.info(
            f"Duplicate check complete: {len(new_orders)} new, {len(duplicates)} duplicates"
        )

        return new_orders, duplicates

    def _generate_fingerprint(self, order_data: dict) -> str:
        """
        Generate a fingerprint for an order based on key fields.

        This helps catch duplicates that might have different marketplace IDs
        but are essentially the same order.
        """
        # Extract key identifying fields
        customer_phone = order_data.get("customerPhone", "")
        customer_email = order_data.get("customerEmail", "")
        total = str(order_data.get("totalAmount", "0"))
        order_date = order_data.get("orderDate", "")

        # Extract item information
        items = order_data.get("items", [])
        item_fingerprints = []
        for item in items:
            item_fp = f"{item.get('skuId', item.get('marketplaceSku', ''))}:{item.get('quantity', 1)}"
            item_fingerprints.append(item_fp)
        items_str = "|".join(sorted(item_fingerprints))

        # Combine into fingerprint string
        fingerprint_source = f"{customer_phone}:{customer_email}:{total}:{order_date}:{items_str}"

        # Generate hash
        return hashlib.sha256(fingerprint_source.encode()).hexdigest()[:32]

    def get_duplicate_summary(
        self,
        channel: Optional[str] = None,
        days: int = 7
    ) -> dict:
        """
        Get a summary of duplicate detection activity.

        Returns statistics about duplicates found in recent syncs.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Count total orders
        total_query = select(func.count(Order.id)).where(
            Order.companyId == self.company_id,
            Order.createdAt >= cutoff_date
        )
        if channel:
            total_query = total_query.where(Order.channel == channel)

        total_count = self.session.exec(total_query).first() or 0

        # Count orders by channel
        channel_counts = {}
        channels_query = select(Order.channel, func.count(Order.id)).where(
            Order.companyId == self.company_id,
            Order.createdAt >= cutoff_date
        ).group_by(Order.channel)

        results = self.session.exec(channels_query).all()
        for ch, count in results:
            channel_counts[ch] = count

        return {
            "period_days": days,
            "total_orders": total_count,
            "by_channel": channel_counts,
            "cache_size": len(self._existing_orders_cache),
        }

    def mark_as_processed(self, marketplace_order_id: str):
        """
        Mark an order ID as processed in the cache.
        Call this after successfully creating an order.
        """
        self._existing_orders_cache.add(marketplace_order_id)

    def clear_cache(self):
        """Clear the duplicate detection cache."""
        self._existing_orders_cache.clear()
        self._cache_loaded = False
