"""
Slotting Optimization Models: Velocity analysis, Bin characteristics, Rules, Recommendations
For warehouse slotting optimization
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class VelocityClass(str, Enum):
    """SKU velocity classification"""
    A = "A"  # Fast moving
    B = "B"  # Medium moving
    C = "C"  # Slow moving
    X = "X"  # High value/demand
    Y = "Y"  # Medium value/demand
    Z = "Z"  # Low value/demand


class RecommendationType(str, Enum):
    """Slotting recommendation types"""
    RELOCATE = "RELOCATE"
    CONSOLIDATE = "CONSOLIDATE"
    SPLIT = "SPLIT"
    UPGRADE_BIN = "UPGRADE_BIN"
    DOWNGRADE_BIN = "DOWNGRADE_BIN"


class RecommendationStatus(str, Enum):
    """Recommendation status"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"


# ============================================================================
# SkuVelocity
# ============================================================================

class SkuVelocityBase(SQLModel):
    """SKU velocity analysis base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    analysisDate: date = Field(index=True)
    periodDays: int = Field(default=30)
    totalPicks: int = Field(default=0)
    totalUnits: int = Field(default=0)
    avgDailyPicks: Decimal = Field(default=Decimal("0"))
    avgDailyUnits: Decimal = Field(default=Decimal("0"))
    pickFrequency: Decimal = Field(default=Decimal("0"))
    velocityClass: VelocityClass = Field(default=VelocityClass.C, index=True)
    demandVariability: Decimal = Field(default=Decimal("0"))
    avgOrderQuantity: Decimal = Field(default=Decimal("0"))
    peakDayPicks: int = Field(default=0)
    lastPickDate: Optional[date] = None
    daysSinceLastPick: Optional[int] = None


class SkuVelocity(SkuVelocityBase, BaseModel, table=True):
    """SKU velocity model"""
    __tablename__ = "SkuVelocity"


class SkuVelocityResponse(SkuVelocityBase):
    """Response schema for velocity"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# BinCharacteristics
# ============================================================================

class BinCharacteristicsBase(SQLModel):
    """Bin characteristics base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    binId: UUID = Field(foreign_key="Bin.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    zoneId: UUID = Field(foreign_key="Zone.id", index=True)
    pickZone: str = Field(max_length=50, index=True)
    aisle: str = Field(max_length=20, index=True)
    level: int = Field(default=1)
    position: int = Field(default=1)
    heightCm: Optional[Decimal] = None
    widthCm: Optional[Decimal] = None
    depthCm: Optional[Decimal] = None
    volumeCubicCm: Optional[Decimal] = None
    maxWeightKg: Optional[Decimal] = None
    currentWeightKg: Decimal = Field(default=Decimal("0"))
    utilizationPercent: Decimal = Field(default=Decimal("0"))
    accessibilityScore: int = Field(default=5)  # 1-10
    ergonomicScore: int = Field(default=5)  # 1-10
    distanceFromDock: Optional[int] = None  # meters
    pickPathSequence: Optional[int] = None
    isActive: bool = Field(default=True)
    lastUpdatedAt: datetime = Field(default_factory=datetime.utcnow)


class BinCharacteristics(BinCharacteristicsBase, BaseModel, table=True):
    """Bin characteristics model"""
    __tablename__ = "BinCharacteristics"


class BinCharacteristicsCreate(SQLModel):
    """Schema for characteristics creation"""
    binId: UUID
    locationId: UUID
    zoneId: UUID
    pickZone: str
    aisle: str
    level: int = 1
    position: int = 1
    heightCm: Optional[Decimal] = None
    widthCm: Optional[Decimal] = None
    depthCm: Optional[Decimal] = None
    maxWeightKg: Optional[Decimal] = None
    accessibilityScore: int = 5
    ergonomicScore: int = 5
    distanceFromDock: Optional[int] = None
    pickPathSequence: Optional[int] = None


class BinCharacteristicsResponse(BinCharacteristicsBase):
    """Response schema for characteristics"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SlottingRule
# ============================================================================

