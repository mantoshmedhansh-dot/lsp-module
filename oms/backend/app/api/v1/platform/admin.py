"""
Platform Admin API - SUPER_ADMIN tenant management and revenue dashboard
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from sqlalchemy import extract

from app.core.database import get_session
from app.core.deps import get_current_user, require_roles
from app.models.company import Company, CompanyResponse
from app.models.tenant_subscription import TenantSubscription
from app.models.plan import Plan
from app.models.billing_invoice import BillingInvoice
from app.models.tenant_subscription import SubscriptionUsage

router = APIRouter(prefix="/admin", tags=["Platform Admin"])


@router.get("/stats", response_model=dict)
def get_platform_stats(
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Get platform-wide stats: MRR, ARR, tenant counts, etc."""
    # Total tenants
    total_tenants = session.exec(
        select(func.count(Company.id))
    ).one() or 0

    # Active subscriptions
    active_subs = session.exec(
        select(func.count(TenantSubscription.id))
        .where(TenantSubscription.status.in_(["active", "trialing"]))
    ).one() or 0

    # Trialing
    trialing_count = session.exec(
        select(func.count(TenantSubscription.id))
        .where(TenantSubscription.status == "trialing")
    ).one() or 0

    # MRR calculation (sum of monthly prices for active subscriptions)
    active_plan_subs = session.exec(
        select(TenantSubscription, Plan)
        .join(Plan, TenantSubscription.planId == Plan.id)
        .where(TenantSubscription.status == "active")
    ).all()

    mrr = Decimal("0")
    for sub, plan in active_plan_subs:
        if sub.billingCycle == "annual":
            mrr += plan.annualPrice / 12
        else:
            mrr += plan.monthlyPrice

    # Revenue this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_this_month = session.exec(
        select(func.coalesce(func.sum(BillingInvoice.amount), 0))
        .where(BillingInvoice.status == "paid")
        .where(BillingInvoice.paidAt >= month_start)
    ).one() or 0

    # Plan distribution
    plan_dist = session.exec(
        select(Plan.name, func.count(TenantSubscription.id))
        .join(Plan, TenantSubscription.planId == Plan.id)
        .where(TenantSubscription.status.in_(["active", "trialing"]))
        .group_by(Plan.name)
    ).all()

    return {
        "totalTenants": total_tenants,
        "activeSubscriptions": active_subs,
        "trialingCount": trialing_count,
        "mrr": float(mrr),
        "arr": float(mrr * 12),
        "revenueThisMonth": float(revenue_this_month),
        "planDistribution": {name: count for name, count in plan_dist},
    }


@router.get("/tenants", response_model=List[dict])
def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """List all tenants with subscription info."""
    query = select(Company).order_by(Company.createdAt.desc())

    if status:
        query = query.where(Company.subscriptionStatus == status)
    if search:
        query = query.where(
            Company.name.ilike(f"%{search}%") | Company.code.ilike(f"%{search}%")
        )

    companies = session.exec(query.offset(skip).limit(limit)).all()

    result = []
    for company in companies:
        sub = session.exec(
            select(TenantSubscription)
            .where(TenantSubscription.companyId == company.id)
            .order_by(TenantSubscription.createdAt.desc())
        ).first()

        plan_name = None
        if sub:
            plan = session.get(Plan, sub.planId)
            plan_name = plan.name if plan else None

        result.append({
            "company": CompanyResponse.model_validate(company),
            "subscription": {
                "status": sub.status if sub else None,
                "planName": plan_name,
                "billingCycle": sub.billingCycle if sub else None,
                "trialEndsAt": sub.trialEndsAt.isoformat() if sub and sub.trialEndsAt else None,
            } if sub else None,
        })

    return result


