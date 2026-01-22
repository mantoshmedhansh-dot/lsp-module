"""
Shipping Allocation Models - Phase 1 (2026-01-21)

Models for FTL, B2B/PTL, and B2C shipping allocation engine.
Includes rate matrices, performance tracking, and allocation rules.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSON, NUMERIC

from .base import BaseModel, CompanyMixin, ActiveMixin, ResponseBase, CreateBase, UpdateBase
from .enums import (
    ShipmentType, VehicleCategory, AllocationMode, FTLIndentStatus,
    PTLBookingStatus, RateMatrixType, PerformanceMetricType, AllocationDecisionReason
)


# ============================================================================
# FTL (Full Truck Load) Models
# ============================================================================

class FTLVehicleTypeMaster(BaseModel, CompanyMixin, ActiveMixin, table=True):
    """
    FTL Vehicle Type Master.
    Defines vehicle categories with capacity specifications.
    """
    __tablename__ = "FTLVehicleTypeMaster"

    code: str = Field(max_length=50, index=True)
    name: str = Field(max_length=100)
    category: VehicleCategory = Field(
        sa_column=Column(String, default=VehicleCategory.TRUCK_22FT.value)
    )

    # Capacity specifications
    capacityKg: int = Field(default=0)  # Weight capacity in kg
    capacityVolumeCBM: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # Volume capacity in cubic meters

    # Dimensions (internal)
    lengthFt: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(6, 2))
    )
    widthFt: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(6, 2))
    )
    heightFt: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(6, 2))
    )

    description: Optional[str] = Field(default=None, max_length=500)

    # Relationships
    laneRates: List["FTLLaneRate"] = Relationship(back_populates="vehicleTypeMaster")
    indents: List["FTLIndent"] = Relationship(back_populates="vehicleTypeMaster")


class FTLVendor(BaseModel, CompanyMixin, ActiveMixin, table=True):
    """
    FTL Vendor/Transporter Master.
    Stores FTL-specific transporter details.
    """
    __tablename__ = "FTLVendor"

    code: str = Field(max_length=50, index=True)
    name: str = Field(max_length=200)

    # Contact details
    contactPerson: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)

    # Address
    address: Optional[str] = Field(default=None, sa_column=Column(Text))
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=10)

    # Business details
    gstNumber: Optional[str] = Field(default=None, max_length=20)
    panNumber: Optional[str] = Field(default=None, max_length=15)

    # Payment terms
    paymentTermDays: int = Field(default=30)
    creditLimit: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(14, 2))
    )

    # Performance defaults
    defaultTATDays: int = Field(default=3)
    reliabilityScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )  # 0-100 score

    remarks: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Relationships
    laneRates: List["FTLLaneRate"] = Relationship(back_populates="vendor")
    indents: List["FTLIndent"] = Relationship(back_populates="vendor")


class FTLLaneRate(BaseModel, CompanyMixin, ActiveMixin, table=True):
    """
    FTL Lane-wise Rate Matrix.
    Origin-Destination rates per vehicle type per vendor.
    """
    __tablename__ = "FTLLaneRate"
    __table_args__ = (
        Index('ix_ftl_lane_rate_lookup', 'originCity', 'destinationCity', 'vehicleTypeId', 'vendorId'),
    )

    # Lane definition
    originCity: str = Field(max_length=100, index=True)
    originState: Optional[str] = Field(default=None, max_length=100)
    destinationCity: str = Field(max_length=100, index=True)
    destinationState: Optional[str] = Field(default=None, max_length=100)

    # Distance (optional, for reference)
    distanceKm: Optional[int] = Field(default=None)

    # Rate details
    baseRate: Decimal = Field(sa_column=Column(NUMERIC(12, 2), nullable=False))
    perKmRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(8, 2))
    )  # Additional per km rate

    # Additional charges
    loadingCharges: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    unloadingCharges: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    tollCharges: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    otherCharges: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )

    # TAT
    transitDays: int = Field(default=1)

    # Validity
    validFrom: datetime = Field(default_factory=datetime.utcnow)
    validTo: Optional[datetime] = Field(default=None)

    # Foreign Keys
    vehicleTypeId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("FTLVehicleTypeMaster.id"),
            nullable=False,
            index=True
        )
    )
    vendorId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("FTLVendor.id"),
            nullable=False,
            index=True
        )
    )

    # Relationships
    vehicleTypeMaster: Optional["FTLVehicleTypeMaster"] = Relationship(back_populates="laneRates")
    vendor: Optional["FTLVendor"] = Relationship(back_populates="laneRates")


class FTLIndent(BaseModel, CompanyMixin, table=True):
    """
    FTL Indent/Trip Management.
    Tracks FTL shipment bookings and trip execution.
    """
    __tablename__ = "FTLIndent"

    indentNo: str = Field(max_length=50, unique=True, index=True)

    # Trip details
    status: FTLIndentStatus = Field(
        sa_column=Column(String, default=FTLIndentStatus.DRAFT.value)
    )

    # Origin
    originCity: str = Field(max_length=100)
    originState: Optional[str] = Field(default=None, max_length=100)
    originAddress: Optional[str] = Field(default=None, sa_column=Column(Text))
    originPincode: Optional[str] = Field(default=None, max_length=10)

    # Destination
    destinationCity: str = Field(max_length=100)
    destinationState: Optional[str] = Field(default=None, max_length=100)
    destinationAddress: Optional[str] = Field(default=None, sa_column=Column(Text))
    destinationPincode: Optional[str] = Field(default=None, max_length=10)

    # Cargo details
    materialDescription: Optional[str] = Field(default=None, sa_column=Column(Text))
    totalWeight: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )
    totalPackages: int = Field(default=0)
    invoiceValue: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(14, 2))
    )
    invoiceNumbers: Optional[str] = Field(default=None, max_length=500)

    # E-way bill
    ewayBillNumber: Optional[str] = Field(default=None, max_length=20)
    ewayBillDate: Optional[datetime] = Field(default=None)
    ewayBillExpiry: Optional[datetime] = Field(default=None)

    # Vehicle assignment
    vehicleNumber: Optional[str] = Field(default=None, max_length=20)
    driverName: Optional[str] = Field(default=None, max_length=100)
    driverPhone: Optional[str] = Field(default=None, max_length=20)
    driverLicense: Optional[str] = Field(default=None, max_length=30)

    # Dates
    requestedPickupDate: Optional[datetime] = Field(default=None)
    actualPickupDate: Optional[datetime] = Field(default=None)
    expectedDeliveryDate: Optional[datetime] = Field(default=None)
    actualDeliveryDate: Optional[datetime] = Field(default=None)

    # Financials
    agreedRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )
    advanceAmount: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )
    balanceAmount: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )

    # POD
    podImage: Optional[str] = Field(default=None, max_length=500)
    podReceivedBy: Optional[str] = Field(default=None, max_length=100)
    podRemarks: Optional[str] = Field(default=None, sa_column=Column(Text))
    podDate: Optional[datetime] = Field(default=None)

    remarks: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Foreign Keys
    vehicleTypeId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("FTLVehicleTypeMaster.id"),
            nullable=True
        )
    )
    vendorId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("FTLVendor.id"),
            nullable=True
        )
    )
    laneRateId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("FTLLaneRate.id"),
            nullable=True
        )
    )
    createdById: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )

    # Relationships
    vehicleTypeMaster: Optional["FTLVehicleTypeMaster"] = Relationship(back_populates="indents")
    vendor: Optional["FTLVendor"] = Relationship(back_populates="indents")


# ============================================================================
# B2B/PTL Rate Matrix Models
# ============================================================================

class PTLRateMatrix(BaseModel, CompanyMixin, ActiveMixin, table=True):
    """
    PTL/B2B N×N Rate Matrix.
    Origin-Destination-Weight based pricing for B2B shipments.
    """
    __tablename__ = "PTLRateMatrix"
    __table_args__ = (
        Index('ix_ptl_rate_matrix_lookup', 'originCity', 'destinationCity', 'transporterId'),
    )

    # Lane definition
    originCity: str = Field(max_length=100, index=True)
    originState: Optional[str] = Field(default=None, max_length=100)
    destinationCity: str = Field(max_length=100, index=True)
    destinationState: Optional[str] = Field(default=None, max_length=100)

    # Weight slabs (rates per kg)
    rate0to50: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # 0-50 kg
    rate50to100: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # 50-100 kg
    rate100to250: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # 100-250 kg
    rate250to500: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # 250-500 kg
    rate500to1000: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # 500-1000 kg
    rate1000plus: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # 1000+ kg

    # Minimum charge
    minimumCharge: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )

    # Additional charges
    fodCharge: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # Fuel/ODA surcharge
    odaCharge: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )  # Out of delivery area
    codPercent: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )  # COD collection charge %

    # Validity
    validFrom: datetime = Field(default_factory=datetime.utcnow)
    validTo: Optional[datetime] = Field(default=None)

    # Foreign Key
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id"),
            nullable=False,
            index=True
        )
    )


class PTLTATMatrix(BaseModel, CompanyMixin, ActiveMixin, table=True):
    """
    PTL/B2B Transit Time (TAT) Matrix.
    Expected transit days per lane per transporter.
    """
    __tablename__ = "PTLTATMatrix"
    __table_args__ = (
        Index('ix_ptl_tat_matrix_lookup', 'originCity', 'destinationCity', 'transporterId'),
    )

    # Lane definition
    originCity: str = Field(max_length=100, index=True)
    originState: Optional[str] = Field(default=None, max_length=100)
    destinationCity: str = Field(max_length=100, index=True)
    destinationState: Optional[str] = Field(default=None, max_length=100)

    # TAT in days
    transitDays: int = Field(default=3)

    # Delivery window
    minTransitDays: Optional[int] = Field(default=None)
    maxTransitDays: Optional[int] = Field(default=None)

    # Reliability metrics (auto-calculated from historical data)
    onTimeDeliveryPercent: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Foreign Key
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id"),
            nullable=False,
            index=True
        )
    )


# ============================================================================
# Performance Tracking Models
# ============================================================================

class CarrierPerformance(BaseModel, CompanyMixin, table=True):
    """
    Aggregated Carrier Performance Metrics.
    Stores overall performance scores per carrier.
    """
    __tablename__ = "CarrierPerformance"

    # Period
    periodStart: datetime = Field(index=True)
    periodEnd: datetime = Field(index=True)

    # Shipment type
    shipmentType: ShipmentType = Field(
        sa_column=Column(String, default=ShipmentType.B2C.value)
    )

    # Volume metrics
    totalShipments: int = Field(default=0)
    deliveredShipments: int = Field(default=0)
    rtoShipments: int = Field(default=0)

    # Performance scores (0-100)
    costScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    speedScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    reliabilityScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    overallScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Raw metrics
    avgTATDays: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(6, 2))
    )
    avgCostPerKg: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    successRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )  # Delivery success %
    rtoRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )  # RTO %
    onTimeRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )  # On-time delivery %

    # Foreign Key
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id"),
            nullable=False,
            index=True
        )
    )


class PincodePerformance(BaseModel, CompanyMixin, table=True):
    """
    Pincode-level Carrier Performance (B2C).
    Tracks performance per carrier per pincode for smart allocation.
    """
    __tablename__ = "PincodePerformance"
    __table_args__ = (
        Index('ix_pincode_performance_lookup', 'pincode', 'transporterId'),
    )

    pincode: str = Field(max_length=10, index=True)

    # Period
    periodStart: datetime = Field(index=True)
    periodEnd: datetime = Field(index=True)

    # Volume metrics
    totalShipments: int = Field(default=0)
    deliveredShipments: int = Field(default=0)
    rtoShipments: int = Field(default=0)

    # Performance scores (0-100)
    costScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    speedScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    reliabilityScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    overallScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Raw metrics
    avgTATDays: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(6, 2))
    )
    avgCost: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(10, 2))
    )
    successRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    rtoRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    onTimeRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Foreign Key
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id"),
            nullable=False,
            index=True
        )
    )


class LanePerformance(BaseModel, CompanyMixin, table=True):
    """
    Lane-level Performance (FTL/B2B).
    Tracks performance per carrier per origin-destination lane.
    """
    __tablename__ = "LanePerformance"
    __table_args__ = (
        Index('ix_lane_performance_lookup', 'originCity', 'destinationCity', 'transporterId'),
    )

    # Lane definition
    originCity: str = Field(max_length=100, index=True)
    destinationCity: str = Field(max_length=100, index=True)

    # Shipment type (FTL or B2B_PTL)
    shipmentType: ShipmentType = Field(
        sa_column=Column(String, default=ShipmentType.B2B_PTL.value)
    )

    # Period
    periodStart: datetime = Field(index=True)
    periodEnd: datetime = Field(index=True)

    # Volume metrics
    totalShipments: int = Field(default=0)
    deliveredShipments: int = Field(default=0)

    # Performance scores (0-100)
    costScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    speedScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    reliabilityScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    overallScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Raw metrics
    avgTATDays: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(6, 2))
    )
    avgCost: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )
    onTimeRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Foreign Key
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id"),
            nullable=False,
            index=True
        )
    )


# ============================================================================
# Allocation Engine Models
# ============================================================================

class CSRScoreConfig(BaseModel, CompanyMixin, table=True):
    """
    Cost/Speed/Reliability (CSR) Score Configuration.
    Defines weights for the allocation scoring algorithm.
    """
    __tablename__ = "CSRScoreConfig"

    name: str = Field(max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)

    # Shipment type this config applies to
    shipmentType: Optional[ShipmentType] = Field(
        default=None,
        sa_column=Column(String, nullable=True)
    )  # NULL means applies to all

    # Weights (must sum to 1.0)
    costWeight: Decimal = Field(
        default=Decimal("0.50"),
        sa_column=Column(NUMERIC(4, 2))
    )
    speedWeight: Decimal = Field(
        default=Decimal("0.30"),
        sa_column=Column(NUMERIC(4, 2))
    )
    reliabilityWeight: Decimal = Field(
        default=Decimal("0.20"),
        sa_column=Column(NUMERIC(4, 2))
    )

    # Thresholds
    minReliabilityScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )  # Minimum reliability to be eligible
    maxCostThreshold: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )  # Maximum cost allowed

    # Default allocation mode
    defaultMode: AllocationMode = Field(
        sa_column=Column(String, default=AllocationMode.AUTO.value)
    )

    isDefault: bool = Field(default=False)


class ShippingAllocationRule(BaseModel, CompanyMixin, ActiveMixin, table=True):
    """
    Enhanced Shipping Allocation Rules.
    Defines conditions for automatic carrier selection.
    """
    __tablename__ = "ShippingAllocationRule"

    code: str = Field(max_length=50, index=True)
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Priority (lower = higher priority)
    priority: int = Field(default=100)

    # Shipment type filter
    shipmentType: Optional[ShipmentType] = Field(
        default=None,
        sa_column=Column(String, nullable=True)
    )  # NULL means applies to all

    # Conditions (stored as JSON for flexibility)
    # Example: {"channel": ["AMAZON", "FLIPKART"], "paymentMode": "COD", "weightMin": 0, "weightMax": 500}
    conditions: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Action: which transporter to assign
    transporterId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )

    # Or use CSR scoring
    useCSRScoring: bool = Field(default=False)
    csrConfigId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("CSRScoreConfig.id"),
            nullable=True
        )
    )

    # Fallback transporter if primary fails
    fallbackTransporterId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )


class AllocationAudit(BaseModel, CompanyMixin, table=True):
    """
    Allocation Audit Trail.
    Records every allocation decision for analysis.
    """
    __tablename__ = "AllocationAudit"

    # What was allocated
    shipmentType: ShipmentType = Field(
        sa_column=Column(String, nullable=False)
    )

    # Reference to order/shipment
    orderId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    deliveryId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    ftlIndentId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )

    # Allocation mode used
    allocationMode: AllocationMode = Field(
        sa_column=Column(String, nullable=False)
    )

    # Selected carrier
    selectedTransporterId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False)
    )

    # Decision reason
    decisionReason: AllocationDecisionReason = Field(
        sa_column=Column(String, nullable=False)
    )

    # Scores at time of allocation (for reference)
    costScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    speedScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    reliabilityScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )
    overallScore: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(5, 2))
    )

    # Calculated rate at allocation
    calculatedRate: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(NUMERIC(12, 2))
    )

    # All candidates considered (JSON array with scores)
    candidatesConsidered: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Rule that matched (if any)
    matchedRuleId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("ShippingAllocationRule.id"),
            nullable=True
        )
    )

    # User who triggered (for manual/hybrid)
    allocatedById: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )

    # Override reason (for manual)
    overrideReason: Optional[str] = Field(default=None, max_length=500)


# ============================================================================
# Response Schemas (Pydantic)
# ============================================================================

class FTLVehicleTypeMasterResponse(ResponseBase):
    """FTL Vehicle type master response schema"""
    id: UUID
    code: str
    name: str
    category: VehicleCategory
    capacityKg: int
    capacityVolumeCBM: Optional[Decimal] = None
    lengthFt: Optional[Decimal] = None
    widthFt: Optional[Decimal] = None
    heightFt: Optional[Decimal] = None
    description: Optional[str] = None
    isActive: bool
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime


class FTLVendorResponse(ResponseBase):
    """FTL vendor response schema"""
    id: UUID
    code: str
    name: str
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    paymentTermDays: int
    defaultTATDays: int
    reliabilityScore: Optional[Decimal] = None
    isActive: bool
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime


class FTLLaneRateResponse(ResponseBase):
    """FTL lane rate response schema"""
    id: UUID
    originCity: str
    originState: Optional[str] = None
    destinationCity: str
    destinationState: Optional[str] = None
    distanceKm: Optional[int] = None
    baseRate: Decimal
    perKmRate: Optional[Decimal] = None
    transitDays: int
    vehicleTypeId: UUID
    vendorId: UUID
    isActive: bool
    validFrom: datetime
    validTo: Optional[datetime] = None
    # Joined fields
    vehicleTypeName: Optional[str] = None
    vendorName: Optional[str] = None


class CSRScoreConfigResponse(ResponseBase):
    """CSR score config response schema"""
    id: UUID
    name: str
    description: Optional[str] = None
    shipmentType: Optional[ShipmentType] = None
    costWeight: Decimal
    speedWeight: Decimal
    reliabilityWeight: Decimal
    defaultMode: AllocationMode
    isDefault: bool
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime


class AllocationAuditResponse(ResponseBase):
    """Allocation audit response schema"""
    id: UUID
    shipmentType: ShipmentType
    orderId: Optional[UUID] = None
    deliveryId: Optional[UUID] = None
    allocationMode: AllocationMode
    selectedTransporterId: UUID
    decisionReason: AllocationDecisionReason
    overallScore: Optional[Decimal] = None
    calculatedRate: Optional[Decimal] = None
    companyId: UUID
    createdAt: datetime
    # Joined fields
    transporterName: Optional[str] = None
    orderNo: Optional[str] = None


# ============================================================================
# Create/Update Schemas
# ============================================================================

class FTLVehicleTypeMasterCreate(CreateBase):
    """FTL Vehicle type master create schema"""
    code: str
    name: str
    category: VehicleCategory
    capacityKg: int
    capacityVolumeCBM: Optional[Decimal] = None
    lengthFt: Optional[Decimal] = None
    widthFt: Optional[Decimal] = None
    heightFt: Optional[Decimal] = None
    description: Optional[str] = None
    companyId: UUID


class FTLVehicleTypeMasterUpdate(UpdateBase):
    """FTL Vehicle type master update schema"""
    name: Optional[str] = None
    category: Optional[VehicleCategory] = None
    capacityKg: Optional[int] = None
    capacityVolumeCBM: Optional[Decimal] = None
    lengthFt: Optional[Decimal] = None
    widthFt: Optional[Decimal] = None
    heightFt: Optional[Decimal] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None


class FTLVendorCreate(CreateBase):
    """FTL vendor create schema"""
    code: str
    name: str
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gstNumber: Optional[str] = None
    panNumber: Optional[str] = None
    paymentTermDays: int = 30
    creditLimit: Optional[Decimal] = None
    defaultTATDays: int = 3
    companyId: UUID


class FTLVendorUpdate(UpdateBase):
    """FTL vendor update schema"""
    name: Optional[str] = None
    contactPerson: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    paymentTermDays: Optional[int] = None
    defaultTATDays: Optional[int] = None
    reliabilityScore: Optional[Decimal] = None
    isActive: Optional[bool] = None


class FTLLaneRateCreate(CreateBase):
    """FTL lane rate create schema"""
    originCity: str
    originState: Optional[str] = None
    destinationCity: str
    destinationState: Optional[str] = None
    distanceKm: Optional[int] = None
    baseRate: Decimal
    perKmRate: Optional[Decimal] = None
    loadingCharges: Optional[Decimal] = None
    unloadingCharges: Optional[Decimal] = None
    tollCharges: Optional[Decimal] = None
    transitDays: int = 1
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    vehicleTypeId: UUID
    vendorId: UUID
    companyId: UUID


class FTLLaneRateUpdate(UpdateBase):
    """FTL lane rate update schema"""
    baseRate: Optional[Decimal] = None
    perKmRate: Optional[Decimal] = None
    loadingCharges: Optional[Decimal] = None
    unloadingCharges: Optional[Decimal] = None
    tollCharges: Optional[Decimal] = None
    transitDays: Optional[int] = None
    validTo: Optional[datetime] = None
    isActive: Optional[bool] = None


class CSRScoreConfigCreate(CreateBase):
    """CSR score config create schema"""
    name: str
    description: Optional[str] = None
    shipmentType: Optional[ShipmentType] = None
    costWeight: Decimal = Decimal("0.50")
    speedWeight: Decimal = Decimal("0.30")
    reliabilityWeight: Decimal = Decimal("0.20")
    minReliabilityScore: Optional[Decimal] = None
    maxCostThreshold: Optional[Decimal] = None
    defaultMode: AllocationMode = AllocationMode.AUTO
    isDefault: bool = False
    companyId: UUID


class CSRScoreConfigUpdate(UpdateBase):
    """CSR score config update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    costWeight: Optional[Decimal] = None
    speedWeight: Optional[Decimal] = None
    reliabilityWeight: Optional[Decimal] = None
    minReliabilityScore: Optional[Decimal] = None
    maxCostThreshold: Optional[Decimal] = None
    defaultMode: Optional[AllocationMode] = None
    isDefault: Optional[bool] = None


