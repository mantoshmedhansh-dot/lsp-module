"""
Status Mapper — Normalizes carrier-specific status codes to OMS unified statuses.

Maps:
  Shiprocket status  →  DeliveryStatus enum  +  NDRReason enum (if applicable)
  Delhivery scan     →  DeliveryStatus enum  +  NDRReason enum
  BlueDart status    →  DeliveryStatus enum  +  NDRReason enum
  (add more as carriers are integrated)

Reference: ClickPost's ~40 normalized status codes compressed to our 13 DeliveryStatuses.
"""
from app.models.enums import DeliveryStatus, NDRReason


class StatusMapper:
    """
    Maps carrier-specific status strings/codes to OMS DeliveryStatus + NDRReason.
    """

    # Terminal statuses — shipment journey is complete
    TERMINAL_STATUSES = {
        DeliveryStatus.DELIVERED,
        DeliveryStatus.RTO_DELIVERED,
        DeliveryStatus.CANCELLED,
    }

    # NDR-triggering statuses
    NDR_STATUSES = {DeliveryStatus.NDR}

    # ========================================================================
    # Shiprocket status mapping
    # Ref: https://apidocs.shiprocket.in/ — current_status field
    # ========================================================================
    SHIPROCKET_STATUS_MAP = {
        # Pickup & Processing
        "NEW": DeliveryStatus.PENDING,
        "READY TO SHIP": DeliveryStatus.PACKED,
        "AWB ASSIGNED": DeliveryStatus.MANIFESTED,
        "PICKUP SCHEDULED": DeliveryStatus.MANIFESTED,
        "PICKUP QUEUED": DeliveryStatus.MANIFESTED,
        "PICKUP GENERATED": DeliveryStatus.MANIFESTED,
        "PICKED UP": DeliveryStatus.SHIPPED,
        "PICKUP EXCEPTION": DeliveryStatus.PACKED,  # fallback to packed
        "OUT FOR PICKUP": DeliveryStatus.MANIFESTED,

        # In Transit
        "SHIPPED": DeliveryStatus.SHIPPED,
        "IN TRANSIT": DeliveryStatus.IN_TRANSIT,
        "REACHED AT DESTINATION HUB": DeliveryStatus.IN_TRANSIT,
        "MISROUTED": DeliveryStatus.IN_TRANSIT,

        # Out for Delivery
        "OUT FOR DELIVERY": DeliveryStatus.OUT_FOR_DELIVERY,

        # Delivered
        "DELIVERED": DeliveryStatus.DELIVERED,

        # NDR / Undelivered
        "UNDELIVERED": DeliveryStatus.NDR,
        "NDR": DeliveryStatus.NDR,
        "NOT DELIVERED": DeliveryStatus.NDR,
        "FAILED DELIVERY": DeliveryStatus.NDR,

        # RTO
        "RTO INITIATED": DeliveryStatus.RTO_INITIATED,
        "RTO IN TRANSIT": DeliveryStatus.RTO_IN_TRANSIT,
        "RTO DELIVERED": DeliveryStatus.RTO_DELIVERED,
        "RTO ACKNOWLEDGED": DeliveryStatus.RTO_DELIVERED,

        # Cancelled / Lost
        "CANCELLED": DeliveryStatus.CANCELLED,
        "CANCELED": DeliveryStatus.CANCELLED,
        "LOST": DeliveryStatus.CANCELLED,
        "DAMAGED": DeliveryStatus.NDR,
    }

    # Shiprocket NDR reason mapping
    SHIPROCKET_NDR_REASON_MAP = {
        "CUSTOMER NOT AVAILABLE": NDRReason.CUSTOMER_UNAVAILABLE,
        "CONSIGNEE NOT AVAILABLE": NDRReason.CUSTOMER_UNAVAILABLE,
        "CUSTOMER UNAVAILABLE": NDRReason.CUSTOMER_UNAVAILABLE,
        "WRONG ADDRESS": NDRReason.WRONG_ADDRESS,
        "INCORRECT ADDRESS": NDRReason.WRONG_ADDRESS,
        "INCOMPLETE ADDRESS": NDRReason.INCOMPLETE_ADDRESS,
        "ADDRESS NOT FOUND": NDRReason.ADDRESS_NOT_FOUND,
        "ADDRESS ISSUE": NDRReason.WRONG_ADDRESS,
        "CUSTOMER REFUSED": NDRReason.CUSTOMER_REFUSED,
        "REFUSED BY CONSIGNEE": NDRReason.CUSTOMER_REFUSED,
        "REJECTED BY CUSTOMER": NDRReason.CUSTOMER_REFUSED,
        "COD NOT READY": NDRReason.COD_NOT_READY,
        "CASH NOT AVAILABLE": NDRReason.COD_NOT_READY,
        "PAYMENT NOT READY": NDRReason.COD_NOT_READY,
        "PHONE UNREACHABLE": NDRReason.PHONE_UNREACHABLE,
        "CONTACT NUMBER NOT REACHABLE": NDRReason.PHONE_UNREACHABLE,
        "PHONE SWITCHED OFF": NDRReason.PHONE_UNREACHABLE,
        "DELIVERY RESCHEDULED": NDRReason.DELIVERY_RESCHEDULED,
        "CUSTOMER REQUESTED RESCHEDULE": NDRReason.DELIVERY_RESCHEDULED,
        "AREA NOT SERVICEABLE": NDRReason.AREA_NOT_SERVICEABLE,
        "ODA": NDRReason.AREA_NOT_SERVICEABLE,
    }

    # ========================================================================
    # Delhivery status mapping (for future Phase C5)
    # Ref: https://delhivery-express-api-doc.readme.io/
    # ========================================================================
    DELHIVERY_STATUS_MAP = {
        "Manifested": DeliveryStatus.MANIFESTED,
        "In Transit": DeliveryStatus.IN_TRANSIT,
        "Dispatched": DeliveryStatus.SHIPPED,
        "Pending": DeliveryStatus.PENDING,
        "Out For Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
        "Delivered": DeliveryStatus.DELIVERED,
        "Undelivered": DeliveryStatus.NDR,
        "RTO Initiated": DeliveryStatus.RTO_INITIATED,
        "RTO In Transit": DeliveryStatus.RTO_IN_TRANSIT,
        "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
        "Cancelled": DeliveryStatus.CANCELLED,
        "Picked Up": DeliveryStatus.SHIPPED,
    }

    DELHIVERY_NDR_REASON_MAP = {
        "Customer not available": NDRReason.CUSTOMER_UNAVAILABLE,
        "Consignee Refused to Accept": NDRReason.CUSTOMER_REFUSED,
        "Address Incomplete/Incorrect": NDRReason.INCOMPLETE_ADDRESS,
        "COD amount not ready": NDRReason.COD_NOT_READY,
        "Customer Unreachable": NDRReason.PHONE_UNREACHABLE,
        "ODA – Loss Of Connectivity": NDRReason.AREA_NOT_SERVICEABLE,
    }

    # ========================================================================
    # BlueDart status mapping (for future)
    # ========================================================================
    BLUEDART_STATUS_MAP = {
        "Shipment Created": DeliveryStatus.MANIFESTED,
        "Picked Up": DeliveryStatus.SHIPPED,
        "In Transit": DeliveryStatus.IN_TRANSIT,
        "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
        "Delivered": DeliveryStatus.DELIVERED,
        "Non Delivery": DeliveryStatus.NDR,
        "RTO": DeliveryStatus.RTO_INITIATED,
        "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
    }

    # ========================================================================
    # DTDC status mapping
    # ========================================================================
    DTDC_STATUS_MAP = {
        "Booked": DeliveryStatus.MANIFESTED,
        "Picked Up": DeliveryStatus.SHIPPED,
        "In Transit": DeliveryStatus.IN_TRANSIT,
        "Out for Delivery": DeliveryStatus.OUT_FOR_DELIVERY,
        "Delivered": DeliveryStatus.DELIVERED,
        "Undelivered": DeliveryStatus.NDR,
        "RTO": DeliveryStatus.RTO_INITIATED,
        "RTO Delivered": DeliveryStatus.RTO_DELIVERED,
        "Cancelled": DeliveryStatus.CANCELLED,
    }

    # ========================================================================
    # Ecom Express status mapping
    # ========================================================================
    ECOM_EXPRESS_STATUS_MAP = {
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

    # ========================================================================
    # Xpressbees status mapping
    # ========================================================================
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

    # ========================================================================
    # Shadowfax status mapping
    # ========================================================================
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

    # ========================================================================
    # Ekart Logistics status mapping
    # ========================================================================
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

    # ========================================================================
    # Public Methods
    # ========================================================================

    @classmethod
    def map_shiprocket_status(cls, status: str) -> DeliveryStatus:
        """Map a Shiprocket status string to OMS DeliveryStatus."""
        normalized = status.upper().strip()
        return cls.SHIPROCKET_STATUS_MAP.get(normalized, DeliveryStatus.IN_TRANSIT)

    @classmethod
    def map_shiprocket_ndr_reason(cls, reason: str) -> NDRReason:
        """Map a Shiprocket NDR reason to OMS NDRReason."""
        normalized = reason.upper().strip()
        for key, value in cls.SHIPROCKET_NDR_REASON_MAP.items():
            if key.upper() in normalized or normalized in key.upper():
                return value
        return NDRReason.OTHER

    @classmethod
    def map_delhivery_status(cls, status: str) -> DeliveryStatus:
        """Map a Delhivery scan status to OMS DeliveryStatus."""
        return cls.DELHIVERY_STATUS_MAP.get(status, DeliveryStatus.IN_TRANSIT)

    @classmethod
    def map_delhivery_ndr_reason(cls, reason: str) -> NDRReason:
        """Map a Delhivery NDR remark to OMS NDRReason."""
        for key, value in cls.DELHIVERY_NDR_REASON_MAP.items():
            if key.lower() in reason.lower():
                return value
        return NDRReason.OTHER

    @classmethod
    def map_xpressbees_status(cls, status: str) -> DeliveryStatus:
        """Map an Xpressbees status string to OMS DeliveryStatus."""
        mapped = cls.XPRESSBEES_STATUS_MAP.get(status)
        if mapped:
            return mapped
        # Case-insensitive fallback
        status_lower = status.strip().lower()
        for key, value in cls.XPRESSBEES_STATUS_MAP.items():
            if key.lower() == status_lower:
                return value
        return DeliveryStatus.IN_TRANSIT

    @classmethod
    def map_shadowfax_status(cls, status: str) -> DeliveryStatus:
        """Map a Shadowfax status string to OMS DeliveryStatus."""
        mapped = cls.SHADOWFAX_STATUS_MAP.get(status)
        if mapped:
            return mapped
        # Case-insensitive fallback
        status_lower = status.strip().lower()
        for key, value in cls.SHADOWFAX_STATUS_MAP.items():
            if key.lower() == status_lower:
                return value
        return DeliveryStatus.IN_TRANSIT

    @classmethod
    def map_ekart_status(cls, status: str) -> DeliveryStatus:
        """Map an Ekart status string to OMS DeliveryStatus."""
        mapped = cls.EKART_STATUS_MAP.get(status)
        if mapped:
            return mapped
        # Case-insensitive fallback
        status_lower = status.strip().lower()
        for key, value in cls.EKART_STATUS_MAP.items():
            if key.lower() == status_lower:
                return value
        return DeliveryStatus.IN_TRANSIT

    @classmethod
    def map_status(cls, carrier_code: str, status: str) -> DeliveryStatus:
        """Generic mapper — routes to the right carrier-specific mapper."""
        carrier_code = carrier_code.upper()
        if carrier_code == "SHIPROCKET":
            return cls.map_shiprocket_status(status)
        elif carrier_code == "DELHIVERY":
            return cls.map_delhivery_status(status)
        elif carrier_code == "BLUEDART":
            return cls.BLUEDART_STATUS_MAP.get(status, DeliveryStatus.IN_TRANSIT)
        elif carrier_code == "XPRESSBEES":
            return cls.map_xpressbees_status(status)
        elif carrier_code == "SHADOWFAX":
            return cls.map_shadowfax_status(status)
        elif carrier_code == "EKART":
            return cls.map_ekart_status(status)
        elif carrier_code == "DTDC":
            return cls.DTDC_STATUS_MAP.get(status, DeliveryStatus.IN_TRANSIT)
        elif carrier_code == "ECOM_EXPRESS":
            return cls.ECOM_EXPRESS_STATUS_MAP.get(status, DeliveryStatus.IN_TRANSIT)
        # Fallback: try Shiprocket mapping (most common)
        return cls.map_shiprocket_status(status)

    @classmethod
    def map_ndr_reason(cls, carrier_code: str, reason: str) -> NDRReason:
        """Generic NDR reason mapper."""
        carrier_code = carrier_code.upper()
        if carrier_code == "SHIPROCKET":
            return cls.map_shiprocket_ndr_reason(reason)
        elif carrier_code == "DELHIVERY":
            return cls.map_delhivery_ndr_reason(reason)
        # Xpressbees, Shadowfax, Ekart — no carrier-specific NDR reason mapping yet
        # Fall through to generic OTHER
        return NDRReason.OTHER

    @classmethod
    def is_terminal(cls, status: DeliveryStatus) -> bool:
        """Check if a status is terminal (shipment journey complete)."""
        return status in cls.TERMINAL_STATUSES

    @classmethod
    def is_ndr(cls, status: DeliveryStatus) -> bool:
        """Check if a status triggers NDR creation."""
        return status in cls.NDR_STATUSES
