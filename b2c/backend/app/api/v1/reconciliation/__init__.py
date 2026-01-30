"""
Payment Reconciliation API Endpoints
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.payment_reconciliation import (
    PaymentSettlement, CODRemittance, Chargeback, EscrowHold,
    ReconciliationDiscrepancy,
    SettlementStatus, CODStatus, ChargebackStatus, ChargebackReason,
    DiscrepancyType, EscrowStatus,
    SettlementImportRequest, SettlementResponse, CODRemittanceResponse,
    ChargebackResponse, DiscrepancyResponse,
    MatchPaymentRequest, MatchPaymentResponse,
    ResolveDiscrepancyRequest, ReconciliationReportResponse
)
from app.services.reconciliation_engine import reconciliation_engine

router = APIRouter()


# ==================== Settlements ====================

@router.get("/settlements", response_model=List[SettlementResponse])
async def list_settlements(
    payment_gateway: Optional[str] = None,
    marketplace: Optional[str] = None,
    status: Optional[SettlementStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List payment settlements."""
    stmt = select(PaymentSettlement)
    if payment_gateway:
        stmt = stmt.where(PaymentSettlement.paymentGateway == payment_gateway)
    if marketplace:
        stmt = stmt.where(PaymentSettlement.marketplace == marketplace)
    if status:
        stmt = stmt.where(PaymentSettlement.status == status)
    if start_date:
        stmt = stmt.where(PaymentSettlement.settlementDate >= start_date)
    if end_date:
        stmt = stmt.where(PaymentSettlement.settlementDate <= end_date)
    stmt = stmt.order_by(PaymentSettlement.settlementDate.desc()).limit(limit)
    return db.exec(stmt).all()


@router.get("/settlements/{settlement_id}", response_model=SettlementResponse)
async def get_settlement(
    settlement_id: UUID,
    db: Session = Depends(get_session)
):
    """Get settlement details."""
    stmt = select(PaymentSettlement).where(PaymentSettlement.id == settlement_id)
    settlement = db.exec(stmt).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return settlement


@router.post("/import", response_model=SettlementResponse)
async def import_settlement(
    request: SettlementImportRequest,
    db: Session = Depends(get_session)
):
    """Import a settlement file."""
    from uuid import uuid4
    settlement_id = f"{request.paymentGateway}-{request.settlementDate.strftime('%Y%m%d')}-{uuid4().hex[:6]}"
    transactions = request.fileData.get("transactions", []) if request.fileData else []

    settlement = await reconciliation_engine.import_settlement(
        db=db,
        settlement_id=settlement_id,
        payment_gateway=request.paymentGateway,
        settlement_date=request.settlementDate,
        period_start=request.periodStart,
        period_end=request.periodEnd,
        transactions=transactions,
        marketplace=request.marketplace
    )
    return settlement


@router.post("/match", response_model=MatchPaymentResponse)
async def match_payments(
    request: MatchPaymentRequest,
    db: Session = Depends(get_session)
):
    """Auto-match settlement payments with orders."""
    return await reconciliation_engine.match_payments(
        db=db,
        settlement_id=request.settlementId,
        auto_match=request.autoMatch,
        tolerance_percentage=request.tolerancePercentage
    )


# ==================== COD Remittances ====================

