"""
Analytics API v1 - Snapshots, Forecasts, Scheduled Reports, Performance Analytics
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    AnalyticsSnapshot, AnalyticsSnapshotCreate, AnalyticsSnapshotResponse,
    DemandForecast, DemandForecastCreate, DemandForecastResponse,
    ScheduledReport, ScheduledReportCreate, ScheduledReportUpdate, ScheduledReportResponse,
    ReportExecution, ReportExecutionCreate, ReportExecutionResponse,
    CarrierPerformance, CarrierPerformanceResponse,
    PincodePerformance, PincodePerformanceResponse,
    LanePerformance, LanePerformanceResponse,
    Transporter,
    ShipmentType,
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

    query = company_filter.apply_filter(query, AnalyticsSnapshot.companyId)
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

    query = company_filter.apply_filter(query, AnalyticsSnapshot.companyId)
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
    query = company_filter.apply_filter(query, AnalyticsSnapshot.companyId)

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

    query = company_filter.apply_filter(query, DemandForecast.companyId)
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

    query = company_filter.apply_filter(query, DemandForecast.companyId)
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

    query = company_filter.apply_filter(query, ScheduledReport.companyId)
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
    query = company_filter.apply_filter(query, ScheduledReport.companyId)

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
    query = company_filter.apply_filter(query, ScheduledReport.companyId)

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
    query = company_filter.apply_filter(query, ScheduledReport.companyId)

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
    query = company_filter.apply_filter(query, ScheduledReport.companyId)

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


# ============================================================================
# Carrier Performance / Scorecard Endpoints
# ============================================================================

@router.get("/carrier-scorecard", response_model=List[CarrierPerformanceResponse])
def get_carrier_scorecards(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    shipment_type: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get carrier performance scorecards."""
    query = select(CarrierPerformance, Transporter).join(
        Transporter, CarrierPerformance.transporterId == Transporter.id
    )

    query = company_filter.apply_filter(query, CarrierPerformance.companyId)
    if shipment_type and shipment_type != "all":
        query = query.where(CarrierPerformance.shipmentType == shipment_type)
    if transporter_id:
        query = query.where(CarrierPerformance.transporterId == transporter_id)
    if date_from:
        query = query.where(CarrierPerformance.periodStart >= date_from)
    if date_to:
        query = query.where(CarrierPerformance.periodEnd <= date_to)

    query = query.offset(skip).limit(limit).order_by(CarrierPerformance.periodStart.desc())
    results = session.exec(query).all()

    response = []
    for perf, transporter in results:
        perf_dict = perf.model_dump()
        perf_dict["transporterName"] = transporter.name if transporter else None
        perf_dict["transporterCode"] = transporter.code if transporter else None
        response.append(CarrierPerformanceResponse.model_validate(perf_dict))

    return response


