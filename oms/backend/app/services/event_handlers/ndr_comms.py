"""
NDR Communications Handlers (Batch 4)

T21: ndr.created → send WhatsApp/SMS to customer
T22: ndr.created → AI auto-execute if confidence ≥ 0.90
T23: ndr.rto_decided → auto-create RTO shipment
T24: ndr.resolved → cascade status to Delivery + Order
"""
import logging
from datetime import datetime
from uuid import UUID

from sqlmodel import Session, select

from app.services.event_dispatcher import on

logger = logging.getLogger("event_handlers.ndr_comms")


# ── T21: ndr.created → customer communication ───────────────────────────

@on("ndr.created")
def handle_ndr_customer_comm(payload: dict, session: Session):
    """Send WhatsApp/SMS to customer about NDR. Create NDROutreach record."""
    from app.models import Order, NDR
    from app.models.ndr import NDROutreach

    ndr_id = UUID(payload["ndrId"])
    company_id = UUID(payload["companyId"])

    ndr = session.get(NDR, ndr_id)
    if not ndr or not ndr.orderId:
        return

    order = session.get(Order, ndr.orderId)
    if not order:
        return

    customer_phone = order.customerPhone
    if not customer_phone:
        logger.info(f"NDR {ndr.ndrCode}: no customer phone, skipping comm")
        return

    ndr_reason = ndr.reason.value if hasattr(ndr.reason, "value") else str(ndr.reason)

    # Send notification
    from app.services.notification_service import NotificationService
    notifier = NotificationService(session)

    variables = {
        "orderNo": order.orderNo,
        "customerName": order.customerName or "",
        "ndrReason": ndr_reason,
        "attemptNumber": str(ndr.attemptNumber or 1),
        "ndrCode": ndr.ndrCode,
    }

    notifier.send_notification(
        trigger="NDR_CREATED",
        recipient=customer_phone,
        company_id=company_id,
        channel="WHATSAPP",
        variables=variables,
        order_id=order.id,
        delivery_id=ndr.deliveryId,
    )

    # Create NDROutreach record
    outreach = NDROutreach(
        ndrId=ndr_id,
        channel="WHATSAPP",
        status="SENT",
        messageContent=f"NDR Alert: Order {order.orderNo} delivery failed - {ndr_reason}",
        attemptNumber=ndr.attemptNumber or 1,
    )
    session.add(outreach)

    logger.info(f"Sent NDR comm for {ndr.ndrCode} to {customer_phone}")


# ── T22: ndr.created → AI auto-execute ──────────────────────────────────

@on("ndr.created")
def handle_ndr_ai_auto_execute(payload: dict, session: Session):
    """If AI confidence ≥ 0.90, auto-execute recommended action."""
    from app.models.ndr import NDR, AIActionLog
    from app.models.enums import AIActionType, AIActionStatus, NDRStatus

    ndr_id = UUID(payload["ndrId"])

    ndr = session.get(NDR, ndr_id)
    if not ndr:
        return

    # Check for AI classification with high confidence
    ai_action = session.exec(
        select(AIActionLog).where(
            AIActionLog.ndrId == ndr_id,
            AIActionLog.actionType == AIActionType.NDR_CLASSIFICATION,
        ).order_by(AIActionLog.createdAt.desc())
    ).first()

    if not ai_action or (ai_action.confidence or 0) < 0.90:
        logger.info(f"NDR {ndr.ndrCode}: AI confidence < 0.90, manual review needed")
        return

    # Auto-execute: if reattempt recommended, schedule reattempt
    decision = (ai_action.decision or "").lower()
    if "reattempt" in decision:
        ndr.status = NDRStatus.REATTEMPT_SCHEDULED
        ndr.actionTaken = "AUTO_REATTEMPT"
        session.add(ndr)
        logger.info(f"NDR {ndr.ndrCode}: AI auto-scheduled reattempt (confidence={ai_action.confidence})")
    elif "rto" in decision:
        ndr.status = NDRStatus.RTO
        ndr.actionTaken = "AUTO_RTO"
        session.add(ndr)
        logger.info(f"NDR {ndr.ndrCode}: AI auto-initiated RTO (confidence={ai_action.confidence})")

    # Log auto-execution
    exec_log = AIActionLog(
        actionType=AIActionType.NDR_RESOLUTION,
        entityType="NDR",
        entityId=str(ndr.id),
        ndrId=ndr.id,
        companyId=ndr.companyId,
        decision=f"Auto-executed: {ndr.actionTaken}",
        reasoning=f"AI confidence {ai_action.confidence} >= 0.90 threshold",
        confidence=ai_action.confidence,
        riskLevel=ai_action.riskLevel,
        status=AIActionStatus.EXECUTED,
        approvalRequired=False,
        executedAt=datetime.utcnow(),
    )
    session.add(exec_log)


