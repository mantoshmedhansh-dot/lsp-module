"""
Payment Reconciliation API v1 - Settlement, COD, Chargebacks, Discrepancies
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, Order,
    PaymentSettlement, PaymentSettlementCreate, PaymentSettlementResponse,
    Chargeback, ChargebackCreate, ChargebackUpdate, ChargebackResponse,
    EscrowHold, EscrowHoldCreate, EscrowHoldResponse,
    ReconciliationDiscrepancy, ReconciliationDiscrepancyCreate, ReconciliationDiscrepancyResponse,
    SettlementStatus, ChargebackStatus, DiscrepancyType, EscrowStatus,
    SettlementImportRequest, MatchPaymentRequest, MatchPaymentResponse,
    ResolveDiscrepancyRequest, ReconciliationReportResponse,
    CODReconciliation, CODReconciliationStatus,
)


router = APIRouter(prefix="/reconciliation", tags=["Payment Reconciliation"])


# ============================================================================
# Root list endpoint (used by bin-audit page)
# ============================================================================

@router.get("")
def list_reconciliation(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List reconciliation discrepancies (used by bin audit page).
    Returns discrepancy records that can represent physical vs system inventory mismatches.
    """
    query = select(ReconciliationDiscrepancy)

    if company_filter.company_id:
        query = query.where(ReconciliationDiscrepancy.companyId == company_filter.company_id)
    if status and status != "all":
        if status == "Resolved":
            query = query.where(ReconciliationDiscrepancy.isResolved == True)
        else:
            query = query.where(ReconciliationDiscrepancy.isResolved == False)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            ReconciliationDiscrepancy.notes.ilike(search_pattern)
        )

    query = query.order_by(ReconciliationDiscrepancy.createdAt.desc()).offset(skip).limit(limit)

    try:
        records = session.exec(query).all()
        return [r.model_dump() for r in records]
    except Exception:
        return []


# ============================================================================
# Dashboard
# ============================================================================