@router.get("/tenants/{company_id}", response_model=dict)
def get_tenant_detail(
    company_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Get detailed tenant info including subscription, usage, and invoices."""
    company = session.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    sub = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == company_id)
        .order_by(TenantSubscription.createdAt.desc())
    ).first()

    plan = None
    if sub:
        plan = session.get(Plan, sub.planId)

    # Get usage
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    usage = session.exec(
        select(SubscriptionUsage)
        .where(SubscriptionUsage.companyId == company_id)
        .where(SubscriptionUsage.period == period)
    ).first()

    # Recent invoices
    invoices = session.exec(
        select(BillingInvoice)
        .where(BillingInvoice.companyId == company_id)
        .order_by(BillingInvoice.createdAt.desc())
        .limit(10)
    ).all()

    return {
        "company": CompanyResponse.model_validate(company),
        "subscription": sub.model_dump() if sub else None,
        "plan": plan.model_dump() if plan else None,
        "usage": usage.model_dump() if usage else None,
        "invoices": [i.model_dump() for i in invoices],
    }


@router.get("/revenue-trends", response_model=list)
def get_revenue_trends(
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Monthly revenue for last 12 months from BillingInvoice table."""
    now = datetime.now(timezone.utc)
    twelve_months_ago = now.replace(day=1) - timedelta(days=365)

    # Query paid invoices grouped by year-month
    rows = session.exec(
        select(
            extract("year", BillingInvoice.paidAt).label("yr"),
            extract("month", BillingInvoice.paidAt).label("mn"),
            func.coalesce(func.sum(BillingInvoice.amount), 0).label("revenue"),
            func.count(BillingInvoice.id).label("invoice_count"),
        )
        .where(BillingInvoice.status == "paid")
        .where(BillingInvoice.paidAt >= twelve_months_ago)
        .where(BillingInvoice.paidAt.isnot(None))
        .group_by(
            extract("year", BillingInvoice.paidAt),
            extract("month", BillingInvoice.paidAt),
        )
        .order_by(
            extract("year", BillingInvoice.paidAt),
            extract("month", BillingInvoice.paidAt),
        )
    ).all()

    # Build result with all 12 months (fill gaps with zero)
    result = []
    cursor = twelve_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Build lookup from query results
    lookup = {}
    for yr, mn, revenue, invoice_count in rows:
        key = f"{int(yr):04d}-{int(mn):02d}"
        lookup[key] = {"revenue": float(revenue), "invoiceCount": invoice_count}

    while cursor <= month_end:
        key = cursor.strftime("%Y-%m")
        entry = lookup.get(key, {"revenue": 0.0, "invoiceCount": 0})
        result.append({
            "month": key,
            "revenue": entry["revenue"],
            "invoiceCount": entry["invoiceCount"],
        })
        # Advance to next month
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    return result


@router.get("/growth-metrics", response_model=list)
def get_growth_metrics(
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Tenant growth metrics for last 12 months: new tenants, churned, net growth."""
    now = datetime.now(timezone.utc)
    twelve_months_ago = now.replace(day=1) - timedelta(days=365)

    # New tenants per month (Company.createdAt)
    new_rows = session.exec(
        select(
            extract("year", Company.createdAt).label("yr"),
            extract("month", Company.createdAt).label("mn"),
            func.count(Company.id).label("cnt"),
        )
        .where(Company.createdAt >= twelve_months_ago)
        .group_by(
            extract("year", Company.createdAt),
            extract("month", Company.createdAt),
        )
    ).all()

    new_lookup = {}
    for yr, mn, cnt in new_rows:
        key = f"{int(yr):04d}-{int(mn):02d}"
        new_lookup[key] = cnt

    # Churned tenants per month (TenantSubscription.cancelledAt)
    churned_rows = session.exec(
        select(
            extract("year", TenantSubscription.cancelledAt).label("yr"),
            extract("month", TenantSubscription.cancelledAt).label("mn"),
            func.count(TenantSubscription.id).label("cnt"),
        )
        .where(TenantSubscription.cancelledAt.isnot(None))
        .where(TenantSubscription.cancelledAt >= twelve_months_ago)
        .group_by(
            extract("year", TenantSubscription.cancelledAt),
            extract("month", TenantSubscription.cancelledAt),
        )
    ).all()

    churned_lookup = {}
    for yr, mn, cnt in churned_rows:
        key = f"{int(yr):04d}-{int(mn):02d}"
        churned_lookup[key] = cnt

    # Build result with all 12 months
    result = []
    cursor = twelve_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    while cursor <= month_end:
        key = cursor.strftime("%Y-%m")
        new_tenants = new_lookup.get(key, 0)
        churned = churned_lookup.get(key, 0)
        result.append({
            "month": key,
            "newTenants": new_tenants,
            "churned": churned,
            "netGrowth": new_tenants - churned,
        })
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    return result


@router.post("/tenants/{company_id}/suspend", response_model=dict)
def suspend_tenant(
    company_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Suspend a tenant - set subscription to cancelled, company status to suspended."""
    company = session.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if company.subscriptionStatus == "cancelled":
        raise HTTPException(status_code=400, detail="Tenant is already suspended")

    # Update company subscription status
    company.subscriptionStatus = "cancelled"
    company.updatedAt = datetime.now(timezone.utc)
    session.add(company)

    # Cancel the active subscription(s)
    active_subs = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == company_id)
        .where(TenantSubscription.status.in_(["active", "trialing"]))
    ).all()

    for sub in active_subs:
        sub.status = "cancelled"
        sub.cancelledAt = datetime.now(timezone.utc)
        sub.updatedAt = datetime.now(timezone.utc)
        session.add(sub)

    session.commit()
    session.refresh(company)

    return {
        "success": True,
        "message": f"Tenant '{company.name}' has been suspended",
        "companyId": str(company.id),
        "subscriptionStatus": company.subscriptionStatus,
    }


@router.post("/tenants/{company_id}/activate", response_model=dict)
def activate_tenant(
    company_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Reactivate a suspended tenant."""
    company = session.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if company.subscriptionStatus == "active":
        raise HTTPException(status_code=400, detail="Tenant is already active")

    # Update company subscription status
    company.subscriptionStatus = "active"
    company.updatedAt = datetime.now(timezone.utc)
    session.add(company)

    # Reactivate the most recent subscription
    latest_sub = session.exec(
        select(TenantSubscription)
        .where(TenantSubscription.companyId == company_id)
        .order_by(TenantSubscription.createdAt.desc())
    ).first()

    if latest_sub:
        latest_sub.status = "active"
        latest_sub.cancelledAt = None
        latest_sub.currentPeriodStart = datetime.now(timezone.utc)
        latest_sub.updatedAt = datetime.now(timezone.utc)
        session.add(latest_sub)

    session.commit()
    session.refresh(company)

    return {
        "success": True,
        "message": f"Tenant '{company.name}' has been reactivated",
        "companyId": str(company.id),
        "subscriptionStatus": company.subscriptionStatus,
    }
