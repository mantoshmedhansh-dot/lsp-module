"""
Upload Batch Models

For tracking bulk upload operations (POs, ASNs, Opening Stock, etc.)

NAMING CONVENTION:
- Table models use snake_case (matches database columns)
- Read/Response schemas use camelCase (matches frontend expectations)
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
    """Base fields for Upload Batch (snake_case for DB mapping)"""
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
    """Create schema (camelCase for API input)"""
    uploadType: str
    fileName: Optional[str] = None
    fileSize: Optional[int] = None
    totalRows: int = 0


class UploadBatchUpdate(SQLModel):
    """Update schema (camelCase for API input)"""
    status: Optional[str] = None
    successRows: Optional[int] = None
    errorRows: Optional[int] = None
    errorLog: Optional[List[Dict[str, Any]]] = None
    processedAt: Optional[datetime] = None


class UploadBatchRead(SQLModel):
    """Read schema (camelCase for API output)"""
    id: UUID
    companyId: UUID
    batchNo: str
    uploadType: str
    fileName: Optional[str] = None
    fileSize: Optional[int] = None
    totalRows: int
    successRows: int
    errorRows: int
    status: str
    errorLog: List[Dict[str, Any]]
    uploadedBy: Optional[UUID] = None
    processedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    # Computed
    uploadedByName: Optional[str] = None


# ============================================================================
# UPLOAD ERROR SCHEMA
# ============================================================================

class UploadError(SQLModel):
    """Schema for individual upload error (camelCase for API)"""
    row: int
    field: Optional[str] = None
    value: Optional[str] = None
    error: str


# ============================================================================
# UPLOAD ROW SCHEMAS (for parsing CSV - camelCase for API input)
# ============================================================================

class ExternalPOUploadRow(SQLModel):
    """Row schema for External PO upload"""
    externalPoNumber: str
    externalVendorCode: Optional[str] = None
    externalVendorName: Optional[str] = None
    poDate: Optional[str] = None  # Will be parsed
    expectedDeliveryDate: Optional[str] = None  # Will be parsed
    externalSkuCode: str
    externalSkuName: Optional[str] = None
    orderedQty: int
    unitPrice: Optional[float] = None


class ASNUploadRow(SQLModel):
    """Row schema for ASN upload"""
    externalAsnNo: Optional[str] = None
    externalPoNumber: Optional[str] = None
    carrier: Optional[str] = None
    trackingNumber: Optional[str] = None
    expectedArrival: Optional[str] = None  # Will be parsed
    externalSkuCode: str
    expectedQty: int
    batchNo: Optional[str] = None
    expiryDate: Optional[str] = None  # Will be parsed
    cartons: Optional[int] = None


class OpeningStockUploadRow(SQLModel):
    """Row schema for Opening Stock upload"""
    locationCode: str
    skuCode: str
    binCode: Optional[str] = None
    quantity: int
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    expiryDate: Optional[str] = None
    mfgDate: Optional[str] = None
    costPrice: Optional[float] = None
    mrp: Optional[float] = None


class STOUploadRow(SQLModel):
    """Row schema for Stock Transfer Order upload"""
    sourceLocationCode: str
    destinationLocationCode: str
    skuCode: str
    requestedQty: int
    batchNo: Optional[str] = None
    lotNo: Optional[str] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None


# ============================================================================
# UPLOAD RESULT SCHEMAS
# ============================================================================

class UploadResult(SQLModel):
    """Result of an upload operation (camelCase for API output)"""
    batchId: UUID
    batchNo: str
    status: str
    totalRows: int
    successRows: int
    errorRows: int
    errors: List[UploadError] = []
    createdRecords: int = 0
    updatedRecords: int = 0
