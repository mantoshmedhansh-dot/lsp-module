"""
Company, Location, Zone, Bin Models - SQLModel Implementation
Core organizational structure for multi-tenant OMS
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, JSON, ForeignKey, text, Integer, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import LocationType, ZoneType, BinType, TemperatureType

if TYPE_CHECKING:
    from .user import User
    from .brand import Brand
    from .sku import SKU
    from .customer import Customer, CustomerGroup
    from .api_key import APIKey
    from .tenant_subscription import TenantSubscription
    from .onboarding import OnboardingStep
    from .client_contract import ClientContract


# ============================================================================
# Company Model
# ============================================================================

class Company(BaseModel, table=True):
    """
    Company model - represents tenant organizations.
    Root of multi-tenant hierarchy.
    """
    __tablename__ = "Company"

    # Identity
    code: str = Field(
        sa_column=Column(String, unique=True, nullable=False, index=True)
    )
    name: str = Field(sa_column=Column(String, nullable=False))
    legalName: Optional[str] = Field(default=None)

    # Tax/Legal
    gst: Optional[str] = Field(default=None)
    pan: Optional[str] = Field(default=None)
    cin: Optional[str] = Field(default=None)

    # Branding
    logo: Optional[str] = Field(default=None)

    # Contact
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    address: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Configuration
    settings: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Inventory Valuation - Default method for the company
    defaultValuationMethod: Optional[str] = Field(
        default="FIFO",
        sa_column=Column(String, default="FIFO")
    )  # FIFO, LIFO, FEFO, WAC

    # Tenant Hierarchy
    companyType: Optional[str] = Field(
        default="BRAND",
        sa_column=Column(String(20), default="BRAND")
    )  # LSP, BRAND
    parentId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id", ondelete="SET NULL"),
            nullable=True,
            index=True
        )
    )  # null = top-level tenant; set = brand under an LSP

    # Status
    isActive: bool = Field(default=True)

    # SaaS Subscription
    subscriptionStatus: Optional[str] = Field(
        default="trialing",
        sa_column=Column(String(20), default="trialing")
    )  # trialing, active, past_due, cancelled, expired
    trialEndsAt: Optional[datetime] = Field(default=None)
    branding: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSONB, default={})
    )  # logo, primaryColor, accentColor, favicon
    stripeCustomerId: Optional[str] = Field(
        default=None,
        sa_column=Column(String(100))
    )

    # Relationships
    users: List["User"] = Relationship(back_populates="company")
    locations: List["Location"] = Relationship(
        back_populates="company",
        sa_relationship_kwargs={"foreign_keys": "[Location.companyId]"}
    )
    brands: List["Brand"] = Relationship(back_populates="company")
    skus: List["SKU"] = Relationship(back_populates="company")
    customers: List["Customer"] = Relationship(back_populates="company")
    customerGroups: List["CustomerGroup"] = Relationship(back_populates="company")
    apiKeys: List["APIKey"] = Relationship(back_populates="company")
    tenantSubscriptions: List["TenantSubscription"] = Relationship(back_populates="company")
    onboardingSteps: List["OnboardingStep"] = Relationship(back_populates="company")

    # Hierarchical relationships
    children: List["Company"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={"foreign_keys": "[Company.parentId]"}
    )
    parent: Optional["Company"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "[Company.id]", "foreign_keys": "[Company.parentId]"}
    )
    lspContracts: List["ClientContract"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ClientContract.lspCompanyId]"}
    )
    brandContracts: List["ClientContract"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ClientContract.brandCompanyId]"}
    )


# ============================================================================
# Location Model
# ============================================================================

class Location(BaseModel, table=True):
    """
    Location model - warehouses, stores, hubs.
    Child of Company.
    """
    __tablename__ = "Location"

    # Identity
    code: str = Field(sa_column=Column(String, nullable=False))
    name: str = Field(sa_column=Column(String, nullable=False))
    type: LocationType = Field(
        sa_column=Column(String, nullable=False)
    )

    # Address
    address: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Contact
    contactPerson: Optional[str] = Field(default=None)
    contactPhone: Optional[str] = Field(default=None)
    contactEmail: Optional[str] = Field(default=None)

    # Tax
    gst: Optional[str] = Field(default=None)

    # Status
    isActive: bool = Field(default=True)

    # Configuration
    settings: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Inventory Valuation - Override for this location
    valuationMethod: Optional[str] = Field(
        default=None,
        sa_column=Column(String, default=None)
    )  # FIFO, LIFO, FEFO, WAC - overrides company default

    # Multi-tenant
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # Shared warehouse support (LSP architecture)
    ownerCompanyId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id", ondelete="SET NULL"),
            nullable=True,
            index=True
        )
    )  # The LSP who owns this warehouse (null = self-owned by companyId)
    isShared: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False)
    )  # Is this a multi-brand warehouse?

    # Relationships
    company: Optional["Company"] = Relationship(
        back_populates="locations",
        sa_relationship_kwargs={"foreign_keys": "[Location.companyId]"}
    )
    ownerCompany: Optional["Company"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Location.ownerCompanyId]"}
    )
    zones: List["Zone"] = Relationship(back_populates="location")


# ============================================================================
# Zone Model
# ============================================================================

class Zone(BaseModel, table=True):
    """
    Zone model - warehouse zones (saleable, damaged, QC, etc.)
    Child of Location.
    """
    __tablename__ = "Zone"

    # Identity
    code: str = Field(sa_column=Column(String, nullable=False))
    name: str = Field(sa_column=Column(String, nullable=False))
    type: ZoneType = Field(
        sa_column=Column(String, nullable=False)
    )

    # Details
    description: Optional[str] = Field(default=None)

    # Temperature Control
    temperatureType: Optional[str] = Field(
        default=None,
        sa_column=Column(String)
    )  # AMBIENT, COLD, FROZEN
    minTemp: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(10, 2))
    )  # Minimum temperature in Celsius
    maxTemp: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(10, 2))
    )  # Maximum temperature in Celsius

    # Putaway Priority (lower = higher priority)
    priority: int = Field(
        default=100,
        sa_column=Column(Integer, nullable=False, default=100)
    )

    # Status
    isActive: bool = Field(default=True)

    # Parent
    locationId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Location.id"),
            nullable=False,
            index=True
        )
    )

    # Relationships
    location: Optional["Location"] = Relationship(back_populates="zones")
    bins: List["Bin"] = Relationship(back_populates="zone")


# ============================================================================
# Bin Model
# ============================================================================

class Bin(BaseModel, table=True):
    """
    Bin model - storage bins within zones.
    Child of Zone.
    """
    __tablename__ = "Bin"

    # Identity
    code: str = Field(sa_column=Column(String, nullable=False))
    name: Optional[str] = Field(default=None)

    # Details
    description: Optional[str] = Field(default=None)

    # Bin Type
    binType: Optional[str] = Field(
        default=None,
        sa_column=Column(String)
    )  # FLOOR, SHELF, PALLET, PICK_FACE, RESERVE, STAGING, QC_HOLD

    # Capacity Limits
    capacity: Optional[int] = Field(default=None)  # Legacy field (general capacity)
    maxWeight: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(10, 2))
    )  # Maximum weight in kg
    maxVolume: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(10, 4))
    )  # Maximum volume in cubic meters
    maxUnits: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer)
    )  # Maximum number of units

    # Current Utilization
    currentWeight: Optional[Decimal] = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric(10, 2), default=0)
    )  # Current weight in kg
    currentVolume: Optional[Decimal] = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric(10, 4), default=0)
    )  # Current volume in cubic meters
    currentUnits: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, default=0)
    )  # Current number of units

    # Physical Location (for bin addressing: Aisle-Rack-Level-Position)
    aisle: Optional[str] = Field(default=None, sa_column=Column(String))
    rack: Optional[str] = Field(default=None, sa_column=Column(String))
    level: Optional[str] = Field(default=None, sa_column=Column(String))
    position: Optional[str] = Field(default=None, sa_column=Column(String))

    # Pick Sequence (for optimized picking path)
    pickSequence: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, default=0, index=True)
    )

    # Bin Flags
    isPickFace: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False)
    )  # Primary picking location
    isReserve: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False)
    )  # Bulk/reserve storage
    isStaging: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False)
    )  # Temporary staging area

    # Status
    isActive: bool = Field(default=True)

    # Parent
    zoneId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Zone.id"),
            nullable=False,
            index=True
        )
    )

    # Relationships
    zone: Optional["Zone"] = Relationship(back_populates="bins")

    @property
    def availableWeight(self) -> Optional[Decimal]:
        """Calculate available weight capacity"""
        if self.maxWeight is None:
            return None
        return self.maxWeight - (self.currentWeight or Decimal("0"))

    @property
    def availableVolume(self) -> Optional[Decimal]:
        """Calculate available volume capacity"""
        if self.maxVolume is None:
            return None
        return self.maxVolume - (self.currentVolume or Decimal("0"))

    @property
    def availableUnits(self) -> Optional[int]:
        """Calculate available unit capacity"""
        if self.maxUnits is None:
            return None
        return self.maxUnits - (self.currentUnits or 0)

    @property
    def fullAddress(self) -> str:
        """Return full bin address as Aisle-Rack-Level-Position"""
        parts = [self.aisle, self.rack, self.level, self.position]
        return "-".join(p for p in parts if p) or self.code


# ============================================================================
# Request/Response Schemas
# ============================================================================

# Company Schemas
class CompanyCreate(CreateBase):
    code: Optional[str] = None  # Auto-generated if not provided
    name: str
    legalName: Optional[str] = None
    gst: str  # Mandatory - GST Number
    pan: str  # Mandatory - PAN Number
    cin: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    settings: Optional[dict] = None
    defaultValuationMethod: Optional[str] = "FIFO"  # FIFO, LIFO, FEFO, WAC
    companyType: Optional[str] = "BRAND"  # LSP, BRAND
    parentId: Optional[UUID] = None


class CompanyUpdate(UpdateBase):
    code: Optional[str] = None
    name: Optional[str] = None
    legalName: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    settings: Optional[dict] = None
    defaultValuationMethod: Optional[str] = None  # FIFO, LIFO, FEFO, WAC
    isActive: Optional[bool] = None
    subscriptionStatus: Optional[str] = None
    trialEndsAt: Optional[datetime] = None
    branding: Optional[dict] = None
    stripeCustomerId: Optional[str] = None
    companyType: Optional[str] = None  # LSP, BRAND
    parentId: Optional[UUID] = None


class CompanyResponse(ResponseBase):
    id: UUID
    code: str
    name: str
    legalName: Optional[str] = None
    gst: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    settings: Optional[dict] = None
    defaultValuationMethod: Optional[str] = "FIFO"  # FIFO, LIFO, FEFO, WAC
    isActive: bool
    companyType: Optional[str] = "BRAND"
    parentId: Optional[UUID] = None
    subscriptionStatus: Optional[str] = "trialing"
    trialEndsAt: Optional[datetime] = None
    branding: Optional[dict] = None
    stripeCustomerId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class CompanyBrief(ResponseBase):
    id: UUID
    code: str
    name: str
    logo: Optional[str] = None


# Location Schemas
class LocationCreate(CreateBase):
    code: Optional[str] = None  # Auto-generated if not provided
    name: str
    type: LocationType
    address: Optional[dict] = None
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    gst: Optional[str] = None
    settings: Optional[dict] = None
    valuationMethod: Optional[str] = None  # FIFO, LIFO, FEFO, WAC - overrides company default
    companyId: UUID
    ownerCompanyId: Optional[UUID] = None  # LSP who owns this warehouse
    isShared: bool = False  # Multi-brand warehouse?


class LocationUpdate(UpdateBase):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[LocationType] = None
    address: Optional[dict] = None
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    gst: Optional[str] = None
    settings: Optional[dict] = None
    valuationMethod: Optional[str] = None  # FIFO, LIFO, FEFO, WAC - overrides company default
    isActive: Optional[bool] = None
    ownerCompanyId: Optional[UUID] = None
    isShared: Optional[bool] = None


class LocationResponse(ResponseBase):
    id: UUID
    code: str
    name: str
    type: LocationType
    address: Optional[dict] = None
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    gst: Optional[str] = None
    settings: Optional[dict] = None
    valuationMethod: Optional[str] = None  # FIFO, LIFO, FEFO, WAC
    isActive: bool
    companyId: UUID
    ownerCompanyId: Optional[UUID] = None
    isShared: bool = False
    createdAt: datetime
    updatedAt: datetime


class LocationBrief(ResponseBase):
    id: UUID
    code: str
    name: str
    type: LocationType


# Zone Schemas
class ZoneCreate(CreateBase):
    code: str
    name: str
    type: ZoneType
    description: Optional[str] = None
    temperatureType: Optional[str] = None
    minTemp: Optional[Decimal] = None
    maxTemp: Optional[Decimal] = None
    priority: int = 100
    locationId: UUID


class ZoneUpdate(UpdateBase):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[ZoneType] = None
    description: Optional[str] = None
    temperatureType: Optional[str] = None
    minTemp: Optional[Decimal] = None
    maxTemp: Optional[Decimal] = None
    priority: Optional[int] = None
    isActive: Optional[bool] = None


class ZoneResponse(ResponseBase):
    id: UUID
    code: str
    name: str
    type: ZoneType
    description: Optional[str] = None
    temperatureType: Optional[str] = None
    minTemp: Optional[Decimal] = None
    maxTemp: Optional[Decimal] = None
    priority: int
    isActive: bool
    locationId: UUID
    createdAt: datetime
    updatedAt: datetime
    binCount: Optional[int] = None  # Computed field for bin count


class ZoneBrief(ResponseBase):
    id: UUID
    code: str
    name: str
    type: ZoneType
    temperatureType: Optional[str] = None


# Bin Schemas
class BinCreate(CreateBase):
    code: str
    name: Optional[str] = None
    description: Optional[str] = None
    binType: Optional[str] = None
    capacity: Optional[int] = None
    maxWeight: Optional[Decimal] = None
    maxVolume: Optional[Decimal] = None
    maxUnits: Optional[int] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None
    position: Optional[str] = None
    pickSequence: int = 0
    isPickFace: bool = False
    isReserve: bool = False
    isStaging: bool = False
    zoneId: UUID


class BinUpdate(UpdateBase):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    binType: Optional[str] = None
    capacity: Optional[int] = None
    maxWeight: Optional[Decimal] = None
    maxVolume: Optional[Decimal] = None
    maxUnits: Optional[int] = None
    currentWeight: Optional[Decimal] = None
    currentVolume: Optional[Decimal] = None
    currentUnits: Optional[int] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None
    position: Optional[str] = None
    pickSequence: Optional[int] = None
    isPickFace: Optional[bool] = None
    isReserve: Optional[bool] = None
    isStaging: Optional[bool] = None
    isActive: Optional[bool] = None


class BinResponse(ResponseBase):
    id: UUID
    code: str
    name: Optional[str] = None
    description: Optional[str] = None
    binType: Optional[str] = None
    capacity: Optional[int] = None
    maxWeight: Optional[Decimal] = None
    maxVolume: Optional[Decimal] = None
    maxUnits: Optional[int] = None
    currentWeight: Optional[Decimal] = None
    currentVolume: Optional[Decimal] = None
    currentUnits: int = 0
    aisle: Optional[str] = None
    rack: Optional[str] = None
    level: Optional[str] = None
    position: Optional[str] = None
    pickSequence: int = 0
    isPickFace: bool = False
    isReserve: bool = False
    isStaging: bool = False
    isActive: bool
    zoneId: UUID
    createdAt: datetime
    updatedAt: datetime
    # Computed fields
    availableWeight: Optional[Decimal] = None
    availableVolume: Optional[Decimal] = None
    availableUnits: Optional[int] = None
    fullAddress: Optional[str] = None


class BinBrief(ResponseBase):
    id: UUID
    code: str
    name: Optional[str] = None
    binType: Optional[str] = None
    fullAddress: Optional[str] = None


class BinBulkCreate(CreateBase):
    """Schema for bulk bin creation"""
    zoneId: UUID
    prefix: str  # e.g., "A" for bins A-01, A-02, etc.
    binType: Optional[str] = None
    count: int  # Number of bins to create
    startNumber: int = 1
    aisle: Optional[str] = None
    maxWeight: Optional[Decimal] = None
    maxVolume: Optional[Decimal] = None
    maxUnits: Optional[int] = None
    isPickFace: bool = False
    isReserve: bool = False


class BinCapacityResponse(ResponseBase):
    """Response for bin capacity information"""
    id: UUID
    code: str
    maxWeight: Optional[Decimal] = None
    maxVolume: Optional[Decimal] = None
    maxUnits: Optional[int] = None
    currentWeight: Optional[Decimal] = None
    currentVolume: Optional[Decimal] = None
    currentUnits: int = 0
    availableWeight: Optional[Decimal] = None
    availableVolume: Optional[Decimal] = None
    availableUnits: Optional[int] = None
    utilizationPercent: Optional[Decimal] = None
