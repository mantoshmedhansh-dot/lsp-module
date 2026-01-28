"""
External Orders API v1 - Client integration endpoints
For external systems to create and manage orders via API
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.api_key import APIKey
from app.models.order import Order, OrderItem, OrderStatus
from app.models.sku import SKU
from app.models.customer import Customer
from app.models.company import Location
from app.models.external_order import (
    ExternalOrderCreate,
    ExternalOrderResponse,
    ExternalOrderError,
    ExternalBulkOrderCreate,
    ExternalBulkOrderResponse,
)

router = APIRouter(prefix="/orders/external", tags=["External Orders API"])


async def verify_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_channel: Optional[str] = Header(None, alias="X-Channel"),
    session: Session = Depends(get_session)
) -> APIKey:
    """
    Verify API key and return the associated APIKey object.
    Updates last used timestamp.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    # Find API key
    api_key = session.exec(
        select(APIKey).where(APIKey.key == x_api_key)
    ).first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    if not api_key.isActive:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is inactive"
        )

    if api_key.expiresAt and api_key.expiresAt < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired"
        )

    # Check channel permission if specified
    if x_channel and api_key.channel and api_key.channel != x_channel:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"API key not authorized for channel: {x_channel}"
        )

    # Update last used timestamp
    api_key.lastUsedAt = datetime.now(timezone.utc)
    session.add(api_key)
    session.commit()

    return api_key


def generate_order_number(session: Session) -> str:
    """Generate unique order number"""
    from sqlmodel import func
    today = datetime.now(timezone.utc)
    prefix = f"ORD-{today.strftime('%Y%m%d')}"

    # Count orders created today
    count = session.exec(
        select(func.count(Order.id)).where(
            Order.orderNo.like(f"{prefix}%")
        )
    ).one()

    return f"{prefix}-{(count + 1):04d}"


def find_or_create_customer(
    customer_data: dict,
    company_id: UUID,
    session: Session
) -> Customer:
    """Find existing customer or create new one"""
    # Try to find by phone
    customer = session.exec(
        select(Customer).where(
            Customer.phone == customer_data["phone"],
            Customer.companyId == company_id
        )
    ).first()

    if not customer:
        # Create new customer
        customer = Customer(
            name=customer_data["name"],
            email=customer_data.get("email"),
            phone=customer_data["phone"],
            companyId=company_id
        )
        session.add(customer)
        session.flush()

    return customer


