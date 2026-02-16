"""
Returns → WMS/Finance Pipeline Handlers (Batch 2)

T7:  return.received → auto-create GoodsReceipt
T8:  return.qc_passed → auto-post GRN (restock inventory)
T9:  return.qc_passed → auto-create refund ledger entry
T10: delivery.rto_delivered → auto-create RTO Return + GRN
"""
import logging
from datetime import datetime
from uuid import UUID

from sqlmodel import Session, select

from app.services.event_dispatcher import on, dispatch

logger = logging.getLogger("event_handlers.returns_wms")


# ── T7: return.received → auto-create GoodsReceipt ──────────────────────

@on("return.received")
def handle_return_received(payload: dict, session: Session):
    """Auto-create GoodsReceipt + GoodsReceiptItems from Return."""
    from app.models import (
        Return, ReturnItem, ReturnType,
    )
    from app.models.goods_receipt import GoodsReceipt, GoodsReceiptItem

    return_id = UUID(payload["returnId"])
    company_id = UUID(payload["companyId"])

    ret = session.get(Return, return_id)
    if not ret:
        return

    # Skip if GRN already exists
    if ret.goodsReceiptId:
        logger.info(f"Return {ret.returnNo} already has GRN, skipping")
        return

    location_id = ret.locationId
    if not location_id:
        logger.warning(f"Return {ret.returnNo} has no locationId, skipping GRN creation")
        return

    # Generate GRN
    grn_no = f"GRN-RET-{ret.returnNo or str(return_id)[:8]}"
    inbound_source = "RETURN_RTO" if ret.type == ReturnType.RTO else "RETURN_SALES"

    grn = GoodsReceipt(
        grNo=grn_no,
        companyId=company_id,
        locationId=location_id,
        returnId=return_id,
        inboundSource=inbound_source,
        status="PENDING",
        remarks=f"Auto-created from Return {ret.returnNo}",
    )
    session.add(grn)
    session.flush()

    # Create GRN items
    return_items = session.exec(
        select(ReturnItem).where(ReturnItem.returnId == return_id)
    ).all()

    for ri in return_items:
        grn_item = GoodsReceiptItem(
            goodsReceiptId=grn.id,
            skuId=ri.skuId,
            expectedQty=ri.quantity,
            receivedQty=ri.receivedQty or ri.quantity,
            acceptedQty=ri.receivedQty or ri.quantity,
            binId=getattr(ri, "destinationBinId", None),
            batchNo=getattr(ri, "batchNo", None),
            lotNo=getattr(ri, "lotNo", None),
            status="PENDING",
        )
        session.add(grn_item)

    ret.goodsReceiptId = grn.id
    session.add(ret)

    logger.info(f"Auto-created GRN {grn_no} for return {ret.returnNo}")


# ── T8: return.qc_passed → auto-post GRN (restock inventory) ────────────

@on("return.qc_passed")
def handle_return_qc_restock(payload: dict, session: Session):
    """Post the GoodsReceipt to auto-add stock back to inventory."""
    from app.models import (
        Return, ReturnItem, Inventory,
    )
    from app.models.goods_receipt import GoodsReceipt, GoodsReceiptItem

    return_id = UUID(payload["returnId"])
    company_id = UUID(payload["companyId"])

    ret = session.get(Return, return_id)
    if not ret or not ret.goodsReceiptId:
        return

    grn = session.get(GoodsReceipt, ret.goodsReceiptId)
    if not grn or grn.status == "POSTED":
        return  # Already posted

    grn_items = session.exec(
        select(GoodsReceiptItem).where(GoodsReceiptItem.goodsReceiptId == grn.id)
    ).all()

    for item in grn_items:
        accepted_qty = item.acceptedQty or item.receivedQty or 0
        if accepted_qty <= 0:
            continue

        # Find or create inventory entry
        inv_query = select(Inventory).where(
            Inventory.skuId == item.skuId,
            Inventory.companyId == company_id,
            Inventory.locationId == grn.locationId,
        )
        if item.binId:
            inv_query = inv_query.where(Inventory.binId == item.binId)

        inv = session.exec(inv_query).first()

        if inv:
            inv.quantity = (inv.quantity or 0) + accepted_qty
            inv.availableQty = (inv.availableQty or 0) + accepted_qty
            session.add(inv)
        else:
            inv = Inventory(
                companyId=company_id,
                locationId=grn.locationId,
                skuId=item.skuId,
                binId=item.binId,
                quantity=accepted_qty,
                availableQty=accepted_qty,
                reservedQty=0,
                batchNo=item.batchNo,
                lotNo=item.lotNo,
            )
            session.add(inv)

        item.status = "POSTED"
        session.add(item)

    grn.status = "POSTED"
    grn.postedAt = datetime.utcnow()
    session.add(grn)

    logger.info(f"Auto-posted GRN {grn.grNo} → inventory restocked")


