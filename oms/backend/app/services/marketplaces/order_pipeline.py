"""
Order Processing Pipeline
Converts marketplace orders into OMS Order + OrderItem + Delivery records.

Pipeline: Dedup -> Normalize -> Validate -> Create -> Reserve Inventory -> Link
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4
import logging

from sqlmodel import Session, select, func

from app.models import (
    Order,
    OrderItem,
    Delivery,
    Inventory,
    SKU,
    Location,
    MarketplaceConnection,
    MarketplaceOrderSync,
    MarketplaceSkuMapping,
    ImportStatus,
)
from app.models.enums import (
    Channel,
    OrderType,
    PaymentMode,
    OrderStatus,
    ItemStatus,
    DeliveryStatus,
)
from .base_adapter import MarketplaceOrder

logger = logging.getLogger(__name__)


# Channel prefix mapping for order number generation
CHANNEL_PREFIX_MAP = {
    "SHOPIFY": "SHP",
    "AMAZON": "AMZ",
    "FLIPKART": "FLK",
    "MYNTRA": "MYN",
    "MEESHO": "MSH",
    "AJIO": "AJO",
    "WOOCOMMERCE": "WOO",
    "WEBSITE": "WEB",
    "NYKAA": "NYK",
    "TATA_CLIQ": "TCQ",
    "JIOMART": "JIO",
    "MANUAL": "MAN",
    "B2B": "B2B",
}

# Marketplace name to Channel enum mapping
MARKETPLACE_CHANNEL_MAP = {
    "SHOPIFY": Channel.SHOPIFY,
    "AMAZON": Channel.AMAZON,
    "FLIPKART": Channel.FLIPKART,
    "MYNTRA": Channel.MYNTRA,
    "MEESHO": Channel.MEESHO,
    "AJIO": Channel.AJIO,
    "WOOCOMMERCE": Channel.WOOCOMMERCE,
    "NYKAA": Channel.NYKAA,
    "TATA_CLIQ": Channel.TATA_CLIQ,
    "JIOMART": Channel.JIOMART,
    "WEBSITE": Channel.WEBSITE,
    "MANUAL": Channel.MANUAL,
    "B2B": Channel.B2B,
}


class OrderPipeline:
    """
    Converts marketplace orders into OMS orders.
    Pipeline: Dedup -> Normalize -> Validate -> Create -> Reserve Inventory -> Link
    """

    def __init__(self, session: Session):
        self.session = session

    async def process_order(
        self,
        company_id: UUID,
        connection: MarketplaceConnection,
        marketplace_order: MarketplaceOrder,
    ) -> Dict[str, Any]:
        """
        Full pipeline: dedup -> normalize -> validate -> create -> reserve.

        Args:
            company_id: The company this order belongs to.
            connection: The MarketplaceConnection record.
            marketplace_order: Standardized marketplace order data.

        Returns:
            Result dict with status, order_id, order_no, and any warnings/errors.
        """
        result = {
            "status": "created",
            "marketplace_order_id": marketplace_order.marketplace_order_id,
            "order_id": None,
            "order_no": None,
            "warnings": [],
            "errors": [],
        }

        try:
            # ------------------------------------------------------------------
            # Step 1: Dedup - check idempotency (marketplace + marketplace_order_id)
            # ------------------------------------------------------------------
            existing_sync = self.session.exec(
                select(MarketplaceOrderSync)
                .where(MarketplaceOrderSync.companyId == company_id)
                .where(
                    MarketplaceOrderSync.marketplaceOrderId
                    == marketplace_order.marketplace_order_id
                )
            ).first()

            if existing_sync and existing_sync.orderId:
                result["status"] = "skipped"
                result["order_id"] = str(existing_sync.orderId)
                result["order_no"] = existing_sync.orderNo
                result["warnings"].append("Order already exists in OMS")
                return result

            # ------------------------------------------------------------------
            # Step 2: Map marketplace SKUs to internal SKUs
            # ------------------------------------------------------------------
            mapped_items, unmapped_skus = await self._map_skus(
                company_id, connection, marketplace_order
            )

            if unmapped_skus and not mapped_items:
                # All SKUs are unmapped - cannot create order
                await self._create_or_update_sync_record(
                    company_id=company_id,
                    connection=connection,
                    marketplace_order=marketplace_order,
                    existing_sync=existing_sync,
                    sync_status=ImportStatus.FAILED,
                    error_message=f"All SKUs unmapped: {unmapped_skus}",
                    order_id=None,
                    order_no=None,
                )
                result["status"] = "failed"
                result["errors"].append(f"Unmapped SKUs: {unmapped_skus}")
                return result

            if unmapped_skus:
                result["warnings"].append(
                    f"Some SKUs unmapped (skipped): {unmapped_skus}"
                )

            # ------------------------------------------------------------------
            # Step 3: Validate
            # ------------------------------------------------------------------
            validation_errors = await self._validate_order(
                company_id, marketplace_order, mapped_items
            )
            if validation_errors:
                result["warnings"].extend(validation_errors)

            # ------------------------------------------------------------------
            # Step 4: Determine channel and generate order number
            # ------------------------------------------------------------------
            channel = self._map_channel(marketplace_order.marketplace)
            order_no = self._generate_order_no(company_id, marketplace_order.marketplace)
            payment_mode = self._map_payment_mode(marketplace_order)

            # ------------------------------------------------------------------
            # Step 5: Get a locationId for the order
            # ------------------------------------------------------------------
            location_id = await self._get_default_location(company_id)
            if not location_id:
                result["status"] = "failed"
                result["errors"].append("No active location found for company")
                return result

            # ------------------------------------------------------------------
            # Step 6: Create Order record
            # ------------------------------------------------------------------
            order = Order(
                id=uuid4(),
                orderNo=order_no,
                externalOrderNo=marketplace_order.marketplace_order_id,
                channel=channel,
                orderType=OrderType.B2C,
                paymentMode=payment_mode,
                status=OrderStatus.CREATED,
                customerName=marketplace_order.customer_name or "Unknown",
                customerPhone=marketplace_order.customer_phone or "",
                customerEmail=marketplace_order.customer_email,
                shippingAddress=marketplace_order.shipping_address or {},
                billingAddress=marketplace_order.billing_address or None,
                subtotal=Decimal(str(marketplace_order.subtotal)),
                taxAmount=Decimal(str(marketplace_order.tax_amount)),
                shippingCharges=Decimal(str(marketplace_order.shipping_amount)),
                discount=Decimal(str(marketplace_order.discount_amount)),
                codCharges=Decimal("0"),
                totalAmount=Decimal(str(marketplace_order.total_amount)),
                orderDate=marketplace_order.order_date or datetime.utcnow(),
                shipByDate=marketplace_order.ship_by_date,
                promisedDate=marketplace_order.promised_delivery_date,
                priority=0,
                tags=[f"marketplace:{marketplace_order.marketplace.lower()}"],
                remarks=None,
                dataSourceType="MARKETPLACE",
                locationId=location_id,
                companyId=company_id,
            )

            self.session.add(order)
            self.session.flush()  # flush to get order.id without committing

            # ------------------------------------------------------------------
            # Step 7: Create OrderItem records for each mapped line item
            # ------------------------------------------------------------------
            order_items = []
            for item_data in mapped_items:
                sku_id = item_data["internal_sku_id"]
                quantity = int(item_data.get("quantity", 1))
                unit_price = Decimal(str(item_data.get("unit_price", 0)))
                tax_amount = Decimal(str(item_data.get("tax_amount", 0)))
                discount_amt = Decimal(str(item_data.get("discount_amount", 0)))
                total_price = Decimal(str(item_data.get("total_price", 0)))

                # If total_price was not provided, compute it
                if total_price == Decimal("0") and unit_price > 0:
                    total_price = (unit_price * quantity) + tax_amount - discount_amt

                order_item = OrderItem(
                    id=uuid4(),
                    orderId=order.id,
                    skuId=sku_id,
                    externalItemId=item_data.get("marketplace_line_id"),
                    quantity=quantity,
                    allocatedQty=0,
                    pickedQty=0,
                    packedQty=0,
                    shippedQty=0,
                    unitPrice=unit_price,
                    taxAmount=tax_amount,
                    discount=discount_amt,
                    totalPrice=total_price,
                    status=ItemStatus.PENDING,
                )
                self.session.add(order_item)
                order_items.append(order_item)

            # ------------------------------------------------------------------
            # Step 8: Create Delivery record
            # ------------------------------------------------------------------
            delivery_no = f"DLV-{order_no}"
            delivery = Delivery(
                id=uuid4(),
                deliveryNo=delivery_no,
                orderId=order.id,
                companyId=company_id,
                status=DeliveryStatus.PENDING,
                boxes=1,
            )
            self.session.add(delivery)

            # ------------------------------------------------------------------
            # Step 9: Reserve inventory for each order item
            # ------------------------------------------------------------------
            for order_item in order_items:
                reserved = await self._reserve_inventory(
                    company_id, order_item.skuId, order_item.quantity, order.id
                )
                if not reserved:
                    result["warnings"].append(
                        f"Insufficient inventory for SKU {order_item.skuId} "
                        f"(qty: {order_item.quantity})"
                    )

            # ------------------------------------------------------------------
            # Step 10: Create/update MarketplaceOrderSync record
            # ------------------------------------------------------------------
            await self._create_or_update_sync_record(
                company_id=company_id,
                connection=connection,
                marketplace_order=marketplace_order,
                existing_sync=existing_sync,
                sync_status=ImportStatus.COMPLETED,
                error_message=(
                    f"Unmapped SKUs: {unmapped_skus}" if unmapped_skus else None
                ),
                order_id=order.id,
                order_no=order_no,
            )

            # Commit everything together
            self.session.commit()

            result["order_id"] = str(order.id)
            result["order_no"] = order_no
            result["status"] = "created"

            logger.info(
                f"OrderPipeline: Created OMS order {order_no} for marketplace "
                f"order {marketplace_order.marketplace_order_id} "
                f"(company: {company_id})"
            )

            return result

        except Exception as e:
            self.session.rollback()
            logger.error(
                f"OrderPipeline: Failed to process marketplace order "
                f"{marketplace_order.marketplace_order_id}: {e}",
                exc_info=True,
            )
            result["status"] = "failed"
            result["errors"].append(str(e))
            return result

    # =========================================================================
    # Internal Helper Methods
    # =========================================================================

    def _generate_order_no(self, company_id: UUID, marketplace: str) -> str:
        """
        Generate unique order number like SHP-00001, AMZ-00001, FLK-00001.

        Uses a count of existing orders with the same prefix to determine
        the next sequence number.
        """
        prefix = CHANNEL_PREFIX_MAP.get(marketplace.upper(), "MKT")

        # Count existing orders with this prefix for this company
        count = self.session.exec(
            select(func.count(Order.id))
            .where(Order.companyId == company_id)
            .where(Order.orderNo.startswith(f"{prefix}-"))
        ).one()

        sequence = (count or 0) + 1
        return f"{prefix}-{sequence:05d}"

    def _map_channel(self, marketplace: str) -> Channel:
        """Map marketplace name to Channel enum."""
        channel = MARKETPLACE_CHANNEL_MAP.get(marketplace.upper())
        if channel:
            return channel

        # Fallback: try to match directly
        try:
            return Channel(marketplace.upper())
        except ValueError:
            logger.warning(
                f"Unknown marketplace '{marketplace}', defaulting to MANUAL"
            )
            return Channel.MANUAL

    def _map_payment_mode(self, marketplace_order: MarketplaceOrder) -> PaymentMode:
        """Map marketplace payment info to PaymentMode enum."""
        if marketplace_order.is_cod:
            return PaymentMode.COD
        return PaymentMode.PREPAID

    async def _map_skus(
        self,
        company_id: UUID,
        connection: MarketplaceConnection,
        marketplace_order: MarketplaceOrder,
    ) -> tuple:
        """
        Map marketplace SKUs to internal SKU IDs via MarketplaceSkuMapping.

        Returns:
            Tuple of (mapped_items_list, unmapped_skus_list)
        """
        mapped_items: List[Dict[str, Any]] = []
        unmapped_skus: List[str] = []

        for item in marketplace_order.items:
            marketplace_sku = (
                item.get("marketplace_sku")
                or item.get("sku")
                or item.get("seller_sku")
                or ""
            )

            if not marketplace_sku:
                unmapped_skus.append("(empty SKU)")
                continue

            # Look up the mapping
            mapping = self.session.exec(
                select(MarketplaceSkuMapping)
                .where(MarketplaceSkuMapping.companyId == company_id)
                .where(
                    MarketplaceSkuMapping.channel
                    == connection.marketplace.value
                )
                .where(MarketplaceSkuMapping.marketplaceSku == marketplace_sku)
            ).first()

            if mapping and mapping.skuId:
                # Verify the SKU actually exists
                sku_exists = self.session.exec(
                    select(SKU.id).where(SKU.id == mapping.skuId)
                ).first()

                if sku_exists:
                    enriched_item = dict(item)
                    enriched_item["internal_sku_id"] = mapping.skuId
                    enriched_item["mapping_id"] = mapping.id
                    mapped_items.append(enriched_item)
                else:
                    unmapped_skus.append(
                        f"{marketplace_sku} (SKU ID {mapping.skuId} not found)"
                    )
            else:
                unmapped_skus.append(marketplace_sku)

        return mapped_items, unmapped_skus

    async def _validate_order(
        self,
        company_id: UUID,
        marketplace_order: MarketplaceOrder,
        mapped_items: List[Dict[str, Any]],
    ) -> List[str]:
        """
        Validate order data before creation.
        Returns list of validation warnings (non-blocking).
        """
        warnings = []

        # Check customer info
        if not marketplace_order.customer_name:
            warnings.append("Missing customer name")

        if not marketplace_order.customer_phone and not marketplace_order.customer_email:
            warnings.append("Missing both customer phone and email")

        # Check shipping address
        if not marketplace_order.shipping_address:
            warnings.append("Missing shipping address")

        # Check amounts
        if marketplace_order.total_amount <= 0:
            warnings.append("Total amount is zero or negative")

        # Check inventory availability for each mapped item
        for item in mapped_items:
            sku_id = item["internal_sku_id"]
            qty = int(item.get("quantity", 1))
            has_inventory = await self._check_inventory(company_id, sku_id, qty)
            if not has_inventory:
                sku_label = item.get("marketplace_sku", str(sku_id))
                warnings.append(
                    f"Insufficient inventory for {sku_label} (need {qty})"
                )

        return warnings

    async def _check_inventory(
        self, company_id: UUID, sku_id: UUID, qty: int
    ) -> bool:
        """Check if enough inventory is available for the given SKU."""
        total_available = self.session.exec(
            select(
                func.sum(Inventory.quantity) - func.sum(Inventory.reservedQty)
            )
            .where(Inventory.skuId == sku_id)
            .where(Inventory.companyId == company_id)
        ).one()

        available = total_available or 0
        return available >= qty

    async def _reserve_inventory(
        self, company_id: UUID, sku_id: UUID, qty: int, order_id: UUID
    ) -> bool:
        """
        Reserve inventory for the order by incrementing reservedQty
        on Inventory records (FIFO order).

        Returns True if full quantity was reserved, False otherwise.
        """
        remaining = qty

        # Get inventory records ordered by FIFO sequence
        inventory_records = self.session.exec(
            select(Inventory)
            .where(Inventory.skuId == sku_id)
            .where(Inventory.companyId == company_id)
            .where(Inventory.quantity > Inventory.reservedQty)
            .order_by(Inventory.fifoSequence.asc().nulls_last())
        ).all()

        for inv in inventory_records:
            if remaining <= 0:
                break

            available = inv.quantity - inv.reservedQty
            reserve_amount = min(available, remaining)

            inv.reservedQty += reserve_amount
            self.session.add(inv)
            remaining -= reserve_amount

        if remaining > 0:
            logger.warning(
                f"Could not fully reserve inventory for SKU {sku_id} "
                f"(order: {order_id}, short by {remaining})"
            )
            return False

        return True

    async def _get_default_location(self, company_id: UUID) -> Optional[UUID]:
        """Get the default (first active) location for a company."""
        location = self.session.exec(
            select(Location.id)
            .where(Location.companyId == company_id)
            .where(Location.isActive == True)
            .limit(1)
        ).first()

        return location

    async def _create_or_update_sync_record(
        self,
        company_id: UUID,
        connection: MarketplaceConnection,
        marketplace_order: MarketplaceOrder,
        existing_sync: Optional[MarketplaceOrderSync],
        sync_status: ImportStatus,
        error_message: Optional[str],
        order_id: Optional[UUID],
        order_no: Optional[str],
    ):
        """Create or update the MarketplaceOrderSync record."""
        if existing_sync:
            existing_sync.orderId = order_id
            existing_sync.orderNo = order_no
            existing_sync.syncStatus = sync_status
            existing_sync.errorMessage = error_message
            existing_sync.syncedAt = datetime.utcnow()
            self.session.add(existing_sync)
        else:
            order_sync = MarketplaceOrderSync(
                id=uuid4(),
                companyId=company_id,
                connectionId=connection.id,
                marketplace=connection.marketplace,
                marketplaceOrderId=marketplace_order.marketplace_order_id,
                orderId=order_id,
                orderNo=order_no,
                syncStatus=sync_status,
                syncDirection="INBOUND",
                orderData={
                    "customer": {
                        "name": marketplace_order.customer_name,
                        "email": marketplace_order.customer_email,
                        "phone": marketplace_order.customer_phone,
                    },
                    "shipping_address": marketplace_order.shipping_address,
                    "items": marketplace_order.items,
                    "totals": {
                        "subtotal": marketplace_order.subtotal,
                        "shipping": marketplace_order.shipping_amount,
                        "tax": marketplace_order.tax_amount,
                        "discount": marketplace_order.discount_amount,
                        "total": marketplace_order.total_amount,
                    },
                    "payment_method": marketplace_order.payment_method,
                    "is_cod": marketplace_order.is_cod,
                    "fulfillment_type": marketplace_order.fulfillment_type.value,
                },
                errorMessage=error_message,
            )
            self.session.add(order_sync)
