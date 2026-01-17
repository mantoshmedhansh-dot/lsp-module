"""
Logistics Extended Models: Rate Cards, Shipping Rules, Service Pincodes, AWB
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship

from .base import BaseModel
from .enums import TransporterType


# ============================================================================
# Rate Card Status Enum
# ============================================================================

class RateCardStatus:
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"
    SUPERSEDED = "SUPERSEDED"


class RateCardType:
    PREPAID = "PREPAID"
    COD = "COD"
    BOTH = "BOTH"


class ShippingRuleType:
    WEIGHT_BASED = "WEIGHT_BASED"
    PINCODE_BASED = "PINCODE_BASED"
    PRIORITY_BASED = "PRIORITY_BASED"
    COST_OPTIMIZED = "COST_OPTIMIZED"
    DELIVERY_TIME_BASED = "DELIVERY_TIME_BASED"


# ============================================================================
# Rate Card
# ============================================================================

class RateCardBase(SQLModel):
    """Rate Card base fields"""
    code: str = Field(index=True)
    name: str
    description: Optional[str] = None
    transporterId: UUID = Field(foreign_key="Transporter.id", index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    type: str = Field(default="BOTH", index=True)  # PREPAID, COD, BOTH
    status: str = Field(default="DRAFT", index=True)
    validFrom: datetime
    validTo: Optional[datetime] = None
    baseWeight: Decimal = Field(default=Decimal("0.5"))
    baseRate: Decimal = Field(default=Decimal("0"))
    additionalWeightRate: Decimal = Field(default=Decimal("0"))
    codPercent: Optional[Decimal] = None
    codMinCharge: Optional[Decimal] = None
    fuelSurchargePercent: Optional[Decimal] = None
    minCharge: Optional[Decimal] = None
    maxWeight: Optional[Decimal] = None
    volumetricFactor: int = Field(default=5000)
    isDefault: bool = Field(default=False)


class RateCard(RateCardBase, BaseModel, table=True):
    """Rate Card model"""
    __tablename__ = "RateCard"

    # Relationships
    slabs: List["RateCardSlab"] = Relationship(back_populates="rateCard")


class RateCardCreate(SQLModel):
    """Rate Card creation schema"""
    code: str
    name: str
    description: Optional[str] = None
    transporterId: UUID
    type: str = "BOTH"
    validFrom: datetime
    validTo: Optional[datetime] = None
    baseWeight: Decimal = Decimal("0.5")
    baseRate: Decimal
    additionalWeightRate: Decimal
    codPercent: Optional[Decimal] = None
    codMinCharge: Optional[Decimal] = None
    fuelSurchargePercent: Optional[Decimal] = None
    slabs: Optional[List["RateCardSlabCreate"]] = None


class RateCardUpdate(SQLModel):
    """Rate Card update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    validTo: Optional[datetime] = None
    baseWeight: Optional[Decimal] = None
    baseRate: Optional[Decimal] = None
    additionalWeightRate: Optional[Decimal] = None
    codPercent: Optional[Decimal] = None
    codMinCharge: Optional[Decimal] = None
    fuelSurchargePercent: Optional[Decimal] = None
    isDefault: Optional[bool] = None


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
    """Rate Card Slab base fields"""
    rateCardId: UUID = Field(foreign_key="RateCard.id", index=True)
    fromWeight: Decimal
    toWeight: Decimal
    zoneCode: Optional[str] = None
    rate: Decimal
    additionalRate: Optional[Decimal] = None
    minCharge: Optional[Decimal] = None
    maxCharge: Optional[Decimal] = None


class RateCardSlab(RateCardSlabBase, BaseModel, table=True):
    """Rate Card Slab model"""
    __tablename__ = "RateCardSlab"

    # Relationships
    rateCard: Optional["RateCard"] = Relationship(back_populates="slabs")


class RateCardSlabCreate(SQLModel):
    """Rate Card Slab creation schema"""
    fromWeight: Decimal
    toWeight: Decimal
    zoneCode: Optional[str] = None
    rate: Decimal
    additionalRate: Optional[Decimal] = None


