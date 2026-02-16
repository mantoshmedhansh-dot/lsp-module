"""
Finance Automation Handlers (Batch 3)

T11: delivery.delivered → auto-create CODTransaction (if COD)
T12: delivery.delivered → auto-generate customer Invoice
T13: shipment.created → auto-calculate freight from RateCard
T14: cod.remittance_received → auto-reconcile COD transactions
T16: shipment.weight_checked → auto-create WeightDiscrepancy
T36: delivery.delivered / delivery.rto_delivered → guaranteed analytics
"""
import logging
from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Session, select, func

from app.services.event_dispatcher import on

logger = logging.getLogger("event_handlers.finance_automation")


# ── T11: delivery.delivered → auto-create CODTransaction ─────────────────

@on("delivery.delivered")
def handle_cod_transaction(payload: dict, session: Session):
    """If order is COD, auto-create CODTransaction with PENDING status."""
    from app.models import Order
    from app.models.finance import CODTransaction

    order_id = payload.get("orderId")
    company_id = UUID(payload["companyId"])
    delivery_id = payload.get("deliveryId")

    if not order_id:
        return

    order = session.get(Order, UUID(order_id))
    if not order:
        return

    payment_mode = order.paymentMode.value if hasattr(order.paymentMode, "value") else str(order.paymentMode)
    if payment_mode != "COD":
        return

    # Check if already exists
    existing = session.exec(
        select(CODTransaction).where(
            CODTransaction.orderId == order.id,
            CODTransaction.companyId == company_id,
        )
    ).first()
    if existing:
        return

    cod = CODTransaction(
        companyId=company_id,
        orderId=order.id,
        deliveryId=UUID(delivery_id) if delivery_id else None,
        amount=float(order.totalAmount or 0),
        status="PENDING",
        expectedDate=datetime.utcnow(),
    )
    session.add(cod)
    logger.info(f"Auto-created COD transaction for order {order.orderNo}: {cod.amount}")


# ── T12: delivery.delivered → auto-generate Invoice ──────────────────────

@on("delivery.delivered")
def handle_auto_invoice(payload: dict, session: Session):
    """Auto-generate customer Invoice with line items from OrderItems."""
    from app.models import Order, OrderItem, OrderStatus
    from app.models.finance import Invoice, InvoiceItem

    order_id = payload.get("orderId")
    company_id = UUID(payload["companyId"])

    if not order_id:
        return

    order = session.get(Order, UUID(order_id))
    if not order:
        return

    # Skip if invoice already exists
    if order.invoiceNo:
        return

    # Check if Invoice model table exists
    existing_inv = session.exec(
        select(Invoice).where(
            Invoice.orderId == order.id,
            Invoice.companyId == company_id,
        )
    ).first()
    if existing_inv:
        return

    order_items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order.id)
    ).all()

    today = datetime.utcnow().strftime("%Y%m%d")
    inv_count = session.exec(select(func.count(Invoice.id))).one() or 0
    invoice_no = f"INV-{today}-{inv_count + 1:04d}"

    subtotal = sum(float(item.unitPrice or 0) * item.quantity for item in order_items)
    tax_total = sum(float(item.taxAmount or 0) for item in order_items)
    discount_total = sum(float(item.discount or 0) for item in order_items)

    invoice = Invoice(
        companyId=company_id,
        orderId=order.id,
        invoiceNo=invoice_no,
        invoiceDate=datetime.utcnow(),
        customerName=order.customerName,
        customerPhone=order.customerPhone,
        customerEmail=order.customerEmail,
        shippingAddress=order.shippingAddress,
        subtotal=subtotal,
        taxAmount=tax_total,
        discount=discount_total,
        totalAmount=float(order.totalAmount or 0),
        status="GENERATED",
    )
    session.add(invoice)
    session.flush()

    for item in order_items:
        from app.models import SKU
        sku = session.get(SKU, item.skuId)
        inv_item = InvoiceItem(
            invoiceId=invoice.id,
            skuId=item.skuId,
            skuCode=sku.code if sku else None,
            skuName=sku.name if sku else getattr(item, "skuName", None),
            quantity=item.quantity,
            unitPrice=float(item.unitPrice or 0),
            taxAmount=float(item.taxAmount or 0),
            discount=float(item.discount or 0),
            totalPrice=float(item.totalPrice or 0),
        )
        session.add(inv_item)

    # Update order
    order.invoiceNo = invoice_no
    order.invoiceDate = datetime.utcnow()
    session.add(order)

    logger.info(f"Auto-generated invoice {invoice_no} for order {order.orderNo}")


# ── T13: shipment.created → auto-calculate freight ──────────────────────

