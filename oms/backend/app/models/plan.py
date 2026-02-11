"""
Plan, PlanModule, PlanLimit Models - SaaS subscription plan catalog
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Text, Integer, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy import ForeignKey

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase


# ============================================================================
# Plan Model
# ============================================================================

class Plan(BaseModel, table=True):
    """Plan catalog - defines subscription tiers"""
    __tablename__ = "Plan"

    slug: str = Field(sa_column=Column(String(50), unique=True, nullable=False, index=True))
    name: str = Field(sa_column=Column(String(100), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    monthlyPrice: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False, default=0))
    annualPrice: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False, default=0))
    currency: str = Field(default="INR", sa_column=Column(String(3), nullable=False, default="INR"))
    stripePriceIdMonthly: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    stripePriceIdAnnual: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    isActive: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    sortOrder: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))

    # Relationships
    modules: List["PlanModule"] = Relationship(back_populates="plan")
    limits: List["PlanLimit"] = Relationship(back_populates="plan")


# ============================================================================
# PlanModule Model
# ============================================================================

class PlanModule(BaseModel, table=True):
    """Maps modules to plans"""
    __tablename__ = "PlanModule"

    planId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Plan.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    module: str = Field(sa_column=Column(String(50), nullable=False))

    # Relationships
    plan: Optional["Plan"] = Relationship(back_populates="modules")


# ============================================================================
# PlanLimit Model
# ============================================================================

class PlanLimit(BaseModel, table=True):
    """Usage limits per plan"""
    __tablename__ = "PlanLimit"

    planId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Plan.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    limitKey: str = Field(sa_column=Column(String(50), nullable=False))
    limitValue: int = Field(default=-1, sa_column=Column(Integer, nullable=False, default=-1))

    # Relationships
    plan: Optional["Plan"] = Relationship(back_populates="limits")


# ============================================================================
# Request/Response Schemas
# ============================================================================

class PlanModuleResponse(ResponseBase):
    id: UUID
    planId: UUID
    module: str


class PlanLimitResponse(ResponseBase):
    id: UUID
    planId: UUID
    limitKey: str
    limitValue: int


class PlanResponse(ResponseBase):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    monthlyPrice: Decimal
    annualPrice: Decimal
    currency: str = "INR"
    isActive: bool
    sortOrder: int
    modules: List[PlanModuleResponse] = []
    limits: List[PlanLimitResponse] = []
    createdAt: datetime
    updatedAt: datetime


class PlanBrief(ResponseBase):
    id: UUID
    slug: str
    name: str
    monthlyPrice: Decimal
    annualPrice: Decimal


class PlanCreate(CreateBase):
    slug: str
    name: str
    description: Optional[str] = None
    monthlyPrice: Decimal = Decimal("0")
    annualPrice: Decimal = Decimal("0")
    currency: str = "INR"
    stripePriceIdMonthly: Optional[str] = None
    stripePriceIdAnnual: Optional[str] = None
    sortOrder: int = 0


class PlanUpdate(UpdateBase):
    name: Optional[str] = None
    description: Optional[str] = None
    monthlyPrice: Optional[Decimal] = None
    annualPrice: Optional[Decimal] = None
    currency: Optional[str] = None
    stripePriceIdMonthly: Optional[str] = None
    stripePriceIdAnnual: Optional[str] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class PlanModuleCreate(CreateBase):
    planId: UUID
    module: str


class PlanLimitCreate(CreateBase):
    planId: UUID
    limitKey: str
    limitValue: int = -1


class PlanLimitUpdate(UpdateBase):
    limitValue: Optional[int] = None
