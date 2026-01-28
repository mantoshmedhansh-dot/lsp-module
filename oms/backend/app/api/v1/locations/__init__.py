"""
Locations API v1 - Location, Zone, and Bin management endpoints
"""
import re
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_admin, require_manager, CompanyFilter
from app.models import (
    Location, LocationCreate, LocationUpdate, LocationResponse, LocationBrief,
    Zone, ZoneCreate, ZoneUpdate, ZoneResponse, ZoneBrief,
    Bin, BinCreate, BinUpdate, BinResponse, BinBrief, BinBulkCreate, BinCapacityResponse,
    LocationType, ZoneType, BinType, TemperatureType, User,
    Inventory
)

router = APIRouter(prefix="/locations", tags=["Locations"])


# Location type prefixes
LOCATION_TYPE_PREFIX = {
    "WAREHOUSE": "WH",
    "STORE": "ST",
    "HUB": "HB",
    "VIRTUAL": "VT",
}


def generate_location_code(name: str, location_type: str, session: Session) -> str:
    """
    Generate location code in format: TYPE-XXX-0001
    - TYPE = WH (Warehouse), ST (Store), HB (Hub), VT (Virtual)
    - XXX = First 3 uppercase letters from location name
    - 0001 = Sequential number
    """
    # Get type prefix
    type_prefix = LOCATION_TYPE_PREFIX.get(location_type, "LC")

    # Common words to exclude
    stop_words = {'the', 'and', 'of', 'for', 'in', 'a', 'an', 'main', 'central', 'primary'}

    # Clean and split the name
    words = re.sub(r'[^a-zA-Z\s]', '', name).lower().split()
    meaningful_words = [w for w in words if w not in stop_words]

    # If no meaningful words, use original words
    if not meaningful_words:
        meaningful_words = words

    # Generate name prefix from meaningful words
    if len(meaningful_words) >= 2:
        # Use first letter of first 2 words + first letter of last word
        name_prefix = (meaningful_words[0][0] + meaningful_words[1][0] +
                      (meaningful_words[-1][0] if len(meaningful_words) > 2 else meaningful_words[0][1] if len(meaningful_words[0]) > 1 else 'X')).upper()
    elif len(meaningful_words) == 1:
        # Use first 3 letters of the word
        name_prefix = meaningful_words[0][:3].upper()
    else:
        name_prefix = 'LOC'

    # Ensure prefix is exactly 3 characters
    name_prefix = name_prefix[:3].ljust(3, 'X')

    # Get current count of locations to determine next number
    location_count = session.exec(select(func.count(Location.id))).one()
    next_number = location_count + 1

    # Format: TYPE-XXX-0001
    code = f"{type_prefix}-{name_prefix}-{next_number:04d}"

    # Check if code already exists and increment if needed
    existing = session.exec(
        select(Location).where(Location.code == code)
    ).first()

    while existing:
        next_number += 1
        code = f"{type_prefix}-{name_prefix}-{next_number:04d}"
        existing = session.exec(
            select(Location).where(Location.code == code)
        ).first()

    return code


def preview_location_code(name: str, location_type: str, session: Session) -> str:
    """Preview what the location code would be."""
    type_prefix = LOCATION_TYPE_PREFIX.get(location_type, "LC")

    stop_words = {'the', 'and', 'of', 'for', 'in', 'a', 'an', 'main', 'central', 'primary'}
    words = re.sub(r'[^a-zA-Z\s]', '', name).lower().split()
    meaningful_words = [w for w in words if w not in stop_words]

    if not meaningful_words:
        meaningful_words = words

    if len(meaningful_words) >= 2:
        name_prefix = (meaningful_words[0][0] + meaningful_words[1][0] +
                      (meaningful_words[-1][0] if len(meaningful_words) > 2 else meaningful_words[0][1] if len(meaningful_words[0]) > 1 else 'X')).upper()
    elif len(meaningful_words) == 1:
        name_prefix = meaningful_words[0][:3].upper()
    else:
        name_prefix = 'LOC'

    name_prefix = name_prefix[:3].ljust(3, 'X')

    location_count = session.exec(select(func.count(Location.id))).one()
    next_number = location_count + 1

    return f"{type_prefix}-{name_prefix}-{next_number:04d}"


# ============================================================================
# Location Endpoints
# ============================================================================

@router.get("/preview-code")
def get_preview_code(
    name: str = Query(..., min_length=1, description="Location name to generate code for"),
    type: str = Query(..., description="Location type (WAREHOUSE, STORE, HUB, VIRTUAL)"),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user)
):
    """
    Preview the auto-generated location code for a given name and type.
    Does not create any records - just shows what the code would be.
    """
    code = preview_location_code(name, type, session)
    return {"name": name, "type": type, "code": code}


