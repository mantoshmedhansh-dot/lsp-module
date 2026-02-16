"""
Inventory Alerts Handlers (Batch 5)

T25: inventory.low_stock → auto-create draft PurchaseOrder
T26: inventory.low_stock → email admin about low stock
T27: inventory.channel_changed → push to specific channel
"""
import logging
from datetime import datetime
from uuid import UUID

from sqlmodel import Session, select

from app.services.event_dispatcher import on

logger = logging.getLogger("event_handlers.inventory_alerts")


# ── T25: inventory.low_stock → auto-create draft PurchaseOrder ──────────

@on("inventory.low_stock")
def handle_low_stock_po(payload: dict, session: Session):
    """If SKU has reorderLevel, auto-create draft PurchaseOrder."""
    from app.models import SKU
    from app.models.procurement import PurchaseOrder, PurchaseOrderItem

    sku_id = UUID(payload["skuId"])
    company_id = UUID(payload["companyId"])
    location_id = payload.get("locationId")
    current_qty = payload.get("currentQty", 0)

    sku = session.get(SKU, sku_id)
    if not sku:
        return

    reorder_level = getattr(sku, "reorderLevel", None) or 0
    reorder_qty = getattr(sku, "reorderQty", None) or getattr(sku, "minOrderQty", 50)

    if reorder_level <= 0:
        return  # No reorder configured

    if current_qty > reorder_level:
        return  # Not actually low

    # Check if draft PO already exists for this SKU
    existing = session.exec(
        select(PurchaseOrder).where(
            PurchaseOrder.companyId == company_id,
            PurchaseOrder.status == "DRAFT",
        )
    ).all()

    # Look for existing PO item for this SKU
    for po in existing:
        po_item = session.exec(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.purchaseOrderId == po.id,
                PurchaseOrderItem.skuId == sku_id,
            )
        ).first()
        if po_item:
            logger.info(f"Draft PO already has SKU {sku.code}, skipping")
            return

    # Create new draft PO
    today = datetime.utcnow().strftime("%Y%m%d")
    po = PurchaseOrder(
        poNo=f"PO-AUTO-{today}-{sku.code}",
        companyId=company_id,
        locationId=UUID(location_id) if location_id else None,
        status="DRAFT",
        remarks=f"Auto-generated: {sku.code} below reorder level ({current_qty}/{reorder_level})",
    )
    session.add(po)
    session.flush()

    po_item = PurchaseOrderItem(
        purchaseOrderId=po.id,
        skuId=sku_id,
        quantity=reorder_qty,
        unitPrice=getattr(sku, "costPrice", 0) or 0,
    )
    session.add(po_item)

    logger.info(
        f"Auto-created draft PO {po.poNo} for SKU {sku.code}: "
        f"qty={reorder_qty} (current={current_qty}, reorder_level={reorder_level})"
    )


# ── T26: inventory.low_stock → email admin ──────────────────────────────

@on("inventory.low_stock")
def handle_low_stock_alert(payload: dict, session: Session):
    """Email admin users about low stock SKU."""
    from app.models import SKU
    from app.models.user import User

    sku_id = UUID(payload["skuId"])
    company_id = UUID(payload["companyId"])
    current_qty = payload.get("currentQty", 0)
    location_name = payload.get("locationName", "")

    sku = session.get(SKU, sku_id)
    if not sku:
        return

    reorder_level = getattr(sku, "reorderLevel", None) or 0

    # Find admin users for company
    admins = session.exec(
        select(User).where(
            User.companyId == company_id,
            User.role.in_(["ADMIN", "SUPER_ADMIN", "MANAGER"]),
            User.isActive == True,
        )
    ).all()

    if not admins:
        return

    from app.services.notification_service import NotificationService
    notifier = NotificationService(session)

    for admin in admins:
        notifier.send_notification(
            trigger="LOW_STOCK_ALERT",
            recipient=admin.email,
            company_id=company_id,
            channel="EMAIL",
            variables={
                "skuCode": sku.code,
                "skuName": sku.name,
                "currentQty": str(current_qty),
                "reorderLevel": str(reorder_level),
                "locationName": location_name,
            },
        )

    logger.info(f"Low stock alert sent for SKU {sku.code} to {len(admins)} admin(s)")


# ── T27: inventory.channel_changed → push to channel ────────────────────

@on("inventory.channel_changed")
def handle_channel_sync(payload: dict, session: Session):
    """Push inventory to specific channel after channel allocation change."""
    company_id = UUID(payload["companyId"])
    sku_id = payload.get("skuId")
    channel = payload.get("channel")

    if not sku_id:
        return

    try:
        from app.services.inventory.push_engine import InventoryPushEngine
        engine = InventoryPushEngine(session)
        engine.push_sku(
            company_id=company_id,
            sku_id=UUID(sku_id),
            channel=channel,
        )
        logger.info(f"Channel inventory sync for SKU {sku_id} → {channel}")
    except Exception as e:
        logger.warning(f"Channel sync failed for SKU {sku_id}: {e}")
