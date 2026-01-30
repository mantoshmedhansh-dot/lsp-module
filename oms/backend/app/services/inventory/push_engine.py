"""
Inventory Push Engine
Pushes inventory updates to connected marketplaces
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.models import (
    Inventory,
    SKU,
    MarketplaceConnection,
    MarketplaceSkuMapping,
    MarketplaceSyncJob,
    SyncJobType,
    SyncJobStatus,
    ConnectionStatus,
)
from app.services.marketplaces import AdapterFactory
from .allocation_engine import ChannelAllocationEngine

logger = logging.getLogger(__name__)


class InventoryPushEngine:
    """
    Orchestrates inventory push to marketplaces:
    1. Calculate channel allocations
    2. Get SKU mappings for each channel
    3. Build inventory update payloads
    4. Push to marketplace APIs
    5. Handle rate limits and retries
    6. Log sync results
    """

    def __init__(self, session: Session):
        self.session = session

    async def push_inventory(
        self,
        connection: MarketplaceConnection,
        sku_ids: Optional[List[UUID]] = None,
        full_sync: bool = False,
        triggered_by: str = "MANUAL"
    ) -> dict:
        """
        Push inventory to a single marketplace connection.

        Args:
            connection: The marketplace connection
            sku_ids: Optional list of specific SKU IDs to sync
            full_sync: If True, sync all mapped SKUs
            triggered_by: Who/what triggered the sync

        Returns:
            Sync result dictionary
        """
        # Create sync job record
        sync_job = MarketplaceSyncJob(
            id=uuid4(),
            companyId=connection.companyId,
            connectionId=connection.id,
            jobType=SyncJobType.INVENTORY_PUSH,
            status=SyncJobStatus.IN_PROGRESS,
            triggeredBy=triggered_by,
            startedAt=datetime.utcnow()
        )
        self.session.add(sync_job)
        self.session.commit()

        result = {
            "connection_id": str(connection.id),
            "connection_name": connection.connectionName,
            "channel": connection.marketplace.value,
            "sync_job_id": str(sync_job.id),
        }

        try:
            logger.info(f"Starting inventory push for {connection.connectionName}")

            # Initialize services
            allocation_engine = ChannelAllocationEngine(
                self.session, connection.companyId
            )

            # Get SKU mappings for this connection's channel
            mappings = self._get_sku_mappings(
                connection.companyId,
                connection.marketplace.value,
                sku_ids
            )

            if not mappings:
                logger.info(f"No SKU mappings found for {connection.connectionName}")
                sync_job.status = SyncJobStatus.COMPLETED
                sync_job.completedAt = datetime.utcnow()
                sync_job.recordsTotal = 0
                self.session.add(sync_job)
                self.session.commit()

                result["success"] = True
                result["skus_synced"] = 0
                return result

            logger.info(f"Found {len(mappings)} SKU mappings for {connection.connectionName}")

            # Build inventory updates
            updates = []
            for mapping in mappings:
                inventory = self._get_inventory(mapping.skuId, connection.companyId)

                if not inventory:
                    continue

                # Calculate channel allocation
                allocations = allocation_engine.calculate_channel_allocation(
                    mapping.skuId,
                    inventory.available,
                    [connection.marketplace.value]
                )

                channel_allocation = allocations.get(connection.marketplace.value, {})
                allocated_qty = channel_allocation.get("allocated", 0)

                updates.append({
                    "marketplace_sku": mapping.marketplaceSku,
                    "seller_sku": mapping.sellerSku,
                    "sku_id": str(mapping.skuId),
                    "quantity": allocated_qty,
                    "total_available": inventory.available,
                    "buffer_applied": channel_allocation.get("buffer", 0),
                })

            if not updates:
                sync_job.status = SyncJobStatus.COMPLETED
                sync_job.completedAt = datetime.utcnow()
                sync_job.recordsTotal = len(mappings)
                sync_job.recordsSuccess = 0
                self.session.add(sync_job)
                self.session.commit()

                result["success"] = True
                result["skus_synced"] = 0
                result["message"] = "No inventory to update"
                return result

            # Get adapter and push updates
            adapter = AdapterFactory.create_from_connection(connection, self.session)

            # Push in batches to handle rate limits
            batch_size = self._get_batch_size(connection.marketplace.value)
            total_success = 0
            total_failed = 0
            errors = []

            for i in range(0, len(updates), batch_size):
                batch = updates[i:i + batch_size]

                try:
                    batch_result = await adapter.push_inventory(batch)

                    if batch_result.get("success"):
                        total_success += len(batch)
                    else:
                        total_failed += len(batch)
                        errors.append({
                            "batch": i // batch_size + 1,
                            "error": batch_result.get("error", "Unknown error")
                        })

                except Exception as e:
                    total_failed += len(batch)
                    errors.append({
                        "batch": i // batch_size + 1,
                        "error": str(e)
                    })
                    logger.error(f"Batch {i // batch_size + 1} failed: {e}")

            # Update sync job
            sync_job.status = (
                SyncJobStatus.COMPLETED if total_failed == 0
                else SyncJobStatus.PARTIAL if total_success > 0
                else SyncJobStatus.FAILED
            )
            sync_job.completedAt = datetime.utcnow()
            sync_job.recordsTotal = len(updates)
            sync_job.recordsSuccess = total_success
            sync_job.recordsFailed = total_failed

            if errors:
                sync_job.errorLog = {"errors": errors}

            self.session.add(sync_job)

            # Update connection last sync time
            connection.lastInventorySyncAt = datetime.utcnow()
            self.session.add(connection)

            self.session.commit()

            result["success"] = True
            result["skus_synced"] = total_success
            result["skus_failed"] = total_failed
            result["total_updates"] = len(updates)
            if errors:
                result["errors"] = errors[:5]

            logger.info(
                f"Inventory push complete for {connection.connectionName}: "
                f"{total_success} synced, {total_failed} failed"
            )

        except Exception as e:
            logger.error(f"Inventory push failed for {connection.connectionName}: {e}")

            sync_job.status = SyncJobStatus.FAILED
            sync_job.completedAt = datetime.utcnow()
            sync_job.errorMessage = str(e)
            self.session.add(sync_job)
            self.session.commit()

            result["success"] = False
            result["error"] = str(e)

        return result

    async def push_to_all_channels(
        self,
        company_id: UUID,
        sku_ids: Optional[List[UUID]] = None,
        triggered_by: str = "SCHEDULED"
    ) -> List[dict]:
        """
        Push inventory to all active marketplace connections.

        Args:
            company_id: Company identifier
            sku_ids: Optional list of specific SKU IDs
            triggered_by: Who/what triggered the sync

        Returns:
            List of sync results for each connection
        """
        results = []

        # Get all active connections
        connections = self.session.exec(
            select(MarketplaceConnection).where(
                MarketplaceConnection.companyId == company_id,
                MarketplaceConnection.status == ConnectionStatus.CONNECTED,
                MarketplaceConnection.isActive == True
            )
        ).all()

        logger.info(f"Found {len(connections)} active connections for inventory push")

        for connection in connections:
            # Check if inventory sync is enabled
            sync_settings = connection.syncSettings or {}
            if not sync_settings.get("inventory_sync_enabled", True):
                logger.info(f"Skipping {connection.connectionName} - inventory sync disabled")
                continue

            result = await self.push_inventory(
                connection,
                sku_ids=sku_ids,
                triggered_by=triggered_by
            )
            results.append(result)

        return results

    async def push_sku_update(
        self,
        sku_id: UUID,
        company_id: UUID,
        triggered_by: str = "INVENTORY_CHANGE"
    ) -> List[dict]:
        """
        Push inventory update for a single SKU to all channels.

        This is called when inventory changes (GRN, order ship, adjustment).

        Args:
            sku_id: SKU identifier
            company_id: Company identifier
            triggered_by: Source of the change

        Returns:
            List of sync results
        """
        return await self.push_to_all_channels(
            company_id=company_id,
            sku_ids=[sku_id],
            triggered_by=triggered_by
        )

    def _get_sku_mappings(
        self,
        company_id: UUID,
        channel: str,
        sku_ids: Optional[List[UUID]] = None
    ) -> List[MarketplaceSkuMapping]:
        """Get SKU mappings for a channel."""
        query = select(MarketplaceSkuMapping).where(
            MarketplaceSkuMapping.companyId == company_id,
            MarketplaceSkuMapping.channel == channel,
            MarketplaceSkuMapping.listingStatus == "ACTIVE"
        )

        if sku_ids:
            query = query.where(MarketplaceSkuMapping.skuId.in_(sku_ids))

        return list(self.session.exec(query).all())

    def _get_inventory(
        self,
        sku_id: UUID,
        company_id: UUID
    ) -> Optional[Inventory]:
        """Get inventory for a SKU."""
        return self.session.exec(
            select(Inventory).where(
                Inventory.skuId == sku_id,
                Inventory.companyId == company_id
            )
        ).first()

    def _get_batch_size(self, channel: str) -> int:
        """Get recommended batch size for a channel based on rate limits."""
        batch_sizes = {
            "AMAZON": 50,      # Amazon has strict rate limits
            "FLIPKART": 100,   # Flipkart allows larger batches
            "SHOPIFY": 250,    # Shopify is more lenient
            "MYNTRA": 50,
            "MEESHO": 100,
        }
        return batch_sizes.get(channel, 50)

    def get_push_history(
        self,
        connection_id: Optional[UUID] = None,
        company_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[MarketplaceSyncJob]:
        """
        Get inventory push job history.

        Args:
            connection_id: Optional filter by connection
            company_id: Optional filter by company
            limit: Maximum records to return

        Returns:
            List of sync job records
        """
        query = select(MarketplaceSyncJob).where(
            MarketplaceSyncJob.jobType == SyncJobType.INVENTORY_PUSH
        ).order_by(MarketplaceSyncJob.createdAt.desc()).limit(limit)

        if connection_id:
            query = query.where(MarketplaceSyncJob.connectionId == connection_id)
        if company_id:
            query = query.where(MarketplaceSyncJob.companyId == company_id)

        return list(self.session.exec(query).all())

    def get_pending_updates(
        self,
        company_id: UUID,
        since: Optional[datetime] = None
    ) -> List[dict]:
        """
        Get SKUs with inventory changes pending push.

        Args:
            company_id: Company identifier
            since: Only include changes since this time

        Returns:
            List of SKUs needing inventory push
        """
        if since is None:
            since = datetime.utcnow() - timedelta(hours=1)

        # Get SKUs with recent inventory changes
        inventories = self.session.exec(
            select(Inventory, SKU)
            .join(SKU, Inventory.skuId == SKU.id)
            .where(
                Inventory.companyId == company_id,
                Inventory.updatedAt >= since
            )
        ).all()

        pending = []
        for inventory, sku in inventories:
            # Get mappings for this SKU
            mappings = self.session.exec(
                select(MarketplaceSkuMapping).where(
                    MarketplaceSkuMapping.companyId == company_id,
                    MarketplaceSkuMapping.skuId == inventory.skuId,
                    MarketplaceSkuMapping.listingStatus == "ACTIVE"
                )
            ).all()

            if mappings:
                pending.append({
                    "sku_id": str(inventory.skuId),
                    "sku_code": sku.skuCode,
                    "available": inventory.available,
                    "last_updated": inventory.updatedAt.isoformat(),
                    "channels": [m.channel for m in mappings],
                })

        return pending
