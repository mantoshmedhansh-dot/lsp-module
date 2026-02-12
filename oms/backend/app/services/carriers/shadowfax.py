"""
Shadowfax Adapter — Integration with Shadowfax's logistics API.
Shadowfax is a hyperlocal and last-mile delivery logistics company in India,
offering same-day and next-day delivery services.

API Base URL: https://franchise-api.shadowfax.in/api/v2
Auth: Token-based (provided during onboarding, sent as `Authorization: Token xxx`)
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
from app.models.enums import DeliveryStatus

logger = logging.getLogger(__name__)

# ============================================================================
# Shadowfax status → OMS DeliveryStatus mapping
# ============================================================================

SHADOWFAX_STATUS_MAP = {
    "Order Placed": DeliveryStatus.MANIFESTED,
    "Pickup Assigned": DeliveryStatus.MANIFESTED,
    "Picked Up": DeliveryStatus.SHIPPED,
    "In Transit": DeliveryStatus.IN_TRANSIT,
    "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
    "Delivered": DeliveryStatus.DELIVERED,
    "NDR": DeliveryStatus.NDR,
    "RTO": DeliveryStatus.RTO_INITIATED,
    "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
    "Cancelled": DeliveryStatus.CANCELLED,
}


def _map_shadowfax_status(status: str) -> DeliveryStatus:
    """Map a Shadowfax status string to OMS DeliveryStatus."""
    # Try exact match first
    mapped = SHADOWFAX_STATUS_MAP.get(status)
    if mapped:
        return mapped
    # Try case-insensitive match
    status_lower = status.strip().lower()
    for key, value in SHADOWFAX_STATUS_MAP.items():
        if key.lower() == status_lower:
            return value
    return DeliveryStatus.IN_TRANSIT


class ShadowfaxAdapter(CarrierAdapter):
    """
    Shadowfax carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "api_token": "your-token",
        "base_url": "https://franchise-api.shadowfax.in/api/v2",
        "client_code": "your-client-code"
    }
    """

    carrier_code = "SHADOWFAX"
    carrier_name = "Shadowfax"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._api_token: str = credentials.get("api_token", "")
        self._base_url = credentials.get("base_url", "https://franchise-api.shadowfax.in/api/v2")
        self._client_code = credentials.get("client_code", "")
        self._client = httpx.AsyncClient(timeout=30.0)

    # ========================================================================
    # Authentication
    # ========================================================================

    def _headers(self) -> Dict[str, str]:
        """Build authenticated request headers. Shadowfax uses a static token."""
        return {
            "Authorization": f"Token {self._api_token}",
            "Content-Type": "application/json",
        }

    async def authenticate(self) -> bool:
        """
        Validate Shadowfax credentials by making a lightweight API call.
        Shadowfax uses a static onboarding token — no login flow needed.
        """
        try:
            if not self._api_token:
                logger.error("Shadowfax: Missing api_token in credentials")
                return False

            # Validate the token by making a lightweight tracking call
            resp = await self._client.get(
                f"{self._base_url}/clients/track/",
                params={"awb_number": "TEST_AUTH_CHECK"},
                headers=self._headers(),
            )
            # A 401/403 means bad token; anything else means the token is valid
            if resp.status_code in (401, 403):
                logger.error("Shadowfax: Authentication failed — invalid token")
                return False

            logger.info("Shadowfax: Authentication successful")
            return True

        except Exception as e:
            logger.error(f"Shadowfax auth check failed: {e}")
            return False

    # ========================================================================
    # Shipment (Order) Creation
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create an order on Shadowfax.
        Shadowfax assigns an AWB number upon successful order creation.
        """
        try:
            headers = self._headers()
            payload = self._build_order_payload(request)

            resp = await self._client.post(
                f"{self._base_url}/clients/orders/",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Shadowfax returns order details with AWB
            order_data = data.get("data", data)
            awb_number = str(order_data.get("awb_number", order_data.get("sf_order_id", "")))
            sf_order_id = str(order_data.get("sf_order_id", ""))

            if awb_number:
                return ShipmentResponse(
                    success=True,
                    awb_number=awb_number,
                    carrier_order_id=sf_order_id,
                    tracking_url=f"https://tracker.shadowfax.in/{awb_number}",
                    label_url=order_data.get("label_url", ""),
                    raw_response=data,
                )
            else:
                return ShipmentResponse(
                    success=False,
                    error=data.get("message", "Shadowfax order creation returned no AWB"),
                    raw_response=data,
                )

        except httpx.HTTPStatusError as e:
            error_body = {}
            try:
                error_body = e.response.json()
            except Exception:
                pass
            error_msg = error_body.get("message", str(e))
            logger.error(f"Shadowfax create_shipment HTTP error: {error_msg}")
            return ShipmentResponse(success=False, error=error_msg, raw_response=error_body)

        except Exception as e:
            logger.error(f"Shadowfax create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    def _build_order_payload(self, req: ShipmentRequest) -> Dict[str, Any]:
        """Build Shadowfax order creation payload from our unified ShipmentRequest."""
        product_desc = req.product_description or "Product"
        if req.items:
            product_desc = ", ".join(item.name for item in req.items)

        payload: Dict[str, Any] = {
            "client_order_id": req.order_id,
            "order_details": {
                "product_desc": product_desc,
                "total_amount": req.invoice_value,
                "cod_amount": req.cod_amount if req.payment_mode == "COD" else 0,
                "weight": req.weight_grams,
                "length": req.length_cm,
                "breadth": req.breadth_cm,
                "height": req.height_cm,
            },
            "delivery_details": {
                "name": req.delivery.name,
                "phone": req.delivery.phone,
                "address": req.delivery.address_line1,
                "address_2": req.delivery.address_line2,
                "city": req.delivery.city,
                "state": req.delivery.state,
                "pincode": req.delivery.pincode,
            },
            "pickup_details": {
                "name": req.pickup.name or "Warehouse",
                "phone": req.pickup.phone,
                "address": req.pickup.address_line1,
                "city": req.pickup.city,
                "pincode": req.pickup.pincode,
            },
        }

        # Add client code if configured
        if self._client_code:
            payload["client_code"] = self._client_code

        return payload

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """Cancel a shipment by AWB number on Shadowfax."""
        try:
            headers = self._headers()
            resp = await self._client.post(
                f"{self._base_url}/clients/orders/cancel/",
                json={"awb_number": awb_number},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                success = data.get("success", data.get("status", False))
                if success:
                    logger.info(f"Shadowfax: Cancelled AWB {awb_number}")
                    return True
                else:
                    logger.warning(
                        f"Shadowfax cancel response for {awb_number}: {data.get('message', 'Unknown error')}"
                    )
                    return False
            else:
                logger.warning(
                    f"Shadowfax cancel returned status {resp.status_code} for {awb_number}"
                )
                return False
        except Exception as e:
            logger.error(f"Shadowfax cancel failed for {awb_number}: {e}")
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """Get tracking info for a shipment from Shadowfax."""
        try:
            headers = self._headers()
            resp = await self._client.get(
                f"{self._base_url}/clients/track/",
                params={"awb_number": awb_number},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            tracking_data = data.get("data", data)
            scans = tracking_data.get("scans", tracking_data.get("tracking_details", []))

            events = []
            for scan in scans:
                raw_status = scan.get("status", scan.get("status_text", ""))
                oms_status = _map_shadowfax_status(raw_status)
                is_ndr = StatusMapper.is_ndr(oms_status)

                timestamp_str = scan.get("timestamp", scan.get("created_at", ""))
                try:
                    timestamp = datetime.fromisoformat(timestamp_str)
                except (ValueError, TypeError):
                    timestamp = datetime.now(timezone.utc)

                events.append(TrackingEvent(
                    timestamp=timestamp,
                    status_code=raw_status,
                    status_description=scan.get("status_text", scan.get("remark", raw_status)),
                    location=scan.get("location", scan.get("city", "")),
                    remark=scan.get("remark", ""),
                    oms_status=oms_status.value,
                    is_ndr=is_ndr,
                    ndr_reason="",
                    is_terminal=StatusMapper.is_terminal(oms_status),
                ))

            # Current status from the latest event or top-level field
            current_status = ""
            top_level_status = tracking_data.get("current_status", "")
            if top_level_status:
                current_status = _map_shadowfax_status(top_level_status).value
            elif events:
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
            logger.error(f"Shadowfax tracking failed for {awb_number}: {e}")
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
        """
        Get shipping rate quotes from Shadowfax.
        Shadowfax does not expose a public rate calculator API.
        Rates are typically agreed upon during onboarding. This returns
        a placeholder that can be overridden with contracted rates.
        """
        logger.info(
            f"Shadowfax rate check: {origin_pincode} -> {dest_pincode}, {weight_grams}g"
        )
        # Shadowfax rates are contract-based — return empty quotes with a note
        return RateResponse(
            success=True,
            quotes=[],
            error="Shadowfax rates are contract-based. Use agreed rate card for pricing.",
        )

    # ========================================================================
    # Serviceability
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """
        Check if delivery is possible between two pincodes via Shadowfax.
        Shadowfax serviceability is typically checked during order creation.
        This method attempts a best-effort check using the tracking endpoint
        or returns a generic response.
        """
        try:
            # Shadowfax does not have a dedicated serviceability endpoint.
            # Serviceability is typically validated during order creation.
            # Return a generic positive response — actual validation happens at order time.
            logger.info(
                f"Shadowfax serviceability check: {origin_pincode} -> {dest_pincode} "
                "(no dedicated endpoint — validated at order creation time)"
            )
            return ServiceabilityResponse(
                success=True,
                is_serviceable=True,
                cod_available=True,
                prepaid_available=True,
                estimated_days=0,
                error="Serviceability is validated at order creation time by Shadowfax",
            )
        except Exception as e:
            logger.error(f"Shadowfax serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Get shipping label PDF URL for an AWB.
        Shadowfax typically returns a label URL during order creation.
        This method attempts to retrieve it from tracking data as a fallback.
        """
        try:
            headers = self._headers()
            resp = await self._client.get(
                f"{self._base_url}/clients/track/",
                params={"awb_number": awb_number},
                headers=headers,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            tracking_data = data.get("data", data)
            label_url = tracking_data.get("label_url", "")
            return label_url if label_url else None
        except Exception as e:
            logger.error(f"Shadowfax get_label failed for {awb_number}: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions on Shadowfax via their NDR action endpoint.
        Supported actions: reattempt, rto, update_address.
        """
        try:
            headers = self._headers()

            payload: Dict[str, Any] = {
                "awb_number": awb_number,
                "action": action,
            }

            # Include additional fields for address update
            if action == "update_address" and kwargs:
                payload["new_address"] = kwargs.get("new_address", "")
                payload["new_phone"] = kwargs.get("new_phone", "")
                payload["new_pincode"] = kwargs.get("new_pincode", "")

            # Include reattempt details
            if action == "reattempt" and kwargs:
                payload["reattempt_date"] = kwargs.get("reattempt_date", "")
                payload["remarks"] = kwargs.get("remarks", "")

            resp = await self._client.post(
                f"{self._base_url}/clients/ndr-action/",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            logger.info(f"Shadowfax NDR action: {action} for AWB {awb_number}")
            return {
                "success": True,
                "message": f"NDR action '{action}' submitted for AWB {awb_number}",
                "data": data,
            }

        except httpx.HTTPStatusError as e:
            error_body = {}
            try:
                error_body = e.response.json()
            except Exception:
                pass
            error_msg = error_body.get("message", str(e))
            logger.error(f"Shadowfax NDR action failed for {awb_number}: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "data": error_body,
            }

        except Exception as e:
            logger.error(f"Shadowfax NDR action failed for {awb_number}: {e}")
            return {"success": False, "error": str(e)}
