"""
Carrier Adapter — Abstract Base Class
Every courier partner adapter (Shiprocket, Delhivery, BlueDart, etc.)
implements this interface so the rest of the OMS is carrier-agnostic.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID


# ============================================================================
# Data Transfer Objects (carrier-agnostic)
# ============================================================================

@dataclass
class Address:
    name: str
    phone: str
    address_line1: str
    city: str
    state: str
    pincode: str
    country: str = "India"
    address_line2: str = ""
    email: str = ""


@dataclass
class PackageItem:
    sku: str
    name: str
    quantity: int
    price: float
    hsn_code: str = ""


@dataclass
class ShipmentRequest:
    """Unified shipment creation request — works for all carriers."""
    order_id: str
    company_id: str
    pickup: Address
    delivery: Address
    weight_grams: int
    length_cm: float = 10
    breadth_cm: float = 10
    height_cm: float = 10
    payment_mode: str = "PREPAID"  # PREPAID or COD
    cod_amount: float = 0
    invoice_value: float = 0
    items: List[PackageItem] = field(default_factory=list)
    product_description: str = ""
    seller_gstin: str = ""


@dataclass
class ShipmentResponse:
    """Carrier's response after creating a shipment."""
    success: bool
    awb_number: str = ""
    carrier_order_id: str = ""
    tracking_url: str = ""
    label_url: str = ""
    error: str = ""
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrackingEvent:
    """A single tracking status update from a carrier."""
    timestamp: datetime
    status_code: str           # Carrier's raw status code
    status_description: str    # Carrier's raw description
    location: str = ""
    remark: str = ""
    # Normalized by StatusMapper after receiving
    oms_status: str = ""       # Maps to DeliveryStatus enum
    is_ndr: bool = False
    ndr_reason: str = ""       # Maps to NDRReason enum if is_ndr
    is_terminal: bool = False  # Delivered, RTO Delivered, Cancelled, Lost


@dataclass
class TrackingResponse:
    """Full tracking info for a shipment."""
    success: bool
    awb_number: str
    current_status: str = ""
    edd: Optional[str] = None  # Expected delivery date
    events: List[TrackingEvent] = field(default_factory=list)
    error: str = ""
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RateQuote:
    """A shipping rate quote from a carrier."""
    carrier_code: str
    carrier_name: str
    rate: float
    cod_charges: float = 0
    estimated_days: int = 0
    service_type: str = ""  # e.g., "Surface", "Express", "Air"


@dataclass
class RateResponse:
    """Rate comparison response."""
    success: bool
    quotes: List[RateQuote] = field(default_factory=list)
    error: str = ""


@dataclass
class ServiceabilityResponse:
    """Pincode serviceability check."""
    success: bool
    is_serviceable: bool = False
    cod_available: bool = False
    prepaid_available: bool = False
    estimated_days: int = 0
    error: str = ""


# ============================================================================
# Abstract Carrier Adapter
# ============================================================================

class CarrierAdapter(ABC):
    """
    Abstract base class for all courier partner integrations.
    Each carrier (Shiprocket, Delhivery, BlueDart, etc.) implements this.
    """

    carrier_code: str = ""
    carrier_name: str = ""

    def __init__(self, credentials: Dict[str, Any]):
        """
        Initialize with carrier-specific credentials.
        Credentials come from TransporterConfig.credentials (JSON field).
        """
        self.credentials = credentials

    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with the carrier API.
        Some carriers use static tokens; others need login to get JWT.
        Returns True if auth succeeds.
        """
        ...

    @abstractmethod
    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create a shipment/order with the carrier.
        Returns AWB number, tracking URL, and label URL.
        """
        ...

    @abstractmethod
    async def cancel_shipment(self, awb_number: str) -> bool:
        """Cancel a shipment by AWB number."""
        ...

    @abstractmethod
    async def track_shipment(self, awb_number: str) -> TrackingResponse:
        """
        Get tracking info for a shipment.
        Returns normalized tracking events.
        """
        ...

    @abstractmethod
    async def get_rates(
        self, origin_pincode: str, dest_pincode: str,
        weight_grams: int, payment_mode: str = "PREPAID",
        cod_amount: float = 0
    ) -> RateResponse:
        """
        Get shipping rate quotes.
        For aggregators like Shiprocket, returns rates from multiple carriers.
        """
        ...

    @abstractmethod
    async def check_serviceability(
        self, origin_pincode: str, dest_pincode: str
    ) -> ServiceabilityResponse:
        """Check if delivery is possible between two pincodes."""
        ...

    @abstractmethod
    async def get_label(self, awb_number: str) -> Optional[str]:
        """Get shipping label PDF URL for an AWB."""
        ...

    async def handle_ndr_action(
        self, awb_number: str, action: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Handle NDR actions (reattempt, RTO, update address, etc.).
        Default implementation raises NotImplementedError — carriers
        that support NDR actions override this.
        """
        raise NotImplementedError(f"{self.carrier_name} does not support NDR actions via API")

    async def request_pickup(self, shipment_ids: List[str]) -> Dict[str, Any]:
        """Request carrier pickup for shipments. Optional — not all carriers support it."""
        raise NotImplementedError(f"{self.carrier_name} does not support pickup request via API")
