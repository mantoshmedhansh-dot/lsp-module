"""
Picklists API v1 - Direct picklist generation from orders
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, CompanyFilter
from app.models import (
    User, Order, OrderItem, SKU, Bin, Inventory, Location,
    Picklist, PicklistCreate, PicklistResponse,
    PicklistItem, PicklistItemCreate, PicklistItemResponse,
    PicklistStatus, OrderStatus,
    AllocationRequest, InventoryAllocation
)
from app.services.inventory_allocation import InventoryAllocationService

router = APIRouter(prefix="/picklists", tags=["Picklists"])


class GeneratePicklistsRequest(BaseModel):
    """Request to generate picklists for multiple orders."""
    orderIds: List[UUID]


class GeneratePicklistsResponse(BaseModel):
    """Response from picklist generation."""
    created: int
    failed: int
    errors: List[str]
    picklists: List[dict]


def generate_picklist_number(session: Session) -> str:
    """Generate unique picklist number."""
    count = session.exec(select(func.count(Picklist.id))).one()
    return f"PL-{count + 1:06d}"


@router.post("", response_model=GeneratePicklistsResponse)
def generate_picklists_for_orders(
    data: GeneratePicklistsRequest,
    session: Session = Depends(get_session),
    company_filter: CompanyFilter = Depends(),
    current_user: User = Depends(get_current_user)
):
    """
    Generate picklists for selected orders.

    This endpoint:
    1. Takes a list of order IDs
    2. For each allocated order, creates a picklist
    3. Creates picklist items from existing inventory allocations
    4. Updates order status to PICKLIST_GENERATED

    Returns summary of created picklists.
    """
    import traceback

    created = 0
    failed = 0
    errors = []
    picklists_created = []

    for order_id in data.orderIds:
        try:
            # Get the order
            order = session.get(Order, order_id)
            if not order:
                errors.append(f"Order {order_id} not found")
                failed += 1
                continue

            # Check order status - must be ALLOCATED or PARTIALLY_ALLOCATED
            if order.status not in [OrderStatus.ALLOCATED, OrderStatus.PARTIALLY_ALLOCATED]:
                errors.append(f"Order {order.orderNo} is not allocated (status: {order.status})")
                failed += 1
                continue

            # Check if picklist already exists for this order
            existing_picklist = session.exec(
                select(Picklist).where(Picklist.orderId == order_id)
            ).first()

            if existing_picklist:
                errors.append(f"Order {order.orderNo} already has a picklist")
                failed += 1
                continue

            # Get company ID from order
            company_id = order.companyId

            # Get inventory allocations for this order
            allocations = session.exec(
                select(InventoryAllocation)
                .where(InventoryAllocation.orderId == order_id)
                .where(InventoryAllocation.status == "ALLOCATED")
            ).all()

            if not allocations:
                # No allocations found - try to allocate now
                # Get order items
                order_items = session.exec(
                    select(OrderItem).where(OrderItem.orderId == order_id)
                ).all()

                if not order_items:
                    errors.append(f"Order {order.orderNo} has no items")
                    failed += 1
                    continue

                # Get location from order
                location_id = order.locationId
                if not location_id:
                    # Try to get from user's location access
                    if current_user.locationAccess and len(current_user.locationAccess) > 0:
                        location_id = current_user.locationAccess[0]
                    else:
                        errors.append(f"Order {order.orderNo} has no location")
                        failed += 1
                        continue

                # Initialize allocation service and allocate
                allocation_service = InventoryAllocationService(session)

                for order_item in order_items:
                    request = AllocationRequest(
                        skuId=order_item.skuId,
                        requiredQty=order_item.quantity,
                        locationId=location_id,
                        orderId=order.id,
                        orderItemId=order_item.id,
                    )

                    allocation_service.allocate_inventory(
                        request=request,
                        company_id=company_id,
                        allocated_by_id=current_user.id
                    )

                # Re-fetch allocations
                allocations = session.exec(
                    select(InventoryAllocation)
                    .where(InventoryAllocation.orderId == order_id)
                    .where(InventoryAllocation.status == "ALLOCATED")
                ).all()

            if not allocations:
                errors.append(f"Order {order.orderNo} has no inventory allocations")
                failed += 1
                continue

            # Create picklist
            picklist = Picklist(
                picklistNo=generate_picklist_number(session),
                orderId=order.id,
                status=PicklistStatus.PENDING,
                companyId=company_id,
            )
            session.add(picklist)
            session.flush()  # Get picklist ID

            # Create picklist items from allocations
            for alloc in allocations:
                picklist_item = PicklistItem(
                    picklistId=picklist.id,
                    skuId=alloc.skuId,
                    binId=alloc.binId,
                    requiredQty=alloc.allocatedQty,
                    pickedQty=0,
                    batchNo=None,
                )
                session.add(picklist_item)

                # Update allocation with picklist ID
                alloc.picklistId = picklist.id
                session.add(alloc)

            # Update order status
            order.status = OrderStatus.PICKLIST_GENERATED
            order.updatedAt = datetime.utcnow()
            session.add(order)

            created += 1
            picklists_created.append({
                "id": str(picklist.id),
                "picklistNo": picklist.picklistNo,
                "orderId": str(order.id),
                "orderNo": order.orderNo,
                "itemCount": len(allocations)
            })

        except Exception as e:
            failed += 1
            errors.append(f"Order {order_id}: {str(e)}")
            session.rollback()
            continue

    # Commit all changes
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save picklists: {str(e)}"
        )

    return GeneratePicklistsResponse(
        created=created,
        failed=failed,
        errors=errors,
        picklists=picklists_created
    )
