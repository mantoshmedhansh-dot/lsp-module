"""
Users API v1 - User management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.security import get_password_hash
from app.core.deps import get_current_user, require_admin, CompanyFilter
from app.models import (
    User, UserCreate, UserUpdate, UserResponse, UserBrief, UserRole
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserBrief])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """
    List all users with pagination and filters.
    Requires ADMIN or SUPER_ADMIN role.
    """
    query = select(User)

    # Apply company filter (non-super-admins can only see their company's users)
    query = company_filter.apply_filter(query, User.companyId)

    # Apply filters
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (User.name.ilike(search_pattern)) |
            (User.email.ilike(search_pattern))
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(User.createdAt.desc())

    users = session.exec(query).all()
    return [UserBrief.model_validate(u) for u in users]


@router.get("/count")
def count_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Get total count of users matching filters."""
    query = select(func.count(User.id))

    query = company_filter.apply_filter(query, User.companyId)
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Get a specific user by ID."""
    query = select(User).where(User.id == user_id)

    query = company_filter.apply_filter(query, User.companyId)

    user = session.exec(query).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """
    Create a new user.
    Non-super-admins can only create users for their own company.
    """
    # Check if email already exists
    existing = session.exec(
        select(User).where(User.email == user_data.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Non-super-admins can only create users for their own company
    if company_filter.company_id:
        if user_data.companyId and user_data.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create users for other companies"
            )
        user_data.companyId = company_filter.company_id

    # Hash password
    user_dict = user_data.model_dump()
    user_dict["password"] = get_password_hash(user_dict["password"])

    # Create user
    user = User(**user_dict)
    session.add(user)
    session.commit()
    session.refresh(user)

    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Update a user."""
    query = select(User).where(User.id == user_id)

    query = company_filter.apply_filter(query, User.companyId)

    user = session.exec(query).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields
    update_dict = user_data.model_dump(exclude_unset=True)

    # Hash password if being updated
    if "password" in update_dict:
        update_dict["password"] = get_password_hash(update_dict["password"])

    # Check email uniqueness if being updated
    if "email" in update_dict and update_dict["email"] != user.email:
        existing = session.exec(
            select(User).where(User.email == update_dict["email"])
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    for field, value in update_dict.items():
        setattr(user, field, value)

    session.add(user)
    session.commit()
    session.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin())
):
    """
    Soft delete a user (set isActive=False).
    Cannot delete yourself.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    query = select(User).where(User.id == user_id)

    query = company_filter.apply_filter(query, User.companyId)

    user = session.exec(query).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Soft delete
    user.isActive = False
    session.add(user)
    session.commit()

    return None
