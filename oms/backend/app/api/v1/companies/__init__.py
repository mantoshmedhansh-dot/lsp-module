"""
Companies API v1 - Company management endpoints
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
    Company, CompanyCreate, CompanyUpdate, CompanyResponse, CompanyBrief,
    User
)

router = APIRouter(prefix="/companies", tags=["Companies"])


def generate_company_code(name: str, session: Session) -> str:
    """
    Generate company code in format: XXX-0001
    - XXX = First 3 uppercase letters from company name (excluding common words)
    - 0001 = Sequential number based on existing companies count
    """
    # Common words to exclude
    stop_words = {'the', 'and', 'of', 'for', 'in', 'a', 'an', 'pvt', 'ltd', 'private', 'limited',
                  'llp', 'inc', 'corp', 'corporation', 'company', 'co', 'llc'}

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
        prefix = 'CMP'  # Fallback

    # Ensure prefix is exactly 3 characters
    prefix = prefix[:3].ljust(3, 'X')

    # Get current count of companies to determine next number
    company_count = session.exec(select(func.count(Company.id))).one()
    next_number = company_count + 1

    # Format: XXX-0001
    code = f"{prefix}-{next_number:04d}"

    # Check if code already exists and increment if needed
    existing = session.exec(
        select(Company).where(Company.code == code)
    ).first()

    while existing:
        next_number += 1
        code = f"{prefix}-{next_number:04d}"
        existing = session.exec(
            select(Company).where(Company.code == code)
        ).first()

    return code


def preview_company_code(name: str, session: Session) -> str:
    """
    Preview what the company code would be.
    Uses the same logic as generate_company_code.
    """
    # Common words to exclude
    stop_words = {'the', 'and', 'of', 'for', 'in', 'a', 'an', 'pvt', 'ltd', 'private', 'limited',
                  'llp', 'inc', 'corp', 'corporation', 'company', 'co', 'llc'}

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
        prefix = 'CMP'

    # Ensure prefix is exactly 3 characters
    prefix = prefix[:3].ljust(3, 'X')

    # Get current count of companies to determine next number
    company_count = session.exec(select(func.count(Company.id))).one()
    next_number = company_count + 1

    return f"{prefix}-{next_number:04d}"


@router.get("/preview-code")
def get_preview_code(
    name: str = Query(..., min_length=1, description="Company name to generate code for"),
    session: Session = Depends(get_session),
    _: None = Depends(require_super_admin())
):
    """
    Preview the auto-generated company code for a given name.
    Does not create any records - just shows what the code would be.
    """
    code = preview_company_code(name, session)
    return {"name": name, "code": code}


@router.get("", response_model=List[CompanyBrief])
def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """
    List companies.
    SUPER_ADMIN can see all companies.
    Others can only see their own company.
    """
    query = select(Company)

    # Non-super-admins can only see their own company
    query = company_filter.apply_filter(query, Company.id)

    # Apply filters
    if is_active is not None:
        query = query.where(Company.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Company.name.ilike(search_pattern)) |
            (Company.code.ilike(search_pattern))
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Company.name)

    companies = session.exec(query).all()
    return [CompanyBrief.model_validate(c) for c in companies]


@router.get("/count")
def count_companies(
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
    _: None = Depends(require_super_admin())
):
    """Get total count of companies. Requires SUPER_ADMIN."""
    query = select(func.count(Company.id))

    if is_active is not None:
        query = query.where(Company.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a specific company by ID."""
    # Non-super-admins can only view their own company
    if company_filter.company_id and company_id != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view other companies"
        )

    company = session.exec(
        select(Company).where(Company.id == company_id)
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    return CompanyResponse.model_validate(company)


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_data: CompanyCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_super_admin()),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new company.
    Requires SUPER_ADMIN role.
    Company code is auto-generated in format XXX-0001 if not provided.
    """
    # Get company data as dict
    data = company_data.model_dump()

    # Auto-generate code if not provided
    if not data.get('code'):
        data['code'] = generate_company_code(data['name'], session)
    else:
        # Check if provided code already exists
        existing = session.exec(
            select(Company).where(Company.code == data['code'])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company code already exists"
            )

    # Create company
    company = Company(**data)
    session.add(company)
    session.flush()
    log_audit(session, entity_type="Company", entity_id=company.id,
              action="CREATE", user_id=current_user.id,
              changes={"name": company.name, "code": company.code})
    session.commit()
    session.refresh(company)

    return CompanyResponse.model_validate(company)


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: UUID,
    company_data: CompanyUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update a company.
    SUPER_ADMIN can update any company.
    ADMIN can update their own company (limited fields).
    """
    company = session.exec(
        select(Company).where(Company.id == company_id)
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    # Non-super-admins can only update their own company
    if company_filter.company_id and company_id != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update other companies"
        )

    # Update fields
    update_dict = company_data.model_dump(exclude_unset=True)

    # Check code uniqueness if being updated
    if "code" in update_dict and update_dict["code"] != company.code:
        existing = session.exec(
            select(Company).where(Company.code == update_dict["code"])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company code already exists"
            )

    for field, value in update_dict.items():
        setattr(company, field, value)

    session.add(company)
    log_audit(session, entity_type="Company", entity_id=company.id,
              action="UPDATE", user_id=current_user.id, changes=update_dict)
    session.commit()
    session.refresh(company)

    return CompanyResponse.model_validate(company)


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_super_admin()),
    current_user: User = Depends(get_current_user)
):
    """
    Soft delete a company (set isActive=False).
    Requires SUPER_ADMIN role.
    """
    company = session.exec(
        select(Company).where(Company.id == company_id)
    ).first()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    # Soft delete
    company.isActive = False
    session.add(company)
    log_audit(session, entity_type="Company", entity_id=company.id,
              action="DELETE", user_id=current_user.id,
              changes={"name": company.name})
    session.commit()

    return None
