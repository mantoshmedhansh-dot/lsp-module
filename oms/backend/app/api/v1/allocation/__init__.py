"""
Inventory Allocation API v1 - Allocation management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_admin, require_manager, CompanyFilter
from app.models import (
    InventoryAllocation, InventoryAllocationResponse, InventoryAllocationBrief,
    AllocationRequest, AllocationResult,
    BulkAllocationRequest, BulkAllocationResult,
    DeallocationRequest, ConfirmPickRequest,
    User, SKU, Bin, Inventory
)
from app.services.inventory_allocation import InventoryAllocationService


router = APIRouter(prefix="/allocation", tags=["Inventory Allocation"])


# ============================================================================
# Helper Functions
# ============================================================================

def build_allocation_response(
    allocation: InventoryAllocation,
    session: Session
) -> InventoryAllocationResponse:
    """Build allocation response with SKU and Bin info."""
    response = InventoryAllocationResponse.model_validate(allocation)

    # Get SKU info
    sku = session.exec(select(SKU).where(SKU.id == allocation.skuId)).first()
    if sku:
        response.skuCode = sku.code
        response.skuName = sku.name

    # Get Bin info
    bin_obj = session.exec(select(Bin).where(Bin.id == allocation.binId)).first()
    if bin_obj:
        response.binCode = bin_obj.code

    return response


# ============================================================================
# Allocation Endpoints
# ============================================================================

@router.get("", response_model=List[InventoryAllocationResponse])
def list_allocations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    order_id: Optional[UUID] = None,
    wave_id: Optional[UUID] = None,
    picklist_id: Optional[UUID] = None,
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List inventory allocations with filters."""
    query = select(InventoryAllocation)

    # Apply company filter
    query = company_filter.apply_filter(query, InventoryAllocation.companyId)

    # Apply filters
    if status:
        query = query.where(InventoryAllocation.status == status)
    if order_id:
        query = query.where(InventoryAllocation.orderId == order_id)
    if wave_id:
        query = query.where(InventoryAllocation.waveId == wave_id)
    if picklist_id:
        query = query.where(InventoryAllocation.picklistId == picklist_id)
    if sku_id:
        query = query.where(InventoryAllocation.skuId == sku_id)
    if location_id:
        query = query.where(InventoryAllocation.locationId == location_id)

    # Pagination and ordering
    query = query.offset(skip).limit(limit).order_by(InventoryAllocation.allocatedAt.desc())

    allocations = session.exec(query).all()
    return [build_allocation_response(a, session) for a in allocations]


