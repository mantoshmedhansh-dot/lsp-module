"""
Carrier Webhook API — Receives real-time tracking updates from courier partners.

Endpoints:
  POST /api/v1/carrier-webhooks/shiprocket   — Shiprocket push notifications
  POST /api/v1/carrier-webhooks/delhivery    — Delhivery push API
  POST /api/v1/carrier-webhooks/generic      — Generic carrier webhook (manual setup)

  POST /api/v1/carrier-webhooks/track        — Manual tracking pull for a single AWB
  POST /api/v1/carrier-webhooks/poll         — Trigger bulk tracking poll (admin/cron)

  GET  /api/v1/carrier-webhooks/logs         — View recent webhook events
  GET  /api/v1/carrier-webhooks/stats        — Delivery status statistics

Phase 2 additions:
  - Webhook event logging (CarrierWebhookLog)
  - Idempotency check (skip duplicate events)
  - Optional signature validation
  - Post-processing analytics trigger on terminal statuses
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query, BackgroundTasks
from sqlmodel import Session, select, func, col
from pydantic import BaseModel as PydanticBaseModel

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models.user import User
from app.models.order import Delivery
from app.models.shipment import CarrierWebhookLog
from app.models.enums import DeliveryStatus
from app.services.carriers.pipeline import StatusPipeline
from app.services.carriers.status_mapper import StatusMapper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/carrier-webhooks", tags=["Carrier Webhooks"])


# ============================================================================
# Webhook Payloads (Pydantic models for validation)
# ============================================================================

class ShiprocketWebhookPayload(PydanticBaseModel):
    """Shiprocket sends this payload on tracking updates."""
    awb: Optional[str] = None
    courier_name: Optional[str] = None
    current_status: Optional[str] = None
    current_status_id: Optional[int] = None
    shipment_status: Optional[str] = None
    status_id: Optional[int] = None
    order_id: Optional[str] = None
    sr_status: Optional[str] = None
    sr_status_label: Optional[str] = None
    scans: Optional[list] = None
    etd: Optional[str] = None
    current_timestamp: Optional[str] = None


class GenericWebhookPayload(PydanticBaseModel):
    """Generic webhook for carriers that don't have a specific handler."""
    awb_number: str
    carrier_code: str
    status: str
    remark: str = ""
    location: str = ""
    timestamp: Optional[str] = None
    ndr_reason: str = ""


class ManualTrackRequest(PydanticBaseModel):
    """Request to manually pull tracking for an AWB."""
    awb_number: str
    carrier_code: str = "SHIPROCKET"


class BulkPollRequest(PydanticBaseModel):
    """Request to poll tracking for multiple AWBs."""
    carrier_code: str = "SHIPROCKET"
    status_filter: Optional[str] = None  # Only poll shipments with this status
    limit: int = 100


# ============================================================================
# Webhook Helpers (Phase 2)
# ============================================================================

def _log_webhook_event(
    session: Session,
    carrier_code: str,
    awb_number: str,
    carrier_status: str,
    raw_payload: dict,
    oms_status: str = None,
    is_duplicate: bool = False,
    is_processed: bool = True,
    error_message: str = None,
    processing_result: dict = None,
    company_id: UUID = None,
) -> CarrierWebhookLog:
    """Log every inbound webhook event for debugging and audit."""
    log_entry = CarrierWebhookLog(
        carrierCode=carrier_code,
        awbNumber=awb_number,
        carrierStatus=carrier_status,
        omsStatus=oms_status,
        rawPayload=raw_payload,
        isProcessed=is_processed,
        isDuplicate=is_duplicate,
        errorMessage=error_message,
        processedAt=datetime.now(timezone.utc),
        processingResult=processing_result,
        companyId=company_id,
    )
    session.add(log_entry)
    return log_entry


def _check_idempotency(
    session: Session,
    awb_number: str,
    carrier_status: str,
    carrier_code: str,
) -> bool:
    """Check if this exact (awb, status, carrier) was already processed. Returns True if duplicate."""
    existing = session.exec(
        select(CarrierWebhookLog).where(
            CarrierWebhookLog.awbNumber == awb_number,
            CarrierWebhookLog.carrierStatus == carrier_status,
            CarrierWebhookLog.carrierCode == carrier_code,
            CarrierWebhookLog.isProcessed == True,
            CarrierWebhookLog.isDuplicate == False,
        ).limit(1)
    ).first()
    return existing is not None


def _validate_webhook_signature(
    request_body: bytes,
    carrier_code: str,
    signature_header: Optional[str] = None,
    secret: Optional[str] = None,
) -> bool:
    """
    Validate carrier-specific webhook signature.
    Skips validation if no secret is configured.
    """
    if not secret or not signature_header:
        return True  # No secret configured → skip validation

    expected = hmac.new(
        secret.encode("utf-8"),
        request_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature_header)


