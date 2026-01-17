"""
Analytics API v1 - Snapshots, Forecasts, Scheduled Reports
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    AnalyticsSnapshot, AnalyticsSnapshotCreate, AnalyticsSnapshotResponse,
    DemandForecast, DemandForecastCreate, DemandForecastResponse,
    ScheduledReport, ScheduledReportCreate, ScheduledReportUpdate, ScheduledReportResponse,
    ReportExecution, ReportExecutionCreate, ReportExecutionResponse,
    User
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ============================================================================
# Analytics Snapshot Endpoints
# ============================================================================

@router.get("/snapshots", response_model=List[AnalyticsSnapshotResponse])
def list_snapshots(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    snapshot_type: Optional[str] = None,
    location_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List analytics snapshots."""
    query = select(AnalyticsSnapshot)

    if company_filter.company_id:
        query = query.where(AnalyticsSnapshot.companyId == company_filter.company_id)
    if snapshot_type:
        query = query.where(AnalyticsSnapshot.snapshotType == snapshot_type)
    if location_id:
        query = query.where(AnalyticsSnapshot.locationId == location_id)
    if date_from:
        query = query.where(AnalyticsSnapshot.snapshotDate >= date_from)
    if date_to:
        query = query.where(AnalyticsSnapshot.snapshotDate <= date_to)

    query = query.offset(skip).limit(limit).order_by(AnalyticsSnapshot.snapshotDate.desc())
    snapshots = session.exec(query).all()
    return [AnalyticsSnapshotResponse.model_validate(s) for s in snapshots]


