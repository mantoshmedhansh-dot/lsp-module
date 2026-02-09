"""
Shipment Models - SQLModel Implementation
Standalone B2C Courier Shipments (without OMS orders)
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import field_validator
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, JSON, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, NUMERIC

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import PaymentMode, DeliveryStatus


# ============================================================================
# Database Models
# ============================================================================

class Shipment(BaseModel, table=True):
    """
    Shipment model - Standalone B2C courier shipments.
    For clients who use only courier service (not OMS).
    Multi-tenant via companyId.
    """
    __tablename__ = "Shipment"

    # Shipment identity
    shipmentNo: str = Field(sa_column=Column(String, unique=True, nullable=False))
    awbNo: Optional[str] = Field(
        default=None,
        sa_column=Column(String, index=True)
    )
    orderReference: Optional[str] = Field(default=None)  # Client's order number

    # Status
    status: DeliveryStatus = Field(
        default=DeliveryStatus.PENDING,
        sa_column=Column(String, default="PENDING", index=True)
    )

    # Payment
    paymentMode: PaymentMode = Field(sa_column=Column(String, nullable=False))
    codAmount: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )
    declaredValue: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )
    shippingCharge: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(NUMERIC(12, 2), default=0)
    )

    # Consignee (delivery) details
    consigneeName: str = Field(sa_column=Column(String, nullable=False))
    consigneePhone: str = Field(sa_column=Column(String, nullable=False))
    consigneeEmail: Optional[str] = Field(default=None)
    deliveryAddress: dict = Field(sa_column=Column(JSON, nullable=False))
    # Expected format: {addressLine1, addressLine2, city, state, pincode, country}

    # Pickup details
    pickupAddressId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Location.id"), index=True)
    )
    pickupAddress: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Package details
    weight: Decimal = Field(sa_column=Column(NUMERIC(10, 3), nullable=False))
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
    productDescription: str = Field(sa_column=Column(String, nullable=False))
    productCategory: Optional[str] = Field(default=None)
    boxes: int = Field(default=1)

    # Courier/Transporter
    transporterId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Transporter.id"), index=True)
    )
    courierName: Optional[str] = Field(default=None)
    trackingUrl: Optional[str] = Field(default=None)

    # Dates
    pickupDate: Optional[datetime] = Field(default=None)
    shipDate: Optional[datetime] = Field(default=None)
    expectedDeliveryDate: Optional[datetime] = Field(default=None)
    deliveredDate: Optional[datetime] = Field(default=None)

    # POD (Proof of Delivery)
    podImage: Optional[str] = Field(default=None)
    podSignature: Optional[str] = Field(default=None)
    podRemarks: Optional[str] = Field(default=None)
    receivedBy: Optional[str] = Field(default=None)

    # Label
    labelUrl: Optional[str] = Field(default=None)

    # Remarks
    remarks: Optional[str] = Field(default=None)

    # Foreign Keys
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # Import tracking (for bulk uploads)
    importId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), index=True)
    )
    csvLineNumber: Optional[int] = Field(default=None)


# ============================================================================
# Request/Response Schemas
# ============================================================================

class ShipmentCreate(CreateBase):
    """Schema for creating a shipment"""
    orderReference: Optional[str] = None
    paymentMode: PaymentMode
    codAmount: Decimal = Decimal("0")
    declaredValue: Decimal = Decimal("0")
    consigneeName: str
    consigneePhone: str
    consigneeEmail: Optional[str] = None
    deliveryAddress: dict
    pickupAddressId: Optional[UUID] = None
    weight: Decimal
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    productDescription: str
    productCategory: Optional[str] = None
    boxes: int = 1
    transporterId: Optional[UUID] = None
    pickupDate: Optional[datetime] = None
    remarks: Optional[str] = None


class ShipmentUpdate(UpdateBase):
    """Schema for updating a shipment"""
    status: Optional[DeliveryStatus] = None
    awbNo: Optional[str] = None
    consigneeName: Optional[str] = None
    consigneePhone: Optional[str] = None
    consigneeEmail: Optional[str] = None
    deliveryAddress: Optional[dict] = None
    weight: Optional[Decimal] = None
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    volumetricWeight: Optional[Decimal] = None
    transporterId: Optional[UUID] = None
    courierName: Optional[str] = None
    trackingUrl: Optional[str] = None
    pickupDate: Optional[datetime] = None
    shipDate: Optional[datetime] = None
    expectedDeliveryDate: Optional[datetime] = None
    deliveredDate: Optional[datetime] = None
    podImage: Optional[str] = None
    podSignature: Optional[str] = None
    podRemarks: Optional[str] = None
    receivedBy: Optional[str] = None
    labelUrl: Optional[str] = None
    shippingCharge: Optional[Decimal] = None
    remarks: Optional[str] = None


class ShipmentResponse(ResponseBase):
    """Schema for shipment API responses"""
    id: UUID
    shipmentNo: str
    awbNo: Optional[str] = None
    orderReference: Optional[str] = None
    status: DeliveryStatus
    paymentMode: PaymentMode
    codAmount: Decimal
    declaredValue: Decimal
    shippingCharge: Decimal
    consigneeName: str
    consigneePhone: str
    consigneeEmail: Optional[str] = None
    deliveryAddress: dict
    pickupAddressId: Optional[UUID] = None
    pickupAddress: Optional[dict] = None
    weight: Decimal
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    volumetricWeight: Optional[Decimal] = None
    productDescription: str
    productCategory: Optional[str] = None
    boxes: int
    transporterId: Optional[UUID] = None
    courierName: Optional[str] = None
    trackingUrl: Optional[str] = None
    pickupDate: Optional[datetime] = None
    shipDate: Optional[datetime] = None
    expectedDeliveryDate: Optional[datetime] = None
    deliveredDate: Optional[datetime] = None
    podImage: Optional[str] = None
    podSignature: Optional[str] = None
    podRemarks: Optional[str] = None
    receivedBy: Optional[str] = None
    labelUrl: Optional[str] = None
    remarks: Optional[str] = None
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime

    @field_validator('codAmount', 'declaredValue', 'shippingCharge', mode='before')
    @classmethod
    def decimal_defaults(cls, v):
        if v is None:
            return Decimal("0")
        return v


class ShipmentBrief(ResponseBase):
    """Brief shipment info for lists"""
    id: UUID
    shipmentNo: str
    awbNo: Optional[str] = None
    status: DeliveryStatus
    consigneeName: str
    paymentMode: PaymentMode
    codAmount: Optional[Decimal] = Decimal("0")
    createdAt: datetime


class ShipmentStats(SQLModel):
    """Shipment statistics"""
    total: int = 0
    pending: int = 0
    pickedUp: int = 0
    inTransit: int = 0
    outForDelivery: int = 0
    delivered: int = 0
    ndr: int = 0
    rto: int = 0
    codPending: Decimal = Decimal("0")
    codCollected: Decimal = Decimal("0")
