"""
Inventory Sync API v1 - Marketplace inventory synchronization
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    MarketplaceConnection,
    MarketplaceSyncJob,
    MarketplaceSyncJobResponse,
    MarketplaceInventorySyncLog,
    MarketplaceInventorySyncLogResponse,
    MarketplaceSkuMapping,
    SyncJobType,
    SyncJobStatus,
    ConnectionStatus,
    TriggerSyncRequest,
    TriggerSyncResponse,
)
from app.services.marketplaces import SyncCoordinator


router = APIRouter(prefix="/inventory-sync", tags=["Inventory Sync"])


# ============================================================================
# Sync Triggers
# ============================================================================

@router.post("/push", response_model=TriggerSyncResponse)
async def push_inventory(
    connection_id: UUID,
    sku_ids: Optional[List[UUID]] = None,
    full_sync: bool = False,
    background_tasks: BackgroundTasks = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Push inventory to a marketplace"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Verify connection
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.CONNECTED:
        raise HTTPException(
            status_code=400,
            detail=f"Connection not active: {connection.status}"
        )

    coordinator = SyncCoordinator(session)

    # Create sync job
    job = await coordinator.create_sync_job(
        company_id=company_filter.company_id,
        connection_id=connection_id,
        job_type=SyncJobType.INVENTORY_PUSH,
        triggered_by="MANUAL",
        triggered_by_id=current_user.id
    )

    # Run sync in background
    async def run_push():
        await coordinator.push_inventory(
            connection_id=connection_id,
            sku_ids=sku_ids,
            full_sync=full_sync,
            triggered_by="MANUAL",
            triggered_by_id=current_user.id
        )

    if background_tasks:
        background_tasks.add_task(run_push)

    return TriggerSyncResponse(
        jobId=job.id,
        connectionId=connection_id,
        jobType=SyncJobType.INVENTORY_PUSH,
        status=SyncJobStatus.PENDING,
        message="Inventory push initiated"
    )


@router.post("/push-all")
async def push_inventory_all(
    sku_ids: Optional[List[UUID]] = None,
    background_tasks: BackgroundTasks = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Push inventory to all active marketplace connections"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Get all active connections
    connections = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
        .where(MarketplaceConnection.status == ConnectionStatus.CONNECTED)
        .where(MarketplaceConnection.isActive == True)
    ).all()

    if not connections:
        return {
            "success": True,
            "message": "No active connections",
            "jobs": []
        }

    coordinator = SyncCoordinator(session)
    jobs = []

    for connection in connections:
        try:
            job = await coordinator.create_sync_job(
                company_id=company_filter.company_id,
                connection_id=connection.id,
                job_type=SyncJobType.INVENTORY_PUSH,
                triggered_by="MANUAL",
                triggered_by_id=current_user.id
            )
            jobs.append({
                "jobId": str(job.id),
                "connectionId": str(connection.id),
                "marketplace": connection.marketplace.value
            })
        except Exception as e:
            jobs.append({
                "connectionId": str(connection.id),
                "marketplace": connection.marketplace.value,
                "error": str(e)
            })

    return {
        "success": True,
        "message": f"Initiated inventory push for {len(jobs)} connections",
        "jobs": jobs
    }


# ============================================================================
# SKU-Level Push
# ============================================================================

@router.post("/push-sku/{sku_id}")
async def push_sku_inventory(
    sku_id: UUID,
    connection_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Push inventory for a specific SKU to all or specific marketplace"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Get SKU mappings
    query = select(MarketplaceSkuMapping).where(
        MarketplaceSkuMapping.companyId == company_filter.company_id,
        MarketplaceSkuMapping.skuId == sku_id,
        MarketplaceSkuMapping.syncEnabled == True
    )

    if connection_id:
        query = query.where(MarketplaceSkuMapping.connectionId == connection_id)

    mappings = session.exec(query).all()

    if not mappings:
        raise HTTPException(
            status_code=404,
            detail="No active mappings found for this SKU"
        )

    coordinator = SyncCoordinator(session)
    results = []

    # Group by connection
    by_connection = {}
    for mapping in mappings:
        if mapping.connectionId not in by_connection:
            by_connection[mapping.connectionId] = []
        by_connection[mapping.connectionId].append(mapping)

    for conn_id, conn_mappings in by_connection.items():
        try:
            result = await coordinator.push_inventory(
                connection_id=conn_id,
                sku_ids=[sku_id],
                triggered_by="MANUAL",
                triggered_by_id=current_user.id
            )
            results.append({
                "connectionId": str(conn_id),
                "success": result.get("success", False),
                "successCount": result.get("success_count", 0),
                "failedCount": result.get("failed_count", 0)
            })
        except Exception as e:
            results.append({
                "connectionId": str(conn_id),
                "success": False,
                "error": str(e)
            })

    return {
        "skuId": str(sku_id),
        "results": results
    }


# ============================================================================
# Sync Jobs and Logs
# ============================================================================

@router.get("/jobs", response_model=List[MarketplaceSyncJobResponse])
def list_inventory_sync_jobs(
    connection_id: Optional[UUID] = None,
    status: Optional[SyncJobStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List inventory sync jobs"""
    query = select(MarketplaceSyncJob).where(
        MarketplaceSyncJob.jobType == SyncJobType.INVENTORY_PUSH
    )

    query = company_filter.apply_filter(query, MarketplaceSyncJob.companyId)

    if connection_id:
        query = query.where(MarketplaceSyncJob.connectionId == connection_id)

    if status:
        query = query.where(MarketplaceSyncJob.status == status)

    query = query.order_by(MarketplaceSyncJob.createdAt.desc())
    query = query.offset(skip).limit(limit)

    jobs = session.exec(query).all()
    return jobs