class SlottingRuleBase(SQLModel):
    """Slotting rule base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    ruleName: str = Field(max_length=100)
    ruleDescription: Optional[str] = Field(default=None, max_length=500)
    priority: int = Field(default=0, index=True)
    isActive: bool = Field(default=True)
    velocityClasses: List[str] = Field(default=[], sa_column=Column(JSON))
    targetZones: List[str] = Field(default=[], sa_column=Column(JSON))
    binLevelMin: Optional[int] = None
    binLevelMax: Optional[int] = None
    minAccessibilityScore: Optional[int] = None
    maxDistanceFromDock: Optional[int] = None
    categoryFilters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    attributeFilters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    effectiveFrom: Optional[date] = None
    effectiveTo: Optional[date] = None


class SlottingRule(SlottingRuleBase, BaseModel, table=True):
    """Slotting rule model"""
    __tablename__ = "SlottingRule"


class SlottingRuleCreate(SQLModel):
    """Schema for rule creation"""
    locationId: UUID
    ruleName: str
    ruleDescription: Optional[str] = None
    priority: int = 0
    velocityClasses: List[str] = []
    targetZones: List[str] = []
    binLevelMin: Optional[int] = None
    binLevelMax: Optional[int] = None
    minAccessibilityScore: Optional[int] = None
    maxDistanceFromDock: Optional[int] = None
    categoryFilters: Optional[dict] = None
    attributeFilters: Optional[dict] = None
    effectiveFrom: Optional[date] = None
    effectiveTo: Optional[date] = None


class SlottingRuleUpdate(SQLModel):
    """Schema for rule update"""
    ruleName: Optional[str] = None
    ruleDescription: Optional[str] = None
    priority: Optional[int] = None
    isActive: Optional[bool] = None
    velocityClasses: Optional[List[str]] = None
    targetZones: Optional[List[str]] = None
    binLevelMin: Optional[int] = None
    binLevelMax: Optional[int] = None
    minAccessibilityScore: Optional[int] = None
    maxDistanceFromDock: Optional[int] = None


class SlottingRuleResponse(SlottingRuleBase):
    """Response schema for rule"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SlottingRecommendation
# ============================================================================

class SlottingRecommendationBase(SQLModel):
    """Slotting recommendation base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    recommendationType: RecommendationType = Field(index=True)
    status: RecommendationStatus = Field(default=RecommendationStatus.PENDING, index=True)
    currentBinId: Optional[UUID] = Field(default=None, foreign_key="Bin.id")
    suggestedBinId: Optional[UUID] = None
    currentZone: Optional[str] = Field(default=None, max_length=50)
    suggestedZone: Optional[str] = Field(default=None, max_length=50)
    reason: str = Field(max_length=500)
    expectedBenefit: Optional[str] = Field(default=None, max_length=500)
    priorityScore: Decimal = Field(default=Decimal("0"))
    estimatedPickReduction: Optional[Decimal] = None
    estimatedTravelReduction: Optional[Decimal] = None
    ruleId: Optional[UUID] = Field(default=None, foreign_key="SlottingRule.id")
    generatedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    expiresAt: Optional[datetime] = None
    approvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    approvedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class SlottingRecommendation(SlottingRecommendationBase, BaseModel, table=True):
    """Slotting recommendation model"""
    __tablename__ = "SlottingRecommendation"


class SlottingRecommendationResponse(SlottingRecommendationBase):
    """Response schema for recommendation"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Request/Response Schemas
# ============================================================================

class VelocityAnalysisRequest(SQLModel):
    """Request for velocity analysis"""
    locationId: UUID
    periodDays: int = 30
    skuIds: Optional[List[UUID]] = None
    categories: Optional[List[str]] = None


class VelocityAnalysisResponse(SQLModel):
    """Response for velocity analysis"""
    locationId: UUID
    analysisDate: date
    periodDays: int
    totalSkus: int
    classACount: int
    classBCount: int
    classCCount: int
    recommendations: List[SlottingRecommendationResponse] = []


class SlottingOptimizeRequest(SQLModel):
    """Request for slotting optimization"""
    locationId: UUID
    zones: Optional[List[str]] = None
    maxRecommendations: int = 50


class SlottingMetricsResponse(SQLModel):
    """Response for slotting metrics"""
    locationId: UUID
    totalBins: int
    utilizationPercent: Decimal
    avgPickDistance: Decimal
    classAInGoldenZone: int
    classATotal: int
    optimizationScore: Decimal
    pendingRecommendations: int
    completedRecommendations: int
