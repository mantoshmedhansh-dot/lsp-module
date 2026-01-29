"""
Pre-orders API v1 - Pre-order management and inventory reservation
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, SKU,
    Preorder, PreorderCreate, PreorderUpdate, PreorderResponse,
    PreorderLine, PreorderLineCreate, PreorderLineResponse,
    PreorderInventory, PreorderInventoryResponse,
    PreorderStatus,
)


router = APIRouter(prefix="/preorders", tags=["Pre-orders"])


# ============================================================================
# Pre-orders CRUD
# ============================================================================

@router.get("", response_model=List[PreorderResponse])
def list_preorders(
    status: Optional[PreorderStatus] = None,
    customer_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List pre-orders"""
    query = select(Preorder)

    if company_filter.company_id:
        query = query.where(Preorder.companyId == company_filter.company_id)
    if status:
        query = query.where(Preorder.status == status)
    if customer_id:
        query = query.where(Preorder.customerId == customer_id)
    if channel:
        query = query.where(Preorder.channel == channel)

    query = query.order_by(Preorder.createdAt.desc()).offset(skip).limit(limit)
    preorders = session.exec(query).all()
    return preorders


@router.post("", response_model=PreorderResponse, status_code=status.HTTP_201_CREATED)
def create_preorder(
    data: PreorderCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new pre-order"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4

    # Generate preorder number
    count = session.exec(
        select(func.count(Preorder.id))
        .where(Preorder.companyId == company_filter.company_id)
    ).one()
    preorder_no = f"PRE-{datetime.now().strftime('%Y%m')}-{(count or 0) + 1:05d}"

    preorder = Preorder(
        id=uuid4(),
        companyId=company_filter.company_id,
        preorderNo=preorder_no,
        status=PreorderStatus.PENDING,
        createdById=current_user.id,
        **data.model_dump()
    )
    session.add(preorder)
    session.commit()
    session.refresh(preorder)
    return preorder


@router.get("/{preorder_id}", response_model=PreorderResponse)
def get_preorder(
    preorder_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific pre-order"""
    query = select(Preorder).where(Preorder.id == preorder_id)
    if company_filter.company_id:
        query = query.where(Preorder.companyId == company_filter.company_id)

    preorder = session.exec(query).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")
    return preorder


@router.patch("/{preorder_id}", response_model=PreorderResponse)
def update_preorder(
    preorder_id: UUID,
    data: PreorderUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a pre-order"""
    query = select(Preorder).where(Preorder.id == preorder_id)
    if company_filter.company_id:
        query = query.where(Preorder.companyId == company_filter.company_id)

    preorder = session.exec(query).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if preorder.status == PreorderStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Cannot update converted pre-order")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(preorder, key, value)

    preorder.updatedAt = datetime.utcnow()
    session.add(preorder)
    session.commit()
    session.refresh(preorder)
    return preorder


@router.delete("/{preorder_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_preorder(
    preorder_id: UUID,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Cancel a pre-order"""
    query = select(Preorder).where(Preorder.id == preorder_id)
    if company_filter.company_id:
        query = query.where(Preorder.companyId == company_filter.company_id)

    preorder = session.exec(query).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if preorder.status == PreorderStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Cannot cancel converted pre-order")

    preorder.status = PreorderStatus.CANCELLED
    if reason:
        preorder.notes = f"{preorder.notes or ''} | Cancelled: {reason}".strip(" |")
    preorder.updatedAt = datetime.utcnow()

    # Release reserved inventory
    reservations = session.exec(
        select(PreorderInventory).where(PreorderInventory.preorderId == preorder_id)
    ).all()
    for res in reservations:
        res.isReleased = True
        res.releasedAt = datetime.utcnow()
        session.add(res)

    session.add(preorder)
    session.commit()


# ============================================================================
# Pre-order Lines
# ============================================================================

@router.get("/{preorder_id}/lines", response_model=List[PreorderLineResponse])
def list_preorder_lines(
    preorder_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List lines for a pre-order"""
    lines = session.exec(
        select(PreorderLine).where(PreorderLine.preorderId == preorder_id)
    ).all()
    return lines


@router.post("/{preorder_id}/lines", response_model=PreorderLineResponse, status_code=status.HTTP_201_CREATED)
def add_preorder_line(
    preorder_id: UUID,
    data: PreorderLineCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add a line to a pre-order"""
    preorder = session.exec(select(Preorder).where(Preorder.id == preorder_id)).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if preorder.status not in [PreorderStatus.PENDING, PreorderStatus.CONFIRMED]:
        raise HTTPException(status_code=400, detail="Cannot add lines to this pre-order")

    # Validate SKU
    sku = session.exec(select(SKU).where(SKU.id == data.skuId)).first()
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    from uuid import uuid4
    from decimal import Decimal

    line = PreorderLine(
        id=uuid4(),
        companyId=preorder.companyId,
        preorderId=preorder_id,
        unitPrice=data.unitPrice or Decimal("0"),
        totalPrice=(data.unitPrice or Decimal("0")) * data.quantity,
        **data.model_dump(exclude={"unitPrice"})
    )
    session.add(line)
    session.commit()
    session.refresh(line)
    return line


# ============================================================================
# Convert to Order
# ============================================================================

@router.post("/{preorder_id}/convert")
def convert_to_order(
    preorder_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Convert a pre-order to a regular order"""
    query = select(Preorder).where(Preorder.id == preorder_id)
    if company_filter.company_id:
        query = query.where(Preorder.companyId == company_filter.company_id)

    preorder = session.exec(query).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if preorder.status != PreorderStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Only confirmed pre-orders can be converted")

    # Check inventory availability
    lines = session.exec(
        select(PreorderLine).where(PreorderLine.preorderId == preorder_id)
    ).all()

    if not lines:
        raise HTTPException(status_code=400, detail="Pre-order has no lines")

    # Create order (placeholder - would create actual Order)
    from uuid import uuid4
    order_id = uuid4()

    preorder.status = PreorderStatus.CONVERTED
    preorder.convertedToOrderId = order_id
    preorder.convertedAt = datetime.utcnow()
    preorder.convertedById = current_user.id
    preorder.updatedAt = datetime.utcnow()
    session.add(preorder)
    session.commit()

    return {
        "success": True,
        "orderId": str(order_id),
        "message": f"Pre-order {preorder.preorderNo} converted to order"
    }


# ============================================================================
# Inventory Status
# ============================================================================

@router.get("/inventory-status", response_model=List[PreorderInventoryResponse])
def get_preorder_inventory_status(
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    is_released: Optional[bool] = False,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get pre-order inventory reservations"""
    query = select(PreorderInventory)

    if company_filter.company_id:
        query = query.where(PreorderInventory.companyId == company_filter.company_id)
    if sku_id:
        query = query.where(PreorderInventory.skuId == sku_id)
    if location_id:
        query = query.where(PreorderInventory.locationId == location_id)
    if is_released is not None:
        query = query.where(PreorderInventory.isReleased == is_released)

    reservations = session.exec(query).all()
    return reservations


@router.post("/{preorder_id}/reserve-inventory")
def reserve_inventory(
    preorder_id: UUID,
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Reserve inventory for a pre-order"""
    from uuid import uuid4

    preorder = session.exec(select(Preorder).where(Preorder.id == preorder_id)).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if preorder.status != PreorderStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Pre-order must be confirmed to reserve inventory")

    lines = session.exec(
        select(PreorderLine).where(PreorderLine.preorderId == preorder_id)
    ).all()

    reserved_count = 0
    for line in lines:
        # Check if already reserved
        existing = session.exec(
            select(PreorderInventory)
            .where(PreorderInventory.preorderId == preorder_id)
            .where(PreorderInventory.skuId == line.skuId)
            .where(PreorderInventory.isReleased == False)
        ).first()

        if existing:
            continue

        reservation = PreorderInventory(
            id=uuid4(),
            companyId=preorder.companyId,
            preorderId=preorder_id,
            preorderLineId=line.id,
            skuId=line.skuId,
            locationId=location_id,
            reservedQuantity=line.quantity,
            isReleased=False
        )
        session.add(reservation)
        reserved_count += 1

    session.commit()

    return {
        "success": True,
        "reservedLines": reserved_count,
        "message": f"Reserved inventory for {reserved_count} lines"
    }


# ============================================================================
# Confirm Pre-order
# ============================================================================

@router.post("/{preorder_id}/confirm", response_model=PreorderResponse)
def confirm_preorder(
    preorder_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Confirm a pre-order"""
    query = select(Preorder).where(Preorder.id == preorder_id)
    if company_filter.company_id:
        query = query.where(Preorder.companyId == company_filter.company_id)

    preorder = session.exec(query).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if preorder.status != PreorderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending pre-orders can be confirmed")

    # Check if has lines
    lines_count = session.exec(
        select(func.count(PreorderLine.id))
        .where(PreorderLine.preorderId == preorder_id)
    ).one()

    if not lines_count:
        raise HTTPException(status_code=400, detail="Pre-order has no lines")

    preorder.status = PreorderStatus.CONFIRMED
    preorder.confirmedAt = datetime.utcnow()
    preorder.updatedAt = datetime.utcnow()
    session.add(preorder)
    session.commit()
    session.refresh(preorder)
    return preorder


# ============================================================================
# Summary
# ============================================================================

@router.get("/summary/stats")
def get_preorder_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get pre-order statistics"""
    base = select(Preorder)
    if company_filter.company_id:
        base = base.where(Preorder.companyId == company_filter.company_id)

    status_counts = {}
    for s in PreorderStatus:
        count = session.exec(
            select(func.count(Preorder.id))
            .where(Preorder.status == s)
            .where(Preorder.companyId == company_filter.company_id if company_filter.company_id else True)
        ).one()
        status_counts[s.value] = count

    # Total reserved inventory value
    reserved_value = session.exec(
        select(func.sum(PreorderInventory.reservedQuantity))
        .where(PreorderInventory.isReleased == False)
        .where(PreorderInventory.companyId == company_filter.company_id if company_filter.company_id else True)
    ).one() or 0

    return {
        "byStatus": status_counts,
        "totalReservedUnits": reserved_value,
        "conversionRate": 75  # Placeholder
    }
