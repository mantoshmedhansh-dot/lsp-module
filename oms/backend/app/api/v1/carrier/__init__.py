"""
Carrier Integration API — Frontend-facing endpoints for shipping via carriers.

Endpoints:
  POST /api/v1/carrier/ship              — Create shipment via carrier (assigns AWB)
  POST /api/v1/carrier/rates             — Get rate comparison across carriers
  GET  /api/v1/carrier/serviceability     — Check pincode serviceability
  POST /api/v1/carrier/cancel            — Cancel a shipment
  GET  /api/v1/carrier/label/{awb}       — Get shipping label
  GET  /api/v1/carrier/available         — List available carrier integrations
"""
import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel as PydanticBaseModel

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager
from app.models.user import User
from app.models.order import Order, Delivery
from app.models.transporter import Transporter, TransporterConfig
from app.models.enums import DeliveryStatus
from app.services.carriers.base import ShipmentRequest, Address, PackageItem
from app.services.carriers.factory import get_carrier_for_company, list_available_carriers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/carrier", tags=["Carrier Integration"])


# ============================================================================
# Request Schemas
# ============================================================================

class ShipViaCarrierRequest(PydanticBaseModel):
    """Ship an order/delivery via a carrier partner."""
    delivery_id: str
    carrier_code: str = "SHIPROCKET"
    # Optional overrides (pickup defaults to company's primary location)
    pickup_name: Optional[str] = None
    pickup_phone: Optional[str] = None
    pickup_address: Optional[str] = None
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    pickup_pincode: Optional[str] = None


class RateCheckRequest(PydanticBaseModel):
    """Check shipping rates for a route."""
    origin_pincode: str
    dest_pincode: str
    weight_grams: int
    payment_mode: str = "PREPAID"
    cod_amount: float = 0
    carrier_code: str = "SHIPROCKET"


class ServiceabilityRequest(PydanticBaseModel):
    origin_pincode: str
    dest_pincode: str
    carrier_code: str = "SHIPROCKET"


class CancelShipmentRequest(PydanticBaseModel):
    awb_number: str
    carrier_code: str = "SHIPROCKET"


# ============================================================================
# Ship via Carrier
# ============================================================================

@router.post("/ship")
async def ship_via_carrier(
    payload: ShipViaCarrierRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager),
):
    """
    Create a shipment via carrier (Shiprocket, Delhivery, etc.)
    Assigns AWB, generates label, and updates the delivery record.
    """
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    # Get delivery
    delivery = session.exec(
        select(Delivery).where(Delivery.id == UUID(payload.delivery_id))
    ).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Get parent order for item details
    order = None
    if delivery.orderId:
        order = session.exec(
            select(Order).where(Order.id == delivery.orderId)
        ).first()

    # Get carrier adapter
    adapter = get_carrier_for_company(
        session, current_user.companyId, payload.carrier_code
    )
    if not adapter:
        raise HTTPException(
            status_code=400,
            detail=f"No active {payload.carrier_code} integration. "
                   f"Configure credentials in Settings > Transporters."
        )

    # Build pickup address (from payload or company defaults)
    pickup = Address(
        name=payload.pickup_name or "Primary Warehouse",
        phone=payload.pickup_phone or "",
        address_line1=payload.pickup_address or "",
        city=payload.pickup_city or "",
        state=payload.pickup_state or "",
        pincode=payload.pickup_pincode or "",
    )

    # Build delivery address from order
    delivery_addr_data = {}
    if order and order.shippingAddress:
        delivery_addr_data = order.shippingAddress if isinstance(order.shippingAddress, dict) else {}

    consignee = Address(
        name=delivery_addr_data.get("name") or (order.customerName if order else ""),
        phone=delivery_addr_data.get("phone") or (order.customerPhone if order else ""),
        address_line1=delivery_addr_data.get("address1") or delivery_addr_data.get("address", ""),
        address_line2=delivery_addr_data.get("address2", ""),
        city=delivery_addr_data.get("city", ""),
        state=delivery_addr_data.get("state", ""),
        pincode=delivery_addr_data.get("pincode") or delivery_addr_data.get("zip", ""),
        email=delivery_addr_data.get("email") or (order.customerEmail if order else ""),
    )

    # Build shipment request
    weight = int((delivery.weight or 0.5) * 1000)  # kg to grams
    payment_mode = "COD" if (order and order.paymentMode and order.paymentMode.value == "COD") else "PREPAID"

    shipment_req = ShipmentRequest(
        order_id=order.orderNo if order else delivery.deliveryNo,
        company_id=str(current_user.companyId),
        pickup=pickup,
        delivery=consignee,
        weight_grams=weight,
        length_cm=delivery.dimensions.get("length", 10) if delivery.dimensions else 10,
        breadth_cm=delivery.dimensions.get("breadth", 10) if delivery.dimensions else 10,
        height_cm=delivery.dimensions.get("height", 10) if delivery.dimensions else 10,
        payment_mode=payment_mode,
        cod_amount=float(order.totalAmount or 0) if (order and payment_mode == "COD") else 0,
        invoice_value=float(order.totalAmount or 0) if order else 0,
    )

    # Call carrier API
    response = await adapter.create_shipment(shipment_req)

    if not response.success and not response.awb_number:
        raise HTTPException(
            status_code=502,
            detail=f"Carrier returned error: {response.error}"
        )

    # Update delivery with AWB and tracking info
    if response.awb_number:
        delivery.awbNo = response.awb_number
        delivery.trackingUrl = response.tracking_url
        delivery.labelUrl = response.label_url
        delivery.status = DeliveryStatus.MANIFESTED
        session.add(delivery)

    return {
        "success": response.success,
        "awb_number": response.awb_number,
        "tracking_url": response.tracking_url,
        "label_url": response.label_url,
        "carrier_order_id": response.carrier_order_id,
        "error": response.error,
    }


# ============================================================================
# Rate Comparison
# ============================================================================

@router.post("/rates")
async def check_rates(
    payload: RateCheckRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get shipping rates from carrier for a given route."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    adapter = get_carrier_for_company(
        session, current_user.companyId, payload.carrier_code
    )
    if not adapter:
        raise HTTPException(
            status_code=400,
            detail=f"No active {payload.carrier_code} integration"
        )

    result = await adapter.get_rates(
        origin_pincode=payload.origin_pincode,
        dest_pincode=payload.dest_pincode,
        weight_grams=payload.weight_grams,
        payment_mode=payload.payment_mode,
        cod_amount=payload.cod_amount,
    )

    if not result.success:
        raise HTTPException(status_code=502, detail=result.error)

    return {
        "quotes": [
            {
                "carrier_code": q.carrier_code,
                "carrier_name": q.carrier_name,
                "rate": q.rate,
                "cod_charges": q.cod_charges,
                "estimated_days": q.estimated_days,
                "service_type": q.service_type,
            }
            for q in result.quotes
        ],
        "count": len(result.quotes),
    }


# ============================================================================
# Serviceability Check
# ============================================================================

@router.post("/serviceability")
async def check_serviceability(
    payload: ServiceabilityRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Check if delivery is possible between two pincodes."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    adapter = get_carrier_for_company(
        session, current_user.companyId, payload.carrier_code
    )
    if not adapter:
        raise HTTPException(
            status_code=400,
            detail=f"No active {payload.carrier_code} integration"
        )

    result = await adapter.check_serviceability(
        payload.origin_pincode, payload.dest_pincode
    )

    return {
        "is_serviceable": result.is_serviceable,
        "cod_available": result.cod_available,
        "prepaid_available": result.prepaid_available,
        "estimated_days": result.estimated_days,
    }


# ============================================================================
# Cancel Shipment
# ============================================================================

@router.post("/cancel")
async def cancel_shipment(
    payload: CancelShipmentRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager),
):
    """Cancel a shipment via carrier API."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    adapter = get_carrier_for_company(
        session, current_user.companyId, payload.carrier_code
    )
    if not adapter:
        raise HTTPException(status_code=400, detail=f"No active {payload.carrier_code} integration")

    success = await adapter.cancel_shipment(payload.awb_number)
    if not success:
        raise HTTPException(status_code=502, detail="Carrier cancel failed")

    # Update delivery status
    delivery = session.exec(
        select(Delivery).where(Delivery.awbNo == payload.awb_number)
    ).first()
    if delivery:
        delivery.status = DeliveryStatus.CANCELLED
        session.add(delivery)

    return {"success": True, "awb_number": payload.awb_number}


# ============================================================================
# Get Label
# ============================================================================

@router.get("/label/{awb_number}")
async def get_shipping_label(
    awb_number: str,
    carrier_code: str = "SHIPROCKET",
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get shipping label PDF URL for an AWB."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    adapter = get_carrier_for_company(
        session, current_user.companyId, carrier_code
    )
    if not adapter:
        raise HTTPException(status_code=400, detail=f"No active {carrier_code} integration")

    label_url = await adapter.get_label(awb_number)
    if not label_url:
        raise HTTPException(status_code=404, detail="Label not available")

    return {"awb_number": awb_number, "label_url": label_url}


# ============================================================================
# Available Carriers
# ============================================================================

@router.get("/available")
def get_available_carriers(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all carriers with active adapters and company configs."""
    implemented = list_available_carriers()

    # Get company's configured carriers
    configs = []
    if current_user.companyId:
        configs = session.exec(
            select(TransporterConfig).where(
                TransporterConfig.companyId == current_user.companyId,
                TransporterConfig.isActive == True,
            )
        ).all()

    configured_transporter_ids = {c.transporterId for c in configs}

    # Get transporter details
    transporters = session.exec(
        select(Transporter).where(Transporter.isActive == True)
    ).all()

    result = []
    for t in transporters:
        result.append({
            "code": t.code,
            "name": t.name,
            "type": t.type.value if hasattr(t.type, 'value') else t.type,
            "api_adapter_available": t.code.upper() in implemented,
            "configured_for_company": t.id in configured_transporter_ids,
            "api_enabled": t.apiEnabled,
        })

    return {
        "carriers": result,
        "implemented_adapters": implemented,
    }
