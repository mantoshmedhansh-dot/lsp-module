"""
Ekart Logistics Adapter — Integration with Ekart's logistics API.
Ekart is Flipkart's logistics arm, one of India's largest supply chain
and logistics companies offering end-to-end delivery services.

API Base URL: https://api.ekartlogistics.com/api/v1
Auth: API Key + Client ID (provided during onboarding)

NOTE: Ekart's API is largely private/undocumented. All endpoint patterns
in this adapter are best-effort implementations based on common logistics
API conventions. Verify with Ekart's integration team during onboarding.
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
# Ekart status → OMS DeliveryStatus mapping
# ============================================================================

EKART_STATUS_MAP = {
    "Created": DeliveryStatus.MANIFESTED,
    "Picked Up": DeliveryStatus.SHIPPED,
    "In Transit": DeliveryStatus.IN_TRANSIT,
    "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
    "Delivered": DeliveryStatus.DELIVERED,
    "Undelivered": DeliveryStatus.NDR,
    "RTO Initiated": DeliveryStatus.RTO_INITIATED,
    "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
    "Cancelled": DeliveryStatus.CANCELLED,
}


def _map_ekart_status(status: str) -> DeliveryStatus:
    """Map an Ekart status string to OMS DeliveryStatus."""
    # Try exact match first
    mapped = EKART_STATUS_MAP.get(status)
    if mapped:
        return mapped
    # Try case-insensitive match
    status_lower = status.strip().lower()
    for key, value in EKART_STATUS_MAP.items():
        if key.lower() == status_lower:
            return value
    return DeliveryStatus.IN_TRANSIT


class EkartAdapter(CarrierAdapter):
    """
    Ekart Logistics carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "api_key": "your-api-key",
        "client_id": "your-client-id",
        "base_url": "https://api.ekartlogistics.com/api/v1"
    }

    NOTE: Ekart's API is largely private/undocumented. All methods are
    best-effort implementations. Verify endpoint patterns and payload
    structures with Ekart's integration team during onboarding.
    """

    carrier_code = "EKART"
    carrier_name = "Ekart Logistics"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._api_key: str = credentials.get("api_key", "")
        self._client_id: str = credentials.get("client_id", "")
        self._base_url = credentials.get("base_url", "https://api.ekartlogistics.com/api/v1")
        self._client = httpx.AsyncClient(timeout=30.0)

    # ========================================================================
    # Authentication
    # ========================================================================

    def _headers(self) -> Dict[str, str]:
        """
        Build authenticated request headers.
        Ekart uses API Key + Client ID for authentication.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        return {
            "X-API-Key": self._api_key,
            "X-Client-Id": self._client_id,
            "Content-Type": "application/json",
        }

    async def authenticate(self) -> bool:
        """
        Validate Ekart credentials by making a lightweight API call.
        Ekart uses static API key + client ID — no login flow needed.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        try:
            if not self._api_key or not self._client_id:
                logger.error("Ekart: Missing api_key or client_id in credentials")
                return False

            # Validate by attempting a tracking call with a dummy AWB
            resp = await self._client.get(
                f"{self._base_url}/shipments/track/TEST_AUTH_CHECK",
                headers=self._headers(),
            )
            # A 401/403 means bad credentials; anything else means they are valid
            if resp.status_code in (401, 403):
                logger.error("Ekart: Authentication failed — invalid API key or client ID")
                return False

            logger.info("Ekart: Authentication successful")
            return True

        except Exception as e:
            logger.error(f"Ekart auth check failed: {e}")
            return False

    # ========================================================================
    # Shipment Creation
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create a shipment on Ekart Logistics.
        Ekart assigns an AWB number upon successful shipment creation.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        try:
            headers = self._headers()
            payload = self._build_shipment_payload(request)

            resp = await self._client.post(
                f"{self._base_url}/shipments",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response — Ekart's actual response structure may vary
            shipment_data = data.get("data", data)
            awb_number = str(
                shipment_data.get("awb_number",
                shipment_data.get("tracking_id",
                shipment_data.get("shipment_id", "")))
            )

            if awb_number:
                return ShipmentResponse(
                    success=True,
                    awb_number=awb_number,
                    carrier_order_id=str(shipment_data.get("shipment_id", request.order_id)),
                    tracking_url=shipment_data.get("tracking_url", ""),
                    label_url=shipment_data.get("label_url", ""),
                    raw_response=data,
                )
            else:
                return ShipmentResponse(
                    success=False,
                    error=data.get("message", "Ekart shipment creation returned no AWB"),
                    raw_response=data,
                )

        except httpx.HTTPStatusError as e:
            error_body = {}
            try:
                error_body = e.response.json()
            except Exception:
                pass
            error_msg = error_body.get("message", str(e))
            logger.error(f"Ekart create_shipment HTTP error: {error_msg}")
            return ShipmentResponse(success=False, error=error_msg, raw_response=error_body)

        except Exception as e:
            logger.error(f"Ekart create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    def _build_shipment_payload(self, req: ShipmentRequest) -> Dict[str, Any]:
        """
        Build Ekart shipment creation payload from our unified ShipmentRequest.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        # Build items list
        items = []
        for item in req.items:
            items.append({
                "name": item.name,
                "sku": item.sku,
                "quantity": item.quantity,
                "price": item.price,
                "hsn_code": item.hsn_code or "",
            })

        # Fallback item if none provided
        if not items:
            items = [{
                "name": req.product_description or "Product",
                "sku": "DEFAULT",
                "quantity": 1,
                "price": req.invoice_value,
            }]

        payload: Dict[str, Any] = {
            "client_order_id": req.order_id,
            "payment_type": req.payment_mode.upper(),
            "cod_amount": req.cod_amount if req.payment_mode == "COD" else 0,
            "total_amount": req.invoice_value,
            "weight": req.weight_grams,
            "dimensions": {
                "length": req.length_cm,
                "breadth": req.breadth_cm,
                "height": req.height_cm,
            },
            "consignee": {
                "name": req.delivery.name,
                "phone": req.delivery.phone,
                "email": req.delivery.email or "",
                "address": req.delivery.address_line1,
                "address_2": req.delivery.address_line2,
                "city": req.delivery.city,
                "state": req.delivery.state,
                "pincode": req.delivery.pincode,
                "country": req.delivery.country,
            },
            "pickup": {
                "name": req.pickup.name or "Warehouse",
                "phone": req.pickup.phone,
                "address": req.pickup.address_line1,
                "city": req.pickup.city,
                "state": req.pickup.state,
                "pincode": req.pickup.pincode,
            },
            "items": items,
        }

        # Add seller GSTIN if available
        if req.seller_gstin:
            payload["seller_gstin"] = req.seller_gstin

        return payload

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """
        Cancel a shipment by AWB number on Ekart.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        try:
            headers = self._headers()
            resp = await self._client.post(
                f"{self._base_url}/shipments/{awb_number}/cancel",
                json={},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                success = data.get("success", data.get("status", False))
                if success:
                    logger.info(f"Ekart: Cancelled AWB {awb_number}")
                    return True
                else:
                    logger.warning(
                        f"Ekart cancel response for {awb_number}: {data.get('message', 'Unknown error')}"
                    )
                    return False
            else:
                logger.warning(
                    f"Ekart cancel returned status {resp.status_code} for {awb_number}"
                )
                return False
        except Exception as e:
            logger.error(f"Ekart cancel failed for {awb_number}: {e}")
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """
        Get tracking info for a shipment from Ekart.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        try:
            headers = self._headers()
            resp = await self._client.get(
                f"{self._base_url}/shipments/track/{awb_number}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            tracking_data = data.get("data", data)
            scans = tracking_data.get("scans", tracking_data.get("tracking_details", []))

            events = []
            for scan in scans:
                raw_status = scan.get("status", scan.get("status_code", ""))
                oms_status = _map_ekart_status(raw_status)
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

            # Current status from the latest event or top-level field
            current_status = ""
            top_level_status = tracking_data.get("current_status", "")
            if top_level_status:
                current_status = _map_ekart_status(top_level_status).value
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
            logger.error(f"Ekart tracking failed for {awb_number}: {e}")
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
        Get shipping rate quotes from Ekart.
        Ekart rates are typically contract-based and not available via a public API.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        logger.info(
            f"Ekart rate check: {origin_pincode} -> {dest_pincode}, {weight_grams}g"
        )
        # Ekart rates are contract-based — return empty quotes with a note
        return RateResponse(
            success=True,
            quotes=[],
            error="Ekart rates are contract-based. Use agreed rate card for pricing.",
        )

    # ========================================================================
    # Serviceability
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """
        Check if delivery is possible between two pincodes via Ekart.
        Ekart does not expose a public serviceability endpoint. Serviceability
        is typically validated during shipment creation.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        try:
            logger.info(
                f"Ekart serviceability check: {origin_pincode} -> {dest_pincode} "
                "(no dedicated endpoint — validated at shipment creation time)"
            )
            return ServiceabilityResponse(
                success=True,
                is_serviceable=True,
                cod_available=True,
                prepaid_available=True,
                estimated_days=0,
                error="Serviceability is validated at shipment creation time by Ekart",
            )
        except Exception as e:
            logger.error(f"Ekart serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Get shipping label PDF URL for an AWB from Ekart.
        Ekart provides a dedicated label endpoint.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        try:
            headers = self._headers()
            resp = await self._client.get(
                f"{self._base_url}/shipments/{awb_number}/label",
                headers=headers,
            )
            if resp.status_code != 200:
                logger.warning(f"Ekart get_label returned status {resp.status_code} for {awb_number}")
                return None

            # Check if response is a direct PDF binary or JSON with a URL
            content_type = resp.headers.get("content-type", "")
            if "application/json" in content_type:
                data = resp.json()
                label_url = data.get("data", {}).get("label_url", data.get("label_url", ""))
                return label_url if label_url else None
            elif "application/pdf" in content_type:
                # Direct PDF binary — the URL itself is the label
                return f"{self._base_url}/shipments/{awb_number}/label"
            else:
                # Unknown content type — try parsing as JSON
                try:
                    data = resp.json()
                    label_url = data.get("data", {}).get("label_url", data.get("label_url", ""))
                    return label_url if label_url else None
                except Exception:
                    return None

        except Exception as e:
            logger.error(f"Ekart get_label failed for {awb_number}: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions on Ekart.
        Ekart NDR actions are typically handled through their dashboard
        or webhook-based communication.

        Ekart API endpoint may differ - verify with Ekart integration team
        during onboarding.
        """
        logger.info(f"Ekart NDR action: {action} for AWB {awb_number}")
        return {
            "success": True,
            "message": f"NDR action '{action}' recorded for AWB {awb_number}",
            "note": "Ekart NDR actions are processed via their dashboard/webhook. "
                    "Verify API endpoint with Ekart integration team.",
        }
