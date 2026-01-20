"""
Wave API v1 - Wave picking and picklist management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Wave, WaveCreate, WaveUpdate, WaveResponse, WaveBrief,
    WaveItem, WaveItemCreate, WaveItemUpdate, WaveItemResponse,
    WaveOrder, WaveOrderCreate, WaveOrderUpdate, WaveOrderResponse,
    Picklist, PicklistCreate, PicklistUpdate, PicklistResponse,
    PicklistItem, PicklistItemCreate, PicklistItemUpdate, PicklistItemResponse,
    User, Location, Order, OrderItem, SKU, Bin, Inventory,
    WaveType, WaveStatus, PicklistStatus, OrderStatus,
    AllocationRequest, InventoryAllocation
)
from app.services.inventory_allocation import InventoryAllocationService

router = APIRouter(prefix="/waves", tags=["Waves"])


# ============================================================================
# Wave List and Create Endpoints (Static paths - must come first)
# ============================================================================

@router.get("", response_model=List[WaveBrief])
def list_waves(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[WaveStatus] = None,
    wave_type: Optional[WaveType] = None,
    location_id: Optional[UUID] = None,
    assigned_to_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List waves with pagination and filters."""
    query = select(Wave)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Wave.locationId.in_(location_ids))

    if status:
        query = query.where(Wave.status == status)
    if wave_type:
        query = query.where(Wave.type == wave_type)
    if location_id:
        query = query.where(Wave.locationId == location_id)
    if assigned_to_id:
        query = query.where(Wave.assignedToId == assigned_to_id)

    query = query.offset(skip).limit(limit).order_by(Wave.createdAt.desc())

    waves = session.exec(query).all()
    return [WaveBrief.model_validate(w) for w in waves]


