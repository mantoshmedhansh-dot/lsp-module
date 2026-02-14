"""
Brands API v1 - Brand management endpoints
"""
import re
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_super_admin, CompanyFilter
from app.core.audit import log_audit
from app.models import (
    Brand, BrandCreate, BrandUpdate, BrandResponse, BrandBrief,
    User
)

router = APIRouter(prefix="/brands", tags=["Brands"])


def generate_brand_code(name: str, session: Session) -> str:
    """
    Generate brand code in format: XXX-0001
    - XXX = First 3 uppercase letters from brand name (excluding common words)
    - 0001 = Sequential number based on existing brands count
    """
    # Common words to exclude
    stop_words = {'the', 'and', 'of', 'for', 'in', 'a', 'an', 'pvt', 'ltd', 'private', 'limited',
                  'llp', 'inc', 'corp', 'corporation', 'company', 'co', 'llc', 'brand', 'brands'}

    # Clean and split the name
    words = re.sub(r'[^a-zA-Z\s]', '', name).lower().split()
    meaningful_words = [w for w in words if w not in stop_words]

    # If no meaningful words, use original words
    if not meaningful_words:
        meaningful_words = words

    # Generate prefix from meaningful words
    if len(meaningful_words) >= 3:
        # Use first letter of first 3 words
        prefix = ''.join(w[0] for w in meaningful_words[:3]).upper()
    elif len(meaningful_words) == 2:
        # Use first letter of first word + first 2 letters of second word
        prefix = (meaningful_words[0][0] + meaningful_words[1][:2]).upper()
    elif len(meaningful_words) == 1:
        # Use first 3 letters of the word
        prefix = meaningful_words[0][:3].upper()
    else:
        prefix = 'BRD'  # Fallback

    # Ensure prefix is exactly 3 characters
    prefix = prefix[:3].ljust(3, 'X')

    # Get current count of brands to determine next number
    brand_count = session.exec(select(func.count(Brand.id))).one()
    next_number = brand_count + 1

    # Format: XXX-0001
    code = f"{prefix}-{next_number:04d}"

    # Check if code already exists and increment if needed
    existing = session.exec(
        select(Brand).where(Brand.code == code)
    ).first()

    while existing:
        next_number += 1
        code = f"{prefix}-{next_number:04d}"
        existing = session.exec(
            select(Brand).where(Brand.code == code)
        ).first()

    return code


def preview_brand_code(name: str, session: Session) -> str:
    """
    Preview what the brand code would be.
    Uses the same logic as generate_brand_code.
    """
    # Common words to exclude
    stop_words = {'the', 'and', 'of', 'for', 'in', 'a', 'an', 'pvt', 'ltd', 'private', 'limited',
                  'llp', 'inc', 'corp', 'corporation', 'company', 'co', 'llc', 'brand', 'brands'}

    # Clean and split the name
    words = re.sub(r'[^a-zA-Z\s]', '', name).lower().split()
    meaningful_words = [w for w in words if w not in stop_words]

    # If no meaningful words, use original words
    if not meaningful_words:
        meaningful_words = words

    # Generate prefix from meaningful words
    if len(meaningful_words) >= 3:
        prefix = ''.join(w[0] for w in meaningful_words[:3]).upper()
    elif len(meaningful_words) == 2:
        prefix = (meaningful_words[0][0] + meaningful_words[1][:2]).upper()
    elif len(meaningful_words) == 1:
        prefix = meaningful_words[0][:3].upper()
    else:
        prefix = 'BRD'

    # Ensure prefix is exactly 3 characters
    prefix = prefix[:3].ljust(3, 'X')

    # Get current count of brands to determine next number
    brand_count = session.exec(select(func.count(Brand.id))).one()
    next_number = brand_count + 1

    return f"{prefix}-{next_number:04d}"


