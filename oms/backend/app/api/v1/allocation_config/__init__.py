"""
Allocation Configuration API v1
CSR Score Configuration and Shipping Allocation Rules Management
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    CSRScoreConfig, CSRScoreConfigCreate, CSRScoreConfigUpdate, CSRScoreConfigResponse,
    ShippingAllocationRule, ShippingAllocationRuleCreate, ShippingAllocationRuleUpdate, ShippingAllocationRuleResponse,
    AllocationAudit, AllocationAuditResponse,
    ShipmentType, AllocationMode, AllocationDecisionReason,
    Transporter,
    User
)

router = APIRouter(prefix="/allocation-config", tags=["Allocation Configuration"])


# ============================================================================
# CSR Score Config Endpoints
# ============================================================================

@router.get("/csr-configs", response_model=List[CSRScoreConfigResponse])
def list_csr_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    shipment_type: Optional[ShipmentType] = None,
    is_default: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List CSR score configurations."""
    query = select(CSRScoreConfig)

    query = company_filter.apply_filter(query, CSRScoreConfig.companyId)
    if shipment_type:
        query = query.where(
            (CSRScoreConfig.shipmentType == shipment_type.value) |
            (CSRScoreConfig.shipmentType.is_(None))
        )
    if is_default is not None:
        query = query.where(CSRScoreConfig.isDefault == is_default)

    query = query.offset(skip).limit(limit).order_by(CSRScoreConfig.name)
    configs = session.exec(query).all()
    return [CSRScoreConfigResponse.model_validate(c) for c in configs]


