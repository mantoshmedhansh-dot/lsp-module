"""
Authentication API for B2B Logistics
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import verify_password, create_access_token
from app.models.user import User, UserLogin, UserResponse
from app.models.company import Company

router = APIRouter()


@router.post("/login")
async def login(
    credentials: UserLogin,
    db: Session = Depends(get_session)
):
    """Authenticate user and return JWT token"""
    # Find user by email
    statement = select(User).where(User.email == credentials.email)
    user = db.exec(statement).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.isActive:
        raise HTTPException(status_code=401, detail="Account is deactivated")

    # Update last login
    user.lastLoginAt = datetime.now(timezone.utc)
    db.add(user)
    db.commit()

    # Get company info
    company_name = None
    company_code = None
    if user.companyId:
        company = db.get(Company, user.companyId)
        if company:
            company_name = company.name
            company_code = company.code

    # Create token
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
    }
    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role.value if hasattr(user.role, 'value') else user.role,
            "companyId": str(user.companyId) if user.companyId else None,
            "companyName": company_name,
            "companyCode": company_code,
            "locationAccess": [str(loc) for loc in (user.locationAccess or [])],
            "isActive": user.isActive,
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    db: Session = Depends(get_session)
):
    """Get current user info (placeholder - needs JWT middleware)"""
    raise HTTPException(status_code=401, detail="Not authenticated")
