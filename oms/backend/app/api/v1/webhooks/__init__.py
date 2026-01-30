"""
Webhooks API v1 - Marketplace webhook handling
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Header
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    MarketplaceConnection,
    MarketplaceWebhookEvent,
    MarketplaceWebhookEventCreate,
    MarketplaceWebhookEventResponse,
    WebhookEventStatus,
    ConnectionStatus,
)


router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


# ============================================================================
# Webhook Receivers
# ============================================================================

@router.post("/{channel}")
async def receive_webhook(
    channel: str,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    session: Session = Depends(get_session)
):
    """
    Receive webhook from marketplace.

    This endpoint is called by marketplaces to notify about events.
    """
    channel = channel.upper()

    # Read raw body for signature verification
    body = await request.body()

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Try to find connection by webhook secret or other identifiers
    connection = None

    # Check headers for connection identification
    seller_id = request.headers.get("X-Seller-Id")
    shop_domain = request.headers.get("X-Shopify-Shop-Domain")

    if x_webhook_secret:
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.webhookSecret == x_webhook_secret)
            .where(MarketplaceConnection.isActive == True)
        ).first()

    if not connection and seller_id:
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.sellerId == seller_id)
            .where(MarketplaceConnection.marketplace == channel)
            .where(MarketplaceConnection.isActive == True)
        ).first()

    if not connection and shop_domain:
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.apiEndpoint.contains(shop_domain))
            .where(MarketplaceConnection.marketplace == "SHOPIFY")
            .where(MarketplaceConnection.isActive == True)
        ).first()

    # Determine event type from payload or headers
    event_type = _extract_event_type(channel, payload, dict(request.headers))

    # Generate idempotency key
    event_id = _extract_event_id(channel, payload)
    idempotency_key = f"{channel}:{event_id}" if event_id else None

    # Check for duplicate
    if idempotency_key:
        existing = session.exec(
            select(MarketplaceWebhookEvent)
            .where(MarketplaceWebhookEvent.idempotencyKey == idempotency_key)
        ).first()

        if existing:
            return {
                "success": True,
                "message": "Event already processed",
                "eventId": str(existing.id)
            }

    from uuid import uuid4

    # Create webhook event record
    event = MarketplaceWebhookEvent(
        id=uuid4(),
        companyId=connection.companyId if connection else uuid4(),  # Placeholder if no connection
        connectionId=connection.id if connection else None,
        channel=channel,
        eventType=event_type,
        eventId=event_id,
        payload=payload,
        headers=dict(request.headers),
        status=WebhookEventStatus.PENDING,
        idempotencyKey=idempotency_key
    )

    session.add(event)
    session.commit()
    session.refresh(event)

    # TODO: Trigger async processing of the event

    return {
        "success": True,
        "message": "Event received",
        "eventId": str(event.id)
    }


def _extract_event_type(channel: str, payload: dict, headers: dict) -> str:
    """Extract event type from payload based on channel."""
    if channel == "SHOPIFY":
        return headers.get("x-shopify-topic", "unknown")
    elif channel == "AMAZON":
        return payload.get("NotificationType", payload.get("eventType", "unknown"))
    elif channel == "FLIPKART":
        return payload.get("eventType", payload.get("type", "unknown"))
    else:
        return payload.get("event", payload.get("type", payload.get("eventType", "unknown")))


def _extract_event_id(channel: str, payload: dict) -> Optional[str]:
    """Extract unique event ID from payload."""
    if channel == "SHOPIFY":
        return payload.get("id")
    elif channel == "AMAZON":
        return payload.get("MessageId", payload.get("notificationId"))
    elif channel == "FLIPKART":
        return payload.get("eventId", payload.get("id"))
    else:
        return payload.get("id", payload.get("eventId"))


# ============================================================================
# Event Management
# ============================================================================

@router.get("/events", response_model=List[MarketplaceWebhookEventResponse])
def list_webhook_events(
    channel: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[WebhookEventStatus] = None,
    connection_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List webhook events"""
    query = select(MarketplaceWebhookEvent)

    if company_filter.company_id:
        query = query.where(MarketplaceWebhookEvent.companyId == company_filter.company_id)

    if channel:
        query = query.where(MarketplaceWebhookEvent.channel == channel.upper())

    if event_type:
        query = query.where(MarketplaceWebhookEvent.eventType == event_type)

    if status:
        query = query.where(MarketplaceWebhookEvent.status == status)

    if connection_id:
        query = query.where(MarketplaceWebhookEvent.connectionId == connection_id)

    if from_date:
        query = query.where(MarketplaceWebhookEvent.createdAt >= from_date)

    query = query.order_by(MarketplaceWebhookEvent.createdAt.desc())
    query = query.offset(skip).limit(limit)

    events = session.exec(query).all()
    return events


