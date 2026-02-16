"""
Analytics Aggregation Service — Phase 2: Logistics Intelligence

Reads Delivery + Shipment records and upserts into CarrierPerformance,
LanePerformance, and PincodePerformance tables for analytics dashboards.
"""
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, Dict, List, Any
from uuid import UUID

from sqlmodel import Session, select, func, col
from sqlalchemy import and_, case, extract

from app.models.order import Order, Delivery
from app.models.shipment import Shipment
from app.models.shipping_allocation import (
    CarrierPerformance,
    LanePerformance,
    PincodePerformance,
)
from app.models.transporter import Transporter
from app.models.enums import DeliveryStatus, ShipmentType

logger = logging.getLogger(__name__)

# Terminal delivered statuses
_DELIVERED = {DeliveryStatus.DELIVERED.value}
_RTO = {DeliveryStatus.RTO_DELIVERED.value, DeliveryStatus.RTO_INITIATED.value, DeliveryStatus.RTO_IN_TRANSIT.value}
_TERMINAL = _DELIVERED | _RTO | {DeliveryStatus.CANCELLED.value}


def _clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> Decimal:
    return Decimal(str(round(max(lo, min(hi, val)), 2)))


def _safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


def _compute_scores(
    total: int,
    delivered: int,
    rto: int,
    on_time: int,
    avg_tat: float,
    avg_cost: float,
) -> Dict[str, Decimal]:
    """Compute performance scores (0-100) from raw metrics."""
    success_rate = _safe_div(delivered, total) * 100
    rto_rate = _safe_div(rto, total) * 100
    on_time_rate = _safe_div(on_time, delivered) * 100 if delivered else 0.0

    speed_score = max(0.0, 100.0 - (avg_tat - 5.0) * 10.0)
    speed_score = min(100.0, speed_score)

    cost_score = max(0.0, 100.0 - (avg_cost - 100.0) / 100.0 * 50.0)
    cost_score = min(100.0, cost_score)

    reliability_score = success_rate * 0.6 + on_time_rate * 0.4
    overall_score = cost_score * 0.3 + speed_score * 0.3 + reliability_score * 0.4

    return {
        "successRate": _clamp(success_rate),
        "rtoRate": _clamp(rto_rate),
        "onTimeRate": _clamp(on_time_rate),
        "speedScore": _clamp(speed_score),
        "costScore": _clamp(cost_score),
        "reliabilityScore": _clamp(reliability_score),
        "overallScore": _clamp(overall_score),
    }


