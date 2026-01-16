"""
Returns API v1 - Customer returns management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager
from app.models import (
    Return, ReturnCreate, ReturnUpdate, ReturnResponse, ReturnBrief,
    ReturnItem, ReturnItemCreate, ReturnItemUpdate, ReturnItemResponse,
    User, ReturnType, ReturnStatus, QCStatus
)

router = APIRouter(prefix="/returns", tags=["Returns"])


# ============================================================================
# Return Endpoints
# ============================================================================

@router.get("", response_model=List[ReturnBrief])
def list_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[ReturnStatus] = None,
    return_type: Optional[ReturnType] = None,
    order_id: Optional[UUID] = None,
    qc_status: Optional[QCStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List returns with pagination and filters."""
    query = select(Return)

    if status:
        query = query.where(Return.status == status)
    if return_type:
        query = query.where(Return.type == return_type)
    if order_id:
        query = query.where(Return.orderId == order_id)
    if qc_status:
        query = query.where(Return.qcStatus == qc_status)
    if date_from:
        query = query.where(Return.initiatedAt >= date_from)
    if date_to:
        query = query.where(Return.initiatedAt <= date_to)

    query = query.offset(skip).limit(limit).order_by(Return.initiatedAt.desc())

    returns = session.exec(query).all()
    return [ReturnBrief.model_validate(r) for r in returns]


@router.get("/count")
def count_returns(
    status: Optional[ReturnStatus] = None,
    return_type: Optional[ReturnType] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of returns."""
    query = select(func.count(Return.id))

    if status:
        query = query.where(Return.status == status)
    if return_type:
        query = query.where(Return.type == return_type)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/summary")
def get_return_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get return summary statistics."""
    try:
        returns = session.exec(select(Return)).all()

        # Use string comparison to avoid enum issues
        def get_status_str(r):
            return r.status.value if hasattr(r.status, 'value') else str(r.status)

        def get_type_str(r):
            return r.type.value if hasattr(r.type, 'value') else str(r.type)

        pending = sum(1 for r in returns if get_status_str(r) in ["INITIATED", "PICKUP_SCHEDULED", "IN_TRANSIT"])
        received = sum(1 for r in returns if get_status_str(r) in ["RECEIVED", "QC_PENDING"])
        processed = sum(1 for r in returns if get_status_str(r) in ["QC_PASSED", "QC_FAILED"])

        by_type = {}
        by_status = {}
        by_reason = {}
        rto_count = 0

        for r in returns:
            type_str = get_type_str(r)
            status_str = get_status_str(r)
            by_type[type_str] = by_type.get(type_str, 0) + 1
            by_status[status_str] = by_status.get(status_str, 0) + 1

            # Track RTO reasons
            if type_str == "RTO":
                rto_count += 1
                reason = r.reason or "Unknown"
                by_reason[reason] = by_reason.get(reason, 0) + 1

        # Calculate RTO rate as percentage of total returns
        total_returns = len(returns)
        rto_rate = rto_count / total_returns if total_returns > 0 else 0

        return {
            "totalReturns": total_returns,
            "pendingReturns": pending,
            "receivedReturns": received,
            "processedReturns": processed,
            "byType": by_type,
            "byStatus": by_status,
            "byReason": by_reason,
            "rtoRate": round(rto_rate, 4),
            "rtoCount": rto_count
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Summary error: {str(e)}\n{traceback.format_exc()}")


@router.get("/{return_id}", response_model=ReturnResponse)
def get_return(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get return by ID."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    return ReturnResponse.model_validate(ret)


@router.post("", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
def create_return(
    data: ReturnCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new return."""
    ret = Return.model_validate(data)
    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.patch("/{return_id}", response_model=ReturnResponse)
def update_return(
    return_id: UUID,
    data: ReturnUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update return."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ret, field, value)

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/receive", response_model=ReturnResponse)
def receive_return(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark return as received."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.status = ReturnStatus.RECEIVED
    ret.receivedAt = datetime.utcnow()

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/qc", response_model=ReturnResponse)
def update_qc_status(
    return_id: UUID,
    qc_status: QCStatus,
    qc_remarks: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update QC status for return."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.qcStatus = qc_status
    ret.qcCompletedAt = datetime.utcnow()
    ret.qcCompletedBy = current_user.id
    ret.qcRemarks = qc_remarks

    if qc_status == QCStatus.PASSED:
        ret.status = ReturnStatus.QC_PASSED
    elif qc_status == QCStatus.FAILED:
        ret.status = ReturnStatus.QC_FAILED

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/process", response_model=ReturnResponse)
def process_return(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark return as processed."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.status = ReturnStatus.PROCESSED
    ret.processedAt = datetime.utcnow()

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


# ============================================================================
# Return Items Endpoints
# ============================================================================

@router.get("/{return_id}/items", response_model=List[ReturnItemResponse])
def list_return_items(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a return."""
    query = select(ReturnItem).where(ReturnItem.returnId == return_id)
    items = session.exec(query).all()
    return [ReturnItemResponse.model_validate(i) for i in items]


@router.post("/{return_id}/items", response_model=ReturnItemResponse, status_code=status.HTTP_201_CREATED)
def add_return_item(
    return_id: UUID,
    data: ReturnItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to return."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    item_data = data.model_dump()
    item_data["returnId"] = return_id
    item = ReturnItem.model_validate(item_data)

    session.add(item)
    session.commit()
    session.refresh(item)
    return ReturnItemResponse.model_validate(item)


@router.patch("/items/{item_id}", response_model=ReturnItemResponse)
def update_return_item(
    item_id: UUID,
    data: ReturnItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update return item (QC, action, etc.)."""
    item = session.get(ReturnItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Return item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return ReturnItemResponse.model_validate(item)