@router.get("/carrier-scorecard/summary")
def get_carrier_scorecard_summary(
    shipment_type: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get carrier scorecard summary statistics."""
    query = select(
        func.count(CarrierPerformance.id).label("totalRecords"),
        func.count(func.distinct(CarrierPerformance.transporterId)).label("totalCarriers"),
        func.avg(CarrierPerformance.overallScore).label("avgOverallScore"),
        func.avg(CarrierPerformance.successRate).label("avgSuccessRate"),
        func.avg(CarrierPerformance.onTimeRate).label("avgOnTimeRate"),
        func.avg(CarrierPerformance.rtoRate).label("avgRTORate")
    )

    query = company_filter.apply_filter(query, CarrierPerformance.companyId)
    if shipment_type and shipment_type != "all":
        query = query.where(CarrierPerformance.shipmentType == shipment_type)

    result = session.exec(query).first()

    return {
        "totalRecords": result.totalRecords or 0,
        "totalCarriers": result.totalCarriers or 0,
        "avgOverallScore": float(result.avgOverallScore) if result.avgOverallScore else 0,
        "avgSuccessRate": float(result.avgSuccessRate) if result.avgSuccessRate else 0,
        "avgOnTimeRate": float(result.avgOnTimeRate) if result.avgOnTimeRate else 0,
        "avgRTORate": float(result.avgRTORate) if result.avgRTORate else 0
    }


# ============================================================================
# Pincode Performance Endpoints
# ============================================================================

@router.get("/pincode-performance", response_model=List[PincodePerformanceResponse])
def get_pincode_performance(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    pincode: Optional[str] = None,
    zone: Optional[str] = None,
    risk_level: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get pincode-level performance analytics."""
    query = select(PincodePerformance, Transporter).join(
        Transporter, PincodePerformance.transporterId == Transporter.id
    )

    query = company_filter.apply_filter(query, PincodePerformance.companyId)
    if pincode:
        query = query.where(PincodePerformance.pincode.ilike(f"%{pincode}%"))
    if transporter_id:
        query = query.where(PincodePerformance.transporterId == transporter_id)
    if date_from:
        query = query.where(PincodePerformance.periodStart >= date_from)
    if date_to:
        query = query.where(PincodePerformance.periodEnd <= date_to)

    query = query.offset(skip).limit(limit).order_by(PincodePerformance.periodStart.desc())
    results = session.exec(query).all()

    response = []
    for perf, transporter in results:
        perf_dict = perf.model_dump()
        perf_dict["transporterName"] = transporter.name if transporter else None
        # Calculate risk level based on RTO rate
        rto_rate = float(perf.rtoRate) if perf.rtoRate else 0
        if rto_rate > 20:
            perf_dict["riskLevel"] = "HIGH"
        elif rto_rate > 10:
            perf_dict["riskLevel"] = "MEDIUM"
        else:
            perf_dict["riskLevel"] = "LOW"
        # Determine zone from pincode (first 2-3 digits)
        perf_dict["zone"] = perf.pincode[:2] if perf.pincode else None
        response.append(PincodePerformanceResponse.model_validate(perf_dict))

    # Filter by zone or risk_level after query if provided
    if zone and zone != "all":
        response = [r for r in response if r.zone == zone]
    if risk_level and risk_level != "all":
        response = [r for r in response if r.riskLevel == risk_level]

    return response


@router.get("/pincode-performance/summary")
def get_pincode_performance_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get pincode performance summary statistics."""
    query = select(
        func.count(PincodePerformance.id).label("totalRecords"),
        func.count(func.distinct(PincodePerformance.pincode)).label("totalPincodes"),
        func.avg(PincodePerformance.successRate).label("avgSuccessRate"),
        func.avg(PincodePerformance.rtoRate).label("avgRTORate"),
        func.avg(PincodePerformance.avgTATDays).label("avgTAT")
    )

    query = company_filter.apply_filter(query, PincodePerformance.companyId)

    result = session.exec(query).first()

    return {
        "totalRecords": result.totalRecords or 0,
        "totalPincodes": result.totalPincodes or 0,
        "avgSuccessRate": float(result.avgSuccessRate) if result.avgSuccessRate else 0,
        "avgRTORate": float(result.avgRTORate) if result.avgRTORate else 0,
        "avgTAT": float(result.avgTAT) if result.avgTAT else 0
    }


# ============================================================================
# Lane Performance Endpoints
# ============================================================================

@router.get("/lane-performance", response_model=List[LanePerformanceResponse])
def get_lane_performance(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    shipment_type: Optional[str] = None,
    transporter_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get lane-level performance analytics (FTL/B2B)."""
    query = select(LanePerformance, Transporter).join(
        Transporter, LanePerformance.transporterId == Transporter.id
    )

    query = company_filter.apply_filter(query, LanePerformance.companyId)
    if origin_city and origin_city != "all":
        query = query.where(LanePerformance.originCity.ilike(f"%{origin_city}%"))
    if destination_city and destination_city != "all":
        query = query.where(LanePerformance.destinationCity.ilike(f"%{destination_city}%"))
    if shipment_type and shipment_type != "all":
        query = query.where(LanePerformance.shipmentType == shipment_type)
    if transporter_id:
        query = query.where(LanePerformance.transporterId == transporter_id)
    if date_from:
        query = query.where(LanePerformance.periodStart >= date_from)
    if date_to:
        query = query.where(LanePerformance.periodEnd <= date_to)

    query = query.offset(skip).limit(limit).order_by(LanePerformance.periodStart.desc())
    results = session.exec(query).all()

    response = []
    for perf, transporter in results:
        perf_dict = perf.model_dump()
        perf_dict["transporterName"] = transporter.name if transporter else None
        response.append(LanePerformanceResponse.model_validate(perf_dict))

    return response


@router.get("/lane-performance/summary")
def get_lane_performance_summary(
    shipment_type: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get lane performance summary statistics."""
    query = select(
        func.count(LanePerformance.id).label("totalRecords"),
        func.count(func.distinct(LanePerformance.originCity)).label("totalOrigins"),
        func.count(func.distinct(LanePerformance.destinationCity)).label("totalDestinations"),
        func.avg(LanePerformance.overallScore).label("avgOverallScore"),
        func.avg(LanePerformance.onTimeRate).label("avgOnTimeRate"),
        func.avg(LanePerformance.avgTATDays).label("avgTAT")
    )

    query = company_filter.apply_filter(query, LanePerformance.companyId)
    if shipment_type and shipment_type != "all":
        query = query.where(LanePerformance.shipmentType == shipment_type)

    result = session.exec(query).first()

    return {
        "totalRecords": result.totalRecords or 0,
        "totalOrigins": result.totalOrigins or 0,
        "totalDestinations": result.totalDestinations or 0,
        "avgOverallScore": float(result.avgOverallScore) if result.avgOverallScore else 0,
        "avgOnTimeRate": float(result.avgOnTimeRate) if result.avgOnTimeRate else 0,
        "avgTAT": float(result.avgTAT) if result.avgTAT else 0
    }
