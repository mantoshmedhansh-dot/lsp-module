from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
import uuid

from ...core.database import get_db
from ...models.inventory import Inventory, SKU
from ...models.user import User
from ..deps import get_current_user

router = APIRouter()


class InventoryResponse(BaseModel):
    id: str
    quantity: int
    reservedQty: int
    availableQty: int
    batchNo: Optional[str] = None
    skuId: str
    skuCode: Optional[str] = None
    skuName: Optional[str] = None
    binId: str
    locationId: str

    class Config:
        from_attributes = True


class InventoryAdjustment(BaseModel):
    skuId: str
    binId: str
    quantity: int
    reason: str
    batchNo: Optional[str] = None


class InventoryMove(BaseModel):
    skuId: str
    fromBinId: str
    toBinId: str
    quantity: int
    batchNo: Optional[str] = None


@router.get("", response_model=List[InventoryResponse])
async def list_inventory(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    locationId: Optional[str] = None,
    skuId: Optional[str] = None,
    binId: Optional[str] = None,
    lowStock: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Inventory).join(SKU)

    if locationId:
        query = query.filter(Inventory.locationId == locationId)

    if skuId:
        query = query.filter(Inventory.skuId == skuId)

    if binId:
        query = query.filter(Inventory.binId == binId)

    if lowStock:
        query = query.filter(Inventory.quantity <= SKU.reorderLevel)

    inventories = query.offset((page - 1) * pageSize).limit(pageSize).all()

    result = []
    for inv in inventories:
        result.append(InventoryResponse(
            id=inv.id,
            quantity=inv.quantity,
            reservedQty=inv.reservedQty,
            availableQty=inv.quantity - inv.reservedQty,
            batchNo=inv.batchNo,
            skuId=inv.skuId,
            skuCode=inv.sku.code if inv.sku else None,
            skuName=inv.sku.name if inv.sku else None,
            binId=inv.binId,
            locationId=inv.locationId
        ))

    return result


@router.get("/summary")
async def get_inventory_summary(
    locationId: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        func.count(func.distinct(Inventory.skuId)).label("totalSkus"),
        func.sum(Inventory.quantity).label("totalQuantity"),
        func.sum(Inventory.reservedQty).label("totalReserved")
    )

    if locationId:
        query = query.filter(Inventory.locationId == locationId)

    result = query.first()

    return {
        "totalSkus": result.totalSkus or 0,
        "totalQuantity": result.totalQuantity or 0,
        "totalReserved": result.totalReserved or 0,
        "totalAvailable": (result.totalQuantity or 0) - (result.totalReserved or 0)
    }


@router.post("/adjustments")
async def create_adjustment(
    adjustment: InventoryAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inventory = db.query(Inventory).filter(
        Inventory.skuId == adjustment.skuId,
        Inventory.binId == adjustment.binId
    ).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found"
        )

    old_qty = inventory.quantity
    inventory.quantity = adjustment.quantity
    db.commit()

    return {
        "message": "Inventory adjusted",
        "previousQty": old_qty,
        "newQty": adjustment.quantity
    }


@router.post("/move")
async def move_inventory(
    move: InventoryMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from_inventory = db.query(Inventory).filter(
        Inventory.skuId == move.skuId,
        Inventory.binId == move.fromBinId
    ).first()

    if not from_inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source inventory not found"
        )

    if from_inventory.quantity < move.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient quantity"
        )

    # Find or create destination inventory
    to_inventory = db.query(Inventory).filter(
        Inventory.skuId == move.skuId,
        Inventory.binId == move.toBinId
    ).first()

    if not to_inventory:
        to_inventory = Inventory(
            id=str(uuid.uuid4()),
            skuId=move.skuId,
            binId=move.toBinId,
            locationId=from_inventory.locationId,
            quantity=0,
            reservedQty=0
        )
        db.add(to_inventory)

    from_inventory.quantity -= move.quantity
    to_inventory.quantity += move.quantity

    db.commit()

    return {"message": "Inventory moved successfully"}
