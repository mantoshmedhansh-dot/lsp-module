from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid

from ...core.database import get_db
from ...models.company import Location, LocationType
from ...models.user import User
from ..deps import get_current_user

router = APIRouter()


class LocationCreate(BaseModel):
    code: str
    name: str
    type: LocationType
    address: dict
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    gst: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[dict] = None
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    isActive: Optional[bool] = None


class LocationResponse(BaseModel):
    id: str
    code: str
    name: str
    type: str
    address: Optional[dict] = None
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    gst: Optional[str] = None
    isActive: bool
    companyId: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[LocationResponse])
async def list_locations(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    type: Optional[LocationType] = None,
    isActive: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Location)

    if current_user.companyId:
        query = query.filter(Location.companyId == current_user.companyId)

    if type:
        query = query.filter(Location.type == type)

    if isActive is not None:
        query = query.filter(Location.isActive == isActive)

    locations = query.offset((page - 1) * pageSize).limit(pageSize).all()
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Location).filter(
        Location.code == location_data.code,
        Location.companyId == current_user.companyId
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location code already exists"
        )

    location = Location(
        id=str(uuid.uuid4()),
        companyId=current_user.companyId,
        **location_data.model_dump()
    )

    db.add(location)
    db.commit()
    db.refresh(location)

    return LocationResponse.model_validate(location)


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    return LocationResponse.model_validate(location)


@router.patch("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: str,
    location_data: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    update_data = location_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(location, field, value)

    db.commit()
    db.refresh(location)

    return LocationResponse.model_validate(location)
