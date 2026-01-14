from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid

from ...core.database import get_db
from ...models.brand import Brand
from ...models.user import User
from ..deps import get_current_user

router = APIRouter()


class BrandCreate(BaseModel):
    code: str
    name: str
    logo: Optional[str] = None
    description: Optional[str] = None
    contactPerson: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[dict] = None


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    contactPerson: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    website: Optional[str] = None
    isActive: Optional[bool] = None


class BrandResponse(BaseModel):
    id: str
    code: str
    name: str
    logo: Optional[str] = None
    description: Optional[str] = None
    contactPerson: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    website: Optional[str] = None
    isActive: bool
    companyId: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[BrandResponse])
async def list_brands(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    isActive: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Brand)

    if current_user.companyId:
        query = query.filter(Brand.companyId == current_user.companyId)

    if search:
        query = query.filter(
            (Brand.code.ilike(f"%{search}%")) |
            (Brand.name.ilike(f"%{search}%"))
        )

    if isActive is not None:
        query = query.filter(Brand.isActive == isActive)

    brands = query.offset((page - 1) * pageSize).limit(pageSize).all()
    return [BrandResponse.model_validate(b) for b in brands]


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    brand_data: BrandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Brand).filter(Brand.code == brand_data.code).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brand code already exists"
        )

    brand = Brand(
        id=str(uuid.uuid4()),
        companyId=current_user.companyId,
        **brand_data.model_dump()
    )

    db.add(brand)
    db.commit()
    db.refresh(brand)

    return BrandResponse.model_validate(brand)


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )
    return BrandResponse.model_validate(brand)


@router.patch("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: str,
    brand_data: BrandUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )

    update_data = brand_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(brand, field, value)

    db.commit()
    db.refresh(brand)

    return BrandResponse.model_validate(brand)


@router.delete("/{brand_id}")
async def delete_brand(
    brand_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )

    db.delete(brand)
    db.commit()

    return {"message": "Brand deleted successfully"}
