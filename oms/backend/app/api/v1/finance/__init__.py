"""
Finance API v1 - COD Reconciliation and Transactions
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    CODReconciliation, CODReconciliationCreate, CODReconciliationUpdate, CODReconciliationResponse,
    CODTransaction, CODTransactionCreate, CODTransactionResponse,
    User, CODReconciliationStatus
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

    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)
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

    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)
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
    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)

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
    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)

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
    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)

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
    if company_filter.company_id:
        query = query.where(CODReconciliation.companyId == company_filter.company_id)

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
