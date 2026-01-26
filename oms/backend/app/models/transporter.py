"""
Transporter Models - SQLModel Implementation
Transporters/Carriers, configurations, and manifests
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Integer, Boolean, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase
from .enums import TransporterType, ManifestStatus

if TYPE_CHECKING:
    from .company import Company
    from .order import Delivery


# ============================================================================
# Database Models
# ============================================================================

class Transporter(BaseModel, table=True):
    """
    Transporter model - Shipping carriers/couriers.
    Master data for delivery partners with API configuration.
    """
    __tablename__ = "Transporter"

    # Identity
    code: str = Field(sa_column=Column(String, unique=True, nullable=False))
    name: str = Field(sa_column=Column(String, nullable=False))
    type: TransporterType = Field(sa_column=Column(String, nullable=False))

    # Branding
    logo: Optional[str] = Field(default=None)

    # API configuration
    apiEnabled: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    apiConfig: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )
    trackingUrlTemplate: Optional[str] = Field(default=None)

    # Status
    isActive: bool = Field(default=True, sa_column=Column(Boolean, default=True))

    # Relationships
    configs: List["TransporterConfig"] = Relationship(back_populates="transporter")
    deliveries: List["Delivery"] = Relationship()


class TransporterConfig(BaseModel, table=True):
    """
    TransporterConfig model - Company-specific transporter settings.
    Stores credentials and priority for each company-transporter pair.
    """
    __tablename__ = "TransporterConfig"
    __table_args__ = (
        UniqueConstraint("companyId", "transporterId", name="transporter_config_company_transporter_unique"),
    )

    # Foreign Keys
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    )
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id", ondelete="CASCADE"),
            nullable=False
        )
    )

    # Status
    isActive: bool = Field(default=True, sa_column=Column(Boolean, default=True))

    # Account info
    accountCode: Optional[str] = Field(default=None)
    credentials: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Priority (for carrier selection)
    priority: int = Field(default=0)

    # Relationships
    company: Optional["Company"] = Relationship()
    transporter: Optional["Transporter"] = Relationship(back_populates="configs")


class Manifest(BaseModel, table=True):
    """
    Manifest model - Shipment handover document.
    Groups deliveries for carrier pickup/handover.
    """
    __tablename__ = "Manifest"

    # Identity
    manifestNo: str = Field(sa_column=Column(String, unique=True, nullable=False))

    # Foreign Keys
    transporterId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Transporter.id"),
            nullable=False,
            index=True
        )
    )
    companyId: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("Company.id"),
            nullable=False,
            index=True
        )
    )

    # Status
    status: ManifestStatus = Field(
        default=ManifestStatus.OPEN,
        sa_column=Column(String, default="OPEN", index=True)
    )

    # Vehicle/Driver info
    vehicleNo: Optional[str] = Field(default=None)
    driverName: Optional[str] = Field(default=None)
    driverPhone: Optional[str] = Field(default=None)

    # Handover
    handoverImage: Optional[str] = Field(default=None)
    confirmedAt: Optional[datetime] = Field(default=None)
    confirmedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True))
    )

    # Relationships
    transporter: Optional["Transporter"] = Relationship()
    deliveries: List["Delivery"] = Relationship()


# ============================================================================
# Request/Response Schemas
# ============================================================================

# --- Transporter Schemas ---

class TransporterCreate(CreateBase):
    """Schema for creating transporter"""
    code: str
    name: str
    type: TransporterType
    logo: Optional[str] = None
    apiEnabled: bool = False
    apiConfig: Optional[dict] = None
    trackingUrlTemplate: Optional[str] = None


class TransporterUpdate(UpdateBase):
    """Schema for updating transporter"""
    name: Optional[str] = None
    type: Optional[TransporterType] = None
    logo: Optional[str] = None
    apiEnabled: Optional[bool] = None
    apiConfig: Optional[dict] = None
    trackingUrlTemplate: Optional[str] = None
    isActive: Optional[bool] = None


class TransporterResponse(ResponseBase):
    """Schema for transporter API responses"""
    id: UUID
    code: str
    name: str
    type: TransporterType
    logo: Optional[str] = None
    apiEnabled: bool
    apiConfig: Optional[dict] = None
    trackingUrlTemplate: Optional[str] = None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime


class TransporterBrief(ResponseBase):
    """Brief transporter info for lists"""
    id: UUID
    code: str
    name: str
    type: TransporterType
    isActive: bool


# --- TransporterConfig Schemas ---

class TransporterConfigCreate(CreateBase):
    """Schema for creating transporter config"""
    companyId: UUID
    transporterId: UUID
    accountCode: Optional[str] = None
    credentials: Optional[dict] = None
    priority: int = 0


class TransporterConfigUpdate(UpdateBase):
    """Schema for updating transporter config"""
    isActive: Optional[bool] = None
    accountCode: Optional[str] = None
    credentials: Optional[dict] = None
    priority: Optional[int] = None


class TransporterConfigResponse(ResponseBase):
    """Schema for transporter config API responses"""
    id: UUID
    companyId: UUID
    transporterId: UUID
    isActive: bool
    accountCode: Optional[str] = None
    priority: int
    createdAt: datetime
    updatedAt: datetime


# --- Manifest Schemas ---

class ManifestCreate(CreateBase):
    """Schema for creating manifest"""
    manifestNo: str
    transporterId: UUID
    companyId: UUID
    vehicleNo: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None


class ManifestUpdate(UpdateBase):
    """Schema for updating manifest"""
    status: Optional[ManifestStatus] = None
    vehicleNo: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    handoverImage: Optional[str] = None
    confirmedAt: Optional[datetime] = None
    confirmedBy: Optional[UUID] = None


class ManifestResponse(ResponseBase):
    """Schema for manifest API responses"""
    id: UUID
    manifestNo: str
    transporterId: UUID
    companyId: UUID
    status: ManifestStatus
    vehicleNo: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    handoverImage: Optional[str] = None
    confirmedAt: Optional[datetime] = None
    confirmedBy: Optional[UUID] = None
    createdAt: datetime
    updatedAt: datetime


class ManifestBrief(ResponseBase):
    """Brief manifest info for lists"""
    id: UUID
    manifestNo: str
    status: ManifestStatus
    createdAt: datetime


# --- Summary Schemas ---

class TransporterSummary(SQLModel):
    """Transporter summary statistics"""
    totalTransporters: int
    activeTransporters: int
    byType: dict


class ManifestSummary(SQLModel):
    """Manifest summary statistics"""
    totalManifests: int
    openManifests: int
    closedManifests: int
    handedOverManifests: int
    avgDeliveriesPerManifest: float
