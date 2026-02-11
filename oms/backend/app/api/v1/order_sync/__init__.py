"""
Order Sync API v1 - Marketplace order synchronization
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    MarketplaceConnection,
    MarketplaceSyncJob,
    MarketplaceSyncJobResponse,
    MarketplaceOrderSync,
    MarketplaceOrderSyncResponse,
    SyncJobType,
    SyncJobStatus,
    ConnectionStatus,
    TriggerSyncRequest,
    TriggerSyncResponse,
)
from app.services.marketplaces import SyncCoordinator


router = APIRouter(prefix="/order-sync", tags=["Order Sync"])


# ============================================================================
# Sync Triggers
# ============================================================================

@router.post("/trigger", response_model=TriggerSyncResponse)
async def trigger_order_sync(
    data: TriggerSyncRequest,
    background_tasks: BackgroundTasks,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Trigger order sync for a marketplace connection"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Verify connection
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == data.connectionId)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.CONNECTED:
        raise HTTPException(
            status_code=400,
            detail=f"Connection not active: {connection.status}"
        )

    # Create sync coordinator
    coordinator = SyncCoordinator(session)

    # Create sync job
    job = await coordinator.create_sync_job(
        company_id=company_filter.company_id,
        connection_id=data.connectionId,
        job_type=SyncJobType.ORDER_PULL,
        triggered_by="MANUAL",
        triggered_by_id=current_user.id,
        sync_from_date=data.fromDate,
        sync_to_date=data.toDate
    )

    # Run sync in background
    async def run_sync():
        await coordinator.sync_orders(
            connection_id=data.connectionId,
            from_date=data.fromDate,
            to_date=data.toDate,
            triggered_by="MANUAL",
            triggered_by_id=current_user.id
        )

    background_tasks.add_task(run_sync)

    return TriggerSyncResponse(
        jobId=job.id,
        connectionId=data.connectionId,
        jobType=SyncJobType.ORDER_PULL,
        status=SyncJobStatus.PENDING,
        message="Order sync initiated"
    )


@router.post("/trigger-all")
async def trigger_all_order_sync(
    from_date: Optional[datetime] = None,
    background_tasks: BackgroundTasks = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Trigger order sync for all active marketplace connections"""
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
            "message": "No active connections to sync",
            "jobs": []
        }

    coordinator = SyncCoordinator(session)
    jobs = []

    for connection in connections:
        try:
            job = await coordinator.create_sync_job(
                company_id=company_filter.company_id,
                connection_id=connection.id,
                job_type=SyncJobType.ORDER_PULL,
                triggered_by="MANUAL",
                triggered_by_id=current_user.id,
                sync_from_date=from_date
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
        "message": f"Initiated sync for {len(jobs)} connections",
        "jobs": jobs
    }


# ============================================================================
# Sync Jobs
# ============================================================================

