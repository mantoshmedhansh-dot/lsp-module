"""
Subscription Engine Service
Handles subscription management and recurring order generation
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from sqlmodel import Session, select
from sqlalchemy import and_, or_

from app.models.subscription import (
    Subscription, SubscriptionLine, SubscriptionSchedule, SubscriptionHistory,
    SubscriptionStatus, SubscriptionFrequency, ScheduleStatus,
    GenerateOrdersResponse, UpcomingDeliveriesResponse
)
from app.models.preorder import (
    Preorder, PreorderLine, PreorderInventory,
    PreorderStatus, InventoryReservationType,
    PreorderInventoryStatusResponse
)


class SubscriptionEngine:
    """
    Engine for subscription management.
    Handles recurring order generation and scheduling.
    """

    # Frequency to days mapping
    FREQUENCY_DAYS = {
        SubscriptionFrequency.DAILY: 1,
        SubscriptionFrequency.WEEKLY: 7,
        SubscriptionFrequency.BIWEEKLY: 14,
        SubscriptionFrequency.MONTHLY: 30,
        SubscriptionFrequency.QUARTERLY: 90,
    }

    async def calculate_next_delivery(
        self,
        subscription: Subscription,
        from_date: Optional[datetime] = None
    ) -> datetime:
        """Calculate the next delivery date for a subscription."""
        base_date = from_date or subscription.lastDeliveryDate or subscription.startDate

        if subscription.frequency == SubscriptionFrequency.CUSTOM:
            days = subscription.customIntervalDays or 30
        else:
            days = self.FREQUENCY_DAYS.get(subscription.frequency, 30)

        return base_date + timedelta(days=days)

    async def generate_orders(
        self,
        db: Session,
        warehouse_id: Optional[UUID] = None,
        target_date: Optional[datetime] = None,
        max_orders: int = 100
    ) -> GenerateOrdersResponse:
        """Generate recurring orders for subscriptions due."""
        if not target_date:
            target_date = datetime.now(timezone.utc)

        # Find subscriptions due for delivery
        stmt = select(Subscription).where(
            and_(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.nextDeliveryDate <= target_date
            )
        )

        if warehouse_id:
            stmt = stmt.where(Subscription.warehouseId == warehouse_id)

        stmt = stmt.limit(max_orders)
        subscriptions = db.exec(stmt).all()

        generated = 0
        failed = 0
        skipped = 0
        results = []

        for subscription in subscriptions:
            try:
                # Check if delivery count reached
                if subscription.deliveriesRemaining is not None and subscription.deliveriesRemaining <= 0:
                    skipped += 1
                    results.append({
                        "subscriptionId": str(subscription.id),
                        "status": "skipped",
                        "reason": "No deliveries remaining"
                    })
                    continue

                # Create schedule entry
                schedule = SubscriptionSchedule(
                    subscriptionId=subscription.id,
                    scheduledDate=subscription.nextDeliveryDate,
                    status=ScheduleStatus.PROCESSING,
                    amount=subscription.totalAmount - subscription.discount
                )
                db.add(schedule)

                # Generate order (mock - in real implementation, would create actual order)
                order_number = f"SUB-{subscription.subscriptionNumber}-{subscription.totalDeliveries + 1:04d}"

                schedule.status = ScheduleStatus.GENERATED
                schedule.generatedOrderNumber = order_number
                schedule.processedAt = datetime.now(timezone.utc)
                db.add(schedule)

                # Update subscription
                subscription.lastDeliveryDate = subscription.nextDeliveryDate
                subscription.nextDeliveryDate = await self.calculate_next_delivery(subscription)
                subscription.totalDeliveries += 1
                if subscription.deliveriesRemaining is not None:
                    subscription.deliveriesRemaining -= 1
                    if subscription.deliveriesRemaining <= 0:
                        subscription.status = SubscriptionStatus.EXPIRED

                db.add(subscription)

                # Record history
                history = SubscriptionHistory(
                    subscriptionId=subscription.id,
                    action="ORDER_GENERATED",
                    details={"orderNumber": order_number, "scheduleId": str(schedule.id)}
                )
                db.add(history)

                generated += 1
                results.append({
                    "subscriptionId": str(subscription.id),
                    "status": "generated",
                    "orderNumber": order_number
                })

            except Exception as e:
                failed += 1
                results.append({
                    "subscriptionId": str(subscription.id),
                    "status": "failed",
                    "error": str(e)
                })

        db.commit()

        return GenerateOrdersResponse(
            processedSubscriptions=len(subscriptions),
            generatedOrders=generated,
            failedOrders=failed,
            skippedOrders=skipped,
            generatedAt=datetime.now(timezone.utc),
            results=results
        )

    async def get_upcoming_deliveries(
        self,
        db: Session,
        warehouse_id: Optional[UUID] = None,
        customer_id: Optional[UUID] = None,
        days_ahead: int = 7
    ) -> UpcomingDeliveriesResponse:
        """Get upcoming subscription deliveries."""
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=days_ahead)

        stmt = select(Subscription).where(
            and_(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.nextDeliveryDate >= start_date,
                Subscription.nextDeliveryDate <= end_date
            )
        )

        if warehouse_id:
            stmt = stmt.where(Subscription.warehouseId == warehouse_id)
        if customer_id:
            stmt = stmt.where(Subscription.customerId == customer_id)

        stmt = stmt.order_by(Subscription.nextDeliveryDate)
        subscriptions = db.exec(stmt).all()

        deliveries = []
        for sub in subscriptions:
            # Get line items
            lines_stmt = select(SubscriptionLine).where(
                and_(
                    SubscriptionLine.subscriptionId == sub.id,
                    SubscriptionLine.isActive == True
                )
            )
            lines = db.exec(lines_stmt).all()

            deliveries.append({
                "subscriptionId": str(sub.id),
                "subscriptionNumber": sub.subscriptionNumber,
                "customerId": str(sub.customerId),
                "deliveryDate": sub.nextDeliveryDate.isoformat(),
                "amount": sub.totalAmount - sub.discount,
                "itemCount": len(lines),
                "frequency": sub.frequency.value
            })

        return UpcomingDeliveriesResponse(
            totalUpcoming=len(deliveries),
            deliveries=deliveries,
            startDate=start_date,
            endDate=end_date
        )

    async def pause_subscription(
        self,
        db: Session,
        subscription_id: UUID,
        reason: Optional[str] = None,
        resume_date: Optional[datetime] = None
    ) -> bool:
        """Pause a subscription."""
        stmt = select(Subscription).where(Subscription.id == subscription_id)
        subscription = db.exec(stmt).first()

        if not subscription or subscription.status != SubscriptionStatus.ACTIVE:
            return False

        subscription.status = SubscriptionStatus.PAUSED
        subscription.pausedAt = datetime.now(timezone.utc)
        subscription.pauseReason = reason
        subscription.resumeDate = resume_date
        db.add(subscription)

        # Record history
        history = SubscriptionHistory(
            subscriptionId=subscription_id,
            action="PAUSED",
            previousStatus=SubscriptionStatus.ACTIVE.value,
            newStatus=SubscriptionStatus.PAUSED.value,
            changeReason=reason
        )
        db.add(history)

        db.commit()
        return True

    async def resume_subscription(
        self,
        db: Session,
        subscription_id: UUID,
        next_delivery_date: Optional[datetime] = None
    ) -> bool:
        """Resume a paused subscription."""
        stmt = select(Subscription).where(Subscription.id == subscription_id)
        subscription = db.exec(stmt).first()

        if not subscription or subscription.status != SubscriptionStatus.PAUSED:
            return False

        subscription.status = SubscriptionStatus.ACTIVE
        subscription.pausedAt = None
        subscription.pauseReason = None
        subscription.resumeDate = None

        if next_delivery_date:
            subscription.nextDeliveryDate = next_delivery_date
        else:
            subscription.nextDeliveryDate = await self.calculate_next_delivery(
                subscription,
                datetime.now(timezone.utc)
            )

        db.add(subscription)

        # Record history
        history = SubscriptionHistory(
            subscriptionId=subscription_id,
            action="RESUMED",
            previousStatus=SubscriptionStatus.PAUSED.value,
            newStatus=SubscriptionStatus.ACTIVE.value
        )
        db.add(history)

        db.commit()
        return True

    async def cancel_subscription(
        self,
        db: Session,
        subscription_id: UUID,
        reason: Optional[str] = None
    ) -> bool:
        """Cancel a subscription."""
        stmt = select(Subscription).where(Subscription.id == subscription_id)
        subscription = db.exec(stmt).first()

        if not subscription:
            return False

        previous_status = subscription.status
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancelledAt = datetime.now(timezone.utc)
        subscription.cancelReason = reason
        db.add(subscription)

        # Record history
        history = SubscriptionHistory(
            subscriptionId=subscription_id,
            action="CANCELLED",
            previousStatus=previous_status.value,
            newStatus=SubscriptionStatus.CANCELLED.value,
            changeReason=reason
        )
        db.add(history)

        db.commit()
        return True


class PreorderEngine:
    """
    Engine for pre-order management.
    """

    async def check_inventory_status(
        self,
        db: Session,
        preorder_id: UUID
    ) -> PreorderInventoryStatusResponse:
        """Check inventory availability for a pre-order."""
        preorder_stmt = select(Preorder).where(Preorder.id == preorder_id)
        preorder = db.exec(preorder_stmt).first()

        if not preorder:
            raise ValueError("Pre-order not found")

        lines_stmt = select(PreorderLine).where(PreorderLine.preorderId == preorder_id)
        lines = db.exec(lines_stmt).all()

        fully_reserved = 0
        partially_reserved = 0
        unavailable = 0
        line_details = []

        for line in lines:
            if line.reservedQuantity >= line.quantity:
                fully_reserved += 1
                status = "FULLY_RESERVED"
            elif line.reservedQuantity > 0:
                partially_reserved += 1
                status = "PARTIALLY_RESERVED"
            elif line.availableQuantity >= line.quantity:
                status = "AVAILABLE"
            else:
                unavailable += 1
                status = "UNAVAILABLE"

            line_details.append({
                "lineId": str(line.id),
                "sku": line.sku,
                "quantity": line.quantity,
                "reservedQuantity": line.reservedQuantity,
                "availableQuantity": line.availableQuantity,
                "status": status
            })

        ready_to_convert = fully_reserved == len(lines) and unavailable == 0

        return PreorderInventoryStatusResponse(
            preorderId=preorder_id,
            preorderNumber=preorder.preorderNumber,
            totalLines=len(lines),
            fullyReservedLines=fully_reserved,
            partiallyReservedLines=partially_reserved,
            unavailableLines=unavailable,
            readyToConvert=ready_to_convert,
            lines=line_details
        )

    async def convert_to_order(
        self,
        db: Session,
        preorder_id: UUID
    ) -> Dict[str, Any]:
        """Convert a pre-order to a regular order."""
        preorder_stmt = select(Preorder).where(Preorder.id == preorder_id)
        preorder = db.exec(preorder_stmt).first()

        if not preorder:
            return {"success": False, "message": "Pre-order not found"}

        if preorder.status != PreorderStatus.READY_TO_SHIP:
            return {"success": False, "message": f"Pre-order status is {preorder.status.value}"}

        # Create order (mock)
        order_number = f"ORD-{preorder.preorderNumber}"

        preorder.status = PreorderStatus.CONVERTED
        preorder.convertedOrderId = uuid4()  # Would be actual order ID
        db.add(preorder)
        db.commit()

        return {
            "success": True,
            "preorderId": str(preorder_id),
            "orderId": str(preorder.convertedOrderId),
            "orderNumber": order_number,
            "message": "Pre-order converted successfully"
        }


# Global service instances
subscription_engine = SubscriptionEngine()
preorder_engine = PreorderEngine()
