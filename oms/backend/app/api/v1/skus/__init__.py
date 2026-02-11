"""
SKUs API v1 - Product/SKU management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    SKU, SKUCreate, SKUUpdate, SKUResponse, SKUBrief
)

router = APIRouter(prefix="/skus", tags=["SKUs"])


@router.get("", response_model=List[SKUBrief])
def list_skus(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    brand: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """
    List SKUs with pagination and filters.
    Filtered by company.
    """
    query = select(SKU)

    # Apply company filter
    query = company_filter.apply_filter(query, SKU.companyId)

    # Apply filters
    if category:
        query = query.where(SKU.category == category)
    if brand:
        query = query.where(SKU.brand == brand)
    if is_active is not None:
        query = query.where(SKU.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (SKU.name.ilike(search_pattern)) |
            (SKU.code.ilike(search_pattern)) |
            (SKU.description.ilike(search_pattern))
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(SKU.code)

    skus = session.exec(query).all()
    return [SKUBrief.model_validate(s) for s in skus]


@router.get("/count")
def count_skus(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get total count of SKUs matching filters."""
    query = select(func.count(SKU.id))

    query = company_filter.apply_filter(query, SKU.companyId)
    if category:
        query = query.where(SKU.category == category)
    if brand:
        query = query.where(SKU.brand == brand)
    if is_active is not None:
        query = query.where(SKU.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/categories")
def list_categories(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get list of unique categories."""
    query = select(SKU.category).distinct()

    query = company_filter.apply_filter(query, SKU.companyId)

    query = query.where(SKU.category.isnot(None))

    categories = session.exec(query).all()
    return {"categories": [c for c in categories if c]}


@router.get("/brands")
def list_brands(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get list of unique brands."""
    query = select(SKU.brand).distinct()

    query = company_filter.apply_filter(query, SKU.companyId)

    query = query.where(SKU.brand.isnot(None))

    brands = session.exec(query).all()
    return {"brands": [b for b in brands if b]}


@router.get("/{sku_id}", response_model=SKUResponse)
def get_sku(
    sku_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a specific SKU by ID."""
    query = select(SKU).where(SKU.id == sku_id)

    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    return SKUResponse.model_validate(sku)


@router.get("/code/{code}", response_model=SKUResponse)
def get_sku_by_code(
    code: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a SKU by code."""
    query = select(SKU).where(SKU.code == code)

    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    return SKUResponse.model_validate(sku)


@router.post("", response_model=SKUResponse, status_code=status.HTTP_201_CREATED)
def create_sku(
    sku_data: SKUCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Create a new SKU. Requires MANAGER or higher role."""
    # Non-super-admins can only create SKUs for their own company
    if company_filter.company_id:
        if sku_data.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create SKUs for other companies"
            )

    # Check if code already exists for this company
    existing = session.exec(
        select(SKU).where(
            SKU.code == sku_data.code,
            SKU.companyId == sku_data.companyId
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SKU code already exists"
        )

    # Create SKU
    sku = SKU(**sku_data.model_dump())
    session.add(sku)
    session.commit()
    session.refresh(sku)

    return SKUResponse.model_validate(sku)


@router.patch("/{sku_id}", response_model=SKUResponse)
def update_sku(
    sku_id: UUID,
    sku_data: SKUUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update a SKU. Requires MANAGER or higher role."""
    query = select(SKU).where(SKU.id == sku_id)

    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    # Update fields
    update_dict = sku_data.model_dump(exclude_unset=True)

    # Check code uniqueness if being updated
    if "code" in update_dict and update_dict["code"] != sku.code:
        existing = session.exec(
            select(SKU).where(
                SKU.code == update_dict["code"],
                SKU.companyId == sku.companyId
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SKU code already exists"
            )

    for field, value in update_dict.items():
        setattr(sku, field, value)

    session.add(sku)
    session.commit()
    session.refresh(sku)

    return SKUResponse.model_validate(sku)


@router.delete("/{sku_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sku(
    sku_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Soft delete a SKU. Requires MANAGER or higher role."""
    query = select(SKU).where(SKU.id == sku_id)

    query = company_filter.apply_filter(query, SKU.companyId)

    sku = session.exec(query).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    sku.isActive = False
    session.add(sku)
    session.commit()

    return None
