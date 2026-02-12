"""
Finance API v1 - COD Reconciliation, Transactions, Invoices, Weight Discrepancies, Payment Ledger
"""
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    CODReconciliation, CODReconciliationCreate, CODReconciliationUpdate, CODReconciliationResponse,
    CODTransaction, CODTransactionCreate, CODTransactionResponse,
    User, CODReconciliationStatus,
    Invoice, InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    WeightDiscrepancy, WeightDiscrepancyCreate, WeightDiscrepancyUpdate, WeightDiscrepancyResponse,
    PaymentLedger, PaymentLedgerCreate, PaymentLedgerResponse,
)

router = APIRouter(prefix="/finance", tags=["Finance"])


# ============================================================================
# COD Reconciliation Endpoints
# ============================================================================

@router.get("/cod-reconciliations", response_model=List[CODReconciliationResponse])
def list_cod_reconciliations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[CODReconciliationStatus] = None,
    transporter_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List COD reconciliations."""
    query = select(CODReconciliation)

    query = company_filter.apply_filter(query, CODReconciliation.companyId)
    if status:
        query = query.where(CODReconciliation.status == status)
    if transporter_id:
        query = query.where(CODReconciliation.transporterId == transporter_id)

    query = query.offset(skip).limit(limit).order_by(CODReconciliation.createdAt.desc())
    reconciliations = session.exec(query).all()
    return [CODReconciliationResponse.model_validate(r) for r in reconciliations]


@router.get("/cod-reconciliations/count")
def count_cod_reconciliations(
    status: Optional[CODReconciliationStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of COD reconciliations."""
    query = select(func.count(CODReconciliation.id))

    query = company_filter.apply_filter(query, CODReconciliation.companyId)
    if status:
        query = query.where(CODReconciliation.status == status)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/cod-reconciliations/{reconciliation_id}", response_model=CODReconciliationResponse)
