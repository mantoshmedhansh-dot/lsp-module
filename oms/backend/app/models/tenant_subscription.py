"""
TenantSubscription and SubscriptionUsage Models - SaaS subscription management
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase

if TYPE_CHECKING:
    from .company import Company


# ============================================================================
# TenantSubscription Model
# ============================================================================

class TenantSubscription(BaseModel, table=True):
    """SaaS tenant subscription to a plan"""
    __tablename__ = "TenantSubscription"

    companyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    planId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Plan.id"), nullable=False)
    )
    status: str = Field(
        default="trialing",
        sa_column=Column(String(20), nullable=False, default="trialing")
    )  # trialing, active, past_due, cancelled, expired
    billingCycle: str = Field(
        default="monthly",
        sa_column=Column(String(10), nullable=False, default="monthly")
    )  # monthly, annual
    currentPeriodStart: Optional[datetime] = Field(default=None)
    currentPeriodEnd: Optional[datetime] = Field(default=None)
    trialEndsAt: Optional[datetime] = Field(default=None)
    cancelledAt: Optional[datetime] = Field(default=None)
    stripeSubscriptionId: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    stripeCustomerId: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    extra: Optional[dict] = Field(default=None, sa_column=Column("extra", JSONB, default={}))

    # Relationships
    company: Optional["Company"] = Relationship(back_populates="tenantSubscriptions")


# ============================================================================
# SubscriptionUsage Model
# ============================================================================

class SubscriptionUsage(BaseModel, table=True):
    """Monthly usage tracking per tenant"""
    __tablename__ = "SubscriptionUsage"

    companyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    period: str = Field(sa_column=Column(String(7), nullable=False))  # YYYY-MM
    ordersCount: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    skusCount: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    usersCount: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    locationsCount: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    apiCallsCount: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))


# ============================================================================
# Request/Response Schemas
# ============================================================================

class TenantSubscriptionResponse(ResponseBase):
    id: UUID
    companyId: UUID
    planId: UUID
    status: str
    billingCycle: str
    currentPeriodStart: Optional[datetime] = None
    currentPeriodEnd: Optional[datetime] = None
    trialEndsAt: Optional[datetime] = None
    cancelledAt: Optional[datetime] = None
    extra: Optional[dict] = None
    createdAt: datetime
    updatedAt: datetime


class TenantSubscriptionCreate(CreateBase):
    companyId: UUID
    planId: UUID
    status: str = "trialing"
    billingCycle: str = "monthly"
    trialEndsAt: Optional[datetime] = None


class TenantSubscriptionUpdate(UpdateBase):
    planId: Optional[UUID] = None
    status: Optional[str] = None
    billingCycle: Optional[str] = None
    currentPeriodStart: Optional[datetime] = None
    currentPeriodEnd: Optional[datetime] = None
    trialEndsAt: Optional[datetime] = None
    cancelledAt: Optional[datetime] = None
    stripeSubscriptionId: Optional[str] = None
    stripeCustomerId: Optional[str] = None


class SubscriptionUsageResponse(ResponseBase):
    id: UUID
    companyId: UUID
    period: str
    ordersCount: int
    skusCount: int
    usersCount: int
    locationsCount: int
    apiCallsCount: int
    createdAt: datetime
    updatedAt: datetime


class SubscriptionUsageUpdate(UpdateBase):
    ordersCount: Optional[int] = None
    skusCount: Optional[int] = None
    usersCount: Optional[int] = None
    locationsCount: Optional[int] = None
    apiCallsCount: Optional[int] = None


class ChangePlanRequest(CreateBase):
    """Request to change subscription plan"""
    planSlug: str
    billingCycle: str = "monthly"