@router.get("/dashboard")
def get_reconciliation_dashboard(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get reconciliation dashboard summary"""
    if not company_filter.company_id:
        return {
            "totalSettlements": 0,
            "pendingReconciliation": 0,
            "matchedPercentage": 0,
            "totalDiscrepancies": 0,
            "openChargebacks": 0,
            "chargebackAmount": 0,
            "codPending": 0,
            "escrowHeld": 0
        }

    # Total settlements
    total_settlements = session.exec(
        select(func.count(PaymentSettlement.id))
        .where(PaymentSettlement.companyId == company_filter.company_id)
    ).one() or 0

    # Pending reconciliation
    pending_recon = session.exec(
        select(func.count(PaymentSettlement.id))
        .where(PaymentSettlement.companyId == company_filter.company_id)
        .where(PaymentSettlement.status == SettlementStatus.PENDING)
    ).one() or 0

    # Matched amount percentage
    matched_pct = 0
    if total_settlements > 0:
        matched_result = session.exec(
            select(func.count(PaymentSettlement.id))
            .where(PaymentSettlement.companyId == company_filter.company_id)
            .where(PaymentSettlement.status == SettlementStatus.MATCHED)
        ).one() or 0
        matched_pct = round((matched_result / total_settlements) * 100, 1)

    # Total discrepancies
    total_discrepancies = session.exec(
        select(func.count(ReconciliationDiscrepancy.id))
        .where(ReconciliationDiscrepancy.companyId == company_filter.company_id)
        .where(ReconciliationDiscrepancy.isResolved == False)
    ).one() or 0

    # Open chargebacks
    open_chargebacks = session.exec(
        select(func.count(Chargeback.id))
        .where(Chargeback.companyId == company_filter.company_id)
        .where(Chargeback.status.in_([ChargebackStatus.PENDING, ChargebackStatus.DISPUTED]))
    ).one() or 0

    # Chargeback amount
    chargeback_amount = session.exec(
        select(func.sum(Chargeback.amount))
        .where(Chargeback.companyId == company_filter.company_id)
        .where(Chargeback.status.in_([ChargebackStatus.PENDING, ChargebackStatus.DISPUTED]))
    ).one() or 0

    # COD pending (from CODReconciliation if exists)
    cod_pending = 0
    try:
        cod_pending = session.exec(
            select(func.count(CODReconciliation.id))
            .where(CODReconciliation.companyId == company_filter.company_id)
            .where(CODReconciliation.status == CODReconciliationStatus.PENDING)
        ).one() or 0
    except Exception:
        pass

    # Escrow held
    escrow_held = session.exec(
        select(func.sum(EscrowHold.amount))
        .where(EscrowHold.companyId == company_filter.company_id)
        .where(EscrowHold.status == EscrowStatus.HELD)
    ).one() or 0

    return {
        "totalSettlements": total_settlements,
        "pendingReconciliation": pending_recon,
        "matchedPercentage": matched_pct,
        "totalDiscrepancies": total_discrepancies,
        "openChargebacks": open_chargebacks,
        "chargebackAmount": float(chargeback_amount) if chargeback_amount else 0,
        "codPending": cod_pending,
        "escrowHeld": float(escrow_held) if escrow_held else 0
    }


# ============================================================================
# Settlements
# ============================================================================

@router.get("/settlements", response_model=List[PaymentSettlementResponse])
def list_settlements(
    status: Optional[SettlementStatus] = None,
    channel: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List payment settlements"""
    query = select(PaymentSettlement)

    if company_filter.company_id:
        query = query.where(PaymentSettlement.companyId == company_filter.company_id)
    if status:
        query = query.where(PaymentSettlement.status == status)
    if channel:
        query = query.where(PaymentSettlement.channel == channel)
    if from_date:
        query = query.where(PaymentSettlement.settlementDate >= from_date)
    if to_date:
        query = query.where(PaymentSettlement.settlementDate <= to_date)

    query = query.order_by(PaymentSettlement.settlementDate.desc()).offset(skip).limit(limit)
    settlements = session.exec(query).all()
    return settlements


@router.post("/settlements", response_model=PaymentSettlementResponse, status_code=status.HTTP_201_CREATED)
def create_settlement(
    data: PaymentSettlementCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a payment settlement record"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4
    settlement = PaymentSettlement(
        id=uuid4(),
        companyId=company_filter.company_id,
        status=SettlementStatus.PENDING,
        **data.model_dump()
    )
    session.add(settlement)
    session.commit()
    session.refresh(settlement)
    return settlement


@router.get("/settlements/{settlement_id}", response_model=PaymentSettlementResponse)
def get_settlement(
    settlement_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific settlement"""
    query = select(PaymentSettlement).where(PaymentSettlement.id == settlement_id)
    if company_filter.company_id:
        query = query.where(PaymentSettlement.companyId == company_filter.company_id)

    settlement = session.exec(query).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return settlement


@router.post("/import")
def import_settlement_file(
    data: SettlementImportRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Import settlement data from file/API"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Placeholder for actual import logic
    return {
        "success": True,
        "message": "Settlement import initiated",
        "channel": data.channel,
        "importType": data.importType
    }


# ============================================================================
# Payment Matching
# ============================================================================

@router.post("/match", response_model=MatchPaymentResponse)
def match_payments(
    data: MatchPaymentRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Auto-match payments to orders"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    settlement = session.exec(
        select(PaymentSettlement).where(PaymentSettlement.id == data.settlementId)
    ).first()

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    # Placeholder matching logic
    matched = 0
    unmatched = 0
    discrepancies = 0

    settlement.status = SettlementStatus.MATCHED
    settlement.matchedAt = datetime.utcnow()
    settlement.matchedById = current_user.id
    settlement.updatedAt = datetime.utcnow()
    session.add(settlement)
    session.commit()

    return MatchPaymentResponse(
        success=True,
        matchedCount=matched,
        unmatchedCount=unmatched,
        discrepancyCount=discrepancies
    )


# ============================================================================
# COD Remittances
# ============================================================================

@router.get("/cod")
def list_cod_remittances(
    status: Optional[CODReconciliationStatus] = None,
    carrier: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List COD remittances"""
    query = select(CODReconciliation)

    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)
    if status:
        query = query.where(CODReconciliation.status == status)
    if carrier:
        query = query.where(CODReconciliation.carrier == carrier)
    if from_date:
        query = query.where(CODReconciliation.remittanceDate >= from_date)
    if to_date:
        query = query.where(CODReconciliation.remittanceDate <= to_date)

    query = query.order_by(CODReconciliation.remittanceDate.desc()).offset(skip).limit(limit)
    remittances = session.exec(query).all()

    return [r.model_dump() for r in remittances]


@router.get("/cod/summary")
def get_cod_summary(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get COD collection summary"""
    # Pending remittances
    pending_query = select(func.sum(CODReconciliation.amount)).where(
        CODReconciliation.status == CODReconciliationStatus.PENDING
    )
    if company_filter.company_id:
        pending_query = pending_query.where(CODReconciliation.companyId == company_filter.company_id)

    pending_amount = session.exec(pending_query).one() or Decimal("0")

    # Received this period
    received_query = select(func.sum(CODReconciliation.amount)).where(
        CODReconciliation.status == CODReconciliationStatus.RECEIVED
    )
    if company_filter.company_id:
        received_query = received_query.where(CODReconciliation.companyId == company_filter.company_id)
    if from_date:
        received_query = received_query.where(CODReconciliation.remittanceDate >= from_date)
    if to_date:
        received_query = received_query.where(CODReconciliation.remittanceDate <= to_date)

    received_amount = session.exec(received_query).one() or Decimal("0")

    return {
        "pendingAmount": float(pending_amount),
        "receivedAmount": float(received_amount),
        "currency": "INR"
    }


# ============================================================================
# Chargebacks
# ============================================================================

@router.get("/chargebacks", response_model=List[ChargebackResponse])
def list_chargebacks(
    status: Optional[ChargebackStatus] = None,
    channel: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List chargebacks"""
    query = select(Chargeback)

    if company_filter.company_id:
        query = query.where(Chargeback.companyId == company_filter.company_id)
    if status:
        query = query.where(Chargeback.status == status)
    if channel:
        query = query.where(Chargeback.channel == channel)

    query = query.order_by(Chargeback.createdAt.desc()).offset(skip).limit(limit)
    chargebacks = session.exec(query).all()
    return chargebacks


@router.post("/chargebacks", response_model=ChargebackResponse, status_code=status.HTTP_201_CREATED)
def create_chargeback(
    data: ChargebackCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a chargeback record"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4
    chargeback = Chargeback(
        id=uuid4(),
        companyId=company_filter.company_id,
        status=ChargebackStatus.OPEN,
        **data.model_dump()
    )
    session.add(chargeback)
    session.commit()
    session.refresh(chargeback)
    return chargeback


@router.get("/chargebacks/{chargeback_id}", response_model=ChargebackResponse)
def get_chargeback(
    chargeback_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific chargeback"""
    query = select(Chargeback).where(Chargeback.id == chargeback_id)
    if company_filter.company_id:
        query = query.where(Chargeback.companyId == company_filter.company_id)

    chargeback = session.exec(query).first()
    if not chargeback:
        raise HTTPException(status_code=404, detail="Chargeback not found")
    return chargeback


@router.patch("/chargebacks/{chargeback_id}", response_model=ChargebackResponse)
def update_chargeback(
    chargeback_id: UUID,
    data: ChargebackUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a chargeback"""
    query = select(Chargeback).where(Chargeback.id == chargeback_id)
    if company_filter.company_id:
        query = query.where(Chargeback.companyId == company_filter.company_id)

    chargeback = session.exec(query).first()
    if not chargeback:
        raise HTTPException(status_code=404, detail="Chargeback not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(chargeback, key, value)

    chargeback.updatedAt = datetime.utcnow()
    session.add(chargeback)
    session.commit()
    session.refresh(chargeback)
    return chargeback


@router.post("/chargebacks/{chargeback_id}/dispute")
def dispute_chargeback(
    chargeback_id: UUID,
    evidence: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Dispute a chargeback"""
    chargeback = session.exec(select(Chargeback).where(Chargeback.id == chargeback_id)).first()
    if not chargeback:
        raise HTTPException(status_code=404, detail="Chargeback not found")

    if chargeback.status != ChargebackStatus.OPEN:
        raise HTTPException(status_code=400, detail="Chargeback cannot be disputed")

    chargeback.status = ChargebackStatus.DISPUTED
    chargeback.disputedAt = datetime.utcnow()
    chargeback.disputedById = current_user.id
    if evidence:
        chargeback.evidence = evidence
    chargeback.updatedAt = datetime.utcnow()
    session.add(chargeback)
    session.commit()

    return {"success": True, "message": "Chargeback disputed"}


# ============================================================================
# Discrepancies
# ============================================================================

@router.get("/discrepancies", response_model=List[ReconciliationDiscrepancyResponse])
def list_discrepancies(
    type: Optional[DiscrepancyType] = None,
    is_resolved: bool = False,
    channel: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List reconciliation discrepancies"""
    query = select(ReconciliationDiscrepancy).where(
        ReconciliationDiscrepancy.isResolved == is_resolved
    )

    if company_filter.company_id:
        query = query.where(ReconciliationDiscrepancy.companyId == company_filter.company_id)
    if type:
        query = query.where(ReconciliationDiscrepancy.discrepancyType == type)
    if channel:
        query = query.where(ReconciliationDiscrepancy.channel == channel)

    query = query.order_by(ReconciliationDiscrepancy.createdAt.desc()).offset(skip).limit(limit)
    discrepancies = session.exec(query).all()
    return discrepancies


@router.post("/discrepancies", response_model=ReconciliationDiscrepancyResponse, status_code=status.HTTP_201_CREATED)
def create_discrepancy(
    data: ReconciliationDiscrepancyCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a discrepancy record"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4
    discrepancy = ReconciliationDiscrepancy(
        id=uuid4(),
        companyId=company_filter.company_id,
        createdById=current_user.id,
        **data.model_dump()
    )
    session.add(discrepancy)
    session.commit()
    session.refresh(discrepancy)
    return discrepancy


@router.post("/resolve/{discrepancy_id}")
def resolve_discrepancy(
    discrepancy_id: UUID,
    data: ResolveDiscrepancyRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Resolve a discrepancy"""
    discrepancy = session.exec(
        select(ReconciliationDiscrepancy).where(ReconciliationDiscrepancy.id == discrepancy_id)
    ).first()

    if not discrepancy:
        raise HTTPException(status_code=404, detail="Discrepancy not found")

    if discrepancy.isResolved:
        raise HTTPException(status_code=400, detail="Discrepancy already resolved")

    discrepancy.isResolved = True
    discrepancy.resolution = data.resolution
    discrepancy.resolvedById = current_user.id
    discrepancy.resolvedAt = datetime.utcnow()
    if data.notes:
        discrepancy.notes = data.notes
    discrepancy.updatedAt = datetime.utcnow()
    session.add(discrepancy)
    session.commit()

    return {"success": True, "message": "Discrepancy resolved"}


# ============================================================================
# Escrow
# ============================================================================

@router.get("/escrow", response_model=List[EscrowHoldResponse])
def list_escrow_holds(
    status: Optional[EscrowStatus] = None,
    channel: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List escrow holds"""
    query = select(EscrowHold)

    if company_filter.company_id:
        query = query.where(EscrowHold.companyId == company_filter.company_id)
    if status:
        query = query.where(EscrowHold.status == status)
    if channel:
        query = query.where(EscrowHold.channel == channel)

    escrows = session.exec(query).all()
    return escrows


@router.post("/escrow", response_model=EscrowHoldResponse, status_code=status.HTTP_201_CREATED)
def create_escrow_hold(
    data: EscrowHoldCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create an escrow hold"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4
    escrow = EscrowHold(
        id=uuid4(),
        companyId=company_filter.company_id,
        status=EscrowStatus.HELD,
        **data.model_dump()
    )
    session.add(escrow)
    session.commit()
    session.refresh(escrow)
    return escrow


@router.post("/escrow/{escrow_id}/release")
def release_escrow(
    escrow_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Release an escrow hold"""
    escrow = session.exec(select(EscrowHold).where(EscrowHold.id == escrow_id)).first()
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow hold not found")

    if escrow.status != EscrowStatus.HELD:
        raise HTTPException(status_code=400, detail="Escrow is not in held status")

    escrow.status = EscrowStatus.RELEASED
    escrow.releasedAt = datetime.utcnow()
    escrow.updatedAt = datetime.utcnow()
    session.add(escrow)
    session.commit()

    return {"success": True, "message": "Escrow released"}


# ============================================================================
# Reports
# ============================================================================

@router.get("/reports", response_model=ReconciliationReportResponse)
def get_reconciliation_report(
    from_date: date,
    to_date: date,
    channel: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get reconciliation report"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Settlement totals
    settlement_query = select(
        func.sum(PaymentSettlement.totalAmount),
        func.sum(PaymentSettlement.settledAmount),
        func.count(PaymentSettlement.id)
    ).where(
        PaymentSettlement.companyId == company_filter.company_id,
        PaymentSettlement.settlementDate >= from_date,
        PaymentSettlement.settlementDate <= to_date
    )
    if channel:
        settlement_query = settlement_query.where(PaymentSettlement.channel == channel)

    settlement_result = session.exec(settlement_query).first()

    # Chargeback totals
    chargeback_query = select(
        func.sum(Chargeback.amount),
        func.count(Chargeback.id)
    ).where(
        Chargeback.companyId == company_filter.company_id,
        func.date(Chargeback.createdAt) >= from_date,
        func.date(Chargeback.createdAt) <= to_date
    )
    if channel:
        chargeback_query = chargeback_query.where(Chargeback.channel == channel)

    chargeback_result = session.exec(chargeback_query).first()

    # Discrepancy count
    discrepancy_count = session.exec(
        select(func.count(ReconciliationDiscrepancy.id))
        .where(ReconciliationDiscrepancy.companyId == company_filter.company_id)
        .where(ReconciliationDiscrepancy.isResolved == False)
    ).one()

    return ReconciliationReportResponse(
        fromDate=from_date,
        toDate=to_date,
        totalSettlements=settlement_result[2] if settlement_result else 0,
        totalSettlementAmount=float(settlement_result[0] or 0) if settlement_result else 0,
        totalSettledAmount=float(settlement_result[1] or 0) if settlement_result else 0,
        totalChargebacks=chargeback_result[1] if chargeback_result else 0,
        totalChargebackAmount=float(chargeback_result[0] or 0) if chargeback_result else 0,
        openDiscrepancies=discrepancy_count
    )
