"""
Subscriptions API - Tenant subscription management
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_roles
from app.models.tenant_subscription import (
    TenantSubscription, TenantSubscriptionResponse,
    TenantSubscriptionCreate, TenantSubscriptionUpdate,
    ChangePlanRequest,
)
from app.models.plan import Plan, PlanModule, PlanLimit, PlanResponse, PlanModuleResponse, PlanLimitResponse
from app.models.company import Company

# Try to import stripe — graceful degradation if not installed
try:
    import stripe
    HAS_STRIPE = True
except ImportError:
    HAS_STRIPE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("/current", response_model=dict)
def get_current_subscription(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Get the current user's company subscription with plan details."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    sub = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == current_user.companyId)
        .order_by(TenantSubscription.createdAt.desc())
    ).first()

    if not sub:
        return {"subscription": None, "plan": None}

    plan = session.get(Plan, sub.planId)
    modules = session.exec(
        select(PlanModule).where(PlanModule.planId == sub.planId)
    ).all()
    limits = session.exec(
        select(PlanLimit).where(PlanLimit.planId == sub.planId)
    ).all()

    plan_resp = None
    if plan:
        plan_resp = PlanResponse.model_validate(plan)
        plan_resp.modules = [PlanModuleResponse.model_validate(m) for m in modules]
        plan_resp.limits = [PlanLimitResponse.model_validate(l) for l in limits]

    return {
        "subscription": TenantSubscriptionResponse.model_validate(sub),
        "plan": plan_resp,
    }


@router.post("/change-plan", response_model=TenantSubscriptionResponse)
def change_plan(
    data: ChangePlanRequest,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Change the current subscription plan."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    # Only ADMIN/SUPER_ADMIN can change plans
    if current_user.role not in ("SUPER_ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only admins can change plans")

    # Find the target plan
    new_plan = session.exec(
        select(Plan).where(Plan.slug == data.planSlug).where(Plan.isActive == True)
    ).first()
    if not new_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Get or create subscription
    sub = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == current_user.companyId)
        .order_by(TenantSubscription.createdAt.desc())
    ).first()

    now = datetime.now(timezone.utc)

    if sub:
        sub.planId = new_plan.id
        sub.billingCycle = data.billingCycle
        if sub.status == "trialing":
            sub.status = "trialing"
        else:
            sub.status = "active"
        session.add(sub)
    else:
        sub = TenantSubscription(
            companyId=current_user.companyId,
            planId=new_plan.id,
            status="active",
            billingCycle=data.billingCycle,
            currentPeriodStart=now,
            currentPeriodEnd=now + timedelta(days=30 if data.billingCycle == "monthly" else 365),
        )
        session.add(sub)

    # Update company subscription status
    company = session.get(Company, current_user.companyId)
    if company:
        company.subscriptionStatus = sub.status
        session.add(company)

    session.flush()
    return TenantSubscriptionResponse.model_validate(sub)


@router.get("/{subscription_id}", response_model=TenantSubscriptionResponse)
def get_subscription(
    subscription_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Get a specific subscription."""
    sub = session.get(TenantSubscription, subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # Non-super-admins can only see their own
    if current_user.role != "SUPER_ADMIN" and sub.companyId != current_user.companyId:
        raise HTTPException(status_code=403, detail="Access denied")

    return TenantSubscriptionResponse.model_validate(sub)


# ---------------------------------------------------------------------------
# POST /subscriptions/cancel
# ---------------------------------------------------------------------------
@router.post("/cancel", response_model=TenantSubscriptionResponse)
def cancel_subscription(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Cancel the current subscription.

    - Sets subscription status to 'cancelled' and records cancelledAt.
    - If a Stripe subscription exists, cancels it via Stripe API.
    - Downgrades the company to the free plan.
    """
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    # Only ADMIN/SUPER_ADMIN can cancel
    if current_user.role not in ("SUPER_ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only admins can cancel subscriptions")

    # Get the current subscription
    sub = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == current_user.companyId)
        .order_by(TenantSubscription.createdAt.desc())
    ).first()

    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")

    if sub.status == "cancelled":
        raise HTTPException(status_code=400, detail="Subscription is already cancelled")

    now = datetime.now(timezone.utc)

    # Cancel on Stripe if a Stripe subscription exists
    if sub.stripeSubscriptionId and HAS_STRIPE:
        try:
            from app.core.config import settings
            stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)
            if stripe.api_key:
                stripe.Subscription.delete(sub.stripeSubscriptionId)
                logger.info(
                    f"Stripe subscription {sub.stripeSubscriptionId} cancelled "
                    f"for company {current_user.companyId}"
                )
        except Exception as e:
            logger.error(f"Failed to cancel Stripe subscription: {e}")
            # Continue with local cancellation even if Stripe fails

    # Find the free plan for downgrade
    free_plan = session.exec(
        select(Plan).where(Plan.slug == "free").where(Plan.isActive == True)
    ).first()

    # Update the subscription
    sub.status = "cancelled"
    sub.cancelledAt = now
    sub.stripeSubscriptionId = None
    if free_plan:
        sub.planId = free_plan.id
    session.add(sub)

    # Update company subscription status
    company = session.get(Company, current_user.companyId)
    if company:
        company.subscriptionStatus = "cancelled"
        session.add(company)

    session.flush()

    logger.info(f"Subscription cancelled for company {current_user.companyId}")
    return TenantSubscriptionResponse.model_validate(sub)


# ---------------------------------------------------------------------------
# GET /subscriptions/history
# ---------------------------------------------------------------------------
@router.get("/history", response_model=List[TenantSubscriptionResponse])
def get_subscription_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Get subscription change history for the current company.

    Returns all TenantSubscription records ordered by createdAt descending.
    SUPER_ADMIN can optionally pass company_id query param to view any company.
    """
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    query = (
        select(TenantSubscription)
        .where(TenantSubscription.companyId == current_user.companyId)
        .order_by(TenantSubscription.createdAt.desc())
        .offset(skip)
        .limit(limit)
    )

    subs = session.exec(query).all()
    return [TenantSubscriptionResponse.model_validate(s) for s in subs]


# ---------------------------------------------------------------------------
# POST /subscriptions/trial/check  (SUPER_ADMIN only)
# ---------------------------------------------------------------------------
@router.post("/trial/check", response_model=dict)
async def run_trial_check(
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Manually trigger trial expiration checks.

    Requires SUPER_ADMIN role. Runs both:
    - Trial expiring warnings (trials ending within 3 days)
    - Trial expiration + downgrade (trials already past due)
    """
    from app.services.trial_manager import TrialManager

    manager = TrialManager(session)
    results = await manager.run_daily_check()
    return results
