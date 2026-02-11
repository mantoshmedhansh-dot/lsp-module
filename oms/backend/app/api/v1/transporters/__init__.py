"""
Transporters API v1 - Carrier and manifest management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    Transporter, TransporterCreate, TransporterUpdate, TransporterResponse, TransporterBrief,
    TransporterConfig, TransporterConfigCreate, TransporterConfigUpdate, TransporterConfigResponse,
    Manifest, ManifestCreate, ManifestUpdate, ManifestResponse, ManifestBrief,
    User, TransporterType, ManifestStatus,
    Delivery, Order, OrderStatus, DeliveryStatus
)

router = APIRouter(prefix="/transporters", tags=["Transporters"])


# ============================================================================
# Transporter Endpoints
# ============================================================================

@router.get("", response_model=List[TransporterBrief])
def list_transporters(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    transporter_type: Optional[TransporterType] = None,
    is_active: Optional[bool] = None,
    api_enabled: Optional[bool] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List transporters with filters."""
    query = select(Transporter)

    if transporter_type:
        query = query.where(Transporter.type == transporter_type)
    if is_active is not None:
        query = query.where(Transporter.isActive == is_active)
    if api_enabled is not None:
        query = query.where(Transporter.apiEnabled == api_enabled)

    query = query.offset(skip).limit(limit).order_by(Transporter.name)

    transporters = session.exec(query).all()
    return [TransporterBrief.model_validate(t) for t in transporters]


