"""
SaaS Lifecycle Handlers (Batch 5)

T28: subscription.created → enable plan modules, create usage records
T29: subscription.expiring → send warning emails at 7, 3, 1 days
T30: subscription.expired → auto-downgrade to FREE plan
T31: onboarding.step_completed → update progress, complete onboarding

Batch 6 additions:
T32: exception.created → alert admin users
T33: exception.created → flag SLA breach on order
T34: exception.created → proactive customer notification
"""
import logging
from datetime import datetime
from uuid import UUID

from sqlmodel import Session, select, func

from app.services.event_dispatcher import on

logger = logging.getLogger("event_handlers.saas_lifecycle")


# ── T28: subscription.created → enable modules ──────────────────────────

@on("subscription.created")
def handle_subscription_created(payload: dict, session: Session):
    """Enable plan modules for company. Create initial usage records."""
    from app.models.tenant_subscription import TenantSubscription
    from app.models.plan import Plan, PlanModule, PlanLimit
    from app.models.subscription import SubscriptionUsage
    from app.models.feature_flag import FeatureFlag

    company_id = UUID(payload["companyId"])
    subscription_id = UUID(payload["subscriptionId"])
    plan_id = UUID(payload["planId"])

    # Get plan modules
    modules = session.exec(
        select(PlanModule.module).where(PlanModule.planId == plan_id)
    ).all()

    # Create/update feature flags for each module
    for module in modules:
        existing = session.exec(
            select(FeatureFlag).where(
                FeatureFlag.companyId == company_id,
                FeatureFlag.feature == module,
            )
        ).first()

        if existing:
            existing.enabled = True
            existing.updatedAt = datetime.utcnow()
            session.add(existing)
        else:
            flag = FeatureFlag(
                companyId=company_id,
                feature=module,
                enabled=True,
            )
            session.add(flag)

    # Create initial usage records
    limits = session.exec(
        select(PlanLimit).where(PlanLimit.planId == plan_id)
    ).all()

    for limit in limits:
        existing_usage = session.exec(
            select(SubscriptionUsage).where(
                SubscriptionUsage.companyId == company_id,
                SubscriptionUsage.limitKey == limit.limitKey,
            )
        ).first()

        if not existing_usage:
            usage = SubscriptionUsage(
                companyId=company_id,
                subscriptionId=subscription_id,
                limitKey=limit.limitKey,
                currentUsage=0,
                maxAllowed=limit.limitValue,
            )
            session.add(usage)

    logger.info(f"Subscription created for company {company_id}: {len(modules)} modules enabled")


# ── T29: subscription.expiring → send warning emails ────────────────────

@on("subscription.expiring")
def handle_subscription_expiring(payload: dict, session: Session):
    """Send warning email at 7, 3, 1 day before expiry."""
    from app.models.user import User
    from app.models.company import Company

    company_id = UUID(payload["companyId"])
    days_left = int(payload.get("daysLeft", 0))

    company = session.get(Company, company_id)
    if not company:
        return

    admins = session.exec(
        select(User).where(
            User.companyId == company_id,
            User.role.in_(["ADMIN", "SUPER_ADMIN"]),
            User.isActive == True,
        )
    ).all()

    from app.services.email import email_service
    for admin in admins:
        email_service.send_trial_expiring(
            to=admin.email,
            company_name=company.name,
            days_left=days_left,
        )

    logger.info(f"Subscription expiry warning sent to {len(admins)} admins ({days_left} days left)")


# ── T30: subscription.expired → auto-downgrade ──────────────────────────

@on("subscription.expired")
def handle_subscription_expired(payload: dict, session: Session):
    """Auto-downgrade to FREE plan. Disable premium features."""
    from app.models.tenant_subscription import TenantSubscription
    from app.models.plan import Plan, PlanModule
    from app.models.feature_flag import FeatureFlag

    company_id = UUID(payload["companyId"])
    subscription_id = UUID(payload["subscriptionId"])

    # Find FREE plan
    free_plan = session.exec(
        select(Plan).where(Plan.slug == "free")
    ).first()

    if not free_plan:
        logger.warning("No FREE plan found, cannot auto-downgrade")
        return

    # Update subscription
    sub = session.get(TenantSubscription, subscription_id)
    if sub:
        sub.status = "expired"
        sub.updatedAt = datetime.utcnow()
        session.add(sub)

    # Get free plan modules
    free_modules = set(session.exec(
        select(PlanModule.module).where(PlanModule.planId == free_plan.id)
    ).all())

    # Disable non-free modules
    all_flags = session.exec(
        select(FeatureFlag).where(FeatureFlag.companyId == company_id)
    ).all()

    for flag in all_flags:
        if flag.feature not in free_modules:
            flag.enabled = False
            flag.updatedAt = datetime.utcnow()
            session.add(flag)

    logger.info(f"Company {company_id} auto-downgraded to FREE plan")

    # Send notification
    from app.models.user import User
    from app.models.company import Company
    company = session.get(Company, company_id)
    admins = session.exec(
        select(User).where(
            User.companyId == company_id,
            User.role.in_(["ADMIN", "SUPER_ADMIN"]),
            User.isActive == True,
        )
    ).all()

    from app.services.email import email_service
    for admin in admins:
        email_service.send(
            to=admin.email,
            subject="Your CJDQuick subscription has expired",
            html=f"""
            <h2>Subscription Expired</h2>
            <p>The subscription for <strong>{company.name if company else 'your company'}</strong> has expired.</p>
            <p>Your account has been downgraded to the Free plan. Some features may no longer be available.</p>
            <p><a href="https://lsp-oms.vercel.app/settings/billing">Upgrade Now</a></p>
            """,
        )


