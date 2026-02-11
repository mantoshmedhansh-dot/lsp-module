"""
Settings API v1 - Configuration and settings endpoints
"""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.database import get_session
from app.core.deps import get_current_user, require_admin, require_manager, CompanyFilter
from app.models import Company, Location, SKU, User


router = APIRouter(prefix="/settings", tags=["Settings"])


# ============================================================================
# Schemas
# ============================================================================

class ValuationMethodUpdate(BaseModel):
    """Schema for updating valuation method"""
    valuationMethod: str  # FIFO, LIFO, FEFO, WAC


class CompanyValuationResponse(BaseModel):
    """Response for company valuation settings"""
    companyId: UUID
    companyName: str
    defaultValuationMethod: str


class LocationValuationResponse(BaseModel):
    """Response for location valuation settings"""
    locationId: UUID
    locationName: str
    locationCode: str
    valuationMethod: Optional[str]
    effectiveMethod: str  # After inheritance


class SKUValuationResponse(BaseModel):
    """Response for SKU valuation settings"""
    skuId: UUID
    skuCode: str
    skuName: str
    valuationMethod: Optional[str]
    effectiveMethod: str  # After inheritance


class ValuationOverviewResponse(BaseModel):
    """Overview of valuation settings"""
    companyDefault: str
    locationOverrides: int
    skuOverrides: int
    locations: List[LocationValuationResponse]


# ============================================================================
# Company Valuation Settings
# ============================================================================

@router.get("/valuation/company", response_model=CompanyValuationResponse)
def get_company_valuation(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get company-level valuation method setting."""
    if not company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID is required"
        )

    company = session.exec(
        select(Company).where(Company.id == company_filter.company_id)
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    return CompanyValuationResponse(
        companyId=company.id,
        companyName=company.name,
        defaultValuationMethod=company.defaultValuationMethod or "FIFO"
    )


@router.patch("/valuation/company", response_model=CompanyValuationResponse)
def update_company_valuation(
    data: ValuationMethodUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin())
):
    """Update company-level valuation method setting."""
    if not company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID is required"
        )

    # Validate valuation method
    valid_methods = ["FIFO", "LIFO", "FEFO", "WAC"]
    if data.valuationMethod not in valid_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid valuation method. Must be one of: {valid_methods}"
        )

    company = session.exec(
        select(Company).where(Company.id == company_filter.company_id)
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    company.defaultValuationMethod = data.valuationMethod
    session.add(company)
    session.commit()
    session.refresh(company)

    return CompanyValuationResponse(
        companyId=company.id,
        companyName=company.name,
        defaultValuationMethod=company.defaultValuationMethod
    )


# ============================================================================
# Location Valuation Settings
# ============================================================================

@router.get("/valuation/locations", response_model=List[LocationValuationResponse])
def list_location_valuations(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all location valuation settings."""
    query = select(Location).where(Location.isActive == True)
    query = company_filter.apply_filter(query, Location.companyId)

    locations = session.exec(query).all()

    # Get company default
    company_default = "FIFO"
    if company_filter.company_id:
        company = session.exec(
            select(Company).where(Company.id == company_filter.company_id)
        ).first()
        if company:
            company_default = company.defaultValuationMethod or "FIFO"

    return [
        LocationValuationResponse(
            locationId=loc.id,
            locationName=loc.name,
            locationCode=loc.code,
            valuationMethod=loc.valuationMethod,
            effectiveMethod=loc.valuationMethod or company_default
        )
        for loc in locations
    ]


@router.get("/valuation/location/{location_id}", response_model=LocationValuationResponse)
def get_location_valuation(
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get location-specific valuation method setting."""
    query = select(Location).where(Location.id == location_id)
    query = company_filter.apply_filter(query, Location.companyId)

    location = session.exec(query).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Get company default for effective method
    company = session.exec(
        select(Company).where(Company.id == location.companyId)
    ).first()
    company_default = company.defaultValuationMethod if company else "FIFO"

    return LocationValuationResponse(
        locationId=location.id,
        locationName=location.name,
        locationCode=location.code,
        valuationMethod=location.valuationMethod,
        effectiveMethod=location.valuationMethod or company_default
    )


@router.patch("/valuation/location/{location_id}", response_model=LocationValuationResponse)
def update_location_valuation(
    location_id: UUID,
    data: ValuationMethodUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update location-specific valuation method override."""
    # Validate valuation method
    valid_methods = ["FIFO", "LIFO", "FEFO", "WAC"]
    if data.valuationMethod not in valid_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid valuation method. Must be one of: {valid_methods}"
        )

    query = select(Location).where(Location.id == location_id)
    query = company_filter.apply_filter(query, Location.companyId)

    location = session.exec(query).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    location.valuationMethod = data.valuationMethod
    session.add(location)
    session.commit()
    session.refresh(location)

    return LocationValuationResponse(
        locationId=location.id,
        locationName=location.name,
        locationCode=location.code,
        valuationMethod=location.valuationMethod,
        effectiveMethod=location.valuationMethod
    )


@router.delete("/valuation/location/{location_id}")
def clear_location_valuation(
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Clear location-specific valuation override (use company default)."""
    query = select(Location).where(Location.id == location_id)
    query = company_filter.apply_filter(query, Location.companyId)

    location = session.exec(query).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    location.valuationMethod = None
    session.add(location)
    session.commit()

    return {"success": True, "message": "Location will now use company default"}


# ============================================================================
# SKU Valuation Settings
# ============================================================================

@router.get("/valuation/skus", response_model=List[SKUValuationResponse])
def list_sku_valuations(
    has_override: bool = False,
    skip: int = 0,
    limit: int = 50,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List SKU valuation settings. Use has_override=True to only show SKUs with overrides."""
    query = select(SKU).where(SKU.isActive == True)
    query = company_filter.apply_filter(query, SKU.companyId)

    if has_override:
        query = query.where(SKU.valuationMethod.isnot(None))

    query = query.offset(skip).limit(limit)
    skus = session.exec(query).all()

    # Get company default
    company_default = "FIFO"
    if company_filter.company_id:
        company = session.exec(
            select(Company).where(Company.id == company_filter.company_id)
        ).first()
        if company:
            company_default = company.defaultValuationMethod or "FIFO"

    return [
        SKUValuationResponse(
            skuId=sku.id,
            skuCode=sku.code,
            skuName=sku.name,
            valuationMethod=sku.valuationMethod,
            effectiveMethod=sku.valuationMethod or company_default
        )
        for sku in skus
    ]


@router.get("/valuation/sku/{sku_id}", response_model=SKUValuationResponse)
def get_sku_valuation(
    sku_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get SKU-specific valuation method setting."""
    query = select(SKU).where(SKU.id == sku_id)
    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    # Get company default for effective method
    company = session.exec(
        select(Company).where(Company.id == sku.companyId)
    ).first()
    company_default = company.defaultValuationMethod if company else "FIFO"

    return SKUValuationResponse(
        skuId=sku.id,
        skuCode=sku.code,
        skuName=sku.name,
        valuationMethod=sku.valuationMethod,
        effectiveMethod=sku.valuationMethod or company_default
    )


@router.patch("/valuation/sku/{sku_id}", response_model=SKUValuationResponse)
def update_sku_valuation(
    sku_id: UUID,
    data: ValuationMethodUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update SKU-specific valuation method override."""
    # Validate valuation method
    valid_methods = ["FIFO", "LIFO", "FEFO", "WAC"]
    if data.valuationMethod not in valid_methods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid valuation method. Must be one of: {valid_methods}"
        )

    query = select(SKU).where(SKU.id == sku_id)
    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    sku.valuationMethod = data.valuationMethod
    session.add(sku)
    session.commit()
    session.refresh(sku)

    return SKUValuationResponse(
        skuId=sku.id,
        skuCode=sku.code,
        skuName=sku.name,
        valuationMethod=sku.valuationMethod,
        effectiveMethod=sku.valuationMethod
    )


@router.delete("/valuation/sku/{sku_id}")
def clear_sku_valuation(
    sku_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Clear SKU-specific valuation override (use company/location default)."""
    query = select(SKU).where(SKU.id == sku_id)
    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    sku.valuationMethod = None
    session.add(sku)
    session.commit()

    return {"success": True, "message": "SKU will now use company/location default"}


# ============================================================================
# Valuation Overview
# ============================================================================

@router.get("/valuation/overview", response_model=ValuationOverviewResponse)
def get_valuation_overview(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get overview of valuation settings for the company."""
    if not company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID is required"
        )

    # Get company default
    company = session.exec(
        select(Company).where(Company.id == company_filter.company_id)
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    company_default = company.defaultValuationMethod or "FIFO"

    # Count location overrides
    locations = session.exec(
        select(Location)
        .where(Location.companyId == company_filter.company_id)
        .where(Location.isActive == True)
    ).all()

    location_overrides = sum(1 for loc in locations if loc.valuationMethod)

    # Count SKU overrides
    from sqlmodel import func
    sku_override_count = session.exec(
        select(func.count(SKU.id))
        .where(SKU.companyId == company_filter.company_id)
        .where(SKU.isActive == True)
        .where(SKU.valuationMethod.isnot(None))
    ).one()

    # Build location list
    location_responses = [
        LocationValuationResponse(
            locationId=loc.id,
            locationName=loc.name,
            locationCode=loc.code,
            valuationMethod=loc.valuationMethod,
            effectiveMethod=loc.valuationMethod or company_default
        )
        for loc in locations
    ]

    return ValuationOverviewResponse(
        companyDefault=company_default,
        locationOverrides=location_overrides,
        skuOverrides=sku_override_count,
        locations=location_responses
    )
