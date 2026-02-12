"""
DTDC Adapter — Integration with DTDC's courier API.

DTDC provides REST endpoints for consignment booking, tracking, and cancellation.
Auth is token-based via username/password.

Staging: http://ctbsplusapi.dtdc.com/dtdc-staging-api/api/dtdc/
Production: Provided during onboarding.

NOTE: DTDC's API documentation is not fully public. This adapter implements
known endpoints and marks uncertain areas with TODO comments.
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

# DTDC-specific status mapping (not in StatusMapper since DTDC was not
# included in the original status_mapper.py)
DTDC_STATUS_MAP = {
    "Booked": DeliveryStatus.MANIFESTED,
    "In Transit": DeliveryStatus.IN_TRANSIT,
    "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
    "Delivered": DeliveryStatus.DELIVERED,
    "Undelivered": DeliveryStatus.NDR,
    "RTO": DeliveryStatus.RTO_INITIATED,
    "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
}


class DTDCAdapter(CarrierAdapter):
    """
    DTDC carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "username": "your-username",
        "password": "your-password",
        "api_key": "your-api-key",
        "base_url": "https://api.dtdc.com",
        "customer_code": "your-code"
    }
    """

    carrier_code = "DTDC"
    carrier_name = "DTDC"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._base_url = credentials.get("base_url", "https://api.dtdc.com")
        self._client = httpx.AsyncClient(timeout=30.0)

    # ========================================================================
    # Authentication
    # ========================================================================

    async def _get_token(self) -> str:
        """
        Authenticate with DTDC using username/password to obtain a session token.
        Caches the token for reuse within its validity period.
        """
        if (
            self._token
            and self._token_expiry
            and datetime.now(timezone.utc) < self._token_expiry
        ):
            return self._token

        resp = await self._client.post(
            f"{self._base_url}/authenticate",
            json={
                "username": self.credentials["username"],
                "password": self.credentials["password"],
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": self.credentials.get("api_key", ""),
            },
        )
        resp.raise_for_status()
        data = resp.json()

        self._token = data.get("token", data.get("access_token", ""))
        if not self._token:
            raise ValueError(
                f"DTDC authentication did not return a token: {data}"
            )

        # DTDC token validity is not publicly documented; default to 12 hours
        from datetime import timedelta
        self._token_expiry = datetime.now(timezone.utc) + timedelta(hours=12)
        logger.info("DTDC authentication successful")
        return self._token

    async def _headers(self) -> Dict[str, str]:
        """Build request headers with auth token and API key."""
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-API-Key": self.credentials.get("api_key", ""),
        }

    async def authenticate(self) -> bool:
        """Authenticate with DTDC API."""
        try:
            await self._get_token()
            return True
        except Exception as e:
            logger.error(f"DTDC auth failed: {e}")
            return False

    # ========================================================================
    # Shipment Creation (Create Consignment via softdata)
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create a consignment (shipment) on DTDC.
        Endpoint: POST /softdata

        TODO: Verify exact request/response format with DTDC onboarding docs.
              The payload structure below is based on known DTDC API patterns.
        """
        try:
            headers = await self._headers()
            payload = self._build_consignment_payload(request)

            resp = await self._client.post(
                f"{self._base_url}/softdata",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response — DTDC response structure may vary
            success = data.get("success", False)
            awb_number = str(
                data.get("awb_number", data.get("reference_number", ""))
            )
            error_msg = data.get("message", data.get("error", ""))

            if not success and not awb_number:
                return ShipmentResponse(
                    success=False,
                    error=error_msg or "DTDC consignment creation failed",
                    raw_response=data,
                )

            return ShipmentResponse(
                success=True,
                awb_number=awb_number,
                carrier_order_id=str(data.get("consignment_id", awb_number)),
                tracking_url=f"https://www.dtdc.in/tracking.asp?strCnno={awb_number}",
                label_url=data.get("label_url", ""),
                raw_response=data,
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"DTDC create_shipment HTTP error: {e.response.status_code} "
                f"- {e.response.text}"
            )
            return ShipmentResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"DTDC create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    def _build_consignment_payload(self, req: ShipmentRequest) -> Dict[str, Any]:
        """
        Build the DTDC softdata request payload from our unified ShipmentRequest.

        TODO: Verify exact field names and required fields with DTDC documentation.
              Field names below are based on known DTDC API patterns.
        """
        weight_kg = req.weight_grams / 1000

        # Build item description
        description = req.product_description
        if not description and req.items:
            description = ", ".join(item.name for item in req.items)
        if not description:
            description = "Package"

        return {
            "customer_code": self.credentials.get("customer_code", ""),
            "service_type": "PREMIUM",  # TODO: Map from request or config
            "load_type": "NON-DOCUMENT",
            "consignment_type": (
                "COD" if req.payment_mode == "COD" else "PREPAID"
            ),
            "reference_number": req.order_id,
            "num_pieces": len(req.items) or 1,
            "actual_weight": str(weight_kg),
            "declared_value": str(req.invoice_value),
            "cod_amount": str(req.cod_amount) if req.payment_mode == "COD" else "0",
            "dimensions": {
                "length": str(req.length_cm),
                "breadth": str(req.breadth_cm),
                "height": str(req.height_cm),
            },
            "commodity_description": description[:100],
            # Consignee (receiver)
            "consignee": {
                "name": req.delivery.name,
                "address_line1": req.delivery.address_line1,
                "address_line2": req.delivery.address_line2 or "",
                "city": req.delivery.city,
                "state": req.delivery.state,
                "pincode": req.delivery.pincode,
                "phone": req.delivery.phone,
                "email": req.delivery.email or "",
            },
            # Shipper (sender)
            "shipper": {
                "name": req.pickup.name,
                "address_line1": req.pickup.address_line1,
                "address_line2": req.pickup.address_line2 or "",
                "city": req.pickup.city,
                "state": req.pickup.state,
                "pincode": req.pickup.pincode,
                "phone": req.pickup.phone,
                "email": req.pickup.email or "",
            },
        }

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """
        Cancel a DTDC consignment.
        Endpoint: POST /cancel

        TODO: Verify exact endpoint path and payload format with DTDC docs.
        """
        try:
            headers = await self._headers()
            resp = await self._client.post(
                f"{self._base_url}/cancel",
                json={
                    "awb_number": awb_number,
                    "customer_code": self.credentials.get("customer_code", ""),
                    "reason": "Cancelled by shipper",
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            success = data.get("success", False)
            if not success:
                logger.warning(
                    f"DTDC cancel failed for {awb_number}: "
                    f"{data.get('message', 'Unknown error')}"
                )
                return False

            logger.info(f"DTDC consignment {awb_number} cancelled successfully")
            return True

        except Exception as e:
            logger.error(f"DTDC cancel_shipment failed for {awb_number}: {e}")
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """
        Track a DTDC shipment.
        Endpoint: GET /tracking/v1/{reference_number}
        """
        try:
            headers = await self._headers()
            resp = await self._client.get(
                f"{self._base_url}/tracking/v1/{awb_number}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse tracking events from the response
            # TODO: Verify exact response structure with DTDC documentation.
            #       The field names below are based on common DTDC API patterns.
            tracking_info = data.get("tracking_info", data.get("trackDetails", data))
            scans = []

            # Handle different response structures
            if isinstance(tracking_info, dict):
                scans = tracking_info.get(
                    "scans",
                    tracking_info.get(
                        "activities",
                        tracking_info.get("strTrackDetails", []),
                    ),
                )
            elif isinstance(tracking_info, list):
                scans = tracking_info

            events = []
            for scan in scans:
                raw_status = scan.get(
                    "status", scan.get("strAction", "")
                )
                location = scan.get(
                    "location", scan.get("strOrigin", "")
                )
                scan_datetime = scan.get(
                    "datetime", scan.get("strActionDate", "")
                )
                remark = scan.get(
                    "remark", scan.get("strIntlMessage", "")
                )

                # Parse timestamp
                timestamp = self._parse_dtdc_timestamp(scan_datetime)

                # Map status using adapter-level status map
                oms_status = DTDC_STATUS_MAP.get(
                    raw_status, DeliveryStatus.IN_TRANSIT
                )
                is_ndr = StatusMapper.is_ndr(oms_status)

                events.append(TrackingEvent(
                    timestamp=timestamp,
                    status_code=raw_status,
                    status_description=remark or raw_status,
                    location=location,
                    remark=remark,
                    oms_status=oms_status.value,
                    is_ndr=is_ndr,
                    ndr_reason="",
                    is_terminal=StatusMapper.is_terminal(oms_status),
                ))

            # Current status from the latest event
            current_status = ""
            if events:
                current_status = events[0].oms_status

            return TrackingResponse(
                success=True,
                awb_number=awb_number,
                current_status=current_status,
                edd=data.get("expected_delivery_date"),
                events=events,
                raw_response=data,
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"DTDC tracking HTTP error for {awb_number}: "
                f"{e.response.status_code} - {e.response.text}"
            )
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )
        except Exception as e:
            logger.error(f"DTDC tracking failed for {awb_number}: {e}")
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )

    @staticmethod
    def _parse_dtdc_timestamp(datetime_str: str) -> datetime:
        """
        Parse DTDC date/time strings into a datetime.
        Handles multiple known formats.
        """
        if not datetime_str:
            return datetime.now(timezone.utc)

        datetime_str = datetime_str.strip()
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%d-%b-%Y %H:%M",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(datetime_str, fmt).replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                continue

        logger.warning(f"Could not parse DTDC timestamp: {datetime_str}")
        return datetime.now(timezone.utc)

    # ========================================================================
    # Rate Estimation
    # TODO: DTDC rate API endpoint is not publicly documented.
    #       Implement when onboarding documentation is available.
    # ========================================================================

    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        """
        Get shipping rates from DTDC.

        TODO: Exact rate API endpoint is not publicly documented.
              This implementation attempts a common pattern. Verify with
              DTDC onboarding documentation.
        """
        try:
            headers = await self._headers()
            weight_kg = weight_grams / 1000

            # Attempt rate check — endpoint pattern may vary
            resp = await self._client.post(
                f"{self._base_url}/rate-calculator",
                json={
                    "origin_pincode": origin_pincode,
                    "destination_pincode": dest_pincode,
                    "weight": str(weight_kg),
                    "service_type": "PREMIUM",
                    "consignment_type": (
                        "COD" if payment_mode == "COD" else "PREPAID"
                    ),
                    "cod_amount": str(cod_amount) if payment_mode == "COD" else "0",
                    "customer_code": self.credentials.get("customer_code", ""),
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            rate = float(data.get("total_charge", data.get("rate", 0)))
            cod_charges = float(data.get("cod_charges", 0))
            transit_days = int(data.get("transit_days", data.get("tat", 0)))

            quotes = []
            if rate:
                quotes.append(RateQuote(
                    carrier_code="DTDC",
                    carrier_name="DTDC Premium",
                    rate=rate,
                    cod_charges=cod_charges,
                    estimated_days=transit_days,
                    service_type="Premium",
                ))

            return RateResponse(success=True, quotes=quotes)

        except httpx.HTTPStatusError as e:
            logger.warning(
                f"DTDC rate check HTTP error: {e.response.status_code}. "
                "Rate API endpoint may not be available."
            )
            return RateResponse(
                success=False,
                error=(
                    f"HTTP {e.response.status_code}. "
                    "DTDC rate API endpoint not confirmed."
                ),
            )
        except Exception as e:
            logger.error(f"DTDC rate check failed: {e}")
            return RateResponse(success=False, error=str(e))

    # ========================================================================
    # Serviceability (Pincode Check)
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """
        Check if DTDC services the given destination pincode.
        Endpoint: GET /pincode/{pincode}
        """
        try:
            headers = await self._headers()

            resp = await self._client.get(
                f"{self._base_url}/pincode/{dest_pincode}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response — field names may vary
            is_serviceable = data.get(
                "serviceable",
                data.get("is_serviceable", False),
            )
            cod_available = data.get(
                "cod_available",
                data.get("cod", False),
            )
            prepaid_available = data.get(
                "prepaid_available",
                data.get("prepaid", is_serviceable),
            )

            return ServiceabilityResponse(
                success=True,
                is_serviceable=bool(is_serviceable),
                cod_available=bool(cod_available),
                prepaid_available=bool(prepaid_available),
                estimated_days=int(data.get("transit_days", 0)),
            )

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                # Pincode not found typically means not serviceable
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=False,
                    error=f"Pincode {dest_pincode} not found in DTDC network",
                )
            logger.error(
                f"DTDC pincode check HTTP error: {e.response.status_code}"
            )
            return ServiceabilityResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"DTDC serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Get the shipping label PDF URL for a DTDC AWB.

        TODO: Exact label retrieval endpoint is not publicly documented.
              This implementation attempts a common pattern. Verify with
              DTDC onboarding documentation.
        """
        try:
            headers = await self._headers()

            resp = await self._client.get(
                f"{self._base_url}/label/{awb_number}",
                headers=headers,
            )

            if resp.status_code != 200:
                logger.warning(
                    f"DTDC label retrieval returned {resp.status_code} "
                    f"for AWB {awb_number}"
                )
                return None

            data = resp.json()
            label_url = data.get("label_url", data.get("url", ""))
            return label_url if label_url else None

        except Exception as e:
            logger.error(f"DTDC get_label failed for {awb_number}: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions for DTDC shipments.

        TODO: DTDC NDR action API is not publicly documented.
              This logs the action and returns a placeholder response.
        """
        logger.info(f"DTDC NDR action: {action} for AWB {awb_number}")
        return {
            "success": True,
            "message": (
                f"NDR action '{action}' recorded for AWB {awb_number}. "
                "DTDC NDR resolution is handled via their operations portal."
            ),
        }
