"""
Upload Batch Models

For tracking bulk upload operations (POs, ASNs, Opening Stock, etc.)
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON


# ============================================================================
# UPLOAD BATCH
# ============================================================================

class UploadBatchBase(SQLModel):
    """Base fields for Upload Batch"""
    upload_type: str = Field(max_length=50)
    # Types: EXTERNAL_PO, ASN, GRN, OPENING_STOCK, STOCK_ADJUSTMENT

    file_name: Optional[str] = Field(default=None, max_length=255)
    file_size: Optional[int] = None
    total_rows: int = Field(default=0)
    success_rows: int = Field(default=0)
    error_rows: int = Field(default=0)

    status: str = Field(default="PENDING", max_length=50)
    # PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED


class UploadBatch(UploadBatchBase, table=True):
    """Upload Batch - tracks bulk upload operations"""
    __tablename__ = "upload_batches"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    batch_no: str = Field(max_length=50, index=True)

    # Error log (array of {row, field, error})
    error_log: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))

    uploaded_by: Optional[UUID] = Field(default=None, foreign_key="users.id")
    processed_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UploadBatchCreate(SQLModel):
    """Create schema"""
    upload_type: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    total_rows: int = 0


class UploadBatchUpdate(SQLModel):
    """Update schema"""
    status: Optional[str] = None
    success_rows: Optional[int] = None
    error_rows: Optional[int] = None
    error_log: Optional[List[Dict[str, Any]]] = None
    processed_at: Optional[datetime] = None


class UploadBatchRead(UploadBatchBase):
    """Read schema"""
    id: UUID
    company_id: UUID
    batch_no: str
    error_log: List[Dict[str, Any]]
    uploaded_by: Optional[UUID] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Computed
    uploaded_by_name: Optional[str] = None


# ============================================================================
# UPLOAD ERROR SCHEMA
# ============================================================================

class UploadError(SQLModel):
    """Schema for individual upload error"""
    row: int
    field: Optional[str] = None
    value: Optional[str] = None
    error: str


# ============================================================================
# UPLOAD ROW SCHEMAS (for parsing CSV)
# ============================================================================

class ExternalPOUploadRow(SQLModel):
    """Row schema for External PO upload"""
    external_po_number: str
    external_vendor_code: Optional[str] = None
    external_vendor_name: Optional[str] = None
    po_date: Optional[str] = None  # Will be parsed
    expected_delivery_date: Optional[str] = None  # Will be parsed
    external_sku_code: str
    external_sku_name: Optional[str] = None
    ordered_qty: int
    unit_price: Optional[float] = None


class ASNUploadRow(SQLModel):
    """Row schema for ASN upload"""
    external_asn_no: Optional[str] = None
    external_po_number: Optional[str] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    expected_arrival: Optional[str] = None  # Will be parsed
    external_sku_code: str
    expected_qty: int
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None  # Will be parsed
    cartons: Optional[int] = None


class OpeningStockUploadRow(SQLModel):
    """Row schema for Opening Stock upload"""
    location_code: str
    sku_code: str
    bin_code: Optional[str] = None
    quantity: int
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    expiry_date: Optional[str] = None
    mfg_date: Optional[str] = None
    cost_price: Optional[float] = None
    mrp: Optional[float] = None


# ============================================================================
# UPLOAD RESULT SCHEMAS
# ============================================================================

class UploadResult(SQLModel):
    """Result of an upload operation"""
    batch_id: UUID
    batch_no: str
    status: str
    total_rows: int
    success_rows: int
    error_rows: int
    errors: List[UploadError] = []
    created_records: int = 0
    updated_records: int = 0
