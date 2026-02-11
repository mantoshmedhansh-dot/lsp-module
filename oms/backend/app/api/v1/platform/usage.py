"""
Usage API - Subscription usage tracking
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.tenant_subscription import (
    SubscriptionUsage, SubscriptionUsageResponse,
    TenantSubscription,
)
from app.models.plan import PlanLimit
from app.models.company import Company
from app.models.order import Order
from app.models.sku import SKU
from app.models.user import User
from app.models.company import Location

router = APIRouter(prefix="/usage", tags=["Usage"])


def _current_period() -> str:
    """Get current period string YYYY-MM."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _get_or_create_usage(session: Session, company_id: UUID) -> SubscriptionUsage:
    """Get or create usage record for current period."""
    period = _current_period()
    usage = session.exec(
        select(SubscriptionUsage)
        .where(SubscriptionUsage.companyId == company_id)
        .where(SubscriptionUsage.period == period)
    ).first()

    if not usage:
        usage = SubscriptionUsage(
            companyId=company_id,
            period=period,
        )
        session.add(usage)
        session.flush()

    return usage


@router.get("/current", response_model=dict)
def get_current_usage(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Get current month usage with limits for the user's company."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    company_id = current_user.companyId
    usage = _get_or_create_usage(session, company_id)

    # Get actual counts from DB for accuracy
    orders_count = session.exec(
        select(func.count(Order.id))
        .where(Order.companyId == company_id)
        .where(Order.createdAt >= datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0))
    ).one() or 0

    skus_count = session.exec(
        select(func.count(SKU.id)).where(SKU.companyId == company_id)
    ).one() or 0

    users_count = session.exec(
        select(func.count(User.id)).where(User.companyId == company_id).where(User.isActive == True)
    ).one() or 0

    locations_count = session.exec(
        select(func.count(Location.id)).where(Location.companyId == company_id).where(Location.isActive == True)
    ).one() or 0

    # Update usage record
    usage.ordersCount = orders_count
    usage.skusCount = skus_count
    usage.usersCount = users_count
    usage.locationsCount = locations_count
    session.add(usage)

    # Get plan limits
    sub = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == company_id)
        .where(TenantSubscription.status.in_(["active", "trialing"]))
        .order_by(TenantSubscription.createdAt.desc())
    ).first()

    limits = {}
    if sub:
        plan_limits = session.exec(
            select(PlanLimit).where(PlanLimit.planId == sub.planId)
        ).all()
        limits = {l.limitKey: l.limitValue for l in plan_limits}

    return {
        "usage": SubscriptionUsageResponse.model_validate(usage),
        "limits": limits,
        "period": _current_period(),
    }


@router.get("/{company_id}", response_model=dict)
def get_company_usage(
    company_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Get usage for a specific company (SUPER_ADMIN or own company)."""
    if current_user.role != "SUPER_ADMIN" and current_user.companyId != company_id:
        raise HTTPException(status_code=403, detail="Access denied")

    usage = _get_or_create_usage(session, company_id)
    return {
        "usage": SubscriptionUsageResponse.model_validate(usage),
        "period": _current_period(),
    }