@on("shipment.created")
def handle_freight_calculation(payload: dict, session: Session):
    """Query RateCard for carrier+weight+zone, store as shippingCharge on Delivery."""
    from app.models import Delivery, Order, Location
    from app.models.transporter import Transporter, RateCard, RateCardSlab

    delivery_id = payload.get("deliveryId")
    company_id = UUID(payload["companyId"])
    carrier_code = payload.get("carrierCode", "")

    if not delivery_id:
        return

    delivery = session.get(Delivery, UUID(delivery_id))
    if not delivery:
        return

    # Get order for address info
    order = session.get(Order, delivery.orderId) if delivery.orderId else None
    if not order:
        return

    # Find rate card for this carrier
    transporter = session.exec(
        select(Transporter).where(Transporter.code == carrier_code.upper())
    ).first() if carrier_code else None

    if not transporter:
        if delivery.transporterId:
            transporter = session.get(Transporter, delivery.transporterId)
        if not transporter:
            return

    rate_card = session.exec(
        select(RateCard).where(
            RateCard.transporterId == transporter.id,
            RateCard.companyId == company_id,
            RateCard.isActive == True,
        )
    ).first()

    if not rate_card:
        logger.info(f"No active rate card for {transporter.code}, skipping freight calc")
        return

    # Calculate weight in kg
    weight_kg = float(delivery.weight or 0.5)

    # Find matching slab
    slab = session.exec(
        select(RateCardSlab).where(
            RateCardSlab.rateCardId == rate_card.id,
            RateCardSlab.minWeight <= weight_kg,
            RateCardSlab.maxWeight >= weight_kg,
        )
    ).first()

    if slab:
        freight = float(slab.rate or 0)
        delivery.shippingCharge = freight
        session.add(delivery)
        logger.info(f"Calculated freight for delivery {delivery.deliveryNo}: {freight}")
    else:
        logger.info(f"No matching rate slab for weight {weight_kg}kg")


# ── T14: cod.remittance_received → auto-reconcile ───────────────────────

@on("cod.remittance_received")
def handle_cod_reconcile(payload: dict, session: Session):
    """Match CODTransactions with remittance, update status to COLLECTED."""
    from app.models.finance import CODTransaction

    company_id = UUID(payload["companyId"])
    remittance_amount = float(payload.get("amount", 0))
    transaction_ids = payload.get("transactionIds", [])

    if transaction_ids:
        # Match specific transactions
        for tid in transaction_ids:
            txn = session.get(CODTransaction, UUID(tid))
            if txn and txn.companyId == company_id and txn.status == "PENDING":
                txn.status = "COLLECTED"
                txn.collectedAt = datetime.utcnow()
                session.add(txn)
        logger.info(f"Reconciled {len(transaction_ids)} COD transactions")
    elif remittance_amount > 0:
        # FIFO matching — oldest pending first
        pending = session.exec(
            select(CODTransaction).where(
                CODTransaction.companyId == company_id,
                CODTransaction.status == "PENDING",
            ).order_by(CODTransaction.createdAt)
        ).all()

        remaining = remittance_amount
        matched = 0
        for txn in pending:
            if remaining <= 0:
                break
            if txn.amount <= remaining:
                txn.status = "COLLECTED"
                txn.collectedAt = datetime.utcnow()
                session.add(txn)
                remaining -= txn.amount
                matched += 1

        logger.info(f"FIFO reconciled {matched} COD transactions, remaining: {remaining}")


# ── T16: shipment.weight_checked → auto-create WeightDiscrepancy ────────

@on("shipment.weight_checked")
def handle_weight_discrepancy(payload: dict, session: Session):
    """Compare declared vs charged weight, create discrepancy if threshold exceeded."""
    from app.models import Delivery
    from app.models.finance import WeightDiscrepancy

    delivery_id = UUID(payload["deliveryId"])
    company_id = UUID(payload["companyId"])
    charged_weight = float(payload.get("chargedWeight", 0))
    threshold_pct = float(payload.get("threshold", 10))  # 10% default

    delivery = session.get(Delivery, delivery_id)
    if not delivery:
        return

    declared_weight = float(delivery.weight or 0)
    if declared_weight <= 0 or charged_weight <= 0:
        return

    diff_pct = abs(charged_weight - declared_weight) / declared_weight * 100

    if diff_pct > threshold_pct:
        existing = session.exec(
            select(WeightDiscrepancy).where(
                WeightDiscrepancy.deliveryId == delivery_id,
                WeightDiscrepancy.companyId == company_id,
            )
        ).first()
        if existing:
            return

        disc = WeightDiscrepancy(
            companyId=company_id,
            deliveryId=delivery_id,
            orderId=delivery.orderId,
            declaredWeight=declared_weight,
            chargedWeight=charged_weight,
            discrepancy=charged_weight - declared_weight,
            discrepancyPct=round(diff_pct, 2),
            status="OPEN",
        )
        session.add(disc)
        logger.info(
            f"Weight discrepancy for delivery {delivery.deliveryNo}: "
            f"declared={declared_weight}kg, charged={charged_weight}kg ({diff_pct:.1f}%)"
        )


# ── T36-37: delivery.delivered / rto_delivered → guaranteed analytics ────

@on("delivery.delivered")
def handle_guaranteed_analytics_delivered(payload: dict, session: Session):
    """Run analytics aggregation on delivery completion."""
    _run_analytics(payload, session)


@on("delivery.rto_delivered")
def handle_guaranteed_analytics_rto(payload: dict, session: Session):
    """Run analytics aggregation on RTO delivery."""
    _run_analytics(payload, session)


def _run_analytics(payload: dict, session: Session):
    """Aggregate delivery analytics for the company."""
    from app.services.analytics_aggregator import AnalyticsAggregator

    company_id = payload.get("companyId")
    delivery_id = payload.get("deliveryId")
    transporter_id = payload.get("transporterId")

    if not company_id:
        return

    try:
        aggregator = AnalyticsAggregator(session)
        aggregator.aggregate_delivery(
            company_id=UUID(company_id),
            delivery_id=UUID(delivery_id) if delivery_id else None,
            transporter_id=UUID(transporter_id) if transporter_id else None,
        )
        logger.info(f"Analytics aggregated for delivery {delivery_id}")
    except Exception as e:
        logger.warning(f"Analytics aggregation failed (will retry via scheduler): {e}")
