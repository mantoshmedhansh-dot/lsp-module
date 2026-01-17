"""
WMS Extended API v1 - Cycle Counts, Gate Passes, Stock Adjustments, Inventory Movements
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    CycleCount, CycleCountCreate, CycleCountUpdate, CycleCountResponse,
    CycleCountItem, CycleCountItemCreate, CycleCountItemUpdate, CycleCountItemResponse,
    GatePass, GatePassCreate, GatePassUpdate, GatePassResponse,
    GatePassItem, GatePassItemCreate, GatePassItemResponse,
    StockAdjustment, StockAdjustmentCreate, StockAdjustmentResponse,
    StockAdjustmentItem, StockAdjustmentItemCreate, StockAdjustmentItemResponse,
    InventoryMovement, InventoryMovementCreate, InventoryMovementResponse,
    VirtualInventory, VirtualInventoryCreate, VirtualInventoryUpdate, VirtualInventoryResponse,
    User, CycleCountStatus, GatePassType, GatePassStatus
)

router = APIRouter(prefix="/wms", tags=["WMS Extended"])


# ============================================================================
# Cycle Count Endpoints
# ============================================================================

@router.get("/cycle-counts", response_model=List[CycleCountResponse])
def list_cycle_counts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[CycleCountStatus] = None,
    location_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List cycle counts."""
    query = select(CycleCount)

    if status:
        query = query.where(CycleCount.status == status)
    if location_id:
        query = query.where(CycleCount.locationId == location_id)

    query = query.offset(skip).limit(limit).order_by(CycleCount.scheduledDate.desc())
    counts = session.exec(query).all()
    return [CycleCountResponse.model_validate(c) for c in counts]


