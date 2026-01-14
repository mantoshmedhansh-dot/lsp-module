from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from ...core.database import get_db
from ...models.order import Order, OrderItem, OrderStatus, Channel, PaymentMode, OrderType
from ...models.user import User
from ..deps import get_current_user

router = APIRouter()


class OrderItemCreate(BaseModel):
    skuId: str
    quantity: int
    unitPrice: float
    taxAmount: float = 0
    discount: float = 0


class OrderCreate(BaseModel):
    channel: Channel
    orderType: OrderType = OrderType.B2C
    paymentMode: PaymentMode
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    shippingAddress: dict
    billingAddress: Optional[dict] = None
    items: List[OrderItemCreate]
    locationId: str
    externalOrderNo: Optional[str] = None
    remarks: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    orderNo: str
    externalOrderNo: Optional[str] = None
    channel: str
    orderType: str
    paymentMode: str
    status: str
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    subtotal: float
    taxAmount: float
    shippingCharges: float
    discount: float
    totalAmount: float
    orderDate: datetime
    locationId: str
    createdAt: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[OrderResponse])
async def list_orders(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    status: Optional[OrderStatus] = None,
    channel: Optional[Channel] = None,
    search: Optional[str] = None,
    locationId: Optional[str] = None,
    fromDate: Optional[datetime] = None,
    toDate: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Order)

    if status:
        query = query.filter(Order.status == status)

    if channel:
        query = query.filter(Order.channel == channel)

    if locationId:
        query = query.filter(Order.locationId == locationId)

    if search:
        query = query.filter(
            (Order.orderNo.ilike(f"%{search}%")) |
            (Order.customerName.ilike(f"%{search}%")) |
            (Order.customerPhone.ilike(f"%{search}%"))
        )

    if fromDate:
        query = query.filter(Order.orderDate >= fromDate)

    if toDate:
        query = query.filter(Order.orderDate <= toDate)

    query = query.order_by(Order.createdAt.desc())
    orders = query.offset((page - 1) * pageSize).limit(pageSize).all()

    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/count")
async def get_order_counts(
    locationId: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Order.status, func.count(Order.id))

    if locationId:
        query = query.filter(Order.locationId == locationId)

    query = query.group_by(Order.status)
    results = query.all()

    counts = {status.value: 0 for status in OrderStatus}
    for status, count in results:
        counts[status.value] = count

    return counts


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Generate order number
    order_no = f"ORD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    # Calculate totals
    subtotal = sum(item.quantity * item.unitPrice for item in order_data.items)
    tax_amount = sum(item.taxAmount for item in order_data.items)
    discount = sum(item.discount for item in order_data.items)
    total_amount = subtotal + tax_amount - discount

    order = Order(
        id=str(uuid.uuid4()),
        orderNo=order_no,
        externalOrderNo=order_data.externalOrderNo,
        channel=order_data.channel,
        orderType=order_data.orderType,
        paymentMode=order_data.paymentMode,
        customerName=order_data.customerName,
        customerPhone=order_data.customerPhone,
        customerEmail=order_data.customerEmail,
        shippingAddress=order_data.shippingAddress,
        billingAddress=order_data.billingAddress,
        subtotal=subtotal,
        taxAmount=tax_amount,
        discount=discount,
        totalAmount=total_amount,
        orderDate=datetime.now(),
        locationId=order_data.locationId,
        remarks=order_data.remarks
    )

    db.add(order)

    # Create order items
    for item_data in order_data.items:
        item = OrderItem(
            id=str(uuid.uuid4()),
            orderId=order.id,
            skuId=item_data.skuId,
            quantity=item_data.quantity,
            unitPrice=item_data.unitPrice,
            taxAmount=item_data.taxAmount,
            discount=item_data.discount,
            totalPrice=item_data.quantity * item_data.unitPrice + item_data.taxAmount - item_data.discount
        )
        db.add(item)

    db.commit()
    db.refresh(order)

    return OrderResponse.model_validate(order)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    return OrderResponse.model_validate(order)


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    new_status: OrderStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    order.status = new_status
    db.commit()

    return {"message": "Order status updated", "status": new_status.value}
