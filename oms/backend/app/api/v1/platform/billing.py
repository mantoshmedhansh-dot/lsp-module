"""
Billing API - Stripe integration and invoice management
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_roles
from app.models.billing_invoice import (
    BillingInvoice, BillingInvoiceResponse, BillingInvoiceCreate,
)
from app.models.tenant_subscription import TenantSubscription
from app.models.plan import Plan
from app.models.company import Company

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/invoices", response_model=List[BillingInvoiceResponse])
def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """List billing invoices for the current company."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    query = select(BillingInvoice).where(
        BillingInvoice.companyId == current_user.companyId
    ).order_by(BillingInvoice.createdAt.desc()).offset(skip).limit(limit)

    invoices = session.exec(query).all()
    return [BillingInvoiceResponse.model_validate(i) for i in invoices]


@router.post("/checkout", response_model=dict)
def create_checkout_session(
    plan_slug: str,
    billing_cycle: str = "monthly",
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Create a Stripe Checkout Session for plan subscription.
    Returns checkout URL for frontend redirect.
    """
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    plan = session.exec(
        select(Plan).where(Plan.slug == plan_slug).where(Plan.isActive == True)
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Get the appropriate Stripe price ID
    price_id = plan.stripePriceIdMonthly if billing_cycle == "monthly" else plan.stripePriceIdAnnual
    if not price_id:
        # Return mock response when Stripe is not configured
        return {
            "checkoutUrl": None,
            "message": "Stripe not configured. Plan changed locally.",
            "planSlug": plan_slug,
        }

    try:
        import stripe
        from app.core.config import settings

        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
        if not stripe.api_key:
            return {
                "checkoutUrl": None,
                "message": "Stripe not configured. Plan changed locally.",
                "planSlug": plan_slug,
            }

        company = session.get(Company, current_user.companyId)

        # Create or get Stripe customer
        if company and company.stripeCustomerId:
            customer_id = company.stripeCustomerId
        else:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=company.name if company else current_user.name,
                metadata={"company_id": str(current_user.companyId)},
            )
            customer_id = customer.id
            if company:
                company.stripeCustomerId = customer_id
                session.add(company)

        checkout = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/settings/billing?success=true",
            cancel_url=f"{settings.FRONTEND_URL}/settings/billing?cancelled=true",
            metadata={
                "company_id": str(current_user.companyId),
                "plan_slug": plan_slug,
            },
        )

        return {"checkoutUrl": checkout.url}

    except ImportError:
        return {
            "checkoutUrl": None,
            "message": "Stripe package not installed",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Billing error: {str(e)}")


@router.post("/portal", response_model=dict)
def create_portal_session(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    company = session.get(Company, current_user.companyId)
    if not company or not company.stripeCustomerId:
        return {"portalUrl": None, "message": "No billing account found"}

    try:
        import stripe
        from app.core.config import settings

        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
        if not stripe.api_key:
            return {"portalUrl": None, "message": "Stripe not configured"}

        portal = stripe.billing_portal.Session.create(
            customer=company.stripeCustomerId,
            return_url=f"{settings.FRONTEND_URL}/settings/billing",
        )
        return {"portalUrl": portal.url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portal error: {str(e)}")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    session: Session = Depends(get_session),
):
    """Handle Stripe webhook events."""
    try:
        import stripe
        from app.core.config import settings

        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
        webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)

        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        if webhook_secret and sig_header:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        else:
            import json
            event = json.loads(payload)

        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})

        if event_type == "checkout.session.completed":
            company_id = data.get("metadata", {}).get("company_id")
            plan_slug = data.get("metadata", {}).get("plan_slug")
            if company_id and plan_slug:
                plan = session.exec(
                    select(Plan).where(Plan.slug == plan_slug)
                ).first()
                if plan:
                    sub = session.exec(
                        select(TenantSubscription)
                        .where(TenantSubscription.companyId == company_id)
                    ).first()
                    if sub:
                        sub.planId = plan.id
                        sub.status = "active"
                        sub.stripeSubscriptionId = data.get("subscription")
                        session.add(sub)

                    company = session.get(Company, company_id)
                    if company:
                        company.subscriptionStatus = "active"
                        company.stripeCustomerId = data.get("customer")
                        session.add(company)

        elif event_type == "invoice.paid":
            customer_id = data.get("customer")
            if customer_id:
                company = session.exec(
                    select(Company).where(Company.stripeCustomerId == customer_id)
                ).first()
                if company:
                    invoice = BillingInvoice(
                        companyId=company.id,
                        invoiceNumber=data.get("number"),
                        amount=data.get("amount_paid", 0) / 100,
                        currency=data.get("currency", "inr").upper(),
                        status="paid",
                        stripeInvoiceId=data.get("id"),
                        invoiceUrl=data.get("hosted_invoice_url"),
                    )
                    session.add(invoice)

        elif event_type == "invoice.payment_failed":
            customer_id = data.get("customer")
            if customer_id:
                company = session.exec(
                    select(Company).where(Company.stripeCustomerId == customer_id)
                ).first()
                if company:
                    company.subscriptionStatus = "past_due"
                    session.add(company)

                    sub = session.exec(
                        select(TenantSubscription)
                        .where(TenantSubscription.companyId == company.id)
                        .where(TenantSubscription.status == "active")
                    ).first()
                    if sub:
                        sub.status = "past_due"
                        session.add(sub)

        elif event_type == "customer.subscription.deleted":
            customer_id = data.get("customer")
            if customer_id:
                company = session.exec(
                    select(Company).where(Company.stripeCustomerId == customer_id)
                ).first()
                if company:
                    company.subscriptionStatus = "cancelled"
                    session.add(company)

        return {"status": "ok"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