@router.get("/logs", response_model=List[MarketplaceInventorySyncLogResponse])
def list_inventory_sync_logs(
    connection_id: Optional[UUID] = None,
    sku_id: Optional[UUID] = None,
    status: Optional[SyncJobStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List inventory sync logs"""
    query = select(MarketplaceInventorySyncLog)

    query = company_filter.apply_filter(query, MarketplaceInventorySyncLog.companyId)

    if connection_id:
        query = query.where(MarketplaceInventorySyncLog.connectionId == connection_id)

    if sku_id:
        query = query.where(MarketplaceInventorySyncLog.skuId == sku_id)

    if status:
        query = query.where(MarketplaceInventorySyncLog.syncStatus == status)

    query = query.order_by(MarketplaceInventorySyncLog.createdAt.desc())
    query = query.offset(skip).limit(limit)

    logs = session.exec(query).all()
    return logs


# ============================================================================
# Status and Statistics
# ============================================================================

@router.get("/status")
def get_inventory_sync_status(
    connection_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inventory sync status per channel"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Get connections
    query = select(MarketplaceConnection).where(
        MarketplaceConnection.companyId == company_filter.company_id,
        MarketplaceConnection.isActive == True
    )

    if connection_id:
        query = query.where(MarketplaceConnection.id == connection_id)

    connections = session.exec(query).all()

    status_list = []
    for conn in connections:
        # Get last sync job
        last_job = session.exec(
            select(MarketplaceSyncJob)
            .where(MarketplaceSyncJob.connectionId == conn.id)
            .where(MarketplaceSyncJob.jobType == SyncJobType.INVENTORY_PUSH)
            .order_by(MarketplaceSyncJob.completedAt.desc())
            .limit(1)
        ).first()

        # Get mapping count
        mapping_count = session.exec(
            select(func.count(MarketplaceSkuMapping.id))
            .where(MarketplaceSkuMapping.connectionId == conn.id)
            .where(MarketplaceSkuMapping.syncEnabled == True)
        ).one()

        status_list.append({
            "connectionId": str(conn.id),
            "marketplace": conn.marketplace.value,
            "connectionName": conn.connectionName,
            "status": conn.status.value,
            "lastSyncAt": last_job.completedAt.isoformat() if last_job and last_job.completedAt else None,
            "lastSyncStatus": last_job.status.value if last_job else None,
            "lastSyncSuccess": last_job.recordsSuccess if last_job else 0,
            "lastSyncFailed": last_job.recordsFailed if last_job else 0,
            "activeMappings": mapping_count
        })

    return {
        "connections": status_list,
        "totalConnections": len(connections)
    }


@router.get("/stats")
def get_inventory_sync_stats(
    days: int = Query(7, ge=1, le=90),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inventory sync statistics"""
    from datetime import timedelta

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    since = datetime.utcnow() - timedelta(days=days)

    # Get jobs
    jobs = session.exec(
        select(MarketplaceSyncJob)
        .where(MarketplaceSyncJob.companyId == company_filter.company_id)
        .where(MarketplaceSyncJob.jobType == SyncJobType.INVENTORY_PUSH)
        .where(MarketplaceSyncJob.createdAt >= since)
    ).all()

    total_jobs = len(jobs)
    completed = len([j for j in jobs if j.status == SyncJobStatus.COMPLETED])
    failed = len([j for j in jobs if j.status == SyncJobStatus.FAILED])
    total_updates = sum(j.recordsSuccess or 0 for j in jobs)
    total_failed_updates = sum(j.recordsFailed or 0 for j in jobs)

    # Get logs count
    log_count = session.exec(
        select(func.count(MarketplaceInventorySyncLog.id))
        .where(MarketplaceInventorySyncLog.companyId == company_filter.company_id)
        .where(MarketplaceInventorySyncLog.createdAt >= since)
    ).one()

    return {
        "period_days": days,
        "total_sync_jobs": total_jobs,
        "completed_jobs": completed,
        "failed_jobs": failed,
        "success_rate": (completed / total_jobs * 100) if total_jobs > 0 else 0,
        "total_sku_updates": total_updates,
        "failed_updates": total_failed_updates,
        "total_sync_logs": log_count
    }


# ============================================================================
# Configuration
# ============================================================================

@router.get("/config/{connection_id}")
def get_inventory_sync_config(
    connection_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inventory sync configuration for a connection"""
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    sync_settings = connection.syncSettings or {}

    return {
        "connectionId": str(connection_id),
        "marketplace": connection.marketplace.value,
        "inventorySyncEnabled": sync_settings.get("inventory_sync_enabled", True),
        "syncFrequency": sync_settings.get("inventory_sync_frequency", "30"),
        "bufferPercentage": sync_settings.get("buffer_percentage", 0),
        "bufferQuantity": sync_settings.get("buffer_quantity", 0),
        "maxQuantity": sync_settings.get("max_quantity"),
        "syncOnOrderChange": sync_settings.get("sync_on_order_change", True),
        "syncOnStockChange": sync_settings.get("sync_on_stock_change", True)
    }


@router.patch("/config/{connection_id}")
def update_inventory_sync_config(
    connection_id: UUID,
    inventory_sync_enabled: Optional[bool] = None,
    sync_frequency: Optional[str] = None,
    buffer_percentage: Optional[int] = None,
    buffer_quantity: Optional[int] = None,
    max_quantity: Optional[int] = None,
    sync_on_order_change: Optional[bool] = None,
    sync_on_stock_change: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update inventory sync configuration for a connection"""
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    sync_settings = connection.syncSettings or {}

    if inventory_sync_enabled is not None:
        sync_settings["inventory_sync_enabled"] = inventory_sync_enabled

    if sync_frequency is not None:
        sync_settings["inventory_sync_frequency"] = sync_frequency

    if buffer_percentage is not None:
        sync_settings["buffer_percentage"] = buffer_percentage

    if buffer_quantity is not None:
        sync_settings["buffer_quantity"] = buffer_quantity

    if max_quantity is not None:
        sync_settings["max_quantity"] = max_quantity

    if sync_on_order_change is not None:
        sync_settings["sync_on_order_change"] = sync_on_order_change

    if sync_on_stock_change is not None:
        sync_settings["sync_on_stock_change"] = sync_on_stock_change

    connection.syncSettings = sync_settings
    connection.updatedAt = datetime.utcnow()
    session.add(connection)
    session.commit()

    return {"success": True, "message": "Configuration updated"}
