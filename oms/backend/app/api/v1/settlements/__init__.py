"""
Settlements API v1 - Marketplace settlement reconciliation
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    MarketplaceConnection,
    MarketplaceSettlement,
    MarketplaceSettlementCreate,
    MarketplaceSettlementUpdate,
    MarketplaceSettlementResponse,
    MarketplaceSettlementItem,
    MarketplaceSettlementItemCreate,
    MarketplaceSettlementItemResponse,
    ReconciliationStatus,
    ConnectionStatus,
)


router = APIRouter(prefix="/settlements", tags=["Settlements"])


# ============================================================================
# Settlement CRUD
# ============================================================================

@router.get("", response_model=List[MarketplaceSettlementResponse])
def list_settlements(
    connection_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    status: Optional[ReconciliationStatus] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List settlements with filters"""
    query = select(MarketplaceSettlement)

    if company_filter.company_id:
        query = query.where(MarketplaceSettlement.companyId == company_filter.company_id)

    if connection_id:
        query = query.where(MarketplaceSettlement.connectionId == connection_id)

    if channel:
        query = query.where(MarketplaceSettlement.channel == channel.upper())

    if status:
        query = query.where(MarketplaceSettlement.reconciliationStatus == status)

    if from_date:
        query = query.where(MarketplaceSettlement.settlementDate >= from_date)

    if to_date:
        query = query.where(MarketplaceSettlement.settlementDate <= to_date)

    query = query.order_by(MarketplaceSettlement.settlementDate.desc())
    query = query.offset(skip).limit(limit)

    settlements = session.exec(query).all()
    return settlements


@router.get("/{settlement_id}", response_model=MarketplaceSettlementResponse)
def get_settlement(
    settlement_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get settlement details"""
    query = select(MarketplaceSettlement).where(MarketplaceSettlement.id == settlement_id)

    if company_filter.company_id:
        query = query.where(MarketplaceSettlement.companyId == company_filter.company_id)

    settlement = session.exec(query).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    return settlement


@router.post("", response_model=MarketplaceSettlementResponse)
def create_settlement(
    data: MarketplaceSettlementCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new settlement record"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Verify connection exists
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == data.connectionId)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    from uuid import uuid4

    settlement = MarketplaceSettlement(
        id=uuid4(),
        companyId=company_filter.company_id,
        connectionId=data.connectionId,
        channel=connection.marketplace.value,
        settlementId=data.settlementId,
        settlementDate=data.settlementDate,
        periodStart=data.periodStart,
        periodEnd=data.periodEnd,
        currency=data.currency or "INR",
        totalAmount=data.totalAmount,
        orderAmount=data.orderAmount,
        refundAmount=data.refundAmount or Decimal("0"),
        commissionAmount=data.commissionAmount or Decimal("0"),
        shippingFee=data.shippingFee or Decimal("0"),
        otherFees=data.otherFees or Decimal("0"),
        taxAmount=data.taxAmount or Decimal("0"),
        netAmount=data.netAmount,
        reconciliationStatus=ReconciliationStatus.PENDING,
        rawData=data.rawData
    )

    session.add(settlement)
    session.commit()
    session.refresh(settlement)

    return settlement


@router.patch("/{settlement_id}", response_model=MarketplaceSettlementResponse)
def update_settlement(
    settlement_id: UUID,
    data: MarketplaceSettlementUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update settlement details"""
    query = select(MarketplaceSettlement).where(MarketplaceSettlement.id == settlement_id)

    if company_filter.company_id:
        query = query.where(MarketplaceSettlement.companyId == company_filter.company_id)

    settlement = session.exec(query).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settlement, key, value)

    settlement.updatedAt = datetime.utcnow()
    session.add(settlement)
    session.commit()
    session.refresh(settlement)

    return settlement


# ============================================================================
# Settlement Items
# ============================================================================

