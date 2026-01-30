"""
Marketplace Returns API v1 - Handle returns from marketplaces
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func, SQLModel

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    MarketplaceConnection,
    ConnectionStatus,
    MarketplaceReturn,
    MarketplaceReturnResponse,
    MarketplaceReturnStatus,
)


# Additional response schemas for items (if needed locally)
class MarketplaceReturnItemResponse(SQLModel):
    """Response for marketplace return item"""
    id: UUID
    returnId: UUID
    marketplaceSku: str
    skuCode: Optional[str] = None
    productName: Optional[str] = None
    quantity: int = 1
    returnedQuantity: int = 0
    createdAt: datetime
    updatedAt: datetime


router = APIRouter(prefix="/marketplace-returns", tags=["Marketplace Returns"])


# ============================================================================
# List and Get Returns
# ============================================================================

@router.get("", response_model=List[MarketplaceReturnResponse])
def list_marketplace_returns(
    connection_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List marketplace returns with filters"""
    query = select(MarketplaceReturn)

    if company_filter.company_id:
        query = query.where(MarketplaceReturn.companyId == company_filter.company_id)

    if connection_id:
        query = query.where(MarketplaceReturn.connectionId == connection_id)

    if channel:
        query = query.where(MarketplaceReturn.channel == channel.upper())

    if status:
        query = query.where(MarketplaceReturn.status == status)

    if from_date:
        query = query.where(MarketplaceReturn.initiatedAt >= from_date)

    if to_date:
        query = query.where(MarketplaceReturn.initiatedAt <= to_date)

    query = query.order_by(MarketplaceReturn.initiatedAt.desc())
    query = query.offset(skip).limit(limit)

    returns = session.exec(query).all()
    return returns


@router.get("/{return_id}", response_model=MarketplaceReturnResponse)
def get_marketplace_return(
    return_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get marketplace return details"""
    query = select(MarketplaceReturn).where(MarketplaceReturn.id == return_id)

    if company_filter.company_id:
        query = query.where(MarketplaceReturn.companyId == company_filter.company_id)

    ret = session.exec(query).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    return ret


@router.get("/{return_id}/items", response_model=List[MarketplaceReturnItemResponse])
def get_return_items(
    return_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get items in a marketplace return"""
    # Verify return exists and belongs to company
    ret = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.id == return_id)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
    ).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    items = session.exec(
        select(MarketplaceReturnItem)
        .where(MarketplaceReturnItem.returnId == return_id)
    ).all()

    return items


# ============================================================================
# Return Actions
# ============================================================================

@router.post("/{return_id}/receive")
def receive_return(
    return_id: UUID,
    tracking_number: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark a return as received in warehouse"""
    ret = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.id == return_id)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
    ).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    if ret.status not in [MarketplaceReturnStatus.INITIATED, MarketplaceReturnStatus.APPROVED, MarketplaceReturnStatus.IN_TRANSIT]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot receive return with status: {ret.status}"
        )

    ret.status = MarketplaceReturnStatus.RECEIVED
    ret.receivedAt = datetime.utcnow()
    if tracking_number:
        ret.trackingNumber = tracking_number
    ret.updatedAt = datetime.utcnow()

    session.add(ret)
    session.commit()

    return {"success": True, "message": "Return marked as received"}


@router.post("/{return_id}/qc")
def complete_qc(
    return_id: UUID,
    passed: bool,
    notes: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Complete QC for a return"""
    ret = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.id == return_id)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
    ).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    if ret.status not in [MarketplaceReturnStatus.RECEIVED, MarketplaceReturnStatus.QC_PENDING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot perform QC on return with status: {ret.status}"
        )

    ret.qcStatus = "PASSED" if passed else "FAILED"
    ret.status = MarketplaceReturnStatus.QC_PASSED if passed else MarketplaceReturnStatus.QC_FAILED
    ret.qcNotes = notes
    ret.qcCompletedAt = datetime.utcnow()
    ret.qcCompletedBy = current_user.id
    ret.updatedAt = datetime.utcnow()

    session.add(ret)
    session.commit()

    return {
        "success": True,
        "message": f"QC {'passed' if passed else 'failed'}",
        "qcStatus": ret.qcStatus
    }


