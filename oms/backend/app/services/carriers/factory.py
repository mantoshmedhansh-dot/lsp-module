"""
Carrier Factory — Returns the appropriate CarrierAdapter based on transporter code.
Reads credentials from TransporterConfig for the given company + transporter.
"""
import logging
from typing import Optional, Dict, Any
from uuid import UUID

from sqlmodel import Session, select

from app.models.transporter import Transporter, TransporterConfig
from .base import CarrierAdapter
from .shiprocket import ShiprocketAdapter
from .delhivery import DelhiveryAdapter
from .xpressbees import XpressbeesAdapter
from .shadowfax import ShadowfaxAdapter
from .ekart import EkartAdapter
from .bluedart import BlueDartAdapter
from .dtdc import DTDCAdapter
from .ecom_express import EcomExpressAdapter

logger = logging.getLogger(__name__)

# Registry of carrier code → adapter class
CARRIER_REGISTRY: Dict[str, type] = {
    "SHIPROCKET": ShiprocketAdapter,
    "DELHIVERY": DelhiveryAdapter,
    "XPRESSBEES": XpressbeesAdapter,
    "SHADOWFAX": ShadowfaxAdapter,
    "EKART": EkartAdapter,
    "BLUEDART": BlueDartAdapter,
    "DTDC": DTDCAdapter,
    "ECOM_EXPRESS": EcomExpressAdapter,
}


def get_carrier_adapter(
    carrier_code: str,
    credentials: Dict[str, Any],
) -> Optional[CarrierAdapter]:
    """
    Get a carrier adapter instance by code with provided credentials.
    """
    adapter_cls = CARRIER_REGISTRY.get(carrier_code.upper())
    if not adapter_cls:
        logger.warning(f"No adapter registered for carrier: {carrier_code}")
        return None
    return adapter_cls(credentials)


def get_carrier_for_company(
    session: Session,
    company_id: UUID,
    carrier_code: str,
) -> Optional[CarrierAdapter]:
    """
    Get a carrier adapter for a specific company.
    Looks up TransporterConfig to get credentials.
    """
    # Find the transporter by code
    transporter = session.exec(
        select(Transporter).where(Transporter.code == carrier_code.upper())
    ).first()
    if not transporter:
        logger.warning(f"Transporter not found: {carrier_code}")
        return None

    # Find company-specific config
    config = session.exec(
        select(TransporterConfig).where(
            TransporterConfig.companyId == company_id,
            TransporterConfig.transporterId == transporter.id,
            TransporterConfig.isActive == True,
        )
    ).first()

    if not config or not config.credentials:
        logger.warning(
            f"No active config/credentials for {carrier_code} + company {company_id}"
        )
        return None

    return get_carrier_adapter(carrier_code, config.credentials)


def list_available_carriers() -> list:
    """List all carrier codes that have adapters implemented."""
    return list(CARRIER_REGISTRY.keys())
