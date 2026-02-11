"""
OnboardingStep Model - Tracks tenant onboarding progress
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase

if TYPE_CHECKING:
    from .company import Company


# ============================================================================
# OnboardingStep Model
# ============================================================================

class OnboardingStep(BaseModel, table=True):
    """Tracks onboarding progress per tenant"""
    __tablename__ = "OnboardingStep"

    companyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    stepKey: str = Field(sa_column=Column(String(50), nullable=False))
    stepOrder: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    completed: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    completedAt: Optional[datetime] = Field(default=None)
    extra: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSONB, default={}))

    # Relationships
    company: Optional["Company"] = Relationship(back_populates="onboardingSteps")


# ============================================================================
# Request/Response Schemas
# ============================================================================

class OnboardingStepResponse(ResponseBase):
    id: UUID
    companyId: UUID
    stepKey: str
    stepOrder: int
    completed: bool
    completedAt: Optional[datetime] = None
    extra: Optional[dict] = None
    createdAt: datetime
    updatedAt: datetime


class OnboardingStepCreate(CreateBase):
    companyId: UUID
    stepKey: str
    stepOrder: int = 0


class OnboardingStepUpdate(UpdateBase):
    completed: Optional[bool] = None
    completedAt: Optional[datetime] = None
    extra: Optional[dict] = None


class OnboardingStatusResponse(ResponseBase):
    """Aggregated onboarding status"""
    companyId: UUID
    steps: list = []
    completedCount: int = 0
    totalCount: int = 0
    isComplete: bool = False
