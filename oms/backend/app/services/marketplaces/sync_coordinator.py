"""
Sync Coordinator
Orchestrates synchronization operations across marketplaces
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
import logging
import asyncio

from sqlmodel import Session, select, func

from app.models import (
    MarketplaceConnection,
    MarketplaceSyncJob,
    MarketplaceSyncJobCreate,
    MarketplaceSyncJobUpdate,
    MarketplaceOrderSync,
    MarketplaceSkuMapping,
    Order,
    OrderItem,
    SKU,
    ConnectionStatus,
    SyncJobType,
    SyncJobStatus,
    ImportStatus,
)
from app.core.database import get_session_context
from .adapter_factory import AdapterFactory, get_adapter
from .token_manager import TokenManager
from .order_pipeline import OrderPipeline
from .base_adapter import MarketplaceOrder, InventoryUpdate, InventoryUpdateResult

logger = logging.getLogger(__name__)


class SyncCoordinator:
    """
    Coordinates synchronization operations across marketplaces.

    Handles:
    - Order pull from marketplaces
    - Inventory push to marketplaces
    - Settlement fetch
    - Return sync
    - Job tracking and error handling
    """

    def __init__(self, session: Optional[Session] = None):
        """
        Initialize SyncCoordinator.

        Args:
            session: Optional database session
        """
        self._session = session
        self.token_manager = TokenManager(session)

    def _get_session(self):
        """Get database session."""
        if self._session:
            return self._session
        with get_session_context() as session:
            return session

    # =========================================================================
    # Job Management
    # =========================================================================

    async def create_sync_job(
        self,
        company_id: UUID,
        connection_id: UUID,
        job_type: SyncJobType,
        triggered_by: str = "MANUAL",
        triggered_by_id: Optional[UUID] = None,
        sync_from_date: Optional[datetime] = None,
        sync_to_date: Optional[datetime] = None,
        priority: int = 0,
        scheduled_at: Optional[datetime] = None
    ) -> MarketplaceSyncJob:
        """
        Create a new sync job.

        Args:
            company_id: Company ID
            connection_id: Marketplace connection ID
            job_type: Type of sync operation
            triggered_by: What triggered the sync (MANUAL, SCHEDULED, WEBHOOK, etc.)
            triggered_by_id: User ID if manually triggered
            sync_from_date: Start date for sync
            sync_to_date: End date for sync
            priority: Job priority (higher = more urgent)
            scheduled_at: When to run the job (None = immediately)

        Returns:
            Created sync job
        """
        session = self._get_session()

        job = MarketplaceSyncJob(
            companyId=company_id,
            connectionId=connection_id,
            jobType=job_type,
            status=SyncJobStatus.PENDING,
            priority=priority,
            scheduledAt=scheduled_at,
            syncFromDate=sync_from_date,
            syncToDate=sync_to_date,
            triggeredBy=triggered_by,
            triggeredById=triggered_by_id
        )

        session.add(job)
        session.commit()
        session.refresh(job)

        logger.info(
            f"Created sync job {job.id} for connection {connection_id} "
            f"(type: {job_type.value})"
        )

        return job

    async def update_job_status(
        self,
        job_id: UUID,
        status: SyncJobStatus,
        records_processed: Optional[int] = None,
        records_success: Optional[int] = None,
        records_failed: Optional[int] = None,
        error_log: Optional[dict] = None,
        result_summary: Optional[dict] = None
    ):
        """Update sync job status and metrics."""
        session = self._get_session()

        job = session.exec(
            select(MarketplaceSyncJob).where(MarketplaceSyncJob.id == job_id)
        ).first()

        if not job:
            logger.warning(f"Job not found: {job_id}")
            return

        job.status = status

        if status == SyncJobStatus.IN_PROGRESS and not job.startedAt:
            job.startedAt = datetime.utcnow()

        if status in [SyncJobStatus.COMPLETED, SyncJobStatus.FAILED, SyncJobStatus.PARTIAL]:
            job.completedAt = datetime.utcnow()

        if records_processed is not None:
            job.recordsProcessed = records_processed
        if records_success is not None:
            job.recordsSuccess = records_success
        if records_failed is not None:
            job.recordsFailed = records_failed
        if error_log is not None:
            job.errorLog = error_log
        if result_summary is not None:
            job.resultSummary = result_summary

        session.add(job)
        session.commit()

    # =========================================================================
    # Order Sync
    # =========================================================================

    async def sync_orders(
        self,
        connection_id: UUID,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        triggered_by: str = "MANUAL",
        triggered_by_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Sync orders from a marketplace.

        Args:
            connection_id: Marketplace connection ID
            from_date: Start date for order fetch
            to_date: End date for order fetch
            triggered_by: What triggered the sync
            triggered_by_id: User ID if manually triggered

        Returns:
            Sync result summary
        """
        session = self._get_session()

        # Get connection
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.id == connection_id)
        ).first()

        if not connection:
            return {"success": False, "error": "Connection not found"}

        if connection.status != ConnectionStatus.CONNECTED:
            return {"success": False, "error": f"Connection status: {connection.status}"}

        # Default date range: last 24 hours
        if not from_date:
            from_date = connection.lastSyncAt or (datetime.utcnow() - timedelta(hours=24))
        if not to_date:
            to_date = datetime.utcnow()

        # Create sync job
        job = await self.create_sync_job(
            company_id=connection.companyId,
            connection_id=connection_id,
            job_type=SyncJobType.ORDER_PULL,
            triggered_by=triggered_by,
            triggered_by_id=triggered_by_id,
            sync_from_date=from_date,
            sync_to_date=to_date
        )

        try:
            # Get adapter
            adapter = AdapterFactory.create_from_connection(connection)

            # Ensure authenticated
            await self.token_manager.get_valid_token(connection_id, adapter)

            await self.update_job_status(job.id, SyncJobStatus.IN_PROGRESS)

            # Fetch orders with pagination
            orders_created = 0
            orders_updated = 0
            orders_skipped = 0
            errors = []
            cursor = None
            total_fetched = 0

            while True:
                try:
                    orders, next_cursor = await adapter.fetch_orders(
                        from_date=from_date,
                        to_date=to_date,
                        cursor=cursor,
                        limit=50
                    )
                except Exception as e:
                    logger.error(f"Failed to fetch orders: {e}")
                    errors.append({"type": "fetch_error", "message": str(e)})
                    break

                total_fetched += len(orders)

                for order in orders:
                    try:
                        result = await self._process_marketplace_order(
                            session, connection, order
                        )
                        if result == "created":
                            orders_created += 1
                        elif result == "updated":
                            orders_updated += 1
                        else:
                            orders_skipped += 1
                    except Exception as e:
                        logger.error(f"Failed to process order {order.marketplace_order_id}: {e}")
                        errors.append({
                            "order_id": order.marketplace_order_id,
                            "error": str(e)
                        })

                # Update progress
                await self.update_job_status(
                    job.id,
                    SyncJobStatus.IN_PROGRESS,
                    records_processed=total_fetched
                )

                if not next_cursor:
                    break
                cursor = next_cursor

            # Update connection last sync time
            connection.lastSyncAt = datetime.utcnow()
            session.add(connection)
            session.commit()

            # Finalize job
            final_status = SyncJobStatus.COMPLETED
            if errors and (orders_created + orders_updated) > 0:
                final_status = SyncJobStatus.PARTIAL
            elif errors and (orders_created + orders_updated) == 0:
                final_status = SyncJobStatus.FAILED

            await self.update_job_status(
                job.id,
                final_status,
                records_processed=total_fetched,
                records_success=orders_created + orders_updated,
                records_failed=len(errors),
                error_log={"errors": errors} if errors else None,
                result_summary={
                    "orders_created": orders_created,
                    "orders_updated": orders_updated,
                    "orders_skipped": orders_skipped
                }
            )

            return {
                "success": final_status != SyncJobStatus.FAILED,
                "job_id": str(job.id),
                "total_fetched": total_fetched,
                "orders_created": orders_created,
                "orders_updated": orders_updated,
                "orders_skipped": orders_skipped,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"Order sync failed: {e}", exc_info=True)
            await self.update_job_status(
                job.id,
                SyncJobStatus.FAILED,
                error_log={"error": str(e)}
            )
            return {"success": False, "error": str(e), "job_id": str(job.id)}

    async def _process_marketplace_order(
        self,
        session: Session,
        connection: MarketplaceConnection,
        order: MarketplaceOrder
    ) -> str:
        """
        Process a single marketplace order via OrderPipeline.

        Creates actual OMS Order + OrderItem + Delivery records,
        maps marketplace SKUs to internal SKUs, and reserves inventory.

        Returns: "created", "updated", or "skipped"
        """
        pipeline = OrderPipeline(session)

        result = await pipeline.process_order(
            company_id=connection.companyId,
            connection=connection,
            marketplace_order=order,
        )

        status = result.get("status", "failed")

        if status == "created":
            logger.info(
                f"Order pipeline created OMS order {result.get('order_no')} "
                f"for marketplace order {order.marketplace_order_id}"
            )
            return "created"
        elif status == "skipped":
            return "skipped"
        elif status == "failed":
            errors = result.get("errors", [])
            if errors:
                logger.warning(
                    f"Order pipeline failed for {order.marketplace_order_id}: "
                    f"{errors}"
                )
            return "skipped"
        else:
            return "skipped"

    # =========================================================================
    # Inventory Sync
    # =========================================================================

    async def push_inventory(
        self,
        connection_id: UUID,
        sku_ids: Optional[List[UUID]] = None,
        full_sync: bool = False,
        triggered_by: str = "MANUAL",
        triggered_by_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Push inventory to marketplace.

        Args:
            connection_id: Marketplace connection ID
            sku_ids: Specific SKUs to sync (None = all mapped SKUs)
            full_sync: Whether to sync all SKUs
            triggered_by: What triggered the sync
            triggered_by_id: User ID if manually triggered

        Returns:
            Sync result summary
        """
        session = self._get_session()

        # Get connection
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.id == connection_id)
        ).first()

        if not connection:
            return {"success": False, "error": "Connection not found"}

        if connection.status != ConnectionStatus.CONNECTED:
            return {"success": False, "error": f"Connection status: {connection.status}"}

        # Create sync job
        job = await self.create_sync_job(
            company_id=connection.companyId,
            connection_id=connection_id,
            job_type=SyncJobType.INVENTORY_PUSH,
            triggered_by=triggered_by,
            triggered_by_id=triggered_by_id
        )

        try:
            # Get adapter
            adapter = AdapterFactory.create_from_connection(connection)

            # Ensure authenticated
            await self.token_manager.get_valid_token(connection_id, adapter)

            await self.update_job_status(job.id, SyncJobStatus.IN_PROGRESS)

            # Get SKU mappings
            query = select(MarketplaceSkuMapping).where(
                MarketplaceSkuMapping.companyId == connection.companyId,
                MarketplaceSkuMapping.channel == connection.marketplace.value,
                MarketplaceSkuMapping.syncEnabled == True
            )

            if sku_ids:
                query = query.where(MarketplaceSkuMapping.skuId.in_(sku_ids))

            mappings = session.exec(query).all()

            if not mappings:
                await self.update_job_status(
                    job.id,
                    SyncJobStatus.COMPLETED,
                    records_processed=0,
                    result_summary={"message": "No SKU mappings found"}
                )
                return {
                    "success": True,
                    "job_id": str(job.id),
                    "message": "No SKU mappings found"
                }

            # Build inventory updates
            updates = []
            for mapping in mappings:
                # Get available inventory for this SKU
                qty = await self._get_available_qty(session, mapping)
                updates.append(InventoryUpdate(
                    marketplace_sku=mapping.marketplaceSku,
                    quantity=qty,
                    sku_id=mapping.skuId
                ))

            # Push to marketplace in batches
            batch_size = 50
            success_count = 0
            failed_count = 0
            errors = []

            for i in range(0, len(updates), batch_size):
                batch = updates[i:i + batch_size]

                try:
                    results: List[InventoryUpdateResult] = await adapter.push_inventory(batch)

                    for result in results:
                        if result.success:
                            success_count += 1
                        else:
                            failed_count += 1
                            errors.append({
                                "sku": result.marketplace_sku,
                                "error": result.error_message
                            })

                except Exception as e:
                    logger.error(f"Batch inventory push failed: {e}")
                    failed_count += len(batch)
                    errors.append({"batch": i, "error": str(e)})

                # Update progress
                await self.update_job_status(
                    job.id,
                    SyncJobStatus.IN_PROGRESS,
                    records_processed=i + len(batch),
                    records_success=success_count,
                    records_failed=failed_count
                )

            # Finalize job
            final_status = SyncJobStatus.COMPLETED
            if errors and success_count > 0:
                final_status = SyncJobStatus.PARTIAL
            elif errors and success_count == 0:
                final_status = SyncJobStatus.FAILED

            await self.update_job_status(
                job.id,
                final_status,
                records_processed=len(updates),
                records_success=success_count,
                records_failed=failed_count,
                error_log={"errors": errors} if errors else None,
                result_summary={
                    "total_skus": len(updates),
                    "success": success_count,
                    "failed": failed_count
                }
            )

            return {
                "success": final_status != SyncJobStatus.FAILED,
                "job_id": str(job.id),
                "total_skus": len(updates),
                "success_count": success_count,
                "failed_count": failed_count,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"Inventory push failed: {e}", exc_info=True)
            await self.update_job_status(
                job.id,
                SyncJobStatus.FAILED,
                error_log={"error": str(e)}
            )
            return {"success": False, "error": str(e), "job_id": str(job.id)}

    async def _get_available_qty(
        self,
        session: Session,
        mapping: MarketplaceSkuMapping
    ) -> int:
        """
        Calculate available quantity for a SKU mapping.

        Considers:
        - Total inventory
        - Allocated inventory
        - Channel-specific allocation rules
        - Buffer/safety stock
        """
        from app.models import Inventory, ChannelInventoryRule

        # Get total inventory
        total_qty = session.exec(
            select(func.sum(Inventory.availableQty))
            .where(Inventory.skuId == mapping.skuId)
            .where(Inventory.companyId == mapping.companyId)
        ).first() or 0

        # Get channel allocation rule
        rule = session.exec(
            select(ChannelInventoryRule)
            .where(ChannelInventoryRule.skuId == mapping.skuId)
            .where(ChannelInventoryRule.companyId == mapping.companyId)
            .where(ChannelInventoryRule.channel == mapping.channel)
        ).first()

        if rule:
            if rule.allocationType == "PERCENTAGE":
                allocated_qty = int(total_qty * (rule.allocationValue / 100))
            elif rule.allocationType == "FIXED":
                allocated_qty = min(int(rule.allocationValue), total_qty)
            else:
                allocated_qty = total_qty

            # Apply buffer
            buffer = getattr(rule, 'buffer_qty', 0) or 0
            allocated_qty = max(0, allocated_qty - buffer)

            return allocated_qty

        return max(0, total_qty)

    # =========================================================================
    # Status and Monitoring
    # =========================================================================

    async def get_sync_status(
        self,
        company_id: UUID,
        connection_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get overall sync status for a company or connection."""
        session = self._get_session()

        query = select(MarketplaceSyncJob).where(
            MarketplaceSyncJob.companyId == company_id
        )

        if connection_id:
            query = query.where(MarketplaceSyncJob.connectionId == connection_id)

        jobs = session.exec(query.order_by(MarketplaceSyncJob.createdAt.desc()).limit(100)).all()

        # Aggregate by type
        by_type = {}
        for job_type in SyncJobType:
            type_jobs = [j for j in jobs if j.jobType == job_type]
            last_job = type_jobs[0] if type_jobs else None

            by_type[job_type.value] = {
                "last_run": last_job.completedAt.isoformat() if last_job and last_job.completedAt else None,
                "last_status": last_job.status.value if last_job else None,
                "pending_jobs": len([j for j in type_jobs if j.status == SyncJobStatus.PENDING]),
                "failed_jobs": len([j for j in type_jobs if j.status == SyncJobStatus.FAILED])
            }

        return {
            "total_jobs": len(jobs),
            "pending": len([j for j in jobs if j.status == SyncJobStatus.PENDING]),
            "in_progress": len([j for j in jobs if j.status == SyncJobStatus.IN_PROGRESS]),
            "completed": len([j for j in jobs if j.status == SyncJobStatus.COMPLETED]),
            "failed": len([j for j in jobs if j.status == SyncJobStatus.FAILED]),
            "by_type": by_type
        }

    async def get_pending_jobs(
        self,
        limit: int = 50
    ) -> List[MarketplaceSyncJob]:
        """Get pending jobs ready to execute."""
        session = self._get_session()

        return session.exec(
            select(MarketplaceSyncJob)
            .where(MarketplaceSyncJob.status == SyncJobStatus.PENDING)
            .where(
                (MarketplaceSyncJob.scheduledAt == None) |
                (MarketplaceSyncJob.scheduledAt <= datetime.utcnow())
            )
            .order_by(MarketplaceSyncJob.priority.desc())
            .order_by(MarketplaceSyncJob.createdAt)
            .limit(limit)
        ).all()
