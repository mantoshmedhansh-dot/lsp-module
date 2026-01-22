"""
FTL (Full Truck Load) API v1
Vehicle Types, Vendors, Lane Rates, and Indents Management
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    FTLVehicleTypeMaster, FTLVehicleTypeMasterCreate, FTLVehicleTypeMasterUpdate, FTLVehicleTypeMasterResponse,
    FTLVendor, FTLVendorCreate, FTLVendorUpdate, FTLVendorResponse,
    FTLLaneRate, FTLLaneRateCreate, FTLLaneRateUpdate, FTLLaneRateResponse,
    FTLIndent,
    VehicleCategory, FTLIndentStatus,
    User
)

router = APIRouter(prefix="/ftl", tags=["FTL - Full Truck Load"])


# ============================================================================
# Vehicle Type Endpoints
# ============================================================================

@router.get("/vehicle-types", response_model=List[FTLVehicleTypeMasterResponse])
def list_vehicle_types(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[VehicleCategory] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List FTL vehicle types."""
    query = select(FTLVehicleTypeMaster)

    if company_filter.company_id:
        query = query.where(FTLVehicleTypeMaster.companyId == company_filter.company_id)
    if category:
        query = query.where(FTLVehicleTypeMaster.category == category.value)
    if is_active is not None:
        query = query.where(FTLVehicleTypeMaster.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(FTLVehicleTypeMaster.capacityKg)
    vehicle_types = session.exec(query).all()
    return [FTLVehicleTypeMasterResponse.model_validate(v) for v in vehicle_types]


@router.get("/vehicle-types/count")
def count_vehicle_types(
    category: Optional[VehicleCategory] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count FTL vehicle types."""
    query = select(func.count(FTLVehicleTypeMaster.id))

    if company_filter.company_id:
        query = query.where(FTLVehicleTypeMaster.companyId == company_filter.company_id)
    if category:
        query = query.where(FTLVehicleTypeMaster.category == category.value)
    if is_active is not None:
        query = query.where(FTLVehicleTypeMaster.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/vehicle-types/{vehicle_type_id}", response_model=FTLVehicleTypeMasterResponse)
def get_vehicle_type(
    vehicle_type_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get FTL vehicle type by ID."""
    query = select(FTLVehicleTypeMaster).where(FTLVehicleTypeMaster.id == vehicle_type_id)
    if company_filter.company_id:
        query = query.where(FTLVehicleTypeMaster.companyId == company_filter.company_id)

    vehicle_type = session.exec(query).first()
    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    return FTLVehicleTypeMasterResponse.model_validate(vehicle_type)


@router.post("/vehicle-types", response_model=FTLVehicleTypeMasterResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle_type(
    data: FTLVehicleTypeMasterCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new FTL vehicle type."""
    # Check for duplicate code
    existing = session.exec(
        select(FTLVehicleTypeMaster).where(
            FTLVehicleTypeMaster.code == data.code,
            FTLVehicleTypeMaster.companyId == (company_filter.company_id or data.companyId)
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle type code already exists")

    vehicle_type = FTLVehicleTypeMaster(
        code=data.code,
        name=data.name,
        category=data.category.value if data.category else VehicleCategory.TRUCK_22FT.value,
        capacityKg=data.capacityKg,
        capacityVolumeCBM=data.capacityVolumeCBM,
        lengthFt=data.lengthFt,
        widthFt=data.widthFt,
        heightFt=data.heightFt,
        description=data.description,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(vehicle_type)
    session.commit()
    session.refresh(vehicle_type)
    return FTLVehicleTypeMasterResponse.model_validate(vehicle_type)


@router.patch("/vehicle-types/{vehicle_type_id}", response_model=FTLVehicleTypeMasterResponse)
def update_vehicle_type(
    vehicle_type_id: UUID,
    data: FTLVehicleTypeMasterUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update FTL vehicle type."""
    query = select(FTLVehicleTypeMaster).where(FTLVehicleTypeMaster.id == vehicle_type_id)
    if company_filter.company_id:
        query = query.where(FTLVehicleTypeMaster.companyId == company_filter.company_id)

    vehicle_type = session.exec(query).first()
    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    update_data = data.model_dump(exclude_unset=True)
    # Handle enum conversion
    if 'category' in update_data and update_data['category']:
        update_data['category'] = update_data['category'].value

    for field, value in update_data.items():
        setattr(vehicle_type, field, value)

    session.add(vehicle_type)
    session.commit()
    session.refresh(vehicle_type)
    return FTLVehicleTypeMasterResponse.model_validate(vehicle_type)


@router.delete("/vehicle-types/{vehicle_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle_type(
    vehicle_type_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete FTL vehicle type (soft delete)."""
    query = select(FTLVehicleTypeMaster).where(FTLVehicleTypeMaster.id == vehicle_type_id)
    if company_filter.company_id:
        query = query.where(FTLVehicleTypeMaster.companyId == company_filter.company_id)

    vehicle_type = session.exec(query).first()
    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    vehicle_type.isActive = False
    session.add(vehicle_type)
    session.commit()


# ============================================================================
# FTL Vendor Endpoints
# ============================================================================

@router.get("/vendors", response_model=List[FTLVendorResponse])
def list_vendors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    city: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List FTL vendors."""
    query = select(FTLVendor)

    if company_filter.company_id:
        query = query.where(FTLVendor.companyId == company_filter.company_id)
    if search:
        query = query.where(
            (FTLVendor.name.ilike(f"%{search}%")) |
            (FTLVendor.code.ilike(f"%{search}%"))
        )
    if city:
        query = query.where(FTLVendor.city.ilike(f"%{city}%"))
    if is_active is not None:
        query = query.where(FTLVendor.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(FTLVendor.name)
    vendors = session.exec(query).all()
    return [FTLVendorResponse.model_validate(v) for v in vendors]


@router.get("/vendors/count")
def count_vendors(
    search: Optional[str] = None,
    city: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count FTL vendors."""
    query = select(func.count(FTLVendor.id))

    if company_filter.company_id:
        query = query.where(FTLVendor.companyId == company_filter.company_id)
    if search:
        query = query.where(
            (FTLVendor.name.ilike(f"%{search}%")) |
            (FTLVendor.code.ilike(f"%{search}%"))
        )
    if city:
        query = query.where(FTLVendor.city.ilike(f"%{city}%"))
    if is_active is not None:
        query = query.where(FTLVendor.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/vendors/{vendor_id}", response_model=FTLVendorResponse)
def get_vendor(
    vendor_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get FTL vendor by ID."""
    query = select(FTLVendor).where(FTLVendor.id == vendor_id)
    if company_filter.company_id:
        query = query.where(FTLVendor.companyId == company_filter.company_id)

    vendor = session.exec(query).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return FTLVendorResponse.model_validate(vendor)


@router.post("/vendors", response_model=FTLVendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    data: FTLVendorCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new FTL vendor."""
    # Check for duplicate code
    existing = session.exec(
        select(FTLVendor).where(
            FTLVendor.code == data.code,
            FTLVendor.companyId == (company_filter.company_id or data.companyId)
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vendor code already exists")

    vendor = FTLVendor(
        code=data.code,
        name=data.name,
        contactPerson=data.contactPerson,
        phone=data.phone,
        email=data.email,
        address=data.address,
        city=data.city,
        state=data.state,
        pincode=data.pincode,
        gstNumber=data.gstNumber,
        panNumber=data.panNumber,
        paymentTermDays=data.paymentTermDays,
        creditLimit=data.creditLimit,
        defaultTATDays=data.defaultTATDays,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(vendor)
    session.commit()
    session.refresh(vendor)
    return FTLVendorResponse.model_validate(vendor)


@router.patch("/vendors/{vendor_id}", response_model=FTLVendorResponse)
def update_vendor(
    vendor_id: UUID,
    data: FTLVendorUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update FTL vendor."""
    query = select(FTLVendor).where(FTLVendor.id == vendor_id)
    if company_filter.company_id:
        query = query.where(FTLVendor.companyId == company_filter.company_id)

    vendor = session.exec(query).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)

    session.add(vendor)
    session.commit()
    session.refresh(vendor)
    return FTLVendorResponse.model_validate(vendor)


@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete FTL vendor (soft delete)."""
    query = select(FTLVendor).where(FTLVendor.id == vendor_id)
    if company_filter.company_id:
        query = query.where(FTLVendor.companyId == company_filter.company_id)

    vendor = session.exec(query).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor.isActive = False
    session.add(vendor)
    session.commit()


# ============================================================================
# Lane Rate Endpoints
# ============================================================================

@router.get("/lane-rates", response_model=List[FTLLaneRateResponse])
def list_lane_rates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    vendor_id: Optional[UUID] = None,
    vehicle_type_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List FTL lane rates."""
    query = select(FTLLaneRate)

    if company_filter.company_id:
        query = query.where(FTLLaneRate.companyId == company_filter.company_id)
    if origin_city:
        query = query.where(FTLLaneRate.originCity.ilike(f"%{origin_city}%"))
    if destination_city:
        query = query.where(FTLLaneRate.destinationCity.ilike(f"%{destination_city}%"))
    if vendor_id:
        query = query.where(FTLLaneRate.vendorId == vendor_id)
    if vehicle_type_id:
        query = query.where(FTLLaneRate.vehicleTypeId == vehicle_type_id)
    if is_active is not None:
        query = query.where(FTLLaneRate.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(FTLLaneRate.originCity, FTLLaneRate.destinationCity)
    lane_rates = session.exec(query).all()

    # Enrich with joined data
    result = []
    for lr in lane_rates:
        response = FTLLaneRateResponse.model_validate(lr)
        # Get vehicle type name
        vt = session.get(FTLVehicleTypeMaster, lr.vehicleTypeId)
        if vt:
            response.vehicleTypeName = vt.name
        # Get vendor name
        vendor = session.get(FTLVendor, lr.vendorId)
        if vendor:
            response.vendorName = vendor.name
        result.append(response)

    return result


@router.get("/lane-rates/count")
def count_lane_rates(
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    vendor_id: Optional[UUID] = None,
    vehicle_type_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count FTL lane rates."""
    query = select(func.count(FTLLaneRate.id))

    if company_filter.company_id:
        query = query.where(FTLLaneRate.companyId == company_filter.company_id)
    if origin_city:
        query = query.where(FTLLaneRate.originCity.ilike(f"%{origin_city}%"))
    if destination_city:
        query = query.where(FTLLaneRate.destinationCity.ilike(f"%{destination_city}%"))
    if vendor_id:
        query = query.where(FTLLaneRate.vendorId == vendor_id)
    if vehicle_type_id:
        query = query.where(FTLLaneRate.vehicleTypeId == vehicle_type_id)
    if is_active is not None:
        query = query.where(FTLLaneRate.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/lane-rates/{lane_rate_id}", response_model=FTLLaneRateResponse)
def get_lane_rate(
    lane_rate_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get FTL lane rate by ID."""
    query = select(FTLLaneRate).where(FTLLaneRate.id == lane_rate_id)
    if company_filter.company_id:
        query = query.where(FTLLaneRate.companyId == company_filter.company_id)

    lane_rate = session.exec(query).first()
    if not lane_rate:
        raise HTTPException(status_code=404, detail="Lane rate not found")

    response = FTLLaneRateResponse.model_validate(lane_rate)
    # Get vehicle type name
    vt = session.get(FTLVehicleTypeMaster, lane_rate.vehicleTypeId)
    if vt:
        response.vehicleTypeName = vt.name
    # Get vendor name
    vendor = session.get(FTLVendor, lane_rate.vendorId)
    if vendor:
        response.vendorName = vendor.name

    return response


@router.post("/lane-rates", response_model=FTLLaneRateResponse, status_code=status.HTTP_201_CREATED)
def create_lane_rate(
    data: FTLLaneRateCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new FTL lane rate."""
    # Validate vehicle type exists
    vt = session.get(FTLVehicleTypeMaster, data.vehicleTypeId)
    if not vt:
        raise HTTPException(status_code=400, detail="Vehicle type not found")

    # Validate vendor exists
    vendor = session.get(FTLVendor, data.vendorId)
    if not vendor:
        raise HTTPException(status_code=400, detail="Vendor not found")

    lane_rate = FTLLaneRate(
        originCity=data.originCity,
        originState=data.originState,
        destinationCity=data.destinationCity,
        destinationState=data.destinationState,
        distanceKm=data.distanceKm,
        baseRate=data.baseRate,
        perKmRate=data.perKmRate,
        loadingCharges=data.loadingCharges,
        unloadingCharges=data.unloadingCharges,
        tollCharges=data.tollCharges,
        transitDays=data.transitDays,
        validFrom=data.validFrom or datetime.utcnow(),
        validTo=data.validTo,
        vehicleTypeId=data.vehicleTypeId,
        vendorId=data.vendorId,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(lane_rate)
    session.commit()
    session.refresh(lane_rate)

    response = FTLLaneRateResponse.model_validate(lane_rate)
    response.vehicleTypeName = vt.name
    response.vendorName = vendor.name
    return response


@router.patch("/lane-rates/{lane_rate_id}", response_model=FTLLaneRateResponse)
def update_lane_rate(
    lane_rate_id: UUID,
    data: FTLLaneRateUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update FTL lane rate."""
    query = select(FTLLaneRate).where(FTLLaneRate.id == lane_rate_id)
    if company_filter.company_id:
        query = query.where(FTLLaneRate.companyId == company_filter.company_id)

    lane_rate = session.exec(query).first()
    if not lane_rate:
        raise HTTPException(status_code=404, detail="Lane rate not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lane_rate, field, value)

    session.add(lane_rate)
    session.commit()
    session.refresh(lane_rate)

    response = FTLLaneRateResponse.model_validate(lane_rate)
    # Get vehicle type name
    vt = session.get(FTLVehicleTypeMaster, lane_rate.vehicleTypeId)
    if vt:
        response.vehicleTypeName = vt.name
    # Get vendor name
    vendor = session.get(FTLVendor, lane_rate.vendorId)
    if vendor:
        response.vendorName = vendor.name

    return response


@router.delete("/lane-rates/{lane_rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lane_rate(
    lane_rate_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete FTL lane rate (soft delete)."""
    query = select(FTLLaneRate).where(FTLLaneRate.id == lane_rate_id)
    if company_filter.company_id:
        query = query.where(FTLLaneRate.companyId == company_filter.company_id)

    lane_rate = session.exec(query).first()
    if not lane_rate:
        raise HTTPException(status_code=404, detail="Lane rate not found")

    lane_rate.isActive = False
    session.add(lane_rate)
    session.commit()


# ============================================================================
# Rate Comparison Endpoint
# ============================================================================

@router.get("/rate-comparison")
def compare_rates(
    origin_city: str,
    destination_city: str,
    vehicle_type_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Compare FTL rates from all vendors for a lane."""
    query = select(FTLLaneRate).where(
        FTLLaneRate.originCity.ilike(f"%{origin_city}%"),
        FTLLaneRate.destinationCity.ilike(f"%{destination_city}%"),
        FTLLaneRate.isActive == True,
        FTLLaneRate.validFrom <= datetime.utcnow(),
        (FTLLaneRate.validTo.is_(None)) | (FTLLaneRate.validTo >= datetime.utcnow())
    )

    if company_filter.company_id:
        query = query.where(FTLLaneRate.companyId == company_filter.company_id)
    if vehicle_type_id:
        query = query.where(FTLLaneRate.vehicleTypeId == vehicle_type_id)

    query = query.order_by(FTLLaneRate.baseRate)
    lane_rates = session.exec(query).all()

    # Build comparison result
    result = []
    for lr in lane_rates:
        vendor = session.get(FTLVendor, lr.vendorId)
        vt = session.get(FTLVehicleTypeMaster, lr.vehicleTypeId)

        total_rate = lr.baseRate
        if lr.loadingCharges:
            total_rate += lr.loadingCharges
        if lr.unloadingCharges:
            total_rate += lr.unloadingCharges
        if lr.tollCharges:
            total_rate += lr.tollCharges

        result.append({
            "laneRateId": str(lr.id),
            "vendorId": str(lr.vendorId),
            "vendorName": vendor.name if vendor else "Unknown",
            "vendorCode": vendor.code if vendor else "N/A",
            "vehicleTypeId": str(lr.vehicleTypeId),
            "vehicleTypeName": vt.name if vt else "Unknown",
            "capacityKg": vt.capacityKg if vt else 0,
            "baseRate": float(lr.baseRate),
            "loadingCharges": float(lr.loadingCharges or 0),
            "unloadingCharges": float(lr.unloadingCharges or 0),
            "tollCharges": float(lr.tollCharges or 0),
            "totalRate": float(total_rate),
            "transitDays": lr.transitDays,
            "reliabilityScore": float(vendor.reliabilityScore) if vendor and vendor.reliabilityScore else None
        })

    return {
        "originCity": origin_city,
        "destinationCity": destination_city,
        "ratesCount": len(result),
        "rates": result
    }
