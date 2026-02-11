"""
Channels API v1 - Channel Configurations and Order Imports
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    ChannelConfig, ChannelConfigCreate, ChannelConfigUpdate, ChannelConfigResponse,
    OrderImport, OrderImportCreate, OrderImportUpdate, OrderImportResponse, OrderImportSummary,
    User, Channel, ImportStatus
)

router = APIRouter(prefix="/channels", tags=["Channels"])


# ============================================================================
# Channel Config Endpoints
# ============================================================================

@router.get("/configs", response_model=List[ChannelConfigResponse])
def list_channel_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    channel: Optional[Channel] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List channel configurations."""
    query = select(ChannelConfig)

    query = company_filter.apply_filter(query, ChannelConfig.companyId)
    if channel:
        query = query.where(ChannelConfig.channel == channel)
    if is_active is not None:
        query = query.where(ChannelConfig.isActive == is_active)

    query = query.offset(skip).limit(limit)
    configs = session.exec(query).all()
    return [ChannelConfigResponse.model_validate(c) for c in configs]


@router.get("/configs/{config_id}", response_model=ChannelConfigResponse)
def get_channel_config(
    config_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get channel config by ID."""
    query = select(ChannelConfig).where(ChannelConfig.id == config_id)
    query = company_filter.apply_filter(query, ChannelConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="Channel config not found")
    return ChannelConfigResponse.model_validate(config)


@router.post("/configs", response_model=ChannelConfigResponse, status_code=status.HTTP_201_CREATED)
def create_channel_config(
    data: ChannelConfigCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new channel config."""
    config = ChannelConfig.model_validate(data)
    if company_filter.company_id:
        config.companyId = company_filter.company_id

    session.add(config)
    session.commit()
    session.refresh(config)
    return ChannelConfigResponse.model_validate(config)


@router.patch("/configs/{config_id}", response_model=ChannelConfigResponse)
def update_channel_config(
    config_id: UUID,
    data: ChannelConfigUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update channel config."""
    query = select(ChannelConfig).where(ChannelConfig.id == config_id)
    query = company_filter.apply_filter(query, ChannelConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="Channel config not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    session.add(config)
    session.commit()
    session.refresh(config)
    return ChannelConfigResponse.model_validate(config)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel_config(
    config_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete channel config."""
    query = select(ChannelConfig).where(ChannelConfig.id == config_id)
    query = company_filter.apply_filter(query, ChannelConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="Channel config not found")

    session.delete(config)
    session.commit()


@router.post("/configs/{config_id}/sync", response_model=dict)
def trigger_channel_sync(
    config_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Trigger manual sync for channel."""
    query = select(ChannelConfig).where(ChannelConfig.id == config_id)
    query = company_filter.apply_filter(query, ChannelConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="Channel config not found")

    # Update sync status
    config.syncStatus = ImportStatus.IN_PROGRESS
    config.lastSyncAt = datetime.utcnow()

    session.add(config)
    session.commit()

    return {"message": "Sync triggered", "config_id": str(config_id)}


# ============================================================================
# Order Import Endpoints
# ============================================================================

@router.get("/imports", response_model=List[OrderImportResponse])
def list_order_imports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[ImportStatus] = None,
    channel: Optional[Channel] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List order imports."""
    query = select(OrderImport)

    query = company_filter.apply_filter(query, OrderImport.companyId)
    if status:
        query = query.where(OrderImport.status == status)
    if channel:
        query = query.where(OrderImport.channel == channel)

    query = query.offset(skip).limit(limit).order_by(OrderImport.createdAt.desc())
    imports = session.exec(query).all()
    return [OrderImportResponse.model_validate(i) for i in imports]


@router.get("/imports/summary", response_model=OrderImportSummary)
def get_import_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get order import summary."""
    base_query = select(OrderImport)
    base_query = company_filter.apply_filter(base_query, OrderImport.companyId)

    pending = session.exec(
        select(func.count(OrderImport.id)).where(OrderImport.status == ImportStatus.PENDING)
    ).one()
    in_progress = session.exec(
        select(func.count(OrderImport.id)).where(OrderImport.status == ImportStatus.IN_PROGRESS)
    ).one()
    completed = session.exec(
        select(func.count(OrderImport.id)).where(OrderImport.status == ImportStatus.COMPLETED)
    ).one()
    failed = session.exec(
        select(func.count(OrderImport.id)).where(OrderImport.status == ImportStatus.FAILED)
    ).one()
    total_orders = session.exec(
        select(func.sum(OrderImport.successRows))
    ).one() or 0

    return OrderImportSummary(
        pending=pending,
        inProgress=in_progress,
        completed=completed,
        failed=failed,
        totalOrders=total_orders
    )


@router.get("/imports/{import_id}", response_model=OrderImportResponse)
def get_order_import(
    import_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get order import by ID."""
    query = select(OrderImport).where(OrderImport.id == import_id)
    query = company_filter.apply_filter(query, OrderImport.companyId)

    order_import = session.exec(query).first()
    if not order_import:
        raise HTTPException(status_code=404, detail="Order import not found")
    return OrderImportResponse.model_validate(order_import)


@router.post("/imports", response_model=OrderImportResponse, status_code=status.HTTP_201_CREATED)
def create_order_import(
    data: OrderImportCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new order import."""
    # Generate import number
    count = session.exec(select(func.count(OrderImport.id))).one()
    import_no = f"IMP-{count + 1:06d}"

    order_import = OrderImport(
        importNo=import_no,
        companyId=company_filter.company_id,
        createdById=current_user.id,
        **data.model_dump()
    )

    session.add(order_import)
    session.commit()
    session.refresh(order_import)
    return OrderImportResponse.model_validate(order_import)


@router.patch("/imports/{import_id}", response_model=OrderImportResponse)
def update_order_import(
    import_id: UUID,
    data: OrderImportUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update order import."""
    query = select(OrderImport).where(OrderImport.id == import_id)
    query = company_filter.apply_filter(query, OrderImport.companyId)

    order_import = session.exec(query).first()
    if not order_import:
        raise HTTPException(status_code=404, detail="Order import not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order_import, field, value)

    session.add(order_import)
    session.commit()
    session.refresh(order_import)
    return OrderImportResponse.model_validate(order_import)


@router.post("/imports/{import_id}/start", response_model=OrderImportResponse)
def start_order_import(
    import_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Start processing order import."""
    query = select(OrderImport).where(OrderImport.id == import_id)
    query = company_filter.apply_filter(query, OrderImport.companyId)

    order_import = session.exec(query).first()
    if not order_import:
        raise HTTPException(status_code=404, detail="Order import not found")

    order_import.status = ImportStatus.IN_PROGRESS
    order_import.startedAt = datetime.utcnow()

    session.add(order_import)
    session.commit()
    session.refresh(order_import)
    return OrderImportResponse.model_validate(order_import)