# ── T31: onboarding.step_completed → update progress ────────────────────

@on("onboarding.step_completed")
def handle_onboarding_progress(payload: dict, session: Session):
    """Update OnboardingStep status. If all done, complete onboarding."""
    from app.models.onboarding import OnboardingStep, OnboardingProgress

    company_id = UUID(payload["companyId"])
    step_key = payload.get("stepKey", "")

    # Update specific step
    step = session.exec(
        select(OnboardingStep).where(
            OnboardingStep.companyId == company_id,
            OnboardingStep.stepKey == step_key,
        )
    ).first()

    if step:
        step.completed = True
        step.completedAt = datetime.utcnow()
        session.add(step)

    # Check if all steps are done
    total_steps = session.exec(
        select(func.count(OnboardingStep.id)).where(
            OnboardingStep.companyId == company_id,
        )
    ).one()

    completed_steps = session.exec(
        select(func.count(OnboardingStep.id)).where(
            OnboardingStep.companyId == company_id,
            OnboardingStep.completed == True,
        )
    ).one()

    if total_steps > 0 and completed_steps >= total_steps:
        # Mark onboarding complete
        progress = session.exec(
            select(OnboardingProgress).where(
                OnboardingProgress.companyId == company_id,
            )
        ).first()

        if progress:
            progress.completed = True
            progress.completedAt = datetime.utcnow()
            session.add(progress)

        # Send welcome email
        from app.models.user import User
        from app.models.company import Company
        company = session.get(Company, company_id)
        admin = session.exec(
            select(User).where(
                User.companyId == company_id,
                User.role.in_(["ADMIN", "SUPER_ADMIN"]),
                User.isActive == True,
            )
        ).first()

        if admin and company:
            from app.services.email import email_service
            email_service.send_welcome(
                to=admin.email,
                company_name=company.name,
                user_name=admin.name or admin.email,
            )

        logger.info(f"Onboarding completed for company {company_id}")


# ── T32: exception.created → alert admin users ──────────────────────────

@on("exception.created")
def handle_exception_alert(payload: dict, session: Session):
    """Alert admin users about new exception via email."""
    from app.models.user import User

    company_id = payload.get("companyId")
    if not company_id:
        return

    exception_type = payload.get("exceptionType", "")
    severity = payload.get("severity", "MEDIUM")
    entity_id = payload.get("entityId", "")
    title = payload.get("title", "")

    admins = session.exec(
        select(User).where(
            User.companyId == UUID(company_id),
            User.role.in_(["ADMIN", "SUPER_ADMIN"]),
            User.isActive == True,
        )
    ).all()

    if not admins:
        return

    from app.services.notification_service import NotificationService
    notifier = NotificationService(session)

    for admin in admins:
        notifier.send_notification(
            trigger="EXCEPTION_ALERT",
            recipient=admin.email,
            company_id=UUID(company_id),
            channel="EMAIL",
            variables={
                "exceptionType": exception_type,
                "severity": severity,
                "entityId": entity_id,
                "title": title,
            },
        )

    logger.info(f"Exception alert sent to {len(admins)} admin(s): {exception_type}")


# ── T33: exception.created → flag SLA breach on order ────────────────────

@on("exception.created")
def handle_sla_breach_flag(payload: dict, session: Session):
    """If exception is SLA_BREACH, flag the order and escalate priority."""
    from app.models import Order

    exception_type = payload.get("exceptionType", "")
    if exception_type != "SLA_BREACH":
        return

    order_id = payload.get("orderId")
    if not order_id:
        return

    order = session.get(Order, UUID(order_id))
    if not order:
        return

    # Escalate priority
    order.priority = max((order.priority or 0), 2)  # Ensure high priority
    order.updatedAt = datetime.utcnow()
    session.add(order)

    logger.info(f"SLA breach flagged on order {order.orderNo}, priority escalated")


# ── T34: exception.created → proactive customer notification ────────────

@on("exception.created")
def handle_proactive_comm(payload: dict, session: Session):
    """For customer-facing exceptions (delivery delay), notify customer."""
    from app.models import Order

    exception_type = payload.get("exceptionType", "")
    customer_facing_types = {"CARRIER_DELAY", "SLA_BREACH"}

    if exception_type not in customer_facing_types:
        return

    order_id = payload.get("orderId")
    company_id = payload.get("companyId")
    if not order_id or not company_id:
        return

    order = session.get(Order, UUID(order_id))
    if not order or not order.customerPhone:
        return

    from app.services.notification_service import NotificationService
    notifier = NotificationService(session)

    notifier.send_notification(
        trigger="DELIVERY_DELAY",
        recipient=order.customerPhone,
        company_id=UUID(company_id),
        channel="WHATSAPP",
        variables={
            "orderNo": order.orderNo,
            "customerName": order.customerName or "",
            "exceptionType": exception_type,
        },
        order_id=order.id,
    )

    logger.info(f"Proactive delay notification sent for order {order.orderNo}")
