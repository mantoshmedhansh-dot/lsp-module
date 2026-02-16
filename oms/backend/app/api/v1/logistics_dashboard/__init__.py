"""
Logistics Dashboard Aggregation API — Phase 2

Server-side aggregated stats for the logistics dashboard.
Replaces client-side aggregation of raw shipment data.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models.user import User
from app.models.order import Delivery
from app.models.shipment import Shipment
from app.models.transporter import Transporter
from app.models.enums import DeliveryStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/logistics-dashboard", tags=["Logistics Dashboard"])


def _parse_period(period: str) -> datetime:
    """Convert period string like '7d', '30d', '90d' to a start datetime."""
    days = 30
    if period.endswith("d"):
        try:
            days = int(period[:-1])
        except ValueError:
            days = 30
    return datetime.now(timezone.utc) - timedelta(days=days)


# ============================================================================
# Dashboard Stats
# ============================================================================

@router.get("/stats")
def dashboard_stats(
    period: str = Query(default="30d", description="Period: 7d, 30d, 90d"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    company_filter: CompanyFilter = Depends(),
):
    """
    Real-time aggregated dashboard stats from Delivery + Shipment tables.
    Returns counts by status, delivery rate, and avg TAT.
    """
    period_start = _parse_period(period)
    now = datetime.now(timezone.utc)

    # ---- Delivery counts ----
    def _count_deliveries(status_list: list) -> int:
        q = select(func.count(Delivery.id)).where(
            Delivery.status.in_([s.value for s in status_list]),
            Delivery.createdAt >= period_start,
        )
        q = company_filter.apply_filter(q, Delivery.companyId)
        return session.exec(q).one() or 0

    def _count_shipments(status_list: list) -> int:
        q = select(func.count(Shipment.id)).where(
            Shipment.status.in_([s.value for s in status_list]),
            Shipment.createdAt >= period_start,
        )
        q = company_filter.apply_filter(q, Shipment.companyId)
        return session.exec(q).one() or 0

    # Total shipments (Delivery + Shipment)
    total_del_q = select(func.count(Delivery.id)).where(Delivery.createdAt >= period_start)
    total_del_q = company_filter.apply_filter(total_del_q, Delivery.companyId)
    total_del = session.exec(total_del_q).one() or 0

    total_ship_q = select(func.count(Shipment.id)).where(Shipment.createdAt >= period_start)
    total_ship_q = company_filter.apply_filter(total_ship_q, Shipment.companyId)
    total_ship = session.exec(total_ship_q).one() or 0

    total_shipments = total_del + total_ship

    # In transit
    in_transit = (
        _count_deliveries([DeliveryStatus.IN_TRANSIT])
        + _count_shipments([DeliveryStatus.IN_TRANSIT])
    )

    # Out for delivery
    out_for_delivery = (
        _count_deliveries([DeliveryStatus.OUT_FOR_DELIVERY])
        + _count_shipments([DeliveryStatus.OUT_FOR_DELIVERY])
    )

    # Delivered today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    del_today_q = select(func.count(Delivery.id)).where(
        Delivery.status == DeliveryStatus.DELIVERED.value,
        Delivery.deliveryDate >= today_start,
    )
    del_today_q = company_filter.apply_filter(del_today_q, Delivery.companyId)
    del_today = session.exec(del_today_q).one() or 0

    ship_today_q = select(func.count(Shipment.id)).where(
        Shipment.status == DeliveryStatus.DELIVERED.value,
        Shipment.deliveredDate >= today_start,
    )
    ship_today_q = company_filter.apply_filter(ship_today_q, Shipment.companyId)
    ship_today = session.exec(ship_today_q).one() or 0

    delivered_today = del_today + ship_today

    # Pending pickup
    pending_pickup = (
        _count_deliveries([DeliveryStatus.PENDING, DeliveryStatus.MANIFESTED])
        + _count_shipments([DeliveryStatus.PENDING])
    )

    # Delayed (shipments with shipDate but not delivered, and shipDate > 7 days ago)
    delayed_cutoff = now - timedelta(days=7)
    del_delayed_q = select(func.count(Delivery.id)).where(
        Delivery.shipDate.isnot(None),
        Delivery.shipDate < delayed_cutoff,
        Delivery.status.in_([
            DeliveryStatus.IN_TRANSIT.value,
            DeliveryStatus.OUT_FOR_DELIVERY.value,
            DeliveryStatus.SHIPPED.value,
        ]),
        Delivery.createdAt >= period_start,
    )
    del_delayed_q = company_filter.apply_filter(del_delayed_q, Delivery.companyId)
    del_delayed = session.exec(del_delayed_q).one() or 0

    ship_delayed_q = select(func.count(Shipment.id)).where(
        Shipment.shipDate.isnot(None),
        Shipment.shipDate < delayed_cutoff,
        Shipment.status.in_([
            DeliveryStatus.IN_TRANSIT.value,
            DeliveryStatus.OUT_FOR_DELIVERY.value,
            DeliveryStatus.SHIPPED.value,
        ]),
        Shipment.createdAt >= period_start,
    )
    ship_delayed_q = company_filter.apply_filter(ship_delayed_q, Shipment.companyId)
    ship_delayed = session.exec(ship_delayed_q).one() or 0

    delayed = del_delayed + ship_delayed

    # NDR pending
    ndr_pending = (
        _count_deliveries([DeliveryStatus.NDR])
        + _count_shipments([DeliveryStatus.NDR])
    )

    # RTO count
    rto_count = (
        _count_deliveries([DeliveryStatus.RTO_INITIATED, DeliveryStatus.RTO_IN_TRANSIT, DeliveryStatus.RTO_DELIVERED])
        + _count_shipments([DeliveryStatus.RTO_INITIATED, DeliveryStatus.RTO_IN_TRANSIT, DeliveryStatus.RTO_DELIVERED])
    )

    # Delivery rate
    total_delivered = (
        _count_deliveries([DeliveryStatus.DELIVERED])
        + _count_shipments([DeliveryStatus.DELIVERED])
    )
    delivery_rate = round((total_delivered / total_shipments * 100), 1) if total_shipments else 0

    # Avg TAT (from delivered shipments with ship + delivery date)
    avg_tat_days = 0.0
    tat_deliveries = session.exec(
        select(Delivery).where(
            Delivery.status == DeliveryStatus.DELIVERED.value,
            Delivery.shipDate.isnot(None),
            Delivery.deliveryDate.isnot(None),
            Delivery.createdAt >= period_start,
        )
    ).all()

    if tat_deliveries:
        total_tat = sum(
            (d.deliveryDate - d.shipDate).total_seconds() / 86400.0
            for d in tat_deliveries if d.deliveryDate and d.shipDate
        )
        avg_tat_days = round(total_tat / len(tat_deliveries), 1) if tat_deliveries else 0

    # Status breakdown
    status_breakdown = {}
    for status in DeliveryStatus:
        count = _count_deliveries([status]) + _count_shipments([status])
        if count > 0:
            status_breakdown[status.value] = count

    return {
        "totalShipments": total_shipments,
        "inTransit": in_transit,
        "outForDelivery": out_for_delivery,
        "deliveredToday": delivered_today,
        "pendingPickup": pending_pickup,
        "delayed": delayed,
        "ndrPending": ndr_pending,
        "rtoCount": rto_count,
        "deliveryRate": delivery_rate,
        "avgTATDays": avg_tat_days,
        "statusBreakdown": status_breakdown,
    }


# ============================================================================
# Courier Performance
# ============================================================================

@router.get("/courier-performance")
def courier_performance(
    period: str = Query(default="30d", description="Period: 7d, 30d, 90d"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    company_filter: CompanyFilter = Depends(),
):
    """
    Per-courier performance metrics from live Delivery + Shipment data.
    """
    period_start = _parse_period(period)
    now = datetime.now(timezone.utc)
    delayed_cutoff = now - timedelta(days=7)

    # Get all transporters for this company
    t_query = select(Transporter)
    t_query = company_filter.apply_filter(t_query, Transporter.companyId)
    transporters = session.exec(t_query).all()

    results = []
    for t in transporters:
        # Delivery counts
        del_total_q = select(func.count(Delivery.id)).where(
            Delivery.transporterId == t.id,
            Delivery.createdAt >= period_start,
        )
        del_total_q = company_filter.apply_filter(del_total_q, Delivery.companyId)
        del_total = session.exec(del_total_q).one() or 0

        del_delivered_q = select(func.count(Delivery.id)).where(
            Delivery.transporterId == t.id,
            Delivery.status == DeliveryStatus.DELIVERED.value,
            Delivery.createdAt >= period_start,
        )
        del_delivered_q = company_filter.apply_filter(del_delivered_q, Delivery.companyId)
        del_delivered = session.exec(del_delivered_q).one() or 0

        # Shipment counts
        ship_total_q = select(func.count(Shipment.id)).where(
            Shipment.transporterId == t.id,
            Shipment.createdAt >= period_start,
        )
        ship_total_q = company_filter.apply_filter(ship_total_q, Shipment.companyId)
        ship_total = session.exec(ship_total_q).one() or 0

        ship_delivered_q = select(func.count(Shipment.id)).where(
            Shipment.transporterId == t.id,
            Shipment.status == DeliveryStatus.DELIVERED.value,
            Shipment.createdAt >= period_start,
        )
        ship_delivered_q = company_filter.apply_filter(ship_delivered_q, Shipment.companyId)
        ship_delivered = session.exec(ship_delivered_q).one() or 0

        total = del_total + ship_total
        delivered = del_delivered + ship_delivered

        if total == 0:
            continue

        delivery_rate = round((delivered / total * 100), 1) if total else 0

        # On-time (delivered within 7 days of ship date)
        on_time_del_q = select(func.count(Delivery.id)).where(
            Delivery.transporterId == t.id,
            Delivery.status == DeliveryStatus.DELIVERED.value,
            Delivery.shipDate.isnot(None),
            Delivery.deliveryDate.isnot(None),
            Delivery.createdAt >= period_start,
        )
        on_time_del_q = company_filter.apply_filter(on_time_del_q, Delivery.companyId)
        # Get all delivered deliveries to compute on-time
        delivered_dels = session.exec(
            select(Delivery).where(
                Delivery.transporterId == t.id,
                Delivery.status == DeliveryStatus.DELIVERED.value,
                Delivery.shipDate.isnot(None),
                Delivery.deliveryDate.isnot(None),
                Delivery.createdAt >= period_start,
            )
        ).all()

        on_time_count = sum(
            1 for d in delivered_dels
            if d.deliveryDate and d.shipDate
            and (d.deliveryDate - d.shipDate).total_seconds() / 86400.0 <= 7.0
        )
        on_time_rate = round((on_time_count / delivered * 100), 1) if delivered else 0

        # Avg TAT
        tat_list = [
            (d.deliveryDate - d.shipDate).total_seconds() / 86400.0
            for d in delivered_dels
            if d.deliveryDate and d.shipDate
        ]
        avg_tat = round(sum(tat_list) / len(tat_list), 1) if tat_list else 0

        # NDR count
        ndr_del_q = select(func.count(Delivery.id)).where(
            Delivery.transporterId == t.id,
            Delivery.status == DeliveryStatus.NDR.value,
            Delivery.createdAt >= period_start,
        )
        ndr_del_q = company_filter.apply_filter(ndr_del_q, Delivery.companyId)
        ndr_count = session.exec(ndr_del_q).one() or 0

        # Delayed
        del_delayed_q = select(func.count(Delivery.id)).where(
            Delivery.transporterId == t.id,
            Delivery.shipDate.isnot(None),
            Delivery.shipDate < delayed_cutoff,
            Delivery.status.in_([
                DeliveryStatus.IN_TRANSIT.value,
                DeliveryStatus.OUT_FOR_DELIVERY.value,
                DeliveryStatus.SHIPPED.value,
            ]),
            Delivery.createdAt >= period_start,
        )
        del_delayed_q = company_filter.apply_filter(del_delayed_q, Delivery.companyId)
        carrier_delayed = session.exec(del_delayed_q).one() or 0

        results.append({
            "transporterId": str(t.id),
            "transporterName": t.name,
            "transporterCode": t.code if hasattr(t, 'code') else None,
            "totalShipments": total,
            "delivered": delivered,
            "deliveryRate": delivery_rate,
            "onTimeRate": on_time_rate,
            "avgTATDays": avg_tat,
            "ndrCount": ndr_count,
            "delayed": carrier_delayed,
        })

    # Sort by total shipments desc
    results.sort(key=lambda x: x["totalShipments"], reverse=True)
    return results


# ============================================================================
# Manual Aggregation Trigger
# ============================================================================

@router.post("/trigger-aggregation")
def trigger_aggregation(
    days: int = Query(default=30, description="Aggregate last N days"),
    background_tasks: BackgroundTasks = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager),
):
    """
    Manually trigger analytics aggregation for the current company.
    Requires manager+ role.
    """
    from app.services.analytics_aggregator import AnalyticsAggregator

    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="No company context")

    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=days)

    result = AnalyticsAggregator.aggregate_all(
        session=session,
        company_id=current_user.companyId,
        period_start=period_start,
        period_end=now,
    )

    return {
        "status": "completed",
        "period": f"last {days} days",
        **result,
    }
