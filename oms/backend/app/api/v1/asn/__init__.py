"""
Advance Shipping Notice (ASN) API v1 - Pre-arrival shipment notifications
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    AdvanceShippingNotice, AdvanceShippingNoticeCreate, AdvanceShippingNoticeUpdate,
    AdvanceShippingNoticeRead,
    ASNItem, ASNItemCreate, ASNItemUpdate, ASNItemRead,
    ExternalPurchaseOrder, ExternalPOItem,
    Location, User, SKU, Vendor,
    UploadBatch, UploadError, ASNUploadRow, UploadResult,
)

import csv
import io


router = APIRouter(prefix="/asns", tags=["Advance Shipping Notices"])


# ============================================================================
# Helper Functions
# ============================================================================

def generate_asn_number(session: Session, company_id: UUID) -> str:
    """Generate next ASN number."""
    count = session.exec(
        select(func.count(AdvanceShippingNotice.id))
        .where(AdvanceShippingNotice.company_id == company_id)
    ).one()
    return f"ASN-{count + 1:06d}"


def build_asn_response(asn: AdvanceShippingNotice, session: Session) -> AdvanceShippingNoticeRead:
    """Build AdvanceShippingNoticeRead with computed fields."""
    response = AdvanceShippingNoticeRead.model_validate(asn)

    # Get location name
    location = session.exec(
        select(Location).where(Location.id == asn.location_id)
    ).first()
    if location:
        response.location_name = location.name

    # Get external PO number if linked
    if asn.external_po_id:
        ext_po = session.exec(
            select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == asn.external_po_id)
        ).first()
        if ext_po:
            response.external_po_number = ext_po.external_po_number

    return response


def build_item_response(item: ASNItem, session: Session) -> ASNItemRead:
    """Build ASNItemRead with SKU info."""
    response = ASNItemRead.model_validate(item)

    if item.sku_id:
        sku = session.exec(select(SKU).where(SKU.id == item.sku_id)).first()
        if sku:
            response.sku_code = sku.code
            response.sku_name = sku.name

    return response


# ============================================================================
# ASN List & CRUD
# ============================================================================

@router.get("", response_model=List[AdvanceShippingNoticeRead])
def list_asns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    external_po_id: Optional[UUID] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List advance shipping notices with optional filters."""
    query = select(AdvanceShippingNotice)

    # Apply company filter
    if company_filter.company_id:
        query = query.where(AdvanceShippingNotice.company_id == company_filter.company_id)

    # Apply filters
    if status:
        query = query.where(AdvanceShippingNotice.status == status)
    if location_id:
        query = query.where(AdvanceShippingNotice.location_id == location_id)
    if external_po_id:
        query = query.where(AdvanceShippingNotice.external_po_id == external_po_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (AdvanceShippingNotice.asn_no.ilike(search_pattern)) |
            (AdvanceShippingNotice.external_asn_no.ilike(search_pattern)) |
            (AdvanceShippingNotice.tracking_number.ilike(search_pattern))
        )

    # Pagination and ordering
    query = query.offset(skip).limit(limit).order_by(AdvanceShippingNotice.created_at.desc())

    asns = session.exec(query).all()
    return [build_asn_response(asn, session) for asn in asns]


