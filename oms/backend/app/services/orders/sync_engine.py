"""
Order Sync Engine
Orchestrates order synchronization from marketplaces to OMS
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.models import (
    Order,
    OrderItem,
    MarketplaceConnection,
    MarketplaceSyncJob,
    SyncJobType,
    SyncJobStatus,
    ConnectionStatus,
)
from app.services.marketplaces import AdapterFactory, SyncCoordinator
from .order_transformer import OrderTransformer
from .duplicate_detector import DuplicateDetector

logger = logging.getLogger(__name__)


class OrderSyncEngine:
    """
    Orchestrates the order sync process:
    1. Fetch orders from marketplace
    2. Filter duplicates
    3. Transform to OMS format
    4. Apply SKU mappings
    5. Create orders in database
    6. Update sync job status
    """

    def __init__(self, session: Session):
        self.session = session

    async def sync_orders(
        self,
        connection: MarketplaceConnection,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        triggered_by: str = "MANUAL"
    ) -> dict:
        """
        Sync orders from a single marketplace connection.

        Args:
            connection: The marketplace connection to sync from
            from_date: Start date for order fetch (default: last 24 hours)
            to_date: End date for order fetch (default: now)
            triggered_by: Who/what triggered the sync

        Returns:
            Sync result dictionary
        """
        # Set default date range
        if to_date is None:
            to_date = datetime.utcnow()
        if from_date is None:
            # Use last sync time or default to 24 hours
            from_date = connection.lastSyncAt or (to_date - timedelta(hours=24))

        # Create sync job record
        sync_job = MarketplaceSyncJob(
            id=uuid4(),
            companyId=connection.companyId,
            connectionId=connection.id,
            jobType=SyncJobType.ORDER_PULL,
            status=SyncJobStatus.IN_PROGRESS,
            triggeredBy=triggered_by,
            syncFromDate=from_date,
            syncToDate=to_date,
            startedAt=datetime.utcnow()
        )
        self.session.add(sync_job)
        self.session.commit()

        result = {
            "connection_id": str(connection.id),
            "connection_name": connection.connectionName,
            "channel": connection.marketplace.value,
            "sync_job_id": str(sync_job.id),
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
        }

        try:
            logger.info(
                f"Starting order sync for {connection.connectionName} "
                f"({from_date} to {to_date})"
            )

            # Initialize services
            transformer = OrderTransformer(self.session, connection.companyId)
            duplicate_detector = DuplicateDetector(self.session, connection.companyId)

            # Get adapter and fetch orders
            adapter = AdapterFactory.create_from_connection(connection, self.session)
            raw_orders = await adapter.fetch_orders(from_date, to_date)

            logger.info(f"Fetched {len(raw_orders)} orders from {connection.connectionName}")
            result["orders_fetched"] = len(raw_orders)

            if not raw_orders:
                sync_job.status = SyncJobStatus.COMPLETED
                sync_job.completedAt = datetime.utcnow()
                sync_job.recordsTotal = 0
                sync_job.recordsSuccess = 0
                self.session.add(sync_job)
                self.session.commit()

                result["success"] = True
                result["orders_created"] = 0
                result["orders_skipped"] = 0
                return result

            # Filter duplicates
            new_orders, duplicates = duplicate_detector.filter_duplicates(
                raw_orders,
                connection.marketplace.value
            )

            logger.info(
                f"Duplicate check: {len(new_orders)} new, {len(duplicates)} duplicates"
            )
            result["orders_duplicate"] = len(duplicates)

            # Transform and create orders
            orders_created = 0
            orders_failed = 0
            errors = []

            for raw_order in new_orders:
                try:
                    # Transform order
                    transformed = transformer.transform_marketplace_order(
                        raw_order,
                        connection.marketplace.value,
                        connection.id
                    )

                    # Create order
                    order = self._create_order(transformed)

                    if order:
                        orders_created += 1
                        duplicate_detector.mark_as_processed(
                            transformed.get("marketplaceOrderId")
                        )
                    else:
                        orders_failed += 1
                        errors.append({
                            "marketplace_order_id": transformed.get("marketplaceOrderId"),
                            "error": "Failed to create order"
                        })

                except Exception as e:
                    orders_failed += 1
                    marketplace_id = raw_order.get("order_id") or raw_order.get("id") or "unknown"
                    errors.append({
                        "marketplace_order_id": marketplace_id,
                        "error": str(e)
                    })
                    logger.error(f"Failed to process order {marketplace_id}: {e}")

            # Update sync job
            sync_job.status = SyncJobStatus.COMPLETED if orders_failed == 0 else SyncJobStatus.PARTIAL
            sync_job.completedAt = datetime.utcnow()
            sync_job.recordsTotal = len(raw_orders)
            sync_job.recordsSuccess = orders_created
            sync_job.recordsFailed = orders_failed
            if errors:
                sync_job.errorLog = {"errors": errors}

            self.session.add(sync_job)

            # Update connection last sync time
            connection.lastSyncAt = datetime.utcnow()
            self.session.add(connection)

            self.session.commit()

            result["success"] = True
            result["orders_created"] = orders_created
            result["orders_failed"] = orders_failed
            result["orders_skipped"] = len(duplicates)
            if errors:
                result["errors"] = errors[:10]  # Limit errors in response

            logger.info(
                f"Order sync complete for {connection.connectionName}: "
                f"{orders_created} created, {orders_failed} failed, {len(duplicates)} skipped"
            )

        except Exception as e:
            logger.error(f"Order sync failed for {connection.connectionName}: {e}")

            sync_job.status = SyncJobStatus.FAILED
            sync_job.completedAt = datetime.utcnow()
            sync_job.errorMessage = str(e)
            self.session.add(sync_job)
            self.session.commit()

            result["success"] = False
            result["error"] = str(e)

        return result

    def _create_order(self, order_data: dict) -> Optional[Order]:
        """
        Create an order in the database from transformed data.

        Args:
            order_data: Transformed order data

        Returns:
            Created Order or None if failed
        """
        try:
            # Create order
            order = Order(
                id=uuid4(),
                companyId=UUID(order_data["companyId"]),
                orderNo=order_data.get("orderNo"),
                channel=order_data.get("channel"),
                marketplaceOrderId=order_data.get("marketplaceOrderId"),
                connectionId=UUID(order_data["connectionId"]) if order_data.get("connectionId") else None,
                orderDate=order_data.get("orderDate") or datetime.utcnow(),
                status=order_data.get("status", "PENDING"),

                # Customer info
                customerName=order_data.get("customerName"),
                customerEmail=order_data.get("customerEmail"),
                customerPhone=order_data.get("customerPhone"),

                # Shipping address as JSON
                shippingAddress=order_data.get("shippingAddress"),

                # Financial
                subtotal=order_data.get("subtotal"),
                shippingFee=order_data.get("shippingFee"),
                taxAmount=order_data.get("taxAmount"),
                discountAmount=order_data.get("discountAmount"),
                totalAmount=order_data.get("totalAmount"),
                currency=order_data.get("currency", "INR"),

                # Payment
                paymentMethod=order_data.get("paymentMethod"),
                paymentStatus=order_data.get("paymentStatus"),

                # Metadata
                metadata=order_data.get("metadata"),

                # Fingerprint for duplicate detection
                orderFingerprint=self._generate_order_fingerprint(order_data),

                createdAt=datetime.utcnow(),
                updatedAt=datetime.utcnow(),
            )

            self.session.add(order)

            # Create order items
            for item_data in order_data.get("items", []):
                item = OrderItem(
                    id=uuid4(),
                    orderId=order.id,
                    skuId=UUID(item_data["skuId"]) if item_data.get("skuId") else None,
                    marketplaceSku=item_data.get("marketplaceSku"),
                    sellerSku=item_data.get("sellerSku"),
                    productName=item_data.get("title"),
                    quantity=item_data.get("quantity", 1),
                    unitPrice=item_data.get("unitPrice"),
                    taxAmount=item_data.get("taxAmount"),
                    discountAmount=item_data.get("discountAmount"),
                    createdAt=datetime.utcnow(),
                )
                self.session.add(item)

            self.session.flush()  # Get the order ID without committing

            return order

        except Exception as e:
            logger.error(f"Failed to create order: {e}")
            self.session.rollback()
            return None

    def _generate_order_fingerprint(self, order_data: dict) -> str:
        """Generate a fingerprint for duplicate detection."""
        import hashlib

        customer_phone = order_data.get("customerPhone", "")
        total = str(order_data.get("totalAmount", "0"))
        order_date = str(order_data.get("orderDate", ""))

        items = order_data.get("items", [])
        item_fingerprints = []
        for item in items:
            item_fp = f"{item.get('marketplaceSku', '')}:{item.get('quantity', 1)}"
            item_fingerprints.append(item_fp)
        items_str = "|".join(sorted(item_fingerprints))

        fingerprint_source = f"{customer_phone}:{total}:{order_date}:{items_str}"
        return hashlib.sha256(fingerprint_source.encode()).hexdigest()[:32]

    async def sync_all_connections(
        self,
        company_id: Optional[UUID] = None,
        triggered_by: str = "SCHEDULED"
    ) -> List[dict]:
        """
        Sync orders from all active marketplace connections.

        Args:
            company_id: Optional company ID to filter connections
            triggered_by: Who/what triggered the sync

        Returns:
            List of sync results for each connection
        """
        results = []

        # Get all active connections
        query = select(MarketplaceConnection).where(
            MarketplaceConnection.status == ConnectionStatus.CONNECTED,
            MarketplaceConnection.isActive == True
        )

        if company_id:
            query = query.where(MarketplaceConnection.companyId == company_id)

        connections = self.session.exec(query).all()
        logger.info(f"Found {len(connections)} active connections for order sync")

        for connection in connections:
            # Check if order sync is enabled for this connection
            sync_settings = connection.syncSettings or {}
            if not sync_settings.get("order_sync_enabled", True):
                logger.info(f"Skipping {connection.connectionName} - order sync disabled")
                continue

            result = await self.sync_orders(connection, triggered_by=triggered_by)
            results.append(result)

        return results

    def get_sync_history(
        self,
        connection_id: Optional[UUID] = None,
        company_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[MarketplaceSyncJob]:
        """
        Get order sync job history.

        Args:
            connection_id: Optional filter by connection
            company_id: Optional filter by company
            limit: Maximum number of records to return

        Returns:
            List of sync job records
        """
        query = select(MarketplaceSyncJob).where(
            MarketplaceSyncJob.jobType == SyncJobType.ORDER_PULL
        ).order_by(MarketplaceSyncJob.createdAt.desc()).limit(limit)

        if connection_id:
            query = query.where(MarketplaceSyncJob.connectionId == connection_id)
        if company_id:
            query = query.where(MarketplaceSyncJob.companyId == company_id)

        return list(self.session.exec(query).all())
