from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, ARRAY, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class Channel(str, enum.Enum):
    AMAZON = "AMAZON"
    FLIPKART = "FLIPKART"
    MYNTRA = "MYNTRA"
    AJIO = "AJIO"
    MEESHO = "MEESHO"
    NYKAA = "NYKAA"
    TATA_CLIQ = "TATA_CLIQ"
    JIOMART = "JIOMART"
    SHOPIFY = "SHOPIFY"
    WOOCOMMERCE = "WOOCOMMERCE"
    WEBSITE = "WEBSITE"
    MANUAL = "MANUAL"


class OrderType(str, enum.Enum):
    B2C = "B2C"
    B2B = "B2B"


class PaymentMode(str, enum.Enum):
    PREPAID = "PREPAID"
    COD = "COD"


class OrderStatus(str, enum.Enum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    ALLOCATED = "ALLOCATED"
    PARTIALLY_ALLOCATED = "PARTIALLY_ALLOCATED"
    PICKLIST_GENERATED = "PICKLIST_GENERATED"
    PICKING = "PICKING"
    PICKED = "PICKED"
    PACKING = "PACKING"
    PACKED = "PACKED"
    MANIFESTED = "MANIFESTED"
    SHIPPED = "SHIPPED"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RTO_INITIATED = "RTO_INITIATED"
    RTO_IN_TRANSIT = "RTO_IN_TRANSIT"
    RTO_DELIVERED = "RTO_DELIVERED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"


class ItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    ALLOCATED = "ALLOCATED"
    PICKED = "PICKED"
    PACKED = "PACKED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    RETURNED = "RETURNED"


class DeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    PACKED = "PACKED"
    MANIFESTED = "MANIFESTED"
    SHIPPED = "SHIPPED"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RTO_INITIATED = "RTO_INITIATED"
    RTO_IN_TRANSIT = "RTO_IN_TRANSIT"
    RTO_DELIVERED = "RTO_DELIVERED"
    CANCELLED = "CANCELLED"


class Order(Base):
    __tablename__ = "Order"

    id = Column(String, primary_key=True)
    orderNo = Column(String, unique=True, nullable=False)
    externalOrderNo = Column(String, index=True)
    channel = Column(Enum(Channel), index=True)
    orderType = Column(Enum(OrderType), default=OrderType.B2C)
    paymentMode = Column(Enum(PaymentMode))
    status = Column(Enum(OrderStatus), default=OrderStatus.CREATED, index=True)

    # Customer Info
    customerName = Column(String, nullable=False)
    customerPhone = Column(String, nullable=False)
    customerEmail = Column(String)
    shippingAddress = Column(JSON)
    billingAddress = Column(JSON)

    # Amounts
    subtotal = Column(Numeric(12, 2))
    taxAmount = Column(Numeric(12, 2))
    shippingCharges = Column(Numeric(12, 2), default=0)
    discount = Column(Numeric(12, 2), default=0)
    codCharges = Column(Numeric(12, 2), default=0)
    totalAmount = Column(Numeric(12, 2))

    # Dates
    orderDate = Column(DateTime, index=True)
    shipByDate = Column(DateTime)
    promisedDate = Column(DateTime)

    # Priority
    priority = Column(Integer, default=0)
    tags = Column(ARRAY(String), default=[])
    remarks = Column(String)

    locationId = Column(String, ForeignKey("Location.id"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    location = relationship("Location", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    deliveries = relationship("Delivery", back_populates="order")


class OrderItem(Base):
    __tablename__ = "OrderItem"

    id = Column(String, primary_key=True)
    orderId = Column(String, ForeignKey("Order.id", ondelete="CASCADE"), index=True)
    skuId = Column(String, ForeignKey("SKU.id"), index=True)

    externalItemId = Column(String)
    quantity = Column(Integer, nullable=False)
    allocatedQty = Column(Integer, default=0)
    pickedQty = Column(Integer, default=0)
    packedQty = Column(Integer, default=0)
    shippedQty = Column(Integer, default=0)

    unitPrice = Column(Numeric(12, 2))
    taxAmount = Column(Numeric(12, 2))
    discount = Column(Numeric(12, 2), default=0)
    totalPrice = Column(Numeric(12, 2))

    status = Column(Enum(ItemStatus), default=ItemStatus.PENDING)
    serialNumbers = Column(ARRAY(String), default=[])
    batchNo = Column(String)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    order = relationship("Order", back_populates="items")
    sku = relationship("SKU", back_populates="orderItems")


class Delivery(Base):
    __tablename__ = "Delivery"

    id = Column(String, primary_key=True)
    deliveryNo = Column(String, unique=True, nullable=False)
    orderId = Column(String, ForeignKey("Order.id", ondelete="CASCADE"), index=True)

    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING, index=True)

    transporterId = Column(String)
    awbNo = Column(String, index=True)
    trackingUrl = Column(String)

    weight = Column(Numeric(10, 3))
    length = Column(Numeric(10, 2))
    width = Column(Numeric(10, 2))
    height = Column(Numeric(10, 2))
    volumetricWeight = Column(Numeric(10, 3))
    boxes = Column(Integer, default=1)

    # Invoice
    invoiceNo = Column(String)
    invoiceDate = Column(DateTime)
    invoiceUrl = Column(String)

    # Label
    labelUrl = Column(String)

    # Dates
    packDate = Column(DateTime)
    shipDate = Column(DateTime)
    deliveryDate = Column(DateTime)

    remarks = Column(String)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    order = relationship("Order", back_populates="deliveries")
