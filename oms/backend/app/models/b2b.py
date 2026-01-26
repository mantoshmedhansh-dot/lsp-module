"""
B2B Models: Quotations, Price Lists, Credit Transactions
Updated to match existing database schema
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel
from .enums import CreditTransactionType, PaymentTermType


# ============================================================================
# Quotation Status Enum
# ============================================================================

class QuotationStatus:
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CONVERTED = "CONVERTED"
    CANCELLED = "CANCELLED"


# ============================================================================
# Price List (matches existing database schema)
# ============================================================================

class PriceListBase(SQLModel):
    """Price List base fields - matches database"""
    code: Optional[str] = Field(default=None, index=True)
    name: str
    description: Optional[str] = None
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None
    basedOnMRP: bool = Field(default=False)
    roundingMethod: Optional[str] = None
    companyId: Optional[UUID] = Field(default=None, foreign_key="Company.id", index=True)
    isActive: bool = Field(default=True)


class PriceList(PriceListBase, BaseModel, table=True):
    """Price List model"""
    __tablename__ = "PriceList"

    # Relationships
    items: List["PriceListItem"] = Relationship(back_populates="priceList")


class PriceListCreate(SQLModel):
    """Price List creation schema"""
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None
    basedOnMRP: bool = False
    roundingMethod: Optional[str] = None


class PriceListUpdate(SQLModel):
    """Price List update schema"""
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None
    basedOnMRP: Optional[bool] = None
    roundingMethod: Optional[str] = None
    isActive: Optional[bool] = None


class PriceListResponse(PriceListBase):
    """Price List response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class PriceListBrief(SQLModel):
    """Price List brief schema"""
    id: UUID
    code: Optional[str]
    name: str


# ============================================================================
# Price List Item
# ============================================================================