@router.get("/count")
def count_asns(
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of advance shipping notices."""
    query = select(func.count(AdvanceShippingNotice.id))

    if company_filter.company_id:
        query = query.where(AdvanceShippingNotice.company_id == company_filter.company_id)
    if status:
        query = query.where(AdvanceShippingNotice.status == status)
    if location_id:
        query = query.where(AdvanceShippingNotice.location_id == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/pending")
def get_pending_asns(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get ASNs pending receipt (status in EXPECTED, IN_TRANSIT, ARRIVED)."""
    query = select(AdvanceShippingNotice).where(
        AdvanceShippingNotice.status.in_(["EXPECTED", "IN_TRANSIT", "ARRIVED"])
    )

    if company_filter.company_id:
        query = query.where(AdvanceShippingNotice.company_id == company_filter.company_id)
    if location_id:
        query = query.where(AdvanceShippingNotice.location_id == location_id)

    query = query.order_by(AdvanceShippingNotice.expected_arrival)

    asns = session.exec(query).all()
    return [build_asn_response(asn, session) for asn in asns]


@router.post("", response_model=AdvanceShippingNoticeRead, status_code=status.HTTP_201_CREATED)
def create_asn(
    asn_data: AdvanceShippingNoticeCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new advance shipping notice."""
    # Validate location
    location = session.exec(
        select(Location).where(Location.id == asn_data.location_id)
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Validate external PO if provided
    if asn_data.external_po_id:
        ext_po = session.exec(
            select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == asn_data.external_po_id)
        ).first()
        if not ext_po:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="External purchase order not found"
            )

    # Generate ASN number
    asn_no = generate_asn_number(session, company_filter.company_id)

    # Create ASN
    asn_dict = asn_data.model_dump(exclude={"items"})
    asn_dict["company_id"] = company_filter.company_id
    asn_dict["asn_no"] = asn_no

    asn = AdvanceShippingNotice(**asn_dict)
    session.add(asn)
    session.flush()  # Get ID

    # Create items if provided
    if asn_data.items:
        for item_data in asn_data.items:
            item_dict = item_data.model_dump()
            item_dict["asn_id"] = asn.id
            item = ASNItem(**item_dict)
            session.add(item)

        # Update totals
        asn.total_lines = len(asn_data.items)
        asn.total_expected_qty = sum(item.expected_qty for item in asn_data.items)
        session.add(asn)

    session.commit()
    session.refresh(asn)

    return build_asn_response(asn, session)


@router.get("/{asn_id}", response_model=AdvanceShippingNoticeRead)
def get_asn(
    asn_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get an advance shipping notice with its items."""
    query = select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)

    if company_filter.company_id:
        query = query.where(AdvanceShippingNotice.company_id == company_filter.company_id)

    asn = session.exec(query).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Advance shipping notice not found"
        )

    # Build response with items
    response = build_asn_response(asn, session)
    items = session.exec(
        select(ASNItem)
        .where(ASNItem.asn_id == asn_id)
        .order_by(ASNItem.created_at)
    ).all()
    response.items = [build_item_response(item, session) for item in items]

    return response


@router.patch("/{asn_id}", response_model=AdvanceShippingNoticeRead)
def update_asn(
    asn_id: UUID,
    asn_data: AdvanceShippingNoticeUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update an advance shipping notice."""
    query = select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)

    if company_filter.company_id:
        query = query.where(AdvanceShippingNotice.company_id == company_filter.company_id)

    asn = session.exec(query).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Advance shipping notice not found"
        )

    if asn.status == "RECEIVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a RECEIVED ASN"
        )

    # Update fields
    update_dict = asn_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(asn, field, value)

    asn.updated_at = datetime.utcnow()
    session.add(asn)
    session.commit()
    session.refresh(asn)

    return build_asn_response(asn, session)


@router.delete("/{asn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asn(
    asn_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Delete an ASN (only if EXPECTED with no receipts)."""
    query = select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)

    if company_filter.company_id:
        query = query.where(AdvanceShippingNotice.company_id == company_filter.company_id)

    asn = session.exec(query).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Advance shipping notice not found"
        )

    if asn.status != "EXPECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete EXPECTED ASNs"
        )

    if asn.total_received_qty > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete - goods have been received against this ASN"
        )

    # Delete items first
    items = session.exec(
        select(ASNItem).where(ASNItem.asn_id == asn_id)
    ).all()
    for item in items:
        session.delete(item)

    session.delete(asn)
    session.commit()


# ============================================================================
# ASN Status Updates
# ============================================================================

@router.post("/{asn_id}/mark-in-transit", response_model=AdvanceShippingNoticeRead)
def mark_in_transit(
    asn_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark ASN as in transit."""
    asn = session.exec(
        select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)
    ).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )

    if asn.status != "EXPECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only mark EXPECTED ASNs as in transit"
        )

    asn.status = "IN_TRANSIT"
    asn.updated_at = datetime.utcnow()
    session.add(asn)
    session.commit()
    session.refresh(asn)

    return build_asn_response(asn, session)


@router.post("/{asn_id}/mark-arrived", response_model=AdvanceShippingNoticeRead)
def mark_arrived(
    asn_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark ASN as arrived at warehouse."""
    asn = session.exec(
        select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)
    ).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )

    if asn.status not in ["EXPECTED", "IN_TRANSIT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only mark EXPECTED or IN_TRANSIT ASNs as arrived"
        )

    asn.status = "ARRIVED"
    asn.actual_arrival = datetime.utcnow()
    asn.updated_at = datetime.utcnow()
    session.add(asn)
    session.commit()
    session.refresh(asn)

    return build_asn_response(asn, session)