class RateCardSlabResponse(RateCardSlabBase):
    """Rate Card Slab response schema"""
    id: UUID


# ============================================================================
# Shipping Rule
# ============================================================================

class ShippingRuleBase(SQLModel):
    """Shipping Rule base fields"""
    code: str = Field(index=True)
    name: str
    description: Optional[str] = None
    type: str = Field(index=True)  # WEIGHT_BASED, PINCODE_BASED, etc.
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    priority: int = Field(default=0)
    isActive: bool = Field(default=True)
    transporterId: Optional[UUID] = Field(default=None, foreign_key="Transporter.id")
    rateCardId: Optional[UUID] = Field(default=None, foreign_key="RateCard.id")
    channel: Optional[str] = None
    paymentMode: Optional[str] = None
    minWeight: Optional[Decimal] = None
    maxWeight: Optional[Decimal] = None
    minValue: Optional[Decimal] = None
    maxValue: Optional[Decimal] = None
    deliveryType: Optional[str] = None
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None


class ShippingRule(ShippingRuleBase, BaseModel, table=True):
    """Shipping Rule model"""
    __tablename__ = "ShippingRule"

    # Relationships
    conditions: List["ShippingRuleCondition"] = Relationship(back_populates="rule")


class ShippingRuleCreate(SQLModel):
    """Shipping Rule creation schema"""
    code: str
    name: str
    description: Optional[str] = None
    type: str
    locationId: Optional[UUID] = None
    priority: int = 0
    transporterId: Optional[UUID] = None
    rateCardId: Optional[UUID] = None
    channel: Optional[str] = None
    paymentMode: Optional[str] = None
    minWeight: Optional[Decimal] = None
    maxWeight: Optional[Decimal] = None
    minValue: Optional[Decimal] = None
    maxValue: Optional[Decimal] = None


class ShippingRuleUpdate(SQLModel):
    """Shipping Rule update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    isActive: Optional[bool] = None
    transporterId: Optional[UUID] = None
    rateCardId: Optional[UUID] = None


class ShippingRuleResponse(ShippingRuleBase):
    """Shipping Rule response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Shipping Rule Condition
# ============================================================================

class ShippingRuleConditionBase(SQLModel):
    """Shipping Rule Condition base fields"""
    ruleId: UUID = Field(foreign_key="ShippingRule.id", index=True)
    field: str  # e.g., "pincode", "weight", "orderValue"
    operator: str  # e.g., "eq", "in", "between", "gt", "lt"
    value: str  # JSON string for complex values


class ShippingRuleCondition(ShippingRuleConditionBase, BaseModel, table=True):
    """Shipping Rule Condition model"""
    __tablename__ = "ShippingRuleCondition"

    # Relationships
    rule: Optional["ShippingRule"] = Relationship(back_populates="conditions")


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
    zoneCode: Optional[str] = None
    isServiceable: bool = Field(default=True)
    codAvailable: bool = Field(default=True)
    prepaidAvailable: bool = Field(default=True)


class ServicePincode(ServicePincodeBase, BaseModel, table=True):
    """Service Pincode model"""
    __tablename__ = "ServicePincode"


class ServicePincodeCreate(SQLModel):
    """Service Pincode creation schema"""
    pincode: str
    transporterId: UUID
    zoneCode: Optional[str] = None
    isServiceable: bool = True
    codAvailable: bool = True
    prepaidAvailable: bool = True


class ServicePincodeUpdate(SQLModel):
    """Service Pincode update schema"""
    zoneCode: Optional[str] = None
    isServiceable: Optional[bool] = None
    codAvailable: Optional[bool] = None
    prepaidAvailable: Optional[bool] = None


class ServicePincodeResponse(ServicePincodeBase):
    """Service Pincode response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# AWB (Air Waybill Number Pool)
# ============================================================================

class AWBBase(SQLModel):
    """AWB base fields"""
    awbNo: str = Field(unique=True, index=True)
    transporterId: UUID = Field(foreign_key="Transporter.id", index=True)
    isUsed: bool = Field(default=False)
    usedAt: Optional[datetime] = None
    usedFor: Optional[str] = None  # orderId or deliveryId


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
