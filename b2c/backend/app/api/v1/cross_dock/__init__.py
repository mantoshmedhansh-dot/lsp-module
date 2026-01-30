"""
Cross-Docking API Endpoints
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.cross_dock import (
    CrossDockRule, CrossDockOrder, CrossDockAllocation, StagingArea,
    CrossDockRuleType, CrossDockStatus, StagingAreaStatus,
    CrossDockRuleCreate, CrossDockRuleResponse,
    CrossDockOrderResponse, CrossDockAllocationCreate, CrossDockAllocationResponse,
    StagingAreaResponse, EligibleOrdersResponse
)
from app.services.cross_dock_engine import cross_dock_engine

router = APIRouter()


# ==================== Rules Management ====================

@router.post("/rules", response_model=CrossDockRuleResponse)
async def create_rule(
    rule: CrossDockRuleCreate,
    db: Session = Depends(get_session)
):
    """Create a cross-dock rule."""
    new_rule = CrossDockRule(**rule.model_dump())
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule


@router.get("/rules", response_model=List[CrossDockRuleResponse])
async def list_rules(
    warehouse_id: UUID = Query(...),
    is_active: bool = True,
    db: Session = Depends(get_session)
):
    """List cross-dock rules."""
    stmt = select(CrossDockRule).where(
        and_(
            CrossDockRule.warehouseId == warehouse_id,
            CrossDockRule.isActive == is_active
        )
    ).order_by(CrossDockRule.priority.desc())
    return db.exec(stmt).all()


@router.put("/rules/{rule_id}", response_model=CrossDockRuleResponse)
async def update_rule(
    rule_id: UUID,
    rule_update: CrossDockRuleCreate,
    db: Session = Depends(get_session)
):
    """Update a cross-dock rule."""
    stmt = select(CrossDockRule).where(CrossDockRule.id == rule_id)
    rule = db.exec(stmt).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for key, value in rule_update.model_dump().items():
        setattr(rule, key, value)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: Session = Depends(get_session)
):
    """Deactivate a rule."""
    stmt = select(CrossDockRule).where(CrossDockRule.id == rule_id)
    rule = db.exec(stmt).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.isActive = False
    db.add(rule)
    db.commit()
    return {"message": "Rule deactivated"}


# ==================== Eligible Orders ====================

@router.get("/eligible", response_model=EligibleOrdersResponse)
async def get_eligible_orders(
    warehouse_id: UUID = Query(...),
    inbound_shipment_id: Optional[UUID] = None,
    db: Session = Depends(get_session)
):
    """Get orders eligible for cross-docking."""
    return await cross_dock_engine.find_eligible_orders(
        db=db,
        warehouse_id=warehouse_id,
        inbound_shipment_id=inbound_shipment_id
    )


@router.get("/orders", response_model=List[CrossDockOrderResponse])
async def list_cross_dock_orders(
    warehouse_id: UUID = Query(...),
    status: Optional[CrossDockStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List cross-dock orders."""
    stmt = select(CrossDockOrder).where(CrossDockOrder.warehouseId == warehouse_id)
    if status:
        stmt = stmt.where(CrossDockOrder.status == status)
    stmt = stmt.order_by(CrossDockOrder.priority.desc()).limit(limit)
    return db.exec(stmt).all()


# ==================== Allocations ====================

@router.post("/allocate", response_model=CrossDockAllocationResponse)
async def create_allocation(
    allocation: CrossDockAllocationCreate,
    db: Session = Depends(get_session)
):
    """Create a cross-dock allocation."""
    return await cross_dock_engine.create_allocation(
        db=db,
        cross_dock_order_id=allocation.crossDockOrderId,
        inbound_line_id=allocation.inboundLineId,
        outbound_line_id=allocation.outboundLineId,
        item_id=allocation.itemId,
        sku=allocation.sku,
        quantity=allocation.allocatedQuantity
    )


@router.get("/allocations", response_model=List[CrossDockAllocationResponse])
async def list_allocations(
    cross_dock_order_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """List allocations for a cross-dock order."""
    stmt = select(CrossDockAllocation).where(
        CrossDockAllocation.crossDockOrderId == cross_dock_order_id
    )
    return db.exec(stmt).all()


# ==================== Staging Areas ====================

@router.get("/staging", response_model=List[StagingAreaResponse])
async def list_staging_areas(
    warehouse_id: UUID = Query(...),
    status: Optional[StagingAreaStatus] = None,
    db: Session = Depends(get_session)
):
    """Get staging area status."""
    stmt = select(StagingArea).where(
        and_(
            StagingArea.warehouseId == warehouse_id,
            StagingArea.isActive == True
        )
    )
    if status:
        stmt = stmt.where(StagingArea.status == status)
    stmt = stmt.order_by(StagingArea.areaCode)
    return db.exec(stmt).all()


@router.get("/staging/status")
async def get_staging_status(
    warehouse_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Get detailed staging area status."""
    return await cross_dock_engine.get_staging_status(db, warehouse_id)


@router.post("/staging/{order_id}/assign")
async def assign_staging_area(
    order_id: UUID,
    warehouse_id: UUID = Query(...),
    required_units: int = Query(...),
    db: Session = Depends(get_session)
):
    """Assign a staging area to a cross-dock order."""
    staging = await cross_dock_engine.assign_staging_area(
        db=db,
        warehouse_id=warehouse_id,
        cross_dock_order_id=order_id,
        required_units=required_units
    )
    if not staging:
        raise HTTPException(status_code=400, detail="No staging area available")
    return {"message": "Staging area assigned", "stagingAreaId": str(staging.id)}


@router.post("/orders/{order_id}/complete")
async def complete_cross_dock(
    order_id: UUID,
    db: Session = Depends(get_session)
):
    """Mark cross-dock order as shipped."""
    success = await cross_dock_engine.complete_cross_dock(db, order_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not complete cross-dock")
    return {"message": "Cross-dock completed"}
