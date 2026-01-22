"""
Enum Definitions for B2B Logistics
"""
from enum import Enum


class UserRole(str, Enum):
    """User roles for access control"""
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


class LRStatus(str, Enum):
    """Lorry Receipt status"""
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    POD_PENDING = "POD_PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class VehicleType(str, Enum):
    """FTL vehicle types"""
    TATA_ACE = "TATA_ACE"
    PICKUP_8FT = "PICKUP_8FT"
    PICKUP_14FT = "PICKUP_14FT"
    TAURUS_16FT = "TAURUS_16FT"
    TRUCK_19FT = "TRUCK_19FT"
    TRUCK_22FT = "TRUCK_22FT"
    TRUCK_24FT = "TRUCK_24FT"
    TRUCK_32FT = "TRUCK_32FT"
    TRAILER_40FT = "TRAILER_40FT"
    CONTAINER_20FT = "CONTAINER_20FT"
    CONTAINER_40FT = "CONTAINER_40FT"


class BookingType(str, Enum):
    """Booking types"""
    FTL = "FTL"
    PTL = "PTL"
    EXPRESS = "EXPRESS"
