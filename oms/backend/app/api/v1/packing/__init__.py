"""
Packing API v1 - Pack orders for shipment and create deliveries
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Order, OrderItem, Delivery, Location, User, Transporter,
    OrderStatus, DeliveryStatus, ItemStatus
)

router = APIRouter(prefix="/packing", tags=["Packing"])


# ============================================================================
# Pydantic Models for Packing
# ============================================================================

class PackingOrderItem(BaseModel):
    """Item in a packing order"""
    id: str
    skuId: str
    skuCode: Optional[str] = None
    skuName: Optional[str] = None
    quantity: int
    pickedQty: Optional[int] = None
    packedQty: Optional[int] = None


class PackingOrderResponse(BaseModel):
    """Order ready for packing"""
    id: str
    orderNo: str
    channel: str
    customerName: str
    customerPhone: Optional[str] = None
    status: str
    orderDate: str
    totalAmount: float
    itemCount: int
    items: Optional[List[PackingOrderItem]] = None
    pickedAt: Optional[str] = None
    packingStation: Optional[str] = None


class PackingActionRequest(BaseModel):
    """Request to start or complete packing"""
    action: str  # "start" or "complete"
    boxes: Optional[int] = 1
    weight: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    transporterId: Optional[str] = None
    packingStation: Optional[str] = None


class PackingActionResponse(BaseModel):
    """Response from packing action"""
    success: bool
    orderId: str
    orderNo: str
    status: str
    message: str
    deliveryId: Optional[str] = None
    deliveryNo: Optional[str] = None


class PackingStatsResponse(BaseModel):
    """Packing statistics"""
    readyToPack: int
    inProgress: int
    packedToday: int
    totalPacked: int


# ============================================================================
# Helper Functions
# ============================================================================

def generate_delivery_number(session: Session) -> str:
    """Generate unique delivery number."""
    count = session.exec(select(func.count(Delivery.id))).one()
    return f"DEL-{datetime.now().strftime('%Y%m%d')}-{count + 1:04d}"


def get_sku_info(session: Session, sku_id: UUID) -> tuple:
    """Get SKU code and name from ID."""
    from app.models import SKU
    sku = session.get(SKU, sku_id)
    if sku:
        return sku.code, sku.name
    return None, None


# ============================================================================
# Packing Endpoints
# ============================================================================

# ============================================================================
# Static Routes (must come before dynamic /{order_id} routes)
# ============================================================================

@router.get("", response_model=List[PackingOrderResponse])
def list_orders_for_packing(
    status: Optional[str] = Query(None, description="Filter by status: PICKED, PACKING, PACKED"),
    search: Optional[str] = Query(None, description="Search by order number or customer name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List orders ready for packing.

    Returns orders with status PICKED, PACKING, or PACKED.
    Use status parameter to filter by specific status.
    """
    query = select(Order)

    # Filter to packing-relevant statuses
    valid_statuses = [OrderStatus.PICKED, OrderStatus.PACKING, OrderStatus.PACKED]

    if status:
        try:
            status_enum = OrderStatus(status)
            if status_enum in valid_statuses:
                query = query.where(Order.status == status_enum)
            else:
                query = query.where(Order.status.in_(valid_statuses))
        except ValueError:
            query = query.where(Order.status.in_(valid_statuses))
    else:
        query = query.where(Order.status.in_(valid_statuses))

    # Apply company filter via location
    query = company_filter.apply_location_filter(query, Order.locationId)

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Order.orderNo.ilike(search_pattern)) |
            (Order.customerName.ilike(search_pattern))
        )

    # Apply pagination and ordering (PICKED orders first, then by date)
    query = query.offset(skip).limit(limit).order_by(Order.status, Order.orderDate.desc())

    orders = session.exec(query).all()

    # Build response
    result = []
    for order in orders:
        # Get item count
        item_count = session.exec(
            select(func.count(OrderItem.id)).where(OrderItem.orderId == order.id)
        ).one()

        result.append(PackingOrderResponse(
            id=str(order.id),
            orderNo=order.orderNo,
            channel=order.channel.value if hasattr(order.channel, 'value') else str(order.channel),
            customerName=order.customerName,
            customerPhone=order.customerPhone,
            status=order.status.value if hasattr(order.status, 'value') else str(order.status),
            orderDate=order.orderDate.isoformat() if order.orderDate else "",
            totalAmount=float(order.totalAmount or 0),
            itemCount=item_count,
            pickedAt=order.updatedAt.isoformat() if order.updatedAt and order.status in [OrderStatus.PICKED, OrderStatus.PACKING] else None,
            packingStation=None,  # Can be enhanced to track packing station
        ))

    return result


