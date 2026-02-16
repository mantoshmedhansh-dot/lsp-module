"""
NotificationService — Multi-channel notifications with template resolution.

Supports EMAIL, SMS, WHATSAPP channels.
Creates ProactiveCommunication audit trail for all notifications.
SMS and WhatsApp are placeholder implementations (log + audit) until
third-party providers are integrated.
"""
import logging
import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlmodel import Session, select

logger = logging.getLogger("notification_service")


class NotificationService:
    def __init__(self, session: Session):
        self.session = session

    def send_notification(
        self,
        trigger: str,
        recipient: str,
        company_id: UUID,
        channel: str = "EMAIL",
        variables: Optional[dict] = None,
        order_id: Optional[UUID] = None,
        delivery_id: Optional[UUID] = None,
    ) -> bool:
        """
        Send a notification via the specified channel.

        1. Lookup CommunicationTemplate by (trigger, channel, companyId)
        2. Render template with {{variable}} substitution
        3. Create ProactiveCommunication audit record
        4. Dispatch via channel
        """
        from app.models.communications import CommunicationTemplate, ProactiveCommunication

        variables = variables or {}

        # Look up template
        template = self.session.exec(
            select(CommunicationTemplate).where(
                CommunicationTemplate.trigger == trigger,
                CommunicationTemplate.channel == channel,
                CommunicationTemplate.companyId == company_id,
                CommunicationTemplate.isActive == True,
            )
        ).first()

        # Fallback to global template
        if not template:
            template = self.session.exec(
                select(CommunicationTemplate).where(
                    CommunicationTemplate.trigger == trigger,
                    CommunicationTemplate.channel == channel,
                    CommunicationTemplate.isGlobal == True,
                    CommunicationTemplate.isActive == True,
                )
            ).first()

        if template:
            subject = self._render(template.subject or "", variables)
            body = self._render(template.body or "", variables)
        else:
            # Fallback: generate basic message
            subject = f"CJDQuick Notification: {trigger}"
            body = f"Event: {trigger}\n" + "\n".join(
                f"{k}: {v}" for k, v in variables.items()
            )

        # Create audit record
        comm = ProactiveCommunication(
            companyId=company_id,
            orderId=order_id,
            deliveryId=delivery_id,
            trigger=trigger,
            channel=channel,
            recipient=recipient,
            subject=subject,
            body=body,
            status="PENDING",
            sentAt=datetime.utcnow(),
        )
        self.session.add(comm)
        self.session.flush()

        # Dispatch via channel
        success = False
        try:
            if channel == "EMAIL":
                success = self._send_email(recipient, subject, body)
            elif channel == "SMS":
                success = self._send_sms(recipient, body)
            elif channel == "WHATSAPP":
                success = self._send_whatsapp(recipient, body)
            else:
                logger.warning(f"Unknown channel: {channel}")
        except Exception as e:
            logger.error(f"Notification send failed ({channel}): {e}")

        comm.status = "SENT" if success else "FAILED"
        self.session.add(comm)

        return success

    def _render(self, template: str, variables: dict) -> str:
        """Render {{variable}} placeholders in template."""
        def replace_var(match):
            key = match.group(1).strip()
            return str(variables.get(key, match.group(0)))
        return re.sub(r"\{\{(\w+)\}\}", replace_var, template)

    def _send_email(self, to: str, subject: str, html: str) -> bool:
        """Send via Resend email service."""
        from app.services.email import email_service
        return email_service.send(to=to, subject=subject, html=html)

    def _send_sms(self, to: str, body: str) -> bool:
        """Placeholder: log SMS. Integrate Twilio/MSG91 later."""
        logger.info(f"[SMS] To: {to} | Message: {body[:100]}...")
        return True

    def _send_whatsapp(self, to: str, body: str) -> bool:
        """Placeholder: log WhatsApp. Integrate Gupshup/Twilio later."""
        logger.info(f"[WHATSAPP] To: {to} | Message: {body[:100]}...")
        return True