@router.get("/preview-code")
def get_preview_code(
    name: str = Query(..., min_length=1, description="Brand name to generate code for"),
    session: Session = Depends(get_session),
    _: None = Depends(get_current_user)
):
    """
    Preview the auto-generated brand code for a given name.
    Does not create any records - just shows what the code would be.
    """
    code = preview_brand_code(name, session)
    return {"name": name, "code": code}


@router.get("", response_model=List[BrandBrief])
def list_brands(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """
    List brands.
    SUPER_ADMIN can see all brands.
    Others can only see brands from their company.
    """
    query = select(Brand)

    # Non-super-admins can only see their own company's brands
    query = company_filter.apply_filter(query, Brand.companyId)

    # Apply filters
    if is_active is not None:
        query = query.where(Brand.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Brand.name.ilike(search_pattern)) |
            (Brand.code.ilike(search_pattern))
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Brand.name)

    brands = session.exec(query).all()
    return [BrandBrief.model_validate(b) for b in brands]


@router.get("/count")
def count_brands(
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(get_current_user)
):
    """Get total count of brands."""
    query = select(func.count(Brand.id))

    # Non-super-admins can only count their own company's brands
    query = company_filter.apply_filter(query, Brand.companyId)

    if is_active is not None:
        query = query.where(Brand.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{brand_id}", response_model=BrandResponse)
def get_brand(
    brand_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a specific brand by ID."""
    brand = session.exec(
        select(Brand).where(Brand.id == brand_id)
    ).first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )

    # Non-super-admins can only view their own company's brands
    if company_filter.company_id and brand.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view brands from other companies"
        )

    return BrandResponse.model_validate(brand)


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
def create_brand(
    brand_data: BrandCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new brand.
    Brand code is auto-generated in format XXX-0001 if not provided.
    """
    # Get brand data as dict
    data = brand_data.model_dump()

    # Auto-generate code if not provided or empty
    if not data.get('code'):
        data['code'] = generate_brand_code(data['name'], session)
    else:
        # Check if provided code already exists
        existing = session.exec(
            select(Brand).where(Brand.code == data['code'])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Brand code already exists"
            )

    # Create brand
    brand = Brand(**data)
    session.add(brand)
    session.flush()
    log_audit(session, entity_type="Brand", entity_id=brand.id,
              action="CREATE", user_id=current_user.id,
              changes={"name": brand.name, "code": brand.code})
    session.commit()
    session.refresh(brand)

    return BrandResponse.model_validate(brand)


@router.patch("/{brand_id}", response_model=BrandResponse)
def update_brand(
    brand_id: UUID,
    brand_data: BrandUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update a brand.
    SUPER_ADMIN can update any brand.
    Others can only update their own company's brands.
    """
    brand = session.exec(
        select(Brand).where(Brand.id == brand_id)
    ).first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )

    # Non-super-admins can only update their own company's brands
    if company_filter.company_id and brand.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update brands from other companies"
        )

    # Update fields
    update_dict = brand_data.model_dump(exclude_unset=True)

    # Check code uniqueness if being updated
    if "code" in update_dict and update_dict["code"] != brand.code:
        existing = session.exec(
            select(Brand).where(Brand.code == update_dict["code"])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Brand code already exists"
            )

    for field, value in update_dict.items():
        setattr(brand, field, value)

    session.add(brand)
    log_audit(session, entity_type="Brand", entity_id=brand.id,
              action="UPDATE", user_id=current_user.id, changes=update_dict)
    session.commit()
    session.refresh(brand)

    return BrandResponse.model_validate(brand)


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(
    brand_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Soft delete a brand (set isActive=False).
    """
    brand = session.exec(
        select(Brand).where(Brand.id == brand_id)
    ).first()

    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found"
        )

    # Soft delete
    brand.isActive = False
    session.add(brand)
    log_audit(session, entity_type="Brand", entity_id=brand.id,
              action="DELETE", user_id=current_user.id,
              changes={"name": brand.name})
    session.commit()

    return None
