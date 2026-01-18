"""
Order Models - SQLModel Implementation
Orders, OrderItems, and Deliveries
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING, Any
from uuid import UUID

from pydantic import field_validator
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, JSON, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY, NUMERIC

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import (
    Channel, OrderType, PaymentMode, OrderStatus, ItemStatus,
    DeliveryStatus, PaymentTermType
)

if TYPE_CHECKING:
    from .company import Location
    from .sku import SKU
    from .customer import Customer


# ============================================================================
# Database Models
# ============================================================================

class Order(BaseModel, table=True):
    """
    Order model - Sales orders (B2C and B2B).
    Multi-tenant via Location which belongs to Company.
    """
    __tablename__ = "Order"

    # Order identity
    orderNo: str = Field(sa_column=Column(String, unique=True, nullable=False))
    externalOrderNo: Optional[str] = Field(default=None)

    # Order type & channel
    channel: Channel = Field(sa_column=Column(String, nullable=False))
    orderType: OrderType = Field(
        default=OrderType.B2C,
        sa_column=Column(String, default="B2C")
    )
    paymentMode: PaymentMode = Field(sa_column=Column(String, nullable=False))
    status: OrderStatus = Field(
        default=OrderStatus.CREATED,
        sa_column=Column(String, default="CREATED", index=True)
    )

    # Customer info (denormalized for B2C)
    customerName: str = Field(sa_column=Column(String, nullable=False))
    customerPhone: str = Field(sa_column=Column(String, nullable=False))
    customerEmail: Optional[str] = Field(default=None)

    # Addresses (JSON)
    shippingAddress: dict = Field(sa_column=Column(JSON, nullable=False))
    billingAddress: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Amounts
    subtotal: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))
    taxAmount: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))
    shippingCharges: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )
    discount: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )
    codCharges: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )
    totalAmount: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))

    # Dates
    orderDate: datetime = Field(sa_column=Column(nullable=False))
    shipByDate: Optional[datetime] = Field(default=None)
    promisedDate: Optional[datetime] = Field(default=None)

    # Priority & metadata
    priority: int = Field(default=0)
    tags: List[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), default=[])
    )
    remarks: Optional[str] = Field(default=None)

    # Import tracking
    importId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), index=True)
    )
    csvLineNumber: Optional[int] = Field(default=None)
    dataSourceType: Optional[str] = Field(default=None)

    # Replacement order
    replacementForReturnId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), unique=True)
    )

    # Foreign Keys
    locationId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            nullable=False,
            index=True
        )
    )
    customerId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Customer.id"), index=True)
    )
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # B2B fields
    paymentTermType: Optional[PaymentTermType] = Field(
        default=None,
        sa_column=Column(String)
    )
    paymentTermDays: Optional[int] = Field(default=None)
    creditDueDate: Optional[datetime] = Field(default=None)
    poNumber: Optional[str] = Field(default=None)
    gstInvoiceNo: Optional[str] = Field(default=None)
    gstInvoiceDate: Optional[datetime] = Field(default=None)
    eWayBillNo: Optional[str] = Field(default=None)
    irnNo: Optional[str] = Field(default=None)

    # Relationships
    location: Optional["Location"] = Relationship()
    customer: Optional["Customer"] = Relationship(back_populates="orders")
    items: List["OrderItem"] = Relationship(back_populates="order")
    deliveries: List["Delivery"] = Relationship(back_populates="order")


class OrderItem(BaseModel, table=True):
    """
    OrderItem model - Line items in an order.
    """
    __tablename__ = "OrderItem"

    # Foreign Keys
    orderId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Order.id"),
            nullable=False,
            index=True
        )
    )
    skuId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("SKU.id"),
            nullable=False,
            index=True
        )
    )

    # External reference
    externalItemId: Optional[str] = Field(default=None)

    # Quantities
    quantity: int = Field(default=1)
    allocatedQty: int = Field(default=0)
    pickedQty: int = Field(default=0)
    packedQty: int = Field(default=0)
    shippedQty: int = Field(default=0)

    # Pricing
    unitPrice: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))
    taxAmount: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))
    discount: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )
    totalPrice: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))

    # Status
    status: ItemStatus = Field(
        default=ItemStatus.PENDING,
        sa_column=Column(String, default="PENDING")
    )

    # Batch/Serial
    serialNumbers: List[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String), default=[])
    )
    batchNo: Optional[str] = Field(default=None)

    # Relationships
    order: Optional["Order"] = Relationship(back_populates="items")
    sku: Optional["SKU"] = Relationship(back_populates="orderItems")


class Delivery(BaseModel, table=True):
    """
    Delivery model - Shipment tracking for orders.
    """
    __tablename__ = "Delivery"

    # Identity
    deliveryNo: str = Field(sa_column=Column(String, unique=True, nullable=False))

    # Foreign Keys
    orderId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Order.id"),
            nullable=False,
            index=True
        )
    )
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )
    transporterId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Transporter.id"))
    )
    manifestId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Manifest.id"), index=True)
    )

    # Status
    status: DeliveryStatus = Field(
        default=DeliveryStatus.PENDING,
        sa_column=Column(String, default="PENDING", index=True)
    )

    # AWB & Tracking
    awbNo: Optional[str] = Field(
        default=None,
        sa_column=Column(String, index=True)
    )
    trackingUrl: Optional[str] = Field(default=None)

    # Dimensions
    weight: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 3))
    )
    length: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    width: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    height: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    volumetricWeight: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 3))
    )
    boxes: int = Field(default=1)

    # Invoice
    invoiceNo: Optional[str] = Field(default=None)
    invoiceDate: Optional[datetime] = Field(default=None)
    invoiceUrl: Optional[str] = Field(default=None)
    labelUrl: Optional[str] = Field(default=None)

    # Dates
    packDate: Optional[datetime] = Field(default=None)
    shipDate: Optional[datetime] = Field(default=None)
    deliveryDate: Optional[datetime] = Field(default=None)

    # POD (Proof of Delivery)
    podImage: Optional[str] = Field(default=None)
    podSignature: Optional[str] = Field(default=None)
    podRemarks: Optional[str] = Field(default=None)
    receivedBy: Optional[str] = Field(default=None)

    # Remarks
    remarks: Optional[str] = Field(default=None)

    # Relationships
    order: Optional["Order"] = Relationship(back_populates="deliveries")


# ============================================================================
# Request/Response Schemas
# ============================================================================

# --- Order Schemas ---

class OrderBase(SQLModel):
    """Shared order fields"""
    channel: Channel
    orderType: OrderType = OrderType.B2C
    paymentMode: PaymentMode
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    shippingAddress: dict
    billingAddress: Optional[dict] = None
    subtotal: Decimal
    taxAmount: Decimal
    shippingCharges: Decimal = Decimal("0")
    discount: Decimal = Decimal("0")
    codCharges: Decimal = Decimal("0")
    totalAmount: Decimal
    orderDate: datetime
    shipByDate: Optional[datetime] = None
    promisedDate: Optional[datetime] = None
    priority: int = 0
    tags: List[str] = []
    remarks: Optional[str] = None


class OrderCreate(CreateBase):
    """Schema for creating an order"""
    orderNo: str
    externalOrderNo: Optional[str] = None
    channel: Channel
    orderType: OrderType = OrderType.B2C
    paymentMode: PaymentMode
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    shippingAddress: dict
    billingAddress: Optional[dict] = None
    subtotal: Decimal
    taxAmount: Decimal
    shippingCharges: Decimal = Decimal("0")
    discount: Decimal = Decimal("0")
    codCharges: Decimal = Decimal("0")
    totalAmount: Decimal
    orderDate: datetime
    shipByDate: Optional[datetime] = None
    promisedDate: Optional[datetime] = None
    priority: int = 0
    tags: List[str] = []
    remarks: Optional[str] = None
    locationId: UUID
    customerId: Optional[UUID] = None
    # B2B fields
    paymentTermType: Optional[PaymentTermType] = None
    paymentTermDays: Optional[int] = None
    poNumber: Optional[str] = None


class OrderUpdate(UpdateBase):
    """Schema for updating an order"""
    status: Optional[OrderStatus] = None
    customerName: Optional[str] = None
    customerPhone: Optional[str] = None
    customerEmail: Optional[str] = None
    shippingAddress: Optional[dict] = None
    billingAddress: Optional[dict] = None
    shipByDate: Optional[datetime] = None
    promisedDate: Optional[datetime] = None
    priority: Optional[int] = None
    tags: Optional[List[str]] = None
    remarks: Optional[str] = None
    # B2B fields
    creditDueDate: Optional[datetime] = None
    gstInvoiceNo: Optional[str] = None
    gstInvoiceDate: Optional[datetime] = None
    eWayBillNo: Optional[str] = None
    irnNo: Optional[str] = None


class OrderResponse(ResponseBase):
    """Schema for order API responses"""
    id: UUID
    orderNo: str
    externalOrderNo: Optional[str] = None
    channel: Channel
    orderType: OrderType
    paymentMode: PaymentMode
    status: OrderStatus
    customerName: str
    customerPhone: str
    customerEmail: Optional[str] = None
    shippingAddress: dict
    billingAddress: Optional[dict] = None
    subtotal: Decimal
    taxAmount: Decimal
    shippingCharges: Decimal
    discount: Decimal
    codCharges: Decimal
    totalAmount: Decimal
    orderDate: datetime
    shipByDate: Optional[datetime] = None
    promisedDate: Optional[datetime] = None
    priority: int = 0
    tags: List[str] = []
    remarks: Optional[str] = None
    locationId: UUID
    companyId: UUID
    customerId: Optional[UUID] = None
    paymentTermType: Optional[PaymentTermType] = None
    paymentTermDays: Optional[int] = None
    creditDueDate: Optional[datetime] = None
    poNumber: Optional[str] = None
    gstInvoiceNo: Optional[str] = None
    gstInvoiceDate: Optional[datetime] = None
    eWayBillNo: Optional[str] = None
    irnNo: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    @field_validator('tags', mode='before')
    @classmethod
    def tags_default(cls, v: Any) -> List[str]:
        """Convert None to empty list for tags"""
        if v is None:
            return []
        return v

    @field_validator('priority', mode='before')
    @classmethod
    def priority_default(cls, v: Any) -> int:
        """Convert None to 0 for priority"""
        if v is None:
            return 0
        return v

    @field_validator('shippingCharges', 'discount', 'codCharges', mode='before')
    @classmethod
    def decimal_defaults(cls, v: Any) -> Decimal:
        """Convert None to Decimal(0) for optional decimal fields"""
        if v is None:
            return Decimal("0")
        return v


class OrderBrief(ResponseBase):
    """Brief order info for lists"""
    id: UUID
    orderNo: str
    channel: Channel
    orderType: OrderType
    status: OrderStatus
    customerName: str
    totalAmount: Decimal
    orderDate: datetime


# --- OrderItem Schemas ---

class OrderItemCreate(CreateBase):
    """Schema for creating order item"""
    orderId: UUID
    skuId: UUID
    externalItemId: Optional[str] = None
    quantity: int
    unitPrice: Decimal
    taxAmount: Decimal
    discount: Decimal = Decimal("0")
    totalPrice: Decimal
    serialNumbers: List[str] = []
    batchNo: Optional[str] = None


class OrderItemUpdate(UpdateBase):
    """Schema for updating order item"""
    allocatedQty: Optional[int] = None
    pickedQty: Optional[int] = None
    packedQty: Optional[int] = None
    shippedQty: Optional[int] = None
    status: Optional[ItemStatus] = None
    serialNumbers: Optional[List[str]] = None


class OrderItemResponse(ResponseBase):
    """Schema for order item API responses"""
    id: UUID
    orderId: UUID
    skuId: UUID
    externalItemId: Optional[str] = None
    quantity: int
    allocatedQty: int
    pickedQty: int
    packedQty: int
    shippedQty: int
    unitPrice: Decimal
    taxAmount: Decimal
    discount: Decimal
    totalPrice: Decimal
    status: ItemStatus
    serialNumbers: List[str] = []
    batchNo: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


# --- Delivery Schemas ---

class DeliveryCreate(CreateBase):
    """Schema for creating delivery"""
    deliveryNo: str
    orderId: UUID
    transporterId: Optional[UUID] = None
    awbNo: Optional[str] = None
    weight: Optional[Decimal] = None
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    boxes: int = 1
    remarks: Optional[str] = None


class DeliveryUpdate(UpdateBase):
    """Schema for updating delivery"""
    status: Optional[DeliveryStatus] = None
    transporterId: Optional[UUID] = None
    awbNo: Optional[str] = None
    trackingUrl: Optional[str] = None
    weight: Optional[Decimal] = None
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    volumetricWeight: Optional[Decimal] = None
    boxes: Optional[int] = None
    invoiceNo: Optional[str] = None
    invoiceDate: Optional[datetime] = None
    invoiceUrl: Optional[str] = None
    labelUrl: Optional[str] = None
    packDate: Optional[datetime] = None
    shipDate: Optional[datetime] = None
    deliveryDate: Optional[datetime] = None
    podImage: Optional[str] = None
    podSignature: Optional[str] = None
    podRemarks: Optional[str] = None
    receivedBy: Optional[str] = None
    manifestId: Optional[UUID] = None
    remarks: Optional[str] = None


class DeliveryResponse(ResponseBase):
    """Schema for delivery API responses"""
    id: UUID
    deliveryNo: str
    orderId: UUID
    status: DeliveryStatus
    transporterId: Optional[UUID] = None
    awbNo: Optional[str] = None
    trackingUrl: Optional[str] = None
    weight: Optional[Decimal] = None
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    volumetricWeight: Optional[Decimal] = None
    boxes: int
    invoiceNo: Optional[str] = None
    invoiceDate: Optional[datetime] = None
    invoiceUrl: Optional[str] = None
    labelUrl: Optional[str] = None
    packDate: Optional[datetime] = None
    shipDate: Optional[datetime] = None
    deliveryDate: Optional[datetime] = None
    podImage: Optional[str] = None
    podSignature: Optional[str] = None
    podRemarks: Optional[str] = None
    receivedBy: Optional[str] = None
    manifestId: Optional[UUID] = None
    remarks: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
