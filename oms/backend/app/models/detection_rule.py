"""
Detection Rule Models - SQLModel Implementation
Configurable rules for the Exception Detection Engine
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Boolean, Integer, JSON, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase


# =============================================================================
# Enums for Detection Rules
# =============================================================================

class RuleType:
    """Types of detection rules"""
    STUCK_ORDER = "STUCK_ORDER"
    SLA_BREACH = "SLA_BREACH"
    NDR_ESCALATION = "NDR_ESCALATION"
    CARRIER_DELAY = "CARRIER_DELAY"
    INVENTORY_ISSUE = "INVENTORY_ISSUE"
    PAYMENT_ISSUE = "PAYMENT_ISSUE"
    CUSTOM = "CUSTOM"


class EntityType:
    """Entity types that rules can monitor"""
    ORDER = "Order"
    DELIVERY = "Delivery"
    NDR = "NDR"
    RETURN = "Return"
    INVENTORY = "Inventory"


class Operator:
    """Operators for rule conditions"""
    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_THAN_OR_EQUALS = ">="
    LESS_THAN_OR_EQUALS = "<="
    IN = "IN"
    NOT_IN = "NOT_IN"
    IS_NULL = "IS_NULL"
    IS_NOT_NULL = "IS_NOT_NULL"
    AGE_HOURS = "AGE_HOURS"  # Time since field value in hours
    AGE_DAYS = "AGE_DAYS"    # Time since field value in days


class AIActionType:
    """Types of AI actions that can be triggered"""
    AUTO_CLASSIFY = "AUTO_CLASSIFY"
    AUTO_OUTREACH = "AUTO_OUTREACH"
    AUTO_ESCALATE = "AUTO_ESCALATE"
    AUTO_RESOLVE = "AUTO_RESOLVE"
    RECOMMEND = "RECOMMEND"
    PREDICT = "PREDICT"


# =============================================================================
# Database Model
# =============================================================================

class DetectionRule(BaseModel, table=True):
    """
    Detection Rule model - Configurable rules for the exception detection engine.
    Rules define conditions to detect operational anomalies and trigger actions.
    """
    __tablename__ = "DetectionRule"

    # Identity
    name: str = Field(sa_column=Column(String, nullable=False))
    description: Optional[str] = Field(default=None)
    ruleCode: str = Field(sa_column=Column(String, unique=True, nullable=False))

    # Rule Type & Entity
    ruleType: str = Field(sa_column=Column(String, nullable=False, index=True))
    entityType: str = Field(sa_column=Column(String, nullable=False, index=True))

    # Conditions (JSON array)
    # Example: [{"field": "status", "operator": "=", "value": "CREATED"},
    #           {"field": "createdAt", "operator": "AGE_HOURS", "value": 4}]
    conditions: Dict[str, Any] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False)
    )

    # Severity Rules (JSON object)
    # Example: {"CRITICAL": 24, "HIGH": 12, "MEDIUM": 4, "LOW": 0}
    # The number represents the threshold (hours/days/count) for that severity
    severityRules: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False)
    )
    severityField: str = Field(default="createdAt")  # Field to calculate severity from
    severityUnit: str = Field(default="hours")  # hours, days, count

    # Default severity if no rules match
    defaultSeverity: str = Field(default="MEDIUM")
    defaultPriority: int = Field(default=3)

    # AI Action Configuration
    aiActionEnabled: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    aiActionType: Optional[str] = Field(default=None)
    aiActionConfig: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Auto-resolve configuration
    autoResolveEnabled: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    autoResolveConditions: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON)
    )

    # Rule Status
    isActive: bool = Field(default=True, sa_column=Column(Boolean, default=True, index=True))
    isGlobal: bool = Field(default=False, sa_column=Column(Boolean, default=False))

    # Scope
    companyId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )

    # Execution tracking
    lastExecutedAt: Optional[datetime] = Field(default=None)
    executionCount: int = Field(default=0, sa_column=Column(Integer, default=0))
    exceptionsCreated: int = Field(default=0, sa_column=Column(Integer, default=0))

    # Metadata
    createdBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )


# =============================================================================
# Request/Response Schemas
# =============================================================================

class DetectionRuleCondition(SQLModel):
    """Schema for a single rule condition"""
    field: str
    operator: str
    value: Any
    logicalOperator: Optional[str] = "AND"  # AND, OR


class DetectionRuleSeverity(SQLModel):
    """Schema for severity thresholds"""
    CRITICAL: Optional[int] = None
    HIGH: Optional[int] = None
    MEDIUM: Optional[int] = None
    LOW: Optional[int] = None


class DetectionRuleCreate(CreateBase):
    """Schema for creating a detection rule"""
    name: str
    description: Optional[str] = None
    ruleType: str
    entityType: str
    conditions: List[Dict[str, Any]]
    severityRules: Dict[str, int]
    severityField: str = "createdAt"
    severityUnit: str = "hours"
    defaultSeverity: str = "MEDIUM"
    defaultPriority: int = 3
    aiActionEnabled: bool = False
    aiActionType: Optional[str] = None
    aiActionConfig: Optional[Dict[str, Any]] = None
    autoResolveEnabled: bool = False
    autoResolveConditions: Optional[Dict[str, Any]] = None
    isActive: bool = True
    isGlobal: bool = False


class DetectionRuleUpdate(UpdateBase):
    """Schema for updating a detection rule"""
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[List[Dict[str, Any]]] = None
    severityRules: Optional[Dict[str, int]] = None
    severityField: Optional[str] = None
    severityUnit: Optional[str] = None
    defaultSeverity: Optional[str] = None
    defaultPriority: Optional[int] = None
    aiActionEnabled: Optional[bool] = None
    aiActionType: Optional[str] = None
    aiActionConfig: Optional[Dict[str, Any]] = None
    autoResolveEnabled: Optional[bool] = None
    autoResolveConditions: Optional[Dict[str, Any]] = None
    isActive: Optional[bool] = None


class DetectionRuleResponse(ResponseBase):
    """Schema for detection rule API responses"""
    id: UUID
    name: str
    description: Optional[str]
    ruleCode: str
    ruleType: str
    entityType: str
    conditions: List[Dict[str, Any]]
    severityRules: Dict[str, int]
    severityField: str
    severityUnit: str
    defaultSeverity: str
    defaultPriority: int
    aiActionEnabled: bool
    aiActionType: Optional[str]
    aiActionConfig: Optional[Dict[str, Any]]
    autoResolveEnabled: bool
    autoResolveConditions: Optional[Dict[str, Any]]
    isActive: bool
    isGlobal: bool
    companyId: Optional[UUID]
    lastExecutedAt: Optional[datetime]
    executionCount: int
    exceptionsCreated: int
    createdAt: datetime
    updatedAt: datetime


class DetectionRuleBrief(SQLModel):
    """Brief detection rule info for lists"""
    id: UUID
    name: str
    ruleCode: str
    ruleType: str
    entityType: str
    isActive: bool
    executionCount: int
    exceptionsCreated: int