class AnalyticsAggregator:
    """
    Central service for aggregating delivery/shipment data
    into the 3 analytics tables (Carrier, Lane, Pincode).
    """

    @staticmethod
    def aggregate_carrier_performance(
        session: Session,
        company_id: UUID,
        period_start: datetime,
        period_end: datetime,
        shipment_type: ShipmentType = ShipmentType.B2C,
    ) -> int:
        """
        Aggregate carrier performance from Delivery + Shipment tables.
        Groups by transporterId. Returns count of records upserted.
        """
        # ---- Gather Delivery stats ----
        delivery_stats = _query_delivery_carrier_stats(
            session, company_id, period_start, period_end
        )

        # ---- Gather Shipment stats ----
        shipment_stats = _query_shipment_carrier_stats(
            session, company_id, period_start, period_end
        )

        # ---- Merge by transporterId ----
        merged: Dict[UUID, Dict[str, Any]] = {}
        for tid, stats in {**delivery_stats, **shipment_stats}.items():
            if tid not in merged:
                merged[tid] = {
                    "total": 0, "delivered": 0, "rto": 0,
                    "on_time": 0, "tat_sum": 0.0, "cost_sum": 0.0,
                    "weight_sum": 0.0,
                }
            m = merged[tid]
            m["total"] += stats.get("total", 0)
            m["delivered"] += stats.get("delivered", 0)
            m["rto"] += stats.get("rto", 0)
            m["on_time"] += stats.get("on_time", 0)
            m["tat_sum"] += stats.get("tat_sum", 0.0)
            m["cost_sum"] += stats.get("cost_sum", 0.0)
            m["weight_sum"] += stats.get("weight_sum", 0.0)

        # Also merge from source if same key
        for tid, stats in shipment_stats.items():
            if tid in merged and tid in delivery_stats:
                pass  # already merged above
            elif tid not in merged:
                merged[tid] = stats

        count = 0
        for transporter_id, m in merged.items():
            total = m["total"]
            delivered = m["delivered"]
            rto = m["rto"]
            on_time = m["on_time"]
            avg_tat = _safe_div(m["tat_sum"], delivered) if delivered else 0.0
            avg_cost_per_kg = _safe_div(m["cost_sum"], m["weight_sum"]) if m["weight_sum"] else 0.0

            scores = _compute_scores(total, delivered, rto, on_time, avg_tat, avg_cost_per_kg)

            # Upsert
            existing = session.exec(
                select(CarrierPerformance).where(
                    CarrierPerformance.transporterId == transporter_id,
                    CarrierPerformance.companyId == company_id,
                    CarrierPerformance.periodStart == period_start,
                    CarrierPerformance.periodEnd == period_end,
                    CarrierPerformance.shipmentType == shipment_type,
                )
            ).first()

            if existing:
                existing.totalShipments = total
                existing.deliveredShipments = delivered
                existing.rtoShipments = rto
                existing.avgTATDays = Decimal(str(round(avg_tat, 2)))
                existing.avgCostPerKg = Decimal(str(round(avg_cost_per_kg, 2)))
                existing.successRate = scores["successRate"]
                existing.rtoRate = scores["rtoRate"]
                existing.onTimeRate = scores["onTimeRate"]
                existing.costScore = scores["costScore"]
                existing.speedScore = scores["speedScore"]
                existing.reliabilityScore = scores["reliabilityScore"]
                existing.overallScore = scores["overallScore"]
                session.add(existing)
            else:
                record = CarrierPerformance(
                    transporterId=transporter_id,
                    companyId=company_id,
                    periodStart=period_start,
                    periodEnd=period_end,
                    shipmentType=shipment_type,
                    totalShipments=total,
                    deliveredShipments=delivered,
                    rtoShipments=rto,
                    avgTATDays=Decimal(str(round(avg_tat, 2))),
                    avgCostPerKg=Decimal(str(round(avg_cost_per_kg, 2))),
                    successRate=scores["successRate"],
                    rtoRate=scores["rtoRate"],
                    onTimeRate=scores["onTimeRate"],
                    costScore=scores["costScore"],
                    speedScore=scores["speedScore"],
                    reliabilityScore=scores["reliabilityScore"],
                    overallScore=scores["overallScore"],
                )
                session.add(record)
            count += 1

        session.flush()
        logger.info(f"Carrier performance: upserted {count} records for company {company_id}")
        return count

    @staticmethod
    def aggregate_lane_performance(
        session: Session,
        company_id: UUID,
        period_start: datetime,
        period_end: datetime,
        shipment_type: ShipmentType = ShipmentType.B2C,
    ) -> int:
        """
        Aggregate lane performance by origin_city + destination_city + transporterId.
        Returns count of records upserted.
        """
        lane_stats = _query_delivery_lane_stats(
            session, company_id, period_start, period_end
        )

        count = 0
        for key, m in lane_stats.items():
            origin_city, dest_city, transporter_id = key
            total = m["total"]
            delivered = m["delivered"]
            on_time = m["on_time"]
            avg_tat = _safe_div(m["tat_sum"], delivered) if delivered else 0.0
            avg_cost = _safe_div(m["cost_sum"], total) if total else 0.0

            scores = _compute_scores(total, delivered, 0, on_time, avg_tat, avg_cost)

            existing = session.exec(
                select(LanePerformance).where(
                    LanePerformance.transporterId == transporter_id,
                    LanePerformance.companyId == company_id,
                    LanePerformance.originCity == origin_city,
                    LanePerformance.destinationCity == dest_city,
                    LanePerformance.periodStart == period_start,
                    LanePerformance.periodEnd == period_end,
                    LanePerformance.shipmentType == shipment_type,
                )
            ).first()

            if existing:
                existing.totalShipments = total
                existing.deliveredShipments = delivered
                existing.avgTATDays = Decimal(str(round(avg_tat, 2)))
                existing.avgCost = Decimal(str(round(avg_cost, 2)))
                existing.onTimeRate = scores["onTimeRate"]
                existing.costScore = scores["costScore"]
                existing.speedScore = scores["speedScore"]
                existing.reliabilityScore = scores["reliabilityScore"]
                existing.overallScore = scores["overallScore"]
                session.add(existing)
            else:
                record = LanePerformance(
                    transporterId=transporter_id,
                    companyId=company_id,
                    originCity=origin_city,
                    destinationCity=dest_city,
                    shipmentType=shipment_type,
                    periodStart=period_start,
                    periodEnd=period_end,
                    totalShipments=total,
                    deliveredShipments=delivered,
                    avgTATDays=Decimal(str(round(avg_tat, 2))),
                    avgCost=Decimal(str(round(avg_cost, 2))),
                    onTimeRate=scores["onTimeRate"],
                    costScore=scores["costScore"],
                    speedScore=scores["speedScore"],
                    reliabilityScore=scores["reliabilityScore"],
                    overallScore=scores["overallScore"],
                )
                session.add(record)
            count += 1

        session.flush()
        logger.info(f"Lane performance: upserted {count} records for company {company_id}")
        return count

    @staticmethod
    def aggregate_pincode_performance(
        session: Session,
        company_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> int:
        """
        Aggregate pincode performance by pincode + transporterId.
        Returns count of records upserted.
        """
        pincode_stats = _query_shipment_pincode_stats(
            session, company_id, period_start, period_end
        )

        count = 0
        for key, m in pincode_stats.items():
            pincode, transporter_id = key
            total = m["total"]
            delivered = m["delivered"]
            rto = m["rto"]
            on_time = m["on_time"]
            avg_tat = _safe_div(m["tat_sum"], delivered) if delivered else 0.0
            avg_cost = _safe_div(m["cost_sum"], total) if total else 0.0

            scores = _compute_scores(total, delivered, rto, on_time, avg_tat, avg_cost)

            existing = session.exec(
                select(PincodePerformance).where(
                    PincodePerformance.transporterId == transporter_id,
                    PincodePerformance.companyId == company_id,
                    PincodePerformance.pincode == pincode,
                    PincodePerformance.periodStart == period_start,
                    PincodePerformance.periodEnd == period_end,
                )
            ).first()

            if existing:
                existing.totalShipments = total
                existing.deliveredShipments = delivered
                existing.rtoShipments = rto
                existing.avgTATDays = Decimal(str(round(avg_tat, 2)))
                existing.avgCost = Decimal(str(round(avg_cost, 2)))
                existing.successRate = scores["successRate"]
                existing.rtoRate = scores["rtoRate"]
                existing.onTimeRate = scores["onTimeRate"]
                existing.costScore = scores["costScore"]
                existing.speedScore = scores["speedScore"]
                existing.reliabilityScore = scores["reliabilityScore"]
                existing.overallScore = scores["overallScore"]
                session.add(existing)
            else:
                record = PincodePerformance(
                    transporterId=transporter_id,
                    companyId=company_id,
                    pincode=pincode,
                    periodStart=period_start,
                    periodEnd=period_end,
                    totalShipments=total,
                    deliveredShipments=delivered,
                    rtoShipments=rto,
                    avgTATDays=Decimal(str(round(avg_tat, 2))),
                    avgCost=Decimal(str(round(avg_cost, 2))),
                    successRate=scores["successRate"],
                    rtoRate=scores["rtoRate"],
                    onTimeRate=scores["onTimeRate"],
                    costScore=scores["costScore"],
                    speedScore=scores["speedScore"],
                    reliabilityScore=scores["reliabilityScore"],
                    overallScore=scores["overallScore"],
                )
                session.add(record)
            count += 1

        session.flush()
        logger.info(f"Pincode performance: upserted {count} records for company {company_id}")
        return count

    @staticmethod
    def aggregate_all(
        session: Session,
        company_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> Dict[str, int]:
        """Run all 3 aggregations for a company + period."""
        carrier_count = AnalyticsAggregator.aggregate_carrier_performance(
            session, company_id, period_start, period_end, ShipmentType.B2C
        )
        lane_count = AnalyticsAggregator.aggregate_lane_performance(
            session, company_id, period_start, period_end, ShipmentType.B2C
        )
        pincode_count = AnalyticsAggregator.aggregate_pincode_performance(
            session, company_id, period_start, period_end
        )

        session.commit()
        return {
            "carrier_records": carrier_count,
            "lane_records": lane_count,
            "pincode_records": pincode_count,
        }

    @staticmethod
    def aggregate_for_delivery(
        session: Session,
        delivery_id: UUID,
    ) -> Dict[str, int]:
        """
        Incremental aggregation for a single delivery.
        Re-aggregates the last 30 days for the delivery's carrier + pincode + lane.
        """
        delivery = session.exec(
            select(Delivery).where(Delivery.id == delivery_id)
        ).first()
        if not delivery or not delivery.transporterId:
            return {"carrier_records": 0, "lane_records": 0, "pincode_records": 0}

        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=30)
        period_end = now

        return AnalyticsAggregator.aggregate_all(
            session, delivery.companyId, period_start, period_end
        )


# ============================================================================
# Internal query helpers
# ============================================================================

def _query_delivery_carrier_stats(
    session: Session,
    company_id: UUID,
    period_start: datetime,
    period_end: datetime,
) -> Dict[UUID, Dict[str, Any]]:
    """Query Delivery table for per-carrier aggregated stats."""
    deliveries = session.exec(
        select(Delivery).where(
            Delivery.companyId == company_id,
            Delivery.transporterId.isnot(None),
            Delivery.createdAt >= period_start,
            Delivery.createdAt <= period_end,
        )
    ).all()

    stats: Dict[UUID, Dict[str, Any]] = {}
    for d in deliveries:
        tid = d.transporterId
        if tid not in stats:
            stats[tid] = {
                "total": 0, "delivered": 0, "rto": 0,
                "on_time": 0, "tat_sum": 0.0, "cost_sum": 0.0,
                "weight_sum": 0.0,
            }
        s = stats[tid]
        s["total"] += 1

        status_val = d.status.value if hasattr(d.status, 'value') else str(d.status)

        if status_val in _DELIVERED:
            s["delivered"] += 1
            # TAT calculation
            if d.shipDate and d.deliveryDate:
                tat_days = (d.deliveryDate - d.shipDate).total_seconds() / 86400.0
                s["tat_sum"] += max(0, tat_days)
                # On-time: <= 7 days considered on time (configurable)
                if tat_days <= 7.0:
                    s["on_time"] += 1

        if status_val in _RTO:
            s["rto"] += 1

        if d.weight:
            s["weight_sum"] += float(d.weight)

    return stats


def _query_shipment_carrier_stats(
    session: Session,
    company_id: UUID,
    period_start: datetime,
    period_end: datetime,
) -> Dict[UUID, Dict[str, Any]]:
    """Query Shipment table for per-carrier aggregated stats."""
    shipments = session.exec(
        select(Shipment).where(
            Shipment.companyId == company_id,
            Shipment.transporterId.isnot(None),
            Shipment.createdAt >= period_start,
            Shipment.createdAt <= period_end,
        )
    ).all()

    stats: Dict[UUID, Dict[str, Any]] = {}
    for sh in shipments:
        tid = sh.transporterId
        if tid not in stats:
            stats[tid] = {
                "total": 0, "delivered": 0, "rto": 0,
                "on_time": 0, "tat_sum": 0.0, "cost_sum": 0.0,
                "weight_sum": 0.0,
            }
        s = stats[tid]
        s["total"] += 1

        status_val = sh.status.value if hasattr(sh.status, 'value') else str(sh.status)

        if status_val in _DELIVERED:
            s["delivered"] += 1
            if sh.shipDate and sh.deliveredDate:
                tat_days = (sh.deliveredDate - sh.shipDate).total_seconds() / 86400.0
                s["tat_sum"] += max(0, tat_days)
                if tat_days <= 7.0:
                    s["on_time"] += 1

        if status_val in _RTO:
            s["rto"] += 1

        if sh.shippingCharge:
            s["cost_sum"] += float(sh.shippingCharge)
        if sh.weight:
            s["weight_sum"] += float(sh.weight)

    return stats


def _query_delivery_lane_stats(
    session: Session,
    company_id: UUID,
    period_start: datetime,
    period_end: datetime,
) -> Dict[tuple, Dict[str, Any]]:
    """Query Delivery+Order for per-lane stats (origin city + dest city + carrier)."""
    # Join Delivery with Order to get shipping address
    from sqlalchemy.orm import joinedload

    deliveries = session.exec(
        select(Delivery).where(
            Delivery.companyId == company_id,
            Delivery.transporterId.isnot(None),
            Delivery.orderId.isnot(None),
            Delivery.createdAt >= period_start,
            Delivery.createdAt <= period_end,
        )
    ).all()

    stats: Dict[tuple, Dict[str, Any]] = {}
    for d in deliveries:
        # Get order for address info
        order = session.exec(
            select(Order).where(Order.id == d.orderId)
        ).first()
        if not order:
            continue

        # Extract cities from order addresses
        dest_city = ""
        if order.shippingAddress and isinstance(order.shippingAddress, dict):
            dest_city = order.shippingAddress.get("city", "")

        # Origin from location or default
        origin_city = "WAREHOUSE"  # Default; could be enriched from location

        if not dest_city or not d.transporterId:
            continue

        key = (origin_city, dest_city, d.transporterId)
        if key not in stats:
            stats[key] = {
                "total": 0, "delivered": 0, "on_time": 0,
                "tat_sum": 0.0, "cost_sum": 0.0,
            }
        s = stats[key]
        s["total"] += 1

        status_val = d.status.value if hasattr(d.status, 'value') else str(d.status)

        if status_val in _DELIVERED:
            s["delivered"] += 1
            if d.shipDate and d.deliveryDate:
                tat_days = (d.deliveryDate - d.shipDate).total_seconds() / 86400.0
                s["tat_sum"] += max(0, tat_days)
                if tat_days <= 7.0:
                    s["on_time"] += 1

    return stats


def _query_shipment_pincode_stats(
    session: Session,
    company_id: UUID,
    period_start: datetime,
    period_end: datetime,
) -> Dict[tuple, Dict[str, Any]]:
    """Query Shipment for per-pincode + carrier stats."""
    shipments = session.exec(
        select(Shipment).where(
            Shipment.companyId == company_id,
            Shipment.transporterId.isnot(None),
            Shipment.createdAt >= period_start,
            Shipment.createdAt <= period_end,
        )
    ).all()

    stats: Dict[tuple, Dict[str, Any]] = {}
    for sh in shipments:
        pincode = ""
        if sh.deliveryAddress and isinstance(sh.deliveryAddress, dict):
            pincode = sh.deliveryAddress.get("pincode", "")
        if not pincode or not sh.transporterId:
            continue

        key = (str(pincode), sh.transporterId)
        if key not in stats:
            stats[key] = {
                "total": 0, "delivered": 0, "rto": 0,
                "on_time": 0, "tat_sum": 0.0, "cost_sum": 0.0,
            }
        s = stats[key]
        s["total"] += 1

        status_val = sh.status.value if hasattr(sh.status, 'value') else str(sh.status)

        if status_val in _DELIVERED:
            s["delivered"] += 1
            if sh.shipDate and sh.deliveredDate:
                tat_days = (sh.deliveredDate - sh.shipDate).total_seconds() / 86400.0
                s["tat_sum"] += max(0, tat_days)
                if tat_days <= 7.0:
                    s["on_time"] += 1

        if status_val in _RTO:
            s["rto"] += 1

        if sh.shippingCharge:
            s["cost_sum"] += float(sh.shippingCharge)

    return stats