@router.get("/csr-configs/count")
def count_csr_configs(
    shipment_type: Optional[ShipmentType] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count CSR score configurations."""
    query = select(func.count(CSRScoreConfig.id))

    query = company_filter.apply_filter(query, CSRScoreConfig.companyId)
    if shipment_type:
        query = query.where(
            (CSRScoreConfig.shipmentType == shipment_type.value) |
            (CSRScoreConfig.shipmentType.is_(None))
        )

    count = session.exec(query).one()
    return {"count": count}


@router.get("/csr-configs/default")
def get_default_csr_config(
    shipment_type: Optional[ShipmentType] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get the default CSR config for a shipment type."""
    query = select(CSRScoreConfig).where(CSRScoreConfig.isDefault == True)
    query = company_filter.apply_filter(query, CSRScoreConfig.companyId)

    # Try to find shipment-type specific default first
    if shipment_type:
        specific_query = query.where(CSRScoreConfig.shipmentType == shipment_type.value)
        config = session.exec(specific_query).first()
        if config:
            return CSRScoreConfigResponse.model_validate(config)

    # Fall back to general default (NULL shipment type)
    general_query = query.where(CSRScoreConfig.shipmentType.is_(None))
    config = session.exec(general_query).first()
    if config:
        return CSRScoreConfigResponse.model_validate(config)

    # Return any default
    config = session.exec(query).first()
    if config:
        return CSRScoreConfigResponse.model_validate(config)

    raise HTTPException(status_code=404, detail="No default CSR config found")


@router.get("/csr-configs/{config_id}", response_model=CSRScoreConfigResponse)
def get_csr_config(
    config_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get CSR score config by ID."""
    query = select(CSRScoreConfig).where(CSRScoreConfig.id == config_id)
    query = company_filter.apply_filter(query, CSRScoreConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="CSR config not found")
    return CSRScoreConfigResponse.model_validate(config)


@router.post("/csr-configs", response_model=CSRScoreConfigResponse, status_code=status.HTTP_201_CREATED)
def create_csr_config(
    data: CSRScoreConfigCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new CSR score configuration."""
    # Validate weights sum to 1.0
    total_weight = data.costWeight + data.speedWeight + data.reliabilityWeight
    if abs(float(total_weight) - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"CSR weights must sum to 1.0 (current: {total_weight})"
        )

    # If this is default, unset other defaults
    if data.isDefault:
        existing_defaults = session.exec(
            select(CSRScoreConfig).where(
                CSRScoreConfig.companyId == (company_filter.company_id or data.companyId),
                CSRScoreConfig.isDefault == True
            )
        ).all()
        for cfg in existing_defaults:
            cfg.isDefault = False
            session.add(cfg)

    config = CSRScoreConfig(
        name=data.name,
        description=data.description,
        shipmentType=data.shipmentType.value if data.shipmentType else None,
        costWeight=data.costWeight,
        speedWeight=data.speedWeight,
        reliabilityWeight=data.reliabilityWeight,
        minReliabilityScore=data.minReliabilityScore,
        maxCostThreshold=data.maxCostThreshold,
        defaultMode=data.defaultMode.value if data.defaultMode else AllocationMode.AUTO.value,
        isDefault=data.isDefault,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(config)
    session.commit()
    session.refresh(config)
    return CSRScoreConfigResponse.model_validate(config)


@router.patch("/csr-configs/{config_id}", response_model=CSRScoreConfigResponse)
def update_csr_config(
    config_id: UUID,
    data: CSRScoreConfigUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update CSR score configuration."""
    query = select(CSRScoreConfig).where(CSRScoreConfig.id == config_id)
    query = company_filter.apply_filter(query, CSRScoreConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="CSR config not found")

    update_data = data.model_dump(exclude_unset=True)

    # Validate weights if any are being updated
    cost_w = update_data.get('costWeight', config.costWeight)
    speed_w = update_data.get('speedWeight', config.speedWeight)
    rel_w = update_data.get('reliabilityWeight', config.reliabilityWeight)
    total_weight = float(cost_w) + float(speed_w) + float(rel_w)
    if abs(total_weight - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"CSR weights must sum to 1.0 (would be: {total_weight})"
        )

    # Handle enums
    if 'shipmentType' in update_data and update_data['shipmentType']:
        update_data['shipmentType'] = update_data['shipmentType'].value
    if 'defaultMode' in update_data and update_data['defaultMode']:
        update_data['defaultMode'] = update_data['defaultMode'].value

    # If setting as default, unset other defaults
    if update_data.get('isDefault'):
        existing_defaults = session.exec(
            select(CSRScoreConfig).where(
                CSRScoreConfig.companyId == config.companyId,
                CSRScoreConfig.isDefault == True,
                CSRScoreConfig.id != config_id
            )
        ).all()
        for cfg in existing_defaults:
            cfg.isDefault = False
            session.add(cfg)

    for field, value in update_data.items():
        setattr(config, field, value)

    session.add(config)
    session.commit()
    session.refresh(config)
    return CSRScoreConfigResponse.model_validate(config)


@router.delete("/csr-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_csr_config(
    config_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete CSR score configuration."""
    query = select(CSRScoreConfig).where(CSRScoreConfig.id == config_id)
    query = company_filter.apply_filter(query, CSRScoreConfig.companyId)

    config = session.exec(query).first()
    if not config:
        raise HTTPException(status_code=404, detail="CSR config not found")

    if config.isDefault:
        raise HTTPException(status_code=400, detail="Cannot delete default CSR config")

    session.delete(config)
    session.commit()


# ============================================================================
# Shipping Allocation Rule Endpoints
# ============================================================================

@router.get("/rules", response_model=List[ShippingAllocationRuleResponse])
def list_allocation_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    shipment_type: Optional[ShipmentType] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List shipping allocation rules."""
    query = select(ShippingAllocationRule)

    query = company_filter.apply_filter(query, ShippingAllocationRule.companyId)
    if shipment_type:
        query = query.where(
            (ShippingAllocationRule.shipmentType == shipment_type.value) |
            (ShippingAllocationRule.shipmentType.is_(None))
        )
    if is_active is not None:
        query = query.where(ShippingAllocationRule.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(ShippingAllocationRule.priority)
    rules = session.exec(query).all()

    # Enrich with joined data
    result = []
    for rule in rules:
        response = ShippingAllocationRuleResponse.model_validate(rule)
        if rule.transporterId:
            transporter = session.get(Transporter, rule.transporterId)
            if transporter:
                response.transporterName = transporter.name
        if rule.csrConfigId:
            csr_config = session.get(CSRScoreConfig, rule.csrConfigId)
            if csr_config:
                response.csrConfigName = csr_config.name
        result.append(response)

    return result


@router.get("/rules/count")
def count_allocation_rules(
    shipment_type: Optional[ShipmentType] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count shipping allocation rules."""
    query = select(func.count(ShippingAllocationRule.id))

    query = company_filter.apply_filter(query, ShippingAllocationRule.companyId)
    if shipment_type:
        query = query.where(
            (ShippingAllocationRule.shipmentType == shipment_type.value) |
            (ShippingAllocationRule.shipmentType.is_(None))
        )
    if is_active is not None:
        query = query.where(ShippingAllocationRule.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/rules/{rule_id}", response_model=ShippingAllocationRuleResponse)
def get_allocation_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get shipping allocation rule by ID."""
    query = select(ShippingAllocationRule).where(ShippingAllocationRule.id == rule_id)
    query = company_filter.apply_filter(query, ShippingAllocationRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Allocation rule not found")

    response = ShippingAllocationRuleResponse.model_validate(rule)
    if rule.transporterId:
        transporter = session.get(Transporter, rule.transporterId)
        if transporter:
            response.transporterName = transporter.name
    if rule.csrConfigId:
        csr_config = session.get(CSRScoreConfig, rule.csrConfigId)
        if csr_config:
            response.csrConfigName = csr_config.name

    return response


@router.post("/rules", response_model=ShippingAllocationRuleResponse, status_code=status.HTTP_201_CREATED)
def create_allocation_rule(
    data: ShippingAllocationRuleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new shipping allocation rule."""
    # Validate either transporterId or useCSRScoring is set
    if not data.transporterId and not data.useCSRScoring:
        raise HTTPException(
            status_code=400,
            detail="Either transporterId or useCSRScoring must be set"
        )

    # Check for duplicate code
    existing = session.exec(
        select(ShippingAllocationRule).where(
            ShippingAllocationRule.code == data.code,
            ShippingAllocationRule.companyId == (company_filter.company_id or data.companyId)
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rule code already exists")

    # Validate transporter if provided
    transporter = None
    if data.transporterId:
        transporter = session.get(Transporter, data.transporterId)
        if not transporter:
            raise HTTPException(status_code=400, detail="Transporter not found")

    # Validate CSR config if provided
    csr_config = None
    if data.csrConfigId:
        csr_config = session.get(CSRScoreConfig, data.csrConfigId)
        if not csr_config:
            raise HTTPException(status_code=400, detail="CSR config not found")

    rule = ShippingAllocationRule(
        code=data.code,
        name=data.name,
        description=data.description,
        priority=data.priority,
        shipmentType=data.shipmentType.value if data.shipmentType else None,
        conditions=data.conditions,
        transporterId=data.transporterId,
        useCSRScoring=data.useCSRScoring,
        csrConfigId=data.csrConfigId,
        fallbackTransporterId=data.fallbackTransporterId,
        companyId=company_filter.company_id or data.companyId
    )

    session.add(rule)
    session.commit()
    session.refresh(rule)

    response = ShippingAllocationRuleResponse.model_validate(rule)
    if transporter:
        response.transporterName = transporter.name
    if csr_config:
        response.csrConfigName = csr_config.name

    return response


@router.patch("/rules/{rule_id}", response_model=ShippingAllocationRuleResponse)
def update_allocation_rule(
    rule_id: UUID,
    data: ShippingAllocationRuleUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update shipping allocation rule."""
    query = select(ShippingAllocationRule).where(ShippingAllocationRule.id == rule_id)
    query = company_filter.apply_filter(query, ShippingAllocationRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Allocation rule not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle enum conversion
    if 'shipmentType' in update_data and update_data['shipmentType']:
        update_data['shipmentType'] = update_data['shipmentType'].value

    for field, value in update_data.items():
        setattr(rule, field, value)

    session.add(rule)
    session.commit()
    session.refresh(rule)

    response = ShippingAllocationRuleResponse.model_validate(rule)
    if rule.transporterId:
        transporter = session.get(Transporter, rule.transporterId)
        if transporter:
            response.transporterName = transporter.name
    if rule.csrConfigId:
        csr_config = session.get(CSRScoreConfig, rule.csrConfigId)
        if csr_config:
            response.csrConfigName = csr_config.name

    return response


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allocation_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Delete shipping allocation rule (soft delete)."""
    query = select(ShippingAllocationRule).where(ShippingAllocationRule.id == rule_id)
    query = company_filter.apply_filter(query, ShippingAllocationRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Allocation rule not found")

    rule.isActive = False
    session.add(rule)
    session.commit()


@router.post("/rules/{rule_id}/reorder")
def reorder_allocation_rule(
    rule_id: UUID,
    new_priority: int = Query(..., ge=1),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Change the priority of an allocation rule."""
    query = select(ShippingAllocationRule).where(ShippingAllocationRule.id == rule_id)
    query = company_filter.apply_filter(query, ShippingAllocationRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Allocation rule not found")

    old_priority = rule.priority
    rule.priority = new_priority
    session.add(rule)
    session.commit()
    session.refresh(rule)

    return {
        "id": str(rule.id),
        "code": rule.code,
        "oldPriority": old_priority,
        "newPriority": new_priority
    }


# ============================================================================
# Allocation Audit Endpoints
# ============================================================================

@router.get("/audit", response_model=List[AllocationAuditResponse])
def list_allocation_audit(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    shipment_type: Optional[ShipmentType] = None,
    allocation_mode: Optional[AllocationMode] = None,
    order_id: Optional[UUID] = None,
    transporter_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List allocation audit trail."""
    query = select(AllocationAudit)

    query = company_filter.apply_filter(query, AllocationAudit.companyId)
    if shipment_type:
        query = query.where(AllocationAudit.shipmentType == shipment_type.value)
    if allocation_mode:
        query = query.where(AllocationAudit.allocationMode == allocation_mode.value)
    if order_id:
        query = query.where(AllocationAudit.orderId == order_id)
    if transporter_id:
        query = query.where(AllocationAudit.selectedTransporterId == transporter_id)
    if from_date:
        query = query.where(AllocationAudit.createdAt >= from_date)
    if to_date:
        query = query.where(AllocationAudit.createdAt <= to_date)

    query = query.offset(skip).limit(limit).order_by(AllocationAudit.createdAt.desc())
    audits = session.exec(query).all()

    # Enrich with transporter name
    result = []
    for audit in audits:
        response = AllocationAuditResponse.model_validate(audit)
        transporter = session.get(Transporter, audit.selectedTransporterId)
        if transporter:
            response.transporterName = transporter.name
        result.append(response)

    return result


@router.get("/audit/count")
def count_allocation_audit(
    shipment_type: Optional[ShipmentType] = None,
    allocation_mode: Optional[AllocationMode] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count allocation audit entries."""
    query = select(func.count(AllocationAudit.id))

    query = company_filter.apply_filter(query, AllocationAudit.companyId)
    if shipment_type:
        query = query.where(AllocationAudit.shipmentType == shipment_type.value)
    if allocation_mode:
        query = query.where(AllocationAudit.allocationMode == allocation_mode.value)
    if from_date:
        query = query.where(AllocationAudit.createdAt >= from_date)
    if to_date:
        query = query.where(AllocationAudit.createdAt <= to_date)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/audit/{audit_id}", response_model=AllocationAuditResponse)
def get_allocation_audit(
    audit_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get allocation audit entry by ID."""
    query = select(AllocationAudit).where(AllocationAudit.id == audit_id)
    query = company_filter.apply_filter(query, AllocationAudit.companyId)

    audit = session.exec(query).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit entry not found")

    response = AllocationAuditResponse.model_validate(audit)
    transporter = session.get(Transporter, audit.selectedTransporterId)
    if transporter:
        response.transporterName = transporter.name

    return response
