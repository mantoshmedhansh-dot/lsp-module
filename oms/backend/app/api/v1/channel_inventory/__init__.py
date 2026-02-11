"""
Channel Inventory API v1
Manage channel-wise inventory allocation rules and channel inventory
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, SKU, Location,
    ChannelInventoryRule,
    ChannelInventoryRuleCreate,
    ChannelInventoryRuleUpdate,
    ChannelInventoryRuleResponse,
    ChannelInventory,
    ChannelInventoryCreate,
    ChannelInventoryUpdate,
    ChannelInventoryResponse,
    ChannelInventorySummary,
    Channel,
)

router = APIRouter(prefix="/channel-inventory", tags=["Channel Inventory"])


# ============================================================================
# Channel Inventory Rules CRUD
# ============================================================================

@router.get("/rules", response_model=List[ChannelInventoryRuleResponse])
def list_channel_inventory_rules(
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List channel inventory allocation rules with filters."""
    query = select(ChannelInventoryRule)

    query = company_filter.apply_filter(query, ChannelInventoryRule.companyId)
    if sku_id:
        query = query.where(ChannelInventoryRule.skuId == sku_id)
    if location_id:
        query = query.where(ChannelInventoryRule.locationId == location_id)
    if channel:
        query = query.where(ChannelInventoryRule.channel == channel)
    if is_active is not None:
        query = query.where(ChannelInventoryRule.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(ChannelInventoryRule.createdAt.desc())
    rules = session.exec(query).all()

    # Enrich with SKU and Location info
    result = []
    for rule in rules:
        rule_dict = ChannelInventoryRuleResponse.model_validate(rule).model_dump()

        # Get SKU info
        sku = session.get(SKU, rule.skuId)
        if sku:
            rule_dict["skuCode"] = sku.code
            rule_dict["skuName"] = sku.name

        # Get Location info
        location = session.get(Location, rule.locationId)
        if location:
            rule_dict["locationName"] = location.name

        result.append(ChannelInventoryRuleResponse(**rule_dict))

    return result


@router.get("/rules/count")
def count_channel_inventory_rules(
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Count channel inventory rules."""
    query = select(func.count(ChannelInventoryRule.id))

    query = company_filter.apply_filter(query, ChannelInventoryRule.companyId)
    if sku_id:
        query = query.where(ChannelInventoryRule.skuId == sku_id)
    if location_id:
        query = query.where(ChannelInventoryRule.locationId == location_id)
    if channel:
        query = query.where(ChannelInventoryRule.channel == channel)
    if is_active is not None:
        query = query.where(ChannelInventoryRule.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/rules/{rule_id}", response_model=ChannelInventoryRuleResponse)
def get_channel_inventory_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific channel inventory rule."""
    query = select(ChannelInventoryRule).where(ChannelInventoryRule.id == rule_id)
    query = company_filter.apply_filter(query, ChannelInventoryRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Channel inventory rule not found")

    return ChannelInventoryRuleResponse.model_validate(rule)


@router.post("/rules", response_model=ChannelInventoryRuleResponse, status_code=status.HTTP_201_CREATED)
def create_channel_inventory_rule(
    data: ChannelInventoryRuleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """Create a channel inventory allocation rule."""
    # For SUPER_ADMIN, use their assigned company or fall back to location's company
    company_id = company_filter.company_id
    if not company_id and hasattr(current_user, 'companyId') and current_user.companyId:
        company_id = current_user.companyId
    if not company_id:
        # Try to get company from location
        location = session.get(Location, data.locationId)
        if location:
            company_id = location.companyId
    if not company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    # Validate SKU exists
    sku = session.get(SKU, data.skuId)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    # Validate Location exists
    location = session.get(Location, data.locationId)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Check for duplicate rule
    existing = session.exec(
        select(ChannelInventoryRule)
        .where(ChannelInventoryRule.skuId == data.skuId)
        .where(ChannelInventoryRule.locationId == data.locationId)
        .where(ChannelInventoryRule.channel == data.channel)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Rule already exists for SKU {sku.code} at {location.name} for channel {data.channel}"
        )

    rule = ChannelInventoryRule(
        skuId=data.skuId,
        locationId=data.locationId,
        channel=data.channel,
        allocatedQty=data.allocatedQty,
        priority=data.priority,
        isActive=data.isActive,
        companyId=company_id,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)

    return ChannelInventoryRuleResponse.model_validate(rule)


@router.patch("/rules/{rule_id}", response_model=ChannelInventoryRuleResponse)
def update_channel_inventory_rule(
    rule_id: UUID,
    data: ChannelInventoryRuleUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """Update a channel inventory rule."""
    query = select(ChannelInventoryRule).where(ChannelInventoryRule.id == rule_id)
    query = company_filter.apply_filter(query, ChannelInventoryRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Channel inventory rule not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    session.add(rule)
    session.commit()
    session.refresh(rule)

    return ChannelInventoryRuleResponse.model_validate(rule)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel_inventory_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """Delete a channel inventory rule."""
    query = select(ChannelInventoryRule).where(ChannelInventoryRule.id == rule_id)
    query = company_filter.apply_filter(query, ChannelInventoryRule.companyId)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Channel inventory rule not found")

    session.delete(rule)
    session.commit()


# ============================================================================
# Bulk Rules Management
# ============================================================================

@router.post("/rules/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
def bulk_create_channel_inventory_rules(
    rules: List[ChannelInventoryRuleCreate],
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk create channel inventory rules for a SKU.
    Used to define how GRN inventory should be split across channels.
    """
    # For SUPER_ADMIN, use their assigned company
    company_id = company_filter.company_id
    if not company_id and hasattr(current_user, 'companyId') and current_user.companyId:
        company_id = current_user.companyId
    if not company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    created = []
    errors = []

    for idx, data in enumerate(rules):
        try:
            # Validate SKU
            sku = session.get(SKU, data.skuId)
            if not sku:
                errors.append({"index": idx, "error": f"SKU not found: {data.skuId}"})
                continue

            # Check for duplicate
            existing = session.exec(
                select(ChannelInventoryRule)
                .where(ChannelInventoryRule.skuId == data.skuId)
                .where(ChannelInventoryRule.locationId == data.locationId)
                .where(ChannelInventoryRule.channel == data.channel)
            ).first()
            if existing:
                errors.append({"index": idx, "error": f"Rule already exists for {data.channel}"})
                continue

            rule = ChannelInventoryRule(
                skuId=data.skuId,
                locationId=data.locationId,
                channel=data.channel,
                allocatedQty=data.allocatedQty,
                priority=data.priority,
                isActive=data.isActive,
                companyId=company_id,
            )
            session.add(rule)
            created.append({
                "channel": data.channel,
                "allocatedQty": data.allocatedQty
            })
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})

    session.commit()

    return {
        "success": len(errors) == 0,
        "created": len(created),
        "errors": len(errors),
        "rules": created,
        "error_details": errors
    }


@router.get("/rules/by-sku/{sku_id}", response_model=List[ChannelInventoryRuleResponse])
def get_rules_by_sku(
    sku_id: UUID,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all channel allocation rules for a specific SKU."""
    query = select(ChannelInventoryRule).where(
        ChannelInventoryRule.skuId == sku_id,
        ChannelInventoryRule.isActive == True
    )
    query = company_filter.apply_filter(query, ChannelInventoryRule.companyId)
    if location_id:
        query = query.where(ChannelInventoryRule.locationId == location_id)

    query = query.order_by(ChannelInventoryRule.priority)
    rules = session.exec(query).all()

    return [ChannelInventoryRuleResponse.model_validate(r) for r in rules]


# ============================================================================
# Channel Inventory CRUD
# ============================================================================

@router.get("", response_model=List[ChannelInventoryResponse])
def list_channel_inventory(
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    gr_no: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List channel inventory records."""
    query = select(ChannelInventory)

    query = company_filter.apply_filter(query, ChannelInventory.companyId)
    if sku_id:
        query = query.where(ChannelInventory.skuId == sku_id)
    if location_id:
        query = query.where(ChannelInventory.locationId == location_id)
    if channel:
        query = query.where(ChannelInventory.channel == channel)
    if gr_no:
        query = query.where(ChannelInventory.grNo == gr_no)

    query = query.offset(skip).limit(limit).order_by(ChannelInventory.fifoSequence)
    records = session.exec(query).all()

    # Enrich with SKU info
    result = []
    for record in records:
        record_dict = ChannelInventoryResponse.model_validate(record).model_dump()
        record_dict["availableQty"] = record.availableQty

        sku = session.get(SKU, record.skuId)
        if sku:
            record_dict["skuCode"] = sku.code
            record_dict["skuName"] = sku.name

        result.append(ChannelInventoryResponse(**record_dict))

    return result


@router.get("/summary", response_model=List[ChannelInventorySummary])
def get_channel_inventory_summary(
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get channel inventory summary (aggregated by SKU + Location + Channel)."""
    query = select(
        ChannelInventory.skuId,
        ChannelInventory.locationId,
        ChannelInventory.channel,
        func.sum(ChannelInventory.quantity).label("totalQuantity"),
        func.sum(ChannelInventory.reservedQty).label("totalReserved"),
        func.count(ChannelInventory.id).label("recordCount"),
    ).group_by(
        ChannelInventory.skuId,
        ChannelInventory.locationId,
        ChannelInventory.channel,
    )

    query = company_filter.apply_filter(query, ChannelInventory.companyId)
    if sku_id:
        query = query.where(ChannelInventory.skuId == sku_id)
    if location_id:
        query = query.where(ChannelInventory.locationId == location_id)

    results = session.exec(query).all()

    summaries = []
    for row in results:
        sku = session.get(SKU, row.skuId)
        location = session.get(Location, row.locationId)

        summaries.append(ChannelInventorySummary(
            skuId=row.skuId,
            skuCode=sku.code if sku else None,
            skuName=sku.name if sku else None,
            locationId=row.locationId,
            locationName=location.name if location else None,
            channel=row.channel,
            totalQuantity=row.totalQuantity or 0,
            totalReserved=row.totalReserved or 0,
            totalAvailable=(row.totalQuantity or 0) - (row.totalReserved or 0),
            recordCount=row.recordCount or 0,
        ))

    return summaries


@router.get("/available")
def get_available_channel_inventory(
    sku_id: UUID,
    location_id: UUID,
    channel: str,
    required_qty: int = Query(1, ge=1),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Check available channel inventory for a SKU.
    Used before allocating inventory for an order.
    """
    query = select(ChannelInventory).where(
        ChannelInventory.skuId == sku_id,
        ChannelInventory.locationId == location_id,
        ChannelInventory.channel == channel,
        (ChannelInventory.quantity - ChannelInventory.reservedQty) > 0
    ).order_by(ChannelInventory.fifoSequence)

    query = company_filter.apply_filter(query, ChannelInventory.companyId)

    records = session.exec(query).all()

    total_available = sum(r.availableQty for r in records)
    can_fulfill = total_available >= required_qty

    return {
        "skuId": str(sku_id),
        "locationId": str(location_id),
        "channel": channel,
        "requiredQty": required_qty,
        "totalAvailable": total_available,
        "canFulfill": can_fulfill,
        "shortfall": max(0, required_qty - total_available),
        "recordCount": len(records),
    }


@router.get("/{inventory_id}", response_model=ChannelInventoryResponse)
def get_channel_inventory(
    inventory_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific channel inventory record."""
    query = select(ChannelInventory).where(ChannelInventory.id == inventory_id)
    query = company_filter.apply_filter(query, ChannelInventory.companyId)

    record = session.exec(query).first()
    if not record:
        raise HTTPException(status_code=404, detail="Channel inventory not found")

    return ChannelInventoryResponse.model_validate(record)


@router.patch("/{inventory_id}", response_model=ChannelInventoryResponse)
def update_channel_inventory(
    inventory_id: UUID,
    data: ChannelInventoryUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """Update a channel inventory record."""
    query = select(ChannelInventory).where(ChannelInventory.id == inventory_id)
    query = company_filter.apply_filter(query, ChannelInventory.companyId)

    record = session.exec(query).first()
    if not record:
        raise HTTPException(status_code=404, detail="Channel inventory not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    session.add(record)
    session.commit()
    session.refresh(record)

    return ChannelInventoryResponse.model_validate(record)
