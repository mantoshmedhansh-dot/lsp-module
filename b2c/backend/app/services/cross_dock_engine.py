"""
Cross-Dock Engine Service
Handles cross-docking operations and allocations
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from sqlmodel import Session, select
from sqlalchemy import and_, or_

from app.models.cross_dock import (
    CrossDockRule, CrossDockOrder, CrossDockAllocation, StagingArea,
    CrossDockRuleType, CrossDockStatus, StagingAreaStatus,
    EligibleOrdersResponse, CrossDockOrderResponse
)


class CrossDockEngine:
    """
    Engine for cross-docking operations.
    Manages flow-through allocation and staging.
    """

    async def find_eligible_orders(
        self,
        db: Session,
        warehouse_id: UUID,
        inbound_shipment_id: Optional[UUID] = None
    ) -> EligibleOrdersResponse:
        """Find orders eligible for cross-docking."""
        # Get active rules
        rules_stmt = select(CrossDockRule).where(
            and_(
                CrossDockRule.warehouseId == warehouse_id,
                CrossDockRule.isActive == True
            )
        ).order_by(CrossDockRule.priority.desc())
        rules = db.exec(rules_stmt).all()

        # Get pending cross-dock orders
        orders_stmt = select(CrossDockOrder).where(
            and_(
                CrossDockOrder.warehouseId == warehouse_id,
                CrossDockOrder.status.in_([CrossDockStatus.PENDING, CrossDockStatus.ELIGIBLE])
            )
        ).order_by(CrossDockOrder.priority.desc())

        if inbound_shipment_id:
            orders_stmt = orders_stmt.where(
                CrossDockOrder.inboundShipmentId == inbound_shipment_id
            )

        orders = db.exec(orders_stmt).all()

        # Apply rules to filter eligible orders
        eligible_orders = []
        for order in orders:
            for rule in rules:
                if await self._check_rule_eligibility(order, rule):
                    order.status = CrossDockStatus.ELIGIBLE
                    order.appliedRuleId = rule.id
                    db.add(order)
                    eligible_orders.append(order)
                    break

        db.commit()

        return EligibleOrdersResponse(
            warehouseId=warehouse_id,
            totalEligible=len(eligible_orders),
            orders=[CrossDockOrderResponse(
                id=o.id,
                warehouseId=o.warehouseId,
                orderId=o.orderId,
                orderNumber=o.orderNumber,
                status=o.status,
                inboundShipmentId=o.inboundShipmentId,
                expectedArrival=o.expectedArrival,
                scheduledDeparture=o.scheduledDeparture,
                totalUnits=o.totalUnits,
                allocatedUnits=o.allocatedUnits,
                processedUnits=o.processedUnits,
                priority=o.priority
            ) for o in eligible_orders],
            generatedAt=datetime.now(timezone.utc)
        )

    async def _check_rule_eligibility(
        self,
        order: CrossDockOrder,
        rule: CrossDockRule
    ) -> bool:
        """Check if an order matches a rule's criteria."""
        # Basic eligibility - in real implementation, would check:
        # - Order value vs minOrderValue
        # - Order age vs maxOrderAge
        # - Customer tier
        # - Shipping method
        # - Product categories

        if rule.ruleType == CrossDockRuleType.SAME_DAY:
            # Check if order can be shipped same day
            if order.expectedArrival and order.scheduledDeparture:
                if order.scheduledDeparture.date() == order.expectedArrival.date():
                    return True

        elif rule.ruleType == CrossDockRuleType.AUTO_ALLOCATE:
            # Auto-allocate based on percentage
            return True

        elif rule.ruleType == CrossDockRuleType.EXPRESS:
            # Check priority
            if order.priority >= 80:
                return True

        return False

    async def create_allocation(
        self,
        db: Session,
        cross_dock_order_id: UUID,
        inbound_line_id: UUID,
        outbound_line_id: UUID,
        item_id: UUID,
        sku: str,
        quantity: int
    ) -> CrossDockAllocation:
        """Create a cross-dock allocation."""
        allocation = CrossDockAllocation(
            crossDockOrderId=cross_dock_order_id,
            inboundLineId=inbound_line_id,
            outboundLineId=outbound_line_id,
            itemId=item_id,
            sku=sku,
            allocatedQuantity=quantity
        )
        db.add(allocation)

        # Update order
        order_stmt = select(CrossDockOrder).where(CrossDockOrder.id == cross_dock_order_id)
        order = db.exec(order_stmt).first()
        if order:
            order.allocatedUnits += quantity
            order.status = CrossDockStatus.ALLOCATED
            db.add(order)

        db.commit()
        db.refresh(allocation)

        return allocation

    async def assign_staging_area(
        self,
        db: Session,
        warehouse_id: UUID,
        cross_dock_order_id: UUID,
        required_units: int
    ) -> Optional[StagingArea]:
        """Assign a staging area for cross-dock order."""
        # Find available staging area with capacity
        stmt = select(StagingArea).where(
            and_(
                StagingArea.warehouseId == warehouse_id,
                StagingArea.status == StagingAreaStatus.AVAILABLE,
                StagingArea.isActive == True,
                (StagingArea.capacityUnits - StagingArea.currentUnits) >= required_units
            )
        ).order_by(StagingArea.currentUnits.asc())

        staging_area = db.exec(stmt).first()

        if staging_area:
            # Reserve the staging area
            staging_area.status = StagingAreaStatus.RESERVED
            staging_area.currentUnits += required_units
            staging_area.reservedUntil = datetime.now(timezone.utc) + timedelta(hours=4)
            db.add(staging_area)

            # Update cross-dock order
            order_stmt = select(CrossDockOrder).where(CrossDockOrder.id == cross_dock_order_id)
            order = db.exec(order_stmt).first()
            if order:
                order.stagingAreaId = staging_area.id
                order.status = CrossDockStatus.IN_STAGING
                db.add(order)

            db.commit()
            db.refresh(staging_area)

        return staging_area

    async def complete_cross_dock(
        self,
        db: Session,
        cross_dock_order_id: UUID
    ) -> bool:
        """Mark cross-dock order as shipped."""
        order_stmt = select(CrossDockOrder).where(CrossDockOrder.id == cross_dock_order_id)
        order = db.exec(order_stmt).first()

        if not order:
            return False

        # Release staging area
        if order.stagingAreaId:
            staging_stmt = select(StagingArea).where(StagingArea.id == order.stagingAreaId)
            staging = db.exec(staging_stmt).first()
            if staging:
                staging.status = StagingAreaStatus.AVAILABLE
                staging.currentUnits -= order.totalUnits
                staging.reservedUntil = None
                staging.assignedCarrier = None
                db.add(staging)

        order.status = CrossDockStatus.SHIPPED
        order.actualDeparture = datetime.now(timezone.utc)
        order.processedUnits = order.totalUnits
        db.add(order)
        db.commit()

        return True

    async def get_staging_status(
        self,
        db: Session,
        warehouse_id: UUID
    ) -> List[Dict[str, Any]]:
        """Get status of all staging areas."""
        stmt = select(StagingArea).where(
            and_(
                StagingArea.warehouseId == warehouse_id,
                StagingArea.isActive == True
            )
        ).order_by(StagingArea.areaCode)

        staging_areas = db.exec(stmt).all()

        return [
            {
                "areaCode": sa.areaCode,
                "areaName": sa.areaName,
                "status": sa.status.value,
                "utilizationPercent": round(sa.currentUnits / sa.capacityUnits * 100, 1) if sa.capacityUnits > 0 else 0,
                "currentUnits": sa.currentUnits,
                "capacityUnits": sa.capacityUnits,
                "dockDoor": sa.dockDoor,
                "assignedCarrier": sa.assignedCarrier
            }
            for sa in staging_areas
        ]


# Global service instance
cross_dock_engine = CrossDockEngine()
