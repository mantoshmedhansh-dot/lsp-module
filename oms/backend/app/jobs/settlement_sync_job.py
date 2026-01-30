"""
Settlement Sync Job
Periodic job to fetch settlement data from marketplaces
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


class SettlementSyncJob:
    """Settlement sync job handler"""

    def __init__(self, session: Session):
        self.session = session
        self.coordinator = SyncCoordinator(session)

    async def fetch_connection(
        self,
        connection: MarketplaceConnection,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> dict:
        """Fetch settlements from a single connection"""
        try:
            # Default: fetch previous day's settlements
            if to_date is None:
                to_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            if from_date is None:
                from_date = to_date - timedelta(days=1)

            logger.info(f"Starting settlement fetch for {connection.connectionName} ({connection.id})")
            logger.info(f"Date range: {from_date} to {to_date}")

            # Create sync job record
            from uuid import uuid4
            job = MarketplaceSyncJob(
                id=uuid4(),
                companyId=connection.companyId,
                connectionId=connection.id,
                jobType=SyncJobType.SETTLEMENT_FETCH,
                status=SyncJobStatus.IN_PROGRESS,
                triggeredBy="SCHEDULED",
                syncFromDate=from_date,
                syncToDate=to_date,
                startedAt=datetime.utcnow()
            )
            self.session.add(job)
            self.session.commit()

            # Get adapter and fetch settlements
            try:
                adapter = AdapterFactory.create_from_connection(connection, self.session)
                settlements = await adapter.fetch_settlements(from_date, to_date)

                # Process settlements
                # In a real implementation, this would create MarketplaceSettlement records
                records_processed = len(settlements)

                # Update job status
                job.status = SyncJobStatus.COMPLETED
                job.recordsTotal = records_processed
                job.recordsSuccess = records_processed
                job.completedAt = datetime.utcnow()

            except Exception as e:
                job.status = SyncJobStatus.FAILED
                job.errorMessage = str(e)
                job.completedAt = datetime.utcnow()
                raise

            finally:
                self.session.add(job)
                self.session.commit()

            logger.info(f"Settlement fetch completed for {connection.connectionName}: {records_processed} records")
            return {
                "success": True,
                "records_processed": records_processed,
                "connection_id": str(connection.id)
            }

        except Exception as e:
            logger.error(f"Settlement fetch failed for {connection.connectionName}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "connection_id": str(connection.id)
            }

    async def fetch_all(self, company_id: Optional[str] = None) -> List[dict]:
        """Fetch settlements from all active connections"""
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
        logger.info(f"Found {len(connections)} active connections for settlement fetch")

        for connection in connections:
            result = await self.fetch_connection(connection)
            results.append({
                "connection_id": str(connection.id),
                "connection_name": connection.connectionName,
                "marketplace": connection.marketplace.value,
                **result
            })

        return results


async def run_settlement_fetch_all():
    """Entry point for scheduled settlement fetch job"""
    logger.info("Running scheduled settlement fetch job")

    session_gen = get_session()
    session = next(session_gen)

    try:
        job = SettlementSyncJob(session)
        results = await job.fetch_all()

        success_count = len([r for r in results if r.get("success", False)])
        fail_count = len(results) - success_count

        logger.info(f"Settlement fetch job completed: {success_count} success, {fail_count} failed")

    except Exception as e:
        logger.error(f"Settlement fetch job failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


async def run_settlement_fetch_connection(
    connection_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
):
    """Run settlement fetch for a specific connection"""
    from uuid import UUID

    logger.info(f"Running settlement fetch for connection {connection_id}")

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

        job = SettlementSyncJob(session)
        result = await job.fetch_connection(connection, from_date, to_date)

        logger.info(f"Settlement fetch completed for {connection.connectionName}: {result}")

    except Exception as e:
        logger.error(f"Settlement fetch failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass
