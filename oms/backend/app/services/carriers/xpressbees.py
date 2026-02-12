"""
Xpressbees Adapter — Integration with Xpressbees' courier API.
Xpressbees is one of India's largest courier companies offering
B2C, B2B, and cross-border shipping solutions.

API Base URL: https://ship.xpressbees.com/api
Auth: Email + Password → JWT Bearer token
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

import httpx

from .base import (
    CarrierAdapter, ShipmentRequest, ShipmentResponse,
    TrackingResponse, TrackingEvent, RateResponse, RateQuote,
    ServiceabilityResponse,
)
from .status_mapper import StatusMapper
from app.models.enums import DeliveryStatus

logger = logging.getLogger(__name__)

# ============================================================================
# Xpressbees status → OMS DeliveryStatus mapping
# ============================================================================

XPRESSBEES_STATUS_MAP = {
    "Manifested": DeliveryStatus.MANIFESTED,
    "Picked Up": DeliveryStatus.SHIPPED,
    "In Transit": DeliveryStatus.IN_TRANSIT,
    "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
    "Delivered": DeliveryStatus.DELIVERED,
    "NDR": DeliveryStatus.NDR,
    "RTO Initiated": DeliveryStatus.RTO_INITIATED,
    "RTO In Transit": DeliveryStatus.RTO_IN_TRANSIT,
    "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
    "Cancelled": DeliveryStatus.CANCELLED,
}


def _map_xpressbees_status(status: str) -> DeliveryStatus:
    """Map an Xpressbees status string to OMS DeliveryStatus."""
    # Try exact match first
    mapped = XPRESSBEES_STATUS_MAP.get(status)
    if mapped:
        return mapped
    # Try case-insensitive match
    status_lower = status.strip().lower()
    for key, value in XPRESSBEES_STATUS_MAP.items():
        if key.lower() == status_lower:
            return value
    return DeliveryStatus.IN_TRANSIT


class XpressbeesAdapter(CarrierAdapter):
    """
    Xpressbees carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "email": "your-email",
        "password": "your-password",
        "base_url": "https://ship.xpressbees.com/api"
    }
    """

    carrier_code = "XPRESSBEES"
    carrier_name = "Xpressbees"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._base_url = credentials.get("base_url", "https://ship.xpressbees.com/api")
        self._client = httpx.AsyncClient(timeout=30.0)

    # ========================================================================
    # Authentication
    # ========================================================================

    async def _get_token(self) -> str:
        """Get or refresh the JWT bearer token from Xpressbees."""
        if self._token and self._token_expiry and datetime.now(timezone.utc) < self._token_expiry:
            return self._token

        logger.info("Xpressbees: Authenticating with email/password")
        resp = await self._client.post(
            f"{self._base_url}/users/login",
            json={
                "email": self.credentials["email"],
                "password": self.credentials["password"],
            },
        )
        resp.raise_for_status()
        data = resp.json()

        self._token = data.get("data", data.get("token", ""))
        if not self._token:
            raise ValueError(f"Xpressbees login response missing token: {data}")

        # Refresh well before expiry (token validity depends on Xpressbees config)
        self._token_expiry = datetime.now(timezone.utc) + timedelta(hours=23)
        logger.info("Xpressbees: Authentication successful")
        return self._token

    async def _headers(self) -> Dict[str, str]:
        """Build authenticated request headers."""
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def authenticate(self) -> bool:
        """Authenticate with Xpressbees API."""
        try:
            await self._get_token()
            return True
        except Exception as e:
            logger.error(f"Xpressbees auth failed: {e}")
            return False

    # ========================================================================
    # Shipment Creation
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create a shipment on Xpressbees.

        Steps:
        1. Fetch a pre-assigned AWB number via /shipments/getwayBill
        2. Create the shipment with /shipments
        """
        try:
            headers = await self._headers()

            # Step 1: Fetch an AWB number
            awb_number = await self._fetch_awb(headers)

            # Step 2: Build and submit shipment payload
            payload = self._build_shipment_payload(request, awb_number)
            resp = await self._client.post(
                f"{self._base_url}/shipments",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            success = data.get("status", False) or data.get("success", False)
            returned_awb = str(data.get("data", {}).get("awb_number", awb_number))

            if success or returned_awb:
                return ShipmentResponse(
                    success=True,
                    awb_number=returned_awb,
                    carrier_order_id=str(data.get("data", {}).get("order_id", request.order_id)),
                    tracking_url=f"https://ship.xpressbees.com/tracking/{returned_awb}",
                    label_url=data.get("data", {}).get("label_url", ""),
                    raw_response=data,
                )
            else:
                return ShipmentResponse(
                    success=False,
                    error=data.get("message", "Xpressbees shipment creation failed"),
                    raw_response=data,
                )

        except Exception as e:
            logger.error(f"Xpressbees create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    async def _fetch_awb(self, headers: Dict[str, str]) -> str:
        """Fetch a pre-assigned AWB number from Xpressbees."""
        resp = await self._client.post(
            f"{self._base_url}/shipments/getwayBill",
            json={},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        awb = data.get("data", data.get("awb_number", ""))
        if not awb:
            raise ValueError(f"Xpressbees AWB fetch returned no AWB: {data}")
        return str(awb)

    def _build_shipment_payload(self, req: ShipmentRequest, awb_number: str) -> Dict[str, Any]:
        """Build Xpressbees shipment creation payload from our unified ShipmentRequest."""
        payload = {
            "awb_number": awb_number,
            "order_number": req.order_id,
            "payment_type": "cod" if req.payment_mode == "COD" else "prepaid",
            "package_weight": req.weight_grams,
            "package_length": req.length_cm,
            "package_breadth": req.breadth_cm,
            "package_height": req.height_cm,
            "consignee_name": req.delivery.name,
            "consignee_phone": req.delivery.phone,
            "consignee_address": req.delivery.address_line1,
            "consignee_address_2": req.delivery.address_line2,
            "consignee_city": req.delivery.city,
            "consignee_state": req.delivery.state,
            "consignee_pincode": req.delivery.pincode,
            "pickup_location": req.pickup.name or "Primary",
            "invoice_value": req.invoice_value,
            "cod_amount": req.cod_amount if req.payment_mode == "COD" else 0,
            "product_description": req.product_description or "Product",
        }

        # Add item details if available
        if req.items:
            payload["product_description"] = ", ".join(
                item.name for item in req.items
            )

        return payload

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """Cancel a shipment by AWB number on Xpressbees."""
        try:
            headers = await self._headers()
            resp = await self._client.post(
                f"{self._base_url}/shipments/cancel",
                json={"awb_number": awb_number},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                success = data.get("status", False) or data.get("success", False)
                if success:
                    logger.info(f"Xpressbees: Cancelled AWB {awb_number}")
                    return True
                else:
                    logger.warning(
                        f"Xpressbees cancel response for {awb_number}: {data.get('message', 'Unknown error')}"
                    )
                    return False
            return False
        except Exception as e:
            logger.error(f"Xpressbees cancel failed for {awb_number}: {e}")
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """Get tracking info for a shipment from Xpressbees."""
        try:
            headers = await self._headers()
            resp = await self._client.get(
                f"{self._base_url}/shipments2/track/{awb_number}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            tracking_data = data.get("data", {})
            scans = tracking_data.get("scans", tracking_data.get("tracking", []))

            events = []
            for scan in scans:
                raw_status = scan.get("status", scan.get("status_code", ""))
                oms_status = _map_xpressbees_status(raw_status)
                is_ndr = StatusMapper.is_ndr(oms_status)

                timestamp_str = scan.get("timestamp", scan.get("date", ""))
                try:
                    timestamp = datetime.fromisoformat(timestamp_str)
                except (ValueError, TypeError):
                    timestamp = datetime.now(timezone.utc)

                events.append(TrackingEvent(
                    timestamp=timestamp,
                    status_code=raw_status,
                    status_description=scan.get("status_description", scan.get("remark", raw_status)),
                    location=scan.get("location", scan.get("city", "")),
                    remark=scan.get("remark", ""),
                    oms_status=oms_status.value,
                    is_ndr=is_ndr,
                    ndr_reason="",
                    is_terminal=StatusMapper.is_terminal(oms_status),
                ))

            # Current status from the latest event
            current_status = ""
            if events:
                current_status = events[0].oms_status

            # Expected delivery date
            edd = tracking_data.get("expected_delivery_date", tracking_data.get("edd"))

            return TrackingResponse(
                success=True,
                awb_number=awb_number,
                current_status=current_status,
                edd=edd,
                events=events,
                raw_response=data,
            )

        except Exception as e:
            logger.error(f"Xpressbees tracking failed for {awb_number}: {e}")
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )

    # ========================================================================
    # Rate Calculator
    # ========================================================================

    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        """Get shipping rate quotes from Xpressbees rate calculator."""
        try:
            headers = await self._headers()
            payload = {
                "origin_pincode": origin_pincode,
                "destination_pincode": dest_pincode,
                "weight": weight_grams,
                "payment_type": "cod" if payment_mode == "COD" else "prepaid",
                "cod_amount": cod_amount if payment_mode == "COD" else 0,
            }

            resp = await self._client.post(
                f"{self._base_url}/ratecalculator",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            rate_data = data.get("data", [])
            if not isinstance(rate_data, list):
                rate_data = [rate_data] if rate_data else []

            quotes = []
            for rate in rate_data:
                quotes.append(RateQuote(
                    carrier_code="XPRESSBEES",
                    carrier_name=rate.get("courier_name", "Xpressbees"),
                    rate=float(rate.get("total_charge", rate.get("rate", 0))),
                    cod_charges=float(rate.get("cod_charge", 0)),
                    estimated_days=int(rate.get("estimated_days", rate.get("tat", 0))),
                    service_type=rate.get("service_type", rate.get("type", "Standard")),
                ))

            return RateResponse(success=True, quotes=quotes)

        except Exception as e:
            logger.error(f"Xpressbees rate check failed: {e}")
            return RateResponse(success=False, error=str(e))

    # ========================================================================
    # Serviceability
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """Check if delivery is possible between two pincodes via Xpressbees."""
        try:
            headers = await self._headers()
            resp = await self._client.get(
                f"{self._base_url}/pincode/serviceability",
                params={
                    "origin": origin_pincode,
                    "destination": dest_pincode,
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            service_data = data.get("data", {})
            is_serviceable = bool(service_data.get("serviceable", False))

            if is_serviceable:
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=True,
                    cod_available=bool(service_data.get("cod_available", False)),
                    prepaid_available=bool(service_data.get("prepaid_available", True)),
                    estimated_days=int(service_data.get("estimated_days", 0)),
                )
            else:
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=False,
                )

        except Exception as e:
            logger.error(f"Xpressbees serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Get shipping label PDF URL for an AWB.
        Xpressbees typically returns a label URL during shipment creation.
        This method re-fetches it from tracking data as a fallback.
        """
        try:
            headers = await self._headers()
            resp = await self._client.get(
                f"{self._base_url}/shipments2/track/{awb_number}",
                headers=headers,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            label_url = data.get("data", {}).get("label_url", "")
            return label_url if label_url else None
        except Exception as e:
            logger.error(f"Xpressbees get_label failed for {awb_number}: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions on Xpressbees.
        Xpressbees NDR actions are typically handled through their dashboard.
        This logs the action for audit trail purposes.
        """
        logger.info(f"Xpressbees NDR action: {action} for AWB {awb_number}")
        return {
            "success": True,
            "message": f"NDR action '{action}' recorded for AWB {awb_number}",
            "note": "Xpressbees NDR actions are processed via their dashboard/webhook",
        }