@router.get("/snapshots/latest", response_model=AnalyticsSnapshotResponse)
def get_latest_snapshot(
    snapshot_type: str = "DAILY",
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get latest analytics snapshot."""
    query = select(AnalyticsSnapshot).where(
        AnalyticsSnapshot.snapshotType == snapshot_type
    )

    if company_filter.company_id:
        query = query.where(AnalyticsSnapshot.companyId == company_filter.company_id)
    if location_id:
        query = query.where(AnalyticsSnapshot.locationId == location_id)

    query = query.order_by(AnalyticsSnapshot.snapshotDate.desc()).limit(1)
    snapshot = session.exec(query).first()

    if not snapshot:
        raise HTTPException(status_code=404, detail="No snapshot found")
    return AnalyticsSnapshotResponse.model_validate(snapshot)


@router.get("/snapshots/{snapshot_id}", response_model=AnalyticsSnapshotResponse)
def get_snapshot(
    snapshot_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get snapshot by ID."""
    query = select(AnalyticsSnapshot).where(AnalyticsSnapshot.id == snapshot_id)
    if company_filter.company_id:
        query = query.where(AnalyticsSnapshot.companyId == company_filter.company_id)

    snapshot = session.exec(query).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return AnalyticsSnapshotResponse.model_validate(snapshot)


# ============================================================================
# Demand Forecast Endpoints
# ============================================================================

@router.get("/forecasts", response_model=List[DemandForecastResponse])
def list_forecasts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    forecast_from: Optional[datetime] = None,
    forecast_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List demand forecasts."""
    query = select(DemandForecast)

    if company_filter.company_id:
        query = query.where(DemandForecast.companyId == company_filter.company_id)
    if sku_id:
        query = query.where(DemandForecast.skuId == sku_id)
    if location_id:
        query = query.where(DemandForecast.locationId == location_id)
    if forecast_from:
        query = query.where(DemandForecast.forecastFor >= forecast_from)
    if forecast_to:
        query = query.where(DemandForecast.forecastFor <= forecast_to)

    query = query.offset(skip).limit(limit).order_by(DemandForecast.forecastFor.desc())
    forecasts = session.exec(query).all()
    return [DemandForecastResponse.model_validate(f) for f in forecasts]


@router.get("/forecasts/sku/{sku_id}", response_model=List[DemandForecastResponse])
def get_sku_forecasts(
    sku_id: UUID,
    days_ahead: int = Query(30, ge=1, le=365),
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get forecasts for a specific SKU."""
    query = select(DemandForecast).where(
        DemandForecast.skuId == sku_id,
        DemandForecast.forecastFor >= datetime.utcnow()
    )

    if company_filter.company_id:
        query = query.where(DemandForecast.companyId == company_filter.company_id)
    if location_id:
        query = query.where(DemandForecast.locationId == location_id)

    query = query.order_by(DemandForecast.forecastFor).limit(days_ahead)
    forecasts = session.exec(query).all()
    return [DemandForecastResponse.model_validate(f) for f in forecasts]


# ============================================================================
# Scheduled Report Endpoints
# ============================================================================

@router.get("/reports", response_model=List[ScheduledReportResponse])
def list_scheduled_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    report_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List scheduled reports."""
    query = select(ScheduledReport)

    if company_filter.company_id:
        query = query.where(ScheduledReport.companyId == company_filter.company_id)
    if report_type:
        query = query.where(ScheduledReport.reportType == report_type)
    if is_active is not None:
        query = query.where(ScheduledReport.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(ScheduledReport.name)
    reports = session.exec(query).all()
    return [ScheduledReportResponse.model_validate(r) for r in reports]


@router.get("/reports/{report_id}", response_model=ScheduledReportResponse)
def get_scheduled_report(
    report_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get scheduled report by ID."""
    query = select(ScheduledReport).where(ScheduledReport.id == report_id)
    if company_filter.company_id:
        query = query.where(ScheduledReport.companyId == company_filter.company_id)

    report = session.exec(query).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ScheduledReportResponse.model_validate(report)


@router.post("/reports", response_model=ScheduledReportResponse, status_code=status.HTTP_201_CREATED)
def create_scheduled_report(
    data: ScheduledReportCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create scheduled report."""
    report = ScheduledReport(
        companyId=company_filter.company_id,
        createdById=current_user.id,
        **data.model_dump()
    )

    session.add(report)
    session.commit()
    session.refresh(report)
    return ScheduledReportResponse.model_validate(report)


@router.patch("/reports/{report_id}", response_model=ScheduledReportResponse)
def update_scheduled_report(
    report_id: UUID,
    data: ScheduledReportUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update scheduled report."""
    query = select(ScheduledReport).where(ScheduledReport.id == report_id)
    if company_filter.company_id:
        query = query.where(ScheduledReport.companyId == company_filter.company_id)

    report = session.exec(query).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)

    session.add(report)
    session.commit()
    session.refresh(report)
    return ScheduledReportResponse.model_validate(report)


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scheduled_report(
    report_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete scheduled report."""
    query = select(ScheduledReport).where(ScheduledReport.id == report_id)
    if company_filter.company_id:
        query = query.where(ScheduledReport.companyId == company_filter.company_id)

    report = session.exec(query).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    session.delete(report)
    session.commit()


@router.post("/reports/{report_id}/run", response_model=ReportExecutionResponse)
def run_scheduled_report(
    report_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Manually run a scheduled report."""
    query = select(ScheduledReport).where(ScheduledReport.id == report_id)
    if company_filter.company_id:
        query = query.where(ScheduledReport.companyId == company_filter.company_id)

    report = session.exec(query).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Create execution record
    execution = ReportExecution(
        scheduledReportId=report_id,
        status="PENDING"
    )

    session.add(execution)
    session.commit()
    session.refresh(execution)
    return ReportExecutionResponse.model_validate(execution)


# ============================================================================
# Report Execution Endpoints
# ============================================================================

@router.get("/reports/{report_id}/executions", response_model=List[ReportExecutionResponse])
def list_report_executions(
    report_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List report executions."""
    query = select(ReportExecution).where(
        ReportExecution.scheduledReportId == report_id
    ).offset(skip).limit(limit).order_by(ReportExecution.createdAt.desc())

    executions = session.exec(query).all()
    return [ReportExecutionResponse.model_validate(e) for e in executions]


@router.get("/executions/{execution_id}", response_model=ReportExecutionResponse)
def get_report_execution(
    execution_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get report execution by ID."""
    execution = session.get(ReportExecution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return ReportExecutionResponse.model_validate(execution)
