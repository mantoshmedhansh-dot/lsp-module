"""
FeatureFlag and TenantFeature Models - Feature flag management
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase


# ============================================================================
# FeatureFlag Model
# ============================================================================

class FeatureFlag(BaseModel, table=True):
    """Feature flags for gradual rollout"""
    __tablename__ = "FeatureFlag"

    key: str = Field(sa_column=Column(String(100), unique=True, nullable=False, index=True))
    name: str = Field(sa_column=Column(String(200), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    isGlobal: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    isActive: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))

    # Relationships
    tenantOverrides: List["TenantFeature"] = Relationship(back_populates="featureFlag")


# ============================================================================
# TenantFeature Model
# ============================================================================

class TenantFeature(BaseModel, table=True):
    """Per-tenant feature flag overrides"""
    __tablename__ = "TenantFeature"

    companyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    featureFlagId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("FeatureFlag.id", ondelete="CASCADE"), nullable=False)
    )
    enabled: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))

    # Relationships
    featureFlag: Optional["FeatureFlag"] = Relationship(back_populates="tenantOverrides")


# ============================================================================
# Request/Response Schemas
# ============================================================================

class FeatureFlagResponse(ResponseBase):
    id: UUID
    key: str
    name: str
    description: Optional[str] = None
    isGlobal: bool
    isActive: bool
    createdAt: datetime
    updatedAt: datetime


class FeatureFlagCreate(CreateBase):
    key: str
    name: str
    description: Optional[str] = None
    isGlobal: bool = False


class FeatureFlagUpdate(UpdateBase):
    name: Optional[str] = None
    description: Optional[str] = None
    isGlobal: Optional[bool] = None
    isActive: Optional[bool] = None


class TenantFeatureResponse(ResponseBase):
    id: UUID
    companyId: UUID
    featureFlagId: UUID
    enabled: bool
    createdAt: datetime
    updatedAt: datetime


class TenantFeatureCreate(CreateBase):
    companyId: UUID
    featureFlagId: UUID
    enabled: bool = False


class TenantFeatureUpdate(UpdateBase):
    enabled: Optional[bool] = None
