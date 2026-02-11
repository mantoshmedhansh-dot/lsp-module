"""
BillingInvoice Model - Invoice tracking for subscriptions
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlmodel import Field
from sqlalchemy import Column, String, Text, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase


# ============================================================================
# BillingInvoice Model
# ============================================================================

class BillingInvoice(BaseModel, table=True):
    """Billing invoice for a subscription"""
    __tablename__ = "BillingInvoice"

    companyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    subscriptionId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("TenantSubscription.id"))
    )
    invoiceNumber: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    amount: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False, default=0))
    currency: str = Field(default="INR", sa_column=Column(String(3), nullable=False, default="INR"))
    status: str = Field(
        default="draft",
        sa_column=Column(String(20), nullable=False, default="draft")
    )  # draft, pending, paid, failed, void
    stripeInvoiceId: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    paidAt: Optional[datetime] = Field(default=None)
    dueDate: Optional[datetime] = Field(default=None)
    invoiceUrl: Optional[str] = Field(default=None, sa_column=Column(Text))


# ============================================================================
# Request/Response Schemas
# ============================================================================

class BillingInvoiceResponse(ResponseBase):
    id: UUID
    companyId: UUID
    subscriptionId: Optional[UUID] = None
    invoiceNumber: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    paidAt: Optional[datetime] = None
    dueDate: Optional[datetime] = None
    invoiceUrl: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class BillingInvoiceCreate(CreateBase):
    companyId: UUID
    subscriptionId: Optional[UUID] = None
    invoiceNumber: Optional[str] = None
    amount: Decimal = Decimal("0")
    currency: str = "INR"
    status: str = "draft"
    dueDate: Optional[datetime] = None