def get_cod_reconciliation(
    reconciliation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get COD reconciliation by ID."""
    query = select(CODReconciliation).where(CODReconciliation.id == reconciliation_id)
    query = company_filter.apply_filter(query, CODReconciliation.companyId)

    reconciliation = session.exec(query).first()
    if not reconciliation:
        raise HTTPException(status_code=404, detail="COD reconciliation not found")
    return CODReconciliationResponse.model_validate(reconciliation)


@router.post("/cod-reconciliations", response_model=CODReconciliationResponse, status_code=status.HTTP_201_CREATED)
def create_cod_reconciliation(
    data: CODReconciliationCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new COD reconciliation."""
    # Generate reconciliation number
    count = session.exec(select(func.count(CODReconciliation.id))).one()
    reconciliation_no = f"CODR-{count + 1:06d}"

    reconciliation = CODReconciliation(
        reconciliationNo=reconciliation_no,
        companyId=company_filter.company_id,
        createdById=current_user.id,
        **data.model_dump()
    )

    session.add(reconciliation)
    session.commit()
    session.refresh(reconciliation)
    return CODReconciliationResponse.model_validate(reconciliation)


@router.patch("/cod-reconciliations/{reconciliation_id}", response_model=CODReconciliationResponse)
def update_cod_reconciliation(
    reconciliation_id: UUID,
    data: CODReconciliationUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update COD reconciliation."""
    query = select(CODReconciliation).where(CODReconciliation.id == reconciliation_id)
    query = company_filter.apply_filter(query, CODReconciliation.companyId)

    reconciliation = session.exec(query).first()
    if not reconciliation:
        raise HTTPException(status_code=404, detail="COD reconciliation not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reconciliation, field, value)

    session.add(reconciliation)
    session.commit()
    session.refresh(reconciliation)
    return CODReconciliationResponse.model_validate(reconciliation)


@router.post("/cod-reconciliations/{reconciliation_id}/verify", response_model=CODReconciliationResponse)
def verify_cod_reconciliation(
    reconciliation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Verify COD reconciliation."""
    query = select(CODReconciliation).where(CODReconciliation.id == reconciliation_id)
    query = company_filter.apply_filter(query, CODReconciliation.companyId)

    reconciliation = session.exec(query).first()
    if not reconciliation:
        raise HTTPException(status_code=404, detail="COD reconciliation not found")

    reconciliation.status = CODReconciliationStatus.VERIFIED
    reconciliation.verifiedById = current_user.id
    reconciliation.verifiedAt = datetime.utcnow()

    session.add(reconciliation)
    session.commit()
    session.refresh(reconciliation)
    return CODReconciliationResponse.model_validate(reconciliation)


@router.post("/cod-reconciliations/{reconciliation_id}/complete", response_model=CODReconciliationResponse)
def complete_cod_reconciliation(
    reconciliation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Complete COD reconciliation."""
    query = select(CODReconciliation).where(CODReconciliation.id == reconciliation_id)
    query = company_filter.apply_filter(query, CODReconciliation.companyId)

    reconciliation = session.exec(query).first()
    if not reconciliation:
        raise HTTPException(status_code=404, detail="COD reconciliation not found")

    reconciliation.status = CODReconciliationStatus.COMPLETED
    reconciliation.completedAt = datetime.utcnow()

    session.add(reconciliation)
    session.commit()
    session.refresh(reconciliation)
    return CODReconciliationResponse.model_validate(reconciliation)


# ============================================================================
# COD Transaction Endpoints
# ============================================================================

@router.get("/cod-transactions", response_model=List[CODTransactionResponse])
def list_cod_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    reconciliation_id: Optional[UUID] = None,
    order_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List COD transactions."""
    query = select(CODTransaction)

    if reconciliation_id:
        query = query.where(CODTransaction.reconciliationId == reconciliation_id)
    if order_id:
        query = query.where(CODTransaction.orderId == order_id)

    query = query.offset(skip).limit(limit).order_by(CODTransaction.createdAt.desc())
    transactions = session.exec(query).all()
    return [CODTransactionResponse.model_validate(t) for t in transactions]


@router.get("/cod-transactions/{transaction_id}", response_model=CODTransactionResponse)
def get_cod_transaction(
    transaction_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get COD transaction by ID."""
    transaction = session.get(CODTransaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="COD transaction not found")
    return CODTransactionResponse.model_validate(transaction)


@router.post("/cod-transactions", response_model=CODTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_cod_transaction(
    data: CODTransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create COD transaction."""
    # Generate transaction number
    count = session.exec(select(func.count(CODTransaction.id))).one()
    transaction_no = f"CODT-{count + 1:06d}"

    transaction = CODTransaction(
        transactionNo=transaction_no,
        createdById=current_user.id,
        **data.model_dump()
    )

    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return CODTransactionResponse.model_validate(transaction)


# ============================================================================
# Invoice Endpoints
# ============================================================================

@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    invoice_type: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List invoices with optional filters."""
    query = select(Invoice)
    query = company_filter.apply_filter(query, Invoice.companyId)

    if status:
        query = query.where(Invoice.status == status)
    if invoice_type:
        query = query.where(Invoice.invoiceType == invoice_type)
    if search:
        query = query.where(Invoice.invoiceNumber.ilike(f"%{search}%"))

    query = query.offset(skip).limit(limit).order_by(Invoice.createdAt.desc())
    invoices = session.exec(query).all()
    return [InvoiceResponse.model_validate(inv) for inv in invoices]


@router.get("/invoices/stats")
def get_invoice_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get invoice summary stats."""
    base_query = select(Invoice)
    base_query = company_filter.apply_filter(base_query, Invoice.companyId)

    # Total count
    total_count = session.exec(
        select(func.count(Invoice.id)).where(
            company_filter.apply_filter(select(Invoice), Invoice.companyId).whereclause
        ) if company_filter.company_id else select(func.count(Invoice.id))
    ).one()

    # Totals by status
    stats = {}
    for s in ["draft", "sent", "paid", "overdue", "cancelled"]:
        q = select(func.count(Invoice.id))
        q = company_filter.apply_filter(q, Invoice.companyId)
        q = q.where(Invoice.status == s)
        stats[s] = session.exec(q).one()

    # Total amounts
    total_amount_q = select(func.coalesce(func.sum(Invoice.totalAmount), 0))
    total_amount_q = company_filter.apply_filter(total_amount_q, Invoice.companyId)
    total_amount = session.exec(total_amount_q).one()

    paid_amount_q = select(func.coalesce(func.sum(Invoice.totalAmount), 0))
    paid_amount_q = company_filter.apply_filter(paid_amount_q, Invoice.companyId)
    paid_amount_q = paid_amount_q.where(Invoice.status == "paid")
    paid_amount = session.exec(paid_amount_q).one()

    overdue_amount_q = select(func.coalesce(func.sum(Invoice.totalAmount), 0))
    overdue_amount_q = company_filter.apply_filter(overdue_amount_q, Invoice.companyId)
    overdue_amount_q = overdue_amount_q.where(Invoice.status == "overdue")
    overdue_amount = session.exec(overdue_amount_q).one()

    return {
        "totalInvoices": total_count,
        "draft": stats.get("draft", 0),
        "sent": stats.get("sent", 0),
        "paid": stats.get("paid", 0),
        "overdue": stats.get("overdue", 0),
        "cancelled": stats.get("cancelled", 0),
        "totalAmount": float(total_amount),
        "paidAmount": float(paid_amount),
        "overdueAmount": float(overdue_amount),
    }


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get invoice by ID."""
    query = select(Invoice).where(Invoice.id == invoice_id)
    query = company_filter.apply_filter(query, Invoice.companyId)

    invoice = session.exec(query).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new invoice."""
    invoice_data = data.model_dump()
    # Parse date strings
    if invoice_data.get("invoiceDate"):
        invoice_data["invoiceDate"] = date.fromisoformat(invoice_data["invoiceDate"])
    if invoice_data.get("dueDate"):
        invoice_data["dueDate"] = date.fromisoformat(invoice_data["dueDate"])

    invoice = Invoice(
        companyId=company_filter.company_id,
        **invoice_data
    )

    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update invoice."""
    query = select(Invoice).where(Invoice.id == invoice_id)
    query = company_filter.apply_filter(query, Invoice.companyId)

    invoice = session.exec(query).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = data.model_dump(exclude_unset=True)
    # Parse date strings if present
    if "invoiceDate" in update_data and update_data["invoiceDate"]:
        update_data["invoiceDate"] = date.fromisoformat(update_data["invoiceDate"])
    if "dueDate" in update_data and update_data["dueDate"]:
        update_data["dueDate"] = date.fromisoformat(update_data["dueDate"])

    for field, value in update_data.items():
        setattr(invoice, field, value)

    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.post("/invoices/{invoice_id}/mark-paid", response_model=InvoiceResponse)
def mark_invoice_paid(
    invoice_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Mark invoice as paid."""
    query = select(Invoice).where(Invoice.id == invoice_id)
    query = company_filter.apply_filter(query, Invoice.companyId)

    invoice = session.exec(query).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot mark cancelled invoice as paid")

    invoice.status = "paid"

    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


# ============================================================================
# Weight Discrepancy Endpoints
# ============================================================================

@router.get("/weight-discrepancies", response_model=List[WeightDiscrepancyResponse])
def list_weight_discrepancies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    courier_name: Optional[str] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List weight discrepancies with optional filters."""
    query = select(WeightDiscrepancy)
    query = company_filter.apply_filter(query, WeightDiscrepancy.companyId)

    if status:
        query = query.where(WeightDiscrepancy.status == status)
    if courier_name:
        query = query.where(WeightDiscrepancy.courierName == courier_name)
    if search:
        query = query.where(WeightDiscrepancy.awbNumber.ilike(f"%{search}%"))

    query = query.offset(skip).limit(limit).order_by(WeightDiscrepancy.createdAt.desc())
    discrepancies = session.exec(query).all()
    return [WeightDiscrepancyResponse.model_validate(d) for d in discrepancies]


@router.get("/weight-discrepancies/stats")
def get_weight_discrepancy_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get weight discrepancy summary stats."""
    # Count by status
    stats = {}
    for s in ["pending", "accepted", "disputed", "resolved"]:
        q = select(func.count(WeightDiscrepancy.id))
        q = company_filter.apply_filter(q, WeightDiscrepancy.companyId)
        q = q.where(WeightDiscrepancy.status == s)
        stats[s] = session.exec(q).one()

    # Total excess charge
    excess_q = select(func.coalesce(func.sum(WeightDiscrepancy.excessCharge), 0))
    excess_q = company_filter.apply_filter(excess_q, WeightDiscrepancy.companyId)
    total_excess = session.exec(excess_q).one()

    # Pending excess charge
    pending_excess_q = select(func.coalesce(func.sum(WeightDiscrepancy.excessCharge), 0))
    pending_excess_q = company_filter.apply_filter(pending_excess_q, WeightDiscrepancy.companyId)
    pending_excess_q = pending_excess_q.where(WeightDiscrepancy.status == "pending")
    pending_excess = session.exec(pending_excess_q).one()

    # Total count
    total_q = select(func.count(WeightDiscrepancy.id))
    total_q = company_filter.apply_filter(total_q, WeightDiscrepancy.companyId)
    total_count = session.exec(total_q).one()

    return {
        "totalDiscrepancies": total_count,
        "pending": stats.get("pending", 0),
        "accepted": stats.get("accepted", 0),
        "disputed": stats.get("disputed", 0),
        "resolved": stats.get("resolved", 0),
        "totalExcessCharge": float(total_excess),
        "pendingExcessCharge": float(pending_excess),
    }


@router.get("/weight-discrepancies/{discrepancy_id}", response_model=WeightDiscrepancyResponse)
def get_weight_discrepancy(
    discrepancy_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get weight discrepancy by ID."""
    query = select(WeightDiscrepancy).where(WeightDiscrepancy.id == discrepancy_id)
    query = company_filter.apply_filter(query, WeightDiscrepancy.companyId)

    discrepancy = session.exec(query).first()
    if not discrepancy:
        raise HTTPException(status_code=404, detail="Weight discrepancy not found")
    return WeightDiscrepancyResponse.model_validate(discrepancy)


@router.post("/weight-discrepancies", response_model=WeightDiscrepancyResponse, status_code=status.HTTP_201_CREATED)
def create_weight_discrepancy(
    data: WeightDiscrepancyCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create weight discrepancy record."""
    disc_data = data.model_dump()
    # Calculate weight diff and excess charge
    declared = disc_data.get("declaredWeight", 0)
    actual = disc_data.get("actualWeight", 0)
    disc_data["weightDiff"] = round(actual - declared, 3)
    disc_data["excessCharge"] = round(disc_data.get("chargedAmount", 0) - disc_data.get("expectedAmount", 0), 2)

    discrepancy = WeightDiscrepancy(
        companyId=company_filter.company_id,
        **disc_data
    )

    session.add(discrepancy)
    session.commit()
    session.refresh(discrepancy)
    return WeightDiscrepancyResponse.model_validate(discrepancy)


@router.post("/weight-discrepancies/{discrepancy_id}/dispute", response_model=WeightDiscrepancyResponse)
def dispute_weight_discrepancy(
    discrepancy_id: UUID,
    reason: Optional[str] = Query(None, description="Dispute reason"),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Dispute a weight discrepancy."""
    query = select(WeightDiscrepancy).where(WeightDiscrepancy.id == discrepancy_id)
    query = company_filter.apply_filter(query, WeightDiscrepancy.companyId)

    discrepancy = session.exec(query).first()
    if not discrepancy:
        raise HTTPException(status_code=404, detail="Weight discrepancy not found")

    if discrepancy.status not in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail=f"Cannot dispute discrepancy with status '{discrepancy.status}'")

    discrepancy.status = "disputed"
    if reason:
        discrepancy.disputeReason = reason

    session.add(discrepancy)
    session.commit()
    session.refresh(discrepancy)
    return WeightDiscrepancyResponse.model_validate(discrepancy)


# ============================================================================
# Payment Ledger Endpoints
# ============================================================================

@router.get("/payment-ledger", response_model=List[PaymentLedgerResponse])
def list_payment_ledger(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    entry_type: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List payment ledger entries with optional filters."""
    query = select(PaymentLedger)
    query = company_filter.apply_filter(query, PaymentLedger.companyId)

    if entry_type:
        query = query.where(PaymentLedger.entryType == entry_type)
    if category:
        query = query.where(PaymentLedger.category == category)
    if date_from:
        query = query.where(PaymentLedger.entryDate >= date.fromisoformat(date_from))
    if date_to:
        query = query.where(PaymentLedger.entryDate <= date.fromisoformat(date_to))

    query = query.offset(skip).limit(limit).order_by(PaymentLedger.createdAt.desc())
    entries = session.exec(query).all()
    return [PaymentLedgerResponse.model_validate(e) for e in entries]


@router.get("/payment-ledger/balance")
def get_payment_ledger_balance(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current payment ledger balance."""
    # Sum of credits
    credit_q = select(func.coalesce(func.sum(PaymentLedger.amount), 0))
    credit_q = company_filter.apply_filter(credit_q, PaymentLedger.companyId)
    credit_q = credit_q.where(PaymentLedger.entryType == "credit")
    total_credit = session.exec(credit_q).one()

    # Sum of debits
    debit_q = select(func.coalesce(func.sum(PaymentLedger.amount), 0))
    debit_q = company_filter.apply_filter(debit_q, PaymentLedger.companyId)
    debit_q = debit_q.where(PaymentLedger.entryType == "debit")
    total_debit = session.exec(debit_q).one()

    # Total entries
    count_q = select(func.count(PaymentLedger.id))
    count_q = company_filter.apply_filter(count_q, PaymentLedger.companyId)
    total_entries = session.exec(count_q).one()

    balance = float(total_credit) - float(total_debit)

    return {
        "totalCredit": float(total_credit),
        "totalDebit": float(total_debit),
        "balance": balance,
        "totalEntries": total_entries,
    }


@router.post("/payment-ledger", response_model=PaymentLedgerResponse, status_code=status.HTTP_201_CREATED)
def create_payment_ledger_entry(
    data: PaymentLedgerCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create payment ledger entry."""
    entry_data = data.model_dump()
    # Parse date string
    if entry_data.get("entryDate"):
        entry_data["entryDate"] = date.fromisoformat(entry_data["entryDate"])

    # Calculate running balance from previous entry
    last_entry_q = select(PaymentLedger)
    last_entry_q = company_filter.apply_filter(last_entry_q, PaymentLedger.companyId)
    last_entry_q = last_entry_q.order_by(PaymentLedger.createdAt.desc()).limit(1)
    last_entry = session.exec(last_entry_q).first()

    prev_balance = float(last_entry.runningBalance) if last_entry else 0.0
    amount = entry_data.get("amount", 0)
    if entry_data.get("entryType") == "credit":
        entry_data["runningBalance"] = round(prev_balance + amount, 2)
    else:
        entry_data["runningBalance"] = round(prev_balance - amount, 2)

    entry = PaymentLedger(
        companyId=company_filter.company_id,
        **entry_data
    )

    session.add(entry)
    session.commit()
    session.refresh(entry)
    return PaymentLedgerResponse.model_validate(entry)


# ============================================================================
# Finance Dashboard Endpoint
# ============================================================================

@router.get("/dashboard")
def get_finance_dashboard(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get finance dashboard summary."""
    # Total revenue (paid invoices)
    revenue_q = select(func.coalesce(func.sum(Invoice.totalAmount), 0))
    revenue_q = company_filter.apply_filter(revenue_q, Invoice.companyId)
    revenue_q = revenue_q.where(Invoice.status == "paid")
    total_revenue = session.exec(revenue_q).one()

    # Pending payments (sent + overdue invoices)
    pending_q = select(func.coalesce(func.sum(Invoice.totalAmount), 0))
    pending_q = company_filter.apply_filter(pending_q, Invoice.companyId)
    pending_q = pending_q.where(Invoice.status.in_(["sent", "overdue"]))
    pending_payments = session.exec(pending_q).one()

    # COD Pending (from COD reconciliations)
    cod_pending_q = select(func.coalesce(func.sum(CODReconciliation.expectedAmount - CODReconciliation.remittedAmount), 0))
    cod_pending_q = company_filter.apply_filter(cod_pending_q, CODReconciliation.companyId)
    cod_pending_q = cod_pending_q.where(CODReconciliation.status == CODReconciliationStatus.PENDING)
    cod_pending = session.exec(cod_pending_q).one()

    # Freight charges (freight-type invoices total)
    freight_q = select(func.coalesce(func.sum(Invoice.totalAmount), 0))
    freight_q = company_filter.apply_filter(freight_q, Invoice.companyId)
    freight_q = freight_q.where(Invoice.invoiceType == "freight")
    freight_charges = session.exec(freight_q).one()

    # Weight discrepancy amount
    wd_q = select(func.coalesce(func.sum(WeightDiscrepancy.excessCharge), 0))
    wd_q = company_filter.apply_filter(wd_q, WeightDiscrepancy.companyId)
    weight_discrepancy_amount = session.exec(wd_q).one()

    # Invoice counts by status
    invoice_counts = {}
    for s in ["draft", "sent", "paid", "overdue", "cancelled"]:
        q = select(func.count(Invoice.id))
        q = company_filter.apply_filter(q, Invoice.companyId)
        q = q.where(Invoice.status == s)
        invoice_counts[s] = session.exec(q).one()

    return {
        "totalRevenue": float(total_revenue),
        "pendingPayments": float(pending_payments),
        "codPending": float(cod_pending),
        "freightCharges": float(freight_charges),
        "weightDiscrepancyAmount": float(weight_discrepancy_amount),
        "invoiceCounts": invoice_counts,
    }
