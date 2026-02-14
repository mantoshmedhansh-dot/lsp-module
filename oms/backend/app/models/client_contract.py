"""
ClientContract Model - LSP-to-Brand service relationships
"""
from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, Date
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy import Numeric

from .base import BaseModel, ResponseBase, CreateBase, UpdateBase

if TYPE_CHECKING:
    from .company import Company


class ClientContract(BaseModel, table=True):
    __tablename__ = "ClientContract"
    __table_args__ = (
        UniqueConstraint("lspCompanyId", "brandCompanyId", name="uq_client_contract_lsp_brand"),
    )

    lspCompanyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    brandCompanyId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("Company.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    serviceModel: str = Field(
        default="FULL",
        sa_column=Column(String(20), nullable=False, default="FULL")
    )  # WAREHOUSING, LOGISTICS, FULL
    status: str = Field(
        default="active",
        sa_column=Column(String(20), nullable=False, default="active")
    )  # active, onboarding, suspended, terminated
    contractStart: Optional[date] = Field(default=None, sa_column=Column(Date))
    contractEnd: Optional[date] = Field(default=None, sa_column=Column(Date))
    billingType: Optional[str] = Field(
        default="per_order",
        sa_column=Column(String(20), default="per_order")
    )  # per_order, per_sqft, fixed, hybrid
    billingRate: Optional[float] = Field(default=0, sa_column=Column(Numeric(12, 2), default=0))
    warehouseIds: Optional[list] = Field(default=None, sa_column=Column(JSONB, default=[]))
    modules: Optional[list] = Field(default=None, sa_column=Column(JSONB, default=[]))
    config: Optional[dict] = Field(default=None, sa_column=Column(JSONB, default={}))
    slaConfig: Optional[dict] = Field(default=None, sa_column=Column(JSONB, default={}))

    # Relationships
    lspCompany: Optional["Company"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ClientContract.lspCompanyId]"}
    )
    brandCompany: Optional["Company"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ClientContract.brandCompanyId]"}
    )


# Request/Response Schemas
class ClientContractCreate(CreateBase):
    lspCompanyId: UUID
    brandCompanyId: UUID
    serviceModel: str = "FULL"
    status: str = "active"
    contractStart: Optional[date] = None
    contractEnd: Optional[date] = None
    billingType: Optional[str] = "per_order"
    billingRate: Optional[float] = 0
    warehouseIds: Optional[list] = None
    modules: Optional[list] = None
    config: Optional[dict] = None
    slaConfig: Optional[dict] = None


class ClientContractUpdate(UpdateBase):
    serviceModel: Optional[str] = None
    status: Optional[str] = None
    contractStart: Optional[date] = None
    contractEnd: Optional[date] = None
    billingType: Optional[str] = None
    billingRate: Optional[float] = None
    warehouseIds: Optional[list] = None
    modules: Optional[list] = None
    config: Optional[dict] = None
    slaConfig: Optional[dict] = None


class ClientContractResponse(ResponseBase):
    id: UUID
    lspCompanyId: UUID
    brandCompanyId: UUID
    serviceModel: str
    status: str
    contractStart: Optional[date] = None
    contractEnd: Optional[date] = None
    billingType: Optional[str] = None
    billingRate: Optional[float] = None
    warehouseIds: Optional[list] = None
    modules: Optional[list] = None
    config: Optional[dict] = None
    slaConfig: Optional[dict] = None
    createdAt: datetime
    updatedAt: datetime
