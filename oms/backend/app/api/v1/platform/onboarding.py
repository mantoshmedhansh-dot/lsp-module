"""
Onboarding API - Self-service signup and onboarding wizard
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, get_current_user_optional
from app.core.security import get_password_hash, create_access_token
from app.models.onboarding import (
    OnboardingStep, OnboardingStepResponse, OnboardingStepUpdate,
    OnboardingStatusResponse,
)
from app.models.company import Company, CompanyCreate
from app.models.user import User
from app.models.plan import Plan
from app.models.tenant_subscription import TenantSubscription

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

# Default onboarding steps
DEFAULT_STEPS = [
    {"stepKey": "company_profile", "stepOrder": 1},
    {"stepKey": "first_location", "stepOrder": 2},
    {"stepKey": "first_sku", "stepOrder": 3},
    {"stepKey": "first_order", "stepOrder": 4},
    {"stepKey": "invite_team", "stepOrder": 5},
]


class SignupRequest:
    """Not a SQLModel - just used for typing"""
    pass


from pydantic import BaseModel as PydanticBaseModel


class SignupData(PydanticBaseModel):
    companyName: str
    adminName: str
    adminEmail: str
    adminPassword: str
    planSlug: str = "free"
    gst: str = "NA"
    pan: str = "NA"


@router.post("/signup", status_code=201)
def signup(
    data: SignupData,
    session: Session = Depends(get_session),
):
    """
    Self-service signup: creates company + admin user + subscription + onboarding steps.
    Public endpoint (no auth required).
    """
    # Check if email already exists
    existing_user = session.exec(
        select(User).where(User.email == data.adminEmail)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Find plan
    plan = session.exec(
        select(Plan).where(Plan.slug == data.planSlug).where(Plan.isActive == True)
    ).first()
    if not plan:
        # Default to free plan
        plan = session.exec(
            select(Plan).where(Plan.slug == "free")
        ).first()

    # Generate company code
    import re
    clean_name = re.sub(r'[^a-zA-Z]', '', data.companyName).upper()
    prefix = clean_name[:3].ljust(3, 'X')
    from sqlmodel import func
    count = session.exec(select(func.count(Company.id))).one() or 0
    code = f"{prefix}-{count + 1:04d}"

    # Create company
    company = Company(
        code=code,
        name=data.companyName,
        gst=data.gst,
        pan=data.pan,
        email=data.adminEmail,
        subscriptionStatus="trialing",
        trialEndsAt=datetime.now(timezone.utc) + timedelta(days=14),
    )
    session.add(company)
    session.flush()

    # Create admin user
    user = User(
        name=data.adminName,
        email=data.adminEmail,
        password=get_password_hash(data.adminPassword),
        role="ADMIN",
        companyId=company.id,
        isActive=True,
    )
    session.add(user)
    session.flush()

    # Create subscription
    if plan:
        sub = TenantSubscription(
            companyId=company.id,
            planId=plan.id,
            status="trialing",
            billingCycle="monthly",
            trialEndsAt=datetime.now(timezone.utc) + timedelta(days=14),
        )
        session.add(sub)

    # Create onboarding steps
    for step_data in DEFAULT_STEPS:
        step = OnboardingStep(
            companyId=company.id,
            stepKey=step_data["stepKey"],
            stepOrder=step_data["stepOrder"],
        )
        session.add(step)

    session.flush()

    # Generate auth token
    token = create_access_token(data={"user_id": str(user.id)})

    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "companyId": str(company.id),
            "companyName": company.name,
            "companyCode": company.code,
        },
        "company": {
            "id": str(company.id),
            "name": company.name,
            "code": company.code,
        },
    }


@router.get("/status", response_model=OnboardingStatusResponse)
def get_onboarding_status(
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Get onboarding status for the current user's company."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    steps = session.exec(
        select(OnboardingStep)
        .where(OnboardingStep.companyId == current_user.companyId)
        .order_by(OnboardingStep.stepOrder)
    ).all()

    completed_count = sum(1 for s in steps if s.completed)
    total_count = len(steps)

    return OnboardingStatusResponse(
        companyId=current_user.companyId,
        steps=[OnboardingStepResponse.model_validate(s) for s in steps],
        completedCount=completed_count,
        totalCount=total_count,
        isComplete=completed_count >= total_count and total_count > 0,
    )


@router.post("/complete-step/{step_key}")
def complete_onboarding_step(
    step_key: str,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Mark an onboarding step as completed."""
    if not current_user.companyId:
        raise HTTPException(status_code=400, detail="User has no company")

    step = session.exec(
        select(OnboardingStep)
        .where(OnboardingStep.companyId == current_user.companyId)
        .where(OnboardingStep.stepKey == step_key)
    ).first()

    if not step:
        raise HTTPException(status_code=404, detail="Onboarding step not found")

    step.completed = True
    step.completedAt = datetime.now(timezone.utc)
    session.add(step)
    session.flush()

    return {"status": "completed", "stepKey": step_key}
