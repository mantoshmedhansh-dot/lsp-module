"""
Dashboard API v1 - Dashboard statistics and analytics
Optimized with in-memory caching for fast responses.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID
import time

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models import Order, OrderStatus, Inventory, SKU, Location, User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Simple in-memory cache for dashboard stats
_cache: Dict[str, Any] = {}
_cache_ttl: Dict[str, float] = {}
CACHE_DURATION = 30  # seconds


def get_cached(key: str) -> Optional[Any]:
    """Get cached value if not expired."""
    if key in _cache and key in _cache_ttl:
        if time.time() < _cache_ttl[key]:
            return _cache[key]
    return None


def set_cached(key: str, value: Any, ttl: int = CACHE_DURATION):
    """Set cache with TTL."""
    _cache[key] = value
    _cache_ttl[key] = time.time() + ttl


@router.get("")
def get_dashboard(
    locationId: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard statistics with caching.
    Returns order counts, revenue, inventory stats, and order status breakdown.
    Cached for 30 seconds to improve response time.
    """
    # Check cache first
    cache_key = f"dashboard_{locationId or 'all'}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    # Build base filter
    base_filter = []
    if locationId:
        base_filter.append(Order.locationId == locationId)

    # OPTIMIZED: Single query with all counts using CASE statements
    pending_statuses = [OrderStatus.CREATED, OrderStatus.CONFIRMED, OrderStatus.ALLOCATED]

    # Get order status breakdown (this gives us most metrics in one query)
    status_query = select(Order.status, func.count(Order.id)).group_by(Order.status)
    if base_filter:
        status_query = status_query.where(*base_filter)
    status_results = session.exec(status_query).all()

    # Calculate metrics from status breakdown
    order_by_status = {}
    total_orders = 0
    pending_orders = 0
    shipped_orders = 0
    delivered_orders = 0

    for status, count in status_results:
        status_str = str(status.value) if hasattr(status, 'value') else str(status)
        order_by_status[status_str] = count
        total_orders += count

        if status in pending_statuses:
            pending_orders += count
        elif status == OrderStatus.SHIPPED:
            shipped_orders = count
        elif status == OrderStatus.DELIVERED:
            delivered_orders = count

    # Today's orders (separate query - needed for date filter)
    today_query = select(func.count(Order.id)).where(
        Order.orderDate >= today_start,
        Order.orderDate <= today_end
    )
    if base_filter:
        today_query = today_query.where(*base_filter)
    today_orders = session.exec(today_query).one() or 0

    # Revenue from delivered orders
    revenue_query = select(func.sum(Order.totalAmount)).where(Order.status == OrderStatus.DELIVERED)
    if base_filter:
        revenue_query = revenue_query.where(*base_filter)
    total_revenue = session.exec(revenue_query).one() or 0

    # Inventory stats
    inv_query = select(func.sum(Inventory.quantity))
    if locationId:
        inv_query = inv_query.where(Inventory.locationId == locationId)
    total_inventory = session.exec(inv_query).one() or 0

    # Total SKUs (cached separately for longer)
    sku_cache_key = "total_skus"
    total_skus = get_cached(sku_cache_key)
    if total_skus is None:
        total_skus = session.exec(select(func.count(SKU.id))).one() or 0
        set_cached(sku_cache_key, total_skus, 300)  # Cache for 5 minutes

    result = {
        "summary": {
            "totalOrders": total_orders,
            "todayOrders": today_orders,
            "pendingOrders": pending_orders,
            "shippedOrders": shipped_orders,
            "deliveredOrders": delivered_orders,
            "totalRevenue": float(total_revenue) if total_revenue else 0,
            "totalInventory": int(total_inventory) if total_inventory else 0,
            "totalSKUs": total_skus
        },
        "ordersByStatus": order_by_status,
        "recentActivity": []
    }

    # Cache the result
    set_cached(cache_key, result)
    return result


@router.get("/analytics")
def get_analytics(
    locationId: Optional[UUID] = None,
    period: str = Query("week", pattern="^(day|week|month|year)$"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard analytics - order trends over time.
    Cached for 60 seconds.
    """
    # Check cache
    cache_key = f"analytics_{locationId or 'all'}_{period}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    today = datetime.now().date()

    if period == "day":
        start_date = today
    elif period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=365)

    start_datetime = datetime.combine(start_date, datetime.min.time())

    # Daily order trend
    trend_query = select(
        func.date(Order.orderDate).label("date"),
        func.count(Order.id).label("count"),
        func.sum(Order.totalAmount).label("revenue")
    ).where(
        Order.orderDate >= start_datetime
    ).group_by(
        func.date(Order.orderDate)
    ).order_by(
        func.date(Order.orderDate)
    )

    if locationId:
        trend_query = trend_query.where(Order.locationId == locationId)

    results = session.exec(trend_query).all()

    result = {
        "period": period,
        "orderTrend": [
            {
                "date": str(row.date),
                "orders": row.count,
                "revenue": float(row.revenue) if row.revenue else 0
            }
            for row in results
        ]
    }

    # Cache for 60 seconds
    set_cached(cache_key, result, 60)
    return result


@router.get("/ping")
def ping():
    """
    Lightweight endpoint to keep the server warm.
    Call this every 10-14 minutes to prevent cold starts.
    No authentication required.
    """
    return {"status": "warm", "timestamp": datetime.utcnow().isoformat()}
