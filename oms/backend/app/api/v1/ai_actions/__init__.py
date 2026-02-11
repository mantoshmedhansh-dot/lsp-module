"""
AI Actions API v1 - Global AI Action Log endpoints
"""
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, CompanyFilter
from app.models import (
    AIActionLog, AIActionLogResponse, User
)

router = APIRouter(prefix="/ai-actions", tags=["AI Actions"])


def safe_enum_value(value, default: str) -> str:
    """Safely extract enum value, handling both enum objects and strings."""
    if value is None:
        return default
    if hasattr(value, 'value'):
        return value.value
    return str(value)


@router.get("")
def list_ai_actions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    entityType: Optional[str] = None,
    actionType: Optional[str] = None,
    status: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all AI actions with pagination and filters."""
    skip = (page - 1) * limit

    # Build query
    query = select(AIActionLog)
    count_query = select(func.count(AIActionLog.id))

    query = company_filter.apply_filter(query, AIActionLog.companyId)
    count_query = company_filter.apply_filter(count_query, AIActionLog.companyId)
    if entityType:
        query = query.where(AIActionLog.entityType == entityType)
        count_query = count_query.where(AIActionLog.entityType == entityType)
    if actionType:
        query = query.where(AIActionLog.actionType == actionType)
        count_query = count_query.where(AIActionLog.actionType == actionType)
    if status:
        query = query.where(AIActionLog.status == status)
        count_query = count_query.where(AIActionLog.status == status)

    # Get total count
    total = session.exec(count_query).one()

    # Get paginated results
    actions = session.exec(
        query.offset(skip).limit(limit).order_by(AIActionLog.createdAt.desc())
    ).all()

    # Calculate stats
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's stats
    today_query = select(AIActionLog).where(AIActionLog.createdAt >= today_start)
    today_query = company_filter.apply_filter(today_query, AIActionLog.companyId)
    today_actions = session.exec(today_query).all()

    today_total = len(today_actions)
    today_successful = sum(1 for a in today_actions if safe_enum_value(a.status, "") == "SUCCESS")
    today_success_rate = (today_successful / today_total * 100) if today_total > 0 else 0

    # Aggregate stats
    all_query = select(AIActionLog)
    all_query = company_filter.apply_filter(all_query, AIActionLog.companyId)
    all_actions = session.exec(all_query).all()

    action_types = {}
    entity_types = {}
    statuses = {}
    total_confidence = 0
    confidence_count = 0
    total_processing_time = 0
    processing_count = 0

    for action in all_actions:
        # Action type counts
        action_type = safe_enum_value(action.actionType, "OTHER")
        action_types[action_type] = action_types.get(action_type, 0) + 1

        # Entity type counts
        entity_type = action.entityType or "Unknown"
        entity_types[entity_type] = entity_types.get(entity_type, 0) + 1

        # Status counts
        status_val = safe_enum_value(action.status, "PENDING")
        statuses[status_val] = statuses.get(status_val, 0) + 1

        # Average confidence
        if action.confidence is not None:
            total_confidence += action.confidence
            confidence_count += 1

        # Average processing time
        if action.processingTime is not None:
            total_processing_time += action.processingTime
            processing_count += 1

    avg_confidence = total_confidence / confidence_count if confidence_count > 0 else 0
    avg_processing_time = total_processing_time / processing_count if processing_count > 0 else 0

    # Format actions for response
    formatted_actions = []
    for a in actions:
        formatted_actions.append({
            "id": str(a.id),
            "entityType": a.entityType,
            "entityId": a.entityId,
            "actionType": safe_enum_value(a.actionType, "OTHER"),
            "actionDetails": a.actionDetails or {},
            "status": safe_enum_value(a.status, "PENDING"),
            "confidence": a.confidence,
            "processingTime": a.processingTime,
            "errorMessage": a.executionError,
            "createdAt": a.createdAt.isoformat() if a.createdAt else None,
            "ndr": None  # Could be populated if needed
        })

    return {
        "actions": formatted_actions,
        "total": total,
        "stats": {
            "actionTypes": action_types,
            "entityTypes": entity_types,
            "statuses": statuses,
            "averageConfidence": avg_confidence,
            "averageProcessingTime": avg_processing_time,
            "todayStats": {
                "total": today_total,
                "successful": today_successful,
                "successRate": today_success_rate
            }
        }
    }


@router.get("/stats")
def get_ai_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get AI action statistics."""
    query = select(AIActionLog)
    query = company_filter.apply_filter(query, AIActionLog.companyId)

    actions = session.exec(query).all()

    total = len(actions)
    successful = sum(1 for a in actions if safe_enum_value(a.status, "") == "SUCCESS")
    failed = sum(1 for a in actions if safe_enum_value(a.status, "") == "FAILED")
    pending = sum(1 for a in actions if safe_enum_value(a.status, "") in ["PENDING", "PENDING_APPROVAL"])

    return {
        "total": total,
        "successful": successful,
        "failed": failed,
        "pending": pending,
        "successRate": (successful / total * 100) if total > 0 else 0
    }


@router.get("/{action_id}", response_model=AIActionLogResponse)
def get_ai_action(
    action_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get AI action by ID."""
    action = session.get(AIActionLog, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="AI action not found")
    return AIActionLogResponse.model_validate(action)
