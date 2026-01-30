"""
Job Scheduler Module
Manages scheduled background tasks using APScheduler
"""
import logging
from typing import Optional
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: Optional[AsyncIOScheduler] = None


def create_scheduler() -> AsyncIOScheduler:
    """Create and configure the scheduler"""
    jobstores = {
        'default': MemoryJobStore()
    }

    executors = {
        'default': AsyncIOExecutor()
    }

    job_defaults = {
        'coalesce': True,  # Combine multiple missed executions into one
        'max_instances': 1,  # Only one instance of each job at a time
        'misfire_grace_time': 60 * 5  # 5 minutes grace period
    }

    return AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone='UTC'
    )


async def init_scheduler() -> AsyncIOScheduler:
    """Initialize and start the scheduler with all jobs"""
    global scheduler

    if scheduler is not None and scheduler.running:
        logger.warning("Scheduler already running")
        return scheduler

    scheduler = create_scheduler()

    # Import job functions
    from .order_sync_job import run_order_sync_all
    from .inventory_sync_job import run_inventory_push_all
    from .settlement_sync_job import run_settlement_fetch_all
    from .token_refresh_job import run_token_refresh

    # Schedule jobs

    # Order sync: Every 15 minutes
    scheduler.add_job(
        run_order_sync_all,
        trigger=IntervalTrigger(minutes=15),
        id='order_sync_job',
        name='Order Sync (All Connections)',
        replace_existing=True
    )
    logger.info("Scheduled order sync job: every 15 minutes")

    # Inventory push: Every 30 minutes
    scheduler.add_job(
        run_inventory_push_all,
        trigger=IntervalTrigger(minutes=30),
        id='inventory_push_job',
        name='Inventory Push (All Connections)',
        replace_existing=True
    )
    logger.info("Scheduled inventory push job: every 30 minutes")

    # Settlement fetch: Daily at 6 AM UTC
    scheduler.add_job(
        run_settlement_fetch_all,
        trigger=CronTrigger(hour=6, minute=0),
        id='settlement_fetch_job',
        name='Settlement Fetch (Daily)',
        replace_existing=True
    )
    logger.info("Scheduled settlement fetch job: daily at 6 AM UTC")

    # Token refresh: Every 45 minutes
    scheduler.add_job(
        run_token_refresh,
        trigger=IntervalTrigger(minutes=45),
        id='token_refresh_job',
        name='OAuth Token Refresh',
        replace_existing=True
    )
    logger.info("Scheduled token refresh job: every 45 minutes")

    scheduler.start()
    logger.info("Scheduler started successfully")

    return scheduler


async def shutdown_scheduler():
    """Gracefully shutdown the scheduler"""
    global scheduler

    if scheduler is not None:
        scheduler.shutdown(wait=True)
        scheduler = None
        logger.info("Scheduler shutdown complete")


def get_scheduler() -> Optional[AsyncIOScheduler]:
    """Get the current scheduler instance"""
    return scheduler


def get_job_status():
    """Get status of all scheduled jobs"""
    if scheduler is None:
        return {"status": "not_running", "jobs": []}

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })

    return {
        "status": "running" if scheduler.running else "paused",
        "jobs": jobs
    }


def trigger_job_now(job_id: str) -> bool:
    """Manually trigger a job to run immediately"""
    if scheduler is None:
        return False

    job = scheduler.get_job(job_id)
    if job is None:
        return False

    scheduler.modify_job(job_id, next_run_time=datetime.utcnow())
    return True


def pause_job(job_id: str) -> bool:
    """Pause a scheduled job"""
    if scheduler is None:
        return False

    try:
        scheduler.pause_job(job_id)
        return True
    except Exception:
        return False


def resume_job(job_id: str) -> bool:
    """Resume a paused job"""
    if scheduler is None:
        return False

    try:
        scheduler.resume_job(job_id)
        return True
    except Exception:
        return False