@router.get("/events/{event_id}", response_model=MarketplaceWebhookEventResponse)
def get_webhook_event(
    event_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific webhook event"""
    query = select(MarketplaceWebhookEvent).where(MarketplaceWebhookEvent.id == event_id)

    if company_filter.company_id:
        query = query.where(MarketplaceWebhookEvent.companyId == company_filter.company_id)

    event = session.exec(query).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@router.post("/events/{event_id}/retry")
def retry_webhook_event(
    event_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Retry processing a failed webhook event"""
    query = select(MarketplaceWebhookEvent).where(MarketplaceWebhookEvent.id == event_id)

    if company_filter.company_id:
        query = query.where(MarketplaceWebhookEvent.companyId == company_filter.company_id)

    event = session.exec(query).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status not in [WebhookEventStatus.FAILED, WebhookEventStatus.PENDING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry event with status: {event.status}"
        )

    # Reset for retry
    event.status = WebhookEventStatus.PENDING
    event.retryCount += 1
    event.nextRetryAt = None
    event.errorMessage = None
    event.errorDetails = None
    event.updatedAt = datetime.utcnow()

    session.add(event)
    session.commit()

    # TODO: Trigger async processing

    return {"success": True, "message": "Event queued for retry"}


@router.post("/events/{event_id}/ignore")
def ignore_webhook_event(
    event_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark a webhook event as ignored"""
    query = select(MarketplaceWebhookEvent).where(MarketplaceWebhookEvent.id == event_id)

    if company_filter.company_id:
        query = query.where(MarketplaceWebhookEvent.companyId == company_filter.company_id)

    event = session.exec(query).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.status = WebhookEventStatus.IGNORED
    event.processedAt = datetime.utcnow()
    event.updatedAt = datetime.utcnow()

    session.add(event)
    session.commit()

    return {"success": True, "message": "Event marked as ignored"}


# ============================================================================
# Webhook Configuration
# ============================================================================

@router.get("/config/{connection_id}")
def get_webhook_config(
    connection_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get webhook configuration for a connection"""
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Generate webhook URL
    from app.core.config import settings
    base_url = getattr(settings, 'WEBHOOK_BASE_URL', settings.FRONTEND_URL or 'https://api.example.com')
    webhook_url = f"{base_url}/api/v1/webhooks/{connection.marketplace.value.lower()}"

    return {
        "connectionId": str(connection_id),
        "marketplace": connection.marketplace.value,
        "webhookUrl": webhook_url,
        "webhookSecret": connection.webhookSecret,
        "isConfigured": bool(connection.webhookSecret),
        "supportedEvents": _get_supported_events(connection.marketplace.value)
    }


@router.post("/config/{connection_id}/generate-secret")
def generate_webhook_secret(
    connection_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Generate a new webhook secret for a connection"""
    connection = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.id == connection_id)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    import secrets
    new_secret = secrets.token_urlsafe(32)

    connection.webhookSecret = new_secret
    connection.updatedAt = datetime.utcnow()
    session.add(connection)
    session.commit()

    return {
        "success": True,
        "webhookSecret": new_secret,
        "message": "Remember to update this secret in your marketplace webhook settings"
    }


def _get_supported_events(marketplace: str) -> List[str]:
    """Get supported webhook events for a marketplace."""
    events = {
        "AMAZON": [
            "ORDER_CREATED",
            "ORDER_STATUS_CHANGE",
            "INVENTORY_ALERT",
            "RETURNS_RECEIVED",
        ],
        "FLIPKART": [
            "order_approved",
            "order_cancelled",
            "return_initiated",
            "settlement_generated",
        ],
        "SHOPIFY": [
            "orders/create",
            "orders/updated",
            "orders/cancelled",
            "orders/fulfilled",
            "refunds/create",
            "inventory_levels/update",
        ],
    }
    return events.get(marketplace.upper(), [])


# ============================================================================
# Statistics
# ============================================================================

@router.get("/stats")
def get_webhook_stats(
    days: int = Query(7, ge=1, le=90),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get webhook event statistics"""
    from datetime import timedelta
    from sqlmodel import func

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    since = datetime.utcnow() - timedelta(days=days)

    # Total events
    total = session.exec(
        select(func.count(MarketplaceWebhookEvent.id))
        .where(MarketplaceWebhookEvent.companyId == company_filter.company_id)
        .where(MarketplaceWebhookEvent.createdAt >= since)
    ).one()

    # By status
    by_status = {}
    for s in WebhookEventStatus:
        count = session.exec(
            select(func.count(MarketplaceWebhookEvent.id))
            .where(MarketplaceWebhookEvent.companyId == company_filter.company_id)
            .where(MarketplaceWebhookEvent.status == s)
            .where(MarketplaceWebhookEvent.createdAt >= since)
        ).one()
        by_status[s.value] = count

    # By channel
    by_channel = {}
    channels = session.exec(
        select(MarketplaceWebhookEvent.channel, func.count(MarketplaceWebhookEvent.id))
        .where(MarketplaceWebhookEvent.companyId == company_filter.company_id)
        .where(MarketplaceWebhookEvent.createdAt >= since)
        .group_by(MarketplaceWebhookEvent.channel)
    ).all()

    for channel, count in channels:
        by_channel[channel] = count

    return {
        "period_days": days,
        "total_events": total,
        "by_status": by_status,
        "by_channel": by_channel,
        "pending": by_status.get("PENDING", 0),
        "processed": by_status.get("PROCESSED", 0),
        "failed": by_status.get("FAILED", 0)
    }
