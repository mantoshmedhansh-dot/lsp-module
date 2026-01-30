"""
Payment Reconciliation Engine
Handles payment matching and discrepancy detection
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from sqlmodel import Session, select
from sqlalchemy import and_, or_, func

from app.models.payment_reconciliation import (
    PaymentSettlement, CODRemittance, Chargeback, EscrowHold,
    ReconciliationDiscrepancy,
    SettlementStatus, CODStatus, ChargebackStatus, DiscrepancyType,
    MatchPaymentResponse, ReconciliationReportResponse
)


class ReconciliationEngine:
    """
    Engine for payment reconciliation.
    Matches settlements with orders and detects discrepancies.
    """

    async def import_settlement(
        self,
        db: Session,
        settlement_id: str,
        payment_gateway: str,
        settlement_date: datetime,
        period_start: datetime,
        period_end: datetime,
        transactions: List[dict],
        marketplace: Optional[str] = None
    ) -> PaymentSettlement:
        """Import a settlement batch."""
        total_amount = sum(t.get("amount", 0) for t in transactions)
        fee_amount = sum(t.get("fee", 0) for t in transactions)
        tax_amount = sum(t.get("tax", 0) for t in transactions)
        net_amount = total_amount - fee_amount - tax_amount

        settlement = PaymentSettlement(
            settlementId=settlement_id,
            paymentGateway=payment_gateway,
            marketplace=marketplace,
            status=SettlementStatus.PENDING,
            settlementDate=settlement_date,
            periodStart=period_start,
            periodEnd=period_end,
            totalAmount=total_amount,
            totalOrders=len(transactions),
            feeAmount=fee_amount,
            taxAmount=tax_amount,
            netAmount=net_amount,
            rawData={"transactions": transactions}
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)

        return settlement

    async def match_payments(
        self,
        db: Session,
        settlement_id: UUID,
        auto_match: bool = True,
        tolerance_percentage: float = 1.0
    ) -> MatchPaymentResponse:
        """Match settlement transactions with orders."""
        settlement_stmt = select(PaymentSettlement).where(PaymentSettlement.id == settlement_id)
        settlement = db.exec(settlement_stmt).first()

        if not settlement:
            raise ValueError("Settlement not found")

        settlement.status = SettlementStatus.PROCESSING
        db.add(settlement)
        db.commit()

        matched = 0
        unmatched = 0
        discrepancies = 0

        transactions = settlement.rawData.get("transactions", []) if settlement.rawData else []

        for transaction in transactions:
            # In real implementation, would match against orders
            order_number = transaction.get("order_number")
            amount = transaction.get("amount", 0)

            if auto_match and order_number:
                # Simulate matching - in real implementation, query orders table
                matched += 1
            else:
                unmatched += 1
                # Create discrepancy record
                discrepancy = ReconciliationDiscrepancy(
                    settlementId=settlement.id,
                    orderNumber=order_number,
                    discrepancyType=DiscrepancyType.MISSING_PAYMENT if not order_number else DiscrepancyType.AMOUNT_MISMATCH,
                    expectedAmount=amount,
                    actualAmount=0,
                    differenceAmount=amount,
                    status="OPEN"
                )
                db.add(discrepancy)
                discrepancies += 1

        # Update settlement
        settlement.matchedOrders = matched
        settlement.matchedAmount = sum(
            t.get("amount", 0) for t in transactions[:matched]
        ) if transactions else 0
        settlement.unmatchedOrders = unmatched
        settlement.unmatchedAmount = settlement.totalAmount - settlement.matchedAmount

        if unmatched == 0:
            settlement.status = SettlementStatus.RECONCILED
            settlement.reconciledAt = datetime.now(timezone.utc)
        elif matched > 0:
            settlement.status = SettlementStatus.PARTIALLY_MATCHED
        else:
            settlement.status = SettlementStatus.DISPUTED

        db.add(settlement)
        db.commit()

        return MatchPaymentResponse(
            settlementId=settlement_id,
            totalProcessed=len(transactions),
            matched=matched,
            unmatched=unmatched,
            discrepancies=discrepancies
        )

    async def detect_discrepancies(
        self,
        db: Session,
        settlement_id: UUID
    ) -> List[ReconciliationDiscrepancy]:
        """Detect discrepancies in a settlement."""
        stmt = select(ReconciliationDiscrepancy).where(
            and_(
                ReconciliationDiscrepancy.settlementId == settlement_id,
                ReconciliationDiscrepancy.status == "OPEN"
            )
        )
        return db.exec(stmt).all()

    async def resolve_discrepancy(
        self,
        db: Session,
        discrepancy_id: UUID,
        resolution: str,
        resolved_by: UUID,
        notes: Optional[str] = None
    ) -> bool:
        """Resolve a discrepancy."""
        stmt = select(ReconciliationDiscrepancy).where(
            ReconciliationDiscrepancy.id == discrepancy_id
        )
        discrepancy = db.exec(stmt).first()

        if not discrepancy:
            return False

        discrepancy.status = "RESOLVED"
        discrepancy.resolution = resolution
        discrepancy.resolvedAt = datetime.now(timezone.utc)
        discrepancy.resolvedBy = resolved_by
        discrepancy.notes = notes
        db.add(discrepancy)
        db.commit()

        return True

    async def generate_report(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
        payment_gateway: Optional[str] = None,
        marketplace: Optional[str] = None
    ) -> ReconciliationReportResponse:
        """Generate reconciliation report."""
        # Get settlements
        stmt = select(PaymentSettlement).where(
            and_(
                PaymentSettlement.settlementDate >= period_start,
                PaymentSettlement.settlementDate <= period_end
            )
        )
        if payment_gateway:
            stmt = stmt.where(PaymentSettlement.paymentGateway == payment_gateway)
        if marketplace:
            stmt = stmt.where(PaymentSettlement.marketplace == marketplace)

        settlements = db.exec(stmt).all()

        total_amount = sum(s.totalAmount for s in settlements)
        matched_amount = sum(s.matchedAmount for s in settlements)
        unmatched_amount = sum(s.unmatchedAmount for s in settlements)

        # Get discrepancies
        settlement_ids = [s.id for s in settlements]
        if settlement_ids:
            disc_stmt = select(ReconciliationDiscrepancy).where(
                ReconciliationDiscrepancy.settlementId.in_(settlement_ids)
            )
            discrepancies = db.exec(disc_stmt).all()
            open_discrepancies = sum(1 for d in discrepancies if d.status == "OPEN")
            resolved_discrepancies = sum(1 for d in discrepancies if d.status == "RESOLVED")
        else:
            open_discrepancies = 0
            resolved_discrepancies = 0

        # Get chargebacks
        chargeback_stmt = select(Chargeback).where(
            and_(
                Chargeback.initiatedDate >= period_start,
                Chargeback.initiatedDate <= period_end
            )
        )
        chargebacks = db.exec(chargeback_stmt).all()
        chargeback_amount = sum(c.amount for c in chargebacks)

        return ReconciliationReportResponse(
            periodStart=period_start,
            periodEnd=period_end,
            totalSettlements=len(settlements),
            totalAmount=total_amount,
            matchedAmount=matched_amount,
            unmatchedAmount=unmatched_amount,
            openDiscrepancies=open_discrepancies,
            resolvedDiscrepancies=resolved_discrepancies,
            chargebacks=len(chargebacks),
            chargebackAmount=chargeback_amount
        )

    async def process_cod_remittance(
        self,
        db: Session,
        remittance_id: str,
        courier_partner: str,
        collection_date: datetime,
        total_collected: float,
        order_ids: List[str],
        deductions: float = 0,
        deduction_details: Optional[dict] = None
    ) -> CODRemittance:
        """Process COD remittance."""
        remittance = CODRemittance(
            remittanceId=remittance_id,
            courierPartner=courier_partner,
            status=CODStatus.COLLECTED,
            collectionDate=collection_date,
            totalCollected=total_collected,
            totalOrders=len(order_ids),
            pendingAmount=total_collected,
            deductions=deductions,
            deductionDetails=deduction_details,
            orderIds=order_ids
        )
        db.add(remittance)
        db.commit()
        db.refresh(remittance)

        return remittance


# Global service instance
reconciliation_engine = ReconciliationEngine()