@router.get("/cod", response_model=List[CODRemittanceResponse])
async def list_cod_remittances(
    courier_partner: Optional[str] = None,
    status: Optional[CODStatus] = None,
    start_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List COD remittances."""
    stmt = select(CODRemittance)
    if courier_partner:
        stmt = stmt.where(CODRemittance.courierPartner == courier_partner)
    if status:
        stmt = stmt.where(CODRemittance.status == status)
    if start_date:
        stmt = stmt.where(CODRemittance.collectionDate >= start_date)
    stmt = stmt.order_by(CODRemittance.collectionDate.desc()).limit(limit)
    return db.exec(stmt).all()


@router.post("/cod/import")
async def import_cod_remittance(
    remittance_id: str = Query(...),
    courier_partner: str = Query(...),
    collection_date: datetime = Query(...),
    total_collected: float = Query(...),
    order_ids: List[str] = Query(...),
    deductions: float = Query(0),
    db: Session = Depends(get_session)
):
    """Import COD remittance."""
    remittance = await reconciliation_engine.process_cod_remittance(
        db=db,
        remittance_id=remittance_id,
        courier_partner=courier_partner,
        collection_date=collection_date,
        total_collected=total_collected,
        order_ids=order_ids,
        deductions=deductions
    )
    return {"message": "COD remittance imported", "remittanceId": str(remittance.id)}


# ==================== Discrepancies ====================

@router.get("/discrepancies", response_model=List[DiscrepancyResponse])
async def list_discrepancies(
    settlement_id: Optional[UUID] = None,
    discrepancy_type: Optional[DiscrepancyType] = None,
    status: str = Query("OPEN"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List reconciliation discrepancies."""
    stmt = select(ReconciliationDiscrepancy).where(
        ReconciliationDiscrepancy.status == status
    )
    if settlement_id:
        stmt = stmt.where(ReconciliationDiscrepancy.settlementId == settlement_id)
    if discrepancy_type:
        stmt = stmt.where(ReconciliationDiscrepancy.discrepancyType == discrepancy_type)
    stmt = stmt.order_by(ReconciliationDiscrepancy.detectedAt.desc()).limit(limit)
    return db.exec(stmt).all()


@router.post("/resolve/{discrepancy_id}")
async def resolve_discrepancy(
    discrepancy_id: UUID,
    request: ResolveDiscrepancyRequest,
    resolved_by: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Resolve a discrepancy."""
    success = await reconciliation_engine.resolve_discrepancy(
        db=db,
        discrepancy_id=discrepancy_id,
        resolution=request.resolution,
        resolved_by=resolved_by,
        notes=request.notes
    )
    if not success:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    return {"message": "Discrepancy resolved"}


# ==================== Chargebacks ====================

@router.get("/chargebacks", response_model=List[ChargebackResponse])
async def list_chargebacks(
    status: Optional[ChargebackStatus] = None,
    reason: Optional[ChargebackReason] = None,
    start_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List chargebacks."""
    stmt = select(Chargeback)
    if status:
        stmt = stmt.where(Chargeback.status == status)
    if reason:
        stmt = stmt.where(Chargeback.reason == reason)
    if start_date:
        stmt = stmt.where(Chargeback.initiatedDate >= start_date)
    stmt = stmt.order_by(Chargeback.initiatedDate.desc()).limit(limit)
    return db.exec(stmt).all()


@router.get("/chargebacks/{chargeback_id}", response_model=ChargebackResponse)
async def get_chargeback(
    chargeback_id: UUID,
    db: Session = Depends(get_session)
):
    """Get chargeback details."""
    stmt = select(Chargeback).where(Chargeback.id == chargeback_id)
    chargeback = db.exec(stmt).first()
    if not chargeback:
        raise HTTPException(status_code=404, detail="Chargeback not found")
    return chargeback


@router.put("/chargebacks/{chargeback_id}/respond")
async def respond_to_chargeback(
    chargeback_id: UUID,
    evidence: dict = None,
    notes: str = Query(None),
    db: Session = Depends(get_session)
):
    """Submit response to chargeback."""
    stmt = select(Chargeback).where(Chargeback.id == chargeback_id)
    chargeback = db.exec(stmt).first()
    if not chargeback:
        raise HTTPException(status_code=404, detail="Chargeback not found")

    chargeback.status = ChargebackStatus.RESPONDED
    chargeback.respondedAt = datetime.now(timezone.utc)
    chargeback.evidence = evidence
    chargeback.notes = notes
    db.add(chargeback)
    db.commit()

    return {"message": "Chargeback response submitted"}


# ==================== Reports ====================

@router.get("/reports", response_model=ReconciliationReportResponse)
async def get_reconciliation_report(
    period_start: datetime = Query(...),
    period_end: datetime = Query(...),
    payment_gateway: Optional[str] = None,
    marketplace: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Generate reconciliation report."""
    return await reconciliation_engine.generate_report(
        db=db,
        period_start=period_start,
        period_end=period_end,
        payment_gateway=payment_gateway,
        marketplace=marketplace
    )