# ── T9: return.qc_passed → auto-create refund ledger entry ──────────────

@on("return.qc_passed")
def handle_return_qc_refund(payload: dict, session: Session):
    """Auto-create PaymentLedger debit entry for refund amount."""
    from app.models import Return, ReturnItem
    from app.models.finance import PaymentLedger

    return_id = UUID(payload["returnId"])
    company_id = UUID(payload["companyId"])

    ret = session.get(Return, return_id)
    if not ret:
        return

    # Calculate refund amount from return items
    return_items = session.exec(
        select(ReturnItem).where(ReturnItem.returnId == return_id)
    ).all()

    refund_amount = sum(
        float(getattr(ri, "refundAmount", 0) or 0) or
        float(getattr(ri, "unitPrice", 0) or 0) * (ri.quantity or 0)
        for ri in return_items
    )

    if refund_amount <= 0:
        return

    # Check if refund ledger entry already exists
    existing = session.exec(
        select(PaymentLedger).where(
            PaymentLedger.referenceType == "RETURN",
            PaymentLedger.referenceId == str(return_id),
            PaymentLedger.companyId == company_id,
        )
    ).first()
    if existing:
        return

    ledger = PaymentLedger(
        companyId=company_id,
        referenceType="RETURN",
        referenceId=str(return_id),
        type="DEBIT",
        amount=refund_amount,
        description=f"Return refund for {ret.returnNo}",
        status="PENDING",
    )
    session.add(ledger)

    ret.status = "REFUND_INITIATED" if hasattr(ret, "status") else ret.status
    session.add(ret)

    logger.info(f"Auto-created refund ledger entry for return {ret.returnNo}: {refund_amount}")


# ── T10: delivery.rto_delivered → auto-create RTO Return + GRN ──────────

@on("delivery.rto_delivered")
def handle_rto_inventory(payload: dict, session: Session):
    """Auto-create Return (type=RTO) + chain into T7/T8 flow."""
    from app.models import (
        Order, Delivery, Return, ReturnItem, ReturnType, ReturnStatus,
        OrderItem,
    )

    delivery_id = UUID(payload["deliveryId"])
    company_id = UUID(payload["companyId"])

    delivery = session.exec(
        select(Delivery).where(Delivery.id == delivery_id)
    ).first()
    if not delivery:
        return

    order = session.get(Order, delivery.orderId) if delivery.orderId else None
    if not order:
        return

    # Check if RTO return already exists
    existing = session.exec(
        select(Return).where(
            Return.orderId == order.id,
            Return.type == ReturnType.RTO,
        )
    ).first()
    if existing:
        logger.info(f"RTO return already exists for order {order.orderNo}")
        return

    # Create RTO return
    ret = Return(
        returnNo=f"RTO-{order.orderNo}",
        orderId=order.id,
        deliveryId=delivery.id,
        companyId=company_id,
        type=ReturnType.RTO,
        status=ReturnStatus.RECEIVED,
        reason="RTO - Return to Origin",
        locationId=order.locationId,
        receivedAt=datetime.utcnow(),
    )
    session.add(ret)
    session.flush()

    # Create return items from order items
    order_items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order.id)
    ).all()

    for oi in order_items:
        ri = ReturnItem(
            returnId=ret.id,
            skuId=oi.skuId,
            quantity=oi.quantity,
            receivedQty=oi.quantity,
        )
        session.add(ri)

    logger.info(f"Auto-created RTO return {ret.returnNo}")

    # Chain into return.received flow
    dispatch("return.received", {
        "returnId": str(ret.id),
        "companyId": str(company_id),
    })
