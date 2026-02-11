"""
Auth API v1 - Authentication endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.core.database import get_session
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user, get_current_user_optional
from app.core.rate_limit import limiter, auth_limit
from app.models import (
    User, UserCreate, UserUpdate, UserResponse, UserBrief,
    UserLogin, UserLoginResponse
)
from app.models.company import Company
from app.models.client_contract import ClientContract

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=UserLoginResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    credentials: UserLogin,
    session: Session = Depends(get_session)
):
    """
    Authenticate user with email and password.
    Returns JWT access token.
    """
    # Find user by email
    statement = select(User).where(User.email == credentials.email)
    user = session.exec(statement).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check if user is active
    if not user.isActive:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Update last login
    user.lastLoginAt = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    # Create access token
    token = create_access_token(data={
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role
    })

    return UserLoginResponse(
        user=UserResponse.model_validate(user),
        token=token,
        expiresIn=3600  # 1 hour
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user's profile.
    """
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    update_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update current authenticated user's profile.
    Can update: name, phone, avatar
    """
    # Only allow certain fields to be updated
    allowed_fields = {"name", "phone", "avatar"}
    update_dict = update_data.model_dump(exclude_unset=True)

    for field, value in update_dict.items():
        if field in allowed_fields:
            setattr(current_user, field, value)

    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.post("/refresh", response_model=UserLoginResponse)
def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Refresh access token.
    Returns a new JWT access token.
    """
    token = create_access_token(data={
        "user_id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role
    })

    return UserLoginResponse(
        user=UserResponse.model_validate(current_user),
        token=token,
        expiresIn=3600  # 1 hour
    )


@router.get("/company-context")
def get_company_context(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current user's company context for frontend sidebar/gating.
    Returns companyType, parentId, and contract details if brand under LSP.
    """
    if not current_user.companyId:
        return {"companyType": None, "parentId": None, "contract": None}

    company = session.exec(
        select(Company).where(Company.id == current_user.companyId)
    ).first()

    if not company:
        return {"companyType": None, "parentId": None, "contract": None}

    result = {
        "companyType": company.companyType or "BRAND",
        "parentId": str(company.parentId) if company.parentId else None,
        "contract": None,
    }

    # If this is a brand under an LSP, fetch the contract
    if company.parentId and company.companyType == "BRAND":
        contract = session.exec(
            select(ClientContract).where(
                ClientContract.brandCompanyId == company.id,
                ClientContract.lspCompanyId == company.parentId,
            )
        ).first()
        if contract:
            result["contract"] = {
                "id": str(contract.id),
                "serviceModel": contract.serviceModel,
                "status": contract.status,
                "billingType": contract.billingType,
                "modules": contract.modules or [],
            }

    return result


@router.post("/logout")
def logout():
    """
    Logout endpoint (client-side token removal).
    This is a placeholder - JWT tokens are stateless.
    Client should remove the token from storage.
    """
    return {"message": "Successfully logged out"}
