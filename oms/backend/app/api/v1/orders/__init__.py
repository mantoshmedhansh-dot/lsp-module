"""
Orders API v1 - Order, OrderItem, and Delivery management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Order, OrderCreate, OrderUpdate, OrderResponse, OrderBrief,
    OrderItem, OrderItemCreate, OrderItemUpdate, OrderItemResponse,
    Delivery, DeliveryCreate, DeliveryUpdate, DeliveryResponse,
    Location, User, OrderStatus, Channel, OrderType, PaymentMode,
    ItemStatus, DeliveryStatus
)

router = APIRouter(prefix="/orders", tags=["Orders"])


# ============================================================================
# Order Endpoints
# ============================================================================

@router.get("", response_model=List[OrderBrief])
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[OrderStatus] = None,
    channel: Optional[Channel] = None,
    order_type: Optional[OrderType] = None,
    location_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List orders with pagination and filters.
    Filtered by company via location.
    """
    query = select(Order)

    # Apply company filter via location
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Order.locationId.in_(location_ids))

    # Filter by user's location access (unless super admin)
    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Order.locationId.in_(current_user.locationAccess))

    # Apply filters
    if status:
        query = query.where(Order.status == status)
    if channel:
        query = query.where(Order.channel == channel)
    if order_type:
        query = query.where(Order.orderType == order_type)
    if location_id:
        query = query.where(Order.locationId == location_id)
    if customer_id:
        query = query.where(Order.customerId == customer_id)
    if date_from:
        query = query.where(Order.orderDate >= date_from)
    if date_to:
        query = query.where(Order.orderDate <= date_to)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Order.orderNo.ilike(search_pattern)) |
            (Order.customerName.ilike(search_pattern)) |
            (Order.customerPhone.ilike(search_pattern))
        )

    # Apply pagination and ordering
    query = query.offset(skip).limit(limit).order_by(Order.orderDate.desc())

    orders = session.exec(query).all()
    return [OrderBrief.model_validate(o) for o in orders]


@router.get("/count")
def count_orders(
    status: Optional[OrderStatus] = None,
    channel: Optional[Channel] = None,
    order_type: Optional[OrderType] = None,
    location_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of orders matching filters."""
    query = select(func.count(Order.id))

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Order.locationId.in_(location_ids))

    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Order.locationId.in_(current_user.locationAccess))

    if status:
        query = query.where(Order.status == status)
    if channel:
        query = query.where(Order.channel == channel)
    if order_type:
        query = query.where(Order.orderType == order_type)
    if location_id:
        query = query.where(Order.locationId == location_id)
    if date_from:
        query = query.where(Order.orderDate >= date_from)
    if date_to:
        query = query.where(Order.orderDate <= date_to)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/stats")
def get_order_stats(
    location_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get order statistics."""
    base_query = select(Order)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        base_query = base_query.where(Order.locationId.in_(location_ids))

    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        base_query = base_query.where(Order.locationId.in_(current_user.locationAccess))

    if location_id:
        base_query = base_query.where(Order.locationId == location_id)
    if date_from:
        base_query = base_query.where(Order.orderDate >= date_from)
    if date_to:
        base_query = base_query.where(Order.orderDate <= date_to)

    # Count by status
    status_counts = {}
    for s in OrderStatus:
        count_query = select(func.count(Order.id)).where(Order.status == s)
        if company_filter.company_id:
            count_query = count_query.where(Order.locationId.in_(location_ids))
        count = session.exec(count_query).one()
        status_counts[s.value] = count

    # Total amount
    total_query = select(func.sum(Order.totalAmount))
    if company_filter.company_id:
        total_query = total_query.where(Order.locationId.in_(location_ids))
    if location_id:
        total_query = total_query.where(Order.locationId == location_id)
    if date_from:
        total_query = total_query.where(Order.orderDate >= date_from)
    if date_to:
        total_query = total_query.where(Order.orderDate <= date_to)

    total_amount = session.exec(total_query).one() or 0

    return {
        "status_counts": status_counts,
        "total_amount": float(total_amount)
    }


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific order by ID."""
    query = select(Order).where(Order.id == order_id)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Order.locationId.in_(location_ids))

    order = session.exec(query).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check location access
    if (current_user.role != "SUPER_ADMIN" and
        current_user.locationAccess and
        order.locationId not in current_user.locationAccess):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this order"
        )

    return OrderResponse.model_validate(order)


@router.get("/number/{order_no}", response_model=OrderResponse)
def get_order_by_number(
    order_no: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get an order by order number."""
    query = select(Order).where(Order.orderNo == order_no)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Order.locationId.in_(location_ids))

    order = session.exec(query).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    return OrderResponse.model_validate(order)


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_data: OrderCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Create a new order. Requires MANAGER or higher role."""
    # Validate location
    location = session.exec(
        select(Location).where(Location.id == order_data.locationId)
    ).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    if company_filter.company_id and location.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create orders for other companies"
        )

    # Check for duplicate order number
    existing = session.exec(
        select(Order).where(Order.orderNo == order_data.orderNo)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order number already exists"
        )

    # Create order
    try:
        order_dict = order_data.model_dump()
        # Set companyId from location
        order_dict["companyId"] = location.companyId
        order = Order(**order_dict)
        session.add(order)
        session.commit()
        session.refresh(order)
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )

    return OrderResponse.model_validate(order)


@router.patch("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: UUID,
    order_data: OrderUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update an order. Requires MANAGER or higher role."""
    query = select(Order).where(Order.id == order_id)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Order.locationId.in_(location_ids))

    order = session.exec(query).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Update fields
    update_dict = order_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(order, field, value)

    session.add(order)
    session.commit()
    session.refresh(order)

    return OrderResponse.model_validate(order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Cancel an order. Requires MANAGER or higher role."""
    query = select(Order).where(Order.id == order_id)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Order.locationId.in_(location_ids))

    order = session.exec(query).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check if order can be cancelled
    non_cancellable = [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED]
    if order.status in non_cancellable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order in {order.status.value} status"
        )

    order.status = OrderStatus.CANCELLED
    session.add(order)
    session.commit()
    session.refresh(order)

    return OrderResponse.model_validate(order)


# ============================================================================
# Order Item Endpoints
# ============================================================================

@router.get("/{order_id}/items", response_model=List[OrderItemResponse])
def list_order_items(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items for a specific order."""
    # Verify order exists and access
    order_query = select(Order).where(Order.id == order_id)
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        order_query = order_query.where(Order.locationId.in_(location_ids))

    order = session.exec(order_query).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Get items
    items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order_id).order_by(OrderItem.createdAt)
    ).all()

    return [OrderItemResponse.model_validate(item) for item in items]


