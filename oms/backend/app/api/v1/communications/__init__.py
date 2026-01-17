"""
Communications API v1 - Templates and Proactive Communications
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    CommunicationTemplate, CommunicationTemplateCreate, CommunicationTemplateUpdate, CommunicationTemplateResponse,
    ProactiveCommunication, ProactiveCommunicationCreate, ProactiveCommunicationUpdate, ProactiveCommunicationResponse,
    User, CommunicationTrigger, OutreachChannel, OutreachStatus
)

router = APIRouter(prefix="/communications", tags=["Communications"])


# ============================================================================
# Communication Template Endpoints
# ============================================================================

@router.get("/templates", response_model=List[CommunicationTemplateResponse])
def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    trigger: Optional[CommunicationTrigger] = None,
    channel: Optional[OutreachChannel] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List communication templates."""
    query = select(CommunicationTemplate)

    if company_filter.company_id:
        query = query.where(CommunicationTemplate.companyId == company_filter.company_id)
    if trigger:
        query = query.where(CommunicationTemplate.trigger == trigger)
    if channel:
        query = query.where(CommunicationTemplate.channel == channel)
    if is_active is not None:
        query = query.where(CommunicationTemplate.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(CommunicationTemplate.name)
    templates = session.exec(query).all()
    return [CommunicationTemplateResponse.model_validate(t) for t in templates]


@router.get("/templates/{template_id}", response_model=CommunicationTemplateResponse)
def get_template(
    template_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get template by ID."""
    query = select(CommunicationTemplate).where(CommunicationTemplate.id == template_id)
    if company_filter.company_id:
        query = query.where(CommunicationTemplate.companyId == company_filter.company_id)

    template = session.exec(query).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return CommunicationTemplateResponse.model_validate(template)


@router.post("/templates", response_model=CommunicationTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    data: CommunicationTemplateCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new template."""
    template = CommunicationTemplate.model_validate(data)
    if company_filter.company_id:
        template.companyId = company_filter.company_id

    session.add(template)
    session.commit()
    session.refresh(template)
    return CommunicationTemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=CommunicationTemplateResponse)
def update_template(
    template_id: UUID,
    data: CommunicationTemplateUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update template."""
    query = select(CommunicationTemplate).where(CommunicationTemplate.id == template_id)
    if company_filter.company_id:
        query = query.where(CommunicationTemplate.companyId == company_filter.company_id)

    template = session.exec(query).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    session.add(template)
    session.commit()
    session.refresh(template)
    return CommunicationTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete template."""
    query = select(CommunicationTemplate).where(CommunicationTemplate.id == template_id)
    if company_filter.company_id:
        query = query.where(CommunicationTemplate.companyId == company_filter.company_id)

    template = session.exec(query).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    session.delete(template)
    session.commit()


# ============================================================================
# Proactive Communication Endpoints
# ============================================================================

@router.get("/outreach", response_model=List[ProactiveCommunicationResponse])
def list_proactive_communications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[OutreachStatus] = None,
    trigger: Optional[CommunicationTrigger] = None,
    channel: Optional[OutreachChannel] = None,
    order_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List proactive communications."""
    query = select(ProactiveCommunication)

    if company_filter.company_id:
        query = query.where(ProactiveCommunication.companyId == company_filter.company_id)
    if status:
        query = query.where(ProactiveCommunication.status == status)
    if trigger:
        query = query.where(ProactiveCommunication.trigger == trigger)
    if channel:
        query = query.where(ProactiveCommunication.channel == channel)
    if order_id:
        query = query.where(ProactiveCommunication.orderId == order_id)
    if customer_id:
        query = query.where(ProactiveCommunication.customerId == customer_id)

    query = query.offset(skip).limit(limit).order_by(ProactiveCommunication.createdAt.desc())
    communications = session.exec(query).all()
    return [ProactiveCommunicationResponse.model_validate(c) for c in communications]


@router.get("/outreach/count")
def count_proactive_communications(
    status: Optional[OutreachStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of proactive communications."""
    query = select(func.count(ProactiveCommunication.id))

    if company_filter.company_id:
        query = query.where(ProactiveCommunication.companyId == company_filter.company_id)
    if status:
        query = query.where(ProactiveCommunication.status == status)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/outreach/{communication_id}", response_model=ProactiveCommunicationResponse)
def get_proactive_communication(
    communication_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get proactive communication by ID."""
    query = select(ProactiveCommunication).where(ProactiveCommunication.id == communication_id)
    if company_filter.company_id:
        query = query.where(ProactiveCommunication.companyId == company_filter.company_id)

    communication = session.exec(query).first()
    if not communication:
        raise HTTPException(status_code=404, detail="Communication not found")
    return ProactiveCommunicationResponse.model_validate(communication)


@router.post("/outreach", response_model=ProactiveCommunicationResponse, status_code=status.HTTP_201_CREATED)
def create_proactive_communication(
    data: ProactiveCommunicationCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create proactive communication."""
    # Generate communication number
    count = session.exec(select(func.count(ProactiveCommunication.id))).one()
    communication_no = f"COMM-{count + 1:06d}"

    communication = ProactiveCommunication(
        communicationNo=communication_no,
        companyId=company_filter.company_id,
        **data.model_dump()
    )

    session.add(communication)
    session.commit()
    session.refresh(communication)
    return ProactiveCommunicationResponse.model_validate(communication)


@router.patch("/outreach/{communication_id}", response_model=ProactiveCommunicationResponse)
def update_proactive_communication(
    communication_id: UUID,
    data: ProactiveCommunicationUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update proactive communication."""
    query = select(ProactiveCommunication).where(ProactiveCommunication.id == communication_id)
    if company_filter.company_id:
        query = query.where(ProactiveCommunication.companyId == company_filter.company_id)

    communication = session.exec(query).first()
    if not communication:
        raise HTTPException(status_code=404, detail="Communication not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(communication, field, value)

    session.add(communication)
    session.commit()
    session.refresh(communication)
    return ProactiveCommunicationResponse.model_validate(communication)


@router.post("/outreach/{communication_id}/send", response_model=ProactiveCommunicationResponse)
def send_proactive_communication(
    communication_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Send proactive communication."""
    query = select(ProactiveCommunication).where(ProactiveCommunication.id == communication_id)
    if company_filter.company_id:
        query = query.where(ProactiveCommunication.companyId == company_filter.company_id)

    communication = session.exec(query).first()
    if not communication:
        raise HTTPException(status_code=404, detail="Communication not found")

    # Update status to sent (actual sending would be handled by background job)
    communication.status = OutreachStatus.SENT
    communication.sentAt = datetime.utcnow()

    session.add(communication)
    session.commit()
    session.refresh(communication)
    return ProactiveCommunicationResponse.model_validate(communication)