@router.post("", response_model=ExternalOrderResponse)
async def create_external_order(
    order_data: ExternalOrderCreate,
    request: Request,
    api_key: APIKey = Depends(verify_api_key),
    session: Session = Depends(get_session)
):
    """
    Create a new order from external system.

    This endpoint is used by clients to push orders from their systems
    (e-commerce platforms, POS, marketplaces, etc.) into the OMS.

    **Authentication:** Requires X-API-Key header

    **Rate Limit:** Based on API key configuration (default: 1000/hour)
    """
    try:
        company_id = api_key.companyId

        # Check for duplicate external order ID
        existing = session.exec(
            select(Order).where(
                Order.externalOrderNo == order_data.externalOrderId,
                Order.channel == order_data.channel,
                Order.companyId == company_id
            )
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Order with externalOrderId '{order_data.externalOrderId}' already exists for this channel"
            )

        # Find or create customer
        customer = find_or_create_customer(
            order_data.customer.model_dump(),
            company_id,
            session
        )

        # Validate SKUs and build order items
        order_items = []
        calculated_subtotal = Decimal("0.00")

        for item_data in order_data.items:
            sku = session.exec(
                select(SKU).where(SKU.code == item_data.sku)
            ).first()

            if not sku:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"SKU not found: {item_data.sku}"
                )

            item_total = (item_data.unitPrice * item_data.quantity) - item_data.discount
            calculated_subtotal += item_total

            order_items.append({
                "skuId": sku.id,
                "skuCode": sku.code,
                "skuName": item_data.name or sku.name,
                "quantity": item_data.quantity,
                "unitPrice": item_data.unitPrice,
                "discount": item_data.discount,
                "taxRate": item_data.taxRate,
                "taxAmount": item_total * (item_data.taxRate / 100),
                "totalPrice": item_total + (item_total * (item_data.taxRate / 100))
            })

        # Get warehouse/location
        location = None
        if order_data.preferredWarehouse:
            location = session.exec(
                select(Location).where(Location.code == order_data.preferredWarehouse)
            ).first()

        if not location:
            # Get default warehouse
            location = session.exec(
                select(Location).where(Location.type == "WAREHOUSE").limit(1)
            ).first()

        if not location:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No warehouse configured. Please contact admin."
            )

        # Calculate totals
        if order_data.charges:
            subtotal = order_data.charges.subtotal
            discount = order_data.charges.discount
            shipping = order_data.charges.shippingCharges
            cod_charges = order_data.charges.codCharges
            tax_amount = order_data.charges.taxAmount
            total_amount = order_data.charges.totalAmount
        else:
            # Auto-calculate
            subtotal = calculated_subtotal
            discount = Decimal("0.00")
            shipping = Decimal("0.00")
            cod_charges = Decimal("50.00") if order_data.paymentMode == "COD" else Decimal("0.00")
            tax_amount = sum(Decimal(str(item["taxAmount"])) for item in order_items)
            total_amount = subtotal - discount + shipping + cod_charges + tax_amount

        # Generate order number
        order_no = generate_order_number(session)

        # Build shipping address as JSON
        shipping_addr = order_data.shippingAddress
        billing_addr = order_data.billingAddress or shipping_addr

        shipping_address_json = {
            "name": shipping_addr.name,
            "line1": shipping_addr.line1,
            "line2": shipping_addr.line2,
            "city": shipping_addr.city,
            "state": shipping_addr.state,
            "pincode": shipping_addr.pincode,
            "country": shipping_addr.country,
            "phone": shipping_addr.phone or customer.phone,
        }

        billing_address_json = {
            "name": billing_addr.name,
            "line1": billing_addr.line1,
            "line2": billing_addr.line2,
            "city": billing_addr.city,
            "state": billing_addr.state,
            "pincode": billing_addr.pincode,
            "country": billing_addr.country,
        }

        # Create order
        order = Order(
            orderNo=order_no,
            externalOrderNo=order_data.externalOrderId,
            channel=order_data.channel,
            status=OrderStatus.CREATED,
            paymentMode=order_data.paymentMode,
            orderDate=order_data.orderDate or datetime.now(timezone.utc),

            # Customer
            customerId=customer.id,
            customerName=customer.name,
            customerEmail=customer.email,
            customerPhone=customer.phone,

            # Addresses as JSON
            shippingAddress=shipping_address_json,
            billingAddress=billing_address_json,

            # Amounts
            subtotal=subtotal,
            discount=discount,
            shippingCharges=shipping,
            codCharges=cod_charges,
            taxAmount=tax_amount,
            totalAmount=total_amount,

            # Meta
            remarks=order_data.notes,
            tags=order_data.tags or [],
            priority=1 if order_data.isPriority else 0,

            # Location & Company
            locationId=location.id,
            companyId=company_id,
        )

        session.add(order)
        session.flush()

        # Create order items
        for item in order_items:
            order_item = OrderItem(
                orderId=order.id,
                skuId=item["skuId"],
                quantity=item["quantity"],
                unitPrice=item["unitPrice"],
                discount=item["discount"],
                taxAmount=item["taxAmount"],
                totalPrice=item["totalPrice"],
            )
            session.add(order_item)

        session.commit()
        session.refresh(order)

        return ExternalOrderResponse(
            success=True,
            orderId=order.id,
            orderNo=order.orderNo,
            externalOrderId=order_data.externalOrderId,
            status=order.status,
            message="Order created successfully",
            createdAt=order.createdAt
        )

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )


@router.post("/bulk", response_model=ExternalBulkOrderResponse)
async def create_bulk_orders(
    bulk_data: ExternalBulkOrderCreate,
    request: Request,
    api_key: APIKey = Depends(verify_api_key),
    session: Session = Depends(get_session)
):
    """
    Create multiple orders in a single request.

    **Limit:** Maximum 100 orders per request

    **Behavior:**
    - Each order is processed independently
    - Partial success is possible (some orders may fail while others succeed)
    - Check the response for individual order results
    """
    results = []
    errors = []

    for idx, order_data in enumerate(bulk_data.orders):
        try:
            # Process each order (simplified - calls same logic)
            response = await create_external_order(
                order_data=order_data,
                request=request,
                api_key=api_key,
                session=session
            )
            results.append(response)
        except HTTPException as e:
            errors.append({
                "index": idx,
                "externalOrderId": order_data.externalOrderId,
                "error": e.detail,
                "errorCode": f"HTTP_{e.status_code}"
            })
        except Exception as e:
            errors.append({
                "index": idx,
                "externalOrderId": order_data.externalOrderId,
                "error": str(e),
                "errorCode": "INTERNAL_ERROR"
            })

    return ExternalBulkOrderResponse(
        success=len(errors) == 0,
        totalReceived=len(bulk_data.orders),
        totalCreated=len(results),
        totalFailed=len(errors),
        orders=results,
        errors=errors
    )


@router.get("/{external_order_id}")
async def get_order_by_external_id(
    external_order_id: str,
    x_channel: Optional[str] = Header(None, alias="X-Channel"),
    api_key: APIKey = Depends(verify_api_key),
    session: Session = Depends(get_session)
):
    """
    Get order details by external order ID.

    Use this to check the status of an order you previously created.
    """
    query = select(Order).where(
        Order.externalOrderNo == external_order_id,
        Order.companyId == api_key.companyId
    )

    if x_channel:
        query = query.where(Order.channel == x_channel)

    order = session.exec(query).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order not found: {external_order_id}"
        )

    # Get order items
    items = session.exec(
        select(OrderItem).where(OrderItem.orderId == order.id)
    ).all()

    # Get shipping address from JSON
    shipping_addr = order.shippingAddress or {}

    return {
        "orderId": order.id,
        "orderNo": order.orderNo,
        "externalOrderId": order.externalOrderNo,
        "channel": order.channel,
        "status": order.status,
        "paymentMode": order.paymentMode,
        "customerName": order.customerName,
        "shippingCity": shipping_addr.get("city"),
        "shippingState": shipping_addr.get("state"),
        "shippingPincode": shipping_addr.get("pincode"),
        "totalAmount": str(order.totalAmount),
        "itemCount": len(items),
        "items": [
            {
                "skuId": str(item.skuId),
                "quantity": item.quantity,
                "unitPrice": str(item.unitPrice),
                "totalPrice": str(item.totalPrice)
            }
            for item in items
        ],
        "createdAt": order.createdAt,
        "updatedAt": order.updatedAt
    }


@router.post("/{external_order_id}/cancel")
async def cancel_order(
    external_order_id: str,
    reason: Optional[str] = None,
    api_key: APIKey = Depends(verify_api_key),
    session: Session = Depends(get_session)
):
    """
    Cancel an order by external order ID.

    **Note:** Orders can only be cancelled if they haven't been shipped yet.
    """
    order = session.exec(
        select(Order).where(
            Order.externalOrderNo == external_order_id,
            Order.companyId == api_key.companyId
        )
    ).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order not found: {external_order_id}"
        )

    # Check if order can be cancelled
    non_cancellable = ["SHIPPED", "DELIVERED", "RTO_INITIATED", "RTO_DELIVERED"]
    if order.status in non_cancellable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel order in status: {order.status}"
        )

    # Cancel the order
    order.status = OrderStatus.CANCELLED
    # Store cancel reason in remarks if provided
    if reason:
        order.remarks = f"Cancelled: {reason}" if not order.remarks else f"{order.remarks} | Cancelled: {reason}"

    session.add(order)
    session.commit()

    return {
        "success": True,
        "orderId": order.id,
        "orderNo": order.orderNo,
        "externalOrderId": external_order_id,
        "status": "CANCELLED",
        "message": "Order cancelled successfully"
    }