@router.post("/{asn_id}/cancel", response_model=AdvanceShippingNoticeRead)
def cancel_asn(
    asn_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Cancel an ASN."""
    asn = session.exec(
        select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)
    ).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )

    if asn.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a {asn.status} ASN"
        )

    if asn.total_received_qty > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel - goods have been received"
        )

    asn.status = "CANCELLED"
    asn.updated_at = datetime.utcnow()
    session.add(asn)
    session.commit()
    session.refresh(asn)

    return build_asn_response(asn, session)


# ============================================================================
# ASN Item Endpoints
# ============================================================================

@router.post("/{asn_id}/items", response_model=ASNItemRead, status_code=status.HTTP_201_CREATED)
def add_asn_item(
    asn_id: UUID,
    item_data: ASNItemCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Add an item to an ASN."""
    # Verify ASN exists
    asn = session.exec(select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)).first()
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )

    if asn.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add items to a {asn.status} ASN"
        )

    # Create item
    item_dict = item_data.model_dump()
    item_dict["asn_id"] = asn_id

    item = ASNItem(**item_dict)
    session.add(item)

    # Update ASN totals
    asn.total_lines += 1
    asn.total_expected_qty += item.expected_qty
    asn.updated_at = datetime.utcnow()
    session.add(asn)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


