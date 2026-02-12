"""
Webhook Event Processor
Processes marketplace webhook events stored in MarketplaceWebhookEvent table.

Handles: order creation, order updates, order cancellation, refunds, inventory alerts.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from uuid import UUID
import logging
import json

from sqlmodel import Session, select

from app.models import (
    MarketplaceWebhookEvent,
    MarketplaceConnection,
    MarketplaceOrderSync,
    Order,
    OrderItem,
    Inventory,
    WebhookEventStatus,
    ConnectionStatus,
    ImportStatus,
)
from app.models.enums import OrderStatus, ItemStatus
from .order_pipeline import OrderPipeline
from .base_adapter import MarketplaceOrder, FulfillmentType

logger = logging.getLogger(__name__)


# ============================================================================
# Event type routing maps per marketplace
# ============================================================================

SHOPIFY_EVENT_MAP = {
    "orders/create": "order_created",
    "orders/updated": "order_updated",
    "orders/cancelled": "order_cancelled",
    "orders/fulfilled": "order_updated",
    "refunds/create": "refund_created",
    "inventory_levels/update": "inventory_alert",
}

AMAZON_EVENT_MAP = {
    "ORDER_CHANGE": "order_updated",  # Route by sub-type below
    "ORDER_CREATED": "order_created",
    "ORDER_STATUS_CHANGE": "order_updated",
    "ORDER_CANCELLED": "order_cancelled",
    "RETURNS_RECEIVED": "refund_created",
    "INVENTORY_ALERT": "inventory_alert",
}

FLIPKART_EVENT_MAP = {
    "order_approved": "order_created",
    "order_cancelled": "order_cancelled",
    "return_initiated": "refund_created",
    "settlement_generated": "settlement",
}

# Generic event type normalization for any marketplace
GENERIC_EVENT_MAP = {
    "order.created": "order_created",
    "order.updated": "order_updated",
    "order.cancelled": "order_cancelled",
    "order.fulfilled": "order_updated",
    "refund.created": "refund_created",
    "inventory.updated": "inventory_alert",
    "ORDER_CREATED": "order_created",
    "ORDER_UPDATED": "order_updated",
    "ORDER_CANCELLED": "order_cancelled",
    "REFUND_CREATED": "refund_created",
    "INVENTORY_ALERT": "inventory_alert",
}

# Maximum retries for failed events
MAX_RETRIES = 3
RETRY_DELAYS = [60, 300, 900]  # 1 min, 5 min, 15 min


class WebhookEventProcessor:
    """
    Processes marketplace webhook events asynchronously.
    Handles: order creation, order updates, order cancellation, refunds, inventory alerts.
    """

    def __init__(self, session: Session):
        self.session = session
        self.order_pipeline = OrderPipeline(session)

    async def process_event(self, event_id: UUID) -> Dict[str, Any]:
        """
        Process a single webhook event by ID.

        Args:
            event_id: The UUID of the MarketplaceWebhookEvent record.

        Returns:
            Result dict with status and details.
        """
        # 1. Load event from DB
        event = self.session.exec(
            select(MarketplaceWebhookEvent)
            .where(MarketplaceWebhookEvent.id == event_id)
        ).first()

        if not event:
            return {"success": False, "error": f"Event not found: {event_id}"}

        if event.status == WebhookEventStatus.PROCESSED:
            return {
                "success": True,
                "message": "Event already processed",
                "event_id": str(event_id),
            }

        if event.status == WebhookEventStatus.IGNORED:
            return {
                "success": True,
                "message": "Event is marked as ignored",
                "event_id": str(event_id),
            }

        # 2. Update status to PROCESSING
        event.status = WebhookEventStatus.PROCESSING
        event.updatedAt = datetime.utcnow()
        self.session.add(event)
        self.session.commit()

        try:
            # 3. Route to handler based on channel + eventType
            handler_name = self._resolve_handler(event.channel, event.eventType, event.payload)

            if handler_name == "order_created":
                result = await self._handle_order_created(event)
            elif handler_name == "order_updated":
                result = await self._handle_order_updated(event)
            elif handler_name == "order_cancelled":
                result = await self._handle_order_cancelled(event)
            elif handler_name == "refund_created":
                result = await self._handle_refund_created(event)
            elif handler_name == "inventory_alert":
                result = await self._handle_inventory_alert(event)
            else:
                result = {
                    "success": True,
                    "message": f"Unhandled event type: {event.eventType} "
                    f"(channel: {event.channel})",
                    "action": "ignored",
                }

            # 4. On success: mark PROCESSED
            event.status = WebhookEventStatus.PROCESSED
            event.processedAt = datetime.utcnow()
            event.updatedAt = datetime.utcnow()
            event.errorMessage = None
            event.errorDetails = None
            self.session.add(event)
            self.session.commit()

            result["event_id"] = str(event_id)
            return result

        except Exception as e:
            # 5. On failure: mark FAILED, store error, schedule retry
            self.session.rollback()
            logger.error(
                f"WebhookProcessor: Failed to process event {event_id}: {e}",
                exc_info=True,
            )

            # Reload the event after rollback
            event = self.session.exec(
                select(MarketplaceWebhookEvent)
                .where(MarketplaceWebhookEvent.id == event_id)
            ).first()

            if event:
                event.status = WebhookEventStatus.FAILED
                event.errorMessage = str(e)[:1000]
                event.errorDetails = {"exception": str(type(e).__name__), "message": str(e)}
                event.retryCount += 1
                event.updatedAt = datetime.utcnow()

                # Schedule retry if under max retries
                if event.retryCount < event.maxRetries:
                    delay_seconds = RETRY_DELAYS[
                        min(event.retryCount - 1, len(RETRY_DELAYS) - 1)
                    ]
                    event.nextRetryAt = datetime.utcnow() + timedelta(seconds=delay_seconds)
                    event.status = WebhookEventStatus.RETRYING

                self.session.add(event)
                self.session.commit()

            return {
                "success": False,
                "event_id": str(event_id),
                "error": str(e),
                "retry_count": event.retryCount if event else 0,
            }

    async def process_pending_events(self, limit: int = 100) -> Dict[str, Any]:
        """
        Process all pending and retryable webhook events.
        Called by background scheduler or manual trigger.

        Args:
            limit: Maximum number of events to process in one batch.

        Returns:
            Summary dict with counts.
        """
        now = datetime.utcnow()

        # Get PENDING events and RETRYING events whose retry time has passed
        events = self.session.exec(
            select(MarketplaceWebhookEvent)
            .where(
                (MarketplaceWebhookEvent.status == WebhookEventStatus.PENDING)
                | (
                    (MarketplaceWebhookEvent.status == WebhookEventStatus.RETRYING)
                    & (
                        (MarketplaceWebhookEvent.nextRetryAt == None)
                        | (MarketplaceWebhookEvent.nextRetryAt <= now)
                    )
                )
            )
            .order_by(MarketplaceWebhookEvent.createdAt.asc())
            .limit(limit)
        ).all()

        processed = 0
        succeeded = 0
        failed = 0
        errors: List[Dict[str, Any]] = []

        for event in events:
            result = await self.process_event(event.id)
            processed += 1

            if result.get("success"):
                succeeded += 1
            else:
                failed += 1
                errors.append({
                    "event_id": str(event.id),
                    "error": result.get("error", "Unknown error"),
                })

        return {
            "total_pending": len(events),
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "errors": errors,
        }

    # =========================================================================
    # Event Handlers
    # =========================================================================

    async def _handle_order_created(
        self, event: MarketplaceWebhookEvent
    ) -> Dict[str, Any]:
        """
        Handle new order webhook - creates OMS order via OrderPipeline.
        """
        # Get the connection
        connection = await self._get_connection(event)
        if not connection:
            return {
                "success": True,
                "message": "No connection found, event stored for later processing",
                "action": "deferred",
            }

        # Convert webhook payload to MarketplaceOrder dataclass
        marketplace_order = self._payload_to_marketplace_order(
            event.channel, event.payload
        )

        if not marketplace_order:
            return {
                "success": True,
                "message": "Could not parse order from payload",
                "action": "parse_failed",
            }

        # Process through the order pipeline
        result = await self.order_pipeline.process_order(
            company_id=event.companyId,
            connection=connection,
            marketplace_order=marketplace_order,
        )

        return {
            "success": result["status"] in ("created", "skipped"),
            "action": "order_created",
            "order_id": result.get("order_id"),
            "order_no": result.get("order_no"),
            "pipeline_status": result["status"],
            "warnings": result.get("warnings", []),
            "errors": result.get("errors", []),
        }

    async def _handle_order_updated(
        self, event: MarketplaceWebhookEvent
    ) -> Dict[str, Any]:
        """
        Handle order status update - syncs status to existing OMS order.
        """
        payload = event.payload or {}
        marketplace_order_id = self._extract_order_id_from_payload(
            event.channel, payload
        )

        if not marketplace_order_id:
            return {
                "success": True,
                "message": "Could not extract marketplace order ID from payload",
                "action": "ignored",
            }

        # Find the linked OMS order
        sync_record = self.session.exec(
            select(MarketplaceOrderSync)
            .where(MarketplaceOrderSync.companyId == event.companyId)
            .where(MarketplaceOrderSync.marketplaceOrderId == marketplace_order_id)
        ).first()

        if not sync_record or not sync_record.orderId:
            return {
                "success": True,
                "message": f"No OMS order linked for marketplace order {marketplace_order_id}",
                "action": "not_linked",
            }

        # Get the OMS order
        order = self.session.exec(
            select(Order).where(Order.id == sync_record.orderId)
        ).first()

        if not order:
            return {
                "success": True,
                "message": f"OMS order {sync_record.orderId} not found",
                "action": "order_missing",
            }

        # Map marketplace status to OMS status
        new_status = self._map_order_status(
            event.channel, payload
        )

        if new_status and new_status != order.status:
            old_status = order.status
            order.status = new_status
            order.updatedAt = datetime.utcnow()
            self.session.add(order)
            self.session.commit()

            logger.info(
                f"WebhookProcessor: Updated order {order.orderNo} status "
                f"from {old_status} to {new_status}"
            )

            return {
                "success": True,
                "action": "status_updated",
                "order_id": str(order.id),
                "order_no": order.orderNo,
                "old_status": old_status.value if old_status else None,
                "new_status": new_status.value,
            }

        return {
            "success": True,
            "action": "no_change",
            "order_id": str(order.id),
            "message": "Status unchanged or unmappable",
        }

    async def _handle_order_cancelled(
        self, event: MarketplaceWebhookEvent
    ) -> Dict[str, Any]:
        """
        Handle order cancellation - cancels OMS order and releases reserved inventory.
        """
        payload = event.payload or {}
        marketplace_order_id = self._extract_order_id_from_payload(
            event.channel, payload
        )

        if not marketplace_order_id:
            return {
                "success": True,
                "message": "Could not extract marketplace order ID",
                "action": "ignored",
            }

        # Find linked OMS order
        sync_record = self.session.exec(
            select(MarketplaceOrderSync)
            .where(MarketplaceOrderSync.companyId == event.companyId)
            .where(MarketplaceOrderSync.marketplaceOrderId == marketplace_order_id)
        ).first()

        if not sync_record or not sync_record.orderId:
            return {
                "success": True,
                "message": f"No OMS order linked for {marketplace_order_id}",
                "action": "not_linked",
            }

        order = self.session.exec(
            select(Order).where(Order.id == sync_record.orderId)
        ).first()

        if not order:
            return {
                "success": True,
                "message": f"OMS order not found",
                "action": "order_missing",
            }

        if order.status == OrderStatus.CANCELLED:
            return {
                "success": True,
                "message": "Order already cancelled",
                "action": "no_change",
            }

        # Cancel the order
        order.status = OrderStatus.CANCELLED
        order.updatedAt = datetime.utcnow()
        self.session.add(order)

        # Cancel all pending order items and release reserved inventory
        items = self.session.exec(
            select(OrderItem)
            .where(OrderItem.orderId == order.id)
            .where(OrderItem.status != ItemStatus.CANCELLED)
        ).all()

        released_skus = []
        for item in items:
            item.status = ItemStatus.CANCELLED
            item.updatedAt = datetime.utcnow()
            self.session.add(item)

            # Release reserved inventory
            await self._release_inventory(
                event.companyId, item.skuId, item.quantity
            )
            released_skus.append(str(item.skuId))

        self.session.commit()

        logger.info(
            f"WebhookProcessor: Cancelled order {order.orderNo} "
            f"(marketplace: {marketplace_order_id}), "
            f"released inventory for {len(released_skus)} SKUs"
        )

        return {
            "success": True,
            "action": "order_cancelled",
            "order_id": str(order.id),
            "order_no": order.orderNo,
            "released_skus": released_skus,
        }

    async def _handle_refund_created(
        self, event: MarketplaceWebhookEvent
    ) -> Dict[str, Any]:
        """
        Handle refund - updates order status and logs refund info.
        Full return processing would be handled by a separate Returns service.
        """
        payload = event.payload or {}
        marketplace_order_id = self._extract_order_id_from_payload(
            event.channel, payload
        )

        if not marketplace_order_id:
            return {
                "success": True,
                "message": "Could not extract order ID for refund",
                "action": "ignored",
            }

        sync_record = self.session.exec(
            select(MarketplaceOrderSync)
            .where(MarketplaceOrderSync.companyId == event.companyId)
            .where(MarketplaceOrderSync.marketplaceOrderId == marketplace_order_id)
        ).first()

        if not sync_record or not sync_record.orderId:
            return {
                "success": True,
                "message": f"No OMS order linked for refund on {marketplace_order_id}",
                "action": "not_linked",
            }

        order = self.session.exec(
            select(Order).where(Order.id == sync_record.orderId)
        ).first()

        if not order:
            return {
                "success": True,
                "message": "OMS order not found for refund",
                "action": "order_missing",
            }

        # Update order remarks with refund info
        refund_amount = payload.get("refund_amount") or payload.get(
            "amount", payload.get("total", 0)
        )
        refund_reason = payload.get("reason", payload.get("note", "Marketplace refund"))

        refund_note = (
            f"Marketplace refund: {refund_amount} ({refund_reason}) "
            f"at {datetime.utcnow().isoformat()}"
        )

        if order.remarks:
            order.remarks = f"{order.remarks}\n{refund_note}"
        else:
            order.remarks = refund_note

        order.updatedAt = datetime.utcnow()
        self.session.add(order)
        self.session.commit()

        logger.info(
            f"WebhookProcessor: Refund recorded for order {order.orderNo}: "
            f"amount={refund_amount}"
        )

        return {
            "success": True,
            "action": "refund_recorded",
            "order_id": str(order.id),
            "order_no": order.orderNo,
            "refund_amount": refund_amount,
        }

    async def _handle_inventory_alert(
        self, event: MarketplaceWebhookEvent
    ) -> Dict[str, Any]:
        """
        Handle inventory level change notification from marketplace.
        Logs the alert; actual inventory reconciliation would be a separate process.
        """
        payload = event.payload or {}

        # Extract inventory info from payload
        sku_id = payload.get("sku_id") or payload.get("inventory_item_id")
        available = payload.get("available") or payload.get("quantity")
        location_id = payload.get("location_id")

        logger.info(
            f"WebhookProcessor: Inventory alert from {event.channel} - "
            f"SKU: {sku_id}, Available: {available}, Location: {location_id}"
        )

        return {
            "success": True,
            "action": "inventory_alert_logged",
            "channel": event.channel,
            "sku_id": sku_id,
            "available": available,
            "message": "Inventory alert logged for reconciliation",
        }

    # =========================================================================
    # Internal Helpers
    # =========================================================================

    def _resolve_handler(
        self, channel: str, event_type: str, payload: dict
    ) -> Optional[str]:
        """
        Resolve the event to a handler name based on channel and event type.
        Returns one of: order_created, order_updated, order_cancelled,
                        refund_created, inventory_alert, or None.
        """
        channel_upper = (channel or "").upper()

        # Channel-specific routing
        if channel_upper == "SHOPIFY":
            handler = SHOPIFY_EVENT_MAP.get(event_type)
            if handler:
                return handler

        elif channel_upper == "AMAZON":
            handler = AMAZON_EVENT_MAP.get(event_type)
            if handler:
                # For ORDER_CHANGE, determine sub-type from payload
                if event_type == "ORDER_CHANGE" and handler == "order_updated":
                    sub_type = (payload or {}).get("OrderChangeType", "")
                    if sub_type == "OrderCancelled":
                        return "order_cancelled"
                    elif sub_type == "NewOrder":
                        return "order_created"
                return handler

        elif channel_upper == "FLIPKART":
            handler = FLIPKART_EVENT_MAP.get(event_type)
            if handler:
                return handler

        # Generic fallback
        handler = GENERIC_EVENT_MAP.get(event_type)
        if handler:
            return handler

        # Try case-insensitive matching on generic keywords
        et_lower = (event_type or "").lower()
        if "cancel" in et_lower:
            return "order_cancelled"
        if "create" in et_lower or "new" in et_lower or "approved" in et_lower:
            return "order_created"
        if "update" in et_lower or "change" in et_lower or "fulfil" in et_lower:
            return "order_updated"
        if "refund" in et_lower or "return" in et_lower:
            return "refund_created"
        if "inventory" in et_lower or "stock" in et_lower:
            return "inventory_alert"

        return None

    async def _get_connection(
        self, event: MarketplaceWebhookEvent
    ) -> Optional[MarketplaceConnection]:
        """Get the marketplace connection for this event."""
        if event.connectionId:
            return self.session.exec(
                select(MarketplaceConnection)
                .where(MarketplaceConnection.id == event.connectionId)
            ).first()

        # Try to find by company + channel
        return self.session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.companyId == event.companyId)
            .where(MarketplaceConnection.marketplace == event.channel)
            .where(MarketplaceConnection.isActive == True)
            .limit(1)
        ).first()

    def _payload_to_marketplace_order(
        self, channel: str, payload: dict
    ) -> Optional[MarketplaceOrder]:
        """
        Convert a webhook payload into a MarketplaceOrder dataclass.
        Each channel has its own payload structure.
        """
        if not payload:
            return None

        channel_upper = (channel or "").upper()

        try:
            if channel_upper == "SHOPIFY":
                return self._parse_shopify_order(payload)
            elif channel_upper == "AMAZON":
                return self._parse_amazon_order(payload)
            elif channel_upper == "FLIPKART":
                return self._parse_flipkart_order(payload)
            else:
                return self._parse_generic_order(channel, payload)
        except Exception as e:
            logger.error(
                f"WebhookProcessor: Failed to parse {channel} order payload: {e}",
                exc_info=True,
            )
            return None

    def _parse_shopify_order(self, payload: dict) -> MarketplaceOrder:
        """Parse Shopify order webhook payload."""
        shipping = payload.get("shipping_address", {}) or {}
        billing = payload.get("billing_address", {}) or {}
        customer = payload.get("customer", {}) or {}

        items = []
        for li in payload.get("line_items", []):
            items.append({
                "marketplace_line_id": str(li.get("id", "")),
                "marketplace_sku": li.get("sku", li.get("variant_id", "")),
                "title": li.get("title", ""),
                "quantity": li.get("quantity", 1),
                "unit_price": float(li.get("price", 0)),
                "total_price": float(li.get("price", 0)) * li.get("quantity", 1),
                "tax_amount": sum(
                    float(t.get("price", 0)) for t in li.get("tax_lines", [])
                ),
                "discount_amount": sum(
                    float(d.get("amount", 0))
                    for d in li.get("discount_allocations", [])
                ),
            })

        is_cod = False
        payment_method = "PREPAID"
        gateways = payload.get("payment_gateway_names", [])
        if "cash_on_delivery" in [g.lower() for g in gateways]:
            is_cod = True
            payment_method = "COD"

        return MarketplaceOrder(
            marketplace_order_id=str(payload.get("id", payload.get("order_number", ""))),
            marketplace="SHOPIFY",
            order_status=payload.get("fulfillment_status", "unfulfilled") or "unfulfilled",
            order_date=datetime.fromisoformat(
                payload["created_at"].replace("Z", "+00:00")
            )
            if payload.get("created_at")
            else datetime.utcnow(),
            customer_name=f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip()
            or f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
            or "Unknown",
            customer_email=payload.get("email") or customer.get("email"),
            customer_phone=shipping.get("phone") or customer.get("phone"),
            shipping_address={
                "name": f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip(),
                "address1": shipping.get("address1", ""),
                "address2": shipping.get("address2", ""),
                "city": shipping.get("city", ""),
                "state": shipping.get("province", ""),
                "pincode": shipping.get("zip", ""),
                "country": shipping.get("country_code", "IN"),
                "phone": shipping.get("phone", ""),
            },
            billing_address={
                "name": f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip(),
                "address1": billing.get("address1", ""),
                "address2": billing.get("address2", ""),
                "city": billing.get("city", ""),
                "state": billing.get("province", ""),
                "pincode": billing.get("zip", ""),
                "country": billing.get("country_code", "IN"),
                "phone": billing.get("phone", ""),
            },
            items=items,
            subtotal=float(payload.get("subtotal_price", 0)),
            shipping_amount=float(
                sum(
                    float(sl.get("price", 0))
                    for sl in payload.get("shipping_lines", [])
                )
            ),
            tax_amount=float(payload.get("total_tax", 0)),
            discount_amount=float(
                sum(
                    float(d.get("amount", 0))
                    for d in payload.get("discount_codes", [])
                )
            ),
            total_amount=float(payload.get("total_price", 0)),
            currency=payload.get("currency", "INR"),
            payment_method=payment_method,
            is_cod=is_cod,
            raw_data=payload,
        )

    def _parse_amazon_order(self, payload: dict) -> MarketplaceOrder:
        """Parse Amazon order notification payload."""
        order_data = payload.get("OrderChangeNotification", payload)
        order_info = order_data.get("Summary", order_data)

        items = []
        for item in order_info.get("OrderItems", order_data.get("items", [])):
            items.append({
                "marketplace_line_id": str(item.get("OrderItemId", item.get("id", ""))),
                "marketplace_sku": item.get("SellerSKU", item.get("sku", "")),
                "title": item.get("Title", item.get("title", "")),
                "quantity": int(item.get("QuantityOrdered", item.get("quantity", 1))),
                "unit_price": float(
                    item.get("ItemPrice", {}).get("Amount", item.get("price", 0))
                ),
                "total_price": float(
                    item.get("ItemPrice", {}).get("Amount", item.get("price", 0))
                )
                * int(item.get("QuantityOrdered", item.get("quantity", 1))),
                "tax_amount": float(
                    item.get("ItemTax", {}).get("Amount", item.get("tax", 0))
                ),
                "discount_amount": float(
                    item.get("PromotionDiscount", {}).get(
                        "Amount", item.get("discount", 0)
                    )
                ),
            })

        is_cod = order_info.get("PaymentMethod", "") == "COD" or order_info.get(
            "is_cod", False
        )

        return MarketplaceOrder(
            marketplace_order_id=str(
                order_info.get("AmazonOrderId", order_data.get("orderId", ""))
            ),
            marketplace="AMAZON",
            order_status=order_info.get("OrderStatus", "Pending"),
            order_date=datetime.utcnow(),
            customer_name=order_info.get(
                "BuyerName",
                order_info.get("ShippingAddress", {}).get("Name", "Amazon Customer"),
            ),
            customer_email=order_info.get("BuyerEmail"),
            customer_phone=order_info.get("ShippingAddress", {}).get("Phone"),
            shipping_address=order_info.get("ShippingAddress", {}),
            items=items,
            subtotal=float(order_info.get("OrderTotal", {}).get("Amount", 0)),
            tax_amount=float(order_info.get("TaxTotal", {}).get("Amount", 0)),
            total_amount=float(order_info.get("OrderTotal", {}).get("Amount", 0)),
            is_cod=is_cod,
            payment_method="COD" if is_cod else "PREPAID",
            raw_data=payload,
        )

    def _parse_flipkart_order(self, payload: dict) -> MarketplaceOrder:
        """Parse Flipkart order webhook payload."""
        order_data = payload.get("orderDetails", payload)
        order_items_data = order_data.get("orderItems", payload.get("items", []))

        items = []
        for item in order_items_data:
            items.append({
                "marketplace_line_id": str(
                    item.get("orderItemId", item.get("id", ""))
                ),
                "marketplace_sku": item.get("listingId", item.get("sku", "")),
                "title": item.get("title", ""),
                "quantity": int(item.get("quantity", 1)),
                "unit_price": float(item.get("priceComponents", {}).get("sellingPrice", item.get("price", 0))),
                "total_price": float(item.get("priceComponents", {}).get("totalPrice", item.get("total", 0))),
                "tax_amount": float(item.get("priceComponents", {}).get("tax", item.get("tax", 0))),
                "discount_amount": float(item.get("priceComponents", {}).get("discount", item.get("discount", 0))),
            })

        is_cod = order_data.get("paymentType", "").upper() == "COD"
        dispatch_by = order_data.get("dispatchByDate") or order_data.get("sla", {}).get("dispatchByDate")

        return MarketplaceOrder(
            marketplace_order_id=str(
                order_data.get("orderId", payload.get("orderId", ""))
            ),
            marketplace="FLIPKART",
            order_status=order_data.get("status", "APPROVED"),
            order_date=datetime.utcnow(),
            customer_name=order_data.get("buyerName", "Flipkart Customer"),
            customer_phone=order_data.get("buyerPhone"),
            shipping_address=order_data.get("shippingAddress", {}),
            items=items,
            subtotal=float(order_data.get("subtotal", 0)),
            tax_amount=float(order_data.get("tax", 0)),
            total_amount=float(order_data.get("orderTotal", order_data.get("total", 0))),
            is_cod=is_cod,
            payment_method="COD" if is_cod else "PREPAID",
            ship_by_date=datetime.fromisoformat(dispatch_by) if dispatch_by else None,
            raw_data=payload,
        )

    def _parse_generic_order(self, channel: str, payload: dict) -> MarketplaceOrder:
        """Parse a generic/unknown marketplace order payload with best-effort field extraction."""
        items = []
        for item in payload.get("items", payload.get("line_items", payload.get("orderItems", []))):
            items.append({
                "marketplace_line_id": str(item.get("id", item.get("line_id", ""))),
                "marketplace_sku": item.get("sku", item.get("seller_sku", "")),
                "title": item.get("title", item.get("name", "")),
                "quantity": int(item.get("quantity", item.get("qty", 1))),
                "unit_price": float(item.get("price", item.get("unit_price", 0))),
                "total_price": float(item.get("total", item.get("total_price", 0))),
                "tax_amount": float(item.get("tax", item.get("tax_amount", 0))),
                "discount_amount": float(item.get("discount", item.get("discount_amount", 0))),
            })

        is_cod = payload.get("is_cod", False) or payload.get("payment_method", "").upper() == "COD"

        return MarketplaceOrder(
            marketplace_order_id=str(
                payload.get("order_id", payload.get("id", payload.get("orderId", "")))
            ),
            marketplace=channel.upper(),
            order_status=payload.get("status", payload.get("order_status", "NEW")),
            order_date=datetime.utcnow(),
            customer_name=payload.get(
                "customer_name",
                payload.get("customer", {}).get("name", "Unknown"),
            ),
            customer_email=payload.get(
                "customer_email",
                payload.get("customer", {}).get("email"),
            ),
            customer_phone=payload.get(
                "customer_phone",
                payload.get("customer", {}).get("phone"),
            ),
            shipping_address=payload.get("shipping_address", {}),
            billing_address=payload.get("billing_address", {}),
            items=items,
            subtotal=float(payload.get("subtotal", 0)),
            shipping_amount=float(payload.get("shipping", payload.get("shipping_amount", 0))),
            tax_amount=float(payload.get("tax", payload.get("tax_amount", 0))),
            discount_amount=float(payload.get("discount", payload.get("discount_amount", 0))),
            total_amount=float(payload.get("total", payload.get("total_amount", 0))),
            is_cod=is_cod,
            payment_method="COD" if is_cod else "PREPAID",
            raw_data=payload,
        )

    def _extract_order_id_from_payload(
        self, channel: str, payload: dict
    ) -> Optional[str]:
        """Extract the marketplace order ID from various payload formats."""
        channel_upper = (channel or "").upper()

        if channel_upper == "SHOPIFY":
            return str(payload.get("id", payload.get("order_id", ""))) or None

        if channel_upper == "AMAZON":
            return (
                payload.get("AmazonOrderId")
                or payload.get("OrderChangeNotification", {}).get(
                    "Summary", {}
                ).get("AmazonOrderId")
                or payload.get("orderId")
            )

        if channel_upper == "FLIPKART":
            return payload.get("orderId") or payload.get("orderDetails", {}).get(
                "orderId"
            )

        # Generic
        return (
            payload.get("order_id")
            or payload.get("orderId")
            or payload.get("id")
            or str(payload.get("marketplace_order_id", ""))
            or None
        )

    def _map_order_status(
        self, channel: str, payload: dict
    ) -> Optional[OrderStatus]:
        """Map marketplace status from payload to OMS OrderStatus."""
        channel_upper = (channel or "").upper()

        # Extract raw status
        raw_status = ""
        if channel_upper == "SHOPIFY":
            fulfillment = payload.get("fulfillment_status", "")
            financial = payload.get("financial_status", "")
            if payload.get("cancelled_at"):
                return OrderStatus.CANCELLED
            if fulfillment == "fulfilled":
                return OrderStatus.SHIPPED
            if fulfillment == "partial":
                return OrderStatus.PROCESSING
            if financial == "refunded":
                return OrderStatus.CANCELLED
            raw_status = fulfillment or financial or ""

        elif channel_upper == "AMAZON":
            raw_status = (
                payload.get("OrderStatus")
                or payload.get("OrderChangeNotification", {})
                .get("Summary", {})
                .get("OrderStatus", "")
            )

        elif channel_upper == "FLIPKART":
            raw_status = payload.get("status", payload.get("orderStatus", ""))

        else:
            raw_status = payload.get("status", payload.get("order_status", ""))

        # Normalize
        status_lower = raw_status.lower().strip()

        status_map = {
            "pending": OrderStatus.CREATED,
            "unshipped": OrderStatus.CONFIRMED,
            "confirmed": OrderStatus.CONFIRMED,
            "approved": OrderStatus.CONFIRMED,
            "processing": OrderStatus.PROCESSING,
            "shipped": OrderStatus.SHIPPED,
            "in_transit": OrderStatus.IN_TRANSIT,
            "out_for_delivery": OrderStatus.OUT_FOR_DELIVERY,
            "delivered": OrderStatus.DELIVERED,
            "cancelled": OrderStatus.CANCELLED,
            "canceled": OrderStatus.CANCELLED,
            "refunded": OrderStatus.CANCELLED,
        }

        return status_map.get(status_lower)

    async def _release_inventory(
        self, company_id: UUID, sku_id: UUID, qty: int
    ):
        """
        Release reserved inventory by decrementing reservedQty on Inventory records.
        """
        remaining = qty

        inventory_records = self.session.exec(
            select(Inventory)
            .where(Inventory.skuId == sku_id)
            .where(Inventory.companyId == company_id)
            .where(Inventory.reservedQty > 0)
            .order_by(Inventory.fifoSequence.desc().nulls_last())
        ).all()

        for inv in inventory_records:
            if remaining <= 0:
                break

            release_amount = min(inv.reservedQty, remaining)
            inv.reservedQty -= release_amount
            self.session.add(inv)
            remaining -= release_amount

        if remaining > 0:
            logger.warning(
                f"Could not fully release reserved inventory for SKU {sku_id} "
                f"(short by {remaining})"
            )
