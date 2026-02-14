"""
Public API — No authentication required.
Provides public-facing endpoints like shipment tracking.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.services.shipping_service import ShippingService

router = APIRouter(prefix="/public", tags=["Public"])


@router.get("/track/{awb_no}")
async def track_shipment(
    awb_no: str,
    session: Session = Depends(get_session),
):
    """
    Public shipment tracking — NO authentication required.
    Returns tracking status, events timeline, and company branding.
    Customer info is masked for privacy.
    """
    service = ShippingService(session)
    result = await service.get_public_tracking(awb_no)

    if not result.get("success"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=result.get("error", "Shipment not found"))

    return result
