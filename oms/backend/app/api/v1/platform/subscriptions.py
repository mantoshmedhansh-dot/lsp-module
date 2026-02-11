"""
Subscriptions API - Tenant subscription management
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