@router.get("/count")
def count_packing_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of orders in packing-relevant statuses."""
    query = select(func.count(Order.id))

    valid_statuses = [OrderStatus.PICKED, OrderStatus.PACKING, OrderStatus.PACKED]

    if status:
        try:
            status_enum = OrderStatus(status)
            if status_enum in valid_statuses:
                query = query.where(Order.status == status_enum)
            else:
                query = query.where(Order.status.in_(valid_statuses))
        except ValueError:
            query = query.where(Order.status.in_(valid_statuses))
    else:
        query = query.where(Order.status.in_(valid_statuses))

    query = company_filter.apply_location_filter(query, Order.locationId)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/stats", response_model=PackingStatsResponse)
def get_packing_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get packing statistics."""
    base_query = select(Order)
    base_query = company_filter.apply_location_filter(base_query, Order.locationId)

    # Count by status
    ready_query = select(func.count(Order.id)).where(Order.status == OrderStatus.PICKED)
    ready_query = company_filter.apply_location_filter(ready_query, Order.locationId)
    ready_count = session.exec(ready_query).one()

    in_progress_query = select(func.count(Order.id)).where(Order.status == OrderStatus.PACKING)
    in_progress_query = company_filter.apply_location_filter(in_progress_query, Order.locationId)
    in_progress_count = session.exec(in_progress_query).one()

    # Packed today
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    packed_today_query = select(func.count(Order.id)).where(
        Order.status == OrderStatus.PACKED,
        Order.updatedAt >= today_start,
    )
    packed_today_query = company_filter.apply_location_filter(packed_today_query, Order.locationId)
    packed_today = session.exec(packed_today_query).one()

    # Total packed
    total_packed_query = select(func.count(Order.id)).where(Order.status == OrderStatus.PACKED)
    total_packed_query = company_filter.apply_location_filter(total_packed_query, Order.locationId)
    total_packed = session.exec(total_packed_query).one()

    return PackingStatsResponse(
        readyToPack=ready_count,
        inProgress=in_progress_count,
        packedToday=packed_today,
        totalPacked=total_packed
    )


# ============================================================================
# Dynamic Routes (/{order_id} - must come after static routes)
# ============================================================================

@router.get("/{order_id}", response_model=PackingOrderResponse)
def get_order_for_packing(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific order for packing with its items."""
    order = session.get(Order, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check company access
    if company_filter.company_id:
        location = session.get(Location, order.locationId)
        if location and location.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this order"
            )

    # Get order items
    order_items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order_id)
    ).all()

    items = []
    for item in order_items:
        sku_code, sku_name = get_sku_info(session, item.skuId)
        items.append(PackingOrderItem(
            id=str(item.id),
            skuId=str(item.skuId),
            skuCode=sku_code,
            skuName=sku_name,
            quantity=item.quantity,
            pickedQty=getattr(item, 'pickedQty', item.quantity),
            packedQty=getattr(item, 'packedQty', 0),
        ))

    return PackingOrderResponse(
        id=str(order.id),
        orderNo=order.orderNo,
        channel=order.channel.value if hasattr(order.channel, 'value') else str(order.channel),
        customerName=order.customerName,
        customerPhone=order.customerPhone,
        status=order.status.value if hasattr(order.status, 'value') else str(order.status),
        orderDate=order.orderDate.isoformat() if order.orderDate else "",
        totalAmount=float(order.totalAmount or 0),
        itemCount=len(items),
        items=items,
        pickedAt=order.updatedAt.isoformat() if order.updatedAt else None,
    )


@router.post("/{order_id}", response_model=PackingActionResponse)
def update_packing_status(
    order_id: UUID,
    request: PackingActionRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """
    Update packing status for an order.

    Actions:
    - "start": Transition from PICKED → PACKING
    - "complete": Transition from PACKING → PACKED and create Delivery record

    For "complete" action, optionally provide:
    - boxes: Number of boxes (default 1)
    - weight: Total weight in kg
    - length, width, height: Dimensions in cm
    - transporterId: Transporter to assign
    """
    order = session.get(Order, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check company access
    if company_filter.company_id:
        location = session.get(Location, order.locationId)
        if location and location.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this order"
            )

    action = request.action.lower()

    if action == "start":
        # Validate current status
        if order.status != OrderStatus.PICKED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start packing for order in {order.status.value} status. Expected PICKED."
            )

        # Transition to PACKING
        order.status = OrderStatus.PACKING
        order.updatedAt = datetime.utcnow()

        session.add(order)
        session.commit()
        session.refresh(order)

        return PackingActionResponse(
            success=True,
            orderId=str(order.id),
            orderNo=order.orderNo,
            status=order.status.value,
            message="Packing started successfully"
        )

    elif action == "complete":
        # Validate current status
        if order.status not in [OrderStatus.PACKING, OrderStatus.PICKED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete packing for order in {order.status.value} status. Expected PACKING or PICKED."
            )

        # Transition to PACKED
        order.status = OrderStatus.PACKED
        order.updatedAt = datetime.utcnow()

        # Update order items to PACKED status
        order_items = session.exec(
            select(OrderItem).where(OrderItem.orderId == order_id)
        ).all()

        for item in order_items:
            item.status = ItemStatus.PACKED
            if hasattr(item, 'packedQty'):
                item.packedQty = item.quantity
            session.add(item)

        session.add(order)

        # Create Delivery record
        delivery_no = generate_delivery_number(session)

        # Get transporter if specified
        transporter_id = None
        if request.transporterId:
            try:
                transporter_id = UUID(request.transporterId)
            except ValueError:
                pass

        delivery = Delivery(
            deliveryNo=delivery_no,
            orderId=order.id,
            companyId=order.companyId,
            status=DeliveryStatus.PENDING,
            transporterId=transporter_id,
            boxes=request.boxes or 1,
            weight=request.weight,
            length=request.length,
            width=request.width,
            height=request.height,
        )

        session.add(delivery)
        session.commit()
        session.refresh(order)
        session.refresh(delivery)

        return PackingActionResponse(
            success=True,
            orderId=str(order.id),
            orderNo=order.orderNo,
            status=order.status.value,
            message="Packing completed successfully. Delivery record created.",
            deliveryId=str(delivery.id),
            deliveryNo=delivery.deliveryNo
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action: {action}. Expected 'start' or 'complete'."
        )
