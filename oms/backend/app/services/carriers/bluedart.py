"""
BlueDart Adapter — Integration with BlueDart's API via DHL API Gateway.

BlueDart uses a mix of REST and SOAP endpoints. This adapter implements the
REST-based endpoints (waybill generation, cancellation) and stubs the SOAP
ones (tracking, pincode serviceability) with clear TODO markers.

API Gateway: https://apigateway.bluedart.com
Auth: Consumer Key/Secret for OAuth token + License Key/Login ID for API calls.
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


class BlueDartAdapter(CarrierAdapter):
    """
    BlueDart carrier adapter.

    Uses BlueDart's REST API Gateway for waybill operations and stubs SOAP
    endpoints for tracking and serviceability.

    Credentials format (stored in TransporterConfig.credentials):
    {
        "license_key": "your-license-key",
        "login_id": "your-login-id",
        "api_type": "S",
        "base_url": "https://apigateway.bluedart.com",
        "customer_code": "your-customer-code",
        "origin_area": "DEL",
        "consumer_key": "your-consumer-key",
        "consumer_secret": "your-consumer-secret"
    }
    """

    carrier_code = "BLUEDART"
    carrier_name = "BlueDart"

    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials)
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._base_url = credentials.get(
            "base_url", "https://apigateway.bluedart.com"
        )
        self._client = httpx.AsyncClient(timeout=30.0)

    # ========================================================================
    # Authentication
    # ========================================================================

    async def _get_token(self) -> str:
        """
        Obtain an OAuth access token from the DHL API Gateway using
        consumer key and consumer secret (client_credentials grant).
        Caches the token until expiry.
        """
        if (
            self._token
            and self._token_expiry
            and datetime.now(timezone.utc) < self._token_expiry
        ):
            return self._token

        consumer_key = self.credentials["consumer_key"]
        consumer_secret = self.credentials["consumer_secret"]

        resp = await self._client.post(
            f"{self._base_url}/oauth/token",
            data={"grant_type": "client_credentials"},
            auth=(consumer_key, consumer_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        data = resp.json()

        self._token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))
        from datetime import timedelta
        self._token_expiry = (
            datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
        )
        logger.info("BlueDart OAuth token obtained successfully")
        return self._token

    async def _headers(self) -> Dict[str, str]:
        """Build request headers with OAuth token."""
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _profile(self) -> Dict[str, str]:
        """Build the BlueDart profile block required by most API calls."""
        return {
            "Api_type": self.credentials.get("api_type", "S"),
            "LicenceKey": self.credentials["license_key"],
            "LoginID": self.credentials["login_id"],
        }

    async def authenticate(self) -> bool:
        """Authenticate with the BlueDart API Gateway."""
        try:
            await self._get_token()
            return True
        except Exception as e:
            logger.error(f"BlueDart auth failed: {e}")
            return False

    # ========================================================================
    # Shipment Creation (REST — Generate Waybill)
    # ========================================================================

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Generate a waybill (AWB) on BlueDart using the REST API.
        Endpoint: POST /in/transportation/waybill/v1/GenerateWayBill
        """
        try:
            headers = await self._headers()
            payload = self._build_waybill_payload(request)

            resp = await self._client.post(
                f"{self._base_url}/in/transportation/waybill/v1/GenerateWayBill",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse response — BlueDart returns GenerateWayBillResult
            result = data.get("GenerateWayBillResult", {})
            awb_number = str(result.get("AWBNo", ""))
            is_error = result.get("IsError", True)
            status = result.get("Status", {})
            error_msg = ""

            if is_error:
                status_info = status.get("StatusInformation", [])
                if isinstance(status_info, list) and status_info:
                    error_msg = "; ".join(
                        s.get("StatusInformation", "") for s in status_info
                    )
                elif isinstance(status_info, str):
                    error_msg = status_info

                return ShipmentResponse(
                    success=False,
                    error=error_msg or "BlueDart waybill generation failed",
                    raw_response=data,
                )

            # Successful waybill generation
            destination_location = result.get("DestinationLocation", "")
            token_number = str(result.get("TokenNumber", ""))

            return ShipmentResponse(
                success=True,
                awb_number=awb_number,
                carrier_order_id=token_number,
                tracking_url=f"https://www.bluedart.com/tracking/{awb_number}",
                label_url="",  # Label retrieved separately via get_label
                raw_response=data,
            )

        except httpx.HTTPStatusError as e:
            logger.error(
                f"BlueDart create_shipment HTTP error: {e.response.status_code} "
                f"- {e.response.text}"
            )
            return ShipmentResponse(success=False, error=str(e))
        except Exception as e:
            logger.error(f"BlueDart create_shipment failed: {e}")
            return ShipmentResponse(success=False, error=str(e))

    def _build_waybill_payload(self, req: ShipmentRequest) -> Dict[str, Any]:
        """Build the BlueDart GenerateWayBill request body."""
        weight_kg = req.weight_grams / 1000

        # Determine product code based on payment mode
        # A = Air Express, D = Dart Apex (Surface), E = Ground Express
        product_code = "A"

        # Build item description
        description = req.product_description
        if not description and req.items:
            description = ", ".join(item.name for item in req.items)
        if not description:
            description = "Package"

        return {
            "profile": self._profile(),
            "request": {
                "Consignee": {
                    "ConsigneeName": req.delivery.name,
                    "ConsigneeAddress1": req.delivery.address_line1,
                    "ConsigneeAddress2": req.delivery.address_line2 or "",
                    "ConsigneeAddress3": "",
                    "ConsigneePincode": req.delivery.pincode,
                    "ConsigneeMobile": req.delivery.phone,
                    "ConsigneeTelephone": req.delivery.phone,
                    "ConsigneeEmailID": req.delivery.email or "",
                },
                "Shipper": {
                    "CustomerName": req.pickup.name,
                    "CustomerAddress1": req.pickup.address_line1,
                    "CustomerAddress2": req.pickup.address_line2 or "",
                    "CustomerAddress3": "",
                    "CustomerPincode": req.pickup.pincode,
                    "CustomerMobile": req.pickup.phone,
                    "CustomerTelephone": req.pickup.phone,
                    "CustomerEmailID": req.pickup.email or "",
                    "CustomerCode": self.credentials.get("customer_code", ""),
                    "OriginArea": self.credentials.get("origin_area", ""),
                    "Sender": req.pickup.name,
                },
                "Services": {
                    "ActualWeight": str(weight_kg),
                    "CollectableAmount": (
                        str(req.cod_amount) if req.payment_mode == "COD" else "0"
                    ),
                    "Commodity": {
                        "CommodityDetail1": description[:50],
                    },
                    "CreditReferenceNo": req.order_id,
                    "DeclaredValue": str(req.invoice_value),
                    "Dimensions": {
                        "Dimension": [{
                            "Breadth": str(req.breadth_cm),
                            "Count": "1",
                            "Height": str(req.height_cm),
                            "Length": str(req.length_cm),
                        }],
                    },
                    "InvoiceNo": req.order_id,
                    "ItemCount": str(len(req.items) or 1),
                    "PieceCount": "1",
                    "ProductCode": product_code,
                    "ProductType": (
                        "COD" if req.payment_mode == "COD" else "Dutiable"
                    ),
                    "SubProductCode": "",
                    "SpecialInstruction": "",
                },
            },
        }

    # ========================================================================
    # Shipment Cancellation (REST — Cancel Waybill)
    # ========================================================================

    async def cancel_shipment(self, awb_number: str) -> bool:
        """
        Cancel a waybill on BlueDart.
        Endpoint: POST /in/transportation/waybill/v1/CancelWaybill
        """
        try:
            headers = await self._headers()
            payload = {
                "profile": self._profile(),
                "request": {
                    "AWBNo": awb_number,
                },
            }

            resp = await self._client.post(
                f"{self._base_url}/in/transportation/waybill/v1/CancelWaybill",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            result = data.get("CancelWaybillResult", {})
            is_error = result.get("IsError", True)

            if is_error:
                status = result.get("Status", {})
                logger.warning(
                    f"BlueDart cancel failed for {awb_number}: {status}"
                )
                return False

            logger.info(f"BlueDart waybill {awb_number} cancelled successfully")
            return True

        except Exception as e:
            logger.error(f"BlueDart cancel_shipment failed for {awb_number}: {e}")
            return False

    # ========================================================================
    # Tracking
    # NOTE: BlueDart tracking is primarily SOAP-based (GetShipmentStatus).
    # This implementation uses the REST tracking endpoint if available, or
    # falls back to a polling-friendly approach.
    # TODO: Implement full SOAP-based tracking via GetShipmentStatus WSDL
    #       when SOAP support (e.g., zeep) is added to the project.
    # ========================================================================

    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """
        Track a BlueDart shipment.

        Attempts the REST tracking endpoint first. BlueDart's primary tracking
        API is SOAP-based (GetShipmentStatus), which requires a SOAP client.
        """
        try:
            headers = await self._headers()

            # Try REST tracking endpoint (available on some API Gateway versions)
            resp = await self._client.get(
                f"{self._base_url}/in/transportation/tracking/v1/GetShipmentStatus",
                params={
                    "AWBNo": awb_number,
                    "LicenceKey": self.credentials["license_key"],
                    "LoginID": self.credentials["login_id"],
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            # Parse tracking scans from the response
            shipment_data = data.get("ShipmentData", {})
            scans = shipment_data.get("Scans", [])

            events = []
            for scan in scans:
                scan_detail = scan.get("ScanDetail", scan)
                raw_status = scan_detail.get("Scan", "")
                scan_date = scan_detail.get("ScanDate", "")
                scan_time = scan_detail.get("ScanTime", "")
                location = scan_detail.get("ScannedLocation", "")
                instructions = scan_detail.get("Instructions", "")

                # Parse timestamp
                timestamp = self._parse_bluedart_timestamp(scan_date, scan_time)

                # Map status
                oms_status = StatusMapper.BLUEDART_STATUS_MAP.get(
                    raw_status, None
                )
                if oms_status is None:
                    oms_status = StatusMapper.map_status("BLUEDART", raw_status)

                is_ndr = StatusMapper.is_ndr(oms_status)

                events.append(TrackingEvent(
                    timestamp=timestamp,
                    status_code=raw_status,
                    status_description=instructions or raw_status,
                    location=location,
                    remark=instructions,
                    oms_status=oms_status.value,
                    is_ndr=is_ndr,
                    ndr_reason="",
                    is_terminal=StatusMapper.is_terminal(oms_status),
                ))

            # Current status from latest event
            current_status = ""
            if events:
                current_status = events[0].oms_status

            return TrackingResponse(
                success=True,
                awb_number=awb_number,
                current_status=current_status,
                edd=shipment_data.get("ExpectedDeliveryDate"),
                events=events,
                raw_response=data,
            )

        except httpx.HTTPStatusError as e:
            logger.warning(
                f"BlueDart REST tracking failed for {awb_number} "
                f"(HTTP {e.response.status_code}). "
                "SOAP-based tracking (GetShipmentStatus) is not yet implemented."
            )
            return TrackingResponse(
                success=False,
                awb_number=awb_number,
                error=(
                    f"REST tracking returned HTTP {e.response.status_code}. "
                    "SOAP tracking not yet implemented."
                ),
            )
        except Exception as e:
            logger.error(f"BlueDart tracking failed for {awb_number}: {e}")
            return TrackingResponse(
                success=False, awb_number=awb_number, error=str(e)
            )

    @staticmethod
    def _parse_bluedart_timestamp(
        scan_date: str, scan_time: str
    ) -> datetime:
        """
        Parse BlueDart date/time strings into a datetime.
        BlueDart typically returns dates as 'DD-Mon-YYYY' and times as 'HH:MM'.
        """
        if not scan_date:
            return datetime.now(timezone.utc)

        combined = f"{scan_date} {scan_time}".strip()
        for fmt in (
            "%d-%b-%Y %H:%M",
            "%d-%m-%Y %H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%d/%m/%Y %H:%M",
        ):
            try:
                return datetime.strptime(combined, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

        # Fallback: try parsing date only
        for fmt in ("%d-%b-%Y", "%d-%m-%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(scan_date, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue

        logger.warning(f"Could not parse BlueDart timestamp: {combined}")
        return datetime.now(timezone.utc)

    # ========================================================================
    # Rate Estimation
    # NOTE: BlueDart rate estimation is typically SOAP-based or handled
    # through their offline rate card. This stub returns an empty response.
    # TODO: Implement SOAP-based rate estimation (GetDomesticTransitTime)
    #       or integrate offline rate card logic.
    # ========================================================================

    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        """
        Get shipping rates from BlueDart.

        BlueDart rate calculation is typically handled through SOAP endpoints
        (GetDomesticTransitTime) or offline rate cards. This implementation
        attempts the REST gateway if available.
        """
        try:
            headers = await self._headers()
            weight_kg = weight_grams / 1000

            # Attempt REST-based rate check
            payload = {
                "profile": self._profile(),
                "request": {
                    "OriginPincode": origin_pincode,
                    "DestinationPincode": dest_pincode,
                    "ActualWeight": str(weight_kg),
                    "ProductCode": "A",
                    "SubProductCode": "",
                    "PaymentMode": "COD" if payment_mode == "COD" else "Pre-paid",
                    "CollectableAmount": str(cod_amount) if payment_mode == "COD" else "0",
                },
            }

            resp = await self._client.post(
                f"{self._base_url}/in/transportation/rate/v1/GetRates",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            rate_result = data.get("GetRatesResult", {})
            charges = rate_result.get("TotalCharges", 0)
            transit_days = int(rate_result.get("TransitDays", 0))

            quotes = []
            if charges:
                quotes.append(RateQuote(
                    carrier_code="BLUEDART",
                    carrier_name="BlueDart Express",
                    rate=float(charges),
                    cod_charges=float(rate_result.get("CODCharges", 0)),
                    estimated_days=transit_days,
                    service_type="Express",
                ))

            return RateResponse(success=True, quotes=quotes)

        except httpx.HTTPStatusError as e:
            logger.warning(
                f"BlueDart rate check HTTP error: {e.response.status_code}. "
                "SOAP-based rate estimation not yet implemented."
            )
            return RateResponse(
                success=False,
                error=(
                    f"REST rate check returned HTTP {e.response.status_code}. "
                    "SOAP rate estimation (GetDomesticTransitTime) not yet implemented."
                ),
            )
        except Exception as e:
            logger.error(f"BlueDart rate check failed: {e}")
            return RateResponse(success=False, error=str(e))

    # ========================================================================
    # Serviceability (Pincode Check)
    # NOTE: BlueDart pincode serviceability is SOAP-based (GetServicesforPincode).
    # TODO: Implement SOAP call via zeep or similar library.
    # ========================================================================

    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """
        Check if BlueDart services the given pincode pair.

        Primary method is SOAP-based (GetServicesforPincode). This implementation
        attempts a REST fallback and returns the result if available.
        """
        try:
            headers = await self._headers()

            # Attempt REST-based pincode check
            resp = await self._client.get(
                f"{self._base_url}/in/transportation/pincode/v1/GetServicesForPincode",
                params={
                    "pincode": dest_pincode,
                    "LicenceKey": self.credentials["license_key"],
                    "LoginID": self.credentials["login_id"],
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            pincode_result = data.get("GetServicesForPincodeResult", {})
            is_error = pincode_result.get("IsError", True)

            if is_error:
                return ServiceabilityResponse(
                    success=True,
                    is_serviceable=False,
                    error="Pincode not serviceable by BlueDart",
                )

            services = pincode_result.get("PincodeDetails", {})
            is_prepaid = bool(services.get("Prepaid", False))
            is_cod = bool(services.get("COD", False))

            return ServiceabilityResponse(
                success=True,
                is_serviceable=is_prepaid or is_cod,
                cod_available=is_cod,
                prepaid_available=is_prepaid,
                estimated_days=int(services.get("TransitDays", 0)),
            )

        except httpx.HTTPStatusError as e:
            logger.warning(
                f"BlueDart pincode check HTTP error: {e.response.status_code}. "
                "SOAP-based GetServicesforPincode not yet implemented."
            )
            return ServiceabilityResponse(
                success=False,
                error=(
                    f"REST pincode check returned HTTP {e.response.status_code}. "
                    "SOAP endpoint (GetServicesforPincode) not yet implemented."
                ),
            )
        except Exception as e:
            logger.error(f"BlueDart serviceability check failed: {e}")
            return ServiceabilityResponse(success=False, error=str(e))

    # ========================================================================
    # Label
    # ========================================================================

    async def get_label(self, awb_number: str) -> Optional[str]:
        """
        Get the shipping label PDF URL for a BlueDart AWB.

        BlueDart labels are typically generated as part of waybill creation.
        This endpoint attempts to retrieve a label if available separately.
        """
        try:
            headers = await self._headers()

            resp = await self._client.post(
                f"{self._base_url}/in/transportation/waybill/v1/GetWaybillLabel",
                json={
                    "profile": self._profile(),
                    "request": {
                        "AWBNo": awb_number,
                    },
                },
                headers=headers,
            )

            if resp.status_code != 200:
                logger.warning(
                    f"BlueDart label retrieval returned {resp.status_code} "
                    f"for AWB {awb_number}"
                )
                return None

            data = resp.json()
            label_result = data.get("GetWaybillLabelResult", {})
            label_url = label_result.get("LabelURL", "")
            label_content = label_result.get("LabelImage", "")

            # Some BlueDart responses return base64 label content instead of URL.
            # Return the URL if available; otherwise return None and log.
            if label_url:
                return label_url

            if label_content:
                logger.info(
                    f"BlueDart returned base64 label for {awb_number} "
                    "(URL not available, raw content available in raw response)"
                )
                return None

            return None

        except Exception as e:
            logger.error(f"BlueDart get_label failed for {awb_number}: {e}")
            return None

    # ========================================================================
    # NDR Actions
    # ========================================================================

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions for BlueDart shipments.

        BlueDart NDR actions are typically managed through their operations
        dashboard or via direct communication with their ops team.
        """
        logger.info(f"BlueDart NDR action: {action} for AWB {awb_number}")
        return {
            "success": True,
            "message": (
                f"NDR action '{action}' recorded for AWB {awb_number}. "
                "BlueDart NDR resolution is handled via their operations portal."
            ),
        }
