"""
NDR API v1 - Non-Delivery Report management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    NDR, NDRCreate, NDRUpdate, NDRResponse, NDRBrief,
    NDRListResponse, NDRListItem, NDROrderInfo, NDRDeliveryInfo,
    NDROutreach, NDROutreachCreate, NDROutreachUpdate, NDROutreachResponse,
    AIActionLog, AIActionLogCreate, AIActionLogUpdate, AIActionLogResponse,
    User, NDRStatus, NDRPriority, NDRReason, ResolutionType,
    OutreachChannel, OutreachStatus, AIActionType, AIActionStatus
)

router = APIRouter(prefix="/ndr", tags=["NDR"])


# ============================================================================
# NDR Endpoints
# ============================================================================

@router.get("")
def list_ndrs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List NDRs with pagination (minimal version for debugging)."""
    # Very simple implementation - just return count to verify endpoint works
    count = session.exec(select(func.count(NDR.id))).one()

    return {
        "ndrs": [],
        "total": count,
        "statusCounts": {},
        "priorityCounts": {},
        "reasonCounts": {},
        "avgResolutionHours": 0.0,
        "outreachSuccessRate": 0.0,
    }


@router.get("/count")
def count_ndrs(
    status: Optional[NDRStatus] = None,
    priority: Optional[NDRPriority] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of NDRs."""
    query = select(func.count(NDR.id))

    if company_filter.company_id:
        query = query.where(NDR.companyId == company_filter.company_id)
    if status:
        query = query.where(NDR.status == status)
    if priority:
        query = query.where(NDR.priority == priority)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/summary")
def get_ndr_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get NDR summary statistics."""
    base_query = select(NDR)
    if company_filter.company_id:
        base_query = base_query.where(NDR.companyId == company_filter.company_id)

    ndrs = session.exec(base_query).all()

    open_count = sum(1 for n in ndrs if n.status == NDRStatus.OPEN)
    resolved_count = sum(1 for n in ndrs if n.status == NDRStatus.RESOLVED)
    rto_count = sum(1 for n in ndrs if n.status == NDRStatus.RTO)

    by_reason = {}
    by_priority = {}
    for n in ndrs:
        by_reason[n.reason.value] = by_reason.get(n.reason.value, 0) + 1
        by_priority[n.priority.value] = by_priority.get(n.priority.value, 0) + 1

    return {
        "totalNDRs": len(ndrs),
        "openNDRs": open_count,
        "resolvedNDRs": resolved_count,
        "rtoNDRs": rto_count,
        "byReason": by_reason,
        "byPriority": by_priority
    }


@router.get("/{ndr_id}", response_model=NDRResponse)
def get_ndr(
    ndr_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get NDR by ID."""
    ndr = session.get(NDR, ndr_id)
    if not ndr:
        raise HTTPException(status_code=404, detail="NDR not found")
    return NDRResponse.model_validate(ndr)


@router.post("", response_model=NDRResponse, status_code=status.HTTP_201_CREATED)
def create_ndr(
    data: NDRCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new NDR."""
    ndr = NDR.model_validate(data)
    session.add(ndr)
    session.commit()
    session.refresh(ndr)
    return NDRResponse.model_validate(ndr)


@router.patch("/{ndr_id}", response_model=NDRResponse)
def update_ndr(
    ndr_id: UUID,
    data: NDRUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update NDR."""
    ndr = session.get(NDR, ndr_id)
    if not ndr:
        raise HTTPException(status_code=404, detail="NDR not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ndr, field, value)

    session.add(ndr)
    session.commit()
    session.refresh(ndr)
    return NDRResponse.model_validate(ndr)


@router.post("/{ndr_id}/resolve", response_model=NDRResponse)
def resolve_ndr(
    ndr_id: UUID,
    resolution_type: ResolutionType,
    resolution_notes: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Resolve an NDR."""
    ndr = session.get(NDR, ndr_id)
    if not ndr:
        raise HTTPException(status_code=404, detail="NDR not found")

    ndr.status = NDRStatus.RESOLVED
    ndr.resolutionType = resolution_type
    ndr.resolutionNotes = resolution_notes
    ndr.resolvedAt = datetime.utcnow()
    ndr.resolvedBy = str(current_user.id)

    session.add(ndr)
    session.commit()
    session.refresh(ndr)
    return NDRResponse.model_validate(ndr)


# ============================================================================
# NDR Outreach Endpoints
# ============================================================================

@router.get("/{ndr_id}/outreach", response_model=List[NDROutreachResponse])
def list_outreaches(
    ndr_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List outreach attempts for an NDR."""
    query = select(NDROutreach).where(NDROutreach.ndrId == ndr_id)
    outreaches = session.exec(query.order_by(NDROutreach.createdAt.desc())).all()
    return [NDROutreachResponse.model_validate(o) for o in outreaches]


@router.post("/{ndr_id}/outreach", response_model=NDROutreachResponse, status_code=status.HTTP_201_CREATED)
def create_outreach(
    ndr_id: UUID,
    data: NDROutreachCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create outreach attempt for an NDR."""
    ndr = session.get(NDR, ndr_id)
    if not ndr:
        raise HTTPException(status_code=404, detail="NDR not found")

    outreach_data = data.model_dump()
    outreach_data["ndrId"] = ndr_id
    outreach = NDROutreach.model_validate(outreach_data)

    session.add(outreach)
    session.commit()
    session.refresh(outreach)
    return NDROutreachResponse.model_validate(outreach)


@router.patch("/outreach/{outreach_id}", response_model=NDROutreachResponse)
def update_outreach(
    outreach_id: UUID,
    data: NDROutreachUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update outreach attempt."""
    outreach = session.get(NDROutreach, outreach_id)
    if not outreach:
        raise HTTPException(status_code=404, detail="Outreach not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(outreach, field, value)

    session.add(outreach)
    session.commit()
    session.refresh(outreach)
    return NDROutreachResponse.model_validate(outreach)


# ============================================================================
# AI Action Log Endpoints
# ============================================================================

@router.get("/{ndr_id}/ai-actions", response_model=List[AIActionLogResponse])
def list_ai_actions(
    ndr_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List AI actions for an NDR."""
    query = select(AIActionLog).where(AIActionLog.ndrId == ndr_id)
    actions = session.exec(query.order_by(AIActionLog.createdAt.desc())).all()
    return [AIActionLogResponse.model_validate(a) for a in actions]


@router.post("/ai-actions", response_model=AIActionLogResponse, status_code=status.HTTP_201_CREATED)
def create_ai_action(
    data: AIActionLogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create AI action log."""
    action = AIActionLog.model_validate(data)
    session.add(action)
    session.commit()
    session.refresh(action)
    return AIActionLogResponse.model_validate(action)


@router.patch("/ai-actions/{action_id}", response_model=AIActionLogResponse)
def update_ai_action(
    action_id: UUID,
    data: AIActionLogUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update AI action (approve/reject/execute)."""
    action = session.get(AIActionLog, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="AI action not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)

    session.add(action)
    session.commit()
    session.refresh(action)
    return AIActionLogResponse.model_validate(action)
