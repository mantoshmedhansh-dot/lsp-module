"""
Email Notification Service
Supports Resend as provider. Falls back to logging if not configured.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import resend
try:
    import resend
    HAS_RESEND = True
except ImportError:
    HAS_RESEND = False


class EmailService:
    def __init__(self):
        from app.core.config import settings
        self.from_email = getattr(settings, "EMAIL_FROM", "noreply@cjdquick.com")
        self.api_key = getattr(settings, "RESEND_API_KEY", None)
        if self.api_key and HAS_RESEND:
            resend.api_key = self.api_key
            self.enabled = True
        else:
            self.enabled = False
            logger.info("Email service not configured — emails will be logged only")

    def send(self, to: str, subject: str, html: str) -> bool:
        if not self.enabled:
            logger.info(f"[EMAIL] To: {to} | Subject: {subject}")
            return True
        try:
            resend.Emails.send({
                "from": self.from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            })
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {e}")
            return False

    def send_welcome(self, to: str, company_name: str, user_name: str):
        self.send(
            to=to,
            subject=f"Welcome to CJDQuick OMS, {user_name}!",
            html=f"""
            <h2>Welcome to CJDQuick OMS!</h2>
            <p>Hi {user_name},</p>
            <p>Your account for <strong>{company_name}</strong> has been created successfully.</p>
            <p>You can now log in and start managing your orders, inventory, and logistics.</p>
            <p><a href="https://oms-sable.vercel.app/login">Log in to CJDQuick OMS</a></p>
            <p>— The CJDQuick Team</p>
            """,
        )

    def send_trial_expiring(self, to: str, company_name: str, days_left: int):
        self.send(
            to=to,
            subject=f"Your CJDQuick trial expires in {days_left} day{'s' if days_left != 1 else ''}",
            html=f"""
            <h2>Trial Expiring Soon</h2>
            <p>Your trial for <strong>{company_name}</strong> expires in {days_left} day{'s' if days_left != 1 else ''}.</p>
            <p>Upgrade now to keep access to all features:</p>
            <p><a href="https://oms-sable.vercel.app/settings/billing">Upgrade Plan</a></p>
            <p>— The CJDQuick Team</p>
            """,
        )

    def send_payment_receipt(self, to: str, company_name: str, amount: str, plan_name: str):
        self.send(
            to=to,
            subject=f"Payment received — {plan_name} plan",
            html=f"""
            <h2>Payment Confirmed</h2>
            <p>Hi,</p>
            <p>We received your payment of <strong>{amount}</strong> for the <strong>{plan_name}</strong> plan for {company_name}.</p>
            <p>Thank you for using CJDQuick OMS!</p>
            <p>— The CJDQuick Team</p>
            """,
        )

    def send_contract_expiring(self, to: str, brand_name: str, days_left: int):
        urgency = "Urgent: " if days_left <= 3 else ""
        self.send(
            to=to,
            subject=f"{urgency}Contract for {brand_name} expires in {days_left} day{'s' if days_left != 1 else ''}",
            html=f"""
            <h2>Contract Expiry Notice</h2>
            <p>The service contract for <strong>{brand_name}</strong> will expire in <strong>{days_left} day{'s' if days_left != 1 else ''}</strong>.</p>
            <p>Please review and renew the contract to avoid service interruption.</p>
            <p><a href="https://lsp-oms.vercel.app/settings/clients">Review Contracts</a></p>
            <p>— The CJDQuick Team</p>
            """,
        )

    def send_payment_failed(self, to: str, company_name: str):
        self.send(
            to=to,
            subject="Payment failed — action required",
            html=f"""
            <h2>Payment Failed</h2>
            <p>We were unable to process the payment for <strong>{company_name}</strong>.</p>
            <p>Please update your payment method to avoid service interruption:</p>
            <p><a href="https://oms-sable.vercel.app/settings/billing">Update Payment Method</a></p>
            <p>— The CJDQuick Team</p>
            """,
        )


# Singleton
email_service = EmailService()
