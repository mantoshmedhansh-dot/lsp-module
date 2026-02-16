"""
Order Fulfillment Pipeline Handlers (Batch 1 + Batch 6 T35)

T1: order.confirmed → auto-allocate inventory
T2: order.allocated → auto-add to wave
T3: wave.released → auto-generate picklists
T4: picklist.completed → auto-update order status
T5: order.packed → auto-add to manifest
T6: manifest.closed → auto-ship via carrier
T35: order.ready_to_ship → auto-rate comparison
"""
import logging
from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Session, select, func

from app.services.event_dispatcher import on, dispatch

logger = logging.getLogger("event_handlers.order_fulfillment")

WAVE_AUTO_SIZE = 10  # Orders per auto-wave before auto-release


# ── T1: order.confirmed → auto-allocate inventory ────────────────────────

@on("order.confirmed")
def handle_order_confirmed(payload: dict, session: Session):
    """Auto-allocate inventory when order is confirmed."""
    from app.models import (
        Order, OrderItem, OrderStatus, ItemStatus,
        AllocationRequest, SKU,
    )
    from app.services.inventory_allocation import InventoryAllocationService

    order_id = UUID(payload["orderId"])
    company_id = UUID(payload["companyId"])

    order = session.get(Order, order_id)
    if not order or order.status != OrderStatus.CONFIRMED:
        return

    order_items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order_id)
    ).all()
    if not order_items:
        return

    allocation_service = InventoryAllocationService(session)
    all_allocated = True

    for item in order_items:
        already = item.allocatedQty or 0
        remaining = item.quantity - already
        if remaining <= 0:
            continue

        request = AllocationRequest(
            skuId=item.skuId,
            requiredQty=remaining,
            locationId=order.locationId,
            orderId=order.id,
            orderItemId=item.id,
        )

        result = allocation_service.allocate_inventory(
            request=request,
            company_id=company_id,
            allocated_by_id=None,
        )

        item.allocatedQty = already + result.allocatedQty
        if result.allocatedQty >= remaining:
            item.status = ItemStatus.ALLOCATED
        else:
            all_allocated = False
        session.add(item)

    if all_allocated and order_items:
        order.status = OrderStatus.ALLOCATED
        order.updatedAt = datetime.utcnow()
        session.add(order)
        logger.info(f"Order {order.orderNo} fully allocated")
        # Chain dispatch — will run in the SAME session commit
        # but dispatch will create new session for the next handler
    else:
        order.status = OrderStatus.PARTIALLY_ALLOCATED
        order.updatedAt = datetime.utcnow()
        session.add(order)
        logger.info(f"Order {order.orderNo} partially allocated")

    # Flush so the commit happens, then chain-dispatch after commit
    session.flush()

    if all_allocated:
        dispatch("order.allocated", {
            "orderId": str(order_id),
            "companyId": str(company_id),
            "locationId": str(order.locationId),
        })


# ── T2: order.allocated → auto-add to wave ──────────────────────────────

@on("order.allocated")
def handle_order_allocated(payload: dict, session: Session):
    """Find or create a DRAFT wave and add the order to it."""
    from app.models import (
        Wave, WaveOrder, WaveStatus, WaveType, Location,
    )

    order_id = UUID(payload["orderId"])
    company_id = UUID(payload["companyId"])
    location_id = UUID(payload["locationId"])

    # Find open DRAFT wave for same location
    wave = session.exec(
        select(Wave).where(
            Wave.locationId == location_id,
            Wave.companyId == company_id,
            Wave.status == WaveStatus.DRAFT,
        ).order_by(Wave.createdAt.desc())
    ).first()

    if not wave:
        today = datetime.utcnow().strftime("%Y%m%d")
        existing = session.exec(
            select(Wave.waveNo).where(Wave.waveNo.like(f"WAVE-{today}-%"))
        ).all()
        max_num = 0
        for wn in existing:
            try:
                num = int(wn.split("-")[-1])
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                pass

        wave = Wave(
            waveNo=f"WAVE-{today}-{max_num + 1:03d}",
            locationId=location_id,
            companyId=company_id,
            status=WaveStatus.DRAFT,
            type=WaveType.NORMAL,
        )
        session.add(wave)
        session.flush()
        logger.info(f"Created auto-wave {wave.waveNo}")

    # Check if order already in this wave
    existing_wo = session.exec(
        select(WaveOrder).where(
            WaveOrder.waveId == wave.id,
            WaveOrder.orderId == order_id,
        )
    ).first()
    if existing_wo:
        return

    # Get next sequence number
    max_seq = session.exec(
        select(func.max(WaveOrder.sequence)).where(WaveOrder.waveId == wave.id)
    ).one() or 0

    wo = WaveOrder(
        waveId=wave.id,
        orderId=order_id,
        sequence=max_seq + 1,
    )
    session.add(wo)
    session.flush()

    # Count orders in wave
    order_count = session.exec(
        select(func.count(WaveOrder.id)).where(WaveOrder.waveId == wave.id)
    ).one()

    logger.info(f"Added order to wave {wave.waveNo} ({order_count}/{WAVE_AUTO_SIZE})")

    if order_count >= WAVE_AUTO_SIZE:
        wave.status = WaveStatus.RELEASED
        wave.releasedAt = datetime.utcnow()
        session.add(wave)
        logger.info(f"Auto-released wave {wave.waveNo} (threshold {WAVE_AUTO_SIZE})")
        dispatch("wave.released", {
            "waveId": str(wave.id),
            "companyId": str(company_id),
            "locationId": str(location_id),
        })


# ── T3: wave.released → auto-generate picklists ─────────────────────────

@on("wave.released")
def handle_wave_released(payload: dict, session: Session):
    """Generate picklists for all orders in the released wave."""
    from app.models import (
        Wave, WaveOrder, Order, OrderItem, Picklist, PicklistItem,
        PicklistStatus, OrderStatus, WaveStatus, Location,
        AllocationRequest, Bin, SKU,
    )
    from app.services.inventory_allocation import InventoryAllocationService

    wave_id = UUID(payload["waveId"])
    company_id = UUID(payload["companyId"])

    wave = session.get(Wave, wave_id)
    if not wave:
        return

    wave_orders = session.exec(
        select(WaveOrder).where(WaveOrder.waveId == wave_id)
    ).all()
    if not wave_orders:
        return

    allocation_service = InventoryAllocationService(session)

    for wo in wave_orders:
        order = session.get(Order, wo.orderId)
        if not order:
            continue

        order_items = session.exec(
            select(OrderItem).where(OrderItem.orderId == order.id)
        ).all()
        if not order_items:
            continue

        # Generate picklist number
        pl_count = session.exec(select(func.count(Picklist.id))).one()
        picklist = Picklist(
            picklistNo=f"PL-{pl_count + 1:06d}",
            orderId=order.id,
            status=PicklistStatus.PENDING,
            companyId=company_id,
        )
        session.add(picklist)
        session.flush()

        has_items = False
        for item in order_items:
            request = AllocationRequest(
                skuId=item.skuId,
                requiredQty=item.quantity,
                locationId=wave.locationId,
                orderId=order.id,
                orderItemId=item.id,
                waveId=wave_id,
                picklistId=picklist.id,
            )
            result = allocation_service.allocate_inventory(
                request=request,
                company_id=company_id,
                allocated_by_id=None,
            )

            if result.allocatedQty > 0:
                has_items = True
                for alloc in result.allocations:
                    pi = PicklistItem(
                        picklistId=picklist.id,
                        skuId=alloc.skuId,
                        binId=alloc.binId,
                        requiredQty=alloc.allocatedQty,
                        pickedQty=0,
                    )
                    session.add(pi)

        if not has_items:
            session.delete(picklist)
        else:
            order.status = OrderStatus.PICKLIST_GENERATED
            order.updatedAt = datetime.utcnow()
            session.add(order)

    logger.info(f"Picklists generated for wave {wave.waveNo}")


# ── T4: picklist.completed → auto-update order to PICKED ────────────────

@on("picklist.completed")
def handle_picklist_completed(payload: dict, session: Session):
    """When all picklists for an order are done, mark order as PICKED."""
    from app.models import (
        Order, Picklist, PicklistStatus, OrderStatus,
    )

    order_id = UUID(payload["orderId"])

    # Check if ALL picklists for this order are COMPLETED
    pending = session.exec(
        select(func.count(Picklist.id)).where(
            Picklist.orderId == order_id,
            Picklist.status != PicklistStatus.COMPLETED,
        )
    ).one()

    if pending > 0:
        return  # Still have incomplete picklists

    order = session.get(Order, order_id)
    if not order:
        return

    if order.status in [OrderStatus.PICKING, OrderStatus.PICKLIST_GENERATED, OrderStatus.ALLOCATED]:
        order.status = OrderStatus.PICKED
        order.updatedAt = datetime.utcnow()
        session.add(order)
        logger.info(f"Order {order.orderNo} → PICKED (all picklists completed)")


# ── T5: order.packed → auto-add to manifest ──────────────────────────────

@on("order.packed")
def handle_order_packed(payload: dict, session: Session):
    """Find or create manifest for the order's transporter, add delivery."""
    from app.models import (
        Order, Delivery, DeliveryStatus,
    )
    from app.models.transporter import Manifest, ManifestStatus

    order_id = UUID(payload["orderId"])
    company_id = UUID(payload["companyId"])
    delivery_id = payload.get("deliveryId")

    if not delivery_id:
        # Find delivery for this order
        delivery = session.exec(
            select(Delivery).where(
                Delivery.orderId == order_id,
                Delivery.companyId == company_id,
            ).order_by(Delivery.createdAt.desc())
        ).first()
    else:
        delivery = session.get(Delivery, UUID(delivery_id))

    if not delivery:
        logger.warning(f"No delivery found for packed order {order_id}")
        return

    if not delivery.transporterId:
        logger.info(f"Delivery {delivery.deliveryNo} has no transporter — skipping auto-manifest")
        return

    # Find open manifest for same transporter + company
    manifest = session.exec(
        select(Manifest).where(
            Manifest.transporterId == delivery.transporterId,
            Manifest.companyId == company_id,
            Manifest.status == ManifestStatus.OPEN,
        ).order_by(Manifest.createdAt.desc())
    ).first()

    if not manifest:
        now = datetime.utcnow()
        manifest = Manifest(
            manifestNo=f"MAN-{now.strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:4].upper()}",
            transporterId=delivery.transporterId,
            companyId=company_id,
            status=ManifestStatus.OPEN,
        )
        session.add(manifest)
        session.flush()
        logger.info(f"Created auto-manifest {manifest.manifestNo}")

    delivery.manifestId = manifest.id
    delivery.status = DeliveryStatus.MANIFESTED
    session.add(delivery)

    # Update order status
    order = session.get(Order, order_id)
    if order:
        from app.models import OrderStatus
        order.status = OrderStatus.MANIFESTED
        order.updatedAt = datetime.utcnow()
        session.add(order)

    logger.info(f"Delivery {delivery.deliveryNo} → manifest {manifest.manifestNo}")


# ── T6: manifest.closed → auto-ship via carrier ─────────────────────────

@on("manifest.closed")
def handle_manifest_closed(payload: dict, session: Session):
    """For each delivery in manifest, attempt carrier booking."""
    from app.models import (
        Delivery, DeliveryStatus, Order, OrderStatus, Location,
    )
    from app.models.transporter import Manifest, Transporter
    import asyncio

    manifest_id = UUID(payload["manifestId"])
    company_id = UUID(payload["companyId"])

    manifest = session.get(Manifest, manifest_id)
    if not manifest:
        return

    deliveries = session.exec(
        select(Delivery).where(Delivery.manifestId == manifest_id)
    ).all()

    if not deliveries:
        return

    transporter = session.get(Transporter, manifest.transporterId) if manifest.transporterId else None
    if not transporter or not transporter.apiEnabled:
        logger.info(f"Manifest {manifest.manifestNo}: carrier API not enabled, skipping auto-ship")
        return

    from app.services.shipping_service import ShippingService
    service = ShippingService(session)

    for delivery in deliveries:
        if delivery.awbNo:
            continue  # Already has AWB

        order = session.get(Order, delivery.orderId)
        if not order:
            continue

        try:
            result = asyncio.run(service.ship_order(
                order_id=order.id,
                carrier_code=transporter.code,
                company_id=company_id,
                weight_grams=int((float(delivery.weight or 0.5)) * 1000),
            ))

            if result.get("success"):
                logger.info(f"Auto-shipped {delivery.deliveryNo} → AWB {result.get('awbNumber')}")
                dispatch("shipment.created", {
                    "deliveryId": str(delivery.id),
                    "orderId": str(order.id),
                    "companyId": str(company_id),
                    "awbNumber": result.get("awbNumber", ""),
                    "carrierCode": transporter.code,
                })
            else:
                logger.warning(f"Auto-ship failed for {delivery.deliveryNo}: {result.get('error')}")
        except Exception as e:
            logger.error(f"Auto-ship error for {delivery.deliveryNo}: {e}")


# ── T35: order.ready_to_ship → auto-rate comparison ─────────────────────

@on("order.ready_to_ship")
def handle_auto_rate_comparison(payload: dict, session: Session):
    """Call ShippingService.get_rates() and set recommended transporter."""
    from app.models import Order, Location
    from app.models.transporter import Transporter
    import asyncio

    order_id = UUID(payload["orderId"])
    company_id = UUID(payload["companyId"])

    order = session.get(Order, order_id)
    if not order:
        return

    location = session.get(Location, order.locationId)
    if not location:
        return

    loc_addr = location.address if isinstance(location.address, dict) else {}
    origin_pincode = loc_addr.get("pincode", "")
    ship_addr = order.shippingAddress or {}
    dest_pincode = ship_addr.get("pincode", "")

    if not origin_pincode or not dest_pincode:
        return

    payment_mode = order.paymentMode.value if hasattr(order.paymentMode, "value") else str(order.paymentMode)
    cod_amount = float(order.totalAmount) if payment_mode == "COD" else 0

    from app.services.shipping_service import ShippingService
    service = ShippingService(session)

    try:
        result = asyncio.run(service.get_rates(
            company_id=company_id,
            origin_pincode=origin_pincode,
            dest_pincode=dest_pincode,
            weight_grams=500,
            payment_mode=payment_mode,
            cod_amount=cod_amount,
        ))

        quotes = result.get("quotes", [])
        if quotes:
            best = quotes[0]  # Already sorted cheapest first
            carrier_code = best.get("carrierCode", "")
            transporter = session.exec(
                select(Transporter).where(Transporter.code == carrier_code.upper())
            ).first()
            if transporter:
                order.recommendedTransporterId = transporter.id
                session.add(order)
                logger.info(f"Order {order.orderNo}: recommended carrier {carrier_code} (rate {best.get('rate')})")
    except Exception as e:
        logger.warning(f"Auto rate comparison failed for order {order_id}: {e}")
