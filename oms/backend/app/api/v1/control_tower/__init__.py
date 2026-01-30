"""
Control Tower API v1 - Rule-Based Exception Detection Engine & Monitoring
This module provides intelligent monitoring using configurable detection rules
stored in the database.
"""
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func, and_, or_, text

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models.order import Order, Delivery
from app.models.ndr import NDR, AIActionLog
from app.models.returns import Return
from app.models.inventory import Inventory
from app.models.sku import SKU
from app.models.system import Exception as ExceptionModel
from app.models.user import User
from app.services.scheduler import get_last_scan_result

router = APIRouter(prefix="/control-tower", tags=["Control Tower"])


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_entity_model(entity_type: str):
    """Get SQLModel class for entity type."""
    models = {
        "Order": Order,
        "Delivery": Delivery,
        "NDR": NDR,
        "Return": Return,
        "Inventory": Inventory,
    }
    return models.get(entity_type)


def calculate_age_hours(timestamp: datetime) -> float:
    """Calculate hours since timestamp."""
    if not timestamp:
        return 0
    return (datetime.utcnow() - timestamp).total_seconds() / 3600


def calculate_age_days(dt: date) -> int:
    """Calculate days since date."""
    if not dt:
        return 0
    if isinstance(dt, datetime):
        dt = dt.date()
    return (datetime.utcnow().date() - dt).days


def evaluate_condition(entity, condition: Dict[str, Any], now: datetime) -> bool:
    """Evaluate a single condition against an entity."""
    field = condition.get("field")
    operator = condition.get("operator")
    value = condition.get("value")

    if not hasattr(entity, field):
        return False

    entity_value = getattr(entity, field)

    # Handle enum values
    if hasattr(entity_value, 'value'):
        entity_value = entity_value.value

    try:
        if operator == "=":
            return str(entity_value) == str(value)
        elif operator == "!=":
            return str(entity_value) != str(value)
        elif operator == ">":
            return float(entity_value or 0) > float(value)
        elif operator == "<":
            return float(entity_value or 0) < float(value)
        elif operator == ">=":
            return float(entity_value or 0) >= float(value)
        elif operator == "<=":
            return float(entity_value or 0) <= float(value)
        elif operator == "IN":
            return str(entity_value) in value
        elif operator == "NOT_IN":
            return str(entity_value) not in value
        elif operator == "IS_NULL":
            return entity_value is None
        elif operator == "IS_NOT_NULL":
            return entity_value is not None
        elif operator == "AGE_HOURS":
            if entity_value:
                age = calculate_age_hours(entity_value)
                return age >= float(value)
            return False
        elif operator == "AGE_DAYS":
            if entity_value:
                age = calculate_age_days(entity_value)
                return age >= int(value)
            return False
    except (ValueError, TypeError):
        return False

    return False


def evaluate_conditions(entity, conditions: List[Dict[str, Any]], now: datetime) -> bool:
    """Evaluate all conditions against an entity."""
    if not conditions:
        return False

    results = []
    for condition in conditions:
        result = evaluate_condition(entity, condition, now)
        logical_op = condition.get("logicalOperator", "AND")
        results.append((result, logical_op))

    # Evaluate with AND/OR logic
    if not results:
        return False

    final_result = results[0][0]
    for i in range(1, len(results)):
        result, op = results[i]
        prev_op = results[i-1][1] if i > 0 else "AND"
        if prev_op == "AND":
            final_result = final_result and result
        else:  # OR
            final_result = final_result or result

    return final_result


def calculate_severity(entity, rule: Dict[str, Any], now: datetime) -> str:
    """Calculate severity based on rule configuration."""
    severity_rules = rule.get("severityRules", {})
    severity_field = rule.get("severityField", "createdAt")
    severity_unit = rule.get("severityUnit", "hours")
    default_severity = rule.get("defaultSeverity", "MEDIUM")

    if not severity_rules:
        return default_severity

    field_value = getattr(entity, severity_field, None)
    if not field_value:
        return default_severity

    # Calculate the metric value
    if severity_unit == "hours":
        metric_value = calculate_age_hours(field_value)
    elif severity_unit == "days":
        metric_value = calculate_age_days(field_value)
    else:
        metric_value = float(field_value) if field_value else 0

    # Determine severity based on thresholds
    for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        threshold = severity_rules.get(severity)
        if threshold is not None and metric_value >= threshold:
            return severity

    return default_severity


