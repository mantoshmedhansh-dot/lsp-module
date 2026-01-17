"""
Analytics Models: Snapshots, Demand Forecast, Scheduled Reports
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Report Enums
# ============================================================================

class ReportFormat:
    PDF = "PDF"
    EXCEL = "EXCEL"
    CSV = "CSV"


class ReportFrequency:
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"


# ============================================================================
# Analytics Snapshot
# ============================================================================

class AnalyticsSnapshotBase(SQLModel):
    """Analytics Snapshot base fields"""
    snapshotDate: datetime = Field(index=True)
    snapshotType: str = Field(index=True)  # DAILY, WEEKLY, MONTHLY
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    # Order metrics
    totalOrders: int = Field(default=0)
    totalRevenue: Decimal = Field(default=Decimal("0"))
    avgOrderValue: Decimal = Field(default=Decimal("0"))
    totalUnits: int = Field(default=0)
    ordersShipped: int = Field(default=0)
    ordersDelivered: int = Field(default=0)
    ordersCancelled: int = Field(default=0)
    ordersRTO: int = Field(default=0)
    # Fulfillment metrics
    avgFulfillmentTime: Optional[Decimal] = None
    fillRate: Optional[Decimal] = None
    slaBreachedOrders: int = Field(default=0)
    onTimeDeliveryRate: Optional[Decimal] = None
    # Inventory metrics
    totalSKUs: int = Field(default=0)
    totalQuantity: int = Field(default=0)
    lowStockSKUs: int = Field(default=0)
    outOfStockSKUs: int = Field(default=0)
    inventoryValue: Decimal = Field(default=Decimal("0"))
    # Return metrics
    totalReturns: int = Field(default=0)
    returnRate: Optional[Decimal] = None
    rtoRate: Optional[Decimal] = None
    # B2B metrics
    b2bOrders: int = Field(default=0)
    b2bRevenue: Decimal = Field(default=Decimal("0"))
    creditUtilization: Optional[Decimal] = None
    # Breakdown data (JSON)
    channelBreakdown: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    categoryBreakdown: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    transporterBreakdown: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class AnalyticsSnapshot(AnalyticsSnapshotBase, BaseModel, table=True):
    """Analytics Snapshot model"""
    __tablename__ = "AnalyticsSnapshot"


class AnalyticsSnapshotCreate(SQLModel):
    """Analytics Snapshot creation schema"""
    snapshotDate: datetime
    snapshotType: str
    locationId: Optional[UUID] = None


class AnalyticsSnapshotResponse(AnalyticsSnapshotBase):
    """Analytics Snapshot response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Demand Forecast
# ============================================================================

class DemandForecastBase(SQLModel):
    """Demand Forecast base fields"""
    forecastDate: datetime = Field(index=True)
    forecastFor: datetime = Field(index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: Optional[UUID] = Field(default=None, foreign_key="Location.id")
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    predictedDemand: int = Field(default=0)
    lowerBound: int = Field(default=0)
    upperBound: int = Field(default=0)
    confidenceScore: Decimal = Field(default=Decimal("0"))
    suggestedReorder: int = Field(default=0)
    reorderPoint: int = Field(default=0)
    safetyStock: int = Field(default=0)
    modelVersion: Optional[str] = None
    features: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class DemandForecast(DemandForecastBase, BaseModel, table=True):
    """Demand Forecast model"""
    __tablename__ = "DemandForecast"


class DemandForecastCreate(SQLModel):
    """Demand Forecast creation schema"""
    forecastFor: datetime
    locationId: Optional[UUID] = None
    skuId: UUID
    predictedDemand: int
    lowerBound: int = 0
    upperBound: int = 0
    confidenceScore: Decimal = Decimal("0")


class DemandForecastResponse(DemandForecastBase):
    """Demand Forecast response schema"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Scheduled Report
# ============================================================================

class ScheduledReportBase(SQLModel):
    """Scheduled Report base fields"""
    name: str
    description: Optional[str] = None
    reportType: str = Field(index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    frequency: str = Field(index=True)  # DAILY, WEEKLY, MONTHLY, QUARTERLY
    format: str = Field(default="EXCEL")  # PDF, EXCEL, CSV
    recipients: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    filters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    columns: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    sortBy: Optional[str] = None
    sortOrder: Optional[str] = None
    isActive: bool = Field(default=True)
    nextRunAt: Optional[datetime] = None
    lastRunAt: Optional[datetime] = None
    lastRunStatus: Optional[str] = None
    lastRunError: Optional[str] = None
    createdById: UUID = Field(foreign_key="User.id")


class ScheduledReport(ScheduledReportBase, BaseModel, table=True):
    """Scheduled Report model"""
    __tablename__ = "ScheduledReport"


class ScheduledReportCreate(SQLModel):
    """Scheduled Report creation schema"""
    name: str
    description: Optional[str] = None
    reportType: str
    frequency: str
    format: str = "EXCEL"
    recipients: Optional[List[str]] = None
    filters: Optional[dict] = None
    columns: Optional[List[str]] = None
    sortBy: Optional[str] = None
    sortOrder: Optional[str] = None


class ScheduledReportUpdate(SQLModel):
    """Scheduled Report update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    format: Optional[str] = None
    recipients: Optional[List[str]] = None
    filters: Optional[dict] = None
    columns: Optional[List[str]] = None
    sortBy: Optional[str] = None
    sortOrder: Optional[str] = None
    isActive: Optional[bool] = None


class ScheduledReportResponse(ScheduledReportBase):
    """Scheduled Report response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Report Execution
# ============================================================================

class ReportExecutionBase(SQLModel):
    """Report Execution base fields"""
    scheduledReportId: UUID = Field(foreign_key="ScheduledReport.id", index=True)
    status: str = Field(default="PENDING", index=True)
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    fileUrl: Optional[str] = None
    fileSize: Optional[int] = None
    rowCount: Optional[int] = None
    error: Optional[str] = None


class ReportExecution(ReportExecutionBase, BaseModel, table=True):
    """Report Execution model"""
    __tablename__ = "ReportExecution"


class ReportExecutionCreate(SQLModel):
    """Report Execution creation schema"""
    scheduledReportId: UUID


class ReportExecutionResponse(ReportExecutionBase):
    """Report Execution response schema"""
    id: UUID
    createdAt: datetime