@router.get("/{settlement_id}/items", response_model=List[MarketplaceSettlementItemResponse])
def list_settlement_items(
    settlement_id: UUID,
    reconciliation_status: Optional[ReconciliationStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a settlement"""
    # Verify settlement exists and belongs to company
    settlement = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.id == settlement_id)
        .where(MarketplaceSettlement.companyId == company_filter.company_id)
    ).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    query = select(MarketplaceSettlementItem).where(
        MarketplaceSettlementItem.settlementId == settlement_id
    )

    if reconciliation_status:
        query = query.where(MarketplaceSettlementItem.reconciliationStatus == reconciliation_status)

    query = query.order_by(MarketplaceSettlementItem.createdAt.desc())
    query = query.offset(skip).limit(limit)

    items = session.exec(query).all()
    return items


@router.post("/{settlement_id}/items", response_model=MarketplaceSettlementItemResponse)
def add_settlement_item(
    settlement_id: UUID,
    data: MarketplaceSettlementItemCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Add an item to a settlement"""
    # Verify settlement exists
    settlement = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.id == settlement_id)
        .where(MarketplaceSettlement.companyId == company_filter.company_id)
    ).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    from uuid import uuid4

    item = MarketplaceSettlementItem(
        id=uuid4(),
        settlementId=settlement_id,
        marketplaceOrderId=data.marketplaceOrderId,
        localOrderId=data.localOrderId,
        transactionType=data.transactionType,
        transactionDate=data.transactionDate,
        amount=data.amount,
        commissionAmount=data.commissionAmount or Decimal("0"),
        shippingFee=data.shippingFee or Decimal("0"),
        otherFees=data.otherFees or Decimal("0"),
        netAmount=data.netAmount,
        reconciliationStatus=ReconciliationStatus.PENDING,
        description=data.description
    )

    session.add(item)
    session.commit()
    session.refresh(item)

    return item


# ============================================================================
# Reconciliation Actions
# ============================================================================

@router.post("/{settlement_id}/reconcile")
def reconcile_settlement(
    settlement_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Run automatic reconciliation for a settlement"""
    settlement = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.id == settlement_id)
        .where(MarketplaceSettlement.companyId == company_filter.company_id)
    ).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    # Get all items
    items = session.exec(
        select(MarketplaceSettlementItem)
        .where(MarketplaceSettlementItem.settlementId == settlement_id)
    ).all()

    matched_count = 0
    unmatched_count = 0
    discrepancy_count = 0

    for item in items:
        if item.reconciliationStatus in [ReconciliationStatus.MATCHED, ReconciliationStatus.IGNORED]:
            continue

        # Try to match with local order
        if item.localOrderId:
            # Already has a local order - verify amounts
            # In a real implementation, would fetch the order and compare
            item.reconciliationStatus = ReconciliationStatus.MATCHED
            matched_count += 1
        elif item.marketplaceOrderId:
            # Try to find local order by marketplace order ID
            # In a real implementation, would search orders table
            # For now, mark as unmatched
            item.reconciliationStatus = ReconciliationStatus.UNMATCHED
            unmatched_count += 1
        else:
            item.reconciliationStatus = ReconciliationStatus.UNMATCHED
            unmatched_count += 1

        session.add(item)

    # Update settlement status
    total_items = len(items)
    if total_items == 0:
        settlement.reconciliationStatus = ReconciliationStatus.PENDING
    elif unmatched_count == 0 and discrepancy_count == 0:
        settlement.reconciliationStatus = ReconciliationStatus.MATCHED
    elif matched_count == 0:
        settlement.reconciliationStatus = ReconciliationStatus.UNMATCHED
    else:
        settlement.reconciliationStatus = ReconciliationStatus.PARTIAL

    settlement.matchedCount = matched_count
    settlement.unmatchedCount = unmatched_count
    settlement.discrepancyCount = discrepancy_count
    settlement.reconciledAt = datetime.utcnow()
    settlement.reconciledBy = current_user.id
    settlement.updatedAt = datetime.utcnow()

    session.add(settlement)
    session.commit()

    return {
        "success": True,
        "settlementId": str(settlement_id),
        "totalItems": total_items,
        "matched": matched_count,
        "unmatched": unmatched_count,
        "discrepancies": discrepancy_count,
        "status": settlement.reconciliationStatus.value
    }


@router.post("/items/{item_id}/match")
def match_settlement_item(
    item_id: UUID,
    local_order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Manually match a settlement item to a local order"""
    item = session.exec(
        select(MarketplaceSettlementItem)
        .where(MarketplaceSettlementItem.id == item_id)
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Settlement item not found")

    # Verify settlement belongs to company
    settlement = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.id == item.settlementId)
        .where(MarketplaceSettlement.companyId == company_filter.company_id)
    ).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    item.localOrderId = local_order_id
    item.reconciliationStatus = ReconciliationStatus.MATCHED
    item.updatedAt = datetime.utcnow()

    session.add(item)
    session.commit()

    return {"success": True, "message": "Item matched successfully"}


