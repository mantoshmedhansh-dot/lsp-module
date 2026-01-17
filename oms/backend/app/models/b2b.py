"""
B2B Models: Quotations, Price Lists, Credit Transactions
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
# Quotation Status Enum (if not in enums.py)
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
# Price List
# ============================================================================

class PriceListBase(SQLModel):
    """Price List base fields"""
    code: str = Field(index=True)
    name: str
    description: Optional[str] = None
    currency: str = Field(default="INR")
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    isDefault: bool = Field(default=False)
    isActive: bool = Field(default=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)


class PriceList(PriceListBase, BaseModel, table=True):
    """Price List model"""
    __tablename__ = "PriceList"

    # Relationships
    items: List["PriceListItem"] = Relationship(back_populates="priceList")


class PriceListCreate(PriceListBase):
    """Price List creation schema"""
    pass


class PriceListUpdate(SQLModel):
    """Price List update schema"""
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    isDefault: Optional[bool] = None
    isActive: Optional[bool] = None


class PriceListResponse(PriceListBase):
    """Price List response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class PriceListBrief(SQLModel):
    """Price List brief schema"""
    id: UUID
    code: str
    name: str


# ============================================================================
# Price List Item
# ============================================================================

class PriceListItemBase(SQLModel):
    """Price List Item base fields"""
    priceListId: UUID = Field(foreign_key="PriceList.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    unitPrice: Decimal
    minQty: int = Field(default=1)
    maxQty: Optional[int] = None
    discountPercent: Optional[Decimal] = None
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None


class PriceListItem(PriceListItemBase, BaseModel, table=True):
    """Price List Item model"""
    __tablename__ = "PriceListItem"

    # Relationships
    priceList: Optional["PriceList"] = Relationship(back_populates="items")


class PriceListItemCreate(SQLModel):
    """Price List Item creation schema"""
    skuId: UUID
    unitPrice: Decimal
    minQty: Optional[int] = 1
    maxQty: Optional[int] = None
    discountPercent: Optional[Decimal] = None


class PriceListItemUpdate(SQLModel):
    """Price List Item update schema"""
    unitPrice: Optional[Decimal] = None
    minQty: Optional[int] = None
    maxQty: Optional[int] = None
    discountPercent: Optional[Decimal] = None


class PriceListItemResponse(PriceListItemBase):
    """Price List Item response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Pricing Tier
# ============================================================================

class PricingTierBase(SQLModel):
    """Pricing Tier base fields"""
    priceListItemId: UUID = Field(foreign_key="PriceListItem.id", index=True)
    minQty: int
    maxQty: Optional[int] = None
    unitPrice: Decimal


class PricingTier(PricingTierBase, BaseModel, table=True):
    """Pricing Tier model for quantity-based pricing"""
    __tablename__ = "PricingTier"


class PricingTierCreate(PricingTierBase):
    """Pricing Tier creation schema"""
    pass


class PricingTierResponse(PricingTierBase):
    """Pricing Tier response schema"""
    id: UUID


# ============================================================================
# Quotation
# ============================================================================

class QuotationBase(SQLModel):
    """Quotation base fields"""
    quotationNo: str = Field(unique=True)
    customerId: UUID = Field(foreign_key="Customer.id", index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    status: str = Field(default="DRAFT", index=True)
    validUntil: Optional[datetime] = None
    subtotal: Decimal = Field(default=Decimal("0"))
    taxAmount: Decimal = Field(default=Decimal("0"))
    discount: Decimal = Field(default=Decimal("0"))
    totalAmount: Decimal = Field(default=Decimal("0"))
    paymentTermType: Optional[str] = None
    paymentTermDays: Optional[int] = None
    shippingAddress: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    billingAddress: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    remarks: Optional[str] = None
    internalNotes: Optional[str] = None
    approvedById: Optional[UUID] = None
    approvedAt: Optional[datetime] = None
    rejectionReason: Optional[str] = None
    convertedToOrderId: Optional[UUID] = None
    convertedAt: Optional[datetime] = None


class Quotation(QuotationBase, BaseModel, table=True):
    """Quotation model"""
    __tablename__ = "Quotation"

    # Relationships
    items: List["QuotationItem"] = Relationship(back_populates="quotation")


class QuotationCreate(SQLModel):
    """Quotation creation schema"""
    customerId: UUID
    validUntil: Optional[datetime] = None
    paymentTermType: Optional[str] = None
    paymentTermDays: Optional[int] = None
    shippingAddress: Optional[dict] = None
    billingAddress: Optional[dict] = None
    remarks: Optional[str] = None
    items: Optional[List["QuotationItemCreate"]] = None


class QuotationUpdate(SQLModel):
    """Quotation update schema"""
    status: Optional[str] = None
    validUntil: Optional[datetime] = None
    paymentTermType: Optional[str] = None
    paymentTermDays: Optional[int] = None
    shippingAddress: Optional[dict] = None
    billingAddress: Optional[dict] = None
    remarks: Optional[str] = None
    internalNotes: Optional[str] = None


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
    discountPercent: Optional[Decimal] = None
    totalPrice: Decimal = Field(default=Decimal("0"))
    remarks: Optional[str] = None


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
    discount: Optional[Decimal] = None
    discountPercent: Optional[Decimal] = None
    remarks: Optional[str] = None


class QuotationItemUpdate(SQLModel):
    """Quotation Item update schema"""
    quantity: Optional[int] = None
    unitPrice: Optional[Decimal] = None
    taxRate: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    discountPercent: Optional[Decimal] = None
    remarks: Optional[str] = None


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
    transactionNo: str = Field(unique=True)
    type: CreditTransactionType = Field(index=True)
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
    type: CreditTransactionType
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
