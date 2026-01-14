from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta

from ...core.database import get_db
from ...models.order import Order, OrderStatus
from ...models.inventory import Inventory, SKU
from ...models.user import User
from ..deps import get_current_user

router = APIRouter()


@router.get("")
async def get_dashboard(
    locationId: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)

    # Order stats
    order_query = db.query(Order)
    if locationId:
        order_query = order_query.filter(Order.locationId == locationId)

    total_orders = order_query.count()
    today_orders = order_query.filter(
        func.date(Order.orderDate) == today
    ).count()

    pending_orders = order_query.filter(
        Order.status.in_([
            OrderStatus.CREATED,
            OrderStatus.CONFIRMED,
            OrderStatus.ALLOCATED
        ])
    ).count()

    shipped_orders = order_query.filter(
        Order.status == OrderStatus.SHIPPED
    ).count()

    delivered_orders = order_query.filter(
        Order.status == OrderStatus.DELIVERED
    ).count()

    # Revenue
    revenue_result = order_query.filter(
        Order.status == OrderStatus.DELIVERED
    ).with_entities(
        func.sum(Order.totalAmount)
    ).scalar()
    total_revenue = float(revenue_result) if revenue_result else 0

    # Inventory stats
    inv_query = db.query(Inventory)
    if locationId:
        inv_query = inv_query.filter(Inventory.locationId == locationId)

    total_inventory = inv_query.with_entities(
        func.sum(Inventory.quantity)
    ).scalar() or 0

    total_skus = db.query(func.count(func.distinct(Inventory.skuId))).scalar() or 0

    # Order status breakdown
    status_breakdown = db.query(
        Order.status,
        func.count(Order.id)
    )
    if locationId:
        status_breakdown = status_breakdown.filter(Order.locationId == locationId)

    status_breakdown = status_breakdown.group_by(Order.status).all()

    order_by_status = {status.value: count for status, count in status_breakdown}

    return {
        "summary": {
            "totalOrders": total_orders,
            "todayOrders": today_orders,
            "pendingOrders": pending_orders,
            "shippedOrders": shipped_orders,
            "deliveredOrders": delivered_orders,
            "totalRevenue": total_revenue,
            "totalInventory": total_inventory,
            "totalSKUs": total_skus
        },
        "ordersByStatus": order_by_status,
        "recentActivity": []
    }


@router.get("/analytics")
async def get_analytics(
    locationId: Optional[str] = None,
    period: str = Query("week", enum=["day", "week", "month", "year"]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = datetime.now().date()

    if period == "day":
        start_date = today
    elif period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=365)

    # Daily order trend
    order_trend = db.query(
        func.date(Order.orderDate).label("date"),
        func.count(Order.id).label("count"),
        func.sum(Order.totalAmount).label("revenue")
    ).filter(
        Order.orderDate >= start_date
    )

    if locationId:
        order_trend = order_trend.filter(Order.locationId == locationId)

    order_trend = order_trend.group_by(
        func.date(Order.orderDate)
    ).order_by(
        func.date(Order.orderDate)
    ).all()

    return {
        "period": period,
        "orderTrend": [
            {
                "date": str(row.date),
                "orders": row.count,
                "revenue": float(row.revenue) if row.revenue else 0
            }
            for row in order_trend
        ]
    }
