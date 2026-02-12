"""
Billing API - Stripe integration, webhooks, and invoice management
"""
import json
import logging
from datetime import datetime
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

# Try to import stripe — graceful degradation if not installed
try:
    import stripe
    HAS_STRIPE = True
except ImportError:
    HAS_STRIPE = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])


# ---------------------------------------------------------------------------
# Helper: get email service (lazy import to avoid circular deps at module load)
# ---------------------------------------------------------------------------
def _get_email_service():
    try:
        from app.services.email import email_service
        return email_service
    except Exception:
        return None


# ---------------------------------------------------------------------------
# GET /billing/invoices
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# POST /billing/checkout
# ---------------------------------------------------------------------------
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
        # Return mock response when Stripe price IDs are not configured on the plan
        return {
            "url": None,
            "checkoutUrl": None,
            "message": "Stripe not configured. Plan changed locally.",
            "planSlug": plan_slug,
        }

    if not HAS_STRIPE:
        return {
            "url": None,
            "checkoutUrl": None,
            "message": "Stripe package not installed",
        }

    from app.core.config import settings
    stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)
    if not stripe.api_key:
        return {
            "url": None,
            "checkoutUrl": None,
            "message": "Stripe not configured",
            "planSlug": plan_slug,
        }

    try:
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

        return {"url": checkout.url, "checkoutUrl": checkout.url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Billing error: {str(e)}")


# ---------------------------------------------------------------------------
# POST /billing/portal
# ---------------------------------------------------------------------------
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
        return {"url": None, "portalUrl": None, "message": "No billing account found"}

    if not HAS_STRIPE:
        return {"url": None, "portalUrl": None, "message": "Stripe package not installed"}

    from app.core.config import settings
    stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)
    if not stripe.api_key:
        return {"url": None, "portalUrl": None, "message": "Stripe not configured"}

    try:
        portal = stripe.billing_portal.Session.create(
            customer=company.stripeCustomerId,
            return_url=f"{settings.FRONTEND_URL}/settings/billing",
        )
        return {"url": portal.url, "portalUrl": portal.url}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portal error: {str(e)}")


# ---------------------------------------------------------------------------
# POST /billing/webhook  (Stripe Webhook Handler)
# ---------------------------------------------------------------------------
@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Handle Stripe webhook events.

    Supported events:
      - checkout.session.completed  -> activate subscription
      - invoice.paid               -> record invoice, set paidAt
      - invoice.payment_failed     -> mark subscription past_due
      - customer.subscription.deleted -> downgrade to free plan
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # -- Construct / parse event ------------------------------------------
    from app.core.config import settings
    webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)

    if HAS_STRIPE and webhook_secret and sig_header:
        try:
            stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except Exception as e:
            logger.warning(f"Stripe signature verification failed: {e}")
            return {"status": "error", "message": "Invalid signature"}
    else:
        # No webhook secret configured or stripe not installed — parse raw JSON
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return {"status": "error", "message": "Invalid JSON payload"}

    event_type = event.get("type", "") if isinstance(event, dict) else getattr(event, "type", "")
    data_obj = (
        event.get("data", {}).get("object", {})
        if isinstance(event, dict)
        else event.data.object if hasattr(event, "data") else {}
    )

    # Convert Stripe object to dict if needed
    if not isinstance(data_obj, dict):
        data_obj = dict(data_obj) if data_obj else {}

    email_svc = _get_email_service()

    # -- checkout.session.completed ----------------------------------------
    if event_type == "checkout.session.completed":
        metadata = data_obj.get("metadata", {}) or {}
        company_id = metadata.get("company_id")
        plan_slug = metadata.get("plan_slug")

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
                    sub.stripeSubscriptionId = data_obj.get("subscription")
                    session.add(sub)

                company = session.get(Company, company_id)
                if company:
                    company.subscriptionStatus = "active"
                    company.stripeCustomerId = data_obj.get("customer")
                    session.add(company)

        session.commit()
        logger.info(f"Webhook: checkout.session.completed for company {company_id}")

    # -- invoice.paid ------------------------------------------------------
    elif event_type == "invoice.paid":
        customer_id = data_obj.get("customer")
        if customer_id:
            company = session.exec(
                select(Company).where(Company.stripeCustomerId == customer_id)
            ).first()
            if company:
                invoice = BillingInvoice(
                    companyId=company.id,
                    invoiceNumber=data_obj.get("number"),
                    amount=data_obj.get("amount_paid", 0) / 100,
                    currency=(data_obj.get("currency") or "inr").upper(),
                    status="paid",
                    paidAt=datetime.utcnow(),
                    stripeInvoiceId=data_obj.get("id"),
                    invoiceUrl=data_obj.get("hosted_invoice_url"),
                )
                session.add(invoice)
                session.commit()

                # Send payment receipt email
                if email_svc and company.email:
                    amount_display = f"{invoice.currency} {invoice.amount}"
                    # Look up plan name from active subscription
                    sub = session.exec(
                        select(TenantSubscription)
                        .where(TenantSubscription.companyId == company.id)
                        .where(TenantSubscription.status == "active")
                    ).first()
                    plan_name = "your"
                    if sub:
                        plan = session.get(Plan, sub.planId)
                        if plan:
                            plan_name = plan.name
                    email_svc.send_payment_receipt(
                        to=company.email,
                        company_name=company.name,
                        amount=amount_display,
                        plan_name=plan_name,
                    )

        logger.info(f"Webhook: invoice.paid for customer {customer_id}")

    # -- invoice.payment_failed --------------------------------------------
    elif event_type == "invoice.payment_failed":
        customer_id = data_obj.get("customer")
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

                session.commit()

                # Send payment failed email
                if email_svc and company.email:
                    email_svc.send_payment_failed(
                        to=company.email,
                        company_name=company.name,
                    )

        logger.info(f"Webhook: invoice.payment_failed for customer {customer_id}")

    # -- customer.subscription.deleted  (downgrade to free plan) -----------
    elif event_type == "customer.subscription.deleted":
        customer_id = data_obj.get("customer")
        if customer_id:
            company = session.exec(
                select(Company).where(Company.stripeCustomerId == customer_id)
            ).first()
            if company:
                company.subscriptionStatus = "cancelled"
                session.add(company)

                # Downgrade to free plan
                free_plan = session.exec(
                    select(Plan).where(Plan.slug == "free").where(Plan.isActive == True)
                ).first()
                if free_plan:
                    sub = session.exec(
                        select(TenantSubscription)
                        .where(TenantSubscription.companyId == company.id)
                    ).first()
                    if sub:
                        sub.planId = free_plan.id
                        sub.status = "active"
                        sub.stripeSubscriptionId = None
                        sub.cancelledAt = datetime.utcnow()
                        session.add(sub)

                session.commit()

        logger.info(f"Webhook: customer.subscription.deleted for customer {customer_id}")

    else:
        logger.info(f"Webhook: unhandled event type {event_type}")

    return {"status": "ok"}
