"""
Audit logging utility — writes audit entries to AuditLog table.
Call log_audit() after successful CRUD operations.
"""
import logging
from typing import Optional
from uuid import UUID

from sqlmodel import Session

from app.models.system import AuditLog

logger = logging.getLogger("audit")


def log_audit(
    session: Session,
    *,
    entity_type: str,
    entity_id: UUID,
    action: str,
    user_id: Optional[UUID] = None,
    changes: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """
    Write an audit log entry. Silently fails if table doesn't exist.

    Usage:
        log_audit(session, entity_type="Company", entity_id=company.id,
                  action="CREATE", user_id=current_user.id)
    """
    try:
        entry = AuditLog(
            entityType=entity_type,
            entityId=entity_id,
            action=action,
            userId=user_id,
            changes=changes,
            ipAddress=ip_address,
        )
        session.add(entry)
        # Don't commit — let the caller's transaction handle it
    except Exception as e:
        logger.debug(f"Audit log write skipped: {e}")
