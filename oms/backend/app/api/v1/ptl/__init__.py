"""
PTL (Part Truck Load) / B2B Rate Matrix API v1
N×N Origin-Destination Rate Matrix and TAT Matrix Management
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    PTLRateMatrix, PTLRateMatrixCreate, PTLRateMatrixUpdate, PTLRateMatrixResponse,
    PTLTATMatrix, PTLTATMatrixCreate, PTLTATMatrixUpdate, PTLTATMatrixResponse,
    Transporter,
    User
)

router = APIRouter(prefix="/ptl", tags=["PTL - Part Truck Load / B2B"])


# ============================================================================
# Rate Matrix Endpoints
# ============================================================================

@router.get("/rate-matrix", response_model=List[PTLRateMatrixResponse])
def list_rate_matrix(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List PTL rate matrix entries."""
    query = select(PTLRateMatrix)
    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)
    if origin_city:
        query = query.where(PTLRateMatrix.originCity.ilike(f"%{origin_city}%"))
    if destination_city:
        query = query.where(PTLRateMatrix.destinationCity.ilike(f"%{destination_city}%"))
    if transporter_id:
        query = query.where(PTLRateMatrix.transporterId == transporter_id)
    if is_active is not None:
        query = query.where(PTLRateMatrix.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(PTLRateMatrix.originCity, PTLRateMatrix.destinationCity)
    rate_matrix = session.exec(query).all()

    # Enrich with transporter name
    result = []
    for rm in rate_matrix:
        response = PTLRateMatrixResponse.model_validate(rm)
        transporter = session.get(Transporter, rm.transporterId)
        if transporter:
            response.transporterName = transporter.name
        result.append(response)

    return result


@router.get("/rate-matrix/count")
def count_rate_matrix(
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count PTL rate matrix entries."""
    query = select(func.count(PTLRateMatrix.id))
    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)
    if origin_city:
        query = query.where(PTLRateMatrix.originCity.ilike(f"%{origin_city}%"))
    if destination_city:
        query = query.where(PTLRateMatrix.destinationCity.ilike(f"%{destination_city}%"))
    if transporter_id:
        query = query.where(PTLRateMatrix.transporterId == transporter_id)
    if is_active is not None:
        query = query.where(PTLRateMatrix.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/rate-matrix/{rate_matrix_id}", response_model=PTLRateMatrixResponse)
def get_rate_matrix(
    rate_matrix_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get PTL rate matrix entry by ID."""
    query = select(PTLRateMatrix).where(PTLRateMatrix.id == rate_matrix_id)
    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)

    rate_matrix = session.exec(query).first()
    if not rate_matrix:
        raise HTTPException(status_code=404, detail="Rate matrix entry not found")

    response = PTLRateMatrixResponse.model_validate(rate_matrix)
    transporter = session.get(Transporter, rate_matrix.transporterId)
    if transporter:
        response.transporterName = transporter.name

    return response


@router.post("/rate-matrix", response_model=PTLRateMatrixResponse, status_code=status.HTTP_201_CREATED)
def create_rate_matrix(
    data: PTLRateMatrixCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new PTL rate matrix entry."""
    # Validate transporter exists
    transporter = session.get(Transporter, data.transporterId)
    if not transporter:
        raise HTTPException(status_code=400, detail="Transporter not found")

    rate_matrix = PTLRateMatrix(
        originCity=data.originCity,
        originState=data.originState,
        destinationCity=data.destinationCity,
        destinationState=data.destinationState,
        rate0to50=data.rate0to50,
        rate50to100=data.rate50to100,
        rate100to250=data.rate100to250,
        rate250to500=data.rate250to500,
        rate500to1000=data.rate500to1000,
        rate1000plus=data.rate1000plus,
        minimumCharge=data.minimumCharge,
        fodCharge=data.fodCharge,
        odaCharge=data.odaCharge,
        codPercent=data.codPercent,
        validFrom=data.validFrom or datetime.utcnow(),
        validTo=data.validTo,
        transporterId=data.transporterId,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(rate_matrix)
    session.commit()
    session.refresh(rate_matrix)

    response = PTLRateMatrixResponse.model_validate(rate_matrix)
    response.transporterName = transporter.name
    return response


@router.patch("/rate-matrix/{rate_matrix_id}", response_model=PTLRateMatrixResponse)
def update_rate_matrix(
    rate_matrix_id: UUID,
    data: PTLRateMatrixUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update PTL rate matrix entry."""
    query = select(PTLRateMatrix).where(PTLRateMatrix.id == rate_matrix_id)
    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)

    rate_matrix = session.exec(query).first()
    if not rate_matrix:
        raise HTTPException(status_code=404, detail="Rate matrix entry not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rate_matrix, field, value)

    session.add(rate_matrix)
    session.commit()
    session.refresh(rate_matrix)

    response = PTLRateMatrixResponse.model_validate(rate_matrix)
    transporter = session.get(Transporter, rate_matrix.transporterId)
    if transporter:
        response.transporterName = transporter.name

    return response


@router.delete("/rate-matrix/{rate_matrix_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate_matrix(
    rate_matrix_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete PTL rate matrix entry (soft delete)."""
    query = select(PTLRateMatrix).where(PTLRateMatrix.id == rate_matrix_id)
    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)

    rate_matrix = session.exec(query).first()
    if not rate_matrix:
        raise HTTPException(status_code=404, detail="Rate matrix entry not found")

    rate_matrix.isActive = False
    session.add(rate_matrix)
    session.commit()


# ============================================================================
# TAT Matrix Endpoints
# ============================================================================

@router.get("/tat-matrix", response_model=List[PTLTATMatrixResponse])
def list_tat_matrix(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List PTL TAT matrix entries."""
    query = select(PTLTATMatrix)
    query = company_filter.apply_filter(query, PTLTATMatrix.companyId)
    if origin_city:
        query = query.where(PTLTATMatrix.originCity.ilike(f"%{origin_city}%"))
    if destination_city:
        query = query.where(PTLTATMatrix.destinationCity.ilike(f"%{destination_city}%"))
    if transporter_id:
        query = query.where(PTLTATMatrix.transporterId == transporter_id)
    if is_active is not None:
        query = query.where(PTLTATMatrix.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(PTLTATMatrix.originCity, PTLTATMatrix.destinationCity)
    tat_matrix = session.exec(query).all()

    # Enrich with transporter name
    result = []
    for tm in tat_matrix:
        response = PTLTATMatrixResponse.model_validate(tm)
        transporter = session.get(Transporter, tm.transporterId)
        if transporter:
            response.transporterName = transporter.name
        result.append(response)

    return result


@router.get("/tat-matrix/count")
def count_tat_matrix(
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count PTL TAT matrix entries."""
    query = select(func.count(PTLTATMatrix.id))
    query = company_filter.apply_filter(query, PTLTATMatrix.companyId)
    if origin_city:
        query = query.where(PTLTATMatrix.originCity.ilike(f"%{origin_city}%"))
    if destination_city:
        query = query.where(PTLTATMatrix.destinationCity.ilike(f"%{destination_city}%"))
    if transporter_id:
        query = query.where(PTLTATMatrix.transporterId == transporter_id)
    if is_active is not None:
        query = query.where(PTLTATMatrix.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/tat-matrix/{tat_matrix_id}", response_model=PTLTATMatrixResponse)
def get_tat_matrix(
    tat_matrix_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get PTL TAT matrix entry by ID."""
    query = select(PTLTATMatrix).where(PTLTATMatrix.id == tat_matrix_id)
    query = company_filter.apply_filter(query, PTLTATMatrix.companyId)

    tat_matrix = session.exec(query).first()
    if not tat_matrix:
        raise HTTPException(status_code=404, detail="TAT matrix entry not found")

    response = PTLTATMatrixResponse.model_validate(tat_matrix)
    transporter = session.get(Transporter, tat_matrix.transporterId)
    if transporter:
        response.transporterName = transporter.name

    return response


@router.post("/tat-matrix", response_model=PTLTATMatrixResponse, status_code=status.HTTP_201_CREATED)
def create_tat_matrix(
    data: PTLTATMatrixCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new PTL TAT matrix entry."""
    # Validate transporter exists
    transporter = session.get(Transporter, data.transporterId)
    if not transporter:
        raise HTTPException(status_code=400, detail="Transporter not found")

    tat_matrix = PTLTATMatrix(
        originCity=data.originCity,
        originState=data.originState,
        destinationCity=data.destinationCity,
        destinationState=data.destinationState,
        transitDays=data.transitDays,
        minTransitDays=data.minTransitDays,
        maxTransitDays=data.maxTransitDays,
        transporterId=data.transporterId,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(tat_matrix)
    session.commit()
    session.refresh(tat_matrix)

    response = PTLTATMatrixResponse.model_validate(tat_matrix)
    response.transporterName = transporter.name
    return response


@router.patch("/tat-matrix/{tat_matrix_id}", response_model=PTLTATMatrixResponse)
def update_tat_matrix(
    tat_matrix_id: UUID,
    data: PTLTATMatrixUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update PTL TAT matrix entry."""
    query = select(PTLTATMatrix).where(PTLTATMatrix.id == tat_matrix_id)
    query = company_filter.apply_filter(query, PTLTATMatrix.companyId)

    tat_matrix = session.exec(query).first()
    if not tat_matrix:
        raise HTTPException(status_code=404, detail="TAT matrix entry not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tat_matrix, field, value)

    session.add(tat_matrix)
    session.commit()
    session.refresh(tat_matrix)

    response = PTLTATMatrixResponse.model_validate(tat_matrix)
    transporter = session.get(Transporter, tat_matrix.transporterId)
    if transporter:
        response.transporterName = transporter.name

    return response


@router.delete("/tat-matrix/{tat_matrix_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tat_matrix(
    tat_matrix_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete PTL TAT matrix entry (soft delete)."""
    query = select(PTLTATMatrix).where(PTLTATMatrix.id == tat_matrix_id)
    query = company_filter.apply_filter(query, PTLTATMatrix.companyId)

    tat_matrix = session.exec(query).first()
    if not tat_matrix:
        raise HTTPException(status_code=404, detail="TAT matrix entry not found")

    tat_matrix.isActive = False
    session.add(tat_matrix)
    session.commit()


# ============================================================================
# Rate Comparison Endpoint
# ============================================================================

@router.get("/rate-comparison")
def compare_ptl_rates(
    origin_city: str,
    destination_city: str,
    weight_kg: float = Query(..., gt=0, description="Shipment weight in kg"),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Compare PTL rates from all transporters for a lane and weight."""
    query = select(PTLRateMatrix).where(
        PTLRateMatrix.originCity.ilike(f"%{origin_city}%"),
        PTLRateMatrix.destinationCity.ilike(f"%{destination_city}%"),
        PTLRateMatrix.isActive == True,
        PTLRateMatrix.validFrom <= datetime.utcnow(),
        (PTLRateMatrix.validTo.is_(None)) | (PTLRateMatrix.validTo >= datetime.utcnow())
    )

    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)

    rate_entries = session.exec(query).all()

    # Calculate rates for the given weight
    result = []
    for rm in rate_entries:
        transporter = session.get(Transporter, rm.transporterId)

        # Determine rate per kg based on weight slab
        rate_per_kg = None
        if weight_kg <= 50 and rm.rate0to50:
            rate_per_kg = rm.rate0to50
        elif weight_kg <= 100 and rm.rate50to100:
            rate_per_kg = rm.rate50to100
        elif weight_kg <= 250 and rm.rate100to250:
            rate_per_kg = rm.rate100to250
        elif weight_kg <= 500 and rm.rate250to500:
            rate_per_kg = rm.rate250to500
        elif weight_kg <= 1000 and rm.rate500to1000:
            rate_per_kg = rm.rate500to1000
        elif rm.rate1000plus:
            rate_per_kg = rm.rate1000plus

        if rate_per_kg is None:
            continue  # Skip if no rate for this weight

        # Calculate total
        base_cost = float(rate_per_kg) * weight_kg
        fod_charge = float(rm.fodCharge or 0)
        oda_charge = float(rm.odaCharge or 0)
        total_cost = max(base_cost + fod_charge + oda_charge, float(rm.minimumCharge or 0))

        # Get TAT if available
        tat_query = select(PTLTATMatrix).where(
            PTLTATMatrix.originCity.ilike(f"%{origin_city}%"),
            PTLTATMatrix.destinationCity.ilike(f"%{destination_city}%"),
            PTLTATMatrix.transporterId == rm.transporterId,
            PTLTATMatrix.isActive == True
        )
        tat_entry = session.exec(tat_query).first()

        result.append({
            "rateMatrixId": str(rm.id),
            "transporterId": str(rm.transporterId),
            "transporterName": transporter.name if transporter else "Unknown",
            "ratePerKg": float(rate_per_kg),
            "weightKg": weight_kg,
            "baseCost": round(base_cost, 2),
            "fodCharge": fod_charge,
            "odaCharge": oda_charge,
            "totalCost": round(total_cost, 2),
            "minimumCharge": float(rm.minimumCharge or 0),
            "codPercent": float(rm.codPercent or 0),
            "transitDays": tat_entry.transitDays if tat_entry else None,
            "onTimeDeliveryPercent": float(tat_entry.onTimeDeliveryPercent) if tat_entry and tat_entry.onTimeDeliveryPercent else None
        })

    # Sort by total cost
    result.sort(key=lambda x: x["totalCost"])

    return {
        "originCity": origin_city,
        "destinationCity": destination_city,
        "weightKg": weight_kg,
        "ratesCount": len(result),
        "rates": result
    }


@router.post("/calculate-rate")
def calculate_ptl_rate(
    origin_city: str,
    destination_city: str,
    transporter_id: UUID,
    weight_kg: float = Query(..., gt=0),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Calculate PTL shipping rate for a specific transporter."""
    query = select(PTLRateMatrix).where(
        PTLRateMatrix.originCity.ilike(f"%{origin_city}%"),
        PTLRateMatrix.destinationCity.ilike(f"%{destination_city}%"),
        PTLRateMatrix.transporterId == transporter_id,
        PTLRateMatrix.isActive == True,
        PTLRateMatrix.validFrom <= datetime.utcnow(),
        (PTLRateMatrix.validTo.is_(None)) | (PTLRateMatrix.validTo >= datetime.utcnow())
    )

    query = company_filter.apply_filter(query, PTLRateMatrix.companyId)

    rm = session.exec(query).first()
    if not rm:
        raise HTTPException(status_code=404, detail="Rate matrix entry not found for this lane and transporter")

    transporter = session.get(Transporter, rm.transporterId)

    # Determine rate per kg based on weight slab
    rate_per_kg = None
    weight_slab = ""
    if weight_kg <= 50:
        rate_per_kg = rm.rate0to50
        weight_slab = "0-50 kg"
    elif weight_kg <= 100:
        rate_per_kg = rm.rate50to100
        weight_slab = "50-100 kg"
    elif weight_kg <= 250:
        rate_per_kg = rm.rate100to250
        weight_slab = "100-250 kg"
    elif weight_kg <= 500:
        rate_per_kg = rm.rate250to500
        weight_slab = "250-500 kg"
    elif weight_kg <= 1000:
        rate_per_kg = rm.rate500to1000
        weight_slab = "500-1000 kg"
    else:
        rate_per_kg = rm.rate1000plus
        weight_slab = "1000+ kg"

    if rate_per_kg is None:
        raise HTTPException(status_code=400, detail=f"No rate configured for weight slab: {weight_slab}")

    # Calculate total
    base_cost = float(rate_per_kg) * weight_kg
    fod_charge = float(rm.fodCharge or 0)
    oda_charge = float(rm.odaCharge or 0)
    total_cost = max(base_cost + fod_charge + oda_charge, float(rm.minimumCharge or 0))

    return {
        "originCity": origin_city,
        "destinationCity": destination_city,
        "transporterId": str(transporter_id),
        "transporterName": transporter.name if transporter else "Unknown",
        "weightKg": weight_kg,
        "weightSlab": weight_slab,
        "ratePerKg": float(rate_per_kg),
        "baseCost": round(base_cost, 2),
        "fodCharge": fod_charge,
        "odaCharge": oda_charge,
        "minimumChargeApplied": total_cost == float(rm.minimumCharge or 0),
        "totalCost": round(total_cost, 2),
        "codPercent": float(rm.codPercent or 0)
    }