@router.get("", response_model=List[LocationBrief])
def list_locations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type: Optional[LocationType] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List locations.
    Filtered by company and user's location access.
    """
    query = select(Location)

    # Apply company filter
    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    # Filter by user's location access (unless super admin)
    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Location.id.in_(current_user.locationAccess))

    # Apply filters
    if type:
        query = query.where(Location.type == type)
    if is_active is not None:
        query = query.where(Location.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Location.name.ilike(search_pattern)) |
            (Location.code.ilike(search_pattern))
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Location.name)

    locations = session.exec(query).all()
    return [LocationBrief.model_validate(loc) for loc in locations]


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific location by ID."""
    query = select(Location).where(Location.id == location_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    location = session.exec(query).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Check location access
    if (current_user.role != "SUPER_ADMIN" and
        current_user.locationAccess and
        location_id not in current_user.locationAccess):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this location"
        )

    return LocationResponse.model_validate(location)


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    location_data: LocationCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """
    Create a new location. Requires ADMIN or SUPER_ADMIN role.
    Location code is auto-generated in format TYPE-XXX-0001 if not provided.
    """
    # Non-super-admins can only create locations for their own company
    if company_filter.company_id:
        if location_data.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create locations for other companies"
            )

    # Get location data as dict
    data = location_data.model_dump()

    # Auto-generate code if not provided or empty
    if not data.get('code'):
        data['code'] = generate_location_code(data['name'], data['type'], session)
    else:
        # Check if provided code already exists
        existing = session.exec(
            select(Location).where(Location.code == data['code'])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Location code already exists"
            )

    # Create location
    location = Location(**data)
    session.add(location)
    session.commit()
    session.refresh(location)

    return LocationResponse.model_validate(location)


