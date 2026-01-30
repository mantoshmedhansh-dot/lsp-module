"""
Buffer Calculator
Calculates safety stock and buffer quantities for channel inventory
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from decimal import Decimal

from sqlmodel import Session, select, func

from app.models import (
    SKU,
    Inventory,
    Order,
    OrderItem,
    ChannelInventoryRule,
)

logger = logging.getLogger(__name__)


class BufferCalculator:
    """
    Calculates buffer/safety stock quantities for inventory allocation.

    Buffer calculation strategies:
    1. Fixed quantity - Static buffer amount per SKU/channel
    2. Days of cover - Buffer based on average daily sales
    3. Percentage - Buffer as percentage of available inventory
    4. Dynamic - AI-driven based on demand patterns
    """

    def __init__(self, session: Session, company_id: UUID):
        self.session = session
        self.company_id = company_id
        self._sales_velocity_cache: Dict[str, float] = {}

    def calculate_buffer(
        self,
        sku_id: UUID,
        channel: str,
        available_qty: int,
        rule: Optional[ChannelInventoryRule] = None
    ) -> int:
        """
        Calculate buffer quantity for a SKU on a specific channel.

        Args:
            sku_id: SKU identifier
            channel: Marketplace channel
            available_qty: Currently available inventory
            rule: Optional channel inventory rule

        Returns:
            Buffer quantity to reserve
        """
        if rule:
            buffer_type = rule.bufferType or "FIXED"
            buffer_value = rule.bufferValue or 0

            if buffer_type == "FIXED":
                return int(buffer_value)

            elif buffer_type == "PERCENTAGE":
                return int(available_qty * buffer_value / 100)

            elif buffer_type == "DAYS_OF_COVER":
                daily_velocity = self._get_sales_velocity(sku_id, channel)
                return int(daily_velocity * buffer_value)

            elif buffer_type == "DYNAMIC":
                return self._calculate_dynamic_buffer(sku_id, channel, available_qty)

        # Default: 10% buffer or minimum 5 units
        return max(int(available_qty * 0.1), 5)

    def calculate_available_for_channel(
        self,
        sku_id: UUID,
        channel: str,
        total_available: int,
        rule: Optional[ChannelInventoryRule] = None
    ) -> Tuple[int, int]:
        """
        Calculate available quantity for a channel after buffer.

        Args:
            sku_id: SKU identifier
            channel: Marketplace channel
            total_available: Total available inventory
            rule: Optional channel inventory rule

        Returns:
            Tuple of (available_for_channel, buffer_qty)
        """
        buffer_qty = self.calculate_buffer(sku_id, channel, total_available, rule)
        available = max(0, total_available - buffer_qty)

        return available, buffer_qty

    def _get_sales_velocity(
        self,
        sku_id: UUID,
        channel: Optional[str] = None,
        days: int = 30
    ) -> float:
        """
        Calculate average daily sales velocity for a SKU.

        Args:
            sku_id: SKU identifier
            channel: Optional channel filter
            days: Number of days to analyze

        Returns:
            Average daily units sold
        """
        cache_key = f"{sku_id}:{channel or 'ALL'}:{days}"
        if cache_key in self._sales_velocity_cache:
            return self._sales_velocity_cache[cache_key]

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Query order items for this SKU
        query = (
            select(func.sum(OrderItem.quantity))
            .join(Order)
            .where(
                OrderItem.skuId == sku_id,
                Order.companyId == self.company_id,
                Order.orderDate >= cutoff_date,
                Order.status.not_in(["CANCELLED", "FAILED", "RETURNED"])
            )
        )

        if channel:
            query = query.where(Order.channel == channel)

        total_sold = self.session.exec(query).first() or 0
        velocity = float(total_sold) / days

        self._sales_velocity_cache[cache_key] = velocity
        return velocity

    def _calculate_dynamic_buffer(
        self,
        sku_id: UUID,
        channel: str,
        available_qty: int
    ) -> int:
        """
        Calculate dynamic buffer based on demand patterns.

        Uses:
        - Sales velocity (higher velocity = more buffer)
        - Seasonality factor
        - Channel reliability factor
        - Lead time consideration
        """
        # Get sales velocity
        velocity = self._get_sales_velocity(sku_id, channel)

        # Base buffer: 3 days of sales
        base_buffer = velocity * 3

        # Velocity multiplier (faster selling = more buffer)
        if velocity > 10:  # High velocity
            velocity_mult = 1.5
        elif velocity > 5:  # Medium velocity
            velocity_mult = 1.2
        else:  # Low velocity
            velocity_mult = 1.0

        # Channel reliability factor (some channels have more returns/issues)
        channel_factors = {
            "AMAZON": 1.1,     # Slightly higher buffer for Amazon
            "FLIPKART": 1.15,  # Higher returns on Flipkart
            "SHOPIFY": 0.9,    # Lower buffer for D2C (more control)
            "MYNTRA": 1.2,     # Fashion has higher returns
            "MEESHO": 1.25,    # Higher buffer for Meesho
        }
        channel_mult = channel_factors.get(channel, 1.0)

        # Calculate final buffer
        buffer = base_buffer * velocity_mult * channel_mult

        # Ensure minimum and maximum bounds
        min_buffer = max(5, int(available_qty * 0.05))  # At least 5% or 5 units
        max_buffer = int(available_qty * 0.30)  # Cap at 30%

        return max(min_buffer, min(int(buffer), max_buffer))

    def get_buffer_recommendations(
        self,
        channel: Optional[str] = None,
        limit: int = 100
    ) -> List[dict]:
        """
        Get buffer recommendations for SKUs.

        Returns suggestions for buffer adjustments based on analysis.
        """
        recommendations = []

        # Get all SKUs with inventory
        query = (
            select(Inventory, SKU)
            .join(SKU, Inventory.skuId == SKU.id)
            .where(
                Inventory.companyId == self.company_id,
                Inventory.available > 0
            )
            .limit(limit)
        )

        results = self.session.exec(query).all()

        for inventory, sku in results:
            velocity = self._get_sales_velocity(inventory.skuId, channel)

            # Calculate current effective buffer (if rule exists)
            rule = self.session.exec(
                select(ChannelInventoryRule).where(
                    ChannelInventoryRule.skuId == inventory.skuId,
                    ChannelInventoryRule.companyId == self.company_id,
                    ChannelInventoryRule.channel == channel if channel else True
                )
            ).first()

            current_buffer = self.calculate_buffer(
                inventory.skuId,
                channel or "DEFAULT",
                inventory.available,
                rule
            )

            recommended_buffer = self._calculate_dynamic_buffer(
                inventory.skuId,
                channel or "DEFAULT",
                inventory.available
            )

            # Only include if recommendation differs significantly
            if abs(recommended_buffer - current_buffer) > max(5, current_buffer * 0.2):
                recommendations.append({
                    "sku_id": str(inventory.skuId),
                    "sku_code": sku.skuCode,
                    "sku_name": sku.name,
                    "available": inventory.available,
                    "velocity": round(velocity, 2),
                    "current_buffer": current_buffer,
                    "recommended_buffer": recommended_buffer,
                    "change": recommended_buffer - current_buffer,
                    "reason": self._get_recommendation_reason(
                        velocity, current_buffer, recommended_buffer
                    )
                })

        return sorted(recommendations, key=lambda x: abs(x["change"]), reverse=True)

    def _get_recommendation_reason(
        self,
        velocity: float,
        current: int,
        recommended: int
    ) -> str:
        """Get human-readable reason for buffer recommendation."""
        if recommended > current:
            if velocity > 10:
                return "High sales velocity requires more buffer"
            elif velocity > 5:
                return "Moderate velocity suggests increasing buffer"
            else:
                return "Buffer increase recommended for safety"
        else:
            if velocity < 1:
                return "Low velocity allows reduced buffer"
            elif velocity < 5:
                return "Moderate velocity allows some buffer reduction"
            else:
                return "Buffer can be optimized for efficiency"

    def clear_cache(self):
        """Clear the velocity cache."""
        self._sales_velocity_cache.clear()
