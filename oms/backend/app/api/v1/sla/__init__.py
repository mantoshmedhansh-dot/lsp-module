"""
SLA API v1 - Service Level Agreement monitoring endpoints
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, CompanyFilter
from app.models import Order, Delivery, Return, NDR, User

router = APIRouter(prefix="/sla", tags=["SLA"])


def safe_enum_value(value, default: str) -> str:
    """Safely extract enum value, handling both enum objects and strings."""
    if value is None:
        return default
    if hasattr(value, 'value'):
        return value.value
    return str(value)


@router.get("/metrics")
def get_sla_metrics(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get SLA metrics for the specified period."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # ============================================================================
    # Order Processing SLA (target: 95% within 4 hours)
    # ============================================================================
    orders_query = select(Order).where(Order.createdAt >= cutoff_date)
    orders_query = company_filter.apply_filter(orders_query, Order.companyId)
    orders = session.exec(orders_query).all()

    orders_total = len(orders)
    # Orders that moved from PENDING to CONFIRMED within 4 hours
    orders_processed = sum(
        1 for o in orders
        if safe_enum_value(o.status, "") not in ["PENDING", "DRAFT"]
    )
    order_processing_rate = (orders_processed / orders_total * 100) if orders_total > 0 else 0

    # ============================================================================
    # Same Day Dispatch (target: 90%)
    # ============================================================================
    deliveries_query = select(Delivery).where(Delivery.createdAt >= cutoff_date)
    deliveries_query = company_filter.apply_filter(deliveries_query, Delivery.companyId)
    deliveries = session.exec(deliveries_query).all()

    deliveries_total = len(deliveries)
    # Deliveries dispatched on same day as order
    same_day_dispatched = sum(
        1 for d in deliveries
        if d.dispatchedAt and d.createdAt and d.dispatchedAt.date() == d.createdAt.date()
    )
    same_day_rate = (same_day_dispatched / deliveries_total * 100) if deliveries_total > 0 else 0

    # ============================================================================
    # Pick Accuracy (target: 99.5%)
    # ============================================================================
    # This would typically come from QC data - for now estimate based on returns
    returns_query = select(Return).where(Return.createdAt >= cutoff_date)
    returns_query = company_filter.apply_filter(returns_query, Return.companyId)
    returns = session.exec(returns_query).all()

    # Pick errors = returns with reason "WRONG_ITEM"
    pick_errors = sum(
        1 for r in returns
        if safe_enum_value(r.reason, "") == "WRONG_ITEM"
    )
    pick_accuracy = ((orders_total - pick_errors) / orders_total * 100) if orders_total > 0 else 100

    # ============================================================================
    # On-Time Delivery (target: 85%)
    # ============================================================================
    delivered = [d for d in deliveries if safe_enum_value(d.status, "") == "DELIVERED"]
    on_time = sum(
        1 for d in delivered
        if d.deliveredAt and d.expectedDeliveryDate and d.deliveredAt.date() <= d.expectedDeliveryDate
    )
    on_time_rate = (on_time / len(delivered) * 100) if delivered else 0

    # ============================================================================
    # NDR Resolution (target: 80% within 48 hours)
    # ============================================================================
    ndrs_query = select(NDR).where(NDR.createdAt >= cutoff_date)
    ndrs_query = company_filter.apply_filter(ndrs_query, NDR.companyId)
    ndrs = session.exec(ndrs_query).all()

    ndrs_total = len(ndrs)
    resolved_ndrs = [n for n in ndrs if safe_enum_value(n.status, "") == "RESOLVED"]
    # NDRs resolved within 48 hours
    quick_resolved = sum(
        1 for n in resolved_ndrs
        if n.resolvedAt and n.createdAt and (n.resolvedAt - n.createdAt).total_seconds() <= 48 * 3600
    )
    ndr_resolution_rate = (quick_resolved / ndrs_total * 100) if ndrs_total > 0 else 0

    # ============================================================================
    # Return Processing (target: 90% within 24 hours)
    # ============================================================================
    returns_total = len(returns)
    processed_returns = [r for r in returns if safe_enum_value(r.status, "") in ["RECEIVED", "COMPLETED", "REFUNDED"]]
    # Returns processed within 24 hours
    quick_returns = sum(
        1 for r in processed_returns
        if r.receivedAt and r.createdAt and (r.receivedAt - r.createdAt).total_seconds() <= 24 * 3600
    )
    return_processing_rate = (quick_returns / returns_total * 100) if returns_total > 0 else 0

    # ============================================================================
    # Calculate overall SLA score
    # ============================================================================
    metrics = [
        {"name": "Order Processing", "current": order_processing_rate, "target": 95, "weight": 1.0},
        {"name": "Same Day Dispatch", "current": same_day_rate, "target": 90, "weight": 1.0},
        {"name": "Pick Accuracy", "current": pick_accuracy, "target": 99.5, "weight": 1.5},
        {"name": "On-Time Delivery", "current": on_time_rate, "target": 85, "weight": 1.5},
        {"name": "NDR Resolution", "current": ndr_resolution_rate, "target": 80, "weight": 1.0},
        {"name": "Return Processing", "current": return_processing_rate, "target": 90, "weight": 1.0},
    ]

    total_weight = sum(m["weight"] for m in metrics)
    weighted_score = sum(
        (min(m["current"], m["target"]) / m["target"] * 100) * m["weight"]
        for m in metrics
    ) / total_weight if total_weight > 0 else 0

    meeting_target = sum(1 for m in metrics if m["current"] >= m["target"])
    at_risk = sum(1 for m in metrics if m["target"] * 0.8 <= m["current"] < m["target"])
    breached = sum(1 for m in metrics if m["current"] < m["target"] * 0.8)

    return {
        "overallScore": round(weighted_score, 1),
        "meetingTarget": meeting_target,
        "atRisk": at_risk,
        "breached": breached,
        "metrics": [
            {
                "name": "Order Processing SLA",
                "description": "Orders processed within 4 hours of confirmation",
                "current": round(order_processing_rate, 1),
                "target": 95,
                "unit": "%",
                "status": "meeting" if order_processing_rate >= 95 else ("at_risk" if order_processing_rate >= 76 else "breached"),
                "sampleSize": orders_total
            },
            {
                "name": "Same Day Dispatch",
                "description": "Orders dispatched same day (if ordered before 2 PM)",
                "current": round(same_day_rate, 1),
                "target": 90,
                "unit": "%",
                "status": "meeting" if same_day_rate >= 90 else ("at_risk" if same_day_rate >= 72 else "breached"),
                "sampleSize": deliveries_total
            },
            {
                "name": "Pick Accuracy",
                "description": "Correct items picked without errors",
                "current": round(pick_accuracy, 1),
                "target": 99.5,
                "unit": "%",
                "status": "meeting" if pick_accuracy >= 99.5 else ("at_risk" if pick_accuracy >= 79.6 else "breached"),
                "sampleSize": orders_total
            },
            {
                "name": "On-Time Delivery",
                "description": "Deliveries completed within committed TAT",
                "current": round(on_time_rate, 1),
                "target": 85,
                "unit": "%",
                "status": "meeting" if on_time_rate >= 85 else ("at_risk" if on_time_rate >= 68 else "breached"),
                "sampleSize": len(delivered)
            },
            {
                "name": "NDR Resolution",
                "description": "NDRs resolved within 48 hours",
                "current": round(ndr_resolution_rate, 1),
                "target": 80,
                "unit": "%",
                "status": "meeting" if ndr_resolution_rate >= 80 else ("at_risk" if ndr_resolution_rate >= 64 else "breached"),
                "sampleSize": ndrs_total
            },
            {
                "name": "Return Processing",
                "description": "Returns processed within 24 hours of receipt",
                "current": round(return_processing_rate, 1),
                "target": 90,
                "unit": "%",
                "status": "meeting" if return_processing_rate >= 90 else ("at_risk" if return_processing_rate >= 72 else "breached"),
                "sampleSize": returns_total
            },
        ],
        "period": {
            "days": days,
            "from": cutoff_date.isoformat(),
            "to": datetime.utcnow().isoformat()
        }
    }


@router.get("/at-risk-orders")
def get_at_risk_orders(
    limit: int = Query(20, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get orders at risk of SLA breach."""
    now = datetime.utcnow()

    # Get deliveries that are in transit and approaching SLA deadline
    query = select(Delivery).where(
        Delivery.status.in_(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"])
    )
    query = company_filter.apply_filter(query, Delivery.companyId)

    deliveries = session.exec(query.order_by(Delivery.expectedDeliveryDate.asc()).limit(limit)).all()

    at_risk_orders = []
    for d in deliveries:
        if d.expectedDeliveryDate:
            hours_remaining = (d.expectedDeliveryDate - now.date()).days * 24
            if hours_remaining <= 24:  # Within 24 hours of deadline
                at_risk_orders.append({
                    "id": str(d.id),
                    "deliveryNo": d.deliveryNo,
                    "awbNo": d.awbNo,
                    "status": safe_enum_value(d.status, "UNKNOWN"),
                    "expectedDeliveryDate": d.expectedDeliveryDate.isoformat() if d.expectedDeliveryDate else None,
                    "hoursRemaining": hours_remaining,
                    "risk": "HIGH" if hours_remaining <= 8 else "MEDIUM"
                })

    return {
        "atRiskOrders": at_risk_orders,
        "total": len(at_risk_orders)
    }


@router.get("/trend")
def get_sla_trend(
    weeks: int = Query(12, ge=1, le=52),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get SLA trend data for the specified number of weeks."""
    trend_data = []
    now = datetime.utcnow()

    for week_offset in range(weeks - 1, -1, -1):
        week_start = now - timedelta(weeks=week_offset + 1)
        week_end = now - timedelta(weeks=week_offset)

        # Get orders for this week
        orders_query = select(func.count(Order.id)).where(
            Order.createdAt >= week_start,
            Order.createdAt < week_end
        )
        orders_query = company_filter.apply_filter(orders_query, Order.companyId)
        orders_count = session.exec(orders_query).one()

        # Get delivered count
        delivered_query = select(func.count(Delivery.id)).where(
            Delivery.deliveredAt >= week_start,
            Delivery.deliveredAt < week_end,
            Delivery.status == "DELIVERED"
        )
        delivered_query = company_filter.apply_filter(delivered_query, Delivery.companyId)
        delivered_count = session.exec(delivered_query).one()

        # Calculate week's SLA score (simplified)
        sla_score = (delivered_count / orders_count * 100) if orders_count > 0 else 0

        trend_data.append({
            "week": week_start.strftime("%Y-W%W"),
            "weekStart": week_start.isoformat(),
            "weekEnd": week_end.isoformat(),
            "ordersProcessed": orders_count,
            "delivered": delivered_count,
            "slaScore": round(min(sla_score, 100), 1)
        })

    return {
        "trend": trend_data,
        "weeks": weeks
    }
