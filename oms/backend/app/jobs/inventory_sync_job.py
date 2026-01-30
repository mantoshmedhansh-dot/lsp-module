"""
Inventory Sync Job
Periodic job to push inventory levels to all connected marketplaces
"""
import logging
from datetime import datetime
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
from app.services.marketplaces import SyncCoordinator

logger = logging.getLogger(__name__)


class InventorySyncJob:
    """Inventory sync job handler"""

    def __init__(self, session: Session):
        self.session = session
        self.coordinator = SyncCoordinator(session)

    async def push_connection(
        self,
        connection: MarketplaceConnection,
        full_sync: bool = False
    ) -> dict:
        """Push inventory to a single connection"""
        try:
            logger.info(f"Starting inventory push for {connection.connectionName} ({connection.id})")

            # Create sync job record
            job = await self.coordinator.create_sync_job(
                company_id=connection.companyId,
                connection_id=connection.id,
                job_type=SyncJobType.INVENTORY_PUSH,
                triggered_by="SCHEDULED"
            )

            # Run the push
            result = await self.coordinator.push_inventory(
                connection_id=connection.id,
                full_sync=full_sync,
                triggered_by="SCHEDULED"
            )

            logger.info(f"Inventory push completed for {connection.connectionName}: {result}")
            return result

        except Exception as e:
            logger.error(f"Inventory push failed for {connection.connectionName}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "connection_id": str(connection.id)
            }

    async def push_all(self, company_id: Optional[str] = None) -> List[dict]:
        """Push inventory to all active connections"""
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
        logger.info(f"Found {len(connections)} active connections for inventory push")

        for connection in connections:
            # Check if sync is enabled for this connection
            sync_settings = connection.syncSettings or {}
            if not sync_settings.get("inventory_sync_enabled", True):
                logger.info(f"Skipping {connection.connectionName} - inventory sync disabled")
                continue

            result = await self.push_connection(connection)
            results.append({
                "connection_id": str(connection.id),
                "connection_name": connection.connectionName,
                "marketplace": connection.marketplace.value,
                **result
            })

        return results


async def run_inventory_push_all():
    """Entry point for scheduled inventory push job"""
    logger.info("Running scheduled inventory push job")

    session_gen = get_session()
    session = next(session_gen)

    try:
        job = InventorySyncJob(session)
        results = await job.push_all()

        success_count = len([r for r in results if r.get("success", False)])
        fail_count = len(results) - success_count

        logger.info(f"Inventory push job completed: {success_count} success, {fail_count} failed")

    except Exception as e:
        logger.error(f"Inventory push job failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


async def run_inventory_push_connection(connection_id: str, full_sync: bool = False):
    """Run inventory push for a specific connection"""
    from uuid import UUID

    logger.info(f"Running inventory push for connection {connection_id}")

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

        job = InventorySyncJob(session)
        result = await job.push_connection(connection, full_sync=full_sync)

        logger.info(f"Inventory push completed for {connection.connectionName}: {result}")

    except Exception as e:
        logger.error(f"Inventory push failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass
