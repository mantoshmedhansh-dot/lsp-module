"""
Audit logging utility — writes audit entries to AuditLog table.
Call log_audit() after successful CRUD operations.

Uses a SEPARATE database session so audit failures NEVER break the
main transaction. This is critical because the AuditLog table schema
might not match the model (e.g. missing columns), and we must never
let audit logging roll back real business operations.
"""
import logging
from typing import Optional
from uuid import UUID

from sqlmodel import Session as SQLSession

logger = logging.getLogger("audit")


def log_audit(
    session,  # Accept but don't use the caller's session
    *,
    entity_type: str,
    entity_id: UUID,
    action: str,
    user_id: Optional[UUID] = None,
    changes: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """
    Write an audit log entry in an isolated session.
    If audit logging fails for ANY reason, it is silently skipped
    and the caller's transaction is completely unaffected.

    Usage:
        log_audit(session, entity_type="Company", entity_id=company.id,
                  action="CREATE", user_id=current_user.id)
    """
    try:
        from app.core.database import engine
        from app.models.system import AuditLog

        with SQLSession(engine) as audit_session:
            entry = AuditLog(
                entityType=entity_type,
                entityId=entity_id,
                action=action,
                userId=user_id,
                changes=changes,
                ipAddress=ip_address,
            )
            audit_session.add(entry)
            audit_session.commit()
    except Exception as e:
        logger.warning(f"Audit log write failed (non-fatal): {e}")