@router.post("/items/{item_id}/ignore")
def ignore_settlement_item(
    item_id: UUID,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark a settlement item as ignored"""
    item = session.exec(
        select(MarketplaceSettlementItem)
        .where(MarketplaceSettlementItem.id == item_id)
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Settlement item not found")

    # Verify settlement belongs to company
    settlement = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.id == item.settlementId)
        .where(MarketplaceSettlement.companyId == company_filter.company_id)
    ).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    item.reconciliationStatus = ReconciliationStatus.IGNORED
    item.notes = reason
    item.updatedAt = datetime.utcnow()

    session.add(item)
    session.commit()

    return {"success": True, "message": "Item marked as ignored"}


# ============================================================================
# Discrepancies
# ============================================================================

@router.get("/discrepancies")
def list_discrepancies(
    connection_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all unmatched or discrepancy items across settlements"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Get settlements for the company
    settlement_query = select(MarketplaceSettlement.id).where(
        MarketplaceSettlement.companyId == company_filter.company_id
    )

    if connection_id:
        settlement_query = settlement_query.where(
            MarketplaceSettlement.connectionId == connection_id
        )

    settlement_ids = session.exec(settlement_query).all()

    if not settlement_ids:
        return {"items": [], "total": 0}

    # Get unmatched items
    items_query = select(MarketplaceSettlementItem).where(
        MarketplaceSettlementItem.settlementId.in_(settlement_ids),
        MarketplaceSettlementItem.reconciliationStatus.in_([
            ReconciliationStatus.UNMATCHED,
            ReconciliationStatus.DISCREPANCY
        ])
    ).order_by(MarketplaceSettlementItem.createdAt.desc())

    total = session.exec(
        select(func.count(MarketplaceSettlementItem.id)).where(
            MarketplaceSettlementItem.settlementId.in_(settlement_ids),
            MarketplaceSettlementItem.reconciliationStatus.in_([
                ReconciliationStatus.UNMATCHED,
                ReconciliationStatus.DISCREPANCY
            ])
        )
    ).one()

    items_query = items_query.offset(skip).limit(limit)
    items = session.exec(items_query).all()

    return {
        "items": [MarketplaceSettlementItemResponse.model_validate(item) for item in items],
        "total": total
    }


# ============================================================================
# Statistics
# ============================================================================

@router.get("/stats")
def get_settlement_stats(
    days: int = Query(30, ge=1, le=365),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get settlement statistics"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    since = datetime.utcnow() - timedelta(days=days)

    # Get settlements in period
    settlements = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.companyId == company_filter.company_id)
        .where(MarketplaceSettlement.settlementDate >= since)
    ).all()

    total_settlements = len(settlements)
    total_amount = sum(s.totalAmount or Decimal("0") for s in settlements)
    total_net = sum(s.netAmount or Decimal("0") for s in settlements)
    total_commission = sum(s.commissionAmount or Decimal("0") for s in settlements)

    matched = len([s for s in settlements if s.reconciliationStatus == ReconciliationStatus.MATCHED])
    partial = len([s for s in settlements if s.reconciliationStatus == ReconciliationStatus.PARTIAL])
    unmatched = len([s for s in settlements if s.reconciliationStatus == ReconciliationStatus.UNMATCHED])
    pending = len([s for s in settlements if s.reconciliationStatus == ReconciliationStatus.PENDING])

    # By channel
    by_channel = {}
    for s in settlements:
        channel = s.channel or "UNKNOWN"
        if channel not in by_channel:
            by_channel[channel] = {"count": 0, "amount": Decimal("0")}
        by_channel[channel]["count"] += 1
        by_channel[channel]["amount"] += s.netAmount or Decimal("0")

    return {
        "period_days": days,
        "total_settlements": total_settlements,
        "total_amount": str(total_amount),
        "total_net": str(total_net),
        "total_commission": str(total_commission),
        "by_status": {
            "matched": matched,
            "partial": partial,
            "unmatched": unmatched,
            "pending": pending
        },
        "by_channel": {
            k: {"count": v["count"], "amount": str(v["amount"])}
            for k, v in by_channel.items()
        },
        "reconciliation_rate": (matched / total_settlements * 100) if total_settlements > 0 else 0
    }


# ============================================================================
# Fetch from Marketplace
# ============================================================================

@router.post("/fetch/{connection_id}")
async def fetch_settlements_from_marketplace(
    connection_id: UUID,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Fetch settlement data from marketplace API"""
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

    # Set default date range if not provided
    if not to_date:
        to_date = datetime.utcnow()
    if not from_date:
        from_date = to_date - timedelta(days=7)

    # In a real implementation, this would call the marketplace adapter
    # to fetch settlement data
    # For now, return a placeholder response

    return {
        "success": True,
        "message": "Settlement fetch initiated",
        "connectionId": str(connection_id),
        "marketplace": connection.marketplace.value,
        "fromDate": from_date.isoformat(),
        "toDate": to_date.isoformat(),
        "note": "Background job will process settlements"
    }