# ============================================================================
# PTL Rate Matrix Schemas
# ============================================================================

class PTLRateMatrixResponse(ResponseBase):
    """PTL rate matrix response schema"""
    id: UUID
    originCity: str
    originState: Optional[str] = None
    destinationCity: str
    destinationState: Optional[str] = None
    rate0to50: Optional[Decimal] = None
    rate50to100: Optional[Decimal] = None
    rate100to250: Optional[Decimal] = None
    rate250to500: Optional[Decimal] = None
    rate500to1000: Optional[Decimal] = None
    rate1000plus: Optional[Decimal] = None
    minimumCharge: Optional[Decimal] = None
    fodCharge: Optional[Decimal] = None
    odaCharge: Optional[Decimal] = None
    codPercent: Optional[Decimal] = None
    validFrom: datetime
    validTo: Optional[datetime] = None
    transporterId: UUID
    isActive: bool
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime
    # Joined fields
    transporterName: Optional[str] = None


class PTLRateMatrixCreate(CreateBase):
    """PTL rate matrix create schema"""
    originCity: str
    originState: Optional[str] = None
    destinationCity: str
    destinationState: Optional[str] = None
    rate0to50: Optional[Decimal] = None
    rate50to100: Optional[Decimal] = None
    rate100to250: Optional[Decimal] = None
    rate250to500: Optional[Decimal] = None
    rate500to1000: Optional[Decimal] = None
    rate1000plus: Optional[Decimal] = None
    minimumCharge: Optional[Decimal] = None
    fodCharge: Optional[Decimal] = None
    odaCharge: Optional[Decimal] = None
    codPercent: Optional[Decimal] = None
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    transporterId: UUID
    companyId: UUID


