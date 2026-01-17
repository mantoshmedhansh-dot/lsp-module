"""
Wave API v1 - Wave picking and picklist management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Wave, WaveCreate, WaveUpdate, WaveResponse, WaveBrief,
    WaveItem, WaveItemCreate, WaveItemUpdate, WaveItemResponse,
    WaveOrder, WaveOrderCreate, WaveOrderUpdate, WaveOrderResponse,
    Picklist, PicklistCreate, PicklistUpdate, PicklistResponse,
    PicklistItem, PicklistItemCreate, PicklistItemUpdate, PicklistItemResponse,
    User, Location, WaveType, WaveStatus, PicklistStatus
)

router = APIRouter(prefix="/waves", tags=["Waves"])


# ============================================================================
# Wave Endpoints
# ============================================================================

@router.get("", response_model=List[WaveBrief])
def list_waves(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[WaveStatus] = None,
    wave_type: Optional[WaveType] = None,
    location_id: Optional[UUID] = None,
    assigned_to_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List waves with pagination and filters."""
    query = select(Wave)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Wave.locationId.in_(location_ids))

    if status:
        query = query.where(Wave.status == status)
    if wave_type:
        query = query.where(Wave.type == wave_type)
    if location_id:
        query = query.where(Wave.locationId == location_id)
    if assigned_to_id:
        query = query.where(Wave.assignedToId == assigned_to_id)

    query = query.offset(skip).limit(limit).order_by(Wave.createdAt.desc())

    waves = session.exec(query).all()
    return [WaveBrief.model_validate(w) for w in waves]


@router.get("/count")
def count_waves(
    status: Optional[WaveStatus] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of waves."""
    query = select(func.count(Wave.id))

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Wave.locationId.in_(location_ids))

    if status:
        query = query.where(Wave.status == status)
    if location_id:
        query = query.where(Wave.locationId == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{wave_id}", response_model=WaveResponse)
def get_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get wave by ID."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    return WaveResponse.model_validate(wave)


@router.post("", response_model=WaveResponse, status_code=status.HTTP_201_CREATED)
def create_wave(
    data: WaveCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new wave."""
    # Get location to set companyId
    location = session.get(Location, data.locationId)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    try:
        wave_dict = data.model_dump()
        wave_dict["companyId"] = location.companyId
        wave = Wave(**wave_dict)
        session.add(wave)
        session.commit()
        session.refresh(wave)
        return WaveResponse.model_validate(wave)
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create wave: {str(e)}"
        )


