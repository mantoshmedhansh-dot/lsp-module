"""
Inbound API v1 - Goods receipt management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Inbound, InboundCreate, InboundUpdate, InboundResponse, InboundBrief,
    InboundItem, InboundItemCreate, InboundItemUpdate, InboundItemResponse,
    User, Location, InboundType, InboundStatus
)

router = APIRouter(prefix="/inbound", tags=["Inbound"])


# ============================================================================
# Inbound Endpoints
# ============================================================================

@router.get("", response_model=List[InboundBrief])
def list_inbounds(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[InboundStatus] = None,
    inbound_type: Optional[InboundType] = None,
    location_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List inbounds with pagination and filters."""
    query = select(Inbound)

    query = company_filter.apply_location_filter(query, Inbound.locationId)

    if status:
        query = query.where(Inbound.status == status)
    if inbound_type:
        query = query.where(Inbound.type == inbound_type)
    if location_id:
        query = query.where(Inbound.locationId == location_id)
    if date_from:
        query = query.where(Inbound.createdAt >= date_from)
    if date_to:
        query = query.where(Inbound.createdAt <= date_to)

    query = query.offset(skip).limit(limit).order_by(Inbound.createdAt.desc())

    inbounds = session.exec(query).all()
    return [InboundBrief.model_validate(i) for i in inbounds]


@router.get("/count")
def count_inbounds(
    status: Optional[InboundStatus] = None,
    inbound_type: Optional[InboundType] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of inbounds."""
    query = select(func.count(Inbound.id))

    query = company_filter.apply_location_filter(query, Inbound.locationId)

    if status:
        query = query.where(Inbound.status == status)
    if inbound_type:
        query = query.where(Inbound.type == inbound_type)
    if location_id:
        query = query.where(Inbound.locationId == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{inbound_id}", response_model=InboundResponse)
def get_inbound(
    inbound_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inbound by ID."""
    inbound = session.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")
    return InboundResponse.model_validate(inbound)


@router.post("", response_model=InboundResponse, status_code=status.HTTP_201_CREATED)
def create_inbound(
    data: InboundCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new inbound receipt."""
    inbound = Inbound.model_validate(data)
    session.add(inbound)
    session.commit()
    session.refresh(inbound)
    return InboundResponse.model_validate(inbound)


@router.patch("/{inbound_id}", response_model=InboundResponse)
def update_inbound(
    inbound_id: UUID,
    data: InboundUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update inbound."""
    inbound = session.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(inbound, field, value)

    session.add(inbound)
    session.commit()
    session.refresh(inbound)
    return InboundResponse.model_validate(inbound)


@router.post("/{inbound_id}/complete", response_model=InboundResponse)
def complete_inbound(
    inbound_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark inbound as completed."""
    inbound = session.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")

    inbound.status = InboundStatus.COMPLETED
    inbound.completedAt = datetime.utcnow()

    session.add(inbound)
    session.commit()
    session.refresh(inbound)
    return InboundResponse.model_validate(inbound)


@router.delete("/{inbound_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inbound(
    inbound_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete inbound (only if pending)."""
    inbound = session.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")

    if inbound.status != InboundStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete inbound that is not pending"
        )

    session.delete(inbound)
    session.commit()


# ============================================================================
# Inbound Items Endpoints
# ============================================================================

@router.get("/{inbound_id}/items", response_model=List[InboundItemResponse])
def list_inbound_items(
    inbound_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in an inbound receipt."""
    query = select(InboundItem).where(InboundItem.inboundId == inbound_id)
    items = session.exec(query).all()
    return [InboundItemResponse.model_validate(i) for i in items]


@router.post("/{inbound_id}/items", response_model=InboundItemResponse, status_code=status.HTTP_201_CREATED)
def add_inbound_item(
    inbound_id: UUID,
    data: InboundItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to inbound receipt."""
    inbound = session.get(Inbound, inbound_id)
    if not inbound:
        raise HTTPException(status_code=404, detail="Inbound not found")

    item_data = data.model_dump()
    item_data["inboundId"] = inbound_id
    item = InboundItem.model_validate(item_data)

    session.add(item)
    session.commit()
    session.refresh(item)
    return InboundItemResponse.model_validate(item)


@router.patch("/items/{item_id}", response_model=InboundItemResponse)
def update_inbound_item(
    item_id: UUID,
    data: InboundItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update inbound item."""
    item = session.get(InboundItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inbound item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return InboundItemResponse.model_validate(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inbound_item(
    item_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete inbound item."""
    item = session.get(InboundItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inbound item not found")

    session.delete(item)
    session.commit()
