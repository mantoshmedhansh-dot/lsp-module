from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid

from ...core.database import get_db
from ...models.inventory import SKU
from ...models.user import User
from ..deps import get_current_user

router = APIRouter()


class SKUCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    brand: Optional[str] = None
    hsn: Optional[str] = None
    weight: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    mrp: Optional[float] = None
    costPrice: Optional[float] = None
    sellingPrice: Optional[float] = None
    taxRate: Optional[float] = None
    barcodes: List[str] = []
    images: List[str] = []


class SKUUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    mrp: Optional[float] = None
    costPrice: Optional[float] = None
    sellingPrice: Optional[float] = None
    isActive: Optional[bool] = None


class SKUResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    brand: Optional[str] = None
    hsn: Optional[str] = None
    mrp: Optional[float] = None
    costPrice: Optional[float] = None
    sellingPrice: Optional[float] = None
    isActive: bool
    companyId: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[SKUResponse])
async def list_skus(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    isActive: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(SKU)

    if current_user.companyId:
        query = query.filter(SKU.companyId == current_user.companyId)

    if search:
        query = query.filter(
            (SKU.code.ilike(f"%{search}%")) |
            (SKU.name.ilike(f"%{search}%"))
        )

    if category:
        query = query.filter(SKU.category == category)

    if brand:
        query = query.filter(SKU.brand == brand)

    if isActive is not None:
        query = query.filter(SKU.isActive == isActive)

    skus = query.offset((page - 1) * pageSize).limit(pageSize).all()
    return [SKUResponse.model_validate(s) for s in skus]


@router.post("", response_model=SKUResponse, status_code=status.HTTP_201_CREATED)
async def create_sku(
    sku_data: SKUCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(SKU).filter(
        SKU.code == sku_data.code,
        SKU.companyId == current_user.companyId
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SKU code already exists"
        )

    sku = SKU(
        id=str(uuid.uuid4()),
        companyId=current_user.companyId,
        **sku_data.model_dump()
    )

    db.add(sku)
    db.commit()
    db.refresh(sku)

    return SKUResponse.model_validate(sku)


@router.get("/{sku_id}", response_model=SKUResponse)
async def get_sku(
    sku_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sku = db.query(SKU).filter(SKU.id == sku_id).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )
    return SKUResponse.model_validate(sku)


@router.patch("/{sku_id}", response_model=SKUResponse)
async def update_sku(
    sku_id: str,
    sku_data: SKUUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sku = db.query(SKU).filter(SKU.id == sku_id).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    update_data = sku_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sku, field, value)

    db.commit()
    db.refresh(sku)

    return SKUResponse.model_validate(sku)


@router.delete("/{sku_id}")
async def delete_sku(
    sku_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sku = db.query(SKU).filter(SKU.id == sku_id).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    db.delete(sku)
    db.commit()

    return {"message": "SKU deleted successfully"}