class PTLRateMatrixUpdate(UpdateBase):
    """PTL rate matrix update schema"""
    rate0to50: Optional[Decimal] = None
    rate50to100: Optional[Decimal] = None
    rate100to250: Optional[Decimal] = None
    rate250to500: Optional[Decimal] = None
    rate500to1000: Optional[Decimal] = None
    rate1000plus: Optional[Decimal] = None
    minimumCharge: Optional[Decimal] = None
    fodCharge: Optional[Decimal] = None
    odaCharge: Optional[Decimal] = None
    codPercent: Optional[Decimal] = None
    validTo: Optional[datetime] = None
    isActive: Optional[bool] = None


class PTLTATMatrixResponse(ResponseBase):
    """PTL TAT matrix response schema"""
    id: UUID
    originCity: str
    originState: Optional[str] = None
    destinationCity: str
    destinationState: Optional[str] = None
    transitDays: int
    minTransitDays: Optional[int] = None
    maxTransitDays: Optional[int] = None
    onTimeDeliveryPercent: Optional[Decimal] = None
    transporterId: UUID
    isActive: bool
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime
    # Joined fields
    transporterName: Optional[str] = None


class PTLTATMatrixCreate(CreateBase):
    """PTL TAT matrix create schema"""
    originCity: str
    originState: Optional[str] = None
    destinationCity: str
    destinationState: Optional[str] = None
    transitDays: int = 3
    minTransitDays: Optional[int] = None
    maxTransitDays: Optional[int] = None
    transporterId: UUID
    companyId: UUID