class PriceListItemBase(SQLModel):
    """Price List Item base fields"""
    priceListId: UUID = Field(foreign_key="PriceList.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    price: Decimal
    minQuantity: int = Field(default=1)
    maxQuantity: Optional[int] = None
    discountPercent: Optional[Decimal] = None


class PriceListItem(PriceListItemBase, BaseModel, table=True):
    """Price List Item model"""
    __tablename__ = "PriceListItem"

    # Relationships
    priceList: Optional["PriceList"] = Relationship(back_populates="items")


class PriceListItemCreate(SQLModel):
    """Price List Item creation schema"""
    skuId: UUID
    price: Decimal
    minQuantity: Optional[int] = 1
    maxQuantity: Optional[int] = None
    discountPercent: Optional[Decimal] = None


class PriceListItemUpdate(SQLModel):
    """Price List Item update schema"""
    price: Optional[Decimal] = None
    minQuantity: Optional[int] = None
    maxQuantity: Optional[int] = None
    discountPercent: Optional[Decimal] = None


class PriceListItemResponse(PriceListItemBase):
    """Price List Item response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Quotation (matches existing database schema)
# ============================================================================

class QuotationBase(SQLModel):
    """Quotation base fields - matches database"""
    quotationNo: Optional[str] = Field(default=None, unique=True)
    customerId: UUID = Field(foreign_key="Customer.id", index=True)
    companyId: Optional[UUID] = Field(default=None, foreign_key="Company.id", index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    status: str = Field(default="DRAFT", index=True)
    validFrom: Optional[datetime] = None
    validUntil: Optional[datetime] = None
    subtotal: Decimal = Field(default=Decimal("0"))
    discountAmount: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    shippingCharges: Decimal = Field(default=Decimal("0"))
    totalAmount: Decimal = Field(default=Decimal("0"))
    paymentTermType: Optional[str] = None
    paymentTermDays: Optional[int] = None
    specialTerms: Optional[str] = None
    remarks: Optional[str] = None
    shippingAddress: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    billingAddress: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    requiresApproval: bool = Field(default=False)
    approvalLevel: Optional[int] = None
    approvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    approvedAt: Optional[datetime] = None
    rejectedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    rejectedAt: Optional[datetime] = None
    rejectionReason: Optional[str] = None
    convertedOrderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    convertedAt: Optional[datetime] = None
    createdById: Optional[UUID] = Field(default=None, foreign_key="User.id")


class Quotation(QuotationBase, BaseModel, table=True):
    """Quotation model"""
    __tablename__ = "Quotation"

    # Relationships
    items: List["QuotationItem"] = Relationship(back_populates="quotation")


class QuotationCreate(SQLModel):
    """Quotation creation schema"""
    customerId: UUID
    locationId: Optional[UUID] = None
    validFrom: Optional[datetime] = None
    validUntil: Optional[datetime] = None
    paymentTermType: Optional[str] = None
    paymentTermDays: Optional[int] = None
    specialTerms: Optional[str] = None
    remarks: Optional[str] = None
    shippingAddress: Optional[dict] = None
    billingAddress: Optional[dict] = None
    items: Optional[List["QuotationItemCreate"]] = None


class QuotationUpdate(SQLModel):
    """Quotation update schema"""
    status: Optional[str] = None
    validFrom: Optional[datetime] = None
    validUntil: Optional[datetime] = None
    paymentTermType: Optional[str] = None
    paymentTermDays: Optional[int] = None
    specialTerms: Optional[str] = None
    remarks: Optional[str] = None
    shippingAddress: Optional[dict] = None
    billingAddress: Optional[dict] = None


class QuotationResponse(QuotationBase):
    """Quotation response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    items: Optional[List["QuotationItemResponse"]] = None


# ============================================================================
# Quotation Item
# ============================================================================

class QuotationItemBase(SQLModel):
    """Quotation Item base fields"""
    quotationId: UUID = Field(foreign_key="Quotation.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    quantity: int = Field(default=1)
    unitPrice: Decimal
    taxRate: Optional[Decimal] = None
    taxAmount: Decimal = Field(default=Decimal("0"))
    discount: Decimal = Field(default=Decimal("0"))
    totalPrice: Decimal = Field(default=Decimal("0"))


class QuotationItem(QuotationItemBase, BaseModel, table=True):
    """Quotation Item model"""
    __tablename__ = "QuotationItem"

    # Relationships
    quotation: Optional["Quotation"] = Relationship(back_populates="items")


class QuotationItemCreate(SQLModel):
    """Quotation Item creation schema"""
    skuId: UUID
    quantity: int
    unitPrice: Decimal
    taxRate: Optional[Decimal] = None
    discount: Optional[Decimal] = Decimal("0")


class QuotationItemUpdate(SQLModel):
    """Quotation Item update schema"""
    quantity: Optional[int] = None
    unitPrice: Optional[Decimal] = None
    taxRate: Optional[Decimal] = None
    discount: Optional[Decimal] = None


class QuotationItemResponse(QuotationItemBase):
    """Quotation Item response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# B2B Credit Transaction
# ============================================================================

class B2BCreditTransactionBase(SQLModel):
    """B2B Credit Transaction base fields"""
    transactionNo: Optional[str] = Field(default=None, unique=True)
    type: str = Field(index=True)  # String instead of enum for flexibility
    customerId: UUID = Field(foreign_key="Customer.id", index=True)
    amount: Decimal
    balanceBefore: Decimal
    balanceAfter: Decimal
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id")
    quotationId: Optional[UUID] = Field(default=None, foreign_key="Quotation.id")
    paymentRef: Optional[str] = None
    invoiceNo: Optional[str] = None
    dueDate: Optional[datetime] = None
    remarks: Optional[str] = None
    createdById: Optional[UUID] = Field(default=None, foreign_key="User.id")


class B2BCreditTransaction(B2BCreditTransactionBase, BaseModel, table=True):
    """B2B Credit Transaction model"""
    __tablename__ = "B2BCreditTransaction"


class B2BCreditTransactionCreate(SQLModel):
    """B2B Credit Transaction creation schema"""
    type: str
    customerId: UUID
    amount: Decimal
    orderId: Optional[UUID] = None
    quotationId: Optional[UUID] = None
    paymentRef: Optional[str] = None
    invoiceNo: Optional[str] = None
    dueDate: Optional[datetime] = None
    remarks: Optional[str] = None


class B2BCreditTransactionResponse(B2BCreditTransactionBase):
    """B2B Credit Transaction response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