@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: UUID,
    location_data: LocationUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Update a location. Requires ADMIN or SUPER_ADMIN role."""
    query = select(Location).where(Location.id == location_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    location = session.exec(query).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Update fields
    update_dict = location_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(location, field, value)

    session.add(location)
    session.commit()
    session.refresh(location)

    return LocationResponse.model_validate(location)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Soft delete a location. Requires ADMIN or SUPER_ADMIN role."""
    query = select(Location).where(Location.id == location_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    location = session.exec(query).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    location.isActive = False
    session.add(location)
    session.commit()

    return None


# ============================================================================
# Zone Endpoints (nested under locations)
# ============================================================================

@router.get("/{location_id}/zones", response_model=List[ZoneResponse])
def list_zones(
    location_id: UUID,
    type: Optional[ZoneType] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List zones for a location."""
    # Verify location access
    location_query = select(Location).where(Location.id == location_id)
    if company_filter.company_id:
        location_query = location_query.where(Location.companyId == company_filter.company_id)

    location = session.exec(location_query).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Build zones query
    query = select(Zone).where(Zone.locationId == location_id)

    if type:
        query = query.where(Zone.type == type)
    if is_active is not None:
        query = query.where(Zone.isActive == is_active)

    query = query.order_by(Zone.code)

    zones = session.exec(query).all()
    return [ZoneResponse.model_validate(z) for z in zones]


@router.post("/{location_id}/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone(
    location_id: UUID,
    zone_data: ZoneCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Create a new zone in a location."""
    # Verify location exists and belongs to company
    location_query = select(Location).where(Location.id == location_id)
    if company_filter.company_id:
        location_query = location_query.where(Location.companyId == company_filter.company_id)

    location = session.exec(location_query).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Override locationId from URL
    zone_dict = zone_data.model_dump()
    zone_dict["locationId"] = location_id

    zone = Zone(**zone_dict)
    session.add(zone)
    session.commit()
    session.refresh(zone)

    return ZoneResponse.model_validate(zone)


@router.patch("/{location_id}/zones/{zone_id}", response_model=ZoneResponse)
def update_zone(
    location_id: UUID,
    zone_id: UUID,
    zone_data: ZoneUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Update a zone."""
    # Verify zone exists and belongs to location
    zone = session.exec(
        select(Zone).where(Zone.id == zone_id, Zone.locationId == location_id)
    ).first()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found"
        )

    # Update fields
    update_dict = zone_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(zone, field, value)

    session.add(zone)
    session.commit()
    session.refresh(zone)

    return ZoneResponse.model_validate(zone)


# ============================================================================
# Bin Endpoints (nested under zones)
# ============================================================================

@router.get("/{location_id}/zones/{zone_id}/bins", response_model=List[BinResponse])
def list_bins(
    location_id: UUID,
    zone_id: UUID,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List bins for a zone."""
    # Verify zone exists and belongs to location
    zone = session.exec(
        select(Zone).where(Zone.id == zone_id, Zone.locationId == location_id)
    ).first()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found"
        )

    # Build bins query
    query = select(Bin).where(Bin.zoneId == zone_id)

    if is_active is not None:
        query = query.where(Bin.isActive == is_active)

    query = query.order_by(Bin.code)

    bins = session.exec(query).all()
    return [BinResponse.model_validate(b) for b in bins]


@router.post("/{location_id}/zones/{zone_id}/bins", response_model=BinResponse, status_code=status.HTTP_201_CREATED)
def create_bin(
    location_id: UUID,
    zone_id: UUID,
    bin_data: BinCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Create a new bin in a zone."""
    # Verify zone exists and belongs to location
    zone = session.exec(
        select(Zone).where(Zone.id == zone_id, Zone.locationId == location_id)
    ).first()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found"
        )

    # Override zoneId from URL
    bin_dict = bin_data.model_dump()
    bin_dict["zoneId"] = zone_id

    bin_obj = Bin(**bin_dict)
    session.add(bin_obj)
    session.commit()
    session.refresh(bin_obj)

    return BinResponse.model_validate(bin_obj)


@router.patch("/{location_id}/zones/{zone_id}/bins/{bin_id}", response_model=BinResponse)
def update_bin(
    location_id: UUID,
    zone_id: UUID,
    bin_id: UUID,
    bin_data: BinUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update a bin."""
    # Verify bin exists and belongs to zone
    bin_obj = session.exec(
        select(Bin).where(Bin.id == bin_id, Bin.zoneId == zone_id)
    ).first()

    if not bin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bin not found"
        )

    # Update fields
    update_dict = bin_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(bin_obj, field, value)

    session.add(bin_obj)
    session.commit()
    session.refresh(bin_obj)

    return BinResponse.model_validate(bin_obj)


# ============================================================================
# Direct Zone Endpoints (flat routes, not nested)
# ============================================================================

zones_router = APIRouter(prefix="/zones", tags=["Zones"])


def build_zone_response(zone: Zone, session: Session) -> ZoneResponse:
    """Build ZoneResponse with computed bin count."""
    zone_response = ZoneResponse.model_validate(zone)
    bin_count = session.exec(
        select(func.count(Bin.id)).where(Bin.zoneId == zone.id)
    ).one()
    zone_response.binCount = bin_count
    return zone_response


@zones_router.get("", response_model=List[ZoneResponse])
def list_all_zones(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    location_id: Optional[UUID] = None,
    type: Optional[ZoneType] = None,
    temperature_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List all zones across locations.
    Supports filtering by location, type, temperature, and search.
    """
    # Build base query with location join for company filtering
    query = select(Zone).join(Location, Zone.locationId == Location.id)

    # Apply company filter
    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    # Filter by user's location access (unless super admin)
    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Zone.locationId.in_(current_user.locationAccess))

    # Apply filters
    if location_id:
        query = query.where(Zone.locationId == location_id)
    if type:
        query = query.where(Zone.type == type)
    if temperature_type:
        query = query.where(Zone.temperatureType == temperature_type)
    if is_active is not None:
        query = query.where(Zone.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Zone.name.ilike(search_pattern)) |
            (Zone.code.ilike(search_pattern))
        )

    # Apply pagination and ordering
    query = query.offset(skip).limit(limit).order_by(Zone.priority, Zone.code)

    zones = session.exec(query).all()
    return [build_zone_response(z, session) for z in zones]


@zones_router.get("/count")
def count_zones(
    location_id: Optional[UUID] = None,
    type: Optional[ZoneType] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of zones."""
    query = select(func.count(Zone.id)).select_from(Zone).join(
        Location, Zone.locationId == Location.id
    )

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Zone.locationId.in_(current_user.locationAccess))

    if location_id:
        query = query.where(Zone.locationId == location_id)
    if type:
        query = query.where(Zone.type == type)
    if is_active is not None:
        query = query.where(Zone.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@zones_router.post("", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone_direct(
    zone_data: ZoneCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Create a new zone. Requires ADMIN or SUPER_ADMIN role."""
    # Verify location exists and belongs to company
    location_query = select(Location).where(Location.id == zone_data.locationId)
    if company_filter.company_id:
        location_query = location_query.where(Location.companyId == company_filter.company_id)

    location = session.exec(location_query).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    zone = Zone(**zone_data.model_dump())
    session.add(zone)
    session.commit()
    session.refresh(zone)

    zone_response = ZoneResponse.model_validate(zone)
    zone_response.binCount = 0
    return zone_response


@zones_router.get("/{zone_id}", response_model=ZoneResponse)
def get_zone(
    zone_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific zone by ID."""
    query = select(Zone).join(Location).where(Zone.id == zone_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Zone.locationId.in_(current_user.locationAccess))

    zone = session.exec(query).first()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found"
        )

    return build_zone_response(zone, session)


@zones_router.patch("/{zone_id}", response_model=ZoneResponse)
def update_zone_direct(
    zone_id: UUID,
    zone_data: ZoneUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Update a zone. Requires ADMIN or SUPER_ADMIN role."""
    query = select(Zone).join(Location).where(Zone.id == zone_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    zone = session.exec(query).first()

    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found"
        )

    # Update fields
    update_dict = zone_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(zone, field, value)

    session.add(zone)
    session.commit()
    session.refresh(zone)

    return build_zone_response(zone, session)


# ============================================================================
# Direct Bin Endpoints (flat routes, not nested)
# ============================================================================

bins_router = APIRouter(prefix="/bins", tags=["Bins"])


def build_bin_response(bin_obj: Bin) -> BinResponse:
    """Build BinResponse with computed fields."""
    response = BinResponse.model_validate(bin_obj)
    response.availableWeight = bin_obj.availableWeight
    response.availableVolume = bin_obj.availableVolume
    response.availableUnits = bin_obj.availableUnits
    response.fullAddress = bin_obj.fullAddress
    return response


@bins_router.get("", response_model=List[BinResponse])
def list_all_bins(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    zone_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    bin_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_pick_face: Optional[bool] = None,
    is_reserve: Optional[bool] = None,
    is_staging: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List all bins across zones.
    Supports filtering by zone, location, type, and various flags.
    """
    # Build base query with zone and location join for company filtering
    query = select(Bin).join(Zone, Bin.zoneId == Zone.id).join(
        Location, Zone.locationId == Location.id
    )

    # Apply company filter
    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    # Filter by user's location access (unless super admin)
    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Zone.locationId.in_(current_user.locationAccess))

    # Apply filters
    if zone_id:
        query = query.where(Bin.zoneId == zone_id)
    if location_id:
        query = query.where(Zone.locationId == location_id)
    if bin_type:
        query = query.where(Bin.binType == bin_type)
    if is_active is not None:
        query = query.where(Bin.isActive == is_active)
    if is_pick_face is not None:
        query = query.where(Bin.isPickFace == is_pick_face)
    if is_reserve is not None:
        query = query.where(Bin.isReserve == is_reserve)
    if is_staging is not None:
        query = query.where(Bin.isStaging == is_staging)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Bin.code.ilike(search_pattern)) |
            (Bin.name.ilike(search_pattern))
        )

    # Apply pagination and ordering
    query = query.offset(skip).limit(limit).order_by(Bin.pickSequence, Bin.code)

    bins = session.exec(query).all()
    return [build_bin_response(b) for b in bins]


@bins_router.get("/count")
def count_bins(
    zone_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    bin_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of bins."""
    query = select(func.count(Bin.id)).select_from(Bin).join(
        Zone, Bin.zoneId == Zone.id
    ).join(Location, Zone.locationId == Location.id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Zone.locationId.in_(current_user.locationAccess))

    if zone_id:
        query = query.where(Bin.zoneId == zone_id)
    if location_id:
        query = query.where(Zone.locationId == location_id)
    if bin_type:
        query = query.where(Bin.binType == bin_type)
    if is_active is not None:
        query = query.where(Bin.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@bins_router.post("/bulk", response_model=List[BinResponse], status_code=status.HTTP_201_CREATED)
def create_bins_bulk(
    bulk_data: BinBulkCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """
    Bulk create bins in a zone.
    Creates bins with sequential codes like A-01, A-02, etc.
    """
    # Verify zone exists
    zone_query = select(Zone).join(Location).where(Zone.id == bulk_data.zoneId)
    if company_filter.company_id:
        zone_query = zone_query.where(Location.companyId == company_filter.company_id)

    zone = session.exec(zone_query).first()
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found"
        )

    created_bins = []
    for i in range(bulk_data.count):
        bin_num = bulk_data.startNumber + i
        bin_code = f"{bulk_data.prefix}-{bin_num:02d}"

        # Check if bin code already exists in this zone
        existing = session.exec(
            select(Bin).where(Bin.zoneId == bulk_data.zoneId, Bin.code == bin_code)
        ).first()
        if existing:
            continue  # Skip if already exists

        bin_obj = Bin(
            code=bin_code,
            name=bin_code,
            binType=bulk_data.binType,
            zoneId=bulk_data.zoneId,
            aisle=bulk_data.aisle,
            maxWeight=bulk_data.maxWeight,
            maxVolume=bulk_data.maxVolume,
            maxUnits=bulk_data.maxUnits,
            isPickFace=bulk_data.isPickFace,
            isReserve=bulk_data.isReserve,
            pickSequence=bin_num
        )
        session.add(bin_obj)
        created_bins.append(bin_obj)

    session.commit()

    # Refresh all created bins
    for bin_obj in created_bins:
        session.refresh(bin_obj)

    return [build_bin_response(b) for b in created_bins]


@bins_router.get("/{bin_id}", response_model=BinResponse)
def get_bin(
    bin_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific bin by ID."""
    query = select(Bin).join(Zone).join(Location).where(Bin.id == bin_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Zone.locationId.in_(current_user.locationAccess))

    bin_obj = session.exec(query).first()

    if not bin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bin not found"
        )

    return build_bin_response(bin_obj)


@bins_router.patch("/{bin_id}", response_model=BinResponse)
def update_bin_direct(
    bin_id: UUID,
    bin_data: BinUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update a bin. Requires MANAGER or above role."""
    query = select(Bin).join(Zone).join(Location).where(Bin.id == bin_id)

    if company_filter.company_id:
        query = query.where(Location.companyId == company_filter.company_id)

    bin_obj = session.exec(query).first()

    if not bin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bin not found"
        )

    # Update fields
    update_dict = bin_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(bin_obj, field, value)

    session.add(bin_obj)
    session.commit()
    session.refresh(bin_obj)

    return build_bin_response(bin_obj)


@bins_router.get("/{bin_id}/inventory")
def get_bin_inventory(
    bin_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inventory contents of a bin."""
    # Verify bin access
    bin_query = select(Bin).join(Zone).join(Location).where(Bin.id == bin_id)
    if company_filter.company_id:
        bin_query = bin_query.where(Location.companyId == company_filter.company_id)

    bin_obj = session.exec(bin_query).first()
    if not bin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bin not found"
        )

    # Get inventory items in this bin
    inventory_query = select(Inventory).where(Inventory.binId == bin_id)
    inventory_items = session.exec(inventory_query).all()

    return {
        "bin": build_bin_response(bin_obj),
        "inventory": [
            {
                "id": str(inv.id),
                "skuId": str(inv.skuId),
                "quantity": inv.quantity,
                "reservedQty": inv.reservedQty,
                "availableQty": inv.quantity - inv.reservedQty,
                "batchNo": inv.batchNo,
                "lotNo": inv.lotNo,
                "expiryDate": inv.expiryDate.isoformat() if inv.expiryDate else None,
                "fifoSequence": inv.fifoSequence
            }
            for inv in inventory_items
        ],
        "totalQuantity": sum(inv.quantity for inv in inventory_items),
        "totalAvailable": sum(inv.quantity - inv.reservedQty for inv in inventory_items)
    }


@bins_router.get("/{bin_id}/capacity", response_model=BinCapacityResponse)
def get_bin_capacity(
    bin_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get capacity utilization of a bin."""
    # Verify bin access
    bin_query = select(Bin).join(Zone).join(Location).where(Bin.id == bin_id)
    if company_filter.company_id:
        bin_query = bin_query.where(Location.companyId == company_filter.company_id)

    bin_obj = session.exec(bin_query).first()
    if not bin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bin not found"
        )

    # Calculate utilization percentage (based on units if maxUnits is set)
    utilization = None
    if bin_obj.maxUnits and bin_obj.maxUnits > 0:
        utilization = Decimal(bin_obj.currentUnits or 0) / Decimal(bin_obj.maxUnits) * 100

    return BinCapacityResponse(
        id=bin_obj.id,
        code=bin_obj.code,
        maxWeight=bin_obj.maxWeight,
        maxVolume=bin_obj.maxVolume,
        maxUnits=bin_obj.maxUnits,
        currentWeight=bin_obj.currentWeight,
        currentVolume=bin_obj.currentVolume,
        currentUnits=bin_obj.currentUnits or 0,
        availableWeight=bin_obj.availableWeight,
        availableVolume=bin_obj.availableVolume,
        availableUnits=bin_obj.availableUnits,
        utilizationPercent=utilization
    )
