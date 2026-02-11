"""
QC API v1 - Quality Control management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    QCTemplate, QCTemplateCreate, QCTemplateUpdate, QCTemplateResponse,
    QCParameter, QCParameterCreate, QCParameterUpdate, QCParameterResponse,
    QCExecution, QCExecutionCreate, QCExecutionUpdate, QCExecutionResponse,
    QCResult, QCResultCreate, QCResultUpdate, QCResultResponse,
    QCDefect, QCDefectCreate, QCDefectUpdate, QCDefectResponse,
    User, QCType, QCStatus, QCParameterType
)

router = APIRouter(prefix="/qc", tags=["Quality Control"])


# ============================================================================
# QC Template Endpoints
# ============================================================================

@router.get("/templates", response_model=List[QCTemplateResponse])
def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    qc_type: Optional[QCType] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List QC templates."""
    query = select(QCTemplate)

    query = company_filter.apply_filter(query, QCTemplate.companyId)
    if qc_type:
        query = query.where(QCTemplate.type == qc_type)
    if is_active is not None:
        query = query.where(QCTemplate.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(QCTemplate.name)

    templates = session.exec(query).all()
    return [QCTemplateResponse.model_validate(t) for t in templates]


@router.get("/templates/{template_id}", response_model=QCTemplateResponse)
def get_template(
    template_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get QC template by ID."""
    template = session.get(QCTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="QC template not found")
    return QCTemplateResponse.model_validate(template)


@router.post("/templates", response_model=QCTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    data: QCTemplateCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new QC template."""
    template = QCTemplate.model_validate(data)
    session.add(template)
    session.commit()
    session.refresh(template)
    return QCTemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=QCTemplateResponse)
def update_template(
    template_id: UUID,
    data: QCTemplateUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update QC template."""
    template = session.get(QCTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="QC template not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    session.add(template)
    session.commit()
    session.refresh(template)
    return QCTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete QC template."""
    template = session.get(QCTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="QC template not found")

    session.delete(template)
    session.commit()


# ============================================================================
# QC Parameter Endpoints
# ============================================================================

@router.get("/parameters", response_model=List[QCParameterResponse])
def list_all_parameters(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all QC parameters across all templates."""
    query = select(QCParameter)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(QCParameter.name.ilike(search_pattern))
    if category:
        query = query.where(QCParameter.parameterType == category)

    query = query.offset(skip).limit(limit).order_by(QCParameter.name)

    try:
        params = session.exec(query).all()
        return [QCParameterResponse.model_validate(p) for p in params]
    except Exception:
        return []


@router.get("/templates/{template_id}/parameters", response_model=List[QCParameterResponse])
def list_parameters(
    template_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List parameters for a template."""
    query = select(QCParameter).where(
        QCParameter.templateId == template_id
    ).order_by(QCParameter.sequence)

    params = session.exec(query).all()
    return [QCParameterResponse.model_validate(p) for p in params]


@router.post("/templates/{template_id}/parameters", response_model=QCParameterResponse, status_code=status.HTTP_201_CREATED)
def create_parameter(
    template_id: UUID,
    data: QCParameterCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Add parameter to template."""
    param_data = data.model_dump()
    param_data["templateId"] = template_id
    param = QCParameter.model_validate(param_data)

    session.add(param)
    session.commit()
    session.refresh(param)
    return QCParameterResponse.model_validate(param)


@router.patch("/parameters/{parameter_id}", response_model=QCParameterResponse)
def update_parameter(
    parameter_id: UUID,
    data: QCParameterUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update QC parameter."""
    param = session.get(QCParameter, parameter_id)
    if not param:
        raise HTTPException(status_code=404, detail="QC parameter not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(param, field, value)

    session.add(param)
    session.commit()
    session.refresh(param)
    return QCParameterResponse.model_validate(param)


@router.delete("/parameters/{parameter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parameter(
    parameter_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete QC parameter."""
    param = session.get(QCParameter, parameter_id)
    if not param:
        raise HTTPException(status_code=404, detail="QC parameter not found")

    session.delete(param)
    session.commit()


# ============================================================================
# QC Execution Endpoints
# ============================================================================

@router.get("/executions", response_model=List[QCExecutionResponse])
def list_executions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[QCStatus] = None,
    template_id: Optional[UUID] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List QC executions."""
    query = select(QCExecution)

    if status:
        query = query.where(QCExecution.status == status)
    if template_id:
        query = query.where(QCExecution.templateId == template_id)
    if reference_type:
        query = query.where(QCExecution.referenceType == reference_type)
    if reference_id:
        query = query.where(QCExecution.referenceId == reference_id)

    query = query.offset(skip).limit(limit).order_by(QCExecution.performedAt.desc())

    executions = session.exec(query).all()
    return [QCExecutionResponse.model_validate(e) for e in executions]


@router.get("/executions/{execution_id}", response_model=QCExecutionResponse)
def get_execution(
    execution_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get QC execution by ID."""
    execution = session.get(QCExecution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="QC execution not found")
    return QCExecutionResponse.model_validate(execution)


@router.post("/executions", response_model=QCExecutionResponse, status_code=status.HTTP_201_CREATED)
def create_execution(
    data: QCExecutionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new QC execution."""
    execution = QCExecution.model_validate(data)
    session.add(execution)
    session.commit()
    session.refresh(execution)
    return QCExecutionResponse.model_validate(execution)


@router.patch("/executions/{execution_id}", response_model=QCExecutionResponse)
def update_execution(
    execution_id: UUID,
    data: QCExecutionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update QC execution."""
    execution = session.get(QCExecution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="QC execution not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(execution, field, value)

    session.add(execution)
    session.commit()
    session.refresh(execution)
    return QCExecutionResponse.model_validate(execution)


@router.post("/executions/{execution_id}/complete", response_model=QCExecutionResponse)
def complete_execution(
    execution_id: UUID,
    passed_qty: int,
    failed_qty: int,
    overall_grade: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete QC execution."""
    execution = session.get(QCExecution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="QC execution not found")

    execution.passedQty = passed_qty
    execution.failedQty = failed_qty
    execution.overallGrade = overall_grade
    execution.completedAt = datetime.utcnow()

    if failed_qty == 0:
        execution.status = QCStatus.PASSED
    elif passed_qty == 0:
        execution.status = QCStatus.FAILED
    else:
        execution.status = QCStatus.PARTIAL

    session.add(execution)
    session.commit()
    session.refresh(execution)
    return QCExecutionResponse.model_validate(execution)


# ============================================================================
# QC Result Endpoints
# ============================================================================

@router.get("/executions/{execution_id}/results", response_model=List[QCResultResponse])
def list_results(
    execution_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List results for an execution."""
    query = select(QCResult).where(QCResult.executionId == execution_id)
    results = session.exec(query).all()
    return [QCResultResponse.model_validate(r) for r in results]


@router.post("/executions/{execution_id}/results", response_model=QCResultResponse, status_code=status.HTTP_201_CREATED)
def add_result(
    execution_id: UUID,
    data: QCResultCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add result to execution."""
    result_data = data.model_dump()
    result_data["executionId"] = execution_id
    result = QCResult.model_validate(result_data)

    session.add(result)
    session.commit()
    session.refresh(result)
    return QCResultResponse.model_validate(result)


@router.patch("/results/{result_id}", response_model=QCResultResponse)
def update_result(
    result_id: UUID,
    data: QCResultUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update QC result."""
    result = session.get(QCResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="QC result not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(result, field, value)

    session.add(result)
    session.commit()
    session.refresh(result)
    return QCResultResponse.model_validate(result)


# ============================================================================
# QC Defect Endpoints
# ============================================================================

@router.get("/executions/{execution_id}/defects", response_model=List[QCDefectResponse])
def list_defects(
    execution_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List defects for an execution."""
    query = select(QCDefect).where(QCDefect.executionId == execution_id)
    defects = session.exec(query).all()
    return [QCDefectResponse.model_validate(d) for d in defects]


@router.post("/executions/{execution_id}/defects", response_model=QCDefectResponse, status_code=status.HTTP_201_CREATED)
def add_defect(
    execution_id: UUID,
    data: QCDefectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add defect to execution."""
    defect_data = data.model_dump()
    defect_data["executionId"] = execution_id
    defect = QCDefect.model_validate(defect_data)

    session.add(defect)
    session.commit()
    session.refresh(defect)
    return QCDefectResponse.model_validate(defect)


@router.patch("/defects/{defect_id}", response_model=QCDefectResponse)
def update_defect(
    defect_id: UUID,
    data: QCDefectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update QC defect."""
    defect = session.get(QCDefect, defect_id)
    if not defect:
        raise HTTPException(status_code=404, detail="QC defect not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(defect, field, value)

    session.add(defect)
    session.commit()
    session.refresh(defect)
    return QCDefectResponse.model_validate(defect)