# ── T23: ndr.rto_decided → auto-create RTO shipment ─────────────────────

@on("ndr.rto_decided")
def handle_auto_rto_shipment(payload: dict, session: Session):
    """Initiate RTO with carrier, update Delivery status."""
    from app.models import Delivery
    from app.models.ndr import NDR
    from app.models.enums import DeliveryStatus

    ndr_id = UUID(payload["ndrId"])
    company_id = UUID(payload["companyId"])

    ndr = session.get(NDR, ndr_id)
    if not ndr or not ndr.deliveryId:
        return

    delivery = session.get(Delivery, ndr.deliveryId)
    if not delivery:
        return

    # Update delivery status
    delivery.status = DeliveryStatus.RTO_INITIATED
    delivery.remarks = f"RTO initiated from NDR {ndr.ndrCode}"
    session.add(delivery)

    # Try to call carrier RTO API
    if delivery.transporterId and delivery.awbNo:
        from app.models.transporter import Transporter
        transporter = session.get(Transporter, delivery.transporterId)
        if transporter and transporter.apiEnabled:
            try:
                from app.services.carriers.factory import get_carrier_for_company
                adapter = get_carrier_for_company(session, company_id, transporter.code)
                if adapter and hasattr(adapter, "initiate_rto"):
                    import asyncio
                    asyncio.run(adapter.initiate_rto(delivery.awbNo))
                    logger.info(f"RTO initiated with carrier {transporter.code} for AWB {delivery.awbNo}")
            except Exception as e:
                logger.warning(f"Carrier RTO API failed: {e}")

    logger.info(f"Delivery {delivery.deliveryNo} → RTO_INITIATED from NDR {ndr.ndrCode}")


# ── T24: ndr.resolved → cascade to Delivery + Order ─────────────────────

@on("ndr.resolved")
def handle_ndr_resolved_cascade(payload: dict, session: Session):
    """Cascade NDR resolution to Delivery and Order status."""
    from app.models import Order, Delivery
    from app.models.ndr import NDR
    from app.models.enums import DeliveryStatus, OrderStatus, ResolutionType

    ndr_id = UUID(payload["ndrId"])
    resolution_type = payload.get("resolutionType", "")

    ndr = session.get(NDR, ndr_id)
    if not ndr:
        return

    delivery = session.get(Delivery, ndr.deliveryId) if ndr.deliveryId else None
    order = session.get(Order, ndr.orderId) if ndr.orderId else None

    if resolution_type == "DELIVERED" or resolution_type == ResolutionType.DELIVERED.value:
        if delivery:
            delivery.status = DeliveryStatus.DELIVERED
            delivery.deliveryDate = datetime.utcnow()
            session.add(delivery)
        if order:
            order.status = OrderStatus.DELIVERED
            order.updatedAt = datetime.utcnow()
            session.add(order)
        logger.info(f"NDR {ndr.ndrCode} resolved as DELIVERED")

    elif resolution_type == "RTO" or resolution_type == "RTO_INITIATED":
        if delivery:
            delivery.status = DeliveryStatus.RTO_INITIATED
            session.add(delivery)
        logger.info(f"NDR {ndr.ndrCode} resolved as RTO")
