"""
Cross-Docking API v1 - Direct inbound-to-outbound allocation
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, Location, Order,
    CrossDockRule, CrossDockRuleCreate, CrossDockRuleResponse,
    CrossDockOrder, CrossDockOrderResponse,
    CrossDockAllocation, CrossDockAllocationCreate, CrossDockAllocationResponse,
    StagingArea, StagingAreaCreate, StagingAreaResponse,
    CrossDockStatus, AllocationStatus, StagingAreaStatus,
)


router = APIRouter(prefix="/cross-dock", tags=["Cross-Docking"])


# ============================================================================
# Cross-Dock Rules
# ============================================================================

@router.get("/rules", response_model=List[CrossDockRuleResponse])
def list_rules(
    location_id: Optional[UUID] = None,
    is_active: bool = True,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List cross-dock rules"""
    query = select(CrossDockRule).where(CrossDockRule.isActive == is_active)

    if company_filter.company_id:
        query = query.where(CrossDockRule.companyId == company_filter.company_id)
    if location_id:
        query = query.where(CrossDockRule.locationId == location_id)

    query = query.order_by(CrossDockRule.priority.desc())
    rules = session.exec(query).all()
    return rules


@router.post("/rules", response_model=CrossDockRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(
    data: CrossDockRuleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a cross-dock rule"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    rule = CrossDockRule(
        id=uuid4(),
        companyId=company_id,
        createdById=current_user.id,
        **data.model_dump()
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


@router.get("/rules/{rule_id}", response_model=CrossDockRuleResponse)
def get_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific cross-dock rule"""
    query = select(CrossDockRule).where(CrossDockRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(CrossDockRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.patch("/rules/{rule_id}", response_model=CrossDockRuleResponse)
def update_rule(
    rule_id: UUID,
    is_active: Optional[bool] = None,
    priority: Optional[int] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a cross-dock rule"""
    query = select(CrossDockRule).where(CrossDockRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(CrossDockRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if is_active is not None:
        rule.isActive = is_active
    if priority is not None:
        rule.priority = priority

    rule.updatedAt = datetime.utcnow()
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Deactivate a cross-dock rule"""
    query = select(CrossDockRule).where(CrossDockRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(CrossDockRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.isActive = False
    rule.updatedAt = datetime.utcnow()
    session.add(rule)
    session.commit()


# ============================================================================
# Eligible Orders
# ============================================================================

@router.get("/eligible", response_model=List[CrossDockOrderResponse])
def list_eligible_orders(
    location_id: Optional[UUID] = None,
    status: Optional[CrossDockStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List orders eligible for cross-docking"""
    query = select(CrossDockOrder)

    if company_filter.company_id:
        query = query.where(CrossDockOrder.companyId == company_filter.company_id)
    if location_id:
        query = query.where(CrossDockOrder.locationId == location_id)
    if status:
        query = query.where(CrossDockOrder.status == status)

    query = query.order_by(CrossDockOrder.priority.desc(), CrossDockOrder.createdAt.desc()).limit(limit)
    orders = session.exec(query).all()
    return orders


@router.post("/eligible/{order_id}")
def mark_order_eligible(
    order_id: UUID,
    location_id: UUID,
    priority: int = 0,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark an order as eligible for cross-docking"""
    from uuid import uuid4

    company_id = company_filter.company_id
    if not company_id:
        order = session.exec(select(Order).where(Order.id == order_id)).first()
        if order:
            company_id = order.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    # Check if already marked
    existing = session.exec(
        select(CrossDockOrder)
        .where(CrossDockOrder.orderId == order_id)
        .where(CrossDockOrder.locationId == location_id)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Order already marked for cross-docking")

    cd_order = CrossDockOrder(
        id=uuid4(),
        companyId=company_id,
        orderId=order_id,
        locationId=location_id,
        status=CrossDockStatus.PENDING,
        priority=priority
    )
    session.add(cd_order)
    session.commit()
    session.refresh(cd_order)

    return {"success": True, "crossDockOrderId": str(cd_order.id)}


# ============================================================================
# Allocations
# ============================================================================

@router.get("/allocations", response_model=List[CrossDockAllocationResponse])
def list_allocations(
    location_id: Optional[UUID] = None,
    status: Optional[AllocationStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List cross-dock allocations"""
    query = select(CrossDockAllocation)

    if company_filter.company_id:
        query = query.where(CrossDockAllocation.companyId == company_filter.company_id)
    if location_id:
        query = query.where(CrossDockAllocation.locationId == location_id)
    if status:
        query = query.where(CrossDockAllocation.status == status)

    query = query.order_by(CrossDockAllocation.createdAt.desc()).limit(limit)
    allocations = session.exec(query).all()
    return allocations


@router.post("/allocate", response_model=CrossDockAllocationResponse, status_code=status.HTTP_201_CREATED)
def create_allocation(
    data: CrossDockAllocationCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a cross-dock allocation (inbound to outbound)"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    allocation = CrossDockAllocation(
        id=uuid4(),
        companyId=company_id,
        allocatedById=current_user.id,
        status=AllocationStatus.ALLOCATED,
        **data.model_dump()
    )
    session.add(allocation)
    session.commit()
    session.refresh(allocation)
    return allocation


@router.post("/allocations/{allocation_id}/confirm")
def confirm_allocation(
    allocation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Confirm a cross-dock allocation"""
    query = select(CrossDockAllocation).where(CrossDockAllocation.id == allocation_id)
    if company_filter.company_id:
        query = query.where(CrossDockAllocation.companyId == company_filter.company_id)

    allocation = session.exec(query).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    if allocation.status != AllocationStatus.ALLOCATED:
        raise HTTPException(status_code=400, detail="Allocation cannot be confirmed")

    allocation.status = AllocationStatus.CONFIRMED
    allocation.confirmedAt = datetime.utcnow()
    allocation.confirmedById = current_user.id
    allocation.updatedAt = datetime.utcnow()
    session.add(allocation)
    session.commit()

    return {"success": True, "message": "Allocation confirmed"}


@router.post("/allocations/{allocation_id}/complete")
def complete_allocation(
    allocation_id: UUID,
    actual_quantity: Optional[int] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete a cross-dock allocation"""
    query = select(CrossDockAllocation).where(CrossDockAllocation.id == allocation_id)
    if company_filter.company_id:
        query = query.where(CrossDockAllocation.companyId == company_filter.company_id)

    allocation = session.exec(query).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    if allocation.status not in [AllocationStatus.ALLOCATED, AllocationStatus.CONFIRMED]:
        raise HTTPException(status_code=400, detail="Allocation cannot be completed")

    allocation.status = AllocationStatus.COMPLETED
    allocation.completedAt = datetime.utcnow()
    if actual_quantity is not None:
        allocation.actualQuantity = actual_quantity
    allocation.updatedAt = datetime.utcnow()
    session.add(allocation)
    session.commit()

    return {"success": True, "message": "Allocation completed"}


@router.post("/allocations/{allocation_id}/cancel")
def cancel_allocation(
    allocation_id: UUID,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Cancel a cross-dock allocation"""
    query = select(CrossDockAllocation).where(CrossDockAllocation.id == allocation_id)
    if company_filter.company_id:
        query = query.where(CrossDockAllocation.companyId == company_filter.company_id)

    allocation = session.exec(query).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    if allocation.status == AllocationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot cancel completed allocation")

    allocation.status = AllocationStatus.CANCELLED
    if reason:
        allocation.notes = f"{allocation.notes or ''} | Cancelled: {reason}".strip(" |")
    allocation.updatedAt = datetime.utcnow()
    session.add(allocation)
    session.commit()

    return {"success": True, "message": "Allocation cancelled"}


# ============================================================================
# Staging Areas
# ============================================================================

@router.get("/staging", response_model=List[StagingAreaResponse])
def list_staging_areas(
    location_id: Optional[UUID] = None,
    status: Optional[StagingAreaStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List cross-dock staging areas"""
    query = select(StagingArea)

    if company_filter.company_id:
        query = query.where(StagingArea.companyId == company_filter.company_id)
    if location_id:
        query = query.where(StagingArea.locationId == location_id)
    if status:
        query = query.where(StagingArea.status == status)

    areas = session.exec(query).all()
    return areas


@router.post("/staging", response_model=StagingAreaResponse, status_code=status.HTTP_201_CREATED)
def create_staging_area(
    data: StagingAreaCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a staging area"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    area = StagingArea(
        id=uuid4(),
        companyId=company_id,
        status=StagingAreaStatus.AVAILABLE,
        **data.model_dump()
    )
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


@router.patch("/staging/{area_id}/status")
def update_staging_area_status(
    area_id: UUID,
    status: StagingAreaStatus,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update staging area status"""
    query = select(StagingArea).where(StagingArea.id == area_id)
    if company_filter.company_id:
        query = query.where(StagingArea.companyId == company_filter.company_id)

    area = session.exec(query).first()
    if not area:
        raise HTTPException(status_code=404, detail="Staging area not found")

    area.status = status
    area.updatedAt = datetime.utcnow()
    session.add(area)
    session.commit()

    return {"success": True, "status": status.value}


# ============================================================================
# Dashboard
# ============================================================================

@router.get("/dashboard")
def get_cross_dock_dashboard(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get cross-docking dashboard stats"""
    base_query = select(CrossDockOrder)
    if company_filter.company_id:
        base_query = base_query.where(CrossDockOrder.companyId == company_filter.company_id)
    if location_id:
        base_query = base_query.where(CrossDockOrder.locationId == location_id)

    # Order counts by status
    status_counts = {}
    for s in CrossDockStatus:
        count = session.exec(
            select(func.count(CrossDockOrder.id))
            .where(CrossDockOrder.status == s)
            .where(CrossDockOrder.companyId == company_filter.company_id if company_filter.company_id else True)
        ).one()
        status_counts[s.value] = count

    # Allocation counts
    alloc_base = select(CrossDockAllocation)
    if company_filter.company_id:
        alloc_base = alloc_base.where(CrossDockAllocation.companyId == company_filter.company_id)

    pending_allocations = session.exec(
        select(func.count(CrossDockAllocation.id))
        .where(CrossDockAllocation.status == AllocationStatus.ALLOCATED)
        .where(CrossDockAllocation.companyId == company_filter.company_id if company_filter.company_id else True)
    ).one()

    # Staging area utilization
    staging_counts = {}
    for s in StagingAreaStatus:
        count = session.exec(
            select(func.count(StagingArea.id))
            .where(StagingArea.status == s)
            .where(StagingArea.companyId == company_filter.company_id if company_filter.company_id else True)
        ).one()
        staging_counts[s.value] = count

    return {
        "ordersByStatus": status_counts,
        "pendingAllocations": pending_allocations,
        "stagingAreas": staging_counts,
        "efficiency": 85  # Placeholder
    }
