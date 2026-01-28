"""
Upload Batch API v1 - Track bulk upload operations and process uploads
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func
import io

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import UploadBatch, UploadBatchRead, UploadResult, User
from app.services.bulk_upload import (
    BulkUploadService,
    generate_external_po_template,
    generate_asn_template,
    generate_opening_stock_template,
    generate_sto_template
)


router = APIRouter(prefix="/upload-batches", tags=["Upload Batches"])


# ============================================================================
# Helper Functions
# ============================================================================

def build_batch_response(batch: UploadBatch, session: Session) -> UploadBatchRead:
    """Build UploadBatchRead with computed fields."""
    response = UploadBatchRead.model_validate(batch)

    # Get uploader name
    if batch.uploaded_by:
        user = session.exec(select(User).where(User.id == batch.uploaded_by)).first()
        if user:
            response.uploaded_by_name = f"{user.firstName} {user.lastName}"

    return response


# ============================================================================
# Upload Batch Endpoints
# ============================================================================

@router.get("", response_model=List[UploadBatchRead])
def list_upload_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    upload_type: Optional[str] = None,
    status: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List upload batches with optional filters."""
    query = select(UploadBatch)

    # Apply company filter
    if company_filter.company_id:
        query = query.where(UploadBatch.company_id == company_filter.company_id)

    # Apply filters
    if upload_type:
        query = query.where(UploadBatch.upload_type == upload_type)
    if status:
        query = query.where(UploadBatch.status == status)

    # Pagination and ordering
    query = query.offset(skip).limit(limit).order_by(UploadBatch.created_at.desc())

    batches = session.exec(query).all()
    return [build_batch_response(batch, session) for batch in batches]