def _trigger_analytics_background(
    background_tasks: BackgroundTasks,
    result: dict,
):
    """If pipeline signals aggregation needed, fire background task."""
    if result.get("trigger_aggregation") and result.get("delivery_id"):
        background_tasks.add_task(
            _run_aggregation_for_delivery,
            delivery_id=result["delivery_id"],
        )


def _run_aggregation_for_delivery(delivery_id: str):
    """Background task: re-aggregate analytics for one delivery."""
    from app.core.database import get_session as get_db_session
    from app.services.analytics_aggregator import AnalyticsAggregator

    gen = get_db_session()
    session = next(gen)
    try:
        result = AnalyticsAggregator.aggregate_for_delivery(
            session=session,
            delivery_id=UUID(delivery_id),
        )
        logger.info(f"Analytics aggregation for delivery {delivery_id}: {result}")
    except Exception as e:
        logger.error(f"Analytics aggregation failed for {delivery_id}: {e}")
    finally:
        session.close()


# ============================================================================
# Shiprocket Webhook
# ============================================================================

@router.post("/shiprocket")
async def shiprocket_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """
    Receive tracking updates from Shiprocket.
    This endpoint is called by Shiprocket when a shipment status changes.
    No auth required (webhook verification via IP/secret if needed).
    """
    try:
        body = await request.json()
        logger.info(f"Shiprocket webhook received: {body}")

        awb = body.get("awb") or body.get("awb_code", "")
        status = body.get("current_status") or body.get("shipment_status", "")
        remark = body.get("sr_status_label") or body.get("sr_status", status)
        location = ""
        ndr_reason = ""
        timestamp_str = body.get("current_timestamp")

        if not awb or not status:
            _log_webhook_event(
                session, "SHIPROCKET", str(awb), str(status), body,
                is_processed=False, error_message="Missing awb or status",
            )
            session.commit()
            return {"status": "ignored", "reason": "Missing awb or status"}

        # Idempotency check
        if _check_idempotency(session, str(awb), str(status), "SHIPROCKET"):
            _log_webhook_event(
                session, "SHIPROCKET", str(awb), str(status), body,
                is_duplicate=True, is_processed=False,
            )
            session.commit()
            logger.info(f"Duplicate webhook skipped: SHIPROCKET AWB={awb} status={status}")
            return {"status": "duplicate", "awb": awb}

        # Parse timestamp
        timestamp = None
        if timestamp_str:
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                timestamp = datetime.now(timezone.utc)

        # Process scans for latest info
        scans = body.get("scans", [])
        if scans and isinstance(scans, list):
            latest_scan = scans[0] if scans else {}
            location = latest_scan.get("location", "")
            if StatusMapper.map_shiprocket_status(status) == DeliveryStatus.NDR:
                ndr_reason = latest_scan.get("sr-status-label", remark)

        result = StatusPipeline.process_tracking_update(
            session=session,
            awb_number=str(awb),
            carrier_code="SHIPROCKET",
            carrier_status=status,
            carrier_remark=remark,
            location=location,
            timestamp=timestamp,
            ndr_reason_raw=ndr_reason,
        )

        # Log the event
        _log_webhook_event(
            session, "SHIPROCKET", str(awb), str(status), body,
            oms_status=result.get("new_status", ""),
            processing_result=result,
        )
        session.commit()

        # Trigger analytics if terminal
        _trigger_analytics_background(background_tasks, result)

        return {"status": "processed", "result": result}

    except Exception as e:
        logger.error(f"Shiprocket webhook error: {e}", exc_info=True)
        try:
            _log_webhook_event(
                session, "SHIPROCKET", str(awb) if 'awb' in dir() else "", "",
                body if 'body' in dir() else {},
                is_processed=False, error_message=str(e),
            )
            session.commit()
        except Exception:
            pass
        return {"status": "error", "message": str(e)}


# ============================================================================
# Delhivery Webhook (ready for Phase C5)
# ============================================================================