@router.post("/{order_id}/items", response_model=OrderItemResponse, status_code=status.HTTP_201_CREATED)
def create_order_item(
    order_id: UUID,
    item_data: OrderItemCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Add an item to an order. Requires MANAGER or higher role."""
    # Verify order exists
    order_query = select(Order).where(Order.id == order_id)
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        order_query = order_query.where(Order.locationId.in_(location_ids))

    order = session.exec(order_query).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Override orderId from URL
    item_dict = item_data.model_dump()
    item_dict["orderId"] = order_id

    item = OrderItem(**item_dict)
    session.add(item)
    session.commit()
    session.refresh(item)

    return OrderItemResponse.model_validate(item)


@router.patch("/{order_id}/items/{item_id}", response_model=OrderItemResponse)
def update_order_item(
    order_id: UUID,
    item_id: UUID,
    item_data: OrderItemUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update an order item. Requires MANAGER or higher role."""
    item = session.exec(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.orderId == order_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order item not found"
        )

    # Update fields
    update_dict = item_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)

    return OrderItemResponse.model_validate(item)


@router.delete("/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_item(
    order_id: UUID,
    item_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Delete an order item. Requires MANAGER or higher role."""
    item = session.exec(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.orderId == order_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order item not found"
        )

    session.delete(item)
    session.commit()

    return None


# ============================================================================
# Delivery Endpoints
# ============================================================================

@router.get("/{order_id}/deliveries", response_model=List[DeliveryResponse])
def list_deliveries(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List deliveries for a specific order."""
    # Verify order exists
    order_query = select(Order).where(Order.id == order_id)
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        order_query = order_query.where(Order.locationId.in_(location_ids))

    order = session.exec(order_query).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Get deliveries
    deliveries = session.exec(
        select(Delivery).where(Delivery.orderId == order_id).order_by(Delivery.createdAt)
    ).all()

    return [DeliveryResponse.model_validate(d) for d in deliveries]


@router.post("/{order_id}/deliveries", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
def create_delivery(
    order_id: UUID,
    delivery_data: DeliveryCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Create a delivery for an order. Requires MANAGER or higher role."""
    # Verify order exists
    order_query = select(Order).where(Order.id == order_id)
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        order_query = order_query.where(Order.locationId.in_(location_ids))

    order = session.exec(order_query).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check for duplicate delivery number
    existing = session.exec(
        select(Delivery).where(Delivery.deliveryNo == delivery_data.deliveryNo)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery number already exists"
        )

    try:
        # Override orderId from URL
        delivery_dict = delivery_data.model_dump()
        delivery_dict["orderId"] = order_id

        delivery = Delivery(**delivery_dict)
        session.add(delivery)
        session.commit()
        session.refresh(delivery)

        return DeliveryResponse.model_validate(delivery)
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create delivery: {str(e)}"
        )


@router.patch("/{order_id}/deliveries/{delivery_id}", response_model=DeliveryResponse)
def update_delivery(
    order_id: UUID,
    delivery_id: UUID,
    delivery_data: DeliveryUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update a delivery. Requires MANAGER or higher role."""
    delivery = session.exec(
        select(Delivery).where(Delivery.id == delivery_id, Delivery.orderId == order_id)
    ).first()

    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery not found"
        )

    # Update fields
    update_dict = delivery_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(delivery, field, value)

    session.add(delivery)
    session.commit()
    session.refresh(delivery)

    return DeliveryResponse.model_validate(delivery)


@router.get("/deliveries/by-awb/{awb_no}", response_model=DeliveryResponse)
def get_delivery_by_awb(
    awb_no: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a delivery by AWB number."""
    delivery = session.exec(
        select(Delivery).where(Delivery.awbNo == awb_no)
    ).first()

    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery not found"
        )

    # Check company access via order
    order = session.exec(
        select(Order).where(Order.id == delivery.orderId)
    ).first()

    if company_filter.company_id and order:
        location = session.exec(
            select(Location).where(Location.id == order.locationId)
        ).first()
        if location and location.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to this delivery"
            )

    return DeliveryResponse.model_validate(delivery)


# ============================================================================
# Import Endpoints
# ============================================================================

from pydantic import BaseModel
from typing import Dict, Any
import uuid as uuid_lib

class CSVRow(BaseModel):
    order_no: str
    order_date: Optional[str] = None
    channel: Optional[str] = "MANUAL"
    payment_mode: Optional[str] = "PREPAID"
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    shipping_address_line1: str
    shipping_address_line2: Optional[str] = None
    shipping_city: str
    shipping_state: str
    shipping_pincode: str
    sku_code: str
    quantity: int = 1
    unit_price: float = 0
    tax_amount: Optional[float] = 0
    discount: Optional[float] = 0
    shipping_charges: Optional[float] = 0
    cod_charges: Optional[float] = 0
    external_order_no: Optional[str] = None
    remarks: Optional[str] = None
    priority: Optional[int] = 0


class ImportRequest(BaseModel):
    locationId: str
    rows: List[CSVRow]
    fileName: str


class ImportError(BaseModel):
    row: int
    field: Optional[str] = None
    message: str


class ImportSummary(BaseModel):
    totalOrders: int
    createdOrders: int
    failedOrders: int


class ImportResponse(BaseModel):
    id: str
    importNo: str
    fileName: str
    status: str
    totalRows: int
    processedRows: int
    successCount: int
    errorCount: int
    errors: List[ImportError]
    summary: ImportSummary
    createdAt: str


@router.get("/import")
def list_imports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List import history. Currently returns empty list as imports are processed immediately."""
    # Note: In a production system, you would store import records in a database
    # For now, imports are processed synchronously and not stored
    return {
        "data": [],
        "page": page,
        "limit": limit,
        "total": 0,
        "totalPages": 0
    }


@router.post("/import")
def import_orders(
    import_data: ImportRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """
    Import orders from CSV data.
    Requires MANAGER or higher role.
    """
    location_id = UUID(import_data.locationId)

    # Validate location
    location = session.exec(
        select(Location).where(Location.id == location_id)
    ).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    if company_filter.company_id and location.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot import orders to other company's location"
        )

    errors: List[ImportError] = []
    created_orders = 0
    failed_orders = 0

    # Group rows by order_no (one order can have multiple items)
    orders_map: Dict[str, List[CSVRow]] = {}
    for row in import_data.rows:
        if row.order_no not in orders_map:
            orders_map[row.order_no] = []
        orders_map[row.order_no].append(row)

    for order_no, rows in orders_map.items():
        try:
            # Check if order already exists
            existing = session.exec(
                select(Order).where(Order.orderNo == order_no)
            ).first()

            if existing:
                errors.append(ImportError(
                    row=import_data.rows.index(rows[0]) + 1,
                    field="order_no",
                    message=f"Order {order_no} already exists"
                ))
                failed_orders += 1
                continue

            # Get first row for order-level data
            first_row = rows[0]

            # Parse channel
            channel_value = first_row.channel.upper() if first_row.channel else "MANUAL"
            try:
                channel = Channel(channel_value)
            except ValueError:
                channel = Channel.MANUAL

            # Parse payment mode
            payment_mode_value = first_row.payment_mode.upper() if first_row.payment_mode else "PREPAID"
            try:
                payment_mode = PaymentMode(payment_mode_value)
            except ValueError:
                payment_mode = PaymentMode.PREPAID

            # Calculate totals from all items
            subtotal = sum(r.unit_price * r.quantity for r in rows)
            total_tax = sum(r.tax_amount or 0 for r in rows)
            total_discount = sum(r.discount or 0 for r in rows)
            shipping_charges = first_row.shipping_charges or 0
            cod_charges = first_row.cod_charges or 0 if payment_mode == PaymentMode.COD else 0

            total_amount = subtotal + total_tax + shipping_charges + cod_charges - total_discount

            # Parse order date
            order_date = datetime.now()
            if first_row.order_date:
                try:
                    # Try multiple date formats
                    for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]:
                        try:
                            order_date = datetime.strptime(first_row.order_date.split('T')[0], fmt)
                            break
                        except ValueError:
                            continue
                except Exception:
                    pass

            # Create order
            order = Order(
                orderNo=order_no,
                locationId=location_id,
                orderDate=order_date,
                channel=channel,
                orderType=OrderType.B2C,
                paymentMode=payment_mode,
                customerName=first_row.customer_name,
                customerPhone=first_row.customer_phone,
                customerEmail=first_row.customer_email,
                shippingAddress={
                    "name": first_row.customer_name,
                    "addressLine1": first_row.shipping_address_line1,
                    "addressLine2": first_row.shipping_address_line2 or "",
                    "city": first_row.shipping_city,
                    "state": first_row.shipping_state,
                    "pincode": first_row.shipping_pincode,
                },
                subtotal=subtotal,
                taxAmount=total_tax,
                discountAmount=total_discount,
                shippingAmount=shipping_charges,
                codCharges=cod_charges,
                totalAmount=total_amount,
                status=OrderStatus.CREATED,
                priority=first_row.priority or 0,
                remarks=first_row.remarks,
                externalOrderNo=first_row.external_order_no,
            )

            session.add(order)
            session.flush()  # Get the order ID

            # Create order items
            for row in rows:
                # Try to find SKU by code
                from app.models import SKU
                sku = session.exec(
                    select(SKU).where(SKU.code == row.sku_code)
                ).first()

                item_total = row.unit_price * row.quantity

                item = OrderItem(
                    orderId=order.id,
                    skuId=sku.id if sku else None,
                    skuCode=row.sku_code,
                    skuName=sku.name if sku else row.sku_code,
                    quantity=row.quantity,
                    unitPrice=row.unit_price,
                    taxAmount=row.tax_amount or 0,
                    discountAmount=row.discount or 0,
                    totalPrice=item_total + (row.tax_amount or 0) - (row.discount or 0),
                    status=ItemStatus.PENDING,
                )
                session.add(item)

            created_orders += 1

        except Exception as e:
            errors.append(ImportError(
                row=import_data.rows.index(rows[0]) + 1,
                message=str(e)
            ))
            failed_orders += 1
            session.rollback()

    # Commit all changes
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save orders: {str(e)}"
        )

    import_id = str(uuid_lib.uuid4())
    import_no = f"IMP-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    status_value = "COMPLETED" if failed_orders == 0 else ("PARTIAL" if created_orders > 0 else "FAILED")

    return ImportResponse(
        id=import_id,
        importNo=import_no,
        fileName=import_data.fileName,
        status=status_value,
        totalRows=len(import_data.rows),
        processedRows=len(orders_map),
        successCount=created_orders,
        errorCount=failed_orders,
        errors=errors,
        summary=ImportSummary(
            totalOrders=len(orders_map),
            createdOrders=created_orders,
            failedOrders=failed_orders
        ),
        createdAt=datetime.now().isoformat()
    )
