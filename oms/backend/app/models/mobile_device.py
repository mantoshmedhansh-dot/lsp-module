"""
Mobile Device Models: Device registration, Config, Location tracking, Barcode scanning
For WMS Mobile Operations
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

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


# ============================================================================
# MobileDevice
# ============================================================================

class MobileDeviceBase(SQLModel):
    """Mobile device base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: str = Field(max_length=255, unique=True, index=True)
    deviceName: str = Field(max_length=255)
    deviceType: DeviceType = Field(default=DeviceType.HANDHELD_SCANNER)
    manufacturer: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None, max_length=100)
    osVersion: Optional[str] = Field(default=None, max_length=50)
    appVersion: Optional[str] = Field(default=None, max_length=50)
    status: DeviceStatus = Field(default=DeviceStatus.PENDING, index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id", index=True)
    assignedUserId: Optional[UUID] = Field(default=None, foreign_key="User.id", index=True)
    lastSeenAt: Optional[datetime] = None
    registeredAt: datetime = Field(default_factory=datetime.utcnow)
    registeredById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    authToken: Optional[str] = Field(default=None, max_length=500)
    tokenExpiresAt: Optional[datetime] = None
    pushToken: Optional[str] = Field(default=None, max_length=500)
    capabilities: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    settings: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class MobileDevice(MobileDeviceBase, BaseModel, table=True):
    """Mobile device model"""
    __tablename__ = "MobileDevice"


class MobileDeviceRegister(SQLModel):
    """Schema for device registration"""
    deviceId: str
    deviceName: str
    deviceType: DeviceType = DeviceType.HANDHELD_SCANNER
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    osVersion: Optional[str] = None
    appVersion: Optional[str] = None
    locationId: Optional[UUID] = None
    capabilities: Optional[dict] = None


class MobileDeviceUpdate(SQLModel):
    """Schema for device update"""
    deviceName: Optional[str] = None
    status: Optional[DeviceStatus] = None
    locationId: Optional[UUID] = None
    assignedUserId: Optional[UUID] = None
    appVersion: Optional[str] = None
    settings: Optional[dict] = None


class MobileDeviceResponse(MobileDeviceBase):
    """Response schema for device"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class MobileDeviceAuth(SQLModel):
    """Schema for device authentication"""
    deviceId: str
    userId: UUID
    pin: Optional[str] = None


class MobileDeviceAuthResponse(SQLModel):
    """Response for device authentication"""
    accessToken: str
    tokenType: str = "bearer"
    expiresIn: int
    deviceId: str
    userId: UUID


# ============================================================================
# MobileConfig
# ============================================================================

class MobileConfigBase(SQLModel):
    """Mobile device config base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    configKey: str = Field(max_length=100, index=True)
    configValue: str = Field(sa_column=Column(Text))
    valueType: str = Field(default="string", max_length=20)
    isEncrypted: bool = Field(default=False)
    description: Optional[str] = Field(default=None, max_length=500)


class MobileConfig(MobileConfigBase, BaseModel, table=True):
    """Mobile device config model"""
    __tablename__ = "MobileConfig"


class MobileConfigUpdate(SQLModel):
    """Schema for updating device config"""
    configKey: str
    configValue: str
    valueType: str = "string"
    description: Optional[str] = None


class MobileConfigResponse(MobileConfigBase):
    """Response schema for device config"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# DeviceLocationLog
# ============================================================================

class DeviceLocationLogBase(SQLModel):
    """Device location log base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    warehouseZone: Optional[str] = Field(default=None, max_length=50)
    aisle: Optional[str] = Field(default=None, max_length=20)
    recordedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class DeviceLocationLog(DeviceLocationLogBase, BaseModel, table=True):
    """Device location log model"""
    __tablename__ = "DeviceLocationLog"


class DeviceLocationLogResponse(DeviceLocationLogBase):
    """Response schema for device location"""
    id: UUID


# ============================================================================
# BarcodeScanLog
# ============================================================================

class BarcodeScanLogBase(SQLModel):
    """Barcode scan log base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    scanType: ScanType = Field(index=True)
    barcode: str = Field(max_length=255, index=True)
    scannedValue: Optional[str] = Field(default=None, max_length=500)
    resolvedEntityId: Optional[UUID] = None
    resolvedEntityType: Optional[str] = Field(default=None, max_length=50)
    isSuccessful: bool = Field(default=True)
    errorMessage: Optional[str] = Field(default=None, max_length=500)
    scannedAt: datetime = Field(default_factory=datetime.utcnow, index=True)
    location: Optional[str] = Field(default=None, max_length=100)
    taskId: Optional[UUID] = None
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class BarcodeScanLog(BarcodeScanLogBase, BaseModel, table=True):
    """Barcode scan log model"""
    __tablename__ = "BarcodeScanLog"


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
