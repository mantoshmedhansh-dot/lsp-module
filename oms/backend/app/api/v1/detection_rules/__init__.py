"""
Detection Rules API v1 - CRUD for configurable detection rules
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_admin, CompanyFilter
from app.models.detection_rule import (
    DetectionRule,
    DetectionRuleCreate,
    DetectionRuleUpdate,
    DetectionRuleResponse,
    DetectionRuleBrief,
)
from app.models.user import User

router = APIRouter(prefix="/detection-rules", tags=["Detection Rules"])


@router.get("", response_model=List[DetectionRuleResponse])
def list_detection_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ruleType: Optional[str] = None,
    entityType: Optional[str] = None,
    isActive: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List detection rules. Shows global rules and company-specific rules."""
    query = select(DetectionRule)

    # Show global rules OR company-specific rules
    if company_filter.company_id:
        query = query.where(
            (DetectionRule.isGlobal == True) |
            (DetectionRule.companyId == company_filter.company_id)
        )
    else:
        query = query.where(DetectionRule.isGlobal == True)

    if ruleType:
        query = query.where(DetectionRule.ruleType == ruleType)
    if entityType:
        query = query.where(DetectionRule.entityType == entityType)
    if isActive is not None:
        query = query.where(DetectionRule.isActive == isActive)

    query = query.offset(skip).limit(limit).order_by(DetectionRule.createdAt.desc())
    rules = session.exec(query).all()

    return [DetectionRuleResponse.model_validate(r) for r in rules]