@router.post("/{return_id}/process-refund")
def process_refund(
    return_id: UUID,
    refund_amount: Optional[Decimal] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Process refund for a return"""
    ret = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.id == return_id)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
    ).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    if ret.status not in [MarketplaceReturnStatus.QC_PASSED, MarketplaceReturnStatus.REFUND_PENDING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot process refund for return with status: {ret.status}"
        )

    if refund_amount:
        ret.refundAmount = refund_amount

    ret.refundStatus = "PROCESSED"
    ret.status = MarketplaceReturnStatus.REFUND_PROCESSED
    ret.refundedAt = datetime.utcnow()
    ret.updatedAt = datetime.utcnow()

    session.add(ret)
    session.commit()

    return {
        "success": True,
        "message": "Refund processed",
        "refundAmount": str(ret.refundAmount)
    }


@router.post("/{return_id}/complete")
def complete_return(
    return_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark a return as completed"""
    ret = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.id == return_id)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
    ).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.status = MarketplaceReturnStatus.COMPLETED
    ret.updatedAt = datetime.utcnow()

    session.add(ret)
    session.commit()

    return {"success": True, "message": "Return completed"}


# ============================================================================
# Item QC
# ============================================================================

@router.post("/{return_id}/items/{item_id}/qc")
def item_qc(
    return_id: UUID,
    item_id: UUID,
    saleable_qty: int,
    damaged_qty: int = 0,
    notes: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Complete QC for a return item"""
    # Verify return exists
    ret = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.id == return_id)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
    ).first()

    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    # Get item
    item = session.exec(
        select(MarketplaceReturnItem)
        .where(MarketplaceReturnItem.id == item_id)
        .where(MarketplaceReturnItem.returnId == return_id)
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Return item not found")

    item.saleableQuantity = saleable_qty
    item.damagedQuantity = damaged_qty
    item.returnedQuantity = saleable_qty + damaged_qty
    item.qcStatus = "COMPLETED"
    item.qcNotes = notes
    item.updatedAt = datetime.utcnow()

    session.add(item)
    session.commit()

    return {
        "success": True,
        "saleableQuantity": saleable_qty,
        "damagedQuantity": damaged_qty
    }


# ============================================================================
# Statistics
# ============================================================================

@router.get("/stats/summary")
def get_return_stats(
    days: int = Query(30, ge=1, le=365),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get return statistics"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    since = datetime.utcnow() - timedelta(days=days)

    # Get returns in period
    returns = session.exec(
        select(MarketplaceReturn)
        .where(MarketplaceReturn.companyId == company_filter.company_id)
        .where(MarketplaceReturn.initiatedAt >= since)
    ).all()

    total_returns = len(returns)
    total_refund = sum(r.refundAmount or Decimal("0") for r in returns)

    # By status
    by_status = {}
    for r in returns:
        status = r.status
        if status not in by_status:
            by_status[status] = 0
        by_status[status] += 1

    # By channel
    by_channel = {}
    for r in returns:
        channel = r.channel or "UNKNOWN"
        if channel not in by_channel:
            by_channel[channel] = {"count": 0, "refund": Decimal("0")}
        by_channel[channel]["count"] += 1
        by_channel[channel]["refund"] += r.refundAmount or Decimal("0")

    # Pending actions
    pending_receive = len([r for r in returns if r.status in [MarketplaceReturnStatus.INITIATED, MarketplaceReturnStatus.IN_TRANSIT]])
    pending_qc = len([r for r in returns if r.status in [MarketplaceReturnStatus.RECEIVED, MarketplaceReturnStatus.QC_PENDING]])
    pending_refund = len([r for r in returns if r.status == MarketplaceReturnStatus.QC_PASSED])

    return {
        "period_days": days,
        "total_returns": total_returns,
        "total_refund_amount": str(total_refund),
        "by_status": by_status,
        "by_channel": {
            k: {"count": v["count"], "refund": str(v["refund"])}
            for k, v in by_channel.items()
        },
        "pending_actions": {
            "pending_receive": pending_receive,
            "pending_qc": pending_qc,
            "pending_refund": pending_refund
        }
    }


# ============================================================================
# Fetch from Marketplace
# ============================================================================

@router.post("/fetch/{connection_id}")
async def fetch_returns_from_marketplace(
    connection_id: UUID,
    from_date: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Fetch return data from marketplace API"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.CONNECTED:
        raise HTTPException(
            status_code=400,
            detail=f"Connection not active: {connection.status}"
        )

    if not from_date:
        from_date = datetime.utcnow() - timedelta(days=7)

    # In a real implementation, this would call the marketplace adapter
    return {
        "success": True,
        "message": "Return fetch initiated",
        "connectionId": str(connection_id),
        "marketplace": connection.marketplace.value,
        "fromDate": from_date.isoformat(),
        "note": "Background job will process returns"
    }