@router.get("/count")
def count_allocations(
    status: Optional[str] = None,
    order_id: Optional[UUID] = None,
    wave_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of allocations."""
    query = select(func.count(InventoryAllocation.id))
    query = company_filter.apply_filter(query, InventoryAllocation.companyId)
    if status:
        query = query.where(InventoryAllocation.status == status)
    if order_id:
        query = query.where(InventoryAllocation.orderId == order_id)
    if wave_id:
        query = query.where(InventoryAllocation.waveId == wave_id)
    if location_id:
        query = query.where(InventoryAllocation.locationId == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/summary")
def get_allocation_summary(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get summary of current allocations."""
    service = InventoryAllocationService(session)
    return service.get_allocation_summary(
        location_id=location_id,
        company_id=company_filter.company_id
    )


@router.get("/{allocation_id}", response_model=InventoryAllocationResponse)
def get_allocation(
    allocation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific allocation."""
    query = select(InventoryAllocation).where(InventoryAllocation.id == allocation_id)
    query = company_filter.apply_filter(query, InventoryAllocation.companyId)

    allocation = session.exec(query).first()
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )

    return build_allocation_response(allocation, session)


@router.post("/allocate", response_model=AllocationResult)
def allocate_inventory(
    request: AllocationRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Allocate inventory for a single SKU.
    Uses FIFO/LIFO/FEFO based on configuration.
    """
    # Validate SKU
    sku = session.exec(select(SKU).where(SKU.id == request.skuId)).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    company_id = company_filter.company_id
    if not company_id:
        company_id = sku.companyId

    service = InventoryAllocationService(session)
    result = service.allocate_inventory(
        request=request,
        company_id=company_id,
        allocated_by_id=current_user.id
    )

    return result


@router.post("/allocate-bulk", response_model=BulkAllocationResult)
def bulk_allocate_inventory(
    request: BulkAllocationRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Allocate inventory for multiple SKUs at once.
    Typically used for order or wave allocation.
    """
    company_id = company_filter.company_id
    if not company_id:
        # Get company from first item's SKU
        if request.items:
            first_sku = session.exec(
                select(SKU).where(SKU.id == request.items[0].skuId)
            ).first()
            if first_sku:
                company_id = first_sku.companyId

    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine company"
        )

    service = InventoryAllocationService(session)
    result = service.bulk_allocate(
        request=request,
        company_id=company_id,
        allocated_by_id=current_user.id
    )

    return result


@router.post("/deallocate/{allocation_id}")
def deallocate_inventory(
    allocation_id: UUID,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Deallocate (release) a specific allocation.
    Returns reserved quantity back to available inventory.
    """
    # Verify allocation exists
    query = select(InventoryAllocation).where(InventoryAllocation.id == allocation_id)
    query = company_filter.apply_filter(query, InventoryAllocation.companyId)

    allocation = session.exec(query).first()
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )

    service = InventoryAllocationService(session)
    success = service.deallocate(
        allocation_id=allocation_id,
        cancelled_by_id=current_user.id,
        reason=reason
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to deallocate. Allocation may already be cancelled or picked."
        )

    return {"success": True, "message": "Allocation released successfully"}


@router.post("/deallocate-order/{order_id}")
def deallocate_order(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Deallocate all allocations for an order.
    Used when cancelling or modifying an order.
    """
    service = InventoryAllocationService(session)
    cancelled_count = service.deallocate_by_order(
        order_id=order_id,
        cancelled_by_id=current_user.id
    )

    return {
        "success": True,
        "cancelled_count": cancelled_count,
        "message": f"Released {cancelled_count} allocation(s)"
    }


@router.post("/deallocate-wave/{wave_id}")
def deallocate_wave(
    wave_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Deallocate all allocations for a wave.
    Used when cancelling a wave.
    """
    service = InventoryAllocationService(session)
    cancelled_count = service.deallocate_by_wave(
        wave_id=wave_id,
        cancelled_by_id=current_user.id
    )

    return {
        "success": True,
        "cancelled_count": cancelled_count,
        "message": f"Released {cancelled_count} allocation(s)"
    }


@router.post("/confirm-pick/{allocation_id}")
def confirm_pick(
    allocation_id: UUID,
    picked_qty: int,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Confirm that inventory has been picked.
    Updates allocation status and reduces actual inventory quantity.
    """
    # Verify allocation exists
    query = select(InventoryAllocation).where(InventoryAllocation.id == allocation_id)
    query = company_filter.apply_filter(query, InventoryAllocation.companyId)

    allocation = session.exec(query).first()
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )

    service = InventoryAllocationService(session)
    success = service.confirm_pick(
        allocation_id=allocation_id,
        picked_qty=picked_qty,
        picked_by_id=current_user.id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to confirm pick. Allocation may not be in ALLOCATED status."
        )

    return {"success": True, "message": "Pick confirmed successfully"}


@router.get("/order/{order_id}", response_model=List[InventoryAllocationResponse])
def get_order_allocations(
    order_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all allocations for a specific order."""
    service = InventoryAllocationService(session)
    allocations = service.get_allocations_by_order(order_id)
    return [build_allocation_response(a, session) for a in allocations]


@router.get("/wave/{wave_id}", response_model=List[InventoryAllocationResponse])
def get_wave_allocations(
    wave_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all allocations for a specific wave."""
    service = InventoryAllocationService(session)
    allocations = service.get_allocations_by_wave(wave_id)
    return [build_allocation_response(a, session) for a in allocations]


@router.get("/picklist/{picklist_id}", response_model=List[InventoryAllocationResponse])
def get_picklist_allocations(
    picklist_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all allocations for a specific picklist."""
    service = InventoryAllocationService(session)
    allocations = service.get_allocations_by_picklist(picklist_id)
    return [build_allocation_response(a, session) for a in allocations]


@router.get("/check-availability")
def check_availability(
    sku_id: UUID,
    location_id: UUID,
    required_qty: int,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Check inventory availability for a SKU at a location."""
    service = InventoryAllocationService(session)
    available_qty, total_qty = service.check_availability(
        sku_id=sku_id,
        location_id=location_id,
        required_qty=required_qty
    )

    return {
        "skuId": str(sku_id),
        "locationId": str(location_id),
        "requiredQty": required_qty,
        "availableQty": available_qty,
        "totalQty": total_qty,
        "canFulfill": available_qty >= required_qty,
        "shortfall": max(0, required_qty - available_qty)
    }