@router.get("/count")
def count_detection_rules(
    isActive: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of detection rules."""
    query = select(func.count(DetectionRule.id))

    if company_filter.company_id:
        query = query.where(
            (DetectionRule.isGlobal == True) |
            (DetectionRule.companyId == company_filter.company_id)
        )
    if isActive is not None:
        query = query.where(DetectionRule.isActive == isActive)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{rule_id}", response_model=DetectionRuleResponse)
def get_detection_rule(
    rule_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get detection rule by ID."""
    rule = session.get(DetectionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Detection rule not found")
    return DetectionRuleResponse.model_validate(rule)


@router.post("", response_model=DetectionRuleResponse, status_code=status.HTTP_201_CREATED)
def create_detection_rule(
    data: DetectionRuleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin()),
    current_user: User = Depends(get_current_user)
):
    """Create a new detection rule. Admin only."""
    # Generate rule code
    count = session.exec(select(func.count(DetectionRule.id))).one()
    rule_code = f"RULE-{data.ruleType[:3]}-{count + 1:04d}"

    rule = DetectionRule(
        id=uuid4(),
        ruleCode=rule_code,
        companyId=None if data.isGlobal else company_filter.company_id,
        createdBy=current_user.id,
        **data.model_dump()
    )

    session.add(rule)
    session.commit()
    session.refresh(rule)

    return DetectionRuleResponse.model_validate(rule)


@router.patch("/{rule_id}", response_model=DetectionRuleResponse)
def update_detection_rule(
    rule_id: UUID,
    data: DetectionRuleUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_admin()),
    current_user: User = Depends(get_current_user)
):
    """Update detection rule. Admin only."""
    rule = session.get(DetectionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Detection rule not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    rule.updatedAt = datetime.utcnow()
    session.add(rule)
    session.commit()
    session.refresh(rule)

    return DetectionRuleResponse.model_validate(rule)


@router.delete("/{rule_id}")
def delete_detection_rule(
    rule_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Delete detection rule. Admin only."""
    rule = session.get(DetectionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Detection rule not found")

    session.delete(rule)
    session.commit()

    return {"message": "Detection rule deleted"}


@router.post("/{rule_id}/toggle", response_model=DetectionRuleResponse)
def toggle_detection_rule(
    rule_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Toggle detection rule active status. Admin only."""
    rule = session.get(DetectionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Detection rule not found")

    rule.isActive = not rule.isActive
    rule.updatedAt = datetime.utcnow()
    session.add(rule)
    session.commit()
    session.refresh(rule)

    return DetectionRuleResponse.model_validate(rule)


@router.post("/seed-ndr-rules")
def seed_ndr_detection_rules(
    session: Session = Depends(get_session),
    _: None = Depends(require_admin()),
    current_user: User = Depends(get_current_user)
):
    """
    Create pre-configured NDR detection rules for Control Tower integration.
    Admin only. Skips rules that already exist (by ruleCode).
    """
    now = datetime.utcnow()
    created = []
    skipped = []

    # Pre-configured NDR rules
    ndr_rules = [
        {
            "name": "NDR Aging Alert",
            "ruleCode": "RULE-NDR-AGING-001",
            "description": "NDR open without action for 4+ hours",
            "ruleType": "NDR_AGING",
            "entityType": "NDR",
            "conditions": [
                {"field": "status", "operator": "=", "value": "OPEN"},
                {"field": "createdAt", "operator": "AGE_HOURS", "value": 4}
            ],
            "severityRules": {"CRITICAL": 24, "HIGH": 12, "MEDIUM": 4, "LOW": 0},
            "severityField": "createdAt",
            "severityUnit": "hours",
            "defaultSeverity": "MEDIUM",
            "aiActionEnabled": True,
            "aiActionType": "AUTO_OUTREACH",
            "autoResolveEnabled": True,
        },
        {
            "name": "Multi-Attempt NDR",
            "ruleCode": "RULE-NDR-MULTI-001",
            "description": "NDR with 2+ failed delivery attempts",
            "ruleType": "NDR_MULTI_ATTEMPT",
            "entityType": "NDR",
            "conditions": [
                {"field": "attemptNumber", "operator": ">=", "value": 2},
                {"field": "status", "operator": "IN", "value": ["OPEN", "ACTION_REQUESTED"]}
            ],
            "severityRules": {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 0},
            "severityField": "attemptNumber",
            "severityUnit": "count",
            "defaultSeverity": "HIGH",
            "aiActionEnabled": True,
            "aiActionType": "AUTO_ESCALATE",
            "autoResolveEnabled": True,
        },
        {
            "name": "No Customer Response",
            "ruleCode": "RULE-NDR-NORESP-001",
            "description": "Outreach sent but no response for 12+ hours",
            "ruleType": "NDR_NO_RESPONSE",
            "entityType": "NDR",
            "conditions": [
                {"field": "status", "operator": "=", "value": "ACTION_REQUESTED"},
                {"field": "updatedAt", "operator": "AGE_HOURS", "value": 12}
            ],
            "severityRules": {"CRITICAL": 48, "HIGH": 24, "MEDIUM": 12, "LOW": 0},
            "severityField": "updatedAt",
            "severityUnit": "hours",
            "defaultSeverity": "MEDIUM",
            "aiActionEnabled": True,
            "aiActionType": "AUTO_OUTREACH",
            "aiActionConfig": {"channel": "SMS", "retry": True},
            "autoResolveEnabled": True,
        },
        {
            "name": "Address Issue NDR",
            "ruleCode": "RULE-NDR-ADDR-001",
            "description": "NDR with address-related failure reason",
            "ruleType": "NDR_ADDRESS_ISSUE",
            "entityType": "NDR",
            "conditions": [
                {"field": "reason", "operator": "IN", "value": ["WRONG_ADDRESS", "INCOMPLETE_ADDRESS", "ADDRESS_NOT_FOUND"]},
                {"field": "status", "operator": "=", "value": "OPEN"}
            ],
            "severityRules": {},
            "defaultSeverity": "MEDIUM",
            "aiActionEnabled": True,
            "aiActionType": "AUTO_OUTREACH",
            "aiActionConfig": {"channel": "WHATSAPP", "template": "address_update"},
            "autoResolveEnabled": True,
        },
        {
            "name": "COD Risk NDR",
            "ruleCode": "RULE-NDR-COD-001",
            "description": "COD not ready with 2+ attempts",
            "ruleType": "NDR_COD_RISK",
            "entityType": "NDR",
            "conditions": [
                {"field": "reason", "operator": "=", "value": "COD_NOT_READY"},
                {"field": "attemptNumber", "operator": ">=", "value": 2}
            ],
            "severityRules": {},
            "defaultSeverity": "HIGH",
            "aiActionEnabled": True,
            "aiActionType": "RECOMMEND",
            "aiActionConfig": {"recommendation": "Consider converting to prepaid or RTO"},
            "autoResolveEnabled": True,
        },
        {
            "name": "RTO Candidate",
            "ruleCode": "RULE-NDR-RTO-001",
            "description": "NDR with 3+ attempts and 72+ hours old",
            "ruleType": "NDR_RTO_CANDIDATE",
            "entityType": "NDR",
            "conditions": [
                {"field": "attemptNumber", "operator": ">=", "value": 3},
                {"field": "createdAt", "operator": "AGE_HOURS", "value": 72},
                {"field": "status", "operator": "IN", "value": ["OPEN", "ACTION_REQUESTED"]}
            ],
            "severityRules": {},
            "defaultSeverity": "CRITICAL",
            "aiActionEnabled": True,
            "aiActionType": "RECOMMEND",
            "aiActionConfig": {"recommendation": "Initiate RTO"},
            "autoResolveEnabled": True,
        },
        {
            "name": "Critical NDR Escalation",
            "ruleCode": "RULE-NDR-ESC-001",
            "description": "High priority NDR requiring immediate attention",
            "ruleType": "NDR_ESCALATION",
            "entityType": "NDR",
            "conditions": [
                {"field": "priority", "operator": "=", "value": "CRITICAL"},
                {"field": "status", "operator": "=", "value": "OPEN"}
            ],
            "severityRules": {},
            "defaultSeverity": "CRITICAL",
            "aiActionEnabled": True,
            "aiActionType": "AUTO_ESCALATE",
            "autoResolveEnabled": True,
        },
    ]

    for rule_data in ndr_rules:
        # Check if rule already exists
        existing = session.exec(
            select(DetectionRule).where(DetectionRule.ruleCode == rule_data["ruleCode"])
        ).first()

        if existing:
            skipped.append(rule_data["ruleCode"])
            continue

        rule = DetectionRule(
            id=uuid4(),
            name=rule_data["name"],
            ruleCode=rule_data["ruleCode"],
            description=rule_data.get("description"),
            ruleType=rule_data["ruleType"],
            entityType=rule_data["entityType"],
            conditions=rule_data.get("conditions", []),
            severityRules=rule_data.get("severityRules", {}),
            severityField=rule_data.get("severityField", "createdAt"),
            severityUnit=rule_data.get("severityUnit", "hours"),
            defaultSeverity=rule_data.get("defaultSeverity", "MEDIUM"),
            defaultPriority=3,
            aiActionEnabled=rule_data.get("aiActionEnabled", False),
            aiActionType=rule_data.get("aiActionType"),
            aiActionConfig=rule_data.get("aiActionConfig"),
            autoResolveEnabled=rule_data.get("autoResolveEnabled", False),
            isActive=True,
            isGlobal=True,
            companyId=None,
            createdBy=current_user.id,
            createdAt=now,
            updatedAt=now,
        )
        session.add(rule)
        created.append(rule_data["ruleCode"])

    session.commit()

    return {
        "success": True,
        "message": f"Created {len(created)} NDR detection rules, skipped {len(skipped)} existing",
        "created": created,
        "skipped": skipped
    }


@router.get("/types/list")
def list_rule_types(
    current_user: User = Depends(get_current_user)
):
    """Get list of available rule types and entity types."""
    return {
        "ruleTypes": [
            # Order & Delivery Rules
            {"value": "STUCK_ORDER", "label": "Stuck Order", "description": "Detects orders stuck in a status", "entityTypes": ["Order"]},
            {"value": "SLA_BREACH", "label": "SLA Breach", "description": "Detects deliveries past expected date", "entityTypes": ["Order", "Delivery"]},
            {"value": "CARRIER_DELAY", "label": "Carrier Delay", "description": "Detects shipments delayed in transit", "entityTypes": ["Delivery"]},
            {"value": "PAYMENT_ISSUE", "label": "Payment Issue", "description": "Detects payment/COD issues", "entityTypes": ["Order"]},
            # NDR-Specific Rules (Control Tower Integration)
            {"value": "NDR_AGING", "label": "NDR Aging Alert", "description": "NDR open without action for too long", "entityTypes": ["NDR"]},
            {"value": "NDR_MULTI_ATTEMPT", "label": "Multi-Attempt NDR", "description": "NDR with multiple failed delivery attempts", "entityTypes": ["NDR"]},
            {"value": "NDR_NO_RESPONSE", "label": "No Customer Response", "description": "Outreach sent but no customer response", "entityTypes": ["NDR"]},
            {"value": "NDR_HIGH_VALUE", "label": "High-Value NDR", "description": "NDR for high-value order requiring attention", "entityTypes": ["NDR"]},
            {"value": "NDR_COD_RISK", "label": "COD Risk NDR", "description": "COD order with multiple NDR failures", "entityTypes": ["NDR"]},
            {"value": "NDR_ADDRESS_ISSUE", "label": "Address Issue NDR", "description": "NDR with address-related failure reason", "entityTypes": ["NDR"]},
            {"value": "NDR_RTO_CANDIDATE", "label": "RTO Candidate", "description": "NDR likely to become RTO", "entityTypes": ["NDR"]},
            {"value": "NDR_ESCALATION", "label": "NDR Escalation", "description": "NDR requiring management attention", "entityTypes": ["NDR"]},
            # Other Rules
            {"value": "INVENTORY_ISSUE", "label": "Inventory Issue", "description": "Detects stock anomalies", "entityTypes": ["Inventory"]},
            {"value": "RETURN_AGING", "label": "Return Aging", "description": "Return pending processing for too long", "entityTypes": ["Return"]},
            {"value": "CUSTOM", "label": "Custom", "description": "Custom rule type", "entityTypes": ["Order", "Delivery", "NDR", "Return", "Inventory"]},
        ],
        "entityTypes": [
            {"value": "Order", "label": "Order", "fields": ["status", "createdAt", "totalAmount", "paymentMode", "channel"]},
            {"value": "Delivery", "label": "Delivery", "fields": ["status", "createdAt", "expectedDeliveryDate", "dispatchedAt", "deliveredAt"]},
            {
                "value": "NDR",
                "label": "NDR",
                "fields": [
                    "status", "reason", "attemptNumber", "createdAt", "updatedAt",
                    "priority", "riskScore", "reattemptDate", "customerResponse"
                ]
            },
            {"value": "Return", "label": "Return", "fields": ["status", "reason", "createdAt", "returnType"]},
            {"value": "Inventory", "label": "Inventory", "fields": ["quantity", "reservedQty", "reorderLevel", "availableQty"]},
        ],
        "operators": [
            {"value": "=", "label": "Equals"},
            {"value": "!=", "label": "Not Equals"},
            {"value": ">", "label": "Greater Than"},
            {"value": "<", "label": "Less Than"},
            {"value": ">=", "label": "Greater Than or Equals"},
            {"value": "<=", "label": "Less Than or Equals"},
            {"value": "IN", "label": "In List"},
            {"value": "NOT_IN", "label": "Not In List"},
            {"value": "IS_NULL", "label": "Is Null"},
            {"value": "IS_NOT_NULL", "label": "Is Not Null"},
            {"value": "AGE_HOURS", "label": "Age in Hours (from now)"},
            {"value": "AGE_DAYS", "label": "Age in Days (from now)"},
        ],
        "severities": ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        "aiActionTypes": [
            # General Actions
            {"value": "AUTO_CLASSIFY", "label": "Auto Classify", "description": "Automatically classify the issue"},
            {"value": "RECOMMEND", "label": "Recommend Action", "description": "AI recommends action for approval"},
            {"value": "PREDICT", "label": "Predict Outcome", "description": "Predict likely outcome"},
            # NDR-Specific Actions
            {"value": "AUTO_OUTREACH", "label": "Auto Outreach", "description": "Automatically send customer outreach (WhatsApp/SMS/Email)"},
            {"value": "AUTO_ESCALATE", "label": "Auto Escalate", "description": "Automatically escalate to manager"},
            {"value": "AUTO_REATTEMPT", "label": "Auto Schedule Reattempt", "description": "Automatically schedule delivery reattempt"},
            {"value": "AUTO_RTO", "label": "Auto Initiate RTO", "description": "Automatically initiate return-to-origin"},
            {"value": "AUTO_RESOLVE", "label": "Auto Resolve", "description": "Automatically resolve when conditions met"},
        ],
        # NDR-specific configuration options
        "ndrReasons": [
            {"value": "CUSTOMER_UNAVAILABLE", "label": "Customer Unavailable"},
            {"value": "WRONG_ADDRESS", "label": "Wrong Address"},
            {"value": "INCOMPLETE_ADDRESS", "label": "Incomplete Address"},
            {"value": "CUSTOMER_REFUSED", "label": "Customer Refused"},
            {"value": "COD_NOT_READY", "label": "COD Not Ready"},
            {"value": "PHONE_UNREACHABLE", "label": "Phone Unreachable"},
            {"value": "DELIVERY_RESCHEDULED", "label": "Delivery Rescheduled"},
            {"value": "ADDRESS_NOT_FOUND", "label": "Address Not Found"},
            {"value": "AREA_NOT_SERVICEABLE", "label": "Area Not Serviceable"},
            {"value": "NATURAL_DISASTER", "label": "Natural Disaster"},
            {"value": "OTHER", "label": "Other"},
        ],
        "ndrStatuses": [
            {"value": "OPEN", "label": "Open"},
            {"value": "ACTION_REQUESTED", "label": "Action Requested"},
            {"value": "REATTEMPT_SCHEDULED", "label": "Reattempt Scheduled"},
            {"value": "RESOLVED", "label": "Resolved"},
            {"value": "RTO", "label": "RTO"},
            {"value": "CLOSED", "label": "Closed"},
        ],
        "outreachChannels": [
            {"value": "WHATSAPP", "label": "WhatsApp"},
            {"value": "SMS", "label": "SMS"},
            {"value": "EMAIL", "label": "Email"},
            {"value": "AI_VOICE", "label": "AI Voice Call"},
            {"value": "IVR", "label": "IVR"},
        ]
    }
