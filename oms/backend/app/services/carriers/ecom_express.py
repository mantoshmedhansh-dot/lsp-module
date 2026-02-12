"""
Ecom Express Adapter — Integration with Ecom Express courier API.

Ecom Express uses form-encoded data (not JSON body) for most endpoints.
Auth is via username/password passed as form fields in every request.

Portal: https://integration.ecomexpress.in/
Base URL: https://api.ecomexpress.in

Key differences from other carriers:
- AWB numbers must be pre-fetched before manifest
- Most endpoints use application/x-www-form-urlencoded
- Manifest data is passed as a JSON string inside a form field
- Tracking supports comma-separated AWBs for bulk tracking
"""
import json
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

# Ecom Express-specific status mapping
ECOM_STATUS_MAP = {
    "Manifested": DeliveryStatus.MANIFESTED,
    "Picked Up": DeliveryStatus.SHIPPED,
    "In Transit": DeliveryStatus.IN_TRANSIT,
    "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
    "Delivered": DeliveryStatus.DELIVERED,
    "Undelivered": DeliveryStatus.NDR,
    "RTO Initiated": DeliveryStatus.RTO_INITIATED,
    "RTO In Transit": DeliveryStatus.RTO_IN_TRANSIT,
    "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
    "Cancelled": DeliveryStatus.CANCELLED,
}


