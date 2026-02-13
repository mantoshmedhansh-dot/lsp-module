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
from app.core.deps import get_current_user, CompanyFilter
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
    days: Optional[int] = Query(None, ge=1, le=365),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard statistics with caching.
    Returns order counts, revenue, inventory stats, and order status breakdown.
    Cached for 30 seconds to improve response time.
    Multi-tenant: CompanyFilter ensures brand-under-LSP isolation.
    Optional 'days' parameter filters orders to the last N days.
    """
    # Check cache first (include company context to prevent cross-tenant leaks)
    company_cache_id = str(company_filter.company_id) if company_filter.company_id else "all"
    cache_key = f"dashboard_{company_cache_id}_{locationId or 'all'}_{days or 'all'}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    # Date range filter (if days param is provided)
    date_start = None
    if days:
        date_start = datetime.combine(today - timedelta(days=days), datetime.min.time())

    # OPTIMIZED: Single query with all counts using CASE statements
    pending_statuses = [OrderStatus.CREATED, OrderStatus.CONFIRMED, OrderStatus.ALLOCATED]

    # Get order status breakdown (this gives us most metrics in one query)
    status_query = select(Order.status, func.count(Order.id)).group_by(Order.status)
    status_query = company_filter.apply_filter(status_query, Order.companyId)
    if locationId:
        status_query = status_query.where(Order.locationId == locationId)
    if date_start:
        status_query = status_query.where(Order.orderDate >= date_start)
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
    today_query = company_filter.apply_filter(today_query, Order.companyId)
    if locationId:
        today_query = today_query.where(Order.locationId == locationId)
    today_orders = session.exec(today_query).one() or 0

    # Revenue from delivered orders
    revenue_query = select(func.sum(Order.totalAmount)).where(Order.status == OrderStatus.DELIVERED)
    revenue_query = company_filter.apply_filter(revenue_query, Order.companyId)
    if locationId:
        revenue_query = revenue_query.where(Order.locationId == locationId)
    if date_start:
        revenue_query = revenue_query.where(Order.orderDate >= date_start)
    total_revenue = session.exec(revenue_query).one() or 0

    # Inventory stats
    inv_query = select(func.sum(Inventory.quantity))
    inv_query = company_filter.apply_filter(inv_query, Inventory.companyId)
    if locationId:
        inv_query = inv_query.where(Inventory.locationId == locationId)
    total_inventory = session.exec(inv_query).one() or 0

    # Total SKUs (include company context in cache key)
    sku_cache_key = f"total_skus_{company_cache_id}"
    total_skus = get_cached(sku_cache_key)
    if total_skus is None:
        sku_query = select(func.count(SKU.id))
        sku_query = company_filter.apply_filter(sku_query, SKU.companyId)
        total_skus = session.exec(sku_query).one() or 0
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
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard analytics - order trends over time.
    Cached for 60 seconds.
    Multi-tenant: CompanyFilter ensures brand-under-LSP isolation.
    """
    # Check cache (include company context to prevent cross-tenant leaks)
    company_cache_id = str(company_filter.company_id) if company_filter.company_id else "all"
    cache_key = f"analytics_{company_cache_id}_{locationId or 'all'}_{period}"
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

    trend_query = company_filter.apply_filter(trend_query, Order.companyId)
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
