"""
Order Sync Job
Periodic job to pull orders from all connected marketplaces
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from sqlmodel import Session, select

from app.core.database import get_session
from app.models import (
    MarketplaceConnection,
    MarketplaceSyncJob,
    SyncJobType,
    SyncJobStatus,
    ConnectionStatus,
)
from app.services.marketplaces import SyncCoordinator, AdapterFactory

logger = logging.getLogger(__name__)


class OrderSyncJob:
    """Order sync job handler"""

    def __init__(self, session: Session):
        self.session = session
        self.coordinator = SyncCoordinator(session)

    async def sync_connection(
        self,
        connection: MarketplaceConnection,
        from_date: Optional[datetime] = None
    ) -> dict:
        """Sync orders from a single connection"""
        try:
            if from_date is None:
                # Default: sync last 24 hours
                from_date = datetime.utcnow() - timedelta(hours=24)

            logger.info(f"Starting order sync for {connection.connectionName} ({connection.id})")

            # Create sync job record
            job = await self.coordinator.create_sync_job(
                company_id=connection.companyId,
                connection_id=connection.id,
                job_type=SyncJobType.ORDER_PULL,
                triggered_by="SCHEDULED"
            )

            # Run the sync
            result = await self.coordinator.sync_orders(
                connection_id=connection.id,
                from_date=from_date,
                triggered_by="SCHEDULED"
            )

            logger.info(f"Order sync completed for {connection.connectionName}: {result}")
            return result

        except Exception as e:
            logger.error(f"Order sync failed for {connection.connectionName}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "connection_id": str(connection.id)
            }

    async def sync_all(self, company_id: Optional[str] = None) -> List[dict]:
        """Sync orders from all active connections"""
        results = []

        # Get all active connections
        query = select(MarketplaceConnection).where(
            MarketplaceConnection.status == ConnectionStatus.CONNECTED,
            MarketplaceConnection.isActive == True
        )

        if company_id:
            from uuid import UUID
            query = query.where(MarketplaceConnection.companyId == UUID(company_id))

        connections = self.session.exec(query).all()
        logger.info(f"Found {len(connections)} active connections for order sync")

        for connection in connections:
            result = await self.sync_connection(connection)
            results.append({
                "connection_id": str(connection.id),
                "connection_name": connection.connectionName,
                "marketplace": connection.marketplace.value,
                **result
            })

        return results


async def run_order_sync_all():
    """Entry point for scheduled order sync job"""
    logger.info("Running scheduled order sync job")

    # Create a new session for this job
    session_gen = get_session()
    session = next(session_gen)

    try:
        job = OrderSyncJob(session)
        results = await job.sync_all()

        success_count = len([r for r in results if r.get("success", False)])
        fail_count = len(results) - success_count

        logger.info(f"Order sync job completed: {success_count} success, {fail_count} failed")

    except Exception as e:
        logger.error(f"Order sync job failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


async def run_order_sync_connection(connection_id: str):
    """Run order sync for a specific connection"""
    from uuid import UUID

    logger.info(f"Running order sync for connection {connection_id}")

    session_gen = get_session()
    session = next(session_gen)

    try:
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.id == UUID(connection_id))
        ).first()

        if not connection:
            logger.error(f"Connection not found: {connection_id}")
            return

        job = OrderSyncJob(session)
        result = await job.sync_connection(connection)

        logger.info(f"Order sync completed for {connection.connectionName}: {result}")

    except Exception as e:
        logger.error(f"Order sync failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass
