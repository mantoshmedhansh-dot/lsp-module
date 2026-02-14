"""
Shipping API — Rate check, label, manifest, pickup, and bulk operations.
"""
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Order, Delivery, DeliveryResponse, User,
    OrderStatus, DeliveryStatus,
)
from app.models.transporter import (
    Transporter, TransporterConfig, Manifest, ManifestCreate, ManifestStatus,
)
from app.services.shipping_service import ShippingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shipping", tags=["Shipping"])


# ── Request/Response Schemas ──────────────────────────────────────────────


class RateCheckRequest(BaseModel):
    originPincode: str
    destPincode: str
    weightGrams: int = 500
    paymentMode: str = "PREPAID"
    codAmount: float = 0


class BulkAssignCarrierRequest(BaseModel):
    deliveryIds: List[str]
    carrierCode: str


class CreateManifestRequest(BaseModel):
    deliveryIds: List[str]
    transporterId: str


class PickupRequest(BaseModel):
    manifestId: str


class BulkGenerateLabelsRequest(BaseModel):
    deliveryIds: List[str]


# ── Rate Check ────────────────────────────────────────────────────────────


@router.post("/rate-check")
async def rate_check(
    body: RateCheckRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Multi-carrier rate comparison."""
    service = ShippingService(session)
    result = await service.get_rates(
        company_id=company_filter.company_id,
        origin_pincode=body.originPincode,
        dest_pincode=body.destPincode,
        weight_grams=body.weightGrams,
        payment_mode=body.paymentMode,
        cod_amount=body.codAmount,
    )
    return result


# ── Labels ────────────────────────────────────────────────────────────────


@router.get("/label/{awb_no}")
async def get_label(
    awb_no: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get label URL for a shipment (from DB or fresh from carrier)."""
    delivery = session.exec(
        select(Delivery).where(Delivery.awbNo == awb_no)
    ).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Return cached label if available
    if delivery.labelUrl:
        return {"labelUrl": delivery.labelUrl, "awbNo": awb_no}

    # Try to fetch from carrier
    if delivery.transporterId:
        from app.services.carriers.factory import get_carrier_for_company
        transporter = session.get(Transporter, delivery.transporterId)
        if transporter:
            adapter = get_carrier_for_company(session, company_filter.company_id, transporter.code)
            if adapter:
                try:
                    label_url = await adapter.get_label(awb_no)
                    if label_url:
                        delivery.labelUrl = label_url
                        session.add(delivery)
                        session.commit()
                        return {"labelUrl": label_url, "awbNo": awb_no}
                except Exception as e:
                    logger.warning(f"Label fetch failed for {awb_no}: {e}")

    raise HTTPException(status_code=404, detail="Label not available")


@router.post("/bulk-generate-labels")
async def bulk_generate_labels(
    body: BulkGenerateLabelsRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get labels for multiple deliveries."""
    results = []
    for did in body.deliveryIds:
        delivery = session.get(Delivery, UUID(did))
        if not delivery or not delivery.awbNo:
            results.append({"deliveryId": did, "labelUrl": None, "error": "No AWB"})
            continue

        if delivery.labelUrl:
            results.append({"deliveryId": did, "labelUrl": delivery.labelUrl, "awbNo": delivery.awbNo})
            continue

        # Try carrier API
        if delivery.transporterId:
            transporter = session.get(Transporter, delivery.transporterId)
            if transporter:
                from app.services.carriers.factory import get_carrier_for_company
                adapter = get_carrier_for_company(session, company_filter.company_id, transporter.code)
                if adapter:
                    try:
                        label_url = await adapter.get_label(delivery.awbNo)
                        if label_url:
                            delivery.labelUrl = label_url
                            session.add(delivery)
                            results.append({"deliveryId": did, "labelUrl": label_url, "awbNo": delivery.awbNo})
                            continue
                    except Exception:
                        pass

        results.append({"deliveryId": did, "labelUrl": None, "error": "Label not available"})

    session.commit()
    return {"labels": results}


# ── Manifests ─────────────────────────────────────────────────────────────


@router.get("/manifests")
def list_manifests(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List manifests with delivery counts, carrier info, status."""
    query = select(Manifest).where(Manifest.companyId == company_filter.company_id)

    if status_filter:
        try:
            query = query.where(Manifest.status == ManifestStatus(status_filter))
        except ValueError:
            pass

    query = query.order_by(Manifest.createdAt.desc()).offset(skip).limit(limit)
    manifests = session.exec(query).all()

    result = []
    for m in manifests:
        delivery_count = session.exec(
            select(func.count(Delivery.id)).where(Delivery.manifestId == m.id)
        ).one()
        transporter = session.get(Transporter, m.transporterId) if m.transporterId else None

        result.append({
            "id": str(m.id),
            "manifestNo": m.manifestNo,
            "status": m.status.value if hasattr(m.status, "value") else str(m.status),
            "transporterName": transporter.name if transporter else None,
            "transporterCode": transporter.code if transporter else None,
            "deliveryCount": delivery_count,
            "vehicleNo": m.vehicleNo,
            "driverName": m.driverName,
            "driverPhone": m.driverPhone,
            "confirmedAt": m.confirmedAt.isoformat() if m.confirmedAt else None,
            "createdAt": m.createdAt.isoformat() if m.createdAt else None,
        })

    # Total count
    count_query = select(func.count(Manifest.id)).where(
        Manifest.companyId == company_filter.company_id
    )
    if status_filter:
        try:
            count_query = count_query.where(Manifest.status == ManifestStatus(status_filter))
        except ValueError:
            pass
    total = session.exec(count_query).one()

    return {"manifests": result, "total": total}


@router.post("/manifest")
def create_manifest(
    body: CreateManifestRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
):
    """Create manifest grouping delivery IDs by carrier."""
    if not body.deliveryIds:
        raise HTTPException(status_code=400, detail="No deliveries provided")

    transporter_id = UUID(body.transporterId)
    transporter = session.get(Transporter, transporter_id)
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")

    now = datetime.utcnow()
    manifest_no = f"MAN-{now.strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:4].upper()}"

    manifest = Manifest(
        manifestNo=manifest_no,
        transporterId=transporter_id,
        companyId=company_filter.company_id,
        status=ManifestStatus.OPEN,
    )
    session.add(manifest)
    session.flush()

    # Assign deliveries to manifest
    assigned = 0
    for did in body.deliveryIds:
        delivery = session.get(Delivery, UUID(did))
        if delivery and delivery.companyId == company_filter.company_id:
            delivery.manifestId = manifest.id
            delivery.status = DeliveryStatus.MANIFESTED
            session.add(delivery)
            assigned += 1

    session.commit()
    session.refresh(manifest)

    return {
        "id": str(manifest.id),
        "manifestNo": manifest.manifestNo,
        "status": manifest.status.value,
        "transporterName": transporter.name,
        "deliveriesAssigned": assigned,
    }


@router.post("/manifest/{manifest_id}/close")
async def close_manifest(
    manifest_id: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
):
    """Close manifest, mark as ready for handover."""
    manifest = session.get(Manifest, UUID(manifest_id))
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    if manifest.companyId != company_filter.company_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if manifest.status != ManifestStatus.OPEN:
        raise HTTPException(status_code=400, detail=f"Manifest is already {manifest.status.value}")

    manifest.status = ManifestStatus.CLOSED
    manifest.confirmedAt = datetime.utcnow()
    session.add(manifest)
    session.commit()

    return {"id": str(manifest.id), "status": "CLOSED"}


# ── Pickup ────────────────────────────────────────────────────────────────


@router.post("/pickup")
async def request_pickup(
    body: PickupRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
):
    """Request carrier pickup for a manifest's AWBs."""
    manifest = session.get(Manifest, UUID(body.manifestId))
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    if manifest.companyId != company_filter.company_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get deliveries in this manifest
    deliveries = session.exec(
        select(Delivery).where(Delivery.manifestId == manifest.id)
    ).all()
    awb_numbers = [d.awbNo for d in deliveries if d.awbNo]

    if not awb_numbers:
        raise HTTPException(status_code=400, detail="No AWBs in this manifest")

    # Get carrier adapter
    transporter = session.get(Transporter, manifest.transporterId)
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")

    from app.services.carriers.factory import get_carrier_for_company
    adapter = get_carrier_for_company(session, company_filter.company_id, transporter.code)
    if not adapter:
        raise HTTPException(status_code=400, detail="Carrier not configured")

    try:
        result = await adapter.request_pickup(awb_numbers)
    except NotImplementedError:
        result = {"message": "Pickup request not supported by this carrier"}
    except Exception as e:
        logger.error(f"Pickup request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pickup request failed: {str(e)}")

    # Update manifest status
    manifest.status = ManifestStatus.HANDED_OVER
    session.add(manifest)
    session.commit()

    return {"success": True, "manifestId": str(manifest.id), "awbCount": len(awb_numbers), **result}


# ── Bulk Assign Carrier ──────────────────────────────────────────────────


@router.post("/bulk-assign-carrier")
def bulk_assign_carrier(
    body: BulkAssignCarrierRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
):
    """Assign a carrier to multiple deliveries at once."""
    transporter = session.exec(
        select(Transporter).where(Transporter.code == body.carrierCode.upper())
    ).first()
    if not transporter:
        raise HTTPException(status_code=404, detail=f"Carrier {body.carrierCode} not found")

    updated = 0
    for did in body.deliveryIds:
        delivery = session.get(Delivery, UUID(did))
        if delivery and delivery.companyId == company_filter.company_id:
            delivery.transporterId = transporter.id
            session.add(delivery)
            updated += 1

    session.commit()
    return {"updated": updated, "carrier": transporter.name}


# ── Tracking Timeline ─────────────────────────────────────────────────────


@router.get("/tracking-timeline/{delivery_id}")
async def tracking_timeline(
    delivery_id: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get tracking event timeline for a delivery."""
    delivery = session.get(Delivery, UUID(delivery_id))
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if not delivery.awbNo:
        return {
            "deliveryId": delivery_id,
            "awbNo": None,
            "events": [],
            "currentStatus": delivery.status.value if hasattr(delivery.status, "value") else str(delivery.status),
        }

    service = ShippingService(session)
    result = await service.get_tracking(delivery.awbNo, company_filter.company_id)
    result["deliveryId"] = delivery_id
    return result


# ── Unmanifested Deliveries ──────────────────────────────────────────────


@router.get("/unmanifested")
def list_unmanifested_deliveries(
    carrier_code: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List deliveries that are shipped but not yet in a manifest."""
    query = select(Delivery).where(
        Delivery.companyId == company_filter.company_id,
        Delivery.manifestId == None,
        Delivery.awbNo != None,
    )

    if carrier_code:
        transporter = session.exec(
            select(Transporter).where(Transporter.code == carrier_code.upper())
        ).first()
        if transporter:
            query = query.where(Delivery.transporterId == transporter.id)

    query = query.order_by(Delivery.createdAt.desc()).offset(skip).limit(limit)
    deliveries = session.exec(query).all()

    result = []
    for d in deliveries:
        order = session.exec(select(Order).where(Order.id == d.orderId)).first()
        transporter = session.get(Transporter, d.transporterId) if d.transporterId else None

        result.append({
            "id": str(d.id),
            "deliveryNo": d.deliveryNo,
            "awbNo": d.awbNo,
            "orderNo": order.orderNo if order else None,
            "customerName": order.customerName if order else None,
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "carrierCode": transporter.code if transporter else None,
            "carrierName": transporter.name if transporter else None,
            "weight": float(d.weight) if d.weight else None,
            "shipDate": d.shipDate.isoformat() if d.shipDate else None,
            "labelUrl": d.labelUrl,
        })

    return {"deliveries": result}


# ── All Deliveries (Enhanced) ────────────────────────────────────────────


@router.get("/deliveries")
def list_all_deliveries(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    carrier_code: Optional[str] = None,
    payment_mode: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Enhanced delivery list with filters for the shipping dashboard."""
    query = select(Delivery).where(Delivery.companyId == company_filter.company_id)

    if status_filter:
        try:
            query = query.where(Delivery.status == DeliveryStatus(status_filter))
        except ValueError:
            pass

    if carrier_code:
        transporter = session.exec(
            select(Transporter).where(Transporter.code == carrier_code.upper())
        ).first()
        if transporter:
            query = query.where(Delivery.transporterId == transporter.id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Delivery.deliveryNo.ilike(pattern)) |
            (Delivery.awbNo.ilike(pattern))
        )

    if date_from:
        try:
            query = query.where(Delivery.createdAt >= datetime.fromisoformat(date_from))
        except ValueError:
            pass

    if date_to:
        try:
            query = query.where(Delivery.createdAt <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    # Count
    count_q = select(func.count(Delivery.id)).where(Delivery.companyId == company_filter.company_id)
    if status_filter:
        try:
            count_q = count_q.where(Delivery.status == DeliveryStatus(status_filter))
        except ValueError:
            pass
    total = session.exec(count_q).one()

    query = query.order_by(Delivery.createdAt.desc()).offset(skip).limit(limit)
    deliveries = session.exec(query).all()

    result = []
    for d in deliveries:
        order = session.exec(select(Order).where(Order.id == d.orderId)).first()
        transporter = session.get(Transporter, d.transporterId) if d.transporterId else None

        result.append({
            "id": str(d.id),
            "deliveryNo": d.deliveryNo,
            "awbNo": d.awbNo,
            "orderNo": order.orderNo if order else None,
            "orderId": str(order.id) if order else None,
            "customerName": order.customerName if order else None,
            "paymentMode": order.paymentMode.value if order and hasattr(order.paymentMode, "value") else None,
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "carrierCode": transporter.code if transporter else None,
            "carrierName": transporter.name if transporter else None,
            "weight": float(d.weight) if d.weight else None,
            "boxes": d.boxes,
            "labelUrl": d.labelUrl,
            "trackingUrl": d.trackingUrl,
            "shipDate": d.shipDate.isoformat() if d.shipDate else None,
            "deliveryDate": d.deliveryDate.isoformat() if d.deliveryDate else None,
            "manifestId": str(d.manifestId) if d.manifestId else None,
            "createdAt": d.createdAt.isoformat() if d.createdAt else None,
        })

    return {"deliveries": result, "total": total, "page": skip // limit + 1, "totalPages": (total + limit - 1) // limit}
