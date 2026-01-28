"""
WMS Inbound Dashboard API v1

Dashboard widgets and reports for WMS Inbound operations.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, text
from sqlalchemy import and_, or_

from app.core.database import get_session
from app.core.deps import get_current_user, CompanyFilter
from app.models import (
    User, Location,
    ExternalPurchaseOrder, ExternalPOItem,
    AdvanceShippingNotice, ASNItem,
    GoodsReceipt, GoodsReceiptItem,
    StockTransferOrder, STOItem,
    Return, ReturnItem,
    Inventory, UploadBatch
)


router = APIRouter(prefix="/wms-dashboard", tags=["WMS Dashboard"])


# ============================================================================
# Dashboard Summary
# ============================================================================

@router.get("/summary")
def get_dashboard_summary(
    location_id: Optional[UUID] = None,
    days: int = Query(7, ge=1, le=90),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get WMS Inbound dashboard summary.
    Returns counts and metrics for all inbound operations.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id
    since = datetime.utcnow() - timedelta(days=days)

    # External PO counts
    po_query = select(func.count(ExternalPurchaseOrder.id)).where(
        ExternalPurchaseOrder.company_id == company_id
    )
    po_pending_query = po_query.where(ExternalPurchaseOrder.status == "OPEN")
    po_received_query = po_query.where(
        ExternalPurchaseOrder.status == "FULLY_RECEIVED",
        ExternalPurchaseOrder.updated_at >= since
    )

    total_pos = session.exec(po_query).one() or 0
    pending_pos = session.exec(po_pending_query).one() or 0
    received_pos = session.exec(po_received_query).one() or 0

    # ASN counts
    asn_query = select(func.count(AdvanceShippingNotice.id)).where(
        AdvanceShippingNotice.company_id == company_id
    )
    if location_id:
        asn_query = asn_query.where(AdvanceShippingNotice.location_id == location_id)

    asn_expected_query = asn_query.where(AdvanceShippingNotice.status == "EXPECTED")
    asn_arrived_query = asn_query.where(AdvanceShippingNotice.status == "ARRIVED")

    total_asns = session.exec(asn_query).one() or 0
    expected_asns = session.exec(asn_expected_query).one() or 0
    arrived_asns = session.exec(asn_arrived_query).one() or 0

    # GRN counts
    grn_query = select(func.count(GoodsReceipt.id)).where(
        GoodsReceipt.companyId == company_id
    )
    if location_id:
        grn_query = grn_query.where(GoodsReceipt.locationId == location_id)

    grn_pending_query = grn_query.where(GoodsReceipt.status == "PENDING")
    grn_posted_query = grn_query.where(
        GoodsReceipt.status == "POSTED",
        GoodsReceipt.updatedAt >= since
    )

    total_grns = session.exec(grn_query).one() or 0
    pending_grns = session.exec(grn_pending_query).one() or 0
    posted_grns = session.exec(grn_posted_query).one() or 0

    # STO counts
    sto_query = select(func.count(StockTransferOrder.id)).where(
        StockTransferOrder.company_id == company_id
    )
    if location_id:
        sto_query = sto_query.where(
            or_(
                StockTransferOrder.source_location_id == location_id,
                StockTransferOrder.destination_location_id == location_id
            )
        )

    sto_pending_query = sto_query.where(StockTransferOrder.status.in_(["DRAFT", "APPROVED", "PICKING"]))
    sto_intransit_query = sto_query.where(StockTransferOrder.status == "IN_TRANSIT")

    total_stos = session.exec(sto_query).one() or 0
    pending_stos = session.exec(sto_pending_query).one() or 0
    intransit_stos = session.exec(sto_intransit_query).one() or 0

    # Return counts
    return_query = select(func.count(Return.id)).where(
        Return.companyId == company_id
    )
    if location_id:
        return_query = return_query.where(Return.locationId == location_id)

    return_pending_query = return_query.where(Return.status.in_(["INITIATED", "IN_TRANSIT"]))
    return_received_query = return_query.where(Return.status == "RECEIVED")
    return_qc_pending_query = return_query.where(
        Return.status == "RECEIVED",
        Return.qcStatus == None
    )

    total_returns = session.exec(return_query).one() or 0
    pending_returns = session.exec(return_pending_query).one() or 0
    received_returns = session.exec(return_received_query).one() or 0
    qc_pending_returns = session.exec(return_qc_pending_query).one() or 0

    return {
        "period_days": days,
        "external_po": {
            "total": total_pos,
            "pending": pending_pos,
            "received_recently": received_pos
        },
        "asn": {
            "total": total_asns,
            "expected": expected_asns,
            "arrived": arrived_asns
        },
        "grn": {
            "total": total_grns,
            "pending": pending_grns,
            "posted_recently": posted_grns
        },
        "stock_transfer": {
            "total": total_stos,
            "pending": pending_stos,
            "in_transit": intransit_stos
        },
        "returns": {
            "total": total_returns,
            "pending": pending_returns,
            "received": received_returns,
            "qc_pending": qc_pending_returns
        }
    }


# ============================================================================
# Pending Actions Widget
# ============================================================================

@router.get("/pending-actions")
def get_pending_actions(
    location_id: Optional[UUID] = None,
    limit: int = Query(10, ge=1, le=50),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of pending actions requiring attention.
    Prioritized by urgency and date.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id
    actions = []

    # Pending GRNs (high priority)
    grn_query = select(GoodsReceipt).where(
        GoodsReceipt.companyId == company_id,
        GoodsReceipt.status == "PENDING"
    )
    if location_id:
        grn_query = grn_query.where(GoodsReceipt.locationId == location_id)
    grn_query = grn_query.order_by(GoodsReceipt.createdAt).limit(limit)

    pending_grns = session.exec(grn_query).all()
    for grn in pending_grns:
        actions.append({
            "type": "GRN_PENDING",
            "priority": "HIGH",
            "id": str(grn.id),
            "reference": grn.grNo,
            "description": f"GRN {grn.grNo} awaiting posting",
            "created_at": grn.createdAt.isoformat() if grn.createdAt else None,
            "action_url": f"/wms/goods-receipt/{grn.id}"
        })

    # Expected ASNs (medium priority)
    asn_query = select(AdvanceShippingNotice).where(
        AdvanceShippingNotice.company_id == company_id,
        AdvanceShippingNotice.status == "EXPECTED"
    )
    if location_id:
        asn_query = asn_query.where(AdvanceShippingNotice.location_id == location_id)
    asn_query = asn_query.order_by(AdvanceShippingNotice.expected_arrival).limit(limit)

    expected_asns = session.exec(asn_query).all()
    for asn in expected_asns:
        is_overdue = asn.expected_arrival and asn.expected_arrival < datetime.utcnow()
        actions.append({
            "type": "ASN_EXPECTED",
            "priority": "HIGH" if is_overdue else "MEDIUM",
            "id": str(asn.id),
            "reference": asn.asn_no,
            "description": f"ASN {asn.asn_no} expected" + (" (OVERDUE)" if is_overdue else ""),
            "expected_at": asn.expected_arrival.isoformat() if asn.expected_arrival else None,
            "action_url": f"/wms/asn/{asn.id}"
        })

    # Returns pending QC
    return_query = select(Return).where(
        Return.companyId == company_id,
        Return.status == "RECEIVED",
        Return.qcStatus == None
    )
    if location_id:
        return_query = return_query.where(Return.locationId == location_id)
    return_query = return_query.order_by(Return.receivedAt).limit(limit)

    qc_pending_returns = session.exec(return_query).all()
    for ret in qc_pending_returns:
        actions.append({
            "type": "RETURN_QC_PENDING",
            "priority": "MEDIUM",
            "id": str(ret.id),
            "reference": ret.returnNo,
            "description": f"Return {ret.returnNo} awaiting QC",
            "received_at": ret.receivedAt.isoformat() if ret.receivedAt else None,
            "action_url": f"/returns/{ret.id}"
        })

    # STOs in transit
    sto_query = select(StockTransferOrder).where(
        StockTransferOrder.company_id == company_id,
        StockTransferOrder.status == "IN_TRANSIT"
    )
    if location_id:
        sto_query = sto_query.where(StockTransferOrder.destination_location_id == location_id)
    sto_query = sto_query.order_by(StockTransferOrder.shipped_date).limit(limit)

    intransit_stos = session.exec(sto_query).all()
    for sto in intransit_stos:
        actions.append({
            "type": "STO_IN_TRANSIT",
            "priority": "LOW",
            "id": str(sto.id),
            "reference": sto.sto_no,
            "description": f"STO {sto.sto_no} in transit, awaiting receipt",
            "shipped_at": sto.shipped_date.isoformat() if sto.shipped_date else None,
            "action_url": f"/wms/stock-transfer/{sto.id}"
        })

    # Sort by priority
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    actions.sort(key=lambda x: priority_order.get(x["priority"], 99))

    return {
        "total": len(actions),
        "actions": actions[:limit]
    }


# ============================================================================
# Inbound Trend Chart
# ============================================================================

@router.get("/inbound-trend")
def get_inbound_trend(
    location_id: Optional[UUID] = None,
    days: int = Query(30, ge=7, le=90),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get daily inbound trend data for charts.
    Returns daily counts of GRNs posted and units received.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id
    since = datetime.utcnow() - timedelta(days=days)

    # Get posted GRNs with quantities
    grn_query = select(GoodsReceipt).where(
        GoodsReceipt.companyId == company_id,
        GoodsReceipt.status == "POSTED",
        GoodsReceipt.updatedAt >= since
    )
    if location_id:
        grn_query = grn_query.where(GoodsReceipt.locationId == location_id)

    grns = session.exec(grn_query).all()

    # Aggregate by date
    daily_data: Dict[str, Dict] = {}
    for i in range(days):
        date = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_data[date] = {"date": date, "grn_count": 0, "units_received": 0}

    for grn in grns:
        if grn.updatedAt:
            date_key = grn.updatedAt.strftime("%Y-%m-%d")
            if date_key in daily_data:
                daily_data[date_key]["grn_count"] += 1
                daily_data[date_key]["units_received"] += grn.totalAcceptedQty or 0

    # Convert to sorted list
    trend = sorted(daily_data.values(), key=lambda x: x["date"])

    return {
        "period_days": days,
        "data": trend
    }


# ============================================================================
# Inbound by Source Type
# ============================================================================

@router.get("/inbound-by-source")
def get_inbound_by_source(
    location_id: Optional[UUID] = None,
    days: int = Query(30, ge=1, le=90),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get inbound breakdown by source type.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id
    since = datetime.utcnow() - timedelta(days=days)

    grn_query = select(GoodsReceipt).where(
        GoodsReceipt.companyId == company_id,
        GoodsReceipt.status == "POSTED",
        GoodsReceipt.updatedAt >= since
    )
    if location_id:
        grn_query = grn_query.where(GoodsReceipt.locationId == location_id)

    grns = session.exec(grn_query).all()

    by_source: Dict[str, Dict] = {}
    for grn in grns:
        source = grn.inboundSource or "PURCHASE"
        if source not in by_source:
            by_source[source] = {"source": source, "count": 0, "units": 0}
        by_source[source]["count"] += 1
        by_source[source]["units"] += grn.totalAcceptedQty or 0

    return {
        "period_days": days,
        "data": list(by_source.values())
    }


# ============================================================================
# Recent Activity Feed
# ============================================================================

@router.get("/recent-activity")
def get_recent_activity(
    location_id: Optional[UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent inbound activity feed.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id
    activities = []

    # Recent GRNs
    grn_query = select(GoodsReceipt).where(
        GoodsReceipt.companyId == company_id
    )
    if location_id:
        grn_query = grn_query.where(GoodsReceipt.locationId == location_id)
    grn_query = grn_query.order_by(GoodsReceipt.updatedAt.desc()).limit(limit)

    for grn in session.exec(grn_query).all():
        activities.append({
            "type": "GRN",
            "id": str(grn.id),
            "reference": grn.grNo,
            "status": grn.status,
            "description": f"GRN {grn.grNo} - {grn.status}",
            "timestamp": grn.updatedAt.isoformat() if grn.updatedAt else None,
            "units": grn.totalAcceptedQty or 0
        })

    # Recent ASN arrivals
    asn_query = select(AdvanceShippingNotice).where(
        AdvanceShippingNotice.company_id == company_id,
        AdvanceShippingNotice.status.in_(["ARRIVED", "RECEIVED"])
    )
    if location_id:
        asn_query = asn_query.where(AdvanceShippingNotice.location_id == location_id)
    asn_query = asn_query.order_by(AdvanceShippingNotice.updated_at.desc()).limit(limit)

    for asn in session.exec(asn_query).all():
        activities.append({
            "type": "ASN",
            "id": str(asn.id),
            "reference": asn.asn_no,
            "status": asn.status,
            "description": f"ASN {asn.asn_no} - {asn.status}",
            "timestamp": asn.updated_at.isoformat() if asn.updated_at else None,
            "units": asn.total_received_qty or 0
        })

    # Recent STOs received
    sto_query = select(StockTransferOrder).where(
        StockTransferOrder.company_id == company_id,
        StockTransferOrder.status == "RECEIVED"
    )
    if location_id:
        sto_query = sto_query.where(StockTransferOrder.destination_location_id == location_id)
    sto_query = sto_query.order_by(StockTransferOrder.received_date.desc()).limit(limit)

    for sto in session.exec(sto_query).all():
        activities.append({
            "type": "STO",
            "id": str(sto.id),
            "reference": sto.sto_no,
            "status": sto.status,
            "description": f"STO {sto.sto_no} received",
            "timestamp": sto.received_date.isoformat() if sto.received_date else None,
            "units": sto.total_received_qty or 0
        })

    # Sort by timestamp
    activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "activities": activities[:limit]
    }


# ============================================================================
# Upload Summary Widget
# ============================================================================

@router.get("/upload-summary")
def get_upload_summary(
    days: int = Query(7, ge=1, le=30),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get summary of recent bulk uploads.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id
    since = datetime.utcnow() - timedelta(days=days)

    query = select(UploadBatch).where(
        UploadBatch.company_id == company_id,
        UploadBatch.created_at >= since
    ).order_by(UploadBatch.created_at.desc())

    batches = session.exec(query).all()

    by_type: Dict[str, Dict] = {}
    total_rows = 0
    total_success = 0
    total_errors = 0

    for batch in batches:
        upload_type = batch.upload_type
        if upload_type not in by_type:
            by_type[upload_type] = {
                "type": upload_type,
                "count": 0,
                "total_rows": 0,
                "success_rows": 0,
                "error_rows": 0
            }

        by_type[upload_type]["count"] += 1
        by_type[upload_type]["total_rows"] += batch.total_rows
        by_type[upload_type]["success_rows"] += batch.success_rows
        by_type[upload_type]["error_rows"] += batch.error_rows

        total_rows += batch.total_rows
        total_success += batch.success_rows
        total_errors += batch.error_rows

    return {
        "period_days": days,
        "total_batches": len(batches),
        "total_rows": total_rows,
        "success_rows": total_success,
        "error_rows": total_errors,
        "success_rate": round(total_success / total_rows * 100, 1) if total_rows > 0 else 0,
        "by_type": list(by_type.values())
    }


# ============================================================================
# Inbound Report
# ============================================================================

@router.get("/report/inbound")
def get_inbound_report(
    location_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    inbound_source: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed inbound report with filtering.
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    company_id = company_filter.company_id

    # Default date range: last 30 days
    if not date_to:
        date_to = datetime.utcnow()
    if not date_from:
        date_from = date_to - timedelta(days=30)

    # Query GRNs
    grn_query = select(GoodsReceipt).where(
        GoodsReceipt.companyId == company_id,
        GoodsReceipt.status == "POSTED",
        GoodsReceipt.updatedAt >= date_from,
        GoodsReceipt.updatedAt <= date_to
    )
    if location_id:
        grn_query = grn_query.where(GoodsReceipt.locationId == location_id)
    if inbound_source:
        grn_query = grn_query.where(GoodsReceipt.inboundSource == inbound_source)

    grn_query = grn_query.order_by(GoodsReceipt.updatedAt.desc())
    grns = session.exec(grn_query).all()

    # Build report data
    report_items = []
    total_grns = 0
    total_units = 0
    total_skus = 0

    for grn in grns:
        # Get location name
        location = session.get(Location, grn.locationId)
        location_name = location.name if location else "Unknown"

        # Get item count
        items_query = select(func.count(GoodsReceiptItem.id)).where(
            GoodsReceiptItem.goodsReceiptId == grn.id
        )
        item_count = session.exec(items_query).one() or 0

        report_items.append({
            "grn_id": str(grn.id),
            "grn_no": grn.grNo,
            "location_name": location_name,
            "inbound_source": grn.inboundSource or "PURCHASE",
            "posted_at": grn.updatedAt.isoformat() if grn.updatedAt else None,
            "total_skus": item_count,
            "total_units": grn.totalAcceptedQty or 0,
            "vehicle_number": grn.vehicleNumber,
            "remarks": grn.remarks
        })

        total_grns += 1
        total_units += grn.totalAcceptedQty or 0
        total_skus += item_count

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "summary": {
            "total_grns": total_grns,
            "total_units": total_units,
            "total_sku_lines": total_skus
        },
        "items": report_items
    }