def get_priority(severity: str) -> int:
    """Convert severity to numeric priority."""
    return {"CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4}.get(severity, 5)


def get_entity_identifier(entity, entity_type: str) -> str:
    """Get the identifier field for an entity."""
    if entity_type == "Order":
        return entity.orderNo
    elif entity_type == "Delivery":
        return entity.deliveryNo
    elif entity_type == "NDR":
        return entity.ndrCode
    elif entity_type == "Return":
        return getattr(entity, 'returnNo', str(entity.id))
    elif entity_type == "Inventory":
        return str(entity.skuId)
    return str(entity.id)


# =============================================================================
# DETECTION ENGINE
# =============================================================================

@router.post("/detect-exceptions")
async def detect_exceptions(
    background_tasks: BackgroundTasks,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """
    Trigger the rule-based exception detection engine.
    Loads rules from DetectionRule table and scans data accordingly.
    """
    from app.models.detection_rule import DetectionRule

    company_id = company_filter.company_id
    now = datetime.utcnow()

    # Load active rules
    rules_query = select(DetectionRule).where(DetectionRule.isActive == True)
    if company_id:
        rules_query = rules_query.where(
            (DetectionRule.isGlobal == True) |
            (DetectionRule.companyId == company_id)
        )
    else:
        rules_query = rules_query.where(DetectionRule.isGlobal == True)

    rules = session.exec(rules_query).all()

    if not rules:
        return {
            "success": True,
            "message": "No active detection rules found. Please configure rules first.",
            "timestamp": now.isoformat(),
            "summary": {
                "rules_executed": 0,
                "exceptions_created": 0,
                "exceptions_updated": 0,
                "exceptions_auto_resolved": 0,
            }
        }

    exceptions_created = 0
    exceptions_updated = 0
    auto_resolved = 0
    rules_executed = 0
    scan_details = []

    for rule in rules:
        rule_result = {
            "ruleCode": rule.ruleCode,
            "ruleName": rule.name,
            "entityType": rule.entityType,
            "entitiesScanned": 0,
            "exceptionsCreated": 0,
        }

        # Get the model for this entity type
        Model = get_entity_model(rule.entityType)
        if not Model:
            rule_result["error"] = f"Unknown entity type: {rule.entityType}"
            scan_details.append(rule_result)
            continue

        # Build base query
        query = select(Model)
        if company_id and hasattr(Model, 'companyId'):
            query = query.where(Model.companyId == company_id)

        # Execute query
        try:
            entities = session.exec(query).all()
            rule_result["entitiesScanned"] = len(entities)
        except Exception as e:
            rule_result["error"] = str(e)
            scan_details.append(rule_result)
            continue

        # Process conditions from rule
        conditions = rule.conditions if isinstance(rule.conditions, list) else []

        # Evaluate each entity against the rule
        for entity in entities:
            if evaluate_conditions(entity, conditions, now):
                # Entity matches rule - create/update exception
                entity_id = get_entity_identifier(entity, rule.entityType)
                severity = calculate_severity(entity, {
                    "severityRules": rule.severityRules,
                    "severityField": rule.severityField,
                    "severityUnit": rule.severityUnit,
                    "defaultSeverity": rule.defaultSeverity,
                }, now)

                # Check if exception already exists
                existing = session.exec(
                    select(ExceptionModel).where(
                        ExceptionModel.entityType == rule.entityType,
                        ExceptionModel.entityId == entity_id,
                        ExceptionModel.type == rule.ruleType,
                        ExceptionModel.status.in_(["OPEN", "IN_PROGRESS"])
                    )
                ).first()

                if not existing:
                    # Create new exception
                    order_id = None
                    if hasattr(entity, 'id') and rule.entityType == "Order":
                        order_id = entity.id
                    elif hasattr(entity, 'orderId'):
                        order_id = entity.orderId

                    exception = ExceptionModel(
                        id=uuid4(),
                        exceptionCode=f"EXC-{rule.ruleType[:3]}-{str(uuid4())[:8].upper()}",
                        type=rule.ruleType,
                        source="RULE_ENGINE",
                        severity=severity,
                        entityType=rule.entityType,
                        entityId=entity_id,
                        orderId=order_id,
                        title=f"{rule.name}: {entity_id}",
                        description=f"Detected by rule '{rule.ruleCode}'. {rule.description or ''}",
                        autoResolvable=rule.autoResolveEnabled,
                        status="OPEN",
                        priority=get_priority(severity),
                        companyId=getattr(entity, 'companyId', company_id),
                        createdAt=now,
                        updatedAt=now
                    )
                    session.add(exception)
                    exceptions_created += 1
                    rule_result["exceptionsCreated"] += 1

                    # Create AI Action if enabled (map rule action types to DB enum values)
                    if rule.aiActionEnabled and rule.aiActionType:
                        # Map detection rule action types to database enum values
                        action_type_map = {
                            "RECOMMEND": "NDR_CLASSIFICATION",
                            "AUTO_CLASSIFY": "NDR_CLASSIFICATION",
                            "AUTO_OUTREACH": "NDR_RESOLUTION",
                            "AUTO_ESCALATE": "NDR_RESOLUTION",
                            "AUTO_RESOLVE": "NDR_RESOLUTION",
                            "PREDICT": "DEMAND_FORECAST",
                        }
                        mapped_action_type = action_type_map.get(rule.aiActionType, "NDR_CLASSIFICATION")

                        ai_action = AIActionLog(
                            id=uuid4(),
                            actionType=mapped_action_type,
                            entityType=rule.entityType,
                            entityId=entity_id,
                            companyId=getattr(entity, 'companyId', company_id),
                            ndrId=entity.id if rule.entityType == "NDR" else None,
                            decision=f"Triggered by rule: {rule.ruleCode} ({rule.aiActionType})",
                            reasoning=f"Rule '{rule.name}' detected an issue that requires {rule.aiActionType}",
                            confidence=0.85,
                            riskLevel=severity,
                            status="PENDING_APPROVAL",
                            approvalRequired=True,
                            recommendations=rule.aiActionConfig,
                            createdAt=now,
                            updatedAt=now
                        )
                        session.add(ai_action)

                else:
                    # Update existing if severity changed
                    if existing.severity != severity:
                        existing.severity = severity
                        existing.priority = get_priority(severity)
                        existing.updatedAt = now
                        session.add(existing)
                        exceptions_updated += 1

        # Update rule execution stats
        rule.lastExecutedAt = now
        rule.executionCount = (rule.executionCount or 0) + 1
        rule.exceptionsCreated = (rule.exceptionsCreated or 0) + rule_result["exceptionsCreated"]
        session.add(rule)

        rules_executed += 1
        scan_details.append(rule_result)

    # Auto-resolve exceptions where underlying issue is fixed
    if company_id:
        open_exceptions = session.exec(
            select(ExceptionModel).where(
                ExceptionModel.status == "OPEN",
                ExceptionModel.autoResolvable == True,
                ExceptionModel.companyId == company_id
            )
        ).all()
    else:
        open_exceptions = session.exec(
            select(ExceptionModel).where(
                ExceptionModel.status == "OPEN",
                ExceptionModel.autoResolvable == True
            )
        ).all()

    for exc in open_exceptions:
        Model = get_entity_model(exc.entityType)
        if Model:
            # Find the entity
            if exc.entityType == "Order" and exc.orderId:
                entity = session.get(Model, exc.orderId)
            else:
                entity = session.exec(
                    select(Model).where(
                        getattr(Model, 'orderNo' if exc.entityType == 'Order' else
                                      'deliveryNo' if exc.entityType == 'Delivery' else
                                      'ndrCode' if exc.entityType == 'NDR' else 'id') == exc.entityId
                    )
                ).first()

            if entity:
                # Check if entity status has changed (simple auto-resolve logic)
                status = getattr(entity, 'status', None)
                if hasattr(status, 'value'):
                    status = status.value

                should_resolve = False
                # Order/Delivery rules
                if exc.type == "STUCK_ORDER" and status != "CREATED":
                    should_resolve = True
                elif exc.type == "SLA_BREACH" and status == "DELIVERED":
                    should_resolve = True
                elif exc.type == "CARRIER_DELAY" and status in ["DELIVERED", "OUT_FOR_DELIVERY"]:
                    should_resolve = True
                # NDR-specific rules - resolve when NDR is resolved/closed/RTO
                elif exc.type in ["NDR_AGING", "NDR_MULTI_ATTEMPT", "NDR_NO_RESPONSE",
                                  "NDR_HIGH_VALUE", "NDR_COD_RISK", "NDR_ADDRESS_ISSUE",
                                  "NDR_RTO_CANDIDATE", "NDR_ESCALATION"] and status in ["RESOLVED", "RTO", "CLOSED"]:
                    should_resolve = True
                # Return rules
                elif exc.type == "RETURN_AGING" and status in ["COMPLETED", "REFUNDED", "REJECTED"]:
                    should_resolve = True

                if should_resolve:
                    exc.status = "RESOLVED"
                    exc.resolution = "Auto-resolved: Issue has been addressed"
                    exc.resolvedAt = now
                    exc.resolvedBy = "RULE_ENGINE"
                    exc.updatedAt = now
                    session.add(exc)
                    auto_resolved += 1

    # Commit all changes
    session.commit()

    return {
        "success": True,
        "timestamp": now.isoformat(),
        "summary": {
            "rules_executed": rules_executed,
            "exceptions_created": exceptions_created,
            "exceptions_updated": exceptions_updated,
            "exceptions_auto_resolved": auto_resolved,
        },
        "scan_details": scan_details
    }


@router.get("/dashboard")
def get_control_tower_dashboard(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get Control Tower dashboard summary.
    Returns real-time counts and metrics from all monitoring systems.
    """
    company_id = company_filter.company_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Base query for exceptions
    exc_query = select(ExceptionModel)
    if company_id:
        exc_query = exc_query.where(ExceptionModel.companyId == company_id)

    all_exceptions = session.exec(exc_query).all()

    # Calculate counts
    critical_count = sum(1 for e in all_exceptions if e.severity == "CRITICAL" and e.status == "OPEN")
    open_count = sum(1 for e in all_exceptions if e.status == "OPEN")
    in_progress_count = sum(1 for e in all_exceptions if e.status == "IN_PROGRESS")
    resolved_today = sum(1 for e in all_exceptions if e.status == "RESOLVED" and e.resolvedAt and e.resolvedAt >= today_start)

    # Exception breakdown by type
    by_type = {}
    for e in all_exceptions:
        if e.status in ["OPEN", "IN_PROGRESS"]:
            by_type[e.type] = by_type.get(e.type, 0) + 1

    # Get active rules count
    from app.models.detection_rule import DetectionRule
    rules_query = select(func.count(DetectionRule.id)).where(DetectionRule.isActive == True)
    active_rules = session.exec(rules_query).one()

    # Get order stats
    orders_query = select(func.count(Order.id)).where(Order.createdAt >= today_start)
    if company_id:
        orders_query = orders_query.where(Order.companyId == company_id)
    orders_today = session.exec(orders_query).one()

    # Get NDR stats
    ndr_query = select(func.count(NDR.id)).where(NDR.status == "OPEN")
    if company_id:
        ndr_query = ndr_query.where(NDR.companyId == company_id)
    open_ndrs = session.exec(ndr_query).one()

    # Get last scan result from scheduler
    last_scan = get_last_scan_result()

    return {
        "exceptions": {
            "critical": critical_count,
            "open": open_count,
            "inProgress": in_progress_count,
            "resolvedToday": resolved_today,
            "byType": by_type
        },
        "rules": {
            "active": active_rules
        },
        "operations": {
            "ordersToday": orders_today,
            "openNDRs": open_ndrs,
        },
        "scheduler": {
            "lastScan": last_scan.get("timestamp"),
            "status": last_scan.get("status"),
            "lastResult": {
                "rulesExecuted": last_scan.get("rules_executed", 0),
                "exceptionsCreated": last_scan.get("exceptions_created", 0),
                "exceptionsUpdated": last_scan.get("exceptions_updated", 0),
                "autoResolved": last_scan.get("auto_resolved", 0),
            }
        },
        "timestamp": now.isoformat(),
    }


@router.get("/ndr-summary")
def get_ndr_command_center_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get NDR Command Center summary - integrated NDR metrics for Control Tower.
    Shows NDR exceptions detected by rules and overall NDR health.
    """
    company_id = company_filter.company_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get NDR exceptions (rule-detected)
    ndr_exc_query = select(ExceptionModel).where(
        ExceptionModel.entityType == "NDR",
        ExceptionModel.status.in_(["OPEN", "IN_PROGRESS"])
    )
    if company_id:
        ndr_exc_query = ndr_exc_query.where(ExceptionModel.companyId == company_id)
    ndr_exceptions = session.exec(ndr_exc_query).all()

    # Get all NDRs stats
    ndr_query = select(NDR)
    if company_id:
        ndr_query = ndr_query.where(NDR.companyId == company_id)
    all_ndrs = session.exec(ndr_query).all()

    # NDR status breakdown
    status_breakdown = {}
    reason_breakdown = {}
    priority_breakdown = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    total_risk_score = 0
    risk_count = 0

    for ndr in all_ndrs:
        status = ndr.status.value if hasattr(ndr.status, 'value') else str(ndr.status)
        status_breakdown[status] = status_breakdown.get(status, 0) + 1

        if status == "OPEN":
            reason = ndr.reason.value if hasattr(ndr.reason, 'value') else str(ndr.reason) if ndr.reason else "UNKNOWN"
            reason_breakdown[reason] = reason_breakdown.get(reason, 0) + 1

            priority = ndr.priority.value if hasattr(ndr.priority, 'value') else str(ndr.priority) if ndr.priority else "MEDIUM"
            if priority in priority_breakdown:
                priority_breakdown[priority] += 1

            if ndr.riskScore:
                total_risk_score += ndr.riskScore
                risk_count += 1

    # Exception breakdown by NDR rule type
    exception_by_rule = {}
    for exc in ndr_exceptions:
        exception_by_rule[exc.type] = exception_by_rule.get(exc.type, 0) + 1

    # AI Actions for NDR (pending approval)
    ai_query = select(func.count(AIActionLog.id)).where(
        AIActionLog.entityType == "NDR",
        AIActionLog.status == "PENDING_APPROVAL"
    )
    if company_id:
        ai_query = ai_query.where(AIActionLog.companyId == company_id)
    pending_ai_actions = session.exec(ai_query).one()

    # NDRs created today
    ndrs_today = sum(1 for n in all_ndrs if n.createdAt and n.createdAt >= today_start)

    # NDRs resolved today
    resolved_today = sum(1 for n in all_ndrs if n.resolvedAt and n.resolvedAt >= today_start)

    return {
        "summary": {
            "totalNDRs": len(all_ndrs),
            "openNDRs": status_breakdown.get("OPEN", 0),
            "inProgressNDRs": status_breakdown.get("ACTION_REQUESTED", 0) + status_breakdown.get("REATTEMPT_SCHEDULED", 0),
            "resolvedNDRs": status_breakdown.get("RESOLVED", 0),
            "rtoNDRs": status_breakdown.get("RTO", 0),
            "ndrsToday": ndrs_today,
            "resolvedToday": resolved_today,
        },
        "exceptions": {
            "total": len(ndr_exceptions),
            "critical": sum(1 for e in ndr_exceptions if e.severity == "CRITICAL"),
            "high": sum(1 for e in ndr_exceptions if e.severity == "HIGH"),
            "byRuleType": exception_by_rule,
        },
        "breakdown": {
            "byStatus": status_breakdown,
            "byReason": reason_breakdown,
            "byPriority": priority_breakdown,
        },
        "riskMetrics": {
            "avgRiskScore": round(total_risk_score / risk_count, 1) if risk_count > 0 else 0,
            "highRiskCount": sum(1 for n in all_ndrs if n.riskScore and n.riskScore >= 70 and (n.status.value if hasattr(n.status, 'value') else n.status) == "OPEN"),
        },
        "aiActions": {
            "pendingApproval": pending_ai_actions,
        },
        "timestamp": now.isoformat(),
    }


@router.post("/ndr-action/execute")
async def execute_ndr_action(
    action_type: str,
    ndr_id: UUID,
    config: Optional[Dict[str, Any]] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """
    Execute an NDR action manually or from AI recommendation.
    Supports: AUTO_OUTREACH, AUTO_ESCALATE, AUTO_REATTEMPT, AUTO_RTO
    """
    from app.models.ndr import NDROutreach

    company_id = company_filter.company_id
    now = datetime.utcnow()

    # Get the NDR
    ndr = session.get(NDR, ndr_id)
    if not ndr:
        raise HTTPException(status_code=404, detail="NDR not found")

    if company_id and ndr.companyId != company_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = {
        "success": False,
        "actionType": action_type,
        "ndrId": str(ndr_id),
        "message": "",
        "details": {}
    }

    try:
        if action_type == "AUTO_OUTREACH":
            # Create outreach record
            channel = config.get("channel", "WHATSAPP") if config else "WHATSAPP"
            template_id = config.get("templateId", "ndr_default") if config else "ndr_default"

            # Calculate attempt number by counting existing outreaches for this NDR
            existing_outreach_count = session.exec(
                select(func.count(NDROutreach.id)).where(NDROutreach.ndrId == ndr_id)
            ).one()
            attempt_number = existing_outreach_count + 1

            # Fetch order details for personalized message
            customer_name = "Customer"
            order_no = ""
            if ndr.orderId:
                order = session.get(Order, ndr.orderId)
                if order:
                    customer_name = order.customerName.split()[0] if order.customerName else "Customer"
                    order_no = order.orderNo

            # Generate personalized message based on NDR reason
            reason = ndr.reason.value if hasattr(ndr.reason, 'value') else str(ndr.reason)
            messages = {
                "CUSTOMER_UNAVAILABLE": f"Hi {customer_name}, we tried to deliver your order {order_no} but you were unavailable. Please confirm your availability for the next attempt.",
                "WRONG_ADDRESS": f"Hi {customer_name}, we couldn't find your address for order {order_no}. Please share the correct address for delivery.",
                "COD_NOT_READY": f"Hi {customer_name}, we tried to deliver your COD order {order_no}. Please keep the exact amount ready for the next attempt.",
                "PHONE_UNREACHABLE": f"Hi {customer_name}, we couldn't reach you for order {order_no}. Please confirm your phone number for delivery coordination.",
                "CUSTOMER_REFUSED": f"Hi {customer_name}, our delivery agent reported that you refused to accept order {order_no}. Please let us know if there was an issue.",
                "ADDRESS_NOT_FOUND": f"Hi {customer_name}, our delivery agent couldn't locate the address for order {order_no}. Please share a landmark or updated address.",
            }
            message = messages.get(reason, f"Hi {customer_name}, we need your help to complete delivery of order {order_no}. Please respond with your preferred time slot.")

            outreach = NDROutreach(
                id=uuid4(),
                ndrId=ndr_id,
                channel=channel,
                attemptNumber=attempt_number,
                templateId=template_id,
                messageContent=message,
                status="PENDING",
                companyId=ndr.companyId,
                createdAt=now,
                updatedAt=now
            )
            session.add(outreach)

            # Update NDR status
            ndr.status = "ACTION_REQUESTED"
            ndr.updatedAt = now
            session.add(ndr)

            result["success"] = True
            result["message"] = f"Outreach initiated via {channel}"
            result["details"] = {"channel": channel, "message": message[:100] + "..."}

        elif action_type == "AUTO_ESCALATE":
            # Update NDR priority and add escalation
            ndr.priority = "CRITICAL"
            ndr.updatedAt = now
            session.add(ndr)

            # Create escalation AI action log
            ai_action = AIActionLog(
                id=uuid4(),
                actionType="NDR_RESOLUTION",
                entityType="NDR",
                entityId=ndr.ndrCode,
                ndrId=ndr_id,
                companyId=ndr.companyId,
                decision="Escalated to management due to repeated failures",
                reasoning=f"NDR {ndr.ndrCode} escalated: {config.get('reason', 'Manual escalation')}",
                confidence=1.0,
                riskLevel="CRITICAL",
                status="EXECUTED",
                approvalRequired=False,
                executedAt=now,
                executionResult="Escalated successfully",
                createdAt=now,
                updatedAt=now
            )
            session.add(ai_action)

            result["success"] = True
            result["message"] = "NDR escalated to management"
            result["details"] = {"newPriority": "CRITICAL"}

        elif action_type == "AUTO_REATTEMPT":
            # Schedule reattempt
            reattempt_date = config.get("reattemptDate") if config else None
            reattempt_slot = config.get("reattemptSlot", "9AM-12PM") if config else "9AM-12PM"

            if not reattempt_date:
                # Default to next day
                reattempt_date = (now + timedelta(days=1)).date()

            ndr.reattemptDate = reattempt_date if isinstance(reattempt_date, datetime) else datetime.fromisoformat(str(reattempt_date))
            ndr.reattemptSlot = reattempt_slot
            ndr.status = "REATTEMPT_SCHEDULED"
            ndr.updatedAt = now
            session.add(ndr)

            result["success"] = True
            result["message"] = f"Reattempt scheduled for {reattempt_date}"
            result["details"] = {"reattemptDate": str(reattempt_date), "slot": reattempt_slot}

        elif action_type == "AUTO_RTO":
            # Initiate RTO
            ndr.status = "RTO"
            ndr.resolutionType = "RTO"
            ndr.resolvedAt = now
            ndr.resolvedBy = str(current_user.id)
            ndr.resolutionNotes = config.get("notes", "Auto-initiated RTO after multiple failed attempts") if config else "Auto-initiated RTO"
            ndr.updatedAt = now
            session.add(ndr)

            result["success"] = True
            result["message"] = "RTO initiated"
            result["details"] = {"status": "RTO", "notes": ndr.resolutionNotes}

        else:
            result["message"] = f"Unknown action type: {action_type}"
            return result

        session.commit()

    except Exception as e:
        result["message"] = f"Action failed: {str(e)}"
        return result

    return result


@router.get("/health")
def get_system_health(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get overall system health score based on exception metrics.
    """
    company_id = company_filter.company_id

    exc_query = select(ExceptionModel).where(ExceptionModel.status.in_(["OPEN", "IN_PROGRESS"]))
    if company_id:
        exc_query = exc_query.where(ExceptionModel.companyId == company_id)

    active_exceptions = session.exec(exc_query).all()

    # Calculate health score (100 = perfect, decreases with exceptions)
    critical_penalty = sum(20 for e in active_exceptions if e.severity == "CRITICAL")
    high_penalty = sum(10 for e in active_exceptions if e.severity == "HIGH")
    medium_penalty = sum(5 for e in active_exceptions if e.severity == "MEDIUM")
    low_penalty = sum(2 for e in active_exceptions if e.severity == "LOW")

    total_penalty = critical_penalty + high_penalty + medium_penalty + low_penalty
    health_score = max(0, 100 - total_penalty)

    if health_score >= 90:
        status = "HEALTHY"
    elif health_score >= 70:
        status = "WARNING"
    elif health_score >= 50:
        status = "DEGRADED"
    else:
        status = "CRITICAL"

    return {
        "healthScore": health_score,
        "status": status,
        "activeExceptions": len(active_exceptions),
        "breakdown": {
            "critical": sum(1 for e in active_exceptions if e.severity == "CRITICAL"),
            "high": sum(1 for e in active_exceptions if e.severity == "HIGH"),
            "medium": sum(1 for e in active_exceptions if e.severity == "MEDIUM"),
            "low": sum(1 for e in active_exceptions if e.severity == "LOW"),
        }
    }
