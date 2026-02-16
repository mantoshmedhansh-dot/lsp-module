"""
Marketplace Outbound Sync Handlers (Batch 4)

T18: delivery.shipped → push tracking to marketplace
T19: return.processed → push return status to marketplace
T20: inventory.updated → push inventory to marketplace channel
"""
import logging
from uuid import UUID

from sqlmodel import Session, select

from app.services.event_dispatcher import on

logger = logging.getLogger("event_handlers.marketplace_sync")


# ── T18: delivery.shipped → push tracking to marketplace ────────────────

@on("delivery.shipped")
def handle_push_tracking(payload: dict, session: Session):
    """Push AWB/tracking to marketplace for the order's channel."""
    from app.models import Order
    from app.models.marketplace_integration import MarketplaceConnection
    from app.models.channels import MktpOrderSync

    order_id = payload.get("orderId")
    company_id = UUID(payload["companyId"])
    awb_number = payload.get("awbNumber", "")
    carrier_code = payload.get("carrierCode", "")

    if not order_id:
        return

    order = session.get(Order, UUID(order_id))
    if not order:
        return

    # Only for marketplace orders (not MANUAL)
    channel = order.channel.value if hasattr(order.channel, "value") else str(order.channel)
    if channel in ("MANUAL", "DIRECT"):
        return

    # Find marketplace connection
    connection = session.exec(
        select(MarketplaceConnection).where(
            MarketplaceConnection.companyId == company_id,
            MarketplaceConnection.marketplace == channel,
            MarketplaceConnection.isActive == True,
        )
    ).first()

    if not connection:
        logger.info(f"No active marketplace connection for {channel}, skipping tracking push")
        return

    # Try to push via adapter
    try:
        from app.services.marketplaces.adapter_factory import get_adapter
        adapter = get_adapter(connection)
        if adapter and hasattr(adapter, "update_fulfillment"):
            import asyncio
            asyncio.run(adapter.update_fulfillment(
                order_ref=order.externalOrderNo or order.orderNo,
                awb=awb_number,
                carrier=carrier_code,
            ))
            logger.info(f"Pushed tracking to {channel} for order {order.orderNo}")
    except Exception as e:
        logger.warning(f"Marketplace tracking push failed ({channel}): {e}")

    # Log sync record
    sync = MktpOrderSync(
        companyId=company_id,
        connectionId=connection.id,
        orderId=order.id,
        syncType="TRACKING_PUSH",
        status="SUCCESS",
        externalRef=order.externalOrderNo,
        details={"awb": awb_number, "carrier": carrier_code},
    )
    session.add(sync)


# ── T19: return.processed → push return status to marketplace ────────────

@on("return.processed")
def handle_push_return_status(payload: dict, session: Session):
    """Push return completion to marketplace."""
    from app.models import Return, Order
    from app.models.marketplace_integration import MarketplaceConnection

    return_id = UUID(payload["returnId"])
    company_id = UUID(payload["companyId"])

    ret = session.get(Return, return_id)
    if not ret or not ret.orderId:
        return

    order = session.get(Order, ret.orderId)
    if not order:
        return

    channel = order.channel.value if hasattr(order.channel, "value") else str(order.channel)
    if channel in ("MANUAL", "DIRECT"):
        return

    connection = session.exec(
        select(MarketplaceConnection).where(
            MarketplaceConnection.companyId == company_id,
            MarketplaceConnection.marketplace == channel,
            MarketplaceConnection.isActive == True,
        )
    ).first()

    if not connection:
        return

    try:
        from app.services.marketplaces.adapter_factory import get_adapter
        adapter = get_adapter(connection)
        if adapter and hasattr(adapter, "update_return"):
            import asyncio
            asyncio.run(adapter.update_return(
                return_ref=ret.returnNo,
                status=ret.status.value if hasattr(ret.status, "value") else str(ret.status),
            ))
            logger.info(f"Pushed return status to {channel} for return {ret.returnNo}")
    except Exception as e:
        logger.warning(f"Marketplace return push failed ({channel}): {e}")


# ── T20: inventory.updated → push inventory to channel ──────────────────

@on("inventory.updated")
def handle_push_inventory(payload: dict, session: Session):
    """Trigger immediate inventory push for the specific SKU+location."""
    company_id = UUID(payload["companyId"])
    sku_id = payload.get("skuId")
    location_id = payload.get("locationId")

    if not sku_id:
        return

    try:
        from app.services.inventory.push_engine import InventoryPushEngine
        engine = InventoryPushEngine(session)
        engine.push_sku(
            company_id=company_id,
            sku_id=UUID(sku_id),
            location_id=UUID(location_id) if location_id else None,
        )
        logger.info(f"Immediate inventory push for SKU {sku_id}")
    except Exception as e:
        logger.warning(f"Inventory push failed for SKU {sku_id}: {e}")
