"""
System API v1 - Audit Logs, Exceptions, Sequences
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    AuditLog, AuditLogCreate, AuditLogResponse,
    Exception as ExceptionModel, ExceptionCreate, ExceptionUpdate, ExceptionResponse,
    Sequence, SequenceCreate, SequenceResponse,
    User
)

router = APIRouter(prefix="/system", tags=["System"])


# ============================================================================
# Audit Log Endpoints
# ============================================================================

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    action: Optional[str] = None,
    user_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """List audit logs. Admin only."""
    try:
        query = select(AuditLog)

        if entity_type:
            query = query.where(AuditLog.entityType == entity_type)
        if entity_id:
            query = query.where(AuditLog.entityId == entity_id)
        if action:
            query = query.where(AuditLog.action == action)
        if user_id:
            query = query.where(AuditLog.userId == user_id)
        if date_from:
            query = query.where(AuditLog.createdAt >= date_from)
        if date_to:
            query = query.where(AuditLog.createdAt <= date_to)

        query = query.offset(skip).limit(limit).order_by(AuditLog.createdAt.desc())
        logs = session.exec(query).all()
        return [AuditLogResponse.model_validate(l) for l in logs]
    except Exception:
        # Table may not exist yet — return empty list
        return []


@router.get("/audit-logs/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    log_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Get audit log by ID. Admin only."""
    log = session.get(AuditLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return AuditLogResponse.model_validate(log)


@router.get("/audit-logs/entity/{entity_type}/{entity_id}", response_model=List[AuditLogResponse])
def get_entity_audit_history(
    entity_type: str,
    entity_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get audit history for a specific entity."""
    query = select(AuditLog).where(
        AuditLog.entityType == entity_type,
        AuditLog.entityId == entity_id
    ).offset(skip).limit(limit).order_by(AuditLog.createdAt.desc())

    logs = session.exec(query).all()
    return [AuditLogResponse.model_validate(l) for l in logs]


# ============================================================================
# Exception Endpoints
# ============================================================================

@router.get("/exceptions", response_model=List[ExceptionResponse])
def list_exceptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    order_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List exceptions."""
    query = select(ExceptionModel)
    query = company_filter.apply_filter(query, ExceptionModel.companyId)
    if type:
        query = query.where(ExceptionModel.type == type)
    if severity:
        query = query.where(ExceptionModel.severity == severity)
    if status:
        query = query.where(ExceptionModel.status == status)
    if order_id:
        query = query.where(ExceptionModel.orderId == order_id)

    query = query.offset(skip).limit(limit).order_by(ExceptionModel.createdAt.desc())
    exceptions = session.exec(query).all()
    return [ExceptionResponse.model_validate(e) for e in exceptions]


@router.get("/exceptions/count")
def count_exceptions(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get exception counts."""
    query = select(func.count(ExceptionModel.id))
    query = company_filter.apply_filter(query, ExceptionModel.companyId)
    if status:
        query = query.where(ExceptionModel.status == status)
    if severity:
        query = query.where(ExceptionModel.severity == severity)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/exceptions/{exception_id}", response_model=ExceptionResponse)
def get_exception(
    exception_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get exception by ID."""
    query = select(ExceptionModel).where(ExceptionModel.id == exception_id)
    query = company_filter.apply_filter(query, ExceptionModel.companyId)

    exception = session.exec(query).first()
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return ExceptionResponse.model_validate(exception)


@router.post("/exceptions", response_model=ExceptionResponse, status_code=status.HTTP_201_CREATED)
def create_exception(
    data: ExceptionCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create exception."""
    # Generate exception code
    count = session.exec(select(func.count(ExceptionModel.id))).one()
    exception_code = f"EXC-{count + 1:06d}"

    exception = ExceptionModel(
        exceptionCode=exception_code,
        companyId=company_filter.company_id,
        **data.model_dump()
    )

    session.add(exception)
    session.commit()
    session.refresh(exception)
    return ExceptionResponse.model_validate(exception)


@router.patch("/exceptions/{exception_id}", response_model=ExceptionResponse)
def update_exception(
    exception_id: UUID,
    data: ExceptionUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update exception."""
    query = select(ExceptionModel).where(ExceptionModel.id == exception_id)
    query = company_filter.apply_filter(query, ExceptionModel.companyId)

    exception = session.exec(query).first()
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exception, field, value)

    session.add(exception)
    session.commit()
    session.refresh(exception)
    return ExceptionResponse.model_validate(exception)


@router.post("/exceptions/{exception_id}/resolve", response_model=ExceptionResponse)
def resolve_exception(
    exception_id: UUID,
    resolution: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Resolve exception."""
    query = select(ExceptionModel).where(ExceptionModel.id == exception_id)
    query = company_filter.apply_filter(query, ExceptionModel.companyId)

    exception = session.exec(query).first()
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    exception.status = "RESOLVED"
    exception.resolution = resolution
    exception.resolvedBy = str(current_user.id)
    exception.resolvedAt = datetime.utcnow()

    session.add(exception)
    session.commit()
    session.refresh(exception)
    return ExceptionResponse.model_validate(exception)


# ============================================================================
# Sequence Endpoints
# ============================================================================

@router.get("/sequences", response_model=List[SequenceResponse])
def list_sequences(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """List sequences. Admin only."""
    query = select(Sequence).order_by(Sequence.name)
    sequences = session.exec(query).all()
    return [SequenceResponse.model_validate(s) for s in sequences]


@router.get("/sequences/{sequence_name}", response_model=SequenceResponse)
def get_sequence(
    sequence_name: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Get sequence by name. Admin only."""
    query = select(Sequence).where(Sequence.name == sequence_name)
    sequence = session.exec(query).first()
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return SequenceResponse.model_validate(sequence)


@router.post("/sequences", response_model=SequenceResponse, status_code=status.HTTP_201_CREATED)
def create_sequence(
    data: SequenceCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Create sequence. Admin only."""
    # Check if sequence exists
    existing = session.exec(
        select(Sequence).where(Sequence.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Sequence already exists")

    sequence = Sequence.model_validate(data)
    session.add(sequence)
    session.commit()
    session.refresh(sequence)
    return SequenceResponse.model_validate(sequence)


@router.post("/sequences/{sequence_name}/next")
def get_next_sequence_value(
    sequence_name: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get next sequence value and increment."""
    query = select(Sequence).where(Sequence.name == sequence_name)
    sequence = session.exec(query).first()

    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")

    # Get current value and increment
    current = sequence.currentValue
    sequence.currentValue += sequence.increment

    # Build formatted value
    value = f"{sequence.prefix or ''}{current:06d}{sequence.suffix or ''}"

    session.add(sequence)
    session.commit()

    return {"value": value, "raw_value": current}