class EcomExpressAdapter(CarrierAdapter):
    """
    Ecom Express carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "username": "your-username",
        "password": "your-password",
        "base_url": "https://api.ecomexpress.in"
    }
    """

    carrier_code = "ECOM_EXPRESS"
    carrier_name = "Ecom Express"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._base_url = credentials.get(
            "base_url", "https://api.ecomexpress.in"
        )
        self._client = httpx.AsyncClient(timeout=30.0)

    def _auth_form_data(self) -> Dict[str, str]:
        """
        Return the username/password fields required by all Ecom Express
        API calls as form data.
        """
        return {
            "username": self.credentials["username"],
            "password": self.credentials["password"],
        }

    # ========================================================================
    # Authentication
    # ========================================================================

    async def authenticate(self) -> bool:
        """
        Verify credentials by attempting to fetch a single AWB.
        Ecom Express does not have a dedicated auth endpoint; credentials
        are validated on every API call via form fields.
        """
        try:
            form_data = self._auth_form_data()
            form_data["count"] = "1"
            form_data["type"] = "PPD"  # Prepaid

            resp = await self._client.post(
                f"{self._base_url}/apiv2/fetch_awb/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            # A successful response means credentials are valid
            if data.get("success") is False or "error" in str(data).lower():
                logger.error(
                    f"Ecom Express auth check failed: {data}"
                )
                return False

            logger.info("Ecom Express authentication successful")
            return True

        except Exception as e:
            logger.error(f"Ecom Express auth failed: {e}")
            return False

    # ========================================================================
    # AWB Fetch (Ecom Express-specific prerequisite for manifest)
    # ========================================================================

    async def fetch_awb(
        self, count: int = 1, awb_type: str = "PPD"
    ) -> List[str]:
        """
        Fetch pre-allocated AWB numbers from Ecom Express.
        Must be called before creating a manifest.

        Args:
            count: Number of AWBs to fetch (1-50)
            awb_type: "PPD" (Prepaid), "COD" (Cash on Delivery), "RVP" (Reverse Pickup)

        Returns:
            List of AWB number strings.
        """
        try:
            form_data = self._auth_form_data()
            form_data["count"] = str(count)
            form_data["type"] = awb_type.upper()

            resp = await self._client.post(
                f"{self._base_url}/apiv2/fetch_awb/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            # Response may contain AWBs in different formats
            awb_list = data.get("awb", [])
            if isinstance(awb_list, str):
                awb_list = [awb_list]
            elif isinstance(awb_list, list):
                awb_list = [str(a) for a in awb_list]
            else:
                awb_list = []

            if not awb_list:
                logger.warning(
                    f"Ecom Express fetch_awb returned no AWBs: {data}"
                )

            return awb_list

        except Exception as e:
            logger.error(f"Ecom Express fetch_awb failed: {e}")
            return []

    # ========================================================================
    # Shipment Creation (Manifest AWB)
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create a shipment on Ecom Express. Two steps:
        1. Fetch an AWB number (fetch_awb)
        2. Manifest the shipment with that AWB (manifest_awb)
        """
        try:
            # Step 1: Fetch an AWB number
            awb_type = "COD" if request.payment_mode == "COD" else "PPD"
            awb_list = await self.fetch_awb(count=1, awb_type=awb_type)

            if not awb_list:
                return ShipmentResponse(
                    success=False,
                    error="Failed to fetch AWB number from Ecom Express",
                )

            awb_number = awb_list[0]

            # Step 2: Manifest the shipment
            manifest_payload = self._build_manifest_payload(request, awb_number)
            form_data = self._auth_form_data()
            form_data["json_input"] = json.dumps([manifest_payload])

            resp = await self._client.post(
                f"{self._base_url}/apiv2/manifest_awb/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response — Ecom Express returns an array of results
            shipments = data if isinstance(data, list) else data.get("shipments", [data])

            if not shipments:
                return ShipmentResponse(
                    success=False,
                    error="Ecom Express manifest returned empty response",
                    raw_response=data if isinstance(data, dict) else {"response": data},
                )

            result = shipments[0] if isinstance(shipments, list) else shipments
            success = result.get("success", True)
            error_msg = result.get("reason", result.get("error", ""))

            if not success or error_msg:
                return ShipmentResponse(
                    success=False,
                    awb_number=awb_number,
                    error=error_msg or "Ecom Express manifest failed",
                    raw_response=data if isinstance(data, dict) else {"response": data},
                )

            return ShipmentResponse(
                success=True,
                awb_number=awb_number,
                carrier_order_id=awb_number,
                tracking_url=(
                    f"https://ecomexpress.in/tracking/?awb_field={awb_number}"
                ),
                label_url="",  # Labels retrieved separately
                raw_response=data if isinstance(data, dict) else {"response": data},
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Ecom Express create_shipment HTTP error: "
                f"{e.response.status_code} - {e.response.text}"
            )
            return ShipmentResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"Ecom Express create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    def _build_manifest_payload(
        self, req: ShipmentRequest, awb_number: str
    ) -> Dict[str, Any]:
        """
        Build the Ecom Express manifest json_input structure.
        This is a single shipment object within the JSON array.
        """
        weight_kg = req.weight_grams / 1000

        # Build item description
        description = req.product_description
        if not description and req.items:
            description = ", ".join(item.name for item in req.items)
        if not description:
            description = "Package"

        collectable_value = str(req.cod_amount) if req.payment_mode == "COD" else "0"

        return {
            "AWB_NUMBER": awb_number,
            "ORDER_NUMBER": req.order_id,
            "PRODUCT": "COD" if req.payment_mode == "COD" else "PPD",
            "CONSIGNEE": req.delivery.name,
            "CONSIGNEE_ADDRESS1": req.delivery.address_line1,
            "CONSIGNEE_ADDRESS2": req.delivery.address_line2 or "",
            "CONSIGNEE_ADDRESS3": "",
            "DESTINATION_CITY": req.delivery.city,
            "PINCODE": req.delivery.pincode,
            "STATE": req.delivery.state,
            "MOBILE": req.delivery.phone,
            "TELEPHONE": req.delivery.phone,
            "EMAIL": req.delivery.email or "",
            "ITEM_DESCRIPTION": description[:100],
            "PIECES": len(req.items) or 1,
            "ACTUAL_WEIGHT": str(weight_kg),
            "LENGTH": str(req.length_cm),
            "BREADTH": str(req.breadth_cm),
            "HEIGHT": str(req.height_cm),
            "DECLARED_VALUE": str(req.invoice_value),
            "COLLECTABLE_VALUE": collectable_value,
            "DG_SHIPMENT": False,
            "SELLER_NAME": req.pickup.name,
            "SELLER_ADDRESS": req.pickup.address_line1,
            "SELLER_CST_NO": "",
            "SELLER_TIN": req.seller_gstin or "",
            "PICKUP_NAME": req.pickup.name,
            "PICKUP_ADDRESS_LINE1": req.pickup.address_line1,
            "PICKUP_ADDRESS_LINE2": req.pickup.address_line2 or "",
            "PICKUP_PINCODE": req.pickup.pincode,
            "PICKUP_PHONE": req.pickup.phone,
            "PICKUP_MOBILE": req.pickup.phone,
            "RETURN_NAME": req.pickup.name,
            "RETURN_ADDRESS_LINE1": req.pickup.address_line1,
            "RETURN_ADDRESS_LINE2": req.pickup.address_line2 or "",
            "RETURN_PINCODE": req.pickup.pincode,
            "RETURN_PHONE": req.pickup.phone,
            "RETURN_MOBILE": req.pickup.phone,
        }

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """
        Cancel an AWB on Ecom Express.
        Endpoint: POST /apiv2/cancel_awb/
        Uses form-encoded data with comma-separated AWBs.
        """
        try:
            form_data = self._auth_form_data()
            form_data["awbs"] = awb_number

            resp = await self._client.post(
                f"{self._base_url}/apiv2/cancel_awb/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response
            if isinstance(data, list) and data:
                result = data[0]
                success = result.get("success", False)
                if not success:
                    logger.warning(
                        f"Ecom Express cancel failed for {awb_number}: "
                        f"{result.get('reason', 'Unknown error')}"
                    )
                    return False
                return True
            elif isinstance(data, dict):
                success = data.get("success", False)
                if not success:
                    logger.warning(
                        f"Ecom Express cancel failed for {awb_number}: "
                        f"{data.get('reason', data.get('error', 'Unknown error'))}"
                    )
                    return False
                return True

            logger.warning(
                f"Ecom Express cancel returned unexpected response for "
                f"{awb_number}: {data}"
            )
            return False

        except Exception as e:
            logger.error(
                f"Ecom Express cancel_shipment failed for {awb_number}: {e}"
            )
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """
        Track an Ecom Express shipment.
        Endpoint: GET /apiv2/track_me/
        Supports comma-separated AWBs for bulk tracking.
        """
        try:
            params = {
                "username": self.credentials["username"],
                "password": self.credentials["password"],
                "awb": awb_number,
            }

            resp = await self._client.get(
                f"{self._base_url}/apiv2/track_me/",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

            # Ecom Express returns tracking as a list of shipment objects
            shipment_list = data if isinstance(data, list) else [data]

            # Find the shipment matching our AWB
            shipment_data = None
            for shipment in shipment_list:
                if str(shipment.get("awb_number", "")) == awb_number:
                    shipment_data = shipment
                    break

            if not shipment_data and shipment_list:
                shipment_data = shipment_list[0]

            if not shipment_data:
                return TrackingResponse(
                    success=False,
                    awb_number=awb_number,
                    error="No tracking data found for this AWB",
                    raw_response=data if isinstance(data, dict) else {"response": data},
                )

            # Parse tracking scans
            scans = shipment_data.get(
                "scans",
                shipment_data.get("track_details", []),
            )

            events = []
            for scan in scans:
                raw_status = scan.get(
                    "status", scan.get("scan_status", "")
                )
                location = scan.get(
                    "location", scan.get("city_name", "")
                )
                scan_datetime = scan.get(
                    "updated_on",
                    scan.get("scan_datetime", scan.get("date", "")),
                )
                remark = scan.get(
                    "reason_code_description",
                    scan.get("remark", raw_status),
                )

                # Parse timestamp
                timestamp = self._parse_ecom_timestamp(scan_datetime)

                # Map status using adapter-level status map
                oms_status = ECOM_STATUS_MAP.get(
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

            # Current status from the latest event or shipment-level field
            current_status = shipment_data.get("current_status", "")
            if current_status:
                mapped = ECOM_STATUS_MAP.get(
                    current_status, DeliveryStatus.IN_TRANSIT
                )
                current_status = mapped.value
            elif events:
                current_status = events[0].oms_status

            # Expected delivery date
            edd = shipment_data.get(
                "expected_date",
                shipment_data.get("expected_delivery_date"),
            )

            return TrackingResponse(
                success=True,
                awb_number=awb_number,
                current_status=current_status,
                edd=edd,
                events=events,
                raw_response=data if isinstance(data, dict) else {"response": data},
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Ecom Express tracking HTTP error for {awb_number}: "
                f"{e.response.status_code} - {e.response.text}"
            )
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )
        except Exception as e:
            logger.error(
                f"Ecom Express tracking failed for {awb_number}: {e}"
            )
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )

    @staticmethod
    def _parse_ecom_timestamp(datetime_str: str) -> datetime:
        """
        Parse Ecom Express date/time strings into a datetime.
        Handles multiple known formats.
        """
        if not datetime_str:
            return datetime.now(timezone.utc)

        datetime_str = datetime_str.strip()
        for fmt in (
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
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

        logger.warning(
            f"Could not parse Ecom Express timestamp: {datetime_str}"
        )
        return datetime.now(timezone.utc)

    # ========================================================================
    # Rate Estimation
    # Ecom Express rate calculation is typically done offline or via their
    # portal. No publicly documented rate API endpoint exists.
    # ========================================================================

    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        """
        Get shipping rates from Ecom Express.

        Ecom Express does not provide a public rate calculation API.
        Rates are typically agreed upon during onboarding and managed
        offline. This method returns an empty response.

        TODO: Integrate with rate card logic if Ecom Express provides
              a rate API during onboarding, or implement offline rate
              card lookup from TransporterConfig.
        """
        logger.info(
            "Ecom Express rate API is not publicly available. "
            "Rates are managed via offline rate cards."
        )
        return RateResponse(
            success=False,
            error=(
                "Ecom Express does not provide a public rate API. "
                "Rates are agreed during onboarding and managed offline."
            ),
        )

    # ========================================================================
    # Serviceability (Pincode Check)
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """
        Check if Ecom Express services the given pincode pair.

        Ecom Express provides a pincode serviceability check via their portal.
        This implementation attempts the API endpoint if available.
        """
        try:
            form_data = self._auth_form_data()
            form_data["pincode"] = dest_pincode

            resp = await self._client.post(
                f"{self._base_url}/apiv2/pincodes/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response
            if isinstance(data, list) and data:
                pincode_info = data[0]
            elif isinstance(data, dict):
                pincode_info = data
            else:
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=False,
                    error=f"Pincode {dest_pincode} not found",
                )

            # Check serviceability flags
            is_serviceable = bool(pincode_info.get("inc_oda", False)) or bool(
                pincode_info.get("serviceable", False)
            )
            cod_available = bool(pincode_info.get("cod", False))
            prepaid_available = bool(
                pincode_info.get("prepaid", is_serviceable)
            )

            return ServiceabilityResponse(
                success=True,
                is_serviceable=is_serviceable,
                cod_available=cod_available,
                prepaid_available=prepaid_available,
                estimated_days=int(pincode_info.get("transit_days", 0)),
            )

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=False,
                    error=f"Pincode {dest_pincode} not found in Ecom Express network",
                )
            logger.error(
                f"Ecom Express pincode check HTTP error: {e.response.status_code}"
            )
            return ServiceabilityResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"Ecom Express serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Get the shipping label for an Ecom Express AWB.

        Ecom Express typically provides labels as part of manifest confirmation
        or via a separate label download endpoint.
        """
        try:
            form_data = self._auth_form_data()
            form_data["awb"] = awb_number

            resp = await self._client.post(
                f"{self._base_url}/apiv2/label/",
                data=form_data,
            )

            if resp.status_code != 200:
                logger.warning(
                    f"Ecom Express label retrieval returned "
                    f"{resp.status_code} for AWB {awb_number}"
                )
                return None

            # Check if response is JSON (URL) or binary (PDF content)
            content_type = resp.headers.get("content-type", "")
            if "application/json" in content_type:
                data = resp.json()
                label_url = data.get("label_url", data.get("url", ""))
                return label_url if label_url else None
            elif "application/pdf" in content_type:
                # Response is a direct PDF — cannot return as URL
                logger.info(
                    f"Ecom Express returned direct PDF label for {awb_number}. "
                    "URL not available; binary content returned."
                )
                return None

            return None

        except Exception as e:
            logger.error(
                f"Ecom Express get_label failed for {awb_number}: {e}"
            )
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions for Ecom Express shipments.

        Ecom Express supports NDR actions via their API for reattempt and RTO.
        """
        try:
            form_data = self._auth_form_data()
            form_data["awb"] = awb_number
            form_data["action"] = action.upper()

            # Include additional parameters for reattempt/address update
            if action.upper() == "REATTEMPT":
                form_data["remarks"] = kwargs.get("remarks", "Reattempt delivery")
                if "phone" in kwargs:
                    form_data["phone"] = kwargs["phone"]
                if "address" in kwargs:
                    form_data["address"] = kwargs["address"]
            elif action.upper() == "RTO":
                form_data["remarks"] = kwargs.get("remarks", "Return to origin")

            resp = await self._client.post(
                f"{self._base_url}/apiv2/ndr_action/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            success = data.get("success", True)
            return {
                "success": success,
                "message": data.get(
                    "message",
                    f"NDR action '{action}' submitted for AWB {awb_number}",
                ),
                "raw_response": data,
            }

        except Exception as e:
            logger.error(
                f"Ecom Express NDR action failed for {awb_number}: {e}"
            )
            return {
                "success": False,
                "error": str(e),
                "message": (
                    f"NDR action '{action}' failed for AWB {awb_number}: {e}"
                ),
            }

    # ========================================================================
    # Bulk Operations (Ecom Express-specific)
    # ========================================================================

    async def bulk_track(self, awb_numbers: List[str]) -> List[TrackingResponse]:
        """
        Track multiple AWBs in a single API call.
        Ecom Express supports comma-separated AWBs in the track endpoint.
        """
        if not awb_numbers:
            return []

        try:
            params = {
                "username": self.credentials["username"],
                "password": self.credentials["password"],
                "awb": ",".join(awb_numbers),
            }

            resp = await self._client.get(
                f"{self._base_url}/apiv2/track_me/",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse bulk tracking response
            shipment_list = data if isinstance(data, list) else [data]

            results = []
            for shipment in shipment_list:
                awb = str(shipment.get("awb_number", ""))
                scans = shipment.get(
                    "scans", shipment.get("track_details", [])
                )

                events = []
                for scan in scans:
                    raw_status = scan.get("status", scan.get("scan_status", ""))
                    timestamp = self._parse_ecom_timestamp(
                        scan.get(
                            "updated_on",
                            scan.get("scan_datetime", scan.get("date", "")),
                        )
                    )
                    oms_status = ECOM_STATUS_MAP.get(
                        raw_status, DeliveryStatus.IN_TRANSIT
                    )

                    events.append(TrackingEvent(
                        timestamp=timestamp,
                        status_code=raw_status,
                        status_description=scan.get(
                            "reason_code_description", raw_status
                        ),
                        location=scan.get(
                            "location", scan.get("city_name", "")
                        ),
                        remark=scan.get("reason_code_description", ""),
                        oms_status=oms_status.value,
                        is_ndr=StatusMapper.is_ndr(oms_status),
                        ndr_reason="",
                        is_terminal=StatusMapper.is_terminal(oms_status),
                    ))

                current_status = ""
                if events:
                    current_status = events[0].oms_status

                results.append(TrackingResponse(
                    success=True,
                    awb_number=awb,
                    current_status=current_status,
                    events=events,
                    raw_response=shipment,
                ))

            return results

        except Exception as e:
            logger.error(f"Ecom Express bulk_track failed: {e}")
            # Return error responses for all AWBs
            return [
                TrackingResponse(success=False, awb_number=awb, error=str(e))
                for awb in awb_numbers
            ]

    async def bulk_cancel(self, awb_numbers: List[str]) -> Dict[str, bool]:
        """
        Cancel multiple AWBs in a single API call.
        Returns a dict mapping AWB number to success status.
        """
        if not awb_numbers:
            return {}

        try:
            form_data = self._auth_form_data()
            form_data["awbs"] = ",".join(awb_numbers)

            resp = await self._client.post(
                f"{self._base_url}/apiv2/cancel_awb/",
                data=form_data,
            )
            resp.raise_for_status()
            data = resp.json()

            results = {}
            if isinstance(data, list):
                for item in data:
                    awb = str(item.get("awb_number", item.get("awb", "")))
                    results[awb] = item.get("success", False)
            elif isinstance(data, dict):
                # Single result or bulk result in dict format
                results = {
                    awb: data.get("success", False) for awb in awb_numbers
                }

            return results

        except Exception as e:
            logger.error(f"Ecom Express bulk_cancel failed: {e}")
            return {awb: False for awb in awb_numbers}