@router.get("/jobs", response_model=List[MarketplaceSyncJobResponse])
def list_sync_jobs(
    connection_id: Optional[UUID] = None,
    job_type: Optional[SyncJobType] = None,
    status: Optional[SyncJobStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List sync jobs"""
    query = select(MarketplaceSyncJob)

    query = company_filter.apply_filter(query, MarketplaceSyncJob.companyId)

    if connection_id:
        query = query.where(MarketplaceSyncJob.connectionId == connection_id)

    if job_type:
        query = query.where(MarketplaceSyncJob.jobType == job_type)

    if status:
        query = query.where(MarketplaceSyncJob.status == status)

    query = query.order_by(MarketplaceSyncJob.createdAt.desc())
    query = query.offset(skip).limit(limit)

    jobs = session.exec(query).all()
    return jobs


@router.get("/jobs/{job_id}", response_model=MarketplaceSyncJobResponse)
def get_sync_job(
    job_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific sync job"""
    query = select(MarketplaceSyncJob).where(MarketplaceSyncJob.id == job_id)

    query = company_filter.apply_filter(query, MarketplaceSyncJob.companyId)

    job = session.exec(query).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.post("/jobs/{job_id}/cancel")
def cancel_sync_job(
    job_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Cancel a pending or in-progress sync job"""
    query = select(MarketplaceSyncJob).where(MarketplaceSyncJob.id == job_id)

    query = company_filter.apply_filter(query, MarketplaceSyncJob.companyId)

    job = session.exec(query).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in [SyncJobStatus.PENDING, SyncJobStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status}"
        )

    job.status = SyncJobStatus.CANCELLED
    job.completedAt = datetime.utcnow()
    session.add(job)
    session.commit()

    return {"success": True, "message": "Job cancelled"}


# ============================================================================
# Synced Orders
# ============================================================================

@router.get("/orders", response_model=List[MarketplaceOrderSyncResponse])
def list_synced_orders(
    connection_id: Optional[UUID] = None,
    marketplace_order_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List synced marketplace orders"""
    query = select(MarketplaceOrderSync)

    query = company_filter.apply_filter(query, MarketplaceOrderSync.companyId)

    if connection_id:
        query = query.where(MarketplaceOrderSync.connectionId == connection_id)

    if marketplace_order_id:
        query = query.where(
            MarketplaceOrderSync.marketplaceOrderId.ilike(f"%{marketplace_order_id}%")
        )

    if status:
        query = query.where(MarketplaceOrderSync.syncStatus == status)

    if from_date:
        query = query.where(MarketplaceOrderSync.syncedAt >= from_date)

    query = query.order_by(MarketplaceOrderSync.syncedAt.desc())
    query = query.offset(skip).limit(limit)

    orders = session.exec(query).all()
    return orders


@router.get("/orders/{sync_id}")
def get_synced_order(
    sync_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get details of a synced order"""
    query = select(MarketplaceOrderSync).where(MarketplaceOrderSync.id == sync_id)

    query = company_filter.apply_filter(query, MarketplaceOrderSync.companyId)

    sync = session.exec(query).first()

    if not sync:
        raise HTTPException(status_code=404, detail="Synced order not found")

    return {
        "sync": MarketplaceOrderSyncResponse.model_validate(sync),
        "orderData": sync.orderData
    }


# ============================================================================
# Status and Statistics
# ============================================================================

@router.get("/status")
async def get_sync_status(
    connection_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get overall sync status"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    coordinator = SyncCoordinator(session)
    status = await coordinator.get_sync_status(
        company_id=company_filter.company_id,
        connection_id=connection_id
    )

    return status


@router.get("/stats")
def get_sync_stats(
    connection_id: Optional[UUID] = None,
    days: int = Query(7, ge=1, le=90),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get sync statistics"""
    from datetime import timedelta
    from sqlmodel import func

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    since = datetime.utcnow() - timedelta(days=days)

    # Base query
    base_query = select(MarketplaceSyncJob).where(
        MarketplaceSyncJob.companyId == company_filter.company_id,
        MarketplaceSyncJob.jobType == SyncJobType.ORDER_PULL,
        MarketplaceSyncJob.createdAt >= since
    )

    if connection_id:
        base_query = base_query.where(MarketplaceSyncJob.connectionId == connection_id)

    jobs = session.exec(base_query).all()

    total_jobs = len(jobs)
    completed = len([j for j in jobs if j.status == SyncJobStatus.COMPLETED])
    failed = len([j for j in jobs if j.status == SyncJobStatus.FAILED])
    total_orders = sum(j.recordsSuccess or 0 for j in jobs)
    total_failed_orders = sum(j.recordsFailed or 0 for j in jobs)

    # Orders synced count
    orders_synced = session.exec(
        select(func.count(MarketplaceOrderSync.id))
        .where(MarketplaceOrderSync.companyId == company_filter.company_id)
        .where(MarketplaceOrderSync.syncedAt >= since)
    ).one()

    return {
        "period_days": days,
        "total_sync_jobs": total_jobs,
        "completed_jobs": completed,
        "failed_jobs": failed,
        "success_rate": (completed / total_jobs * 100) if total_jobs > 0 else 0,
        "total_orders_synced": orders_synced,
        "orders_from_jobs": total_orders,
        "failed_orders": total_failed_orders
    }
