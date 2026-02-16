"""
Status Pipeline — Processes carrier tracking updates and triggers downstream actions.

When a tracking update arrives (via webhook or polling):
1. Update Delivery.status
2. If NDR → create/update NDR record + trigger AI classification
3. If delivered → update Order.status
4. Trigger detection engine for exception creation
5. Log everything for audit
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.models.order import Order, Delivery
from app.models.ndr import NDR, AIActionLog
from app.models.enums import (
    DeliveryStatus, OrderStatus, NDRStatus, NDRPriority,
    NDRReason, AIActionType, AIActionStatus,
)
from .status_mapper import StatusMapper

logger = logging.getLogger(__name__)


class StatusPipeline:
    """
    Processes a carrier status update and cascades it through the OMS.
    """

    @staticmethod
    def process_tracking_update(
        session: Session,
        awb_number: str,
        carrier_code: str,
        carrier_status: str,
        carrier_remark: str = "",
        location: str = "",
        timestamp: Optional[datetime] = None,
        ndr_reason_raw: str = "",
    ) -> dict:
        """
        Main entry point — called by webhook receiver or tracking poller.

        Returns a summary of what happened:
        {
            "delivery_updated": True/False,
            "new_status": "IN_TRANSIT",
            "ndr_created": True/False,
            "ndr_id": "uuid" or None,
            "order_updated": True/False,
        }
        """
        timestamp = timestamp or datetime.now(timezone.utc)
        result = {
            "delivery_updated": False,
            "new_status": "",
            "ndr_created": False,
            "ndr_id": None,
            "order_updated": False,
            "error": None,
        }

        # 1. Find the delivery by AWB
        delivery = session.exec(
            select(Delivery).where(Delivery.awbNo == awb_number)
        ).first()

        if not delivery:
            result["error"] = f"No delivery found for AWB {awb_number}"
            logger.warning(result["error"])
            return result

        # 2. Map carrier status → OMS status
        new_status = StatusMapper.map_status(carrier_code, carrier_status)
        old_status = delivery.status

        # Don't regress status (e.g., don't go from DELIVERED back to IN_TRANSIT)
        if StatusMapper.is_terminal(old_status) and not StatusMapper.is_terminal(new_status):
            logger.info(
                f"Ignoring non-terminal update for terminal delivery {awb_number}: "
                f"{old_status} → {new_status}"
            )
            return result

        # 3. Update delivery status
        if new_status != old_status:
            delivery.status = new_status
            delivery.remarks = f"{carrier_status}: {carrier_remark}"

            if new_status == DeliveryStatus.SHIPPED:
                delivery.shipDate = delivery.shipDate or timestamp
            elif new_status == DeliveryStatus.DELIVERED:
                delivery.deliveryDate = timestamp
            elif new_status == DeliveryStatus.RTO_DELIVERED:
                delivery.deliveryDate = timestamp

            session.add(delivery)
            result["delivery_updated"] = True
            result["new_status"] = new_status.value

            logger.info(
                f"Delivery {awb_number} status: {old_status.value} → {new_status.value}"
            )

        # 4. Handle NDR
        if StatusMapper.is_ndr(new_status):
            ndr_result = StatusPipeline._handle_ndr(
                session, delivery, carrier_code, carrier_status,
                carrier_remark, ndr_reason_raw, timestamp,
            )
            result["ndr_created"] = ndr_result.get("created", False)
            result["ndr_id"] = ndr_result.get("ndr_id")

        # 5. Update parent Order status
        if delivery.orderId and new_status != old_status:
            order_updated = StatusPipeline._update_order_status(
                session, delivery.orderId, new_status
            )
            result["order_updated"] = order_updated

        # 6. Dispatch events for downstream automation
        from app.services.event_dispatcher import dispatch

        if new_status == DeliveryStatus.DELIVERED:
            dispatch("delivery.delivered", {
                "deliveryId": str(delivery.id),
                "orderId": str(delivery.orderId) if delivery.orderId else "",
                "companyId": str(delivery.companyId),
                "transporterId": str(delivery.transporterId) if delivery.transporterId else "",
            })
        elif new_status == DeliveryStatus.RTO_DELIVERED:
            dispatch("delivery.rto_delivered", {
                "deliveryId": str(delivery.id),
                "orderId": str(delivery.orderId) if delivery.orderId else "",
                "companyId": str(delivery.companyId),
                "transporterId": str(delivery.transporterId) if delivery.transporterId else "",
            })
        elif new_status == DeliveryStatus.SHIPPED:
            dispatch("delivery.shipped", {
                "deliveryId": str(delivery.id),
                "orderId": str(delivery.orderId) if delivery.orderId else "",
                "companyId": str(delivery.companyId),
                "awbNumber": delivery.awbNo or "",
                "carrierCode": carrier_code,
            })

        # Legacy signal for analytics aggregation
        if new_status in (DeliveryStatus.DELIVERED, DeliveryStatus.RTO_DELIVERED):
            result["trigger_aggregation"] = True
            result["company_id"] = str(delivery.companyId)
            result["delivery_id"] = str(delivery.id)
            result["transporter_id"] = str(delivery.transporterId) if delivery.transporterId else None

        session.flush()
        return result

    @staticmethod
    def _handle_ndr(
        session: Session,
        delivery: Delivery,
        carrier_code: str,
        carrier_status: str,
        carrier_remark: str,
        ndr_reason_raw: str,
        timestamp: datetime,
    ) -> dict:
        """Create or update an NDR record for a failed delivery."""
        # Check for existing open NDR
        existing_ndr = session.exec(
            select(NDR).where(
                NDR.deliveryId == delivery.id,
                NDR.status.in_([NDRStatus.OPEN.value, NDRStatus.ACTION_REQUESTED.value]),
            )
        ).first()

        ndr_reason = StatusMapper.map_ndr_reason(
            carrier_code, ndr_reason_raw or carrier_remark or carrier_status
        )

        if existing_ndr:
            # Update attempt count
            existing_ndr.attemptNumber = (existing_ndr.attemptNumber or 1) + 1
            existing_ndr.attemptDate = timestamp
            existing_ndr.carrierRemark = carrier_remark
            existing_ndr.carrierNDRCode = carrier_status

            # Escalate priority if multiple attempts
            if existing_ndr.attemptNumber >= 3:
                existing_ndr.priority = NDRPriority.CRITICAL
                existing_ndr.riskScore = min(100, (existing_ndr.riskScore or 50) + 20)
            elif existing_ndr.attemptNumber >= 2:
                existing_ndr.priority = NDRPriority.HIGH
                existing_ndr.riskScore = min(100, (existing_ndr.riskScore or 30) + 15)

            session.add(existing_ndr)
            logger.info(
                f"Updated NDR for {delivery.awbNo}: attempt #{existing_ndr.attemptNumber}"
            )
            return {"created": False, "ndr_id": str(existing_ndr.id)}

        else:
            # Create new NDR
            ndr_code = f"NDR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:4]}"
            ndr = NDR(
                ndrCode=ndr_code,
                deliveryId=delivery.id,
                orderId=delivery.orderId,
                companyId=delivery.companyId,
                attemptDate=timestamp,
                attemptNumber=1,
                reason=ndr_reason,
                carrierNDRCode=carrier_status,
                carrierRemark=carrier_remark,
                status=NDRStatus.OPEN,
                priority=NDRPriority.MEDIUM,
                riskScore=30,
            )
            session.add(ndr)
            session.flush()  # Get the ID

            # Create AI classification action
            ai_action = AIActionLog(
                actionType=AIActionType.NDR_CLASSIFICATION,
                entityType="NDR",
                entityId=str(ndr.id),
                ndrId=ndr.id,
                companyId=delivery.companyId,
                decision=f"Auto-classified as {ndr_reason.value}",
                reasoning=f"Carrier ({carrier_code}) reported: {carrier_remark or carrier_status}",
                confidence=0.85,
                riskLevel="MEDIUM",
                impactScore=30,
                status=AIActionStatus.EXECUTED,
                approvalRequired=False,
                executedAt=datetime.now(timezone.utc),
                executedResult=f"NDR created: {ndr_code}",
            )
            session.add(ai_action)

            logger.info(
                f"Created NDR {ndr_code} for {delivery.awbNo}: {ndr_reason.value}"
            )

            # Dispatch NDR created event
            from app.services.event_dispatcher import dispatch
            dispatch("ndr.created", {
                "ndrId": str(ndr.id),
                "deliveryId": str(delivery.id),
                "orderId": str(delivery.orderId) if delivery.orderId else "",
                "companyId": str(delivery.companyId),
            })

            return {"created": True, "ndr_id": str(ndr.id)}

    @staticmethod
    def _update_order_status(
        session: Session,
        order_id: UUID,
        delivery_status: DeliveryStatus,
    ) -> bool:
        """Update the parent order status based on delivery status change."""
        order = session.exec(select(Order).where(Order.id == order_id)).first()
        if not order:
            return False

        # Map delivery status → order status
        status_map = {
            DeliveryStatus.SHIPPED: OrderStatus.SHIPPED,
            DeliveryStatus.IN_TRANSIT: OrderStatus.SHIPPED,
            DeliveryStatus.OUT_FOR_DELIVERY: OrderStatus.SHIPPED,
            DeliveryStatus.DELIVERED: OrderStatus.DELIVERED,
            DeliveryStatus.NDR: OrderStatus.SHIPPED,  # Keep as shipped
            DeliveryStatus.RTO_INITIATED: OrderStatus.SHIPPED,
            DeliveryStatus.RTO_IN_TRANSIT: OrderStatus.SHIPPED,
            DeliveryStatus.RTO_DELIVERED: OrderStatus.RETURNED,
            DeliveryStatus.CANCELLED: OrderStatus.CANCELLED,
        }

        new_order_status = status_map.get(delivery_status)
        if new_order_status and new_order_status != order.status:
            order.status = new_order_status
            session.add(order)
            logger.info(f"Order {order.orderNo} status → {new_order_status.value}")
            return True

        return False

    @staticmethod
    def process_bulk_tracking(
        session: Session,
        updates: list,
    ) -> dict:
        """
        Process multiple tracking updates at once (from poller).
        Each update: { awb, carrier_code, status, remark, location, timestamp }
        """
        results = {"processed": 0, "errors": 0, "ndrs_created": 0}
        for update in updates:
            try:
                r = StatusPipeline.process_tracking_update(
                    session=session,
                    awb_number=update["awb"],
                    carrier_code=update["carrier_code"],
                    carrier_status=update["status"],
                    carrier_remark=update.get("remark", ""),
                    location=update.get("location", ""),
                    ndr_reason_raw=update.get("ndr_reason", ""),
                )
                results["processed"] += 1
                if r.get("ndr_created"):
                    results["ndrs_created"] += 1
            except Exception as e:
                results["errors"] += 1
                logger.error(f"Failed processing {update.get('awb')}: {e}")

        return results
