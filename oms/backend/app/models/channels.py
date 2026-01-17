"""
Channel Models: Channel Config, Order Import
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

from .base import BaseModel
from .enums import Channel, SyncFrequency, ImportStatus


# ============================================================================
# Channel Config
# ============================================================================

class ChannelConfigBase(SQLModel):
    """Channel Config base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    channel: Channel = Field(index=True)
    displayName: Optional[str] = None
    isActive: bool = Field(default=True)
    credentials: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    settings: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    lastSyncAt: Optional[datetime] = None
    syncFrequency: SyncFrequency = Field(default=SyncFrequency.HOURLY)
    nextSyncAt: Optional[datetime] = None
    syncStatus: Optional[ImportStatus] = None
    webhookUrl: Optional[str] = None
    webhookSecret: Optional[str] = None
    mappingConfig: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    retryCount: int = Field(default=0)
    lastErrorMessage: Optional[str] = None
    lastErrorAt: Optional[datetime] = None


class ChannelConfig(ChannelConfigBase, BaseModel, table=True):
    """Channel Config model"""
    __tablename__ = "ChannelConfig"


class ChannelConfigCreate(SQLModel):
    """Channel Config creation schema"""
    channel: Channel
    displayName: Optional[str] = None
    credentials: Optional[dict] = None
    settings: Optional[dict] = None
    syncFrequency: SyncFrequency = SyncFrequency.HOURLY
    webhookUrl: Optional[str] = None
    mappingConfig: Optional[dict] = None


class ChannelConfigUpdate(SQLModel):
    """Channel Config update schema"""
    displayName: Optional[str] = None
    isActive: Optional[bool] = None
    credentials: Optional[dict] = None
    settings: Optional[dict] = None
    syncFrequency: Optional[SyncFrequency] = None
    webhookUrl: Optional[str] = None
    webhookSecret: Optional[str] = None
    mappingConfig: Optional[dict] = None


class ChannelConfigResponse(ChannelConfigBase):
    """Channel Config response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Order Import
# ============================================================================

class OrderImportBase(SQLModel):
    """Order Import base fields"""
    importNo: str = Field(unique=True, index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    channel: Optional[Channel] = None
    status: ImportStatus = Field(default=ImportStatus.PENDING, index=True)
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None
    totalRows: int = Field(default=0)
    processedRows: int = Field(default=0)
    successRows: int = Field(default=0)
    errorRows: int = Field(default=0)
    errors: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdById: UUID = Field(foreign_key="User.id")


class OrderImport(OrderImportBase, BaseModel, table=True):
    """Order Import model"""
    __tablename__ = "OrderImport"


class OrderImportCreate(SQLModel):
    """Order Import creation schema"""
    locationId: Optional[UUID] = None
    channel: Optional[Channel] = None
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None


class OrderImportUpdate(SQLModel):
    """Order Import update schema"""
    status: Optional[ImportStatus] = None
    totalRows: Optional[int] = None
    processedRows: Optional[int] = None
    successRows: Optional[int] = None
    errorRows: Optional[int] = None
    errors: Optional[dict] = None


class OrderImportResponse(OrderImportBase):
    """Order Import response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


class OrderImportSummary(SQLModel):
    """Order Import summary"""
    pending: int = 0
    inProgress: int = 0
    completed: int = 0
    failed: int = 0
    totalOrders: int = 0
