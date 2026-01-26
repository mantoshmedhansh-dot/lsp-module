"""
Logistics Extended Models: Rate Cards, Shipping Rules, Service Pincodes, AWB
Updated to match existing database schema
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship

from .base import BaseModel


# ============================================================================
# Rate Card (matches existing database schema)
# ============================================================================

class RateCardBase(SQLModel):
    """Rate Card base fields - matches database"""
    rateCardNo: Optional[str] = Field(default=None, index=True)
    name: str
    type: str = Field(default="BOTH", index=True)  # PREPAID, COD, BOTH
    status: str = Field(default="DRAFT", index=True)
    transporterId: UUID = Field(foreign_key="Transporter.id", index=True)
    companyId: Optional[UUID] = Field(default=None, foreign_key="Company.id", index=True)
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None
    baseCost: Optional[Decimal] = Field(default=Decimal("0"))
    fuelSurcharge: Optional[Decimal] = Field(default=Decimal("0"))
    codChargesPercent: Optional[Decimal] = None
    codChargesMin: Optional[Decimal] = None
    codChargesCap: Optional[Decimal] = None
    awbCharges: Optional[Decimal] = None
    rtoChargesPercent: Optional[Decimal] = None
    remarks: Optional[str] = None
    approvedAt: Optional[datetime] = None
    approvedBy: Optional[UUID] = None


class RateCard(RateCardBase, BaseModel, table=True):
    """Rate Card model"""
    __tablename__ = "RateCard"

    # Relationships
    slabs: List["RateCardSlab"] = Relationship(back_populates="rateCard")


class RateCardCreate(SQLModel):
    """Rate Card creation schema"""
    rateCardNo: Optional[str] = None
    name: str
    type: str = "BOTH"
    transporterId: UUID
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None
    baseCost: Optional[Decimal] = Decimal("0")
    fuelSurcharge: Optional[Decimal] = Decimal("0")
    codChargesPercent: Optional[Decimal] = None
    codChargesMin: Optional[Decimal] = None
    awbCharges: Optional[Decimal] = None
    remarks: Optional[str] = None
    slabs: Optional[List["RateCardSlabCreate"]] = None


class RateCardUpdate(SQLModel):
    """Rate Card update schema"""
    name: Optional[str] = None
    status: Optional[str] = None
    effectiveTo: Optional[datetime] = None
    baseCost: Optional[Decimal] = None
    fuelSurcharge: Optional[Decimal] = None
    codChargesPercent: Optional[Decimal] = None
    codChargesMin: Optional[Decimal] = None
    awbCharges: Optional[Decimal] = None
    remarks: Optional[str] = None


class RateCardResponse(RateCardBase):
    """Rate Card response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    slabs: Optional[List["RateCardSlabResponse"]] = None


# ============================================================================
# Rate Card Slab
# ============================================================================

class RateCardSlabBase(SQLModel):
    """Rate Card Slab base fields - matches database"""
    rateCardId: UUID = Field(foreign_key="RateCard.id", index=True)
    fromWeight: Decimal
    toWeight: Decimal
    zone: Optional[str] = None
    fromPincode: Optional[str] = None
    toPincode: Optional[str] = None
    rate: Decimal
    additionalWeightRate: Optional[Decimal] = None
    minCharge: Optional[Decimal] = None


class RateCardSlab(RateCardSlabBase, BaseModel, table=True):
    """Rate Card Slab model"""
    __tablename__ = "RateCardSlab"

    # Relationships
    rateCard: Optional["RateCard"] = Relationship(back_populates="slabs")


class RateCardSlabCreate(SQLModel):
    """Rate Card Slab creation schema"""
    fromWeight: Decimal
    toWeight: Decimal
    zone: Optional[str] = None
    fromPincode: Optional[str] = None
    toPincode: Optional[str] = None
    rate: Decimal
    additionalWeightRate: Optional[Decimal] = None
    minCharge: Optional[Decimal] = None


class RateCardSlabResponse(RateCardSlabBase):
    """Rate Card Slab response schema"""
    id: UUID


# ============================================================================
# Shipping Rule (matches existing database schema)
# ============================================================================

class ShippingRuleBase(SQLModel):
    """Shipping Rule base fields - matches database"""
    ruleNo: Optional[str] = Field(default=None, index=True)
    name: str
    type: str = Field(index=True)  # Enum in DB
    status: str = Field(default="DRAFT", index=True)  # Enum in DB
    priority: int = Field(default=0)
    description: Optional[str] = None
    transporterId: Optional[UUID] = Field(default=None, foreign_key="Transporter.id")
    companyId: Optional[UUID] = Field(default=None, foreign_key="Company.id", index=True)
    minWeight: Optional[Decimal] = None
    maxWeight: Optional[Decimal] = None
    fromPincodes: Optional[List[str]] = None
    toPincodes: Optional[List[str]] = None
    channels: Optional[List[str]] = None
    orderTypes: Optional[List[str]] = None
    paymentModes: Optional[List[str]] = None
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None
    isActive: bool = Field(default=True)


