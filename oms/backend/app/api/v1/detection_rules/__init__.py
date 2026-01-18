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
    current_user: User = Depends(require_admin)
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
    current_user: User = Depends(require_admin)
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
    current_user: User = Depends(require_admin)
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
    current_user: User = Depends(require_admin)
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


@router.get("/types/list")
def list_rule_types(
    current_user: User = Depends(get_current_user)
):
    """Get list of available rule types and entity types."""
    return {
        "ruleTypes": [
            {"value": "STUCK_ORDER", "label": "Stuck Order", "description": "Detects orders stuck in a status"},
            {"value": "SLA_BREACH", "label": "SLA Breach", "description": "Detects deliveries past expected date"},
            {"value": "NDR_ESCALATION", "label": "NDR Escalation", "description": "Detects unresolved NDRs"},
            {"value": "CARRIER_DELAY", "label": "Carrier Delay", "description": "Detects shipments delayed in transit"},
            {"value": "INVENTORY_ISSUE", "label": "Inventory Issue", "description": "Detects stock anomalies"},
            {"value": "PAYMENT_ISSUE", "label": "Payment Issue", "description": "Detects payment/COD issues"},
            {"value": "CUSTOM", "label": "Custom", "description": "Custom rule type"},
        ],
        "entityTypes": [
            {"value": "Order", "label": "Order", "fields": ["status", "createdAt", "totalAmount", "paymentMode"]},
            {"value": "Delivery", "label": "Delivery", "fields": ["status", "createdAt", "expectedDeliveryDate", "dispatchedAt"]},
            {"value": "NDR", "label": "NDR", "fields": ["status", "reason", "attemptNumber", "createdAt"]},
            {"value": "Return", "label": "Return", "fields": ["status", "reason", "createdAt"]},
            {"value": "Inventory", "label": "Inventory", "fields": ["quantity", "reservedQty", "reorderLevel"]},
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
            {"value": "AUTO_CLASSIFY", "label": "Auto Classify"},
            {"value": "AUTO_OUTREACH", "label": "Auto Outreach"},
            {"value": "AUTO_ESCALATE", "label": "Auto Escalate"},
            {"value": "AUTO_RESOLVE", "label": "Auto Resolve"},
            {"value": "RECOMMEND", "label": "Recommend Action"},
            {"value": "PREDICT", "label": "Predict Outcome"},
        ]
    }
