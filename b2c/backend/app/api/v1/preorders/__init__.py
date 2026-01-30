"""
Pre-order API Endpoints
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.preorder import (
    Preorder, PreorderLine, PreorderInventory,
    PreorderStatus, InventoryReservationType,
    PreorderCreate, PreorderResponse, PreorderLineResponse,
    PreorderConvertRequest, PreorderConvertResponse,
    PreorderInventoryStatusResponse
)
from app.services.subscription_engine import preorder_engine

router = APIRouter()


def generate_preorder_number() -> str:
    """Generate a unique pre-order number."""
    return f"PRE-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"


@router.post("", response_model=PreorderResponse)
async def create_preorder(
    preorder: PreorderCreate,
    db: Session = Depends(get_session)
):
    """Create a new pre-order."""
    new_preorder = Preorder(
        preorderNumber=generate_preorder_number(),
        customerId=preorder.customerId,
        warehouseId=preorder.warehouseId,
        expectedReleaseDate=preorder.expectedReleaseDate,
        depositAmount=preorder.depositAmount,
        shippingAddressId=preorder.shippingAddressId,
        billingAddressId=preorder.billingAddressId,
        notes=preorder.notes,
        status=PreorderStatus.PENDING
    )
    db.add(new_preorder)
    db.commit()
    db.refresh(new_preorder)

    # Add line items
    total_amount = 0.0
    for idx, line_data in enumerate(preorder.lines):
        line = PreorderLine(
            preorderId=new_preorder.id,
            lineNumber=idx + 1,
            itemId=line_data.get("itemId"),
            sku=line_data.get("sku"),
            itemName=line_data.get("itemName"),
            quantity=line_data.get("quantity", 1),
            unitPrice=line_data.get("unitPrice", 0),
            totalPrice=line_data.get("quantity", 1) * line_data.get("unitPrice", 0)
        )
        total_amount += line.totalPrice
        db.add(line)

    new_preorder.totalAmount = total_amount
    db.add(new_preorder)
    db.commit()
    db.refresh(new_preorder)

    return new_preorder


@router.get("", response_model=List[PreorderResponse])
async def list_preorders(
    warehouse_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    status: Optional[PreorderStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List pre-orders."""
    stmt = select(Preorder)
    if warehouse_id:
        stmt = stmt.where(Preorder.warehouseId == warehouse_id)
    if customer_id:
        stmt = stmt.where(Preorder.customerId == customer_id)
    if status:
        stmt = stmt.where(Preorder.status == status)
    stmt = stmt.order_by(Preorder.createdAt.desc()).limit(limit)
    return db.exec(stmt).all()


@router.get("/{preorder_id}", response_model=PreorderResponse)
async def get_preorder(
    preorder_id: UUID,
    db: Session = Depends(get_session)
):
    """Get pre-order details."""
    stmt = select(Preorder).where(Preorder.id == preorder_id)
    preorder = db.exec(stmt).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")
    return preorder


@router.get("/{preorder_id}/lines", response_model=List[PreorderLineResponse])
async def get_preorder_lines(
    preorder_id: UUID,
    db: Session = Depends(get_session)
):
    """Get pre-order lines."""
    stmt = select(PreorderLine).where(
        PreorderLine.preorderId == preorder_id
    ).order_by(PreorderLine.lineNumber)
    return db.exec(stmt).all()


@router.put("/{preorder_id}", response_model=PreorderResponse)
async def update_preorder(
    preorder_id: UUID,
    expected_release_date: Optional[datetime] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Update a pre-order."""
    stmt = select(Preorder).where(Preorder.id == preorder_id)
    preorder = db.exec(stmt).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    if expected_release_date:
        preorder.expectedReleaseDate = expected_release_date
    if notes:
        preorder.notes = notes

    db.add(preorder)
    db.commit()
    db.refresh(preorder)
    return preorder


@router.delete("/{preorder_id}")
async def cancel_preorder(
    preorder_id: UUID,
    reason: str = Query(...),
    db: Session = Depends(get_session)
):
    """Cancel a pre-order."""
    stmt = select(Preorder).where(Preorder.id == preorder_id)
    preorder = db.exec(stmt).first()
    if not preorder:
        raise HTTPException(status_code=404, detail="Pre-order not found")

    preorder.status = PreorderStatus.CANCELLED
    preorder.cancelledAt = datetime.now(timezone.utc)
    preorder.cancelReason = reason
    db.add(preorder)
    db.commit()

    return {"message": "Pre-order cancelled"}


@router.post("/{preorder_id}/convert", response_model=PreorderConvertResponse)
async def convert_preorder(
    preorder_id: UUID,
    request: PreorderConvertRequest,
    db: Session = Depends(get_session)
):
    """Convert a pre-order to a regular order."""
    result = await preorder_engine.convert_to_order(db, preorder_id)
    return PreorderConvertResponse(**result)


@router.get("/inventory-status", response_model=PreorderInventoryStatusResponse)
async def get_inventory_status(
    preorder_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Get inventory availability status for a pre-order."""
    return await preorder_engine.check_inventory_status(db, preorder_id)
