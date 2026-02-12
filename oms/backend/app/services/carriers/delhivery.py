"""
Delhivery Adapter -- Direct integration with Delhivery's courier API.
Delhivery is one of India's largest logistics companies offering
Express Parcel, PTL, TL, Cross-border, and B2B/B2C delivery services.

API Docs: https://delhivery-express-api-doc.readme.io/
Staging:  https://staging-express.delhivery.com
Prod:     https://track.delhivery.com

Auth: Static API Token in header  Authorization: Token <api_token>
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

logger = logging.getLogger(__name__)


class DelhiveryAdapter(CarrierAdapter):
    """
    Delhivery carrier adapter.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "api_token": "your-token",
        "base_url": "https://track.delhivery.com",
        "pickup_location": "warehouse-name"
    }
    """

    carrier_code = "DELHIVERY"
    carrier_name = "Delhivery"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._base_url = credentials.get(
            "base_url", "https://track.delhivery.com"
        ).rstrip("/")
        self._api_token = credentials.get("api_token", "")
        self._pickup_location = credentials.get("pickup_location", "")
        self._client_name = credentials.get("client_name", "")
        self._client = httpx.AsyncClient(timeout=30.0)

    # ========================================================================
    # Auth helpers
    # ========================================================================

    def _headers(self) -> Dict[str, str]:
        """Build request headers with static token auth."""
        return {
            "Authorization": f"Token {self._api_token}",
            "Content-Type": "application/json",
        }

    def _form_headers(self) -> Dict[str, str]:
        """Headers for form-encoded endpoints (order creation)."""
        return {
            "Authorization": f"Token {self._api_token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

    async def authenticate(self) -> bool:
        """
        Validate the API token by making a lightweight pincode check.
        Delhivery uses static tokens so there is no login flow.
        """
        try:
            resp = await self._client.get(
                f"{self._base_url}/c/api/pin-codes/json/",
                params={
                    "filter_codes": "110001",
                    "token": self._api_token,
                },
                headers=self._headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                # A valid token returns delivery_codes list
                return "delivery_codes" in data
            logger.error(
                f"Delhivery auth check failed: HTTP {resp.status_code}"
            )
            return False
        except Exception as e:
            logger.error(f"Delhivery auth check failed: {e}")
            return False

    # ========================================================================
    # Shipment Creation
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create a shipment on Delhivery.
        Steps:
          1. (Optional) Fetch a pre-assigned AWB via /waybill/api/fetch/json/
          2. POST order to /api/cmu/create.json as form data
        """
        try:
            # Step 1: Fetch a fresh AWB number (optional -- Delhivery can
            # auto-assign if waybill is left empty, but pre-fetching gives us
            # the AWB immediately in the response).
            awb_number = await self._fetch_waybill()

            # Step 2: Build and submit the order
            pickup_name = (
                request.pickup.name
                or self._pickup_location
                or "Primary"
            )

            # Determine payment mode string for Delhivery
            payment_mode = "COD" if request.payment_mode == "COD" else "Pre-paid"

            # Build product description from items
            product_desc = request.product_description
            if not product_desc and request.items:
                product_desc = ", ".join(
                    f"{item.name} x{item.quantity}" for item in request.items
                )
            product_desc = product_desc or "Package"

            # Collect HSN/GSTIN from first item or request
            hsn_code = ""
            if request.items:
                hsn_code = request.items[0].hsn_code or ""

            shipment_data = {
                "shipments": [
                    {
                        "order": request.order_id,
                        "waybill": awb_number or "",
                        "name": request.delivery.name,
                        "phone": request.delivery.phone,
                        "add": request.delivery.address_line1,
                        "add2": request.delivery.address_line2,
                        "city": request.delivery.city,
                        "state": request.delivery.state,
                        "pin": request.delivery.pincode,
                        "country": request.delivery.country or "India",
                        "payment_mode": payment_mode,
                        "products_desc": product_desc,
                        "cod_amount": str(request.cod_amount) if request.payment_mode == "COD" else "0",
                        "total_amount": str(request.invoice_value or request.cod_amount),
                        "weight": str(request.weight_grams),
                        "seller_gst_tin": request.seller_gstin or "",
                        "hsn_code": hsn_code,
                    }
                ],
                "pickup_location": {
                    "name": pickup_name,
                },
            }

            form_data = {
                "format": "json",
                "data": json.dumps(shipment_data),
            }

            resp = await self._client.post(
                f"{self._base_url}/api/cmu/create.json",
                data=form_data,
                headers=self._form_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response -- Delhivery returns:
            # {"packages": [{"waybill": "...", "status": "Success", ...}], ...}
            # or on error: {"packages": [{"waybill": "", "remarks": ["error msg"], ...}]}
            packages = data.get("packages", [])
            if not packages:
                return ShipmentResponse(
                    success=False,
                    error=f"No packages in Delhivery response: {data}",
                    raw_response=data,
                )

            pkg = packages[0]
            pkg_status = pkg.get("status", "").lower()
            remarks = pkg.get("remarks", [])
            returned_awb = pkg.get("waybill", awb_number or "")

            if pkg_status == "success" or returned_awb:
                tracking_url = (
                    f"https://www.delhivery.com/track/package/{returned_awb}"
                    if returned_awb
                    else ""
                )
                return ShipmentResponse(
                    success=True,
                    awb_number=str(returned_awb),
                    carrier_order_id=str(pkg.get("refnum", request.order_id)),
                    tracking_url=tracking_url,
                    label_url="",  # Labels fetched separately via get_label
                    raw_response=data,
                )
            else:
                error_msg = "; ".join(remarks) if remarks else f"Order failed: {pkg}"
                return ShipmentResponse(
                    success=False,
                    error=error_msg,
                    raw_response=data,
                )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Delhivery create_shipment HTTP error: "
                f"{e.response.status_code} - {e.response.text}"
            )
            return ShipmentResponse(
                success=False,
                error=f"HTTP {e.response.status_code}: {e.response.text}",
            )
        except Exception as e:
            logger.error(f"Delhivery create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    async def _fetch_waybill(self) -> Optional[str]:
        """
        Pre-fetch a single AWB number from Delhivery.
        Returns None if the call fails (order creation will still work
        since Delhivery auto-assigns when waybill is empty).
        """
        try:
            params = {"cl": self._client_name, "count": 1}
            resp = await self._client.get(
                f"{self._base_url}/waybill/api/fetch/json/",
                params=params,
                headers=self._headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                # Response is typically a single waybill string or JSON
                if isinstance(data, str):
                    return data.strip() or None
                return str(data) if data else None
            logger.warning(
                f"Delhivery AWB fetch returned {resp.status_code}, "
                f"will let Delhivery auto-assign"
            )
            return None
        except Exception as e:
            logger.warning(f"Delhivery AWB fetch failed (non-fatal): {e}")
            return None

    # ========================================================================
    # Shipment Cancellation
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """
        Cancel a shipment by POSTing to /api/p/edit with cancellation=true.
        """
        try:
            payload = {
                "waybill": awb_number,
                "cancellation": "true",
            }
            resp = await self._client.post(
                f"{self._base_url}/api/p/edit",
                json=payload,
                headers=self._headers(),
            )
            if resp.status_code == 200:
                logger.info(f"Delhivery shipment {awb_number} cancelled")
                return True
            logger.error(
                f"Delhivery cancel failed for {awb_number}: "
                f"HTTP {resp.status_code} - {resp.text}"
            )
            return False
        except Exception as e:
            logger.error(f"Delhivery cancel_shipment failed: {e}")
            return False

    # ========================================================================
    # Tracking
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """
        Get tracking info from /api/v1/packages/json/?waybill=<awb>.
        Normalizes Delhivery scan events to OMS TrackingEvents.
        """
        try:
            resp = await self._client.get(
                f"{self._base_url}/api/v1/packages/json/",
                params={
                    "waybill": awb_number,
                    "token": self._api_token,
                },
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()

            shipment_data_list = data.get("ShipmentData", [])
            if not shipment_data_list:
                return TrackingResponse(
                    success=False,
                    awb_number=awb_number,
                    error="No ShipmentData in response",
                    raw_response=data,
                )

            shipment = shipment_data_list[0].get("Shipment", {})
            if not shipment:
                return TrackingResponse(
                    success=False,
                    awb_number=awb_number,
                    error="Empty Shipment object in response",
                    raw_response=data,
                )

            # Parse current status
            status_obj = shipment.get("Status", {})
            current_raw_status = status_obj.get("Status", "")
            current_oms_status = StatusMapper.map_delhivery_status(current_raw_status)

            # Parse EDD
            edd = shipment.get("ExpectedDeliveryDate")

            # Parse scan history
            events = self._parse_tracking_events(shipment)

            return TrackingResponse(
                success=True,
                awb_number=awb_number,
                current_status=current_oms_status.value,
                edd=edd,
                events=events,
                raw_response=data,
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Delhivery tracking HTTP error for {awb_number}: "
                f"{e.response.status_code}"
            )
            return TrackingResponse(
                success=False,
                awb_number=awb_number,
                error=f"HTTP {e.response.status_code}: {e.response.text}",
            )
        except Exception as e:
            logger.error(f"Delhivery tracking failed for {awb_number}: {e}")
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )

    def _parse_tracking_events(self, shipment: Dict[str, Any]) -> List[TrackingEvent]:
        """
        Parse the Scans array from a Delhivery tracking response into
        a list of normalised TrackingEvent objects. Latest events first.
        """
        events: List[TrackingEvent] = []
        scans = shipment.get("Scans", [])

        for scan_wrapper in scans:
            detail = scan_wrapper.get("ScanDetail", {})
            if not detail:
                continue

            raw_status = detail.get("Scan", "")
            instructions = detail.get("Instructions", "")
            location = detail.get("ScannedLocation", "")
            scan_dt_str = detail.get("ScanDateTime", "")

            # Parse timestamp
            timestamp = self._parse_datetime(scan_dt_str)

            # Map to OMS status
            oms_status = StatusMapper.map_delhivery_status(raw_status)
            is_ndr = StatusMapper.is_ndr(oms_status)
            ndr_reason = ""
            if is_ndr:
                ndr_reason = StatusMapper.map_delhivery_ndr_reason(
                    instructions or raw_status
                ).value

            events.append(TrackingEvent(
                timestamp=timestamp,
                status_code=raw_status,
                status_description=instructions or raw_status,
                location=location,
                remark=instructions,
                oms_status=oms_status.value,
                is_ndr=is_ndr,
                ndr_reason=ndr_reason,
                is_terminal=StatusMapper.is_terminal(oms_status),
            ))

        return events

    @staticmethod
    def _parse_datetime(dt_string: str) -> datetime:
        """
        Parse a datetime string from Delhivery.  Handles common formats:
          - 2026-02-12T10:00:00
          - 2026-02-12T10:00:00+05:30
          - 2026-02-12 10:00:00
        Falls back to now(UTC) on parse failure.
        """
        if not dt_string:
            return datetime.now(timezone.utc)
        for fmt in (
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S.%f",
        ):
            try:
                return datetime.strptime(dt_string, fmt)
            except ValueError:
                continue
        logger.warning(f"Could not parse Delhivery datetime: {dt_string}")
        return datetime.now(timezone.utc)

    # ========================================================================
    # Rate Calculator
    # ========================================================================

    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        """
        Get shipping rate from /api/kinko/v1/invoice/charges/.json.
        Delhivery returns a single rate (not multi-carrier like Shiprocket).
        """
        try:
            dl_payment_mode = "COD" if payment_mode == "COD" else "Pre-paid"
            params = {
                "md": "S",  # S = Surface, E = Express
                "pt": dl_payment_mode,
                "d_pin": dest_pincode,
                "o_pin": origin_pincode,
                "cgm": str(weight_grams),
            }
            if self._client_name:
                params["cl"] = self._client_name
            if payment_mode == "COD" and cod_amount:
                params["cod"] = str(cod_amount)

            resp = await self._client.get(
                f"{self._base_url}/api/kinko/v1/invoice/charges/.json",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()

            # Delhivery rate response structure varies; common keys:
            #   total_amount, charge_weight, cod_charges, etc.
            total_amount = float(data.get("total_amount", 0))
            cod_charges = float(data.get("cod_charges", 0))
            charge_weight = data.get("charge_weight", weight_grams)

            quotes = [
                RateQuote(
                    carrier_code=self.carrier_code,
                    carrier_name=self.carrier_name,
                    rate=total_amount,
                    cod_charges=cod_charges,
                    estimated_days=int(data.get("estimated_delivery_days", 0)),
                    service_type=data.get("service_type", "Surface"),
                )
            ]

            return RateResponse(success=True, quotes=quotes)

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Delhivery rate check HTTP error: {e.response.status_code}"
            )
            return RateResponse(
                success=False,
                error=f"HTTP {e.response.status_code}: {e.response.text}",
            )
        except Exception as e:
            logger.error(f"Delhivery rate check failed: {e}")
            return RateResponse(success=False, error=str(e))

    # ========================================================================
    # Serviceability (Pincode Check)
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """
        Check if a destination pincode is serviceable via
        /c/api/pin-codes/json/?filter_codes=<pincode>.
        Also checks origin for reverse pickup serviceability.
        """
        try:
            # Check destination pincode
            dest_result = await self._check_pincode(dest_pincode)
            if not dest_result:
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=False,
                    error=f"Destination pincode {dest_pincode} not serviceable",
                )

            # Extract service flags
            is_prepaid = dest_result.get("pre_paid", "N") == "Y"
            is_cod = dest_result.get("cash", "N") == "Y"
            is_pickup = dest_result.get("pickup", "N") == "Y"
            is_repl = dest_result.get("repl", "N") == "Y"

            # Estimated days (Delhivery sometimes includes this)
            estimated_days = int(dest_result.get("max_days", 0))

            # Verify origin is a valid pickup pincode
            origin_result = await self._check_pincode(origin_pincode)
            origin_has_pickup = False
            if origin_result:
                origin_has_pickup = origin_result.get("pickup", "N") == "Y"

            is_serviceable = (is_prepaid or is_cod) and origin_has_pickup

            return ServiceabilityResponse(
                success=True,
                is_serviceable=is_serviceable,
                cod_available=is_cod,
                prepaid_available=is_prepaid,
                estimated_days=estimated_days,
            )

        except Exception as e:
            logger.error(f"Delhivery serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    async def _check_pincode(self, pincode: str) -> Optional[Dict[str, Any]]:
        """
        Check a single pincode against Delhivery's pincode database.
        Returns the first matching delivery_codes entry or None.
        """
        try:
            resp = await self._client.get(
                f"{self._base_url}/c/api/pin-codes/json/",
                params={
                    "filter_codes": pincode,
                    "token": self._api_token,
                },
                headers=self._headers(),
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            delivery_codes = data.get("delivery_codes", [])
            if not delivery_codes:
                return None

            # Return the postal_code object from the first match
            return delivery_codes[0].get("postal_code", {})
        except Exception as e:
            logger.warning(f"Delhivery pincode check failed for {pincode}: {e}")
            return None

    # ========================================================================
    # Label (Packing Slip)
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Fetch the packing slip / shipping label URL for an AWB.
        Delhivery returns an HTML/PDF at /api/p/packing_slip?wbns=<awb>.
        We return the direct URL so the frontend can open/download it.
        """
        try:
            label_url = (
                f"{self._base_url}/api/p/packing_slip"
                f"?wbns={awb_number}&token={self._api_token}"
            )
            # Verify the URL is accessible (HEAD request)
            resp = await self._client.head(
                label_url,
                headers=self._headers(),
            )
            if resp.status_code == 200:
                return label_url
            logger.warning(
                f"Delhivery label not available for {awb_number}: "
                f"HTTP {resp.status_code}"
            )
            return None
        except Exception as e:
            logger.error(f"Delhivery get_label failed for {awb_number}: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Submit an NDR action to Delhivery via POST /api/p/update.

        Supported actions:
          - RE-ATTEMPT: reattempt delivery
          - DEFER_DLV: defer delivery to a later date
          - EDIT_DETAILS: update consignee phone / address before reattempt

        kwargs may include:
          - phone: updated consignee phone
          - address: updated delivery address
          - name: updated consignee name
          - defer_date: date to defer delivery to (YYYY-MM-DD)
        """
        try:
            # Validate action
            valid_actions = {"RE-ATTEMPT", "DEFER_DLV", "EDIT_DETAILS", "RTO"}
            normalised_action = action.upper().replace("_", "-").replace(" ", "-")
            # Map common OMS action names to Delhivery action names
            action_map = {
                "REATTEMPT": "RE-ATTEMPT",
                "RE-ATTEMPT": "RE-ATTEMPT",
                "DEFER": "DEFER_DLV",
                "DEFER-DLV": "DEFER_DLV",
                "DEFER_DLV": "DEFER_DLV",
                "EDIT-DETAILS": "EDIT_DETAILS",
                "EDIT_DETAILS": "EDIT_DETAILS",
                "RTO": "RTO",
                "RETURN": "RTO",
            }
            dl_action = action_map.get(normalised_action, normalised_action)

            if dl_action not in valid_actions:
                return {
                    "success": False,
                    "error": (
                        f"Invalid NDR action '{action}'. "
                        f"Supported: {', '.join(sorted(valid_actions))}"
                    ),
                }

            payload: Dict[str, Any] = {
                "waybill": awb_number,
                "action": dl_action,
            }

            # Add optional fields based on action
            if dl_action == "EDIT_DETAILS":
                if kwargs.get("phone"):
                    payload["phone"] = kwargs["phone"]
                if kwargs.get("address"):
                    payload["add"] = kwargs["address"]
                if kwargs.get("name"):
                    payload["name"] = kwargs["name"]
                if kwargs.get("pincode"):
                    payload["pin"] = kwargs["pincode"]

            if dl_action == "DEFER_DLV" and kwargs.get("defer_date"):
                payload["defer_date"] = kwargs["defer_date"]

            resp = await self._client.post(
                f"{self._base_url}/api/p/update",
                json=payload,
                headers=self._headers(),
            )

            if resp.status_code == 200:
                resp_data = resp.json() if resp.text else {}
                logger.info(
                    f"Delhivery NDR action '{dl_action}' submitted "
                    f"for AWB {awb_number}"
                )
                return {
                    "success": True,
                    "message": (
                        f"NDR action '{dl_action}' submitted for AWB {awb_number}"
                    ),
                    "data": resp_data,
                }
            else:
                error_text = resp.text
                logger.error(
                    f"Delhivery NDR action failed for {awb_number}: "
                    f"HTTP {resp.status_code} - {error_text}"
                )
                return {
                    "success": False,
                    "error": (
                        f"HTTP {resp.status_code}: {error_text}"
                    ),
                }

        except Exception as e:
            logger.error(
                f"Delhivery NDR action failed for {awb_number}: {e}"
            )
            return {"success": False, "error": str(e)}

    # ========================================================================
    # Pickup Request
    # ========================================================================

    async def request_pickup(self, shipment_ids: List[str]) -> Dict[str, Any]:
        """
        Request a pickup via POST /fm/request/new/.

        shipment_ids: list of AWB numbers or order references to include
                      in the pickup request.
        """
        try:
            pickup_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

            payload = {
                "pickup_location": self._pickup_location or "Primary",
                "expected_package_count": len(shipment_ids),
                "pickup_date": pickup_time,
                "pickup_time": pickup_time,
                "shipments": shipment_ids,
            }

            resp = await self._client.post(
                f"{self._base_url}/fm/request/new/",
                json=payload,
                headers=self._headers(),
            )

            if resp.status_code == 200:
                resp_data = resp.json() if resp.text else {}
                pickup_id = resp_data.get("pickup_id", "")
                logger.info(
                    f"Delhivery pickup requested: {pickup_id} "
                    f"for {len(shipment_ids)} shipment(s)"
                )
                return {
                    "success": True,
                    "pickup_id": pickup_id,
                    "data": resp_data,
                }
            else:
                error_text = resp.text
                logger.error(
                    f"Delhivery pickup request failed: "
                    f"HTTP {resp.status_code} - {error_text}"
                )
                return {
                    "success": False,
                    "error": f"HTTP {resp.status_code}: {error_text}",
                }

        except Exception as e:
            logger.error(f"Delhivery pickup request failed: {e}")
            return {"success": False, "error": str(e)}

    # ========================================================================
    # Warehouse Management (utility -- not part of CarrierAdapter interface)
    # ========================================================================

    async def create_warehouse(
        self,
        name: str,
        address: str,
        city: str,
        state: str,
        pincode: str,
        phone: str,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Register a warehouse/pickup location with Delhivery via
        POST /api/backend/clientwarehouse/create/.
        Must be called before using a pickup_location name in orders.
        """
        try:
            payload = {
                "name": name,
                "phone": phone,
                "address": address,
                "city": city,
                "state": state,
                "pin": pincode,
                "country": kwargs.get("country", "India"),
                "registered_name": kwargs.get("registered_name", name),
                "return_address": kwargs.get("return_address", address),
                "return_city": kwargs.get("return_city", city),
                "return_state": kwargs.get("return_state", state),
                "return_pin": kwargs.get("return_pin", pincode),
                "return_country": kwargs.get("return_country", "India"),
            }

            resp = await self._client.post(
                f"{self._base_url}/api/backend/clientwarehouse/create/",
                json=payload,
                headers=self._headers(),
            )

            if resp.status_code in (200, 201):
                resp_data = resp.json() if resp.text else {}
                logger.info(f"Delhivery warehouse '{name}' created")
                return {"success": True, "data": resp_data}
            else:
                error_text = resp.text
                logger.error(
                    f"Delhivery warehouse creation failed: "
                    f"HTTP {resp.status_code} - {error_text}"
                )
                return {
                    "success": False,
                    "error": f"HTTP {resp.status_code}: {error_text}",
                }

        except Exception as e:
            logger.error(f"Delhivery warehouse creation failed: {e}")
            return {"success": False, "error": str(e)}