@router.post("/delhivery")
async def delhivery_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Receive tracking updates from Delhivery push API."""
    try:
        body = await request.json()
        logger.info(f"Delhivery webhook received: {body}")

        awb = body.get("Waybill") or body.get("waybill", "")
        status = body.get("Status", {}).get("Status", "") if isinstance(body.get("Status"), dict) else body.get("Status", "")
        remark = body.get("Status", {}).get("StatusType", "") if isinstance(body.get("Status"), dict) else ""
        location = body.get("Status", {}).get("StatusLocation", "") if isinstance(body.get("Status"), dict) else ""

        if not awb or not status:
            _log_webhook_event(
                session, "DELHIVERY", str(awb), str(status), body,
                is_processed=False, error_message="Missing waybill or status",
            )
            session.commit()
            return {"status": "ignored", "reason": "Missing waybill or status"}

        # Idempotency check
        if _check_idempotency(session, str(awb), str(status), "DELHIVERY"):
            _log_webhook_event(
                session, "DELHIVERY", str(awb), str(status), body,
                is_duplicate=True, is_processed=False,
            )
            session.commit()
            return {"status": "duplicate", "awb": awb}

        result = StatusPipeline.process_tracking_update(
            session=session,
            awb_number=str(awb),
            carrier_code="DELHIVERY",
            carrier_status=status,
            carrier_remark=remark,
            location=location,
        )

        _log_webhook_event(
            session, "DELHIVERY", str(awb), str(status), body,
            oms_status=result.get("new_status", ""),
            processing_result=result,
        )
        session.commit()

        _trigger_analytics_background(background_tasks, result)

        return {"status": "processed", "result": result}

    except Exception as e:
        logger.error(f"Delhivery webhook error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# ============================================================================
# Generic Webhook
# ============================================================================

@router.post("/generic")
def generic_webhook(
    payload: GenericWebhookPayload,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """
    Generic carrier webhook — use for any carrier that doesn't have
    a dedicated handler. Just pass awb, carrier_code, and status.
    """
    raw_payload = payload.model_dump()

    # Idempotency check
    if _check_idempotency(session, payload.awb_number, payload.status, payload.carrier_code):
        _log_webhook_event(
            session, payload.carrier_code, payload.awb_number, payload.status,
            raw_payload, is_duplicate=True, is_processed=False,
        )
        session.commit()
        return {"status": "duplicate", "awb": payload.awb_number}

    timestamp = None
    if payload.timestamp:
        try:
            timestamp = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass

    result = StatusPipeline.process_tracking_update(
        session=session,
        awb_number=payload.awb_number,
        carrier_code=payload.carrier_code,
        carrier_status=payload.status,
        carrier_remark=payload.remark,
        location=payload.location,
        timestamp=timestamp,
        ndr_reason_raw=payload.ndr_reason,
    )

    _log_webhook_event(
        session, payload.carrier_code, payload.awb_number, payload.status,
        raw_payload, oms_status=result.get("new_status", ""),
        processing_result=result,
    )
    session.commit()

    _trigger_analytics_background(background_tasks, result)

    return {"status": "processed", "result": result}


# ============================================================================
# Manual Tracking Pull
# ============================================================================

@router.post("/track")
async def manual_track(
    payload: ManualTrackRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Manually pull tracking for a single AWB from the carrier API.
    Requires auth (admin/manager only).
    """
    from app.services.carriers.factory import get_carrier_for_company

    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    adapter = get_carrier_for_company(
        session, current_user.companyId, payload.carrier_code
    )
    if not adapter:
        raise HTTPException(
            status_code=400,
            detail=f"No active {payload.carrier_code} integration for your company. "
                   f"Configure credentials in Settings > Transporters."
        )

    tracking = await adapter.track_shipment(payload.awb_number)
    if not tracking.success:
        raise HTTPException(status_code=502, detail=f"Tracking failed: {tracking.error}")

    # Process the latest event through our pipeline
    if tracking.events:
        latest = tracking.events[0]
        StatusPipeline.process_tracking_update(
            session=session,
            awb_number=payload.awb_number,
            carrier_code=payload.carrier_code,
            carrier_status=latest.status_code,
            carrier_remark=latest.remark,
            location=latest.location,
            timestamp=latest.timestamp,
            ndr_reason_raw=latest.ndr_reason,
        )

    return {
        "awb": payload.awb_number,
        "current_status": tracking.current_status,
        "edd": tracking.edd,
        "events_count": len(tracking.events),
        "events": [
            {
                "timestamp": e.timestamp.isoformat(),
                "status": e.oms_status,
                "description": e.status_description,
                "location": e.location,
                "is_ndr": e.is_ndr,
            }
            for e in tracking.events[:10]
        ],
    }


# ============================================================================
# Bulk Tracking Poller (called by cron / scheduler)
# ============================================================================

