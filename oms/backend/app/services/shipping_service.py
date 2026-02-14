"""
Shipping Service — Centralized service for carrier interaction logic.
Wires existing carrier adapters into the order fulfillment flow.
"""
import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.models import (
    Order, Delivery, DeliveryCreate, Location,
    OrderStatus, DeliveryStatus,
)
from app.models.transporter import Transporter, TransporterConfig, Manifest, ManifestStatus
from app.services.carriers.base import (
    Address, ShipmentRequest, PackageItem,
    ShipmentResponse, TrackingResponse, RateResponse, RateQuote,
)
from app.services.carriers.factory import (
    get_carrier_adapter, get_carrier_for_company, CARRIER_REGISTRY,
)

logger = logging.getLogger(__name__)


class ShippingService:
    """Encapsulates all carrier interaction logic for shipping orders."""

    def __init__(self, session: Session):
        self.session = session

    async def ship_order(
        self,
        order_id: UUID,
        carrier_code: str,
        company_id: UUID,
        weight_grams: int = 500,
        length_cm: float = 10,
        breadth_cm: float = 10,
        height_cm: float = 10,
    ) -> Dict[str, Any]:
        """
        Ship an order via the selected carrier.
        Creates a Delivery record, calls carrier API, updates order status.
        """
        # Load order
        order = self.session.exec(
            select(Order).where(Order.id == order_id)
        ).first()
        if not order:
            return {"success": False, "error": "Order not found"}

        # Validate order status
        shippable = [
            OrderStatus.PACKED, OrderStatus.INVOICED, OrderStatus.MANIFESTED,
        ]
        if order.status not in shippable:
            return {
                "success": False,
                "error": f"Order in {order.status.value} status cannot be shipped. Must be PACKED/INVOICED/MANIFESTED.",
            }

        # Get carrier adapter for company
        adapter = get_carrier_for_company(self.session, company_id, carrier_code)
        if not adapter:
            return {
                "success": False,
                "error": f"Carrier {carrier_code} not configured or no credentials for this company",
            }

        # Get origin location
        location = self.session.exec(
            select(Location).where(Location.id == order.locationId)
        ).first()
        if not location:
            return {"success": False, "error": "Order location not found"}

        # Build addresses
        loc_addr = location.address if isinstance(location.address, dict) else {}
        pickup = Address(
            name=loc_addr.get("name", location.name),
            phone=loc_addr.get("phone", ""),
            address_line1=loc_addr.get("line1", loc_addr.get("address", "")),
            city=loc_addr.get("city", ""),
            state=loc_addr.get("state", ""),
            pincode=loc_addr.get("pincode", ""),
        )

        ship_addr = order.shippingAddress or {}
        delivery_addr = Address(
            name=ship_addr.get("name", order.customerName),
            phone=order.customerPhone,
            address_line1=ship_addr.get("line1", ""),
            city=ship_addr.get("city", ""),
            state=ship_addr.get("state", ""),
            pincode=ship_addr.get("pincode", ""),
            email=order.customerEmail or "",
        )

        # Build shipment request
        payment_mode = order.paymentMode.value if hasattr(order.paymentMode, "value") else str(order.paymentMode)
        cod_amount = float(order.totalAmount) if payment_mode == "COD" else 0

        request = ShipmentRequest(
            order_id=str(order.id),
            company_id=str(company_id),
            pickup=pickup,
            delivery=delivery_addr,
            weight_grams=weight_grams,
            length_cm=length_cm,
            breadth_cm=breadth_cm,
            height_cm=height_cm,
            payment_mode=payment_mode,
            cod_amount=cod_amount,
            invoice_value=float(order.totalAmount),
            product_description=f"Order {order.orderNo}",
        )

        # Call carrier API
        try:
            response: ShipmentResponse = await adapter.create_shipment(request)
        except Exception as e:
            logger.error(f"Carrier API error for {carrier_code}: {e}")
            return {"success": False, "error": f"Carrier API error: {str(e)}"}

        if not response.success:
            return {"success": False, "error": response.error or "Carrier rejected shipment"}

        # Find transporter record
        transporter = self.session.exec(
            select(Transporter).where(Transporter.code == carrier_code.upper())
        ).first()

        # Generate delivery number
        now = datetime.utcnow()
        delivery_no = f"DLV-{now.strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:4].upper()}"

        # Create Delivery record
        delivery = Delivery(
            deliveryNo=delivery_no,
            orderId=order.id,
            companyId=company_id,
            transporterId=transporter.id if transporter else None,
            status=DeliveryStatus.SHIPPED,
            awbNo=response.awb_number,
            trackingUrl=response.tracking_url,
            labelUrl=response.label_url,
            weight=Decimal(str(weight_grams / 1000)),
            length=Decimal(str(length_cm)),
            width=Decimal(str(breadth_cm)),
            height=Decimal(str(height_cm)),
            shipDate=now,
        )
        self.session.add(delivery)

        # Update order status
        order.status = OrderStatus.SHIPPED
        order.updatedAt = now
        self.session.add(order)

        self.session.commit()
        self.session.refresh(delivery)

        return {
            "success": True,
            "deliveryId": str(delivery.id),
            "deliveryNo": delivery.deliveryNo,
            "awbNumber": response.awb_number,
            "trackingUrl": response.tracking_url,
            "labelUrl": response.label_url,
            "carrierOrderId": response.carrier_order_id,
            "carrier": carrier_code,
        }

    async def get_rates(
        self,
        company_id: UUID,
        origin_pincode: str,
        dest_pincode: str,
        weight_grams: int,
        payment_mode: str = "PREPAID",
        cod_amount: float = 0,
    ) -> Dict[str, Any]:
        """
        Get rate quotes from all active carriers in parallel.
        Returns sorted quotes (cheapest first).
        """
        # Get all active carrier configs for this company
        configs = self.session.exec(
            select(TransporterConfig, Transporter)
            .join(Transporter, TransporterConfig.transporterId == Transporter.id)
            .where(
                TransporterConfig.companyId == company_id,
                TransporterConfig.isActive == True,
                Transporter.apiEnabled == True,
            )
        ).all()

        if not configs:
            return {"success": True, "quotes": [], "message": "No active carriers configured"}

        # Call get_rates on all carriers in parallel
        async def fetch_rate(config_pair):
            config, transporter = config_pair
            try:
                adapter = get_carrier_adapter(transporter.code, config.credentials or {})
                if not adapter:
                    return None
                rate_resp: RateResponse = await adapter.get_rates(
                    origin_pincode, dest_pincode, weight_grams, payment_mode, cod_amount,
                )
                if rate_resp.success:
                    return rate_resp.quotes
            except Exception as e:
                logger.warning(f"Rate check failed for {transporter.code}: {e}")
            return None

        results = await asyncio.gather(
            *[fetch_rate(c) for c in configs],
            return_exceptions=True,
        )

        all_quotes = []
        for r in results:
            if isinstance(r, list):
                all_quotes.extend(r)
            elif isinstance(r, Exception):
                logger.warning(f"Rate fetch exception: {r}")

        # Sort by rate (cheapest first)
        all_quotes.sort(key=lambda q: q.rate)

        return {
            "success": True,
            "quotes": [
                {
                    "carrierCode": q.carrier_code,
                    "carrierName": q.carrier_name,
                    "rate": q.rate,
                    "codCharges": q.cod_charges,
                    "estimatedDays": q.estimated_days,
                    "serviceType": q.service_type,
                }
                for q in all_quotes
            ],
        }

    async def get_available_carriers(
        self, company_id: UUID,
    ) -> List[Dict[str, Any]]:
        """List carriers with active credentials for this company."""
        configs = self.session.exec(
            select(TransporterConfig, Transporter)
            .join(Transporter, TransporterConfig.transporterId == Transporter.id)
            .where(
                TransporterConfig.companyId == company_id,
                TransporterConfig.isActive == True,
            )
        ).all()

        return [
            {
                "carrierCode": transporter.code,
                "carrierName": transporter.name,
                "type": transporter.type.value if hasattr(transporter.type, "value") else str(transporter.type),
                "apiEnabled": transporter.apiEnabled,
                "priority": config.priority,
                "logo": transporter.logo,
            }
            for config, transporter in configs
        ]

    async def get_tracking(
        self, awb_no: str, company_id: UUID,
    ) -> Dict[str, Any]:
        """Fetch live tracking from carrier adapter."""
        # Find delivery by AWB
        delivery = self.session.exec(
            select(Delivery).where(Delivery.awbNo == awb_no)
        ).first()
        if not delivery:
            return {"success": False, "error": "Delivery not found for this AWB"}

        if not delivery.transporterId:
            return {"success": False, "error": "No carrier assigned to this delivery"}

        transporter = self.session.get(Transporter, delivery.transporterId)
        if not transporter:
            return {"success": False, "error": "Carrier not found"}

        adapter = get_carrier_for_company(self.session, company_id, transporter.code)
        if not adapter:
            return {"success": False, "error": "Carrier not configured"}

        try:
            tracking: TrackingResponse = await adapter.track_shipment(awb_no)
        except Exception as e:
            logger.error(f"Tracking error for {awb_no}: {e}")
            return {"success": False, "error": f"Tracking API error: {str(e)}"}

        if not tracking.success:
            return {"success": False, "error": tracking.error or "Tracking failed"}

        return {
            "success": True,
            "awbNumber": tracking.awb_number,
            "currentStatus": tracking.current_status,
            "expectedDelivery": tracking.edd,
            "events": [
                {
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                    "statusCode": e.status_code,
                    "statusDescription": e.status_description,
                    "location": e.location,
                    "remark": e.remark,
                    "omsStatus": e.oms_status,
                    "isTerminal": e.is_terminal,
                }
                for e in tracking.events
            ],
        }

    async def get_public_tracking(self, awb_no: str) -> Dict[str, Any]:
        """
        Public tracking — no auth required.
        Returns tracking with company branding and masked customer info.
        """
        delivery = self.session.exec(
            select(Delivery).where(Delivery.awbNo == awb_no)
        ).first()
        if not delivery:
            return {"success": False, "error": "Shipment not found"}

        # Get order for customer info
        order = self.session.exec(
            select(Order).where(Order.id == delivery.orderId)
        ).first()

        # Get company branding
        from app.models import Company
        company = self.session.get(Company, delivery.companyId) if delivery.companyId else None
        branding = {}
        if company:
            branding = {
                "companyName": company.name,
                "logo": getattr(company, "logo", None),
                "brandColor": getattr(company, "brandColor", None),
            }
            # Try to get branding from JSONB field
            if hasattr(company, "branding") and isinstance(company.branding, dict):
                branding.update(company.branding)

        # Mask customer name
        masked_name = ""
        if order and order.customerName:
            parts = order.customerName.split()
            if parts:
                masked_name = parts[0]
                if len(parts) > 1:
                    masked_name += f" {parts[1][0]}."

        # Masked address (city only)
        masked_city = ""
        if order and order.shippingAddress:
            masked_city = order.shippingAddress.get("city", "")

        # Get live tracking from carrier
        tracking_events = []
        current_status = delivery.status.value if hasattr(delivery.status, "value") else str(delivery.status)
        edd = None

        if delivery.transporterId:
            transporter = self.session.get(Transporter, delivery.transporterId)
            if transporter and delivery.companyId:
                adapter = get_carrier_for_company(self.session, delivery.companyId, transporter.code)
                if adapter:
                    try:
                        tracking = await adapter.track_shipment(awb_no)
                        if tracking.success:
                            current_status = tracking.current_status or current_status
                            edd = tracking.edd
                            tracking_events = [
                                {
                                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                                    "status": e.status_description,
                                    "location": e.location,
                                    "isTerminal": e.is_terminal,
                                }
                                for e in tracking.events
                            ]
                    except Exception as e:
                        logger.warning(f"Public tracking API error for {awb_no}: {e}")

        carrier_name = ""
        if delivery.transporterId:
            transporter = self.session.get(Transporter, delivery.transporterId)
            if transporter:
                carrier_name = transporter.name

        return {
            "success": True,
            "awbNumber": awb_no,
            "currentStatus": current_status,
            "carrierName": carrier_name,
            "expectedDelivery": edd,
            "consigneeName": masked_name,
            "deliveryCity": masked_city,
            "events": tracking_events,
            "branding": branding,
        }