@router.get("/cycle-counts/{count_id}", response_model=CycleCountResponse)
def get_cycle_count(
    count_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get cycle count by ID."""
    count = session.get(CycleCount, count_id)
    if not count:
        raise HTTPException(status_code=404, detail="Cycle count not found")
    return CycleCountResponse.model_validate(count)


@router.post("/cycle-counts", response_model=CycleCountResponse, status_code=status.HTTP_201_CREATED)
def create_cycle_count(
    data: CycleCountCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new cycle count."""
    # Generate cycle count number
    count_num = session.exec(select(func.count(CycleCount.id))).one()
    cycle_count_no = f"CC-{count_num + 1:06d}"

    cycle_count = CycleCount(
        cycleCountNo=cycle_count_no,
        locationId=data.locationId,
        zoneId=data.zoneId,
        scheduledDate=data.scheduledDate,
        remarks=data.remarks,
        initiatedById=current_user.id
    )

    session.add(cycle_count)
    session.commit()
    session.refresh(cycle_count)
    return CycleCountResponse.model_validate(cycle_count)


@router.patch("/cycle-counts/{count_id}", response_model=CycleCountResponse)
def update_cycle_count(
    count_id: UUID,
    data: CycleCountUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update cycle count."""
    count = session.get(CycleCount, count_id)
    if not count:
        raise HTTPException(status_code=404, detail="Cycle count not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(count, field, value)

    session.add(count)
    session.commit()
    session.refresh(count)
    return CycleCountResponse.model_validate(count)


@router.post("/cycle-counts/{count_id}/start", response_model=CycleCountResponse)
def start_cycle_count(
    count_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start cycle count."""
    count = session.get(CycleCount, count_id)
    if not count:
        raise HTTPException(status_code=404, detail="Cycle count not found")

    count.status = CycleCountStatus.IN_PROGRESS
    count.startedAt = datetime.utcnow()

    session.add(count)
    session.commit()
    session.refresh(count)
    return CycleCountResponse.model_validate(count)


@router.post("/cycle-counts/{count_id}/complete", response_model=CycleCountResponse)
def complete_cycle_count(
    count_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Complete cycle count."""
    count = session.get(CycleCount, count_id)
    if not count:
        raise HTTPException(status_code=404, detail="Cycle count not found")

    count.status = CycleCountStatus.COMPLETED
    count.completedAt = datetime.utcnow()
    count.verifiedById = current_user.id

    session.add(count)
    session.commit()
    session.refresh(count)
    return CycleCountResponse.model_validate(count)


# ============================================================================
# Gate Pass Endpoints
# ============================================================================

@router.get("/gate-passes", response_model=List[GatePassResponse])
def list_gate_passes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type: Optional[GatePassType] = None,
    status: Optional[GatePassStatus] = None,
    location_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List gate passes."""
    query = select(GatePass)

    if type:
        query = query.where(GatePass.type == type)
    if status:
        query = query.where(GatePass.status == status)
    if location_id:
        query = query.where(GatePass.locationId == location_id)

    query = query.offset(skip).limit(limit).order_by(GatePass.createdAt.desc())
    passes = session.exec(query).all()
    return [GatePassResponse.model_validate(p) for p in passes]


@router.get("/gate-passes/{pass_id}", response_model=GatePassResponse)
def get_gate_pass(
    pass_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get gate pass by ID."""
    gate_pass = session.get(GatePass, pass_id)
    if not gate_pass:
        raise HTTPException(status_code=404, detail="Gate pass not found")
    return GatePassResponse.model_validate(gate_pass)


@router.post("/gate-passes", response_model=GatePassResponse, status_code=status.HTTP_201_CREATED)
def create_gate_pass(
    data: GatePassCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new gate pass."""
    # Generate gate pass number
    count = session.exec(select(func.count(GatePass.id))).one()
    gate_pass_no = f"GP-{count + 1:06d}"

    gate_pass = GatePass(
        gatePassNo=gate_pass_no,
        entryTime=datetime.utcnow(),
        **data.model_dump()
    )

    session.add(gate_pass)
    session.commit()
    session.refresh(gate_pass)
    return GatePassResponse.model_validate(gate_pass)


@router.patch("/gate-passes/{pass_id}", response_model=GatePassResponse)
def update_gate_pass(
    pass_id: UUID,
    data: GatePassUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update gate pass."""
    gate_pass = session.get(GatePass, pass_id)
    if not gate_pass:
        raise HTTPException(status_code=404, detail="Gate pass not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(gate_pass, field, value)

    session.add(gate_pass)
    session.commit()
    session.refresh(gate_pass)
    return GatePassResponse.model_validate(gate_pass)


@router.post("/gate-passes/{pass_id}/close", response_model=GatePassResponse)
def close_gate_pass(
    pass_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Close gate pass (exit)."""
    gate_pass = session.get(GatePass, pass_id)
    if not gate_pass:
        raise HTTPException(status_code=404, detail="Gate pass not found")

    gate_pass.status = GatePassStatus.CLOSED
    gate_pass.exitTime = datetime.utcnow()
    gate_pass.verifiedById = current_user.id
    gate_pass.verifiedAt = datetime.utcnow()

    session.add(gate_pass)
    session.commit()
    session.refresh(gate_pass)
    return GatePassResponse.model_validate(gate_pass)


# ============================================================================
# Stock Adjustment Endpoints
# ============================================================================

@router.get("/stock-adjustments", response_model=List[StockAdjustmentResponse])
def list_stock_adjustments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List stock adjustments."""
    query = select(StockAdjustment)

    if status:
        query = query.where(StockAdjustment.status == status)
    if location_id:
        query = query.where(StockAdjustment.locationId == location_id)

    query = query.offset(skip).limit(limit).order_by(StockAdjustment.createdAt.desc())
    adjustments = session.exec(query).all()
    return [StockAdjustmentResponse.model_validate(a) for a in adjustments]


@router.get("/stock-adjustments/{adjustment_id}", response_model=StockAdjustmentResponse)
def get_stock_adjustment(
    adjustment_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get stock adjustment by ID."""
    adjustment = session.get(StockAdjustment, adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=404, detail="Stock adjustment not found")
    return StockAdjustmentResponse.model_validate(adjustment)


@router.post("/stock-adjustments", response_model=StockAdjustmentResponse, status_code=status.HTTP_201_CREATED)
def create_stock_adjustment(
    data: StockAdjustmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create stock adjustment."""
    # Generate adjustment number
    count = session.exec(select(func.count(StockAdjustment.id))).one()
    adjustment_no = f"SA-{count + 1:06d}"

    adjustment = StockAdjustment(
        adjustmentNo=adjustment_no,
        locationId=data.locationId,
        reason=data.reason,
        remarks=data.remarks,
        createdById=current_user.id
    )

    session.add(adjustment)
    session.commit()
    session.refresh(adjustment)

    # Add items if provided
    if data.items:
        for item_data in data.items:
            item = StockAdjustmentItem(
                adjustmentId=adjustment.id,
                **item_data.model_dump()
            )
            session.add(item)
        session.commit()
        session.refresh(adjustment)

    return StockAdjustmentResponse.model_validate(adjustment)


@router.post("/stock-adjustments/{adjustment_id}/approve", response_model=StockAdjustmentResponse)
def approve_stock_adjustment(
    adjustment_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Approve stock adjustment."""
    adjustment = session.get(StockAdjustment, adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=404, detail="Stock adjustment not found")

    adjustment.status = "APPROVED"
    adjustment.approvedById = current_user.id
    adjustment.approvedAt = datetime.utcnow()

    session.add(adjustment)
    session.commit()
    session.refresh(adjustment)
    return StockAdjustmentResponse.model_validate(adjustment)


# ============================================================================
# Inventory Movement Endpoints
# ============================================================================

@router.get("/inventory-movements", response_model=List[InventoryMovementResponse])
def list_inventory_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    movement_type: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List inventory movements (audit trail)."""
    query = select(InventoryMovement)

    if sku_id:
        query = query.where(InventoryMovement.skuId == sku_id)
    if location_id:
        query = query.where(InventoryMovement.locationId == location_id)
    if movement_type:
        query = query.where(InventoryMovement.movementType == movement_type)

    query = query.offset(skip).limit(limit).order_by(InventoryMovement.performedAt.desc())
    movements = session.exec(query).all()
    return [InventoryMovementResponse.model_validate(m) for m in movements]


@router.get("/inventory-movements/{movement_id}", response_model=InventoryMovementResponse)
def get_inventory_movement(
    movement_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inventory movement by ID."""
    movement = session.get(InventoryMovement, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Inventory movement not found")
    return InventoryMovementResponse.model_validate(movement)


# ============================================================================
# Virtual Inventory Endpoints
# ============================================================================

@router.get("/virtual-inventory", response_model=List[VirtualInventoryResponse])
def list_virtual_inventory(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List virtual inventory."""
    query = select(VirtualInventory)

    if company_filter.company_id:
        query = query.where(VirtualInventory.companyId == company_filter.company_id)
    if sku_id:
        query = query.where(VirtualInventory.skuId == sku_id)
    if location_id:
        query = query.where(VirtualInventory.locationId == location_id)
    if channel:
        query = query.where(VirtualInventory.channel == channel)
    if is_active is not None:
        query = query.where(VirtualInventory.isActive == is_active)

    query = query.offset(skip).limit(limit)
    inventory = session.exec(query).all()
    return [VirtualInventoryResponse.model_validate(v) for v in inventory]


@router.post("/virtual-inventory", response_model=VirtualInventoryResponse, status_code=status.HTTP_201_CREATED)
def create_virtual_inventory(
    data: VirtualInventoryCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create virtual inventory."""
    virtual_inv = VirtualInventory.model_validate(data)
    if company_filter.company_id:
        virtual_inv.companyId = company_filter.company_id

    session.add(virtual_inv)
    session.commit()
    session.refresh(virtual_inv)
    return VirtualInventoryResponse.model_validate(virtual_inv)


@router.patch("/virtual-inventory/{inventory_id}", response_model=VirtualInventoryResponse)
def update_virtual_inventory(
    inventory_id: UUID,
    data: VirtualInventoryUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update virtual inventory."""
    virtual_inv = session.get(VirtualInventory, inventory_id)
    if not virtual_inv:
        raise HTTPException(status_code=404, detail="Virtual inventory not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(virtual_inv, field, value)

    session.add(virtual_inv)
    session.commit()
    session.refresh(virtual_inv)
    return VirtualInventoryResponse.model_validate(virtual_inv)


@router.delete("/virtual-inventory/{inventory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_virtual_inventory(
    inventory_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete virtual inventory."""
    virtual_inv = session.get(VirtualInventory, inventory_id)
    if not virtual_inv:
        raise HTTPException(status_code=404, detail="Virtual inventory not found")

    session.delete(virtual_inv)
    session.commit()
