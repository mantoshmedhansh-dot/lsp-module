"""
Orders API v1 - Order, OrderItem, and Delivery management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_client, CompanyFilter
from app.core.rate_limit import limiter, heavy_limit
from app.models import (
    Order, OrderCreate, OrderUpdate, OrderResponse, OrderBrief,
    OrderItem, OrderItemCreate, OrderItemUpdate, OrderItemResponse,
    Delivery, DeliveryCreate, DeliveryUpdate, DeliveryResponse,
    Location, User, OrderStatus, Channel, OrderType, PaymentMode,
    ItemStatus, DeliveryStatus, SKU
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
    _: None = Depends(require_client())
):
    """Create a new order. Requires CLIENT or higher role."""
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


@router.post("/{order_id}/confirm", response_model=OrderResponse)
def confirm_order(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Confirm an order for fulfillment.

    Validates the order and moves it from CREATED to CONFIRMED status.
    This is a prerequisite for inventory allocation.
    """
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

    # Check if order can be confirmed
    if order.status != OrderStatus.CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm order in {order.status.value} status. Only CREATED orders can be confirmed."
        )

    # Validate order has items
    items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order_id)
    ).all()

    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm order without items"
        )

    order.status = OrderStatus.CONFIRMED
    order.updatedAt = datetime.utcnow()
    session.add(order)
    session.commit()
    session.refresh(order)

    return OrderResponse.model_validate(order)