@router.patch("/{wave_id}", response_model=WaveResponse)
def update_wave(
    wave_id: UUID,
    data: WaveUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update wave."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(wave, field, value)

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


@router.post("/{wave_id}/release", response_model=WaveResponse)
def release_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Release wave for picking."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    wave.status = WaveStatus.RELEASED
    wave.releasedAt = datetime.utcnow()

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


@router.post("/{wave_id}/start", response_model=WaveResponse)
def start_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start wave picking."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    wave.status = WaveStatus.IN_PROGRESS
    wave.startedAt = datetime.utcnow()

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


@router.post("/{wave_id}/complete", response_model=WaveResponse)
def complete_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete wave picking."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    wave.status = WaveStatus.COMPLETED
    wave.completedAt = datetime.utcnow()

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


# ============================================================================
# Wave Items Endpoints
# ============================================================================

@router.get("/{wave_id}/items", response_model=List[WaveItemResponse])
def list_wave_items(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a wave."""
    query = select(WaveItem).where(WaveItem.waveId == wave_id).order_by(WaveItem.sequence)
    items = session.exec(query).all()
    return [WaveItemResponse.model_validate(i) for i in items]


@router.post("/{wave_id}/items", response_model=WaveItemResponse, status_code=status.HTTP_201_CREATED)
def add_wave_item(
    wave_id: UUID,
    data: WaveItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to wave."""
    item_data = data.model_dump()
    item_data["waveId"] = wave_id
    item = WaveItem.model_validate(item_data)
    session.add(item)
    session.commit()
    session.refresh(item)
    return WaveItemResponse.model_validate(item)


@router.patch("/items/{item_id}", response_model=WaveItemResponse)
def update_wave_item(
    item_id: UUID,
    data: WaveItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update wave item (e.g., mark picked)."""
    item = session.get(WaveItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Wave item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return WaveItemResponse.model_validate(item)


# ============================================================================
# Wave Orders Endpoints
# ============================================================================

@router.get("/{wave_id}/orders", response_model=List[WaveOrderResponse])
def list_wave_orders(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List orders in a wave."""
    query = select(WaveOrder).where(WaveOrder.waveId == wave_id).order_by(WaveOrder.sequence)
    orders = session.exec(query).all()
    return [WaveOrderResponse.model_validate(o) for o in orders]


@router.post("/{wave_id}/orders", response_model=WaveOrderResponse, status_code=status.HTTP_201_CREATED)
def add_order_to_wave(
    wave_id: UUID,
    data: WaveOrderCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add order to wave."""
    order_data = data.model_dump()
    order_data["waveId"] = wave_id
    wave_order = WaveOrder.model_validate(order_data)
    session.add(wave_order)
    session.commit()
    session.refresh(wave_order)
    return WaveOrderResponse.model_validate(wave_order)


# ============================================================================
# Picklist Endpoints
# ============================================================================

@router.get("/picklists", response_model=List[PicklistResponse])
def list_picklists(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[PicklistStatus] = None,
    assigned_to_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List picklists."""
    query = select(Picklist)

    if status:
        query = query.where(Picklist.status == status)
    if assigned_to_id:
        query = query.where(Picklist.assignedToId == assigned_to_id)

    query = query.offset(skip).limit(limit).order_by(Picklist.createdAt.desc())
    picklists = session.exec(query).all()
    return [PicklistResponse.model_validate(p) for p in picklists]


@router.get("/picklists/{picklist_id}", response_model=PicklistResponse)
def get_picklist(
    picklist_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get picklist by ID."""
    picklist = session.get(Picklist, picklist_id)
    if not picklist:
        raise HTTPException(status_code=404, detail="Picklist not found")
    return PicklistResponse.model_validate(picklist)


@router.post("/picklists", response_model=PicklistResponse, status_code=status.HTTP_201_CREATED)
def create_picklist(
    data: PicklistCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new picklist."""
    try:
        picklist = Picklist.model_validate(data)
        session.add(picklist)
        session.commit()
        session.refresh(picklist)
        return PicklistResponse.model_validate(picklist)
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create picklist: {str(e)}"
        )


@router.patch("/picklists/{picklist_id}", response_model=PicklistResponse)
def update_picklist(
    picklist_id: UUID,
    data: PicklistUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update picklist."""
    picklist = session.get(Picklist, picklist_id)
    if not picklist:
        raise HTTPException(status_code=404, detail="Picklist not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(picklist, field, value)

    session.add(picklist)
    session.commit()
    session.refresh(picklist)
    return PicklistResponse.model_validate(picklist)


@router.get("/picklists/{picklist_id}/items", response_model=List[PicklistItemResponse])
def list_picklist_items(
    picklist_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a picklist."""
    query = select(PicklistItem).where(PicklistItem.picklistId == picklist_id)
    items = session.exec(query).all()
    return [PicklistItemResponse.model_validate(i) for i in items]


@router.post("/picklists/{picklist_id}/items", response_model=PicklistItemResponse, status_code=status.HTTP_201_CREATED)
def add_picklist_item(
    picklist_id: UUID,
    data: PicklistItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to picklist."""
    item_data = data.model_dump()
    item_data["picklistId"] = picklist_id
    item = PicklistItem.model_validate(item_data)
    session.add(item)
    session.commit()
    session.refresh(item)
    return PicklistItemResponse.model_validate(item)


@router.patch("/picklists/items/{item_id}", response_model=PicklistItemResponse)
def update_picklist_item(
    item_id: UUID,
    data: PicklistItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update picklist item."""
    item = session.get(PicklistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Picklist item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return PicklistItemResponse.model_validate(item)
