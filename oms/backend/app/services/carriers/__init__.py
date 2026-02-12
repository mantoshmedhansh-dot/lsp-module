"""
Carrier Integration Layer
Provides a unified interface for interacting with courier partners
(Shiprocket, Delhivery, BlueDart, DTDC, etc.)
"""
from .base import CarrierAdapter, ShipmentRequest, ShipmentResponse, TrackingEvent, RateQuote
from .factory import get_carrier_adapter
from .status_mapper import StatusMapper
from .pipeline import StatusPipeline
from .delhivery import DelhiveryAdapter

__all__ = [
    "CarrierAdapter",
    "ShipmentRequest",
    "ShipmentResponse",
    "TrackingEvent",
    "RateQuote",
    "get_carrier_adapter",
    "StatusMapper",
    "StatusPipeline",
    "DelhiveryAdapter",
]
