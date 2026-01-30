"""
Subscription API Endpoints
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.subscription import (
    Subscription, SubscriptionLine, SubscriptionSchedule, SubscriptionHistory,
    SubscriptionStatus, SubscriptionFrequency, ScheduleStatus,
    SubscriptionCreate, SubscriptionResponse, SubscriptionLineResponse,
    SubscriptionScheduleResponse,
    SubscriptionPauseRequest, SubscriptionResumeRequest,
    GenerateOrdersRequest, GenerateOrdersResponse,
    UpcomingDeliveriesResponse
)
from app.services.subscription_engine import subscription_engine

router = APIRouter()


def generate_subscription_number() -> str:
    """Generate a unique subscription number."""
    return f"SUB-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"


@router.post("", response_model=SubscriptionResponse)
async def create_subscription(
    subscription: SubscriptionCreate,
    db: Session = Depends(get_session)
):
    """Create a new subscription."""
    new_subscription = Subscription(
        subscriptionNumber=generate_subscription_number(),
        customerId=subscription.customerId,
        warehouseId=subscription.warehouseId,
        frequency=subscription.frequency,
        customIntervalDays=subscription.customIntervalDays,
        startDate=subscription.startDate,
        endDate=subscription.endDate,
        deliveriesRemaining=subscription.deliveriesRemaining,
        shippingAddressId=subscription.shippingAddressId,
        billingAddressId=subscription.billingAddressId,
        paymentMethodId=subscription.paymentMethodId,
        discount=subscription.discount,
        discountType=subscription.discountType,
        notes=subscription.notes,
        status=SubscriptionStatus.ACTIVE
    )

    # Calculate next delivery date
    new_subscription.nextDeliveryDate = await subscription_engine.calculate_next_delivery(
        new_subscription,
        subscription.startDate
    )

    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    # Add line items
    total_amount = 0.0
    for idx, line_data in enumerate(subscription.lines):
        line = SubscriptionLine(
            subscriptionId=new_subscription.id,
            lineNumber=idx + 1,
            itemId=line_data.get("itemId"),
            sku=line_data.get("sku"),
            itemName=line_data.get("itemName"),
            quantity=line_data.get("quantity", 1),
            unitPrice=line_data.get("unitPrice", 0),
            totalPrice=line_data.get("quantity", 1) * line_data.get("unitPrice", 0)
        )
        total_amount += line.totalPrice
        db.add(line)

    new_subscription.totalAmount = total_amount
    db.add(new_subscription)

    # Record history
    history = SubscriptionHistory(
        subscriptionId=new_subscription.id,
        action="CREATED",
        newStatus=SubscriptionStatus.ACTIVE.value
    )
    db.add(history)

    db.commit()
    db.refresh(new_subscription)

    return new_subscription


@router.get("", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    warehouse_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    status: Optional[SubscriptionStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List subscriptions."""
    stmt = select(Subscription)
    if warehouse_id:
        stmt = stmt.where(Subscription.warehouseId == warehouse_id)
    if customer_id:
        stmt = stmt.where(Subscription.customerId == customer_id)
    if status:
        stmt = stmt.where(Subscription.status == status)
    stmt = stmt.order_by(Subscription.createdAt.desc()).limit(limit)
    return db.exec(stmt).all()


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: UUID,
    db: Session = Depends(get_session)
):
    """Get subscription details."""
    stmt = select(Subscription).where(Subscription.id == subscription_id)
    subscription = db.exec(stmt).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription


@router.get("/{subscription_id}/lines", response_model=List[SubscriptionLineResponse])
async def get_subscription_lines(
    subscription_id: UUID,
    db: Session = Depends(get_session)
):
    """Get subscription lines."""
    stmt = select(SubscriptionLine).where(
        SubscriptionLine.subscriptionId == subscription_id
    ).order_by(SubscriptionLine.lineNumber)
    return db.exec(stmt).all()


@router.get("/{subscription_id}/schedules", response_model=List[SubscriptionScheduleResponse])
async def get_subscription_schedules(
    subscription_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_session)
):
    """Get subscription delivery schedules."""
    stmt = select(SubscriptionSchedule).where(
        SubscriptionSchedule.subscriptionId == subscription_id
    ).order_by(SubscriptionSchedule.scheduledDate.desc()).limit(limit)
    return db.exec(stmt).all()


@router.put("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: UUID,
    frequency: Optional[SubscriptionFrequency] = None,
    discount: Optional[float] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Update a subscription."""
    stmt = select(Subscription).where(Subscription.id == subscription_id)
    subscription = db.exec(stmt).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if frequency:
        subscription.frequency = frequency
        subscription.nextDeliveryDate = await subscription_engine.calculate_next_delivery(
            subscription,
            subscription.lastDeliveryDate or subscription.startDate
        )
    if discount is not None:
        subscription.discount = discount
    if notes:
        subscription.notes = notes

    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


@router.post("/{subscription_id}/pause")
async def pause_subscription(
    subscription_id: UUID,
    request: SubscriptionPauseRequest,
    db: Session = Depends(get_session)
):
    """Pause a subscription."""
    success = await subscription_engine.pause_subscription(
        db=db,
        subscription_id=subscription_id,
        reason=request.reason,
        resume_date=request.resumeDate
    )
    if not success:
        raise HTTPException(status_code=400, detail="Could not pause subscription")
    return {"message": "Subscription paused"}


@router.post("/{subscription_id}/resume")
async def resume_subscription(
    subscription_id: UUID,
    request: SubscriptionResumeRequest,
    db: Session = Depends(get_session)
):
    """Resume a paused subscription."""
    success = await subscription_engine.resume_subscription(
        db=db,
        subscription_id=subscription_id,
        next_delivery_date=request.nextDeliveryDate
    )
    if not success:
        raise HTTPException(status_code=400, detail="Could not resume subscription")
    return {"message": "Subscription resumed"}


@router.delete("/{subscription_id}")
async def cancel_subscription(
    subscription_id: UUID,
    reason: str = Query(...),
    db: Session = Depends(get_session)
):
    """Cancel a subscription."""
    success = await subscription_engine.cancel_subscription(
        db=db,
        subscription_id=subscription_id,
        reason=reason
    )
    if not success:
        raise HTTPException(status_code=400, detail="Could not cancel subscription")
    return {"message": "Subscription cancelled"}


@router.post("/generate-orders", response_model=GenerateOrdersResponse)
async def generate_recurring_orders(
    request: GenerateOrdersRequest,
    db: Session = Depends(get_session)
):
    """Generate recurring orders for due subscriptions."""
    return await subscription_engine.generate_orders(
        db=db,
        warehouse_id=request.warehouseId,
        target_date=request.date,
        max_orders=request.maxOrders
    )


@router.get("/upcoming", response_model=UpcomingDeliveriesResponse)
async def get_upcoming_deliveries(
    warehouse_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    days_ahead: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_session)
):
    """Get upcoming subscription deliveries."""
    return await subscription_engine.get_upcoming_deliveries(
        db=db,
        warehouse_id=warehouse_id,
        customer_id=customer_id,
        days_ahead=days_ahead
    )
