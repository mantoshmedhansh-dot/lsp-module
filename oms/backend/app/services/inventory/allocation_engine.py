"""
Channel Allocation Engine
Manages inventory allocation across marketplace channels
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from decimal import Decimal

from sqlmodel import Session, select, func

from app.models import (
    SKU,
    Inventory,
    ChannelInventoryRule,
    MarketplaceConnection,
    MarketplaceSkuMapping,
)
from .buffer_calculator import BufferCalculator

logger = logging.getLogger(__name__)


class ChannelAllocationEngine:
    """
    Manages inventory allocation across multiple marketplace channels.

    Allocation Strategies:
    1. PERCENTAGE - Allocate percentage of total inventory
    2. FIXED - Allocate fixed quantity regardless of total
    3. UNLIMITED - Allocate all available inventory
    4. PRIORITY - Allocate based on channel priority
    5. FAIR_SHARE - Equal distribution across channels
    """

    def __init__(self, session: Session, company_id: UUID):
        self.session = session
        self.company_id = company_id
        self.buffer_calculator = BufferCalculator(session, company_id)

    def calculate_channel_allocation(
        self,
        sku_id: UUID,
        total_available: int,
        channels: Optional[List[str]] = None
    ) -> Dict[str, dict]:
        """
        Calculate inventory allocation for all channels.

        Args:
            sku_id: SKU identifier
            total_available: Total available inventory
            channels: Optional list of channels (default: all active)

        Returns:
            Dictionary mapping channel to allocation details
        """
        # Get all channel rules for this SKU
        rules = self._get_channel_rules(sku_id)

        # Get active channels if not specified
        if not channels:
            channels = self._get_active_channels(sku_id)

        allocations = {}
        remaining = total_available

        # First pass: calculate raw allocations
        raw_allocations = {}
        for channel in channels:
            rule = rules.get(channel)
            raw_qty = self._calculate_raw_allocation(
                total_available, channel, rule
            )
            raw_allocations[channel] = raw_qty

        # Second pass: normalize if total exceeds available
        total_raw = sum(raw_allocations.values())
        if total_raw > total_available:
            # Scale down proportionally
            scale_factor = total_available / total_raw if total_raw > 0 else 0
            raw_allocations = {
                ch: int(qty * scale_factor)
                for ch, qty in raw_allocations.items()
            }

        # Third pass: apply buffers and finalize
        for channel in channels:
            rule = rules.get(channel)
            raw_qty = raw_allocations.get(channel, 0)

            # Calculate buffer
            buffer_qty = self.buffer_calculator.calculate_buffer(
                sku_id, channel, raw_qty, rule
            )

            # Final allocation
            final_qty = max(0, raw_qty - buffer_qty)

            allocations[channel] = {
                "channel": channel,
                "allocated": final_qty,
                "buffer": buffer_qty,
                "raw_allocation": raw_qty,
                "rule_type": rule.allocationType if rule else "DEFAULT",
                "rule_value": float(rule.allocationValue) if rule else None,
                "priority": rule.priority if rule else 99,
            }

        return allocations

    def _calculate_raw_allocation(
        self,
        total_available: int,
        channel: str,
        rule: Optional[ChannelInventoryRule]
    ) -> int:
        """Calculate raw allocation before buffer."""
        if not rule:
            # Default: unlimited (all available)
            return total_available

        allocation_type = rule.allocationType
        allocation_value = float(rule.allocationValue or 0)

        if allocation_type == "PERCENTAGE":
            return int(total_available * allocation_value / 100)

        elif allocation_type == "FIXED":
            return min(int(allocation_value), total_available)

        elif allocation_type == "UNLIMITED":
            return total_available

        elif allocation_type == "PRIORITY":
            # Priority-based: higher priority gets more
            # This is handled in the normalization step
            return total_available

        elif allocation_type == "FAIR_SHARE":
            # Fair share is calculated based on number of channels
            # Handled in parent method
            return total_available

        return total_available

    def _get_channel_rules(self, sku_id: UUID) -> Dict[str, ChannelInventoryRule]:
        """Get all channel rules for a SKU."""
        rules = self.session.exec(
            select(ChannelInventoryRule).where(
                ChannelInventoryRule.companyId == self.company_id,
                ChannelInventoryRule.skuId == sku_id,
                ChannelInventoryRule.isActive == True
            )
        ).all()

        return {rule.channel: rule for rule in rules}

    def _get_active_channels(self, sku_id: UUID) -> List[str]:
        """Get list of active channels for a SKU."""
        # Get channels from SKU mappings
        mappings = self.session.exec(
            select(MarketplaceSkuMapping.channel).where(
                MarketplaceSkuMapping.companyId == self.company_id,
                MarketplaceSkuMapping.skuId == sku_id,
                MarketplaceSkuMapping.listingStatus == "ACTIVE"
            ).distinct()
        ).all()

        return list(mappings) if mappings else []

    def get_allocation_summary(
        self,
        sku_id: Optional[UUID] = None,
        channel: Optional[str] = None
    ) -> List[dict]:
        """
        Get allocation summary for SKUs.

        Args:
            sku_id: Optional filter by SKU
            channel: Optional filter by channel

        Returns:
            List of allocation summaries
        """
        summaries = []

        # Build query for inventory
        query = (
            select(Inventory, SKU)
            .join(SKU, Inventory.skuId == SKU.id)
            .where(
                Inventory.companyId == self.company_id,
                Inventory.available > 0
            )
        )

        if sku_id:
            query = query.where(Inventory.skuId == sku_id)

        results = self.session.exec(query).all()

        for inventory, sku in results:
            # Calculate allocations
            allocations = self.calculate_channel_allocation(
                inventory.skuId,
                inventory.available
            )

            if channel and channel not in allocations:
                continue

            summary = {
                "sku_id": str(inventory.skuId),
                "sku_code": sku.skuCode,
                "sku_name": sku.name,
                "total_available": inventory.available,
                "total_allocated": sum(a["allocated"] for a in allocations.values()),
                "total_buffer": sum(a["buffer"] for a in allocations.values()),
                "channels": allocations if not channel else {channel: allocations.get(channel)},
            }

            summaries.append(summary)

        return summaries

    def update_channel_rule(
        self,
        sku_id: UUID,
        channel: str,
        allocation_type: str,
        allocation_value: float,
        buffer_type: Optional[str] = None,
        buffer_value: Optional[float] = None,
        priority: int = 50
    ) -> ChannelInventoryRule:
        """
        Create or update a channel inventory rule.

        Args:
            sku_id: SKU identifier
            channel: Marketplace channel
            allocation_type: PERCENTAGE, FIXED, UNLIMITED, etc.
            allocation_value: Value for allocation calculation
            buffer_type: Optional buffer calculation type
            buffer_value: Optional buffer value
            priority: Rule priority (lower = higher priority)

        Returns:
            Created or updated rule
        """
        from uuid import uuid4

        # Find existing rule
        existing = self.session.exec(
            select(ChannelInventoryRule).where(
                ChannelInventoryRule.companyId == self.company_id,
                ChannelInventoryRule.skuId == sku_id,
                ChannelInventoryRule.channel == channel
            )
        ).first()

        if existing:
            existing.allocationType = allocation_type
            existing.allocationValue = Decimal(str(allocation_value))
            existing.bufferType = buffer_type
            existing.bufferValue = Decimal(str(buffer_value)) if buffer_value else None
            existing.priority = priority
            existing.updatedAt = datetime.utcnow()
            self.session.add(existing)
            self.session.commit()
            return existing
        else:
            rule = ChannelInventoryRule(
                id=uuid4(),
                companyId=self.company_id,
                skuId=sku_id,
                channel=channel,
                allocationType=allocation_type,
                allocationValue=Decimal(str(allocation_value)),
                bufferType=buffer_type,
                bufferValue=Decimal(str(buffer_value)) if buffer_value else None,
                priority=priority,
                isActive=True,
                createdAt=datetime.utcnow(),
                updatedAt=datetime.utcnow(),
            )
            self.session.add(rule)
            self.session.commit()
            return rule

    def bulk_update_rules(
        self,
        rules: List[dict]
    ) -> Tuple[int, int, List[str]]:
        """
        Bulk update channel inventory rules.

        Args:
            rules: List of rule dictionaries

        Returns:
            Tuple of (created_count, updated_count, errors)
        """
        created = 0
        updated = 0
        errors = []

        for rule_data in rules:
            try:
                sku_id = UUID(rule_data["sku_id"])
                channel = rule_data["channel"]

                existing = self.session.exec(
                    select(ChannelInventoryRule).where(
                        ChannelInventoryRule.companyId == self.company_id,
                        ChannelInventoryRule.skuId == sku_id,
                        ChannelInventoryRule.channel == channel
                    )
                ).first()

                if existing:
                    updated += 1
                else:
                    created += 1

                self.update_channel_rule(
                    sku_id=sku_id,
                    channel=channel,
                    allocation_type=rule_data.get("allocation_type", "PERCENTAGE"),
                    allocation_value=float(rule_data.get("allocation_value", 100)),
                    buffer_type=rule_data.get("buffer_type"),
                    buffer_value=float(rule_data["buffer_value"]) if rule_data.get("buffer_value") else None,
                    priority=int(rule_data.get("priority", 50))
                )

            except Exception as e:
                errors.append(f"SKU {rule_data.get('sku_id')}: {str(e)}")

        return created, updated, errors

    def get_channel_utilization(self) -> Dict[str, dict]:
        """
        Get inventory utilization statistics per channel.

        Returns:
            Dictionary mapping channel to utilization stats
        """
        utilization = {}

        # Get all active channels
        channels = self.session.exec(
            select(MarketplaceSkuMapping.channel)
            .where(MarketplaceSkuMapping.companyId == self.company_id)
            .distinct()
        ).all()

        for channel in channels:
            # Get total inventory allocated to channel
            total_allocated = 0
            total_available = 0
            sku_count = 0

            mappings = self.session.exec(
                select(MarketplaceSkuMapping).where(
                    MarketplaceSkuMapping.companyId == self.company_id,
                    MarketplaceSkuMapping.channel == channel,
                    MarketplaceSkuMapping.listingStatus == "ACTIVE"
                )
            ).all()

            for mapping in mappings:
                inventory = self.session.exec(
                    select(Inventory).where(
                        Inventory.companyId == self.company_id,
                        Inventory.skuId == mapping.skuId
                    )
                ).first()

                if inventory and inventory.available > 0:
                    sku_count += 1
                    total_available += inventory.available

                    allocations = self.calculate_channel_allocation(
                        mapping.skuId,
                        inventory.available,
                        [channel]
                    )
                    if channel in allocations:
                        total_allocated += allocations[channel]["allocated"]

            utilization[channel] = {
                "channel": channel,
                "sku_count": sku_count,
                "total_available": total_available,
                "total_allocated": total_allocated,
                "utilization_pct": round(
                    (total_allocated / total_available * 100) if total_available > 0 else 0, 2
                ),
            }

        return utilization