@router.patch("/{asn_id}/items/{item_id}", response_model=ASNItemRead)
def update_asn_item(
    asn_id: UUID,
    item_id: UUID,
    item_data: ASNItemUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update an ASN item."""
    # Verify item exists
    item = session.exec(
        select(ASNItem)
        .where(ASNItem.id == item_id)
        .where(ASNItem.asn_id == asn_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Verify ASN status
    asn = session.exec(select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)).first()
    if asn.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update items in a {asn.status} ASN"
        )

    # Track quantity change for totals
    old_qty = item.expected_qty

    # Update fields
    update_dict = item_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(item, field, value)

    item.updated_at = datetime.utcnow()
    session.add(item)

    # Update ASN totals if quantity changed
    if "expected_qty" in update_dict:
        asn.total_expected_qty += (item.expected_qty - old_qty)
        asn.updated_at = datetime.utcnow()
        session.add(asn)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


# ============================================================================
# Bulk Upload Endpoint
# ============================================================================

@router.post("/upload", response_model=UploadResult)
async def upload_asns(
    file: UploadFile = File(...),
    location_id: UUID = Query(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Bulk upload ASNs from CSV.

    CSV Format:
    external_asn_no, external_po_number, carrier, tracking_number, expected_arrival,
    external_sku_code, expected_qty, batch_no, expiry_date, cartons
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )

    # Validate location
    location = session.exec(select(Location).where(Location.id == location_id)).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Create upload batch
    batch_count = session.exec(
        select(func.count(UploadBatch.id))
        .where(UploadBatch.company_id == company_filter.company_id)
    ).one()
    batch_no = f"BATCH-{batch_count + 1:06d}"

    upload_batch = UploadBatch(
        company_id=company_filter.company_id,
        batch_no=batch_no,
        upload_type="ASN",
        file_name=file.filename,
        file_size=file_size,
        status="PROCESSING",
        uploaded_by=current_user.id,
    )
    session.add(upload_batch)
    session.flush()

    # Parse CSV
    errors: List[UploadError] = []
    asn_items_map = {}  # Group items by ASN number

    try:
        decoded = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        rows = list(reader)
        upload_batch.total_rows = len(rows)

        for idx, row in enumerate(rows, start=2):
            try:
                # Validate required fields
                if not row.get('external_sku_code'):
                    errors.append(UploadError(row=idx, field='external_sku_code', error='Required'))
                    continue
                if not row.get('expected_qty'):
                    errors.append(UploadError(row=idx, field='expected_qty', error='Required'))
                    continue

                asn_no = row.get('external_asn_no', '').strip() or f"ASN-UPLOAD-{idx}"

                # Parse row data
                asn_row = ASNUploadRow(
                    external_asn_no=row.get('external_asn_no', '').strip() or None,
                    external_po_number=row.get('external_po_number', '').strip() or None,
                    carrier=row.get('carrier', '').strip() or None,
                    tracking_number=row.get('tracking_number', '').strip() or None,
                    expected_arrival=row.get('expected_arrival', '').strip() or None,
                    external_sku_code=row['external_sku_code'].strip(),
                    expected_qty=int(row['expected_qty']),
                    batch_no=row.get('batch_no', '').strip() or None,
                    expiry_date=row.get('expiry_date', '').strip() or None,
                    cartons=int(row['cartons']) if row.get('cartons') else None,
                )

                # Group by ASN number
                if asn_no not in asn_items_map:
                    asn_items_map[asn_no] = {
                        'external_asn_no': asn_row.external_asn_no,
                        'external_po_number': asn_row.external_po_number,
                        'carrier': asn_row.carrier,
                        'tracking_number': asn_row.tracking_number,
                        'expected_arrival': asn_row.expected_arrival,
                        'items': []
                    }

                asn_items_map[asn_no]['items'].append(asn_row)

            except ValueError as e:
                errors.append(UploadError(row=idx, error=str(e)))
            except Exception as e:
                errors.append(UploadError(row=idx, error=f"Parse error: {str(e)}"))

    except Exception as e:
        upload_batch.status = "FAILED"
        upload_batch.error_log = [{"error": f"CSV parse error: {str(e)}"}]
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}"
        )

    # Process ASNs
    created_asns = 0
    created_items = 0

    for asn_key, asn_data in asn_items_map.items():
        # Look up external PO if provided
        external_po_id = None
        if asn_data['external_po_number']:
            ext_po = session.exec(
                select(ExternalPurchaseOrder)
                .where(ExternalPurchaseOrder.company_id == company_filter.company_id)
                .where(ExternalPurchaseOrder.external_po_number == asn_data['external_po_number'])
            ).first()
            if ext_po:
                external_po_id = ext_po.id

        # Parse dates
        from dateutil.parser import parse as parse_date

        expected_arrival = None
        if asn_data['expected_arrival']:
            try:
                expected_arrival = parse_date(asn_data['expected_arrival']).date()
            except:
                pass

        # Create ASN
        internal_asn_no = generate_asn_number(session, company_filter.company_id)

        asn = AdvanceShippingNotice(
            company_id=company_filter.company_id,
            location_id=location_id,
            asn_no=internal_asn_no,
            external_asn_no=asn_data['external_asn_no'],
            external_po_id=external_po_id,
            carrier=asn_data['carrier'],
            tracking_number=asn_data['tracking_number'],
            expected_arrival=expected_arrival,
            source="UPLOAD",
            upload_batch_id=upload_batch.id,
            total_lines=len(asn_data['items']),
            total_expected_qty=sum(i.expected_qty for i in asn_data['items']),
        )
        session.add(asn)
        session.flush()
        created_asns += 1

        # Create items
        for item_row in asn_data['items']:
            expiry_date = None
            if item_row.expiry_date:
                try:
                    expiry_date = parse_date(item_row.expiry_date).date()
                except:
                    pass

            item = ASNItem(
                asn_id=asn.id,
                external_sku_code=item_row.external_sku_code,
                expected_qty=item_row.expected_qty,
                batch_no=item_row.batch_no,
                expiry_date=expiry_date,
                cartons=item_row.cartons,
            )
            session.add(item)
            created_items += 1

    # Update batch status
    upload_batch.success_rows = upload_batch.total_rows - len(errors)
    upload_batch.error_rows = len(errors)
    upload_batch.error_log = [e.model_dump() for e in errors]
    upload_batch.status = "COMPLETED" if not errors else "PARTIALLY_COMPLETED" if created_asns > 0 else "FAILED"
    upload_batch.processed_at = datetime.utcnow()
    session.add(upload_batch)

    session.commit()

    return UploadResult(
        batch_id=upload_batch.id,
        batch_no=upload_batch.batch_no,
        status=upload_batch.status,
        total_rows=upload_batch.total_rows,
        success_rows=upload_batch.success_rows,
        error_rows=upload_batch.error_rows,
        errors=errors,
        created_records=created_asns,
        updated_records=0,
    )