class ShippingRule(ShippingRuleBase, BaseModel, table=True):
    """Shipping Rule model"""
    __tablename__ = "ShippingRule"

    # Relationships - removed as conditions table has different schema
    # conditions: List["ShippingRuleCondition"] = Relationship(back_populates="rule")


class ShippingRuleCreate(SQLModel):
    """Shipping Rule creation schema"""
    ruleNo: Optional[str] = None
    name: str
    type: str
    priority: int = 0
    description: Optional[str] = None
    transporterId: Optional[UUID] = None
    minWeight: Optional[Decimal] = None
    maxWeight: Optional[Decimal] = None
    fromPincodes: Optional[List[str]] = None
    toPincodes: Optional[List[str]] = None
    channels: Optional[List[str]] = None
    orderTypes: Optional[List[str]] = None
    paymentModes: Optional[List[str]] = None
    effectiveFrom: Optional[datetime] = None
    effectiveTo: Optional[datetime] = None


class ShippingRuleUpdate(SQLModel):
    """Shipping Rule update schema"""
    name: Optional[str] = None
    priority: Optional[int] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None
    transporterId: Optional[UUID] = None
    minWeight: Optional[Decimal] = None
    maxWeight: Optional[Decimal] = None
    effectiveTo: Optional[datetime] = None


class ShippingRuleResponse(ShippingRuleBase):
    """Shipping Rule response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Shipping Rule Condition (simplified)
# ============================================================================

class ShippingRuleConditionBase(SQLModel):
    """Shipping Rule Condition base fields"""
    shippingRuleId: Optional[UUID] = Field(default=None, foreign_key="ShippingRule.id", index=True)
    field: str
    operator: str
    value: Optional[str] = None


class ShippingRuleCondition(ShippingRuleConditionBase, BaseModel, table=True):
    """Shipping Rule Condition model"""
    __tablename__ = "ShippingRuleCondition"


class ShippingRuleConditionCreate(SQLModel):
    """Shipping Rule Condition creation schema"""
    field: str
    operator: str
    value: str


class ShippingRuleConditionResponse(ShippingRuleConditionBase):
    """Shipping Rule Condition response schema"""
    id: UUID


# ============================================================================
# Service Pincode
# ============================================================================

class ServicePincodeBase(SQLModel):
    """Service Pincode base fields"""
    pincode: str = Field(index=True)
    transporterId: UUID = Field(foreign_key="Transporter.id", index=True)
    city: Optional[str] = None
    state: Optional[str] = None
    zoneCode: Optional[str] = None
    isServiceable: bool = Field(default=True)
    codAvailable: bool = Field(default=True)
    prepaidAvailable: bool = Field(default=True)
    reverseAvailable: bool = Field(default=False)
    estimatedDays: Optional[int] = None


class ServicePincode(ServicePincodeBase, BaseModel, table=True):
    """Service Pincode model"""
    __tablename__ = "ServicePincode"


class ServicePincodeCreate(SQLModel):
    """Service Pincode creation schema"""
    pincode: str
    transporterId: UUID
    city: Optional[str] = None
    state: Optional[str] = None
    zoneCode: Optional[str] = None
    isServiceable: bool = True
    codAvailable: bool = True
    prepaidAvailable: bool = True
    reverseAvailable: bool = False
    estimatedDays: Optional[int] = None


class ServicePincodeUpdate(SQLModel):
    """Service Pincode update schema"""
    city: Optional[str] = None
    state: Optional[str] = None
    zoneCode: Optional[str] = None
    isServiceable: Optional[bool] = None
    codAvailable: Optional[bool] = None
    prepaidAvailable: Optional[bool] = None
    reverseAvailable: Optional[bool] = None
    estimatedDays: Optional[int] = None


class ServicePincodeResponse(ServicePincodeBase):
    """Service Pincode response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# AWB (Air Waybill Number Pool)
# ============================================================================

class AWBBase(SQLModel):
    """AWB base fields"""
    awbNo: str = Field(unique=True, index=True)
    transporterId: UUID = Field(foreign_key="Transporter.id", index=True)
    isUsed: bool = Field(default=False)
    usedAt: Optional[datetime] = None
    usedFor: Optional[str] = None


class AWB(AWBBase, BaseModel, table=True):
    """AWB model for managing AWB number pools"""
    __tablename__ = "AWB"


class AWBCreate(SQLModel):
    """AWB creation schema"""
    awbNo: str
    transporterId: UUID


class AWBBulkCreate(SQLModel):
    """AWB bulk creation schema"""
    transporterId: UUID
    awbNumbers: List[str]


class AWBResponse(AWBBase):
    """AWB response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
