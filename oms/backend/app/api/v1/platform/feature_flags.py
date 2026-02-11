"""
Feature Flags API - SUPER_ADMIN management of feature flags
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_roles
from app.models.feature_flag import (
    FeatureFlag, TenantFeature,
    FeatureFlagResponse, FeatureFlagCreate, FeatureFlagUpdate,
    TenantFeatureResponse, TenantFeatureCreate, TenantFeatureUpdate,
)

router = APIRouter(prefix="/feature-flags", tags=["Feature Flags"])


@router.get("", response_model=List[FeatureFlagResponse])
def list_feature_flags(
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """List all feature flags (SUPER_ADMIN only)."""
    flags = session.exec(
        select(FeatureFlag).order_by(FeatureFlag.key)
    ).all()
    return [FeatureFlagResponse.model_validate(f) for f in flags]


@router.post("", response_model=FeatureFlagResponse, status_code=201)
def create_feature_flag(
    data: FeatureFlagCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Create a feature flag (SUPER_ADMIN only)."""
    existing = session.exec(
        select(FeatureFlag).where(FeatureFlag.key == data.key)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feature flag key already exists")

    flag = FeatureFlag.model_validate(data)
    session.add(flag)
    session.flush()
    return FeatureFlagResponse.model_validate(flag)


@router.patch("/{flag_id}", response_model=FeatureFlagResponse)
def update_feature_flag(
    flag_id: UUID,
    data: FeatureFlagUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Update a feature flag (SUPER_ADMIN only)."""
    flag = session.get(FeatureFlag, flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(flag, key, value)

    session.add(flag)
    session.flush()
    return FeatureFlagResponse.model_validate(flag)


@router.delete("/{flag_id}", status_code=204)
def delete_feature_flag(
    flag_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Delete a feature flag (SUPER_ADMIN only)."""
    flag = session.get(FeatureFlag, flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    session.delete(flag)


@router.get("/tenant/{company_id}", response_model=List[TenantFeatureResponse])
def list_tenant_features(
    company_id: UUID,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """List feature flag overrides for a company."""
    if current_user.role != "SUPER_ADMIN" and current_user.companyId != company_id:
        raise HTTPException(status_code=403, detail="Access denied")

    features = session.exec(
        select(TenantFeature).where(TenantFeature.companyId == company_id)
    ).all()
    return [TenantFeatureResponse.model_validate(f) for f in features]


@router.post("/tenant", response_model=TenantFeatureResponse, status_code=201)
def set_tenant_feature(
    data: TenantFeatureCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Set a feature flag for a tenant (SUPER_ADMIN only)."""
    existing = session.exec(
        select(TenantFeature)
        .where(TenantFeature.companyId == data.companyId)
        .where(TenantFeature.featureFlagId == data.featureFlagId)
    ).first()

    if existing:
        existing.enabled = data.enabled
        session.add(existing)
        session.flush()
        return TenantFeatureResponse.model_validate(existing)

    feature = TenantFeature.model_validate(data)
    session.add(feature)
    session.flush()
    return TenantFeatureResponse.model_validate(feature)
