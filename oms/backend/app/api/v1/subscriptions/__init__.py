"""
Subscriptions API v1 - Recurring order management
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    Subscription, SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse,
    SubscriptionLine, SubscriptionLineCreate, SubscriptionLineResponse,
    SubscriptionSchedule, SubscriptionScheduleResponse,
    SubscriptionHistory, SubscriptionHistoryResponse,
    SubscriptionStatus, SubscriptionFrequency, ScheduleStatus,
)


router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


# ============================================================================
# Subscriptions CRUD
# ============================================================================

@router.get("", response_model=List[SubscriptionResponse])
def list_subscriptions(
    status: Optional[SubscriptionStatus] = None,
    customer_id: Optional[UUID] = None,
    frequency: Optional[SubscriptionFrequency] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List subscriptions"""
    query = select(Subscription)

    query = company_filter.apply_filter(query, Subscription.companyId)
    if status:
        query = query.where(Subscription.status == status)
    if customer_id:
        query = query.where(Subscription.customerId == customer_id)
    if frequency:
        query = query.where(Subscription.frequency == frequency)

    query = query.order_by(Subscription.createdAt.desc()).offset(skip).limit(limit)
    subscriptions = session.exec(query).all()
    return subscriptions


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    data: SubscriptionCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new subscription"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4

    # Generate subscription number
    count = session.exec(
        select(func.count(Subscription.id))
        .where(Subscription.companyId == company_filter.company_id)
    ).one()
    subscription_no = f"SUB-{datetime.now().strftime('%Y%m')}-{(count or 0) + 1:05d}"

    subscription = Subscription(
        id=uuid4(),
        companyId=company_filter.company_id,
        subscriptionNo=subscription_no,
        status=SubscriptionStatus.DRAFT,
        **data.model_dump()
    )
    session.add(subscription)
    session.commit()
    session.refresh(subscription)
    return subscription


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
def get_subscription(
    subscription_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific subscription"""
    query = select(Subscription).where(Subscription.id == subscription_id)
    query = company_filter.apply_filter(query, Subscription.companyId)

    subscription = session.exec(query).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
def update_subscription(
    subscription_id: UUID,
    data: SubscriptionUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a subscription"""
    query = select(Subscription).where(Subscription.id == subscription_id)
    query = company_filter.apply_filter(query, Subscription.companyId)

    subscription = session.exec(query).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status == SubscriptionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot update cancelled subscription")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subscription, key, value)

    subscription.updatedAt = datetime.utcnow()
    session.add(subscription)
    session.commit()
    session.refresh(subscription)
    return subscription


@router.delete("/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_subscription(
    subscription_id: UUID,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Cancel a subscription"""
    query = select(Subscription).where(Subscription.id == subscription_id)
    query = company_filter.apply_filter(query, Subscription.companyId)

    subscription = session.exec(query).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    subscription.status = SubscriptionStatus.CANCELLED
    subscription.cancelledAt = datetime.utcnow()
    if reason:
        subscription.notes = f"{subscription.notes or ''} | Cancelled: {reason}".strip(" |")
    subscription.updatedAt = datetime.utcnow()
    session.add(subscription)

    # Log history
    from uuid import uuid4
    history = SubscriptionHistory(
        id=uuid4(),
        companyId=subscription.companyId,
        subscriptionId=subscription_id,
        actionType="CANCELLED",
        userId=current_user.id,
        notes=reason
    )
    session.add(history)
    session.commit()


# ============================================================================
# Subscription Lines
# ============================================================================

@router.get("/{subscription_id}/lines", response_model=List[SubscriptionLineResponse])
def list_subscription_lines(
    subscription_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List lines for a subscription"""
    lines = session.exec(
        select(SubscriptionLine)
        .where(SubscriptionLine.subscriptionId == subscription_id)
        .where(SubscriptionLine.isActive == True)
    ).all()
    return lines


@router.post("/{subscription_id}/lines", response_model=SubscriptionLineResponse, status_code=status.HTTP_201_CREATED)
def add_subscription_line(
    subscription_id: UUID,
    data: SubscriptionLineCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a line to a subscription"""
    subscription = session.exec(select(Subscription).where(Subscription.id == subscription_id)).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status == SubscriptionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot add lines to cancelled subscription")

    from uuid import uuid4
    from decimal import Decimal

    line = SubscriptionLine(
        id=uuid4(),
        companyId=subscription.companyId,
        subscriptionId=subscription_id,
        lineTotal=(data.unitPrice or Decimal("0")) * data.quantity,
        **data.model_dump()
    )
    session.add(line)
    session.commit()
    session.refresh(line)
    return line


@router.delete("/{subscription_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_subscription_line(
    subscription_id: UUID,
    line_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove a line from a subscription"""
    line = session.exec(
        select(SubscriptionLine)
        .where(SubscriptionLine.id == line_id)
        .where(SubscriptionLine.subscriptionId == subscription_id)
    ).first()

    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    line.isActive = False
    line.updatedAt = datetime.utcnow()
    session.add(line)
    session.commit()


# ============================================================================
# Pause/Resume
# ============================================================================

@router.post("/{subscription_id}/pause", response_model=SubscriptionResponse)
def pause_subscription(
    subscription_id: UUID,
    resume_date: Optional[date] = None,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Pause a subscription"""
    query = select(Subscription).where(Subscription.id == subscription_id)
    query = company_filter.apply_filter(query, Subscription.companyId)

    subscription = session.exec(query).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status != SubscriptionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only active subscriptions can be paused")

    subscription.status = SubscriptionStatus.PAUSED
    subscription.pausedAt = datetime.utcnow()
    if resume_date:
        subscription.pausedUntil = resume_date
    subscription.updatedAt = datetime.utcnow()
    session.add(subscription)

    # Log history
    from uuid import uuid4
    history = SubscriptionHistory(
        id=uuid4(),
        companyId=subscription.companyId,
        subscriptionId=subscription_id,
        actionType="PAUSED",
        userId=current_user.id,
        notes=reason
    )
    session.add(history)
    session.commit()
    session.refresh(subscription)
    return subscription


@router.post("/{subscription_id}/resume", response_model=SubscriptionResponse)
def resume_subscription(
    subscription_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Resume a paused subscription"""
    query = select(Subscription).where(Subscription.id == subscription_id)
    query = company_filter.apply_filter(query, Subscription.companyId)

    subscription = session.exec(query).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status != SubscriptionStatus.PAUSED:
        raise HTTPException(status_code=400, detail="Only paused subscriptions can be resumed")

    subscription.status = SubscriptionStatus.ACTIVE
    subscription.pausedAt = None
    subscription.pausedUntil = None
    subscription.updatedAt = datetime.utcnow()
    session.add(subscription)

    # Log history
    from uuid import uuid4
    history = SubscriptionHistory(
        id=uuid4(),
        companyId=subscription.companyId,
        subscriptionId=subscription_id,
        actionType="RESUMED",
        userId=current_user.id
    )
    session.add(history)
    session.commit()
    session.refresh(subscription)
    return subscription


# ============================================================================
# Activate
# ============================================================================

@router.post("/{subscription_id}/activate", response_model=SubscriptionResponse)
def activate_subscription(
    subscription_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Activate a pending subscription"""
    query = select(Subscription).where(Subscription.id == subscription_id)
    query = company_filter.apply_filter(query, Subscription.companyId)

    subscription = session.exec(query).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if subscription.status != SubscriptionStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft subscriptions can be activated")

    # Check if has lines
    lines_count = session.exec(
        select(func.count(SubscriptionLine.id))
        .where(SubscriptionLine.subscriptionId == subscription_id)
        .where(SubscriptionLine.isActive == True)
    ).one()

    if not lines_count:
        raise HTTPException(status_code=400, detail="Subscription has no active lines")

    subscription.status = SubscriptionStatus.ACTIVE
    subscription.updatedAt = datetime.utcnow()
    session.add(subscription)

    # Log history
    from uuid import uuid4
    history = SubscriptionHistory(
        id=uuid4(),
        companyId=subscription.companyId,
        subscriptionId=subscription_id,
        actionType="ACTIVATED",
        userId=current_user.id
    )
    session.add(history)
    session.commit()
    session.refresh(subscription)
    return subscription


# ============================================================================
# Generate Orders
# ============================================================================

@router.post("/generate-orders")
def generate_subscription_orders(
    target_date: Optional[date] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Generate orders for due subscriptions"""
    from uuid import uuid4

    if not target_date:
        target_date = date.today()

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Find active subscriptions with schedules due
    schedules = session.exec(
        select(SubscriptionSchedule)
        .where(SubscriptionSchedule.companyId == company_filter.company_id)
        .where(SubscriptionSchedule.scheduledDate <= target_date)
        .where(SubscriptionSchedule.status == ScheduleStatus.SCHEDULED)
    ).all()

    orders_created = 0
    errors = []

    for schedule in schedules:
        try:
            # Verify subscription is active
            subscription = session.exec(
                select(Subscription).where(Subscription.id == schedule.subscriptionId)
            ).first()

            if not subscription or subscription.status != SubscriptionStatus.ACTIVE:
                schedule.status = ScheduleStatus.SKIPPED
                session.add(schedule)
                continue

            # Create order (placeholder)
            order_id = uuid4()

            # Update schedule
            schedule.status = ScheduleStatus.GENERATED
            schedule.orderId = order_id
            schedule.generatedAt = datetime.utcnow()
            session.add(schedule)

            # Log history
            history = SubscriptionHistory(
                id=uuid4(),
                companyId=subscription.companyId,
                subscriptionId=subscription.id,
                actionType="ORDER_GENERATED",
                notes=f"Order generated for schedule {schedule.scheduledDate}",
                userId=current_user.id
            )
            session.add(history)

            orders_created += 1
        except Exception as e:
            errors.append(f"Schedule {schedule.id}: {str(e)}")

    session.commit()

    return {
        "success": True,
        "ordersCreated": orders_created,
        "schedulesProcessed": len(schedules),
        "errors": errors
    }


# ============================================================================
# Upcoming Deliveries
# ============================================================================

@router.get("/upcoming", response_model=List[SubscriptionScheduleResponse])
def get_upcoming_deliveries(
    days: int = Query(30, ge=1, le=90),
    customer_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get upcoming subscription deliveries"""
    from datetime import timedelta

    end_date = date.today() + timedelta(days=days)

    query = select(SubscriptionSchedule).where(
        SubscriptionSchedule.scheduledDate >= date.today(),
        SubscriptionSchedule.scheduledDate <= end_date,
        SubscriptionSchedule.status == ScheduleStatus.SCHEDULED
    )

    query = company_filter.apply_filter(query, SubscriptionSchedule.companyId)

    query = query.order_by(SubscriptionSchedule.scheduledDate)
    schedules = session.exec(query).all()
    return schedules


# ============================================================================
# History
# ============================================================================

@router.get("/{subscription_id}/history", response_model=List[SubscriptionHistoryResponse])
def get_subscription_history(
    subscription_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get subscription history"""
    history = session.exec(
        select(SubscriptionHistory)
        .where(SubscriptionHistory.subscriptionId == subscription_id)
        .order_by(SubscriptionHistory.createdAt.desc())
        .limit(limit)
    ).all()
    return history


# ============================================================================
# Summary
# ============================================================================

@router.get("/summary/stats")
def get_subscription_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get subscription statistics"""
    status_counts = {}
    for s in SubscriptionStatus:
        count = session.exec(
            select(func.count(Subscription.id))
            .where(Subscription.status == s)
            .where(Subscription.companyId == company_filter.company_id if company_filter.company_id else True)
        ).one()
        status_counts[s.value] = count

    frequency_counts = {}
    for f in SubscriptionFrequency:
        count = session.exec(
            select(func.count(Subscription.id))
            .where(Subscription.frequency == f)
            .where(Subscription.status == SubscriptionStatus.ACTIVE)
            .where(Subscription.companyId == company_filter.company_id if company_filter.company_id else True)
        ).one()
        frequency_counts[f.value] = count

    # Upcoming schedules count
    upcoming_count = session.exec(
        select(func.count(SubscriptionSchedule.id))
        .where(SubscriptionSchedule.scheduledDate >= date.today())
        .where(SubscriptionSchedule.status == ScheduleStatus.SCHEDULED)
        .where(SubscriptionSchedule.companyId == company_filter.company_id if company_filter.company_id else True)
    ).one()

    return {
        "byStatus": status_counts,
        "byFrequency": frequency_counts,
        "upcomingSchedules": upcoming_count
    }