@router.post("/{order_id}/invoice")
def generate_invoice(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Generate invoice for a packed order.

    Creates a GST-compliant tax invoice with:
    - Invoice number (auto-generated)
    - CGST/SGST (intra-state) or IGST (inter-state)
    - HSN codes for items
    - E-way bill reference (if applicable)

    Updates order status to INVOICED.
    """
    from datetime import datetime

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

    # Check if order can be invoiced (should be PACKED or after picking)
    invoiceable_statuses = [
        OrderStatus.PACKED,
        OrderStatus.PICKED,
        OrderStatus.PICKING,
        OrderStatus.PICKLIST_GENERATED,
        OrderStatus.ALLOCATED
    ]
    if order.status not in invoiceable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate invoice for order in {order.status.value} status"
        )

    # Get order items for invoice
    items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order_id)
    ).all()

    # Generate invoice number
    today = datetime.utcnow().strftime("%Y%m%d")
    invoice_count = session.exec(
        select(func.count(Order.id)).where(
            Order.invoiceNo != None,
            Order.invoiceNo.like(f"INV-{today}-%")
        )
    ).one()
    invoice_no = f"INV-{today}-{invoice_count + 1:04d}"

    # Calculate totals
    subtotal = sum(float(item.subtotal or 0) for item in items)
    tax_amount = sum(float(item.taxAmount or 0) for item in items)

    # Update order with invoice details
    order.invoiceNo = invoice_no
    order.invoiceDate = datetime.utcnow()
    order.status = OrderStatus.INVOICED
    order.updatedAt = datetime.utcnow()

    session.add(order)
    session.commit()
    session.refresh(order)

    # Build invoice response
    invoice_items = []
    for item in items:
        sku = session.get(SKU, item.skuId)
        invoice_items.append({
            "skuCode": sku.code if sku else None,
            "skuName": sku.name if sku else item.skuName,
            "hsnCode": sku.hsnCode if sku else None,
            "quantity": item.quantity,
            "unitPrice": str(item.unitPrice),
            "discount": str(item.discount or 0),
            "taxableValue": str(item.subtotal or 0),
            "gstRate": str(item.taxRate or 0),
            "gstAmount": str(item.taxAmount or 0),
            "total": str(item.total or 0)
        })

    return {
        "success": True,
        "orderId": str(order.id),
        "orderNo": order.orderNo,
        "invoiceNo": invoice_no,
        "invoiceDate": order.invoiceDate.isoformat(),
        "customerName": order.customerName,
        "shippingAddress": order.shippingAddress,
        "subtotal": str(subtotal),
        "taxAmount": str(tax_amount),
        "totalAmount": str(order.totalAmount),
        "items": invoice_items,
        "status": "INVOICED"
    }


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
# Order Allocation Endpoint
# ============================================================================

@router.post("/{order_id}/allocate")
def allocate_order(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Allocate inventory for all items in an order.
    Uses FIFO/LIFO/FEFO based on configuration.
    """
    from app.models import AllocationRequest, SKU
    from app.services.inventory_allocation import InventoryAllocationService

    # Get order
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

    # Check order status
    if order.status not in [OrderStatus.CREATED, OrderStatus.CONFIRMED, OrderStatus.PARTIALLY_ALLOCATED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot allocate order in {order.status.value} status"
        )

    # Get order items
    order_items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order_id)
    ).all()

    if not order_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has no items to allocate"
        )

    # Initialize allocation service
    allocation_service = InventoryAllocationService(session)

    # Track results
    results = {
        "orderId": str(order_id),
        "orderNo": order.orderNo,
        "itemsProcessed": 0,
        "itemsFullyAllocated": 0,
        "itemsPartiallyAllocated": 0,
        "itemsNotAllocated": 0,
        "totalAllocated": 0,
        "shortfalls": [],
        "fullyAllocated": False
    }

    # Process each order item
    for order_item in order_items:
        # Skip already fully allocated items
        already_allocated = order_item.allocatedQty or 0
        remaining_qty = order_item.quantity - already_allocated

        if remaining_qty <= 0:
            results["itemsFullyAllocated"] += 1
            results["itemsProcessed"] += 1
            continue

        # Create allocation request
        request = AllocationRequest(
            skuId=order_item.skuId,
            requiredQty=remaining_qty,
            locationId=order.locationId,
            orderId=order.id,
            orderItemId=order_item.id,
        )

        # Allocate inventory
        result = allocation_service.allocate_inventory(
            request=request,
            company_id=order.companyId,
            allocated_by_id=current_user.id
        )

        results["itemsProcessed"] += 1
        results["totalAllocated"] += result.allocatedQty

        # Update order item allocated qty
        order_item.allocatedQty = already_allocated + result.allocatedQty
        if result.allocatedQty >= remaining_qty:
            order_item.status = ItemStatus.ALLOCATED
            results["itemsFullyAllocated"] += 1
        elif result.allocatedQty > 0:
            results["itemsPartiallyAllocated"] += 1
        else:
            results["itemsNotAllocated"] += 1

        session.add(order_item)

        # Track shortfalls
        if result.shortfallQty > 0:
            sku = session.get(SKU, order_item.skuId)
            results["shortfalls"].append({
                "skuId": str(order_item.skuId),
                "skuCode": sku.code if sku else "Unknown",
                "required": remaining_qty,
                "allocated": result.allocatedQty,
                "shortfall": result.shortfallQty
            })

    # Update order status
    if results["itemsFullyAllocated"] == len(order_items):
        order.status = OrderStatus.ALLOCATED
        results["fullyAllocated"] = True
    elif results["itemsFullyAllocated"] + results["itemsPartiallyAllocated"] > 0:
        order.status = OrderStatus.PARTIALLY_ALLOCATED
    # If no allocations at all, keep current status

    order.updatedAt = datetime.utcnow()
    session.add(order)
    session.commit()

    return results


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
        # Override orderId from URL and set companyId from order
        delivery_dict = delivery_data.model_dump()
        delivery_dict["orderId"] = order_id
        delivery_dict["companyId"] = order.companyId

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
@limiter.limit("10/minute")
def import_orders(
    request: Request,
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
                companyId=location.companyId,
                orderDate=order_date,
                channel=channel,
                orderType=OrderType.B2C,
                paymentMode=payment_mode,
                customerName=first_row.customer_name,
                customerPhone=first_row.customer_phone,
                customerEmail=first_row.customer_email,
                shippingAddress={
                    "name": first_row.customer_name,
                    "line1": first_row.shipping_address_line1,
                    "line2": first_row.shipping_address_line2 or "",
                    "city": first_row.shipping_city,
                    "state": first_row.shipping_state,
                    "pincode": first_row.shipping_pincode,
                    "country": "India",
                },
                subtotal=subtotal,
                taxAmount=total_tax,
                discount=total_discount,
                shippingCharges=shipping_charges,
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
            from app.models import SKU
            for row in rows:
                # Find SKU by code (required)
                sku = session.exec(
                    select(SKU).where(SKU.code == row.sku_code)
                ).first()

                if not sku:
                    raise ValueError(f"SKU not found: {row.sku_code}")

                item_total = row.unit_price * row.quantity

                item = OrderItem(
                    orderId=order.id,
                    skuId=sku.id,
                    quantity=row.quantity,
                    unitPrice=row.unit_price,
                    taxAmount=row.tax_amount or 0,
                    discount=row.discount or 0,
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