@router.get("/count")
def count_upload_batches(
    upload_type: Optional[str] = None,
    status: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of upload batches."""
    query = select(func.count(UploadBatch.id))

    if company_filter.company_id:
        query = query.where(UploadBatch.company_id == company_filter.company_id)
    if upload_type:
        query = query.where(UploadBatch.upload_type == upload_type)
    if status:
        query = query.where(UploadBatch.status == status)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/summary")
def get_upload_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get summary of upload batches by type and status."""
    query = select(UploadBatch)

    if company_filter.company_id:
        query = query.where(UploadBatch.company_id == company_filter.company_id)

    batches = session.exec(query).all()

    # Group by type
    by_type = {}
    by_status = {}

    for batch in batches:
        # By type
        if batch.upload_type not in by_type:
            by_type[batch.upload_type] = {
                "count": 0,
                "total_rows": 0,
                "success_rows": 0,
                "error_rows": 0,
            }
        by_type[batch.upload_type]["count"] += 1
        by_type[batch.upload_type]["total_rows"] += batch.total_rows
        by_type[batch.upload_type]["success_rows"] += batch.success_rows
        by_type[batch.upload_type]["error_rows"] += batch.error_rows

        # By status
        if batch.status not in by_status:
            by_status[batch.status] = 0
        by_status[batch.status] += 1

    return {
        "by_type": by_type,
        "by_status": by_status,
        "total_batches": len(batches),
    }


@router.get("/{batch_id}", response_model=UploadBatchRead)
def get_upload_batch(
    batch_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get an upload batch with its error log."""
    query = select(UploadBatch).where(UploadBatch.id == batch_id)

    if company_filter.company_id:
        query = query.where(UploadBatch.company_id == company_filter.company_id)

    batch = session.exec(query).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload batch not found"
        )

    return build_batch_response(batch, session)


@router.get("/{batch_id}/errors")
def get_batch_errors(
    batch_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get paginated errors for an upload batch."""
    query = select(UploadBatch).where(UploadBatch.id == batch_id)

    if company_filter.company_id:
        query = query.where(UploadBatch.company_id == company_filter.company_id)

    batch = session.exec(query).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload batch not found"
        )

    errors = batch.error_log or []
    total = len(errors)
    paginated = errors[skip:skip + limit]

    return {
        "batch_id": str(batch_id),
        "batch_no": batch.batch_no,
        "total_errors": total,
        "errors": paginated,
    }


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload_batch(
    batch_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete an upload batch (metadata only, doesn't affect created records)."""
    query = select(UploadBatch).where(UploadBatch.id == batch_id)

    if company_filter.company_id:
        query = query.where(UploadBatch.company_id == company_filter.company_id)

    batch = session.exec(query).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload batch not found"
        )

    session.delete(batch)
    session.commit()


# ============================================================================
# Upload Processing Endpoints
# ============================================================================

@router.post("/process/external-po", response_model=UploadResult)
async def upload_external_po(
    file: UploadFile = File(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """
    Upload and process External Purchase Orders CSV.

    CSV columns: external_po_number, external_vendor_code, external_vendor_name,
    po_date, expected_delivery_date, external_sku_code, external_sku_name,
    ordered_qty, unit_price
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    if not file.filename.endswith(('.csv', '.CSV')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    csv_content = content.decode('utf-8-sig')  # Handle BOM

    service = BulkUploadService(session, company_filter.company_id, current_user.id)
    result = service.process_external_po_upload(csv_content, file.filename)

    return result


@router.post("/process/asn", response_model=UploadResult)
async def upload_asn(
    file: UploadFile = File(...),
    location_id: UUID = Form(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """
    Upload and process Advance Shipping Notices CSV.

    CSV columns: external_asn_no, external_po_number, carrier, tracking_number,
    expected_arrival, external_sku_code, expected_qty, batch_no, expiry_date, cartons
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    if not file.filename.endswith(('.csv', '.CSV')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    csv_content = content.decode('utf-8-sig')

    service = BulkUploadService(session, company_filter.company_id, current_user.id)
    result = service.process_asn_upload(csv_content, file.filename, location_id)

    return result


@router.post("/process/opening-stock", response_model=UploadResult)
async def upload_opening_stock(
    file: UploadFile = File(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """
    Upload and process Opening Stock CSV.

    CSV columns: location_code, sku_code, bin_code, quantity, batch_no,
    lot_no, expiry_date, mfg_date, cost_price, mrp
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    if not file.filename.endswith(('.csv', '.CSV')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    csv_content = content.decode('utf-8-sig')

    service = BulkUploadService(session, company_filter.company_id, current_user.id)
    result = service.process_opening_stock_upload(csv_content, file.filename)

    return result


@router.post("/process/stock-transfer", response_model=UploadResult)
async def upload_stock_transfer(
    file: UploadFile = File(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """
    Upload and process Stock Transfer Orders CSV.

    CSV columns: sto_number, source_location_code, destination_location_code,
    required_by_date, priority, sku_code, quantity, batch_no, lot_no
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    if not file.filename.endswith(('.csv', '.CSV')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    csv_content = content.decode('utf-8-sig')

    service = BulkUploadService(session, company_filter.company_id, current_user.id)
    result = service.process_sto_upload(csv_content, file.filename)

    return result


# ============================================================================
# Template Download Endpoints
# ============================================================================

@router.get("/templates/external-po")
def download_external_po_template():
    """Download CSV template for External PO upload."""
    content = generate_external_po_template()
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=external_po_template.csv"}
    )


@router.get("/templates/asn")
def download_asn_template():
    """Download CSV template for ASN upload."""
    content = generate_asn_template()
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=asn_template.csv"}
    )


@router.get("/templates/opening-stock")
def download_opening_stock_template():
    """Download CSV template for Opening Stock upload."""
    content = generate_opening_stock_template()
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=opening_stock_template.csv"}
    )


@router.get("/templates/stock-transfer")
def download_sto_template():
    """Download CSV template for Stock Transfer upload."""
    content = generate_sto_template()
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock_transfer_template.csv"}
    )
