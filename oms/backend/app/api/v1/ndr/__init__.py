"""
NDR API v1 - Non-Delivery Report management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func
from sqlalchemy import extract

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    NDR, NDRCreate, NDRUpdate, NDRResponse, NDRBrief,
    NDRListResponse, NDRListItem, NDROrderInfo, NDRDeliveryInfo,
    NDROutreach, NDROutreachCreate, NDROutreachUpdate, NDROutreachResponse,
    AIActionLog, AIActionLogCreate, AIActionLogUpdate, AIActionLogResponse,
    User, NDRStatus, NDRPriority, NDRReason, ResolutionType,
    OutreachChannel, OutreachStatus, AIActionType, AIActionStatus,
    Order, Delivery
)

router = APIRouter(prefix="/ndr", tags=["NDR"])


def safe_enum_value(value, default: str) -> str:
    """Safely extract enum value, handling both enum objects and strings."""
    if value is None:
        return default
    if hasattr(value, 'value'):
        return value.value
    return str(value)


# ============================================================================
# NDR Endpoints
# ============================================================================

@router.get("")
def list_ndrs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    ndr_status: Optional[NDRStatus] = Query(None, alias="status"),
    priority: Optional[NDRPriority] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List NDRs with pagination, filters, and real statistics."""
    actual_skip = skip if skip > 0 else (page - 1) * limit

    # Build filter query
    base_query = select(NDR)
    base_query = company_filter.apply_filter(base_query, NDR.companyId)
    if ndr_status:
        base_query = base_query.where(NDR.status == ndr_status)
    if priority:
        base_query = base_query.where(NDR.priority == priority)

    # Get total count - build separate count query with same conditions
    count_query = select(func.count(NDR.id))
    count_query = company_filter.apply_filter(count_query, NDR.companyId)
    if ndr_status:
        count_query = count_query.where(NDR.status == ndr_status)
    if priority:
        count_query = count_query.where(NDR.priority == priority)
    count = session.exec(count_query).one()

    # Get paginated results
    ndrs = session.exec(
        base_query.offset(actual_skip).limit(limit).order_by(NDR.createdAt.desc())
    ).all()

    # Collect all order IDs and delivery IDs for batch fetching
    order_ids = [n.orderId for n in ndrs if n.orderId]
    delivery_ids = [n.deliveryId for n in ndrs if n.deliveryId]
    ndr_ids = [n.id for n in ndrs]

    # Batch fetch Orders
    orders_map = {}
    if order_ids:
        orders = session.exec(select(Order).where(Order.id.in_(order_ids))).all()
        orders_map = {o.id: o for o in orders}

    # Batch fetch Deliveries
    deliveries_map = {}
    if delivery_ids:
        deliveries = session.exec(select(Delivery).where(Delivery.id.in_(delivery_ids))).all()
        deliveries_map = {d.id: d for d in deliveries}

    # Batch fetch Outreaches for all NDRs in this page
    outreaches_map = {}
    if ndr_ids:
        outreaches = session.exec(
            select(NDROutreach).where(NDROutreach.ndrId.in_(ndr_ids)).order_by(NDROutreach.createdAt.desc())
        ).all()
        for o in outreaches:
            if o.ndrId not in outreaches_map:
                outreaches_map[o.ndrId] = []
            outreaches_map[o.ndrId].append({
                "id": str(o.id),
                "channel": safe_enum_value(o.channel, "WHATSAPP"),
                "status": safe_enum_value(o.status, "PENDING"),
                "message": o.message,
                "attemptNumber": o.attemptNumber,
                "createdAt": o.createdAt.isoformat() if o.createdAt else None,
            })

    # Format response with real data
    formatted_ndrs = []
    for n in ndrs:
        # Get order info
        order_info = None
        if n.orderId and n.orderId in orders_map:
            order = orders_map[n.orderId]
            order_info = {
                "id": str(order.id),
                "orderNo": order.orderNo,
                "customerName": order.customerName,
                "customerPhone": order.customerPhone,
                "customerEmail": order.customerEmail,
                "shippingAddress": order.shippingAddress,
                "paymentMode": safe_enum_value(order.paymentMode, "PREPAID"),
                "totalAmount": float(order.totalAmount) if order.totalAmount else 0,
            }

        # Get delivery info
        delivery_info = None
        if n.deliveryId and n.deliveryId in deliveries_map:
            delivery = deliveries_map[n.deliveryId]
            delivery_info = {
                "id": str(delivery.id),
                "deliveryNo": delivery.deliveryNo,
                "awbNo": delivery.awbNo,
                "status": safe_enum_value(delivery.status, "PENDING"),
            }

        # Get outreach attempts
        outreach_list = outreaches_map.get(n.id, [])

        formatted_ndrs.append({
            "id": str(n.id),
            "ndrCode": n.ndrCode,
            "reason": safe_enum_value(n.reason, "OTHER"),
            "aiClassification": n.aiClassification,
            "confidence": n.confidence,
            "status": safe_enum_value(n.status, "OPEN"),
            "priority": safe_enum_value(n.priority, "MEDIUM"),
            "riskScore": n.riskScore,
            "attemptNumber": n.attemptNumber,
            "attemptDate": n.attemptDate.isoformat() if n.attemptDate else None,
            "carrierRemark": n.carrierRemark,
            "createdAt": n.createdAt.isoformat() if n.createdAt else None,
            "order": order_info,
            "delivery": delivery_info,
            "outreachAttempts": outreach_list,
            "outreachCount": len(outreach_list),
        })

    # Calculate statistics for the company (not just filtered results)
    status_counts = {}
    priority_counts = {}
    reason_counts = {}

    # Get all NDRs for the company to calculate aggregates
    all_ndrs_query = select(NDR)
    all_ndrs_query = company_filter.apply_filter(all_ndrs_query, NDR.companyId)
    all_ndrs = session.exec(all_ndrs_query).all()

    for n in all_ndrs:
        # Status counts
        status_key = safe_enum_value(n.status, "OPEN")
        status_counts[status_key] = status_counts.get(status_key, 0) + 1

        # Priority counts
        priority_key = safe_enum_value(n.priority, "MEDIUM")
        priority_counts[priority_key] = priority_counts.get(priority_key, 0) + 1

        # Reason counts
        reason_key = safe_enum_value(n.reason, "OTHER")
        reason_counts[reason_key] = reason_counts.get(reason_key, 0) + 1

    # Calculate average resolution hours
    resolved_ndrs = [n for n in all_ndrs if n.resolvedAt and n.createdAt]
    avg_resolution_hours = 0.0
    if resolved_ndrs:
        total_hours = sum(
            (n.resolvedAt - n.createdAt).total_seconds() / 3600.0
            for n in resolved_ndrs
        )
        avg_resolution_hours = round(total_hours / len(resolved_ndrs), 2)

    # Calculate outreach success rate
    all_ndr_ids = [n.id for n in all_ndrs]
    outreach_success_rate = 0.0
    if all_ndr_ids:
        total_outreaches = session.exec(
            select(func.count(NDROutreach.id)).where(NDROutreach.ndrId.in_(all_ndr_ids))
        ).one()
        if total_outreaches > 0:
            successful_statuses = ["DELIVERED", "READ", "RESPONDED"]
            successful_count = session.exec(
                select(func.count(NDROutreach.id))
                .where(NDROutreach.ndrId.in_(all_ndr_ids))
                .where(NDROutreach.status.in_(successful_statuses))
            ).one()
            outreach_success_rate = round((successful_count / total_outreaches) * 100, 2)

    return {
        "ndrs": formatted_ndrs,
        "total": count,
        "statusCounts": status_counts,
        "priorityCounts": priority_counts,
        "reasonCounts": reason_counts,
        "avgResolutionHours": avg_resolution_hours,
        "outreachSuccessRate": outreach_success_rate,
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

    query = company_filter.apply_filter(query, NDR.companyId)
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
    base_query = company_filter.apply_filter(base_query, NDR.companyId)

    ndrs = session.exec(base_query).all()

    open_count = sum(1 for n in ndrs if safe_enum_value(n.status, "") == "OPEN")
    resolved_count = sum(1 for n in ndrs if safe_enum_value(n.status, "") == "RESOLVED")
    rto_count = sum(1 for n in ndrs if safe_enum_value(n.status, "") == "RTO")

    by_reason = {}
    by_priority = {}
    for n in ndrs:
        reason_key = safe_enum_value(n.reason, "OTHER")
        priority_key = safe_enum_value(n.priority, "MEDIUM")
        by_reason[reason_key] = by_reason.get(reason_key, 0) + 1
        by_priority[priority_key] = by_priority.get(priority_key, 0) + 1

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