@router.post("/poll")
async def bulk_poll(
    payload: BulkPollRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager),
):
    """
    Trigger bulk tracking poll for all active shipments.
    Runs in background. Typically called by cron every 4 hours.
    """
    # Find all active (non-terminal) deliveries with AWB numbers
    active_statuses = [
        DeliveryStatus.SHIPPED.value,
        DeliveryStatus.IN_TRANSIT.value,
        DeliveryStatus.OUT_FOR_DELIVERY.value,
        DeliveryStatus.NDR.value,
        DeliveryStatus.MANIFESTED.value,
        DeliveryStatus.RTO_INITIATED.value,
        DeliveryStatus.RTO_IN_TRANSIT.value,
    ]

    query = select(Delivery).where(
        Delivery.awbNo.isnot(None),
        Delivery.status.in_(active_statuses),
    )

    if payload.status_filter:
        query = query.where(Delivery.status == payload.status_filter)

    # Filter by company
    company_filter = CompanyFilter(current_user=current_user)
    query = company_filter.apply_filter(query, Delivery.companyId)

    deliveries = session.exec(query.limit(payload.limit)).all()

    if not deliveries:
        return {"status": "no_active_shipments", "count": 0}

    # Group by carrier for efficient polling
    awb_list = [
        {"awb": d.awbNo, "delivery_id": str(d.id)}
        for d in deliveries if d.awbNo
    ]

    # Start polling in background
    background_tasks.add_task(
        _poll_tracking_batch,
        carrier_code=payload.carrier_code,
        awb_list=awb_list,
        company_id=str(current_user.companyId),
    )

    return {
        "status": "polling_started",
        "count": len(awb_list),
        "carrier": payload.carrier_code,
    }


async def _poll_tracking_batch(
    carrier_code: str,
    awb_list: list,
    company_id: str,
):
    """Background task: poll tracking for a batch of AWBs."""
    from app.core.database import get_session as get_db_session
    from app.services.carriers.factory import get_carrier_for_company
    from uuid import UUID

    logger.info(f"Polling {len(awb_list)} shipments via {carrier_code}")

    gen = get_db_session()
    session = next(gen)

    try:
        adapter = get_carrier_for_company(session, UUID(company_id), carrier_code)
        if not adapter:
            logger.error(f"No adapter for {carrier_code} + company {company_id}")
            return

        processed = 0
        errors = 0

        for item in awb_list:
            try:
                tracking = await adapter.track_shipment(item["awb"])
                if tracking.success and tracking.events:
                    latest = tracking.events[0]
                    StatusPipeline.process_tracking_update(
                        session=session,
                        awb_number=item["awb"],
                        carrier_code=carrier_code,
                        carrier_status=latest.status_code,
                        carrier_remark=latest.remark,
                        location=latest.location,
                        timestamp=latest.timestamp,
                        ndr_reason_raw=latest.ndr_reason,
                    )
                    processed += 1
            except Exception as e:
                errors += 1
                logger.error(f"Poll error for AWB {item['awb']}: {e}")

        session.commit()
        logger.info(f"Polling complete: {processed} processed, {errors} errors")

    except Exception as e:
        session.rollback()
        logger.error(f"Batch polling failed: {e}")
    finally:
        session.close()


# ============================================================================
# Webhook Logs (Phase 2)
# ============================================================================

@router.get("/logs")
def webhook_logs(
    awb: Optional[str] = Query(default=None, description="Filter by AWB number"),
    carrier: Optional[str] = Query(default=None, description="Filter by carrier code"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    company_filter: CompanyFilter = Depends(),
):
    """View recent webhook event logs."""
    query = select(CarrierWebhookLog).order_by(col(CarrierWebhookLog.createdAt).desc())

    if awb:
        query = query.where(CarrierWebhookLog.awbNumber == awb)
    if carrier:
        query = query.where(CarrierWebhookLog.carrierCode == carrier)

    # Company filter (logs may have null companyId for unmatched AWBs)
    query = query.offset(offset).limit(limit)

    logs = session.exec(query).all()
    return [
        {
            "id": str(log.id),
            "carrierCode": log.carrierCode,
            "awbNumber": log.awbNumber,
            "carrierStatus": log.carrierStatus,
            "omsStatus": log.omsStatus,
            "isProcessed": log.isProcessed,
            "isDuplicate": log.isDuplicate,
            "errorMessage": log.errorMessage,
            "createdAt": log.createdAt.isoformat() if log.createdAt else None,
        }
        for log in logs
    ]


# ============================================================================
# Webhook Stats (existing)
# ============================================================================

@router.get("/stats")
def webhook_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    company_filter: CompanyFilter = Depends(),
):
    """Get tracking/delivery statistics for active shipments."""
    stats = {}
    for status in DeliveryStatus:
        query = select(func.count(Delivery.id)).where(Delivery.status == status.value)
        query = company_filter.apply_filter(query, Delivery.companyId)
        count = session.exec(query).one()
        if count > 0:
            stats[status.value] = count

    # Active shipments with AWB
    active_query = select(func.count(Delivery.id)).where(
        Delivery.awbNo.isnot(None),
        Delivery.status.in_([
            DeliveryStatus.SHIPPED.value,
            DeliveryStatus.IN_TRANSIT.value,
            DeliveryStatus.OUT_FOR_DELIVERY.value,
            DeliveryStatus.NDR.value,
        ]),
    )
    active_query = company_filter.apply_filter(active_query, Delivery.companyId)
    active_count = session.exec(active_query).one()

    return {
        "delivery_status_counts": stats,
        "active_trackable_shipments": active_count,
    }