class PTLTATMatrixUpdate(UpdateBase):
    """PTL TAT matrix update schema"""
    transitDays: Optional[int] = None
    minTransitDays: Optional[int] = None
    maxTransitDays: Optional[int] = None
    onTimeDeliveryPercent: Optional[Decimal] = None
    isActive: Optional[bool] = None


# ============================================================================
# Shipping Allocation Rule Schemas
# ============================================================================

class ShippingAllocationRuleResponse(ResponseBase):
    """Shipping allocation rule response schema"""
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    priority: int
    shipmentType: Optional[ShipmentType] = None
    conditions: Optional[Dict[str, Any]] = None
    transporterId: Optional[UUID] = None
    useCSRScoring: bool
    csrConfigId: Optional[UUID] = None
    fallbackTransporterId: Optional[UUID] = None
    isActive: bool
    companyId: UUID
    createdAt: datetime
    updatedAt: datetime
    # Joined fields
    transporterName: Optional[str] = None
    csrConfigName: Optional[str] = None


class ShippingAllocationRuleCreate(CreateBase):
    """Shipping allocation rule create schema"""
    code: str
    name: str
    description: Optional[str] = None
    priority: int = 100
    shipmentType: Optional[ShipmentType] = None
    conditions: Optional[Dict[str, Any]] = None
    transporterId: Optional[UUID] = None
    useCSRScoring: bool = False
    csrConfigId: Optional[UUID] = None
    fallbackTransporterId: Optional[UUID] = None
    companyId: UUID


class ShippingAllocationRuleUpdate(UpdateBase):
    """Shipping allocation rule update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    shipmentType: Optional[ShipmentType] = None
    conditions: Optional[Dict[str, Any]] = None
    transporterId: Optional[UUID] = None
    useCSRScoring: Optional[bool] = None
    csrConfigId: Optional[UUID] = None
    fallbackTransporterId: Optional[UUID] = None
    isActive: Optional[bool] = None