@router.get("/count")
def count_waves(
    status: Optional[WaveStatus] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of waves."""
    query = select(func.count(Wave.id))

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Wave.locationId.in_(location_ids))

    if status:
        query = query.where(Wave.status == status)
    if location_id:
        query = query.where(Wave.locationId == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.post("", response_model=WaveResponse, status_code=status.HTTP_201_CREATED)
def create_wave(
    data: WaveCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """Create new wave."""
    # Get location to set companyId
    location = session.get(Location, data.locationId)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    try:
        wave_dict = data.model_dump()
        wave_dict["companyId"] = location.companyId
        wave = Wave(**wave_dict)
        session.add(wave)
        session.commit()
        session.refresh(wave)
        return WaveResponse.model_validate(wave)
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create wave: {str(e)}"
        )


# ============================================================================
# Picklist Endpoints (Static paths - must come before /{wave_id})
# ============================================================================

@router.get("/picklists", response_model=List[PicklistResponse])
def list_picklists(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[PicklistStatus] = None,
    assigned_to_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List picklists."""
    query = select(Picklist)

    if status:
        query = query.where(Picklist.status == status)
    if assigned_to_id:
        query = query.where(Picklist.assignedToId == assigned_to_id)

    query = query.offset(skip).limit(limit).order_by(Picklist.createdAt.desc())
    picklists = session.exec(query).all()
    return [PicklistResponse.model_validate(p) for p in picklists]


@router.post("/picklists", response_model=PicklistResponse, status_code=status.HTTP_201_CREATED)
def create_picklist(
    data: PicklistCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new picklist."""
    # Get order to set companyId
    order = session.get(Order, data.orderId)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    try:
        picklist_dict = data.model_dump()
        picklist_dict["companyId"] = order.companyId
        picklist = Picklist(**picklist_dict)
        session.add(picklist)
        session.commit()
        session.refresh(picklist)
        return PicklistResponse.model_validate(picklist)
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create picklist: {str(e)}"
        )


@router.get("/picklists/{picklist_id}", response_model=PicklistResponse)
def get_picklist(
    picklist_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get picklist by ID."""
    picklist = session.get(Picklist, picklist_id)
    if not picklist:
        raise HTTPException(status_code=404, detail="Picklist not found")
    return PicklistResponse.model_validate(picklist)


@router.patch("/picklists/{picklist_id}", response_model=PicklistResponse)
def update_picklist(
    picklist_id: UUID,
    data: PicklistUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update picklist."""
    picklist = session.get(Picklist, picklist_id)
    if not picklist:
        raise HTTPException(status_code=404, detail="Picklist not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(picklist, field, value)

    session.add(picklist)
    session.commit()
    session.refresh(picklist)
    return PicklistResponse.model_validate(picklist)


@router.get("/picklists/{picklist_id}/items", response_model=List[PicklistItemResponse])
def list_picklist_items(
    picklist_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a picklist."""
    query = select(PicklistItem).where(PicklistItem.picklistId == picklist_id)
    items = session.exec(query).all()
    return [PicklistItemResponse.model_validate(i) for i in items]


@router.post("/picklists/{picklist_id}/items", response_model=PicklistItemResponse, status_code=status.HTTP_201_CREATED)
def add_picklist_item(
    picklist_id: UUID,
    data: PicklistItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to picklist."""
    item_data = data.model_dump()
    item_data["picklistId"] = picklist_id
    item = PicklistItem.model_validate(item_data)
    session.add(item)
    session.commit()
    session.refresh(item)
    return PicklistItemResponse.model_validate(item)


@router.patch("/picklists/items/{item_id}", response_model=PicklistItemResponse)
def update_picklist_item(
    item_id: UUID,
    data: PicklistItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update picklist item."""
    item = session.get(PicklistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Picklist item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return PicklistItemResponse.model_validate(item)


# ============================================================================
# Wave Item Update (Static path with /items prefix - must come before /{wave_id})
# ============================================================================

@router.patch("/items/{item_id}", response_model=WaveItemResponse)
def update_wave_item(
    item_id: UUID,
    data: WaveItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update wave item (e.g., mark picked)."""
    item = session.get(WaveItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Wave item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return WaveItemResponse.model_validate(item)


# ============================================================================
# Wave Dynamic Endpoints (/{wave_id} - must come after static paths)
# ============================================================================

@router.get("/{wave_id}", response_model=WaveResponse)
def get_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get wave by ID."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")
    return WaveResponse.model_validate(wave)


@router.patch("/{wave_id}", response_model=WaveResponse)
def update_wave(
    wave_id: UUID,
    data: WaveUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update wave."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(wave, field, value)

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


@router.post("/{wave_id}/release", response_model=WaveResponse)
def release_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """Release wave for picking."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    wave.status = WaveStatus.RELEASED
    wave.releasedAt = datetime.utcnow()

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


@router.post("/{wave_id}/start", response_model=WaveResponse)
def start_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start wave picking."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    wave.status = WaveStatus.IN_PROGRESS
    wave.startedAt = datetime.utcnow()

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


@router.post("/{wave_id}/complete", response_model=WaveResponse)
def complete_wave(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete wave picking."""
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    wave.status = WaveStatus.COMPLETED
    wave.completedAt = datetime.utcnow()

    session.add(wave)
    session.commit()
    session.refresh(wave)
    return WaveResponse.model_validate(wave)


# ============================================================================
# Wave Items Endpoints (Nested under /{wave_id})
# ============================================================================

@router.get("/{wave_id}/items", response_model=List[WaveItemResponse])
def list_wave_items(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a wave."""
    query = select(WaveItem).where(WaveItem.waveId == wave_id).order_by(WaveItem.sequence)
    items = session.exec(query).all()
    return [WaveItemResponse.model_validate(i) for i in items]


@router.post("/{wave_id}/items", response_model=WaveItemResponse, status_code=status.HTTP_201_CREATED)
def add_wave_item(
    wave_id: UUID,
    data: WaveItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to wave."""
    item_data = data.model_dump()
    item_data["waveId"] = wave_id
    item = WaveItem.model_validate(item_data)
    session.add(item)
    session.commit()
    session.refresh(item)
    return WaveItemResponse.model_validate(item)


# ============================================================================
# Wave Orders Endpoints (Nested under /{wave_id})
# ============================================================================

@router.get("/{wave_id}/orders", response_model=List[WaveOrderResponse])
def list_wave_orders(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List orders in a wave."""
    query = select(WaveOrder).where(WaveOrder.waveId == wave_id).order_by(WaveOrder.sequence)
    orders = session.exec(query).all()
    return [WaveOrderResponse.model_validate(o) for o in orders]


@router.post("/{wave_id}/orders", response_model=WaveOrderResponse, status_code=status.HTTP_201_CREATED)
def add_order_to_wave(
    wave_id: UUID,
    data: WaveOrderCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add order to wave."""
    order_data = data.model_dump()
    order_data["waveId"] = wave_id
    wave_order = WaveOrder.model_validate(order_data)
    session.add(wave_order)
    session.commit()
    session.refresh(wave_order)
    return WaveOrderResponse.model_validate(wave_order)


# ============================================================================
# Picklist Generation with FIFO/LIFO/FEFO Allocation
# ============================================================================

def generate_picklist_number(session: Session) -> str:
    """Generate unique picklist number."""
    count = session.exec(select(func.count(Picklist.id))).one()
    return f"PL-{count + 1:06d}"


@router.post("/{wave_id}/generate-picklists")
def generate_picklists_with_allocation(
    wave_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """
    Generate picklists for a wave with automatic FIFO/LIFO/FEFO allocation.

    This endpoint:
    1. Gets all orders in the wave
    2. For each order's items, allocates inventory using configured valuation method
    3. Creates picklist items with bin locations
    4. Updates order status to ALLOCATED or PARTIALLY_ALLOCATED

    Returns summary of allocation results.
    """
    import traceback
    try:
        # Get the wave
        wave = session.get(Wave, wave_id)
        if not wave:
            raise HTTPException(status_code=404, detail="Wave not found")

        if wave.status not in [WaveStatus.DRAFT, WaveStatus.PLANNED, WaveStatus.RELEASED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot generate picklists for wave in {wave.status} status"
            )

        # Get location for the wave
        location = session.get(Location, wave.locationId)
        if not location:
            raise HTTPException(status_code=404, detail="Wave location not found")

        company_id = location.companyId

        # Get all orders in the wave
        wave_orders = session.exec(
            select(WaveOrder).where(WaveOrder.waveId == wave_id)
        ).all()

        if not wave_orders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No orders in this wave"
            )

        # Initialize allocation service
        allocation_service = InventoryAllocationService(session)

        # Track results
        results = {
            "wave_id": str(wave_id),
            "orders_processed": 0,
            "orders_fully_allocated": 0,
            "orders_partially_allocated": 0,
            "orders_not_allocated": 0,
            "picklists_created": 0,
            "items_allocated": 0,
            "total_quantity_allocated": 0,
            "shortfalls": []
        }

        # Process each order
        for wave_order in wave_orders:
            order = session.get(Order, wave_order.orderId)
            if not order:
                continue

            results["orders_processed"] += 1

            # Get order items
            order_items = session.exec(
                select(OrderItem).where(OrderItem.orderId == order.id)
            ).all()

            if not order_items:
                continue

            # Create a picklist for this order
            # Note: Picklist model doesn't have waveId/locationId - those are tracked via order
            picklist = Picklist(
                picklistNo=generate_picklist_number(session),
                orderId=order.id,
                status=PicklistStatus.PENDING,
                companyId=company_id,
            )
            session.add(picklist)
            session.flush()  # Get picklist ID

            order_fully_allocated = True
            order_has_allocations = False

            # Process each order item
            for order_item in order_items:
                # Create allocation request
                request = AllocationRequest(
                    skuId=order_item.skuId,
                    requiredQty=order_item.quantity,
                    locationId=wave.locationId,
                    orderId=order.id,
                    orderItemId=order_item.id,
                    waveId=wave_id,
                    picklistId=picklist.id,
                )

                # Allocate inventory
                result = allocation_service.allocate_inventory(
                    request=request,
                    company_id=company_id,
                    allocated_by_id=current_user.id
                )

                if result.allocatedQty > 0:
                    order_has_allocations = True
                    results["items_allocated"] += len(result.allocations)
                    results["total_quantity_allocated"] += result.allocatedQty

                    # Create picklist items from allocations
                    for alloc in result.allocations:
                        # Get bin code
                        bin_obj = session.get(Bin, alloc.binId)

                        picklist_item = PicklistItem(
                            picklistId=picklist.id,
                            skuId=alloc.skuId,
                            binId=alloc.binId,
                            requiredQty=alloc.allocatedQty,
                            pickedQty=0,
                            batchNo=None,  # Can be enhanced to pull from allocation
                        )
                        session.add(picklist_item)

                if result.shortfallQty > 0:
                    order_fully_allocated = False
                    # Get SKU info for shortfall report
                    sku = session.get(SKU, order_item.skuId)
                    results["shortfalls"].append({
                        "order_id": str(order.id),
                        "order_no": order.orderNo,
                        "sku_id": str(order_item.skuId),
                        "sku_code": sku.code if sku else "Unknown",
                        "required_qty": order_item.quantity,
                        "allocated_qty": result.allocatedQty,
                        "shortfall_qty": result.shortfallQty
                    })

            # Update order status
            if order_has_allocations:
                if order_fully_allocated:
                    order.status = OrderStatus.ALLOCATED
                    results["orders_fully_allocated"] += 1
                else:
                    order.status = OrderStatus.PARTIALLY_ALLOCATED
                    results["orders_partially_allocated"] += 1
                session.add(order)
                results["picklists_created"] += 1
            else:
                results["orders_not_allocated"] += 1
                # Remove empty picklist
                session.delete(picklist)

        # Update wave status if all orders have allocations
        if results["orders_processed"] > 0:
            wave.status = WaveStatus.RELEASED
            wave.releasedAt = datetime.utcnow()
            session.add(wave)

        session.commit()

        return results
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Picklist generation failed: {str(e)}\n{traceback.format_exc()}"
        )


@router.post("/{wave_id}/deallocate")
def deallocate_wave_inventory(
    wave_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_manager()),
    current_user: User = Depends(get_current_user)
):
    """
    Deallocate all inventory allocations for a wave.
    Used when cancelling a wave or re-planning.
    """
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    allocation_service = InventoryAllocationService(session)
    cancelled_count = allocation_service.deallocate_by_wave(
        wave_id=wave_id,
        cancelled_by_id=current_user.id
    )

    # Reset wave status if needed
    if wave.status in [WaveStatus.RELEASED, WaveStatus.IN_PROGRESS]:
        wave.status = WaveStatus.PLANNED
        session.add(wave)
        session.commit()

    return {
        "success": True,
        "wave_id": str(wave_id),
        "allocations_cancelled": cancelled_count,
        "message": f"Released {cancelled_count} inventory allocation(s)"
    }


@router.get("/{wave_id}/allocations")
def get_wave_allocations(
    wave_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get all inventory allocations for a wave.
    Shows what inventory has been reserved and from which bins.
    """
    wave = session.get(Wave, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="Wave not found")

    allocations = session.exec(
        select(InventoryAllocation)
        .where(InventoryAllocation.waveId == wave_id)
        .order_by(InventoryAllocation.allocatedAt)
    ).all()

    # Build response with SKU and Bin info
    result = []
    for alloc in allocations:
        sku = session.get(SKU, alloc.skuId)
        bin_obj = session.get(Bin, alloc.binId)

        result.append({
            "id": str(alloc.id),
            "allocationNo": alloc.allocationNo,
            "skuId": str(alloc.skuId),
            "skuCode": sku.code if sku else None,
            "skuName": sku.name if sku else None,
            "binId": str(alloc.binId),
            "binCode": bin_obj.code if bin_obj else None,
            "allocatedQty": alloc.allocatedQty,
            "pickedQty": alloc.pickedQty,
            "valuationMethod": alloc.valuationMethod,
            "fifoSequence": alloc.fifoSequence,
            "status": alloc.status,
            "allocatedAt": alloc.allocatedAt.isoformat() if alloc.allocatedAt else None,
        })

    return {
        "wave_id": str(wave_id),
        "total_allocations": len(result),
        "allocations": result
    }
