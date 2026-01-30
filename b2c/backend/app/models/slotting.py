"""
Slotting Optimization Models for Warehouse Operations
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class VelocityClass(str, Enum):
    """ABC velocity classification"""
    A = "A"  # Fast movers (top 20% of volume)
    B = "B"  # Medium movers (next 30%)
    C = "C"  # Slow movers (bottom 50%)


class VariabilityClass(str, Enum):
    """XYZ demand variability classification"""
    X = "X"  # Consistent demand (low variability)
    Y = "Y"  # Variable demand (medium variability)
    Z = "Z"  # Sporadic demand (high variability)


class BinType(str, Enum):
    """Bin/location types"""
    SHELF = "SHELF"
    FLOOR = "FLOOR"
    RACK = "RACK"
    PALLET = "PALLET"
    CAROUSEL = "CAROUSEL"
    FLOW_RACK = "FLOW_RACK"
    MEZZANINE = "MEZZANINE"


class ZoneType(str, Enum):
    """Warehouse zone types"""
    RECEIVING = "RECEIVING"
    STAGING = "STAGING"
    BULK = "BULK"
    RESERVE = "RESERVE"
    FORWARD_PICK = "FORWARD_PICK"
    PACKING = "PACKING"
    SHIPPING = "SHIPPING"
    RETURNS = "RETURNS"


class RecommendationStatus(str, Enum):
    """Slotting recommendation status"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"


class RecommendationType(str, Enum):
    """Types of slotting recommendations"""
    NEW_SLOT = "NEW_SLOT"
    MOVE = "MOVE"
    CONSOLIDATE = "CONSOLIDATE"
    REPLENISH = "REPLENISH"
    DEACTIVATE = "DEACTIVATE"


# Database Models
class SkuVelocity(BaseModel, table=True):
    """ABC/XYZ classification data"""
    __tablename__ = "sku_velocity"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sku: str = Field(max_length=100, index=True)
    velocityClass: VelocityClass = Field(default=VelocityClass.C)
    variabilityClass: VariabilityClass = Field(default=VariabilityClass.Z)
    combinedClass: str = Field(default="CZ", max_length=2)
    pickCountLast30Days: int = Field(default=0)
    pickCountLast90Days: int = Field(default=0)
    unitsSoldLast30Days: int = Field(default=0)
    unitsSoldLast90Days: int = Field(default=0)
    averagePicksPerDay: float = Field(default=0.0)
    demandVariability: float = Field(default=0.0)
    pickFrequency: float = Field(default=0.0)
    seasonalityFactor: float = Field(default=1.0)
    analysisDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    nextReviewDate: Optional[datetime] = Field(default=None)


class BinCharacteristics(BaseModel, table=True):
    """Size, weight capacity, zone"""
    __tablename__ = "bin_characteristics"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    locationId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, unique=True, index=True)
    )
    locationCode: str = Field(max_length=50, index=True)
    binType: BinType = Field(default=BinType.SHELF)
    zoneType: ZoneType = Field(default=ZoneType.FORWARD_PICK)
    aisle: str = Field(max_length=10, index=True)
    rack: Optional[str] = Field(default=None, max_length=10)
    level: Optional[str] = Field(default=None, max_length=10)
    position: Optional[str] = Field(default=None, max_length=10)
    widthCm: float = Field(default=0.0)
    heightCm: float = Field(default=0.0)
    depthCm: float = Field(default=0.0)
    volumeCubicCm: float = Field(default=0.0)
    maxWeightKg: float = Field(default=0.0)
    currentWeightKg: float = Field(default=0.0)
    pickSequence: int = Field(default=0)
    travelTimeSeconds: float = Field(default=0.0)
    ergonomicScore: float = Field(default=100.0)
    temperatureZone: Optional[str] = Field(default=None, max_length=20)
    isActive: bool = Field(default=True)
    restrictions: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class SlottingRule(BaseModel, table=True):
    """Assignment rules"""
    __tablename__ = "slotting_rules"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    ruleName: str = Field(max_length=100)
    ruleType: str = Field(max_length=50)
    priority: int = Field(default=0)
    velocityClasses: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    variabilityClasses: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    zoneTypes: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    binTypes: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    minPicksPerDay: Optional[float] = Field(default=None)
    maxPicksPerDay: Optional[float] = Field(default=None)
    preferredAisles: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    preferredLevels: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    weightLimit: Optional[float] = Field(default=None)
    volumeLimit: Optional[float] = Field(default=None)
    conditions: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isActive: bool = Field(default=True)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))


