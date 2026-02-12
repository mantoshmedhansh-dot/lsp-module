"""
Shiprocket Adapter — Integration with Shiprocket's aggregator API.
Shiprocket provides a single API to access 15+ Indian courier partners
(Delhivery, BlueDart, DTDC, Ecom Express, Xpressbees, Shadowfax, etc.)

API Docs: https://apidocs.shiprocket.in/
Base URL: https://apiv2.shiprocket.in/v1/external/

Auth: Email + Password → JWT Bearer token (valid 10 days)
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import httpx

from .base import (
    CarrierAdapter, ShipmentRequest, ShipmentResponse,
    TrackingResponse, TrackingEvent, RateResponse, RateQuote,
    ServiceabilityResponse,
)
from .status_mapper import StatusMapper

logger = logging.getLogger(__name__)

BASE_URL = "https://apiv2.shiprocket.in/v1/external"


class ShiprocketAdapter(CarrierAdapter):
    """
    Shiprocket carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "email": "your@shiprocket.com",
        "password": "your-password",
        "channel_id": "optional-channel-id"
    }
    """

    carrier_code = "SHIPROCKET"
    carrier_name = "Shiprocket"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._client = httpx.AsyncClient(timeout=30.0)

    async def _get_token(self) -> str:
        """Get or refresh the JWT bearer token."""
        if self._token and self._token_expiry and datetime.now(timezone.utc) < self._token_expiry:
            return self._token

        resp = await self._client.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": self.credentials["email"],
                "password": self.credentials["password"],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data["token"]
        # Shiprocket tokens are valid for 10 days; refresh after 9
        from datetime import timedelta
        self._token_expiry = datetime.now(timezone.utc) + timedelta(days=9)
        return self._token

    async def _headers(self) -> Dict[str, str]:
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def authenticate(self) -> bool:
        try:
            await self._get_token()
            return True
        except Exception as e:
            logger.error(f"Shiprocket auth failed: {e}")
            return False

    # ========================================================================
    # Shipment Creation
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create an order on Shiprocket → auto-assigns AWB from the best courier.
        Two steps: 1. Create order  2. Assign AWB (courier)
        """
        try:
            headers = await self._headers()

            # Step 1: Create the order on Shiprocket
            order_payload = self._build_order_payload(request)
            resp = await self._client.post(
                f"{BASE_URL}/orders/create/adhoc",
                json=order_payload,
                headers=headers,
            )
            resp.raise_for_status()
            order_data = resp.json()

            order_id = str(order_data.get("order_id", ""))
            shipment_id = str(order_data.get("shipment_id", ""))

            if not shipment_id:
                return ShipmentResponse(
                    success=False,
                    error=f"Order created but no shipment_id returned: {order_data}",
                    raw_response=order_data,
                )

            # Step 2: Auto-assign courier (Shiprocket picks best one)
            assign_resp = await self._client.post(
                f"{BASE_URL}/courier/assign/awb",
                json={"shipment_id": int(shipment_id)},
                headers=headers,
            )

            if assign_resp.status_code == 200:
                assign_data = assign_resp.json()
                awb_data = assign_data.get("response", {}).get("data", {})
                awb_number = str(awb_data.get("awb_code", ""))
                courier_name = awb_data.get("courier_name", "")
                label_url = awb_data.get("label_url", "")

                # Generate label
                label_resp = await self._client.post(
                    f"{BASE_URL}/courier/generate/label",
                    json={"shipment_id": [int(shipment_id)]},
                    headers=headers,
                )
                if label_resp.status_code == 200:
                    label_data = label_resp.json()
                    label_url = label_data.get("label_url", label_url)

                return ShipmentResponse(
                    success=True,
                    awb_number=awb_number,
                    carrier_order_id=shipment_id,
                    tracking_url=f"https://shiprocket.co/tracking/{awb_number}",
                    label_url=label_url,
                    raw_response={
                        "order": order_data,
                        "assign": assign_data if assign_resp.status_code == 200 else {},
                        "courier_name": courier_name,
                    },
                )
            else:
                # Order created but courier assignment failed — return with order info
                return ShipmentResponse(
                    success=True,
                    carrier_order_id=shipment_id,
                    error="Order created but courier auto-assignment failed. Assign manually.",
                    raw_response=order_data,
                )

        except Exception as e:
            logger.error(f"Shiprocket create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    def _build_order_payload(self, req: ShipmentRequest) -> Dict[str, Any]:
        """Build Shiprocket order creation payload from our unified ShipmentRequest."""
        items = []
        for item in req.items:
            items.append({
                "name": item.name,
                "sku": item.sku,
                "units": item.quantity,
                "selling_price": str(item.price),
                "hsn": item.hsn_code or "",
            })

        # Fallback item if none provided
        if not items:
            items = [{
                "name": req.product_description or "Product",
                "sku": "DEFAULT",
                "units": 1,
                "selling_price": str(req.invoice_value),
            }]

        payload = {
            "order_id": req.order_id,
            "order_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "pickup_location": req.pickup.name or "Primary",
            "billing_customer_name": req.delivery.name,
            "billing_last_name": "",
            "billing_address": req.delivery.address_line1,
            "billing_address_2": req.delivery.address_line2,
            "billing_city": req.delivery.city,
            "billing_pincode": req.delivery.pincode,
            "billing_state": req.delivery.state,
            "billing_country": req.delivery.country,
            "billing_email": req.delivery.email or "",
            "billing_phone": req.delivery.phone,
            "shipping_is_billing": True,
            "order_items": items,
            "payment_method": "COD" if req.payment_mode == "COD" else "Prepaid",
            "sub_total": req.invoice_value,
            "length": req.length_cm,
            "breadth": req.breadth_cm,
            "height": req.height_cm,
            "weight": req.weight_grams / 1000,  # Shiprocket expects kg
        }

        if req.payment_mode == "COD":
            payload["cod_amount"] = req.cod_amount or req.invoice_value

        channel_id = self.credentials.get("channel_id")
        if channel_id:
            payload["channel_id"] = channel_id

        return payload

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        try:
            headers = await self._headers()
            resp = await self._client.post(
                f"{BASE_URL}/orders/cancel",
                json={"awbs": [awb_number]},
                headers=headers,
            )
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Shiprocket cancel failed: {e}")
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        try:
            headers = await self._headers()
            resp = await self._client.get(
                f"{BASE_URL}/courier/track/awb/{awb_number}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            tracking_data = data.get("tracking_data", {})
            shipment_track = tracking_data.get("shipment_track", [])

            events = []
            for activity_group in shipment_track:
                activities = activity_group.get("shipment_track_activities", [])
                for act in activities:
                    sr_status = act.get("sr-status", act.get("activity", ""))
                    oms_status = StatusMapper.map_shiprocket_status(sr_status)
                    is_ndr = StatusMapper.is_ndr(oms_status)
                    ndr_reason = ""
                    if is_ndr:
                        ndr_reason = StatusMapper.map_shiprocket_ndr_reason(
                            act.get("sr-status-label", sr_status)
                        ).value

                    events.append(TrackingEvent(
                        timestamp=datetime.fromisoformat(
                            act.get("date", datetime.now(timezone.utc).isoformat())
                        ),
                        status_code=sr_status,
                        status_description=act.get("sr-status-label", sr_status),
                        location=act.get("location", ""),
                        remark=act.get("activity", ""),
                        oms_status=oms_status.value,
                        is_ndr=is_ndr,
                        ndr_reason=ndr_reason,
                        is_terminal=StatusMapper.is_terminal(oms_status),
                    ))

            # Current status from the latest event
            current_status = ""
            if events:
                current_status = events[0].oms_status  # Latest first

            # EDD
            edd = tracking_data.get("edd")

            return TrackingResponse(
                success=True,
                awb_number=awb_number,
                current_status=current_status,
                edd=edd,
                events=events,
                raw_response=data,
            )

        except Exception as e:
            logger.error(f"Shiprocket tracking failed for {awb_number}: {e}")
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )

    # ========================================================================
    # Rate Comparison
    # ========================================================================

    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        try:
            headers = await self._headers()
            params = {
                "pickup_postcode": origin_pincode,
                "delivery_postcode": dest_pincode,
                "weight": weight_grams / 1000,  # kg
                "cod": 1 if payment_mode == "COD" else 0,
            }
            if payment_mode == "COD":
                params["declared_value"] = cod_amount

            resp = await self._client.get(
                f"{BASE_URL}/courier/serviceability/",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            couriers = data.get("data", {}).get("available_courier_companies", [])
            quotes = []
            for c in couriers:
                quotes.append(RateQuote(
                    carrier_code=str(c.get("courier_company_id", "")),
                    carrier_name=c.get("courier_name", ""),
                    rate=float(c.get("rate", 0)),
                    cod_charges=float(c.get("cod_charges", 0)),
                    estimated_days=int(c.get("estimated_delivery_days", 0)),
                    service_type=c.get("delivery_performance", ""),
                ))

            return RateResponse(success=True, quotes=quotes)

        except Exception as e:
            logger.error(f"Shiprocket rate check failed: {e}")
            return RateResponse(success=False, error=str(e))

    # ========================================================================
    # Serviceability
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        try:
            rate_resp = await self.get_rates(origin_pincode, dest_pincode, 500)
            if rate_resp.success and rate_resp.quotes:
                best = rate_resp.quotes[0]
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=True,
                    cod_available=any(q.cod_charges >= 0 for q in rate_resp.quotes),
                    prepaid_available=True,
                    estimated_days=best.estimated_days,
                )
            return ServiceabilityResponse(success=True, is_serviceable=False)
        except Exception as e:
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """Shiprocket needs shipment_id for label; track to find it."""
        try:
            headers = await self._headers()
            # Track to get shipment_id
            resp = await self._client.get(
                f"{BASE_URL}/courier/track/awb/{awb_number}",
                headers=headers,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            shipment_id = data.get("tracking_data", {}).get("shipment_id")
            if not shipment_id:
                return None

            label_resp = await self._client.post(
                f"{BASE_URL}/courier/generate/label",
                json={"shipment_id": [int(shipment_id)]},
                headers=headers,
            )
            if label_resp.status_code == 200:
                return label_resp.json().get("label_url")
            return None
        except Exception as e:
            logger.error(f"Shiprocket get_label failed: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Shiprocket NDR actions are handled through their dashboard.
        For API-level NDR, use the underlying carrier's API directly.
        This is a passthrough that logs the action.
        """
        logger.info(f"Shiprocket NDR action: {action} for AWB {awb_number}")
        return {
            "success": True,
            "message": f"NDR action '{action}' recorded for AWB {awb_number}",
            "note": "Shiprocket NDR actions are processed via their dashboard",
        }

    # ========================================================================
    # Pickup Request
    # ========================================================================

    async def request_pickup(self, shipment_ids: List[str]) -> Dict[str, Any]:
        try:
            headers = await self._headers()
            resp = await self._client.post(
                f"{BASE_URL}/courier/generate/pickup",
                json={"shipment_id": [int(sid) for sid in shipment_ids]},
                headers=headers,
            )
            resp.raise_for_status()
            return {"success": True, "data": resp.json()}
        except Exception as e:
            logger.error(f"Shiprocket pickup request failed: {e}")
            return {"success": False, "error": str(e)}