@router.get("/count")
def count_transporters(
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of transporters."""
    query = select(func.count(Transporter.id))

    if is_active is not None:
        query = query.where(Transporter.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{transporter_id}", response_model=TransporterResponse)
def get_transporter(
    transporter_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get transporter by ID."""
    transporter = session.get(Transporter, transporter_id)
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")
    return TransporterResponse.model_validate(transporter)


@router.get("/code/{code}", response_model=TransporterResponse)
def get_transporter_by_code(
    code: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get transporter by code."""
    query = select(Transporter).where(Transporter.code == code)
    transporter = session.exec(query).first()
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")
    return TransporterResponse.model_validate(transporter)


@router.post("", response_model=TransporterResponse, status_code=status.HTTP_201_CREATED)
def create_transporter(
    data: TransporterCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Create new transporter."""
    transporter = Transporter.model_validate(data)
    session.add(transporter)
    session.commit()
    session.refresh(transporter)
    return TransporterResponse.model_validate(transporter)


@router.patch("/{transporter_id}", response_model=TransporterResponse)
def update_transporter(
    transporter_id: UUID,
    data: TransporterUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Update transporter."""
    transporter = session.get(Transporter, transporter_id)
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transporter, field, value)

    session.add(transporter)
    session.commit()
    session.refresh(transporter)
    return TransporterResponse.model_validate(transporter)


@router.delete("/{transporter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transporter(
    transporter_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete transporter."""
    transporter = session.get(Transporter, transporter_id)
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")

    session.delete(transporter)
    session.commit()


# ============================================================================
# Transporter Config Endpoints
# ============================================================================

@router.get("/configs", response_model=List[TransporterConfigResponse])
def list_configs(
    company_filter: CompanyFilter = Depends(),
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List transporter configurations for company."""
    query = select(TransporterConfig)

    query = company_filter.apply_filter(query, TransporterConfig.companyId)
    if is_active is not None:
        query = query.where(TransporterConfig.isActive == is_active)

    query = query.order_by(TransporterConfig.priority.desc())
    configs = session.exec(query).all()
    return [TransporterConfigResponse.model_validate(c) for c in configs]


@router.get("/configs/{config_id}", response_model=TransporterConfigResponse)
def get_config(
    config_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get transporter config by ID."""
    config = session.get(TransporterConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Transporter config not found")
    return TransporterConfigResponse.model_validate(config)


@router.post("/configs", response_model=TransporterConfigResponse, status_code=status.HTTP_201_CREATED)
def create_config(
    data: TransporterConfigCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create transporter configuration for company."""
    config = TransporterConfig.model_validate(data)
    session.add(config)
    session.commit()
    session.refresh(config)
    return TransporterConfigResponse.model_validate(config)


@router.patch("/configs/{config_id}", response_model=TransporterConfigResponse)
def update_config(
    config_id: UUID,
    data: TransporterConfigUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update transporter configuration."""
    config = session.get(TransporterConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Transporter config not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    session.add(config)
    session.commit()
    session.refresh(config)
    return TransporterConfigResponse.model_validate(config)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_config(
    config_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete transporter configuration."""
    config = session.get(TransporterConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Transporter config not found")

    session.delete(config)
    session.commit()


# ============================================================================
# Manifest Endpoints
# ============================================================================

@router.get("/manifests", response_model=List[ManifestBrief])
def list_manifests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[ManifestStatus] = None,
    transporter_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List manifests with filters."""
    query = select(Manifest)

    if status:
        query = query.where(Manifest.status == status)
    if transporter_id:
        query = query.where(Manifest.transporterId == transporter_id)
    if date_from:
        query = query.where(Manifest.createdAt >= date_from)
    if date_to:
        query = query.where(Manifest.createdAt <= date_to)

    query = query.offset(skip).limit(limit).order_by(Manifest.createdAt.desc())

    manifests = session.exec(query).all()
    return [ManifestBrief.model_validate(m) for m in manifests]


@router.get("/manifests/count")
def count_manifests(
    status: Optional[ManifestStatus] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of manifests."""
    query = select(func.count(Manifest.id))

    if status:
        query = query.where(Manifest.status == status)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/manifests/{manifest_id}", response_model=ManifestResponse)
def get_manifest(
    manifest_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get manifest by ID."""
    manifest = session.get(Manifest, manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")
    return ManifestResponse.model_validate(manifest)


@router.post("/manifests", response_model=ManifestResponse, status_code=status.HTTP_201_CREATED)
def create_manifest(
    data: ManifestCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new manifest."""
    manifest = Manifest.model_validate(data)
    session.add(manifest)
    session.commit()
    session.refresh(manifest)
    return ManifestResponse.model_validate(manifest)


@router.patch("/manifests/{manifest_id}", response_model=ManifestResponse)
def update_manifest(
    manifest_id: UUID,
    data: ManifestUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update manifest."""
    manifest = session.get(Manifest, manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(manifest, field, value)

    session.add(manifest)
    session.commit()
    session.refresh(manifest)
    return ManifestResponse.model_validate(manifest)


@router.post("/manifests/{manifest_id}/close", response_model=ManifestResponse)
def close_manifest(
    manifest_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Close manifest (ready for handover).

    Updates:
    - Manifest status → CLOSED
    - All orders with deliveries in this manifest → MANIFESTED
    """
    manifest = session.get(Manifest, manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    manifest.status = ManifestStatus.CLOSED
    session.add(manifest)

    # Update all orders with deliveries in this manifest to MANIFESTED status
    deliveries = session.exec(
        select(Delivery).where(Delivery.manifestId == manifest_id)
    ).all()

    order_ids_updated = set()
    for delivery in deliveries:
        if delivery.orderId and delivery.orderId not in order_ids_updated:
            order = session.get(Order, delivery.orderId)
            if order and order.status == OrderStatus.PACKED:
                order.status = OrderStatus.MANIFESTED
                order.updatedAt = datetime.utcnow()
                session.add(order)
                order_ids_updated.add(delivery.orderId)

    session.commit()
    session.refresh(manifest)
    return ManifestResponse.model_validate(manifest)


@router.post("/manifests/{manifest_id}/handover", response_model=ManifestResponse)
def handover_manifest(
    manifest_id: UUID,
    vehicle_no: Optional[str] = None,
    driver_name: Optional[str] = None,
    driver_phone: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Mark manifest as handed over to carrier.

    Updates:
    - Manifest status → HANDED_OVER
    - All deliveries in manifest → SHIPPED
    - All orders for those deliveries → SHIPPED
    """
    manifest = session.get(Manifest, manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    manifest.status = ManifestStatus.HANDED_OVER
    manifest.confirmedAt = datetime.utcnow()
    manifest.confirmedBy = current_user.id

    if vehicle_no:
        manifest.vehicleNo = vehicle_no
    if driver_name:
        manifest.driverName = driver_name
    if driver_phone:
        manifest.driverPhone = driver_phone

    session.add(manifest)

    # Update all deliveries in this manifest to SHIPPED status
    deliveries = session.exec(
        select(Delivery).where(Delivery.manifestId == manifest_id)
    ).all()

    order_ids_updated = set()
    for delivery in deliveries:
        delivery.status = DeliveryStatus.SHIPPED
        delivery.shippedAt = datetime.utcnow()
        session.add(delivery)

        # Also update the order status to SHIPPED
        if delivery.orderId and delivery.orderId not in order_ids_updated:
            order = session.get(Order, delivery.orderId)
            if order and order.status in [OrderStatus.PACKED, OrderStatus.MANIFESTED]:
                order.status = OrderStatus.SHIPPED
                order.updatedAt = datetime.utcnow()
                session.add(order)
                order_ids_updated.add(delivery.orderId)

    session.commit()
    session.refresh(manifest)
    return ManifestResponse.model_validate(manifest)
