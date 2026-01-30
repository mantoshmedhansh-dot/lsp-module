"""
Scheduled Jobs API
Endpoints for managing and monitoring scheduled background jobs
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User
from app.services.scheduler import (
    get_all_jobs_status,
    trigger_job_immediately,
    pause_scheduled_job,
    resume_scheduled_job,
    get_last_scan_result
)

router = APIRouter(prefix="/scheduled-jobs", tags=["Scheduled Jobs"])


class JobActionResponse(BaseModel):
    """Response for job actions"""
    success: bool
    message: str
    jobId: Optional[str] = None


class JobStatusResponse(BaseModel):
    """Response for job status"""
    status: str
    jobs: list


@router.get("", response_model=JobStatusResponse)
async def list_scheduled_jobs(
    current_user: User = Depends(get_current_user)
):
    """
    List all scheduled jobs and their status.

    Returns information about:
    - Detection Engine (exception scanner)
    - Marketplace Order Sync
    - Marketplace Inventory Push
    - Marketplace Settlement Fetch
    - OAuth Token Refresh
    """
    return get_all_jobs_status()


@router.get("/detection-engine/last-scan")
async def get_detection_engine_last_scan(
    current_user: User = Depends(get_current_user)
):
    """Get the result of the last detection engine scan."""
    return get_last_scan_result()


@router.post("/{job_id}/trigger", response_model=JobActionResponse)
async def trigger_job(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger a job to run immediately.

    Available job IDs:
    - detection_engine
    - marketplace_order_sync
    - marketplace_inventory_push
    - marketplace_settlement_fetch
    - marketplace_token_refresh
    """
    success = trigger_job_immediately(job_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found or scheduler not running"
        )

    return JobActionResponse(
        success=True,
        message=f"Job '{job_id}' triggered to run immediately",
        jobId=job_id
    )


@router.post("/{job_id}/pause", response_model=JobActionResponse)
async def pause_job(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Pause a scheduled job.

    The job will not run until resumed.
    """
    success = pause_scheduled_job(job_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found or scheduler not running"
        )

    return JobActionResponse(
        success=True,
        message=f"Job '{job_id}' paused",
        jobId=job_id
    )


@router.post("/{job_id}/resume", response_model=JobActionResponse)
async def resume_job(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Resume a paused job.
    """
    success = resume_scheduled_job(job_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found or scheduler not running"
        )

    return JobActionResponse(
        success=True,
        message=f"Job '{job_id}' resumed",
        jobId=job_id
    )


@router.get("/marketplace-sync/status")
async def get_marketplace_sync_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get status of marketplace sync jobs specifically.

    Returns next run times and status for:
    - Order sync
    - Inventory push
    - Settlement fetch
    - Token refresh
    """
    all_jobs = get_all_jobs_status()

    marketplace_jobs = [
        job for job in all_jobs.get("jobs", [])
        if job["id"].startswith("marketplace_")
    ]

    return {
        "status": all_jobs.get("status"),
        "jobs": marketplace_jobs,
        "summary": {
            "order_sync": next(
                (j for j in marketplace_jobs if j["id"] == "marketplace_order_sync"),
                None
            ),
            "inventory_push": next(
                (j for j in marketplace_jobs if j["id"] == "marketplace_inventory_push"),
                None
            ),
            "settlement_fetch": next(
                (j for j in marketplace_jobs if j["id"] == "marketplace_settlement_fetch"),
                None
            ),
            "token_refresh": next(
                (j for j in marketplace_jobs if j["id"] == "marketplace_token_refresh"),
                None
            ),
        }
    }
