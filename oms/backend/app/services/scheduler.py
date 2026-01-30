"""
Scheduler Service - APScheduler for automated background jobs
Runs detection engine every 15 minutes for proactive monitoring
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from sqlmodel import Session, select, func

from app.core.database import engine
from app.models.detection_rule import DetectionRule
from app.models.order import Order, Delivery
from app.models.ndr import NDR, AIActionLog
from app.models.returns import Return
from app.models.inventory import Inventory
from app.models.system import Exception as ExceptionModel

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = BackgroundScheduler()

# Track last execution
last_scan_result = {
    "timestamp": None,
    "rules_executed": 0,
    "exceptions_created": 0,
    "exceptions_updated": 0,
    "auto_resolved": 0,
    "status": "NOT_RUN"
}


def get_last_scan_result():
    """Get the last scan result for API access."""
    return last_scan_result


# =============================================================================
# DETECTION ENGINE HELPERS (duplicated from control_tower for independence)
# =============================================================================

def calculate_age_hours(timestamp: datetime) -> float:
    """Calculate hours since timestamp."""
    if not timestamp:
        return 0
    return (datetime.utcnow() - timestamp).total_seconds() / 3600


def calculate_age_days(dt) -> int:
    """Calculate days since date."""
    if not dt:
        return 0
    if isinstance(dt, datetime):
        dt = dt.date()
    return (datetime.utcnow().date() - dt).days


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


def evaluate_condition(entity, condition: dict, now: datetime) -> bool:
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


def evaluate_conditions(entity, conditions: list, now: datetime) -> bool:
    """Evaluate all conditions against an entity (AND logic)."""
    if not conditions:
        return False
    return all(evaluate_condition(entity, cond, now) for cond in conditions)


def calculate_severity(entity, rule, now: datetime) -> str:
    """Calculate severity based on rule configuration."""
    severity_rules = rule.severityRules or {}
    severity_field = rule.severityField or "createdAt"
    severity_unit = rule.severityUnit or "hours"
    default_severity = rule.defaultSeverity or "MEDIUM"

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

    # Determine severity based on thresholds (highest first)
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
# SCHEDULED JOB: RUN DETECTION ENGINE
# =============================================================================

def run_detection_engine():
    """
    Scheduled job that runs the detection engine.
    Executes every 15 minutes to detect exceptions proactively.
    """
    global last_scan_result

    logger.info("=== SCHEDULED DETECTION ENGINE START ===")
    now = datetime.utcnow()

    exceptions_created = 0
    exceptions_updated = 0
    auto_resolved = 0
    rules_executed = 0

    try:
        with Session(engine) as session:
            # Load all active global rules
            rules = session.exec(
                select(DetectionRule).where(
                    DetectionRule.isActive == True,
                    DetectionRule.isGlobal == True
                )
            ).all()

            if not rules:
                logger.info("No active global rules found")
                last_scan_result = {
                    "timestamp": now.isoformat(),
                    "rules_executed": 0,
                    "exceptions_created": 0,
                    "exceptions_updated": 0,
                    "auto_resolved": 0,
                    "status": "NO_RULES"
                }
                return

            logger.info(f"Found {len(rules)} active rules to execute")

            for rule in rules:
                try:
                    Model = get_entity_model(rule.entityType)
                    if not Model:
                        logger.warning(f"Unknown entity type: {rule.entityType}")
                        continue

                    # Get all entities of this type
                    entities = session.exec(select(Model)).all()
                    conditions = rule.conditions if isinstance(rule.conditions, list) else []

                    logger.info(f"Rule {rule.ruleCode}: Scanning {len(entities)} {rule.entityType} entities")

                    for entity in entities:
                        if evaluate_conditions(entity, conditions, now):
                            entity_id = get_entity_identifier(entity, rule.entityType)
                            severity = calculate_severity(entity, rule, now)

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
                                    source="SCHEDULER",
                                    severity=severity,
                                    entityType=rule.entityType,
                                    entityId=entity_id,
                                    orderId=order_id,
                                    title=f"{rule.name}: {entity_id}",
                                    description=f"Auto-detected by scheduler using rule '{rule.ruleCode}'",
                                    autoResolvable=rule.autoResolveEnabled,
                                    status="OPEN",
                                    priority=get_priority(severity),
                                    companyId=getattr(entity, 'companyId', None),
                                    createdAt=now,
                                    updatedAt=now
                                )
                                session.add(exception)
                                exceptions_created += 1

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
                                        companyId=getattr(entity, 'companyId', None),
                                        ndrId=entity.id if rule.entityType == "NDR" else None,
                                        decision=f"Auto-triggered by scheduler rule: {rule.ruleCode} ({rule.aiActionType})",
                                        reasoning=f"Rule '{rule.name}' detected an issue requiring {rule.aiActionType}",
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
                                # Update severity if changed
                                if existing.severity != severity:
                                    existing.severity = severity
                                    existing.priority = get_priority(severity)
                                    existing.updatedAt = now
                                    session.add(existing)
                                    exceptions_updated += 1

                    # Update rule execution stats
                    rule.lastExecutedAt = now
                    rule.executionCount = (rule.executionCount or 0) + 1
                    session.add(rule)
                    rules_executed += 1

                except Exception as e:
                    logger.error(f"Error executing rule {rule.ruleCode}: {str(e)}")
                    continue

            # Auto-resolve exceptions where underlying issue is fixed
            open_exceptions = session.exec(
                select(ExceptionModel).where(
                    ExceptionModel.status == "OPEN",
                    ExceptionModel.autoResolvable == True
                )
            ).all()

            for exc in open_exceptions:
                Model = get_entity_model(exc.entityType)
                if not Model:
                    continue

                # Find the entity
                entity = None
                if exc.entityType == "Order" and exc.orderId:
                    entity = session.get(Model, exc.orderId)
                else:
                    id_field = {
                        'Order': 'orderNo',
                        'Delivery': 'deliveryNo',
                        'NDR': 'ndrCode'
                    }.get(exc.entityType, 'id')

                    if hasattr(Model, id_field):
                        entity = session.exec(
                            select(Model).where(getattr(Model, id_field) == exc.entityId)
                        ).first()

                if entity:
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
                        exc.resolution = "Auto-resolved by scheduler: Issue has been addressed"
                        exc.resolvedAt = now
                        exc.resolvedBy = "SCHEDULER"
                        exc.updatedAt = now
                        session.add(exc)
                        auto_resolved += 1

            session.commit()

            last_scan_result = {
                "timestamp": now.isoformat(),
                "rules_executed": rules_executed,
                "exceptions_created": exceptions_created,
                "exceptions_updated": exceptions_updated,
                "auto_resolved": auto_resolved,
                "status": "SUCCESS"
            }

            logger.info(f"=== DETECTION ENGINE COMPLETE ===")
            logger.info(f"Rules executed: {rules_executed}")
            logger.info(f"Exceptions created: {exceptions_created}")
            logger.info(f"Exceptions updated: {exceptions_updated}")
            logger.info(f"Auto-resolved: {auto_resolved}")

    except Exception as e:
        logger.error(f"Detection engine error: {str(e)}")
        last_scan_result = {
            "timestamp": now.isoformat(),
            "rules_executed": rules_executed,
            "exceptions_created": exceptions_created,
            "exceptions_updated": exceptions_updated,
            "auto_resolved": auto_resolved,
            "status": f"ERROR: {str(e)}"
        }


# =============================================================================
# SCHEDULER LIFECYCLE
# =============================================================================

def start_scheduler():
    """Start the background scheduler with all jobs."""
    if scheduler.running:
        logger.info("Scheduler already running")
        return

    # Add detection engine job - runs every 15 minutes
    scheduler.add_job(
        run_detection_engine,
        trigger=IntervalTrigger(minutes=15),
        id="detection_engine",
        name="Detection Engine - Exception Scanner",
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
    )

    # Run immediately on startup
    scheduler.add_job(
        run_detection_engine,
        trigger="date",  # Run once immediately
        id="detection_engine_startup",
        name="Detection Engine - Startup Run",
    )

    # Import marketplace sync jobs
    try:
        from app.jobs.order_sync_job import run_order_sync_all
        from app.jobs.inventory_sync_job import run_inventory_push_all
        from app.jobs.settlement_sync_job import run_settlement_fetch_all
        from app.jobs.token_refresh_job import run_token_refresh

        # Order sync: Every 15 minutes
        scheduler.add_job(
            lambda: __import__('asyncio').get_event_loop().run_until_complete(run_order_sync_all()),
            trigger=IntervalTrigger(minutes=15),
            id="marketplace_order_sync",
            name="Marketplace Order Sync (All Connections)",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("Scheduled marketplace order sync job: every 15 minutes")

        # Inventory push: Every 30 minutes
        scheduler.add_job(
            lambda: __import__('asyncio').get_event_loop().run_until_complete(run_inventory_push_all()),
            trigger=IntervalTrigger(minutes=30),
            id="marketplace_inventory_push",
            name="Marketplace Inventory Push (All Connections)",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("Scheduled marketplace inventory push job: every 30 minutes")

        # Settlement fetch: Daily at 6 AM UTC
        scheduler.add_job(
            lambda: __import__('asyncio').get_event_loop().run_until_complete(run_settlement_fetch_all()),
            trigger=CronTrigger(hour=6, minute=0),
            id="marketplace_settlement_fetch",
            name="Marketplace Settlement Fetch (Daily)",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("Scheduled marketplace settlement fetch job: daily at 6 AM UTC")

        # Token refresh: Every 45 minutes
        scheduler.add_job(
            lambda: __import__('asyncio').get_event_loop().run_until_complete(run_token_refresh()),
            trigger=IntervalTrigger(minutes=45),
            id="marketplace_token_refresh",
            name="OAuth Token Refresh",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("Scheduled marketplace token refresh job: every 45 minutes")

    except ImportError as e:
        logger.warning(f"Marketplace sync jobs not available: {e}")

    scheduler.start()
    logger.info("Scheduler started with Detection Engine job (every 15 minutes)")


def shutdown_scheduler():
    """Gracefully shutdown the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shutdown complete")


def get_all_jobs_status():
    """Get status of all scheduled jobs."""
    if not scheduler.running:
        return {"status": "not_running", "jobs": []}

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
            "pending": job.pending
        })

    return {
        "status": "running",
        "jobs": jobs
    }


def trigger_job_immediately(job_id: str) -> bool:
    """Manually trigger a job to run immediately."""
    if not scheduler.running:
        return False

    job = scheduler.get_job(job_id)
    if job is None:
        return False

    from datetime import datetime
    scheduler.modify_job(job_id, next_run_time=datetime.utcnow())
    return True


def pause_scheduled_job(job_id: str) -> bool:
    """Pause a scheduled job."""
    if not scheduler.running:
        return False

    try:
        scheduler.pause_job(job_id)
        return True
    except Exception:
        return False


def resume_scheduled_job(job_id: str) -> bool:
    """Resume a paused job."""
    if not scheduler.running:
        return False

    try:
        scheduler.resume_job(job_id)
        return True
    except Exception:
        return False