class SlottingRecommendation(BaseModel, table=True):
    """Suggested moves"""
    __tablename__ = "slotting_recommendations"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    itemId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    sku: str = Field(max_length=100, index=True)
    recommendationType: RecommendationType = Field(index=True)
    status: RecommendationStatus = Field(default=RecommendationStatus.PENDING, index=True)
    currentLocationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    currentLocation: Optional[str] = Field(default=None, max_length=100)
    recommendedLocationId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    recommendedLocation: Optional[str] = Field(default=None, max_length=100)
    appliedRuleId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    reason: str = Field(max_length=500)
    expectedBenefit: Optional[str] = Field(default=None, max_length=500)
    estimatedSavingsMinutes: float = Field(default=0.0)
    estimatedSavingsPercent: float = Field(default=0.0)
    quantity: Optional[int] = Field(default=None)
    priority: int = Field(default=0)
    generatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiresAt: Optional[datetime] = Field(default=None)
    approvedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    approvedAt: Optional[datetime] = Field(default=None)
    completedAt: Optional[datetime] = Field(default=None)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


# Request/Response Schemas
class SkuVelocityResponse(SQLModel):
    """Response schema for SKU velocity"""
    id: UUID
    warehouseId: UUID
    itemId: UUID
    sku: str
    velocityClass: VelocityClass
    variabilityClass: VariabilityClass
    combinedClass: str
    pickCountLast30Days: int
    unitsSoldLast30Days: int
    averagePicksPerDay: float
    demandVariability: float
    analysisDate: datetime


class BinCharacteristicsResponse(SQLModel):
    """Response schema for bin characteristics"""
    id: UUID
    warehouseId: UUID
    locationId: UUID
    locationCode: str
    binType: BinType
    zoneType: ZoneType
    aisle: str
    rack: Optional[str]
    level: Optional[str]
    widthCm: float
    heightCm: float
    depthCm: float
    maxWeightKg: float
    pickSequence: int
    ergonomicScore: float
    isActive: bool


class SlottingRuleCreate(SQLModel):
    """Schema for creating a slotting rule"""
    warehouseId: UUID
    ruleName: str
    ruleType: str
    priority: int = 0
    velocityClasses: Optional[List[str]] = None
    variabilityClasses: Optional[List[str]] = None
    zoneTypes: Optional[List[str]] = None
    binTypes: Optional[List[str]] = None
    minPicksPerDay: Optional[float] = None
    maxPicksPerDay: Optional[float] = None
    preferredAisles: Optional[List[str]] = None
    preferredLevels: Optional[List[str]] = None
    conditions: Optional[dict] = None
    description: Optional[str] = None


class SlottingRuleResponse(SQLModel):
    """Response schema for slotting rule"""
    id: UUID
    warehouseId: UUID
    ruleName: str
    ruleType: str
    priority: int
    velocityClasses: Optional[List[str]]
    zoneTypes: Optional[List[str]]
    isActive: bool


class SlottingRecommendationResponse(SQLModel):
    """Response schema for recommendation"""
    id: UUID
    warehouseId: UUID
    itemId: UUID
    sku: str
    recommendationType: RecommendationType
    status: RecommendationStatus
    currentLocation: Optional[str]
    recommendedLocation: Optional[str]
    reason: str
    expectedBenefit: Optional[str]
    estimatedSavingsPercent: float
    priority: int
    generatedAt: datetime
    expiresAt: Optional[datetime]


class VelocityAnalysisRequest(SQLModel):
    """Request for velocity analysis"""
    warehouseId: UUID
    periodDays: int = 30
    includeZeroMovers: bool = False


class VelocityAnalysisResponse(SQLModel):
    """Response for velocity analysis"""
    warehouseId: UUID
    totalSkus: int
    aClassCount: int
    bClassCount: int
    cClassCount: int
    xClassCount: int
    yClassCount: int
    zClassCount: int
    analysisDate: datetime
    recommendations: int


class OptimizationRequest(SQLModel):
    """Request for slotting optimization"""
    warehouseId: UUID
    zones: Optional[List[str]] = None
    skus: Optional[List[str]] = None
    maxRecommendations: int = 100
    minimumSavingsPercent: float = 5.0


class OptimizationResponse(SQLModel):
    """Response for optimization run"""
    warehouseId: UUID
    totalRecommendations: int
    moveRecommendations: int
    consolidateRecommendations: int
    totalEstimatedSavingsPercent: float
    optimizationRunId: UUID
    generatedAt: datetime


class SlottingMetricsResponse(SQLModel):
    """Response for slotting efficiency metrics"""
    warehouseId: UUID
    totalLocations: int
    utilizationRate: float
    averagePickDistance: float
    aClassInGoldenZone: float
    ergonomicComplianceRate: float
    lastOptimizationDate: Optional[datetime]
    pendingRecommendations: int
