"""
Trial Management Service
Handles trial lifecycle: expiration warnings, automatic downgrades, and daily checks.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from sqlmodel import Session, select

from app.models.tenant_subscription import TenantSubscription
from app.models.plan import Plan
from app.models.company import Company

logger = logging.getLogger(__name__)


class TrialManager:
    """Manages trial subscription lifecycle for all tenants."""

    def __init__(self, session: Session):
        self.session = session

    def _get_email_service(self):
        """Lazy import to avoid circular dependencies at module load."""
        try:
            from app.services.email import email_service
            return email_service
        except Exception:
            return None

    async def check_expiring_trials(self) -> List[Dict[str, Any]]:
        """
        Find trials expiring in 3 days and send warning emails.

        Returns a list of dicts describing each warning sent.
        """
        now = datetime.now(timezone.utc)
        warn_window_start = now
        warn_window_end = now + timedelta(days=3)

        # Find trialing subscriptions that expire within 3 days
        subs = self.session.exec(
            select(TenantSubscription)
            .where(TenantSubscription.status == "trialing")
            .where(TenantSubscription.trialEndsAt >= warn_window_start)
            .where(TenantSubscription.trialEndsAt <= warn_window_end)
        ).all()

        email_svc = self._get_email_service()
        warnings: List[Dict[str, Any]] = []

        for sub in subs:
            company = self.session.get(Company, sub.companyId)
            if not company:
                continue

            days_left = max(0, (sub.trialEndsAt - now).days)

            if email_svc and company.email:
                email_svc.send_trial_expiring(
                    to=company.email,
                    company_name=company.name,
                    days_left=days_left,
                )

            warnings.append({
                "companyId": str(sub.companyId),
                "companyName": company.name,
                "trialEndsAt": sub.trialEndsAt.isoformat() if sub.trialEndsAt else None,
                "daysLeft": days_left,
                "emailSent": bool(email_svc and company.email),
            })
            logger.info(
                f"Trial expiring warning: company={company.name} "
                f"({sub.companyId}), days_left={days_left}"
            )

        return warnings

    async def expire_trials(self) -> List[Dict[str, Any]]:
        """
        Find expired trials and downgrade them to the free plan.

        Returns a list of dicts describing each expiration processed.
        """
        now = datetime.now(timezone.utc)

        # Find trialing subscriptions whose trial has already ended
        subs = self.session.exec(
            select(TenantSubscription)
            .where(TenantSubscription.status == "trialing")
            .where(TenantSubscription.trialEndsAt < now)
        ).all()

        # Look up the free plan once
        free_plan = self.session.exec(
            select(Plan).where(Plan.slug == "free").where(Plan.isActive == True)
        ).first()

        email_svc = self._get_email_service()
        expirations: List[Dict[str, Any]] = []

        for sub in subs:
            company = self.session.get(Company, sub.companyId)
            if not company:
                continue

            # Downgrade subscription
            if free_plan:
                sub.planId = free_plan.id
            sub.status = "expired"
            self.session.add(sub)

            # Update company status
            company.subscriptionStatus = "expired"
            self.session.add(company)

            # Send trial expired email
            if email_svc and company.email:
                email_svc.send(
                    to=company.email,
                    subject="Your CJDQuick trial has expired",
                    html=f"""
                    <h2>Trial Expired</h2>
                    <p>The trial for <strong>{company.name}</strong> has expired.</p>
                    <p>Your account has been moved to the Free plan with limited features.</p>
                    <p>Upgrade anytime to regain full access:</p>
                    <p><a href="https://oms-sable.vercel.app/settings/billing">Upgrade Plan</a></p>
                    <p>— The CJDQuick Team</p>
                    """,
                )

            expirations.append({
                "companyId": str(sub.companyId),
                "companyName": company.name,
                "trialEndsAt": sub.trialEndsAt.isoformat() if sub.trialEndsAt else None,
                "downgradedToFree": free_plan is not None,
                "emailSent": bool(email_svc and company.email),
            })
            logger.info(
                f"Trial expired: company={company.name} ({sub.companyId}), "
                f"downgraded_to_free={free_plan is not None}"
            )

        # Commit all changes in a single transaction
        if expirations:
            self.session.flush()

        return expirations

    async def run_daily_check(self) -> Dict[str, Any]:
        """
        Run both expiring warnings and actual expiration.

        Returns a summary of all actions taken.
        """
        warnings = await self.check_expiring_trials()
        expirations = await self.expire_trials()

        result = {
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "warnings": warnings,
            "warningCount": len(warnings),
            "expirations": expirations,
            "expirationCount": len(expirations),
        }

        logger.info(
            f"Daily trial check complete: "
            f"{len(warnings)} warnings, {len(expirations)} expirations"
        )

        return result
