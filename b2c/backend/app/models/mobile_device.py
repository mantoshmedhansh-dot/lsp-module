"""
Mobile Device Models for WMS Mobile Operations
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class DeviceType(str, Enum):
    """Mobile device types"""
    HANDHELD_SCANNER = "HANDHELD_SCANNER"
    SMARTPHONE = "SMARTPHONE"
    TABLET = "TABLET"
    FORKLIFT_TERMINAL = "FORKLIFT_TERMINAL"
    WEARABLE = "WEARABLE"


class DeviceStatus(str, Enum):
    """Device registration status"""
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DECOMMISSIONED = "DECOMMISSIONED"


class ScanType(str, Enum):
    """Barcode scan types"""
    ITEM = "ITEM"
    LOCATION = "LOCATION"
    ORDER = "ORDER"
    CONTAINER = "CONTAINER"
    LICENSE_PLATE = "LICENSE_PLATE"
    SERIAL = "SERIAL"


# Database Models
class MobileDevice(BaseModel, table=True):
    """Device registration and authentication"""
    __tablename__ = "mobile_devices"

    deviceId: str = Field(max_length=255, unique=True, index=True)
    deviceName: str = Field(max_length=255)
    deviceType: DeviceType = Field(default=DeviceType.HANDHELD_SCANNER)
    manufacturer: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None, max_length=100)
    osVersion: Optional[str] = Field(default=None, max_length=50)
    appVersion: Optional[str] = Field(default=None, max_length=50)
    status: DeviceStatus = Field(default=DeviceStatus.PENDING)
    warehouseId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    assignedUserId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    lastSeenAt: Optional[datetime] = Field(default=None)
    registeredAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    registeredBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    authToken: Optional[str] = Field(default=None, max_length=500)
    tokenExpiresAt: Optional[datetime] = Field(default=None)
    pushToken: Optional[str] = Field(default=None, max_length=500)
    capabilities: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    settings: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MobileConfig(BaseModel, table=True):
    """Per-device configuration"""
    __tablename__ = "mobile_config"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    configKey: str = Field(max_length=100, index=True)
    configValue: str = Field(sa_column=Column(Text))
    valueType: str = Field(default="string", max_length=20)
    isEncrypted: bool = Field(default=False)
    description: Optional[str] = Field(default=None, max_length=500)


class DeviceLocationLog(BaseModel, table=True):
    """Location tracking for mobile devices"""
    __tablename__ = "device_location_log"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    accuracy: Optional[float] = Field(default=None)
    warehouseZone: Optional[str] = Field(default=None, max_length=50)
    aisle: Optional[str] = Field(default=None, max_length=20)
    recordedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class BarcodeScanLog(BaseModel, table=True):
    """Scan history for audit"""
    __tablename__ = "barcode_scan_log"

    deviceId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    scanType: ScanType = Field(index=True)
    barcode: str = Field(max_length=255, index=True)
    scannedValue: Optional[str] = Field(default=None, max_length=500)
    resolvedEntityId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    resolvedEntityType: Optional[str] = Field(default=None, max_length=50)
    isSuccessful: bool = Field(default=True)
    errorMessage: Optional[str] = Field(default=None, max_length=500)
    scannedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    location: Optional[str] = Field(default=None, max_length=100)
    taskId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


# Request/Response Schemas
class MobileDeviceRegister(SQLModel):
    """Schema for device registration"""
    deviceId: str
    deviceName: str
    deviceType: DeviceType = DeviceType.HANDHELD_SCANNER
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    osVersion: Optional[str] = None
    appVersion: Optional[str] = None
    warehouseId: Optional[UUID] = None
    capabilities: Optional[dict] = None


class MobileDeviceAuth(SQLModel):
    """Schema for device authentication"""
    deviceId: str
    userId: UUID
    pin: Optional[str] = None


class MobileDeviceResponse(SQLModel):
    """Response schema for device"""
    id: UUID
    deviceId: str
    deviceName: str
    deviceType: DeviceType
    status: DeviceStatus
    warehouseId: Optional[UUID]
    assignedUserId: Optional[UUID]
    lastSeenAt: Optional[datetime]
    registeredAt: datetime


class MobileDeviceAuthResponse(SQLModel):
    """Response for device authentication"""
    accessToken: str
    tokenType: str = "bearer"
    expiresIn: int
    deviceId: str
    userId: UUID


class BarcodeScanRequest(SQLModel):
    """Schema for barcode scan processing"""
    barcode: str
    scanType: Optional[ScanType] = None
    location: Optional[str] = None
    taskId: Optional[UUID] = None
    extraData: Optional[dict] = None


class BarcodeScanResponse(SQLModel):
    """Response for barcode scan"""
    id: UUID
    scanType: ScanType
    barcode: str
    scannedValue: Optional[str]
    resolvedEntityId: Optional[UUID]
    resolvedEntityType: Optional[str]
    isSuccessful: bool
    errorMessage: Optional[str]
    scannedAt: datetime


class MobileConfigUpdate(SQLModel):
    """Schema for updating device config"""
    configKey: str
    configValue: str
    valueType: str = "string"
    description: Optional[str] = None
