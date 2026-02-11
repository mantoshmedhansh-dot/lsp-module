"""
External Purchase Order API v1 - For 3PL clients' PO management
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    ExternalPurchaseOrder, ExternalPurchaseOrderCreate, ExternalPurchaseOrderUpdate,
    ExternalPurchaseOrderRead,
    ExternalPOItem, ExternalPOItemCreate, ExternalPOItemUpdate, ExternalPOItemRead,
    Location, User, SKU, Vendor,
    UploadBatch, UploadBatchCreate, UploadError, ExternalPOUploadRow, UploadResult,
)

import csv
import io


router = APIRouter(prefix="/external-pos", tags=["External Purchase Orders"])


# ============================================================================
# Helper Functions
# ============================================================================

def generate_external_po_key(session: Session, company_id: UUID) -> str:
    """Generate internal reference key for external PO."""
    count = session.exec(
        select(func.count(ExternalPurchaseOrder.id))
        .where(ExternalPurchaseOrder.company_id == company_id)
    ).one()
    return f"EPO-{count + 1:06d}"


def build_po_response(po: ExternalPurchaseOrder, session: Session) -> ExternalPurchaseOrderRead:
    """Build ExternalPurchaseOrderRead with computed fields (snake_case to camelCase mapping)."""
    # Get location name
    location_name = None
    location = session.exec(
        select(Location).where(Location.id == po.location_id)
    ).first()
    if location:
        location_name = location.name

    return ExternalPurchaseOrderRead(
        id=po.id,
        companyId=po.company_id,
        locationId=po.location_id,
        externalPoNumber=po.external_po_number,
        externalVendorCode=po.external_vendor_code,
        externalVendorName=po.external_vendor_name,
        vendorId=po.vendor_id,
        status=po.status,
        poDate=po.po_date,
        expectedDeliveryDate=po.expected_delivery_date,
        source=po.source,
        remarks=po.remarks,
        totalLines=po.total_lines,
        totalExpectedQty=po.total_expected_qty,
        totalReceivedQty=po.total_received_qty,
        totalAmount=po.total_amount,
        createdAt=po.created_at,
        updatedAt=po.updated_at,
        locationName=location_name,
    )


def build_item_response(item: ExternalPOItem, session: Session) -> ExternalPOItemRead:
    """Build ExternalPOItemRead with SKU info (snake_case to camelCase mapping)."""
    sku_code = None
    sku_name = None

    if item.sku_id:
        sku = session.exec(select(SKU).where(SKU.id == item.sku_id)).first()
        if sku:
            sku_code = sku.code
            sku_name = sku.name

    return ExternalPOItemRead(
        id=item.id,
        externalPoId=item.external_po_id,
        externalSkuCode=item.external_sku_code,
        externalSkuName=item.external_sku_name,
        skuId=item.sku_id,
        orderedQty=item.ordered_qty,
        receivedQty=item.received_qty,
        unitPrice=item.unit_price,
        status=item.status,
        createdAt=item.created_at,
        skuCode=sku_code,
        skuName=sku_name,
    )


# ============================================================================
# External PO List & CRUD
# ============================================================================

@router.get("", response_model=List[ExternalPurchaseOrderRead])
def list_external_pos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List external purchase orders with optional filters."""
    query = select(ExternalPurchaseOrder)

    # Apply company filter
    query = company_filter.apply_filter(query, ExternalPurchaseOrder.company_id)

    # Apply filters
    if status:
        query = query.where(ExternalPurchaseOrder.status == status)
    if location_id:
        query = query.where(ExternalPurchaseOrder.location_id == location_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (ExternalPurchaseOrder.external_po_number.ilike(search_pattern)) |
            (ExternalPurchaseOrder.external_vendor_name.ilike(search_pattern))
        )

    # Pagination and ordering
    query = query.offset(skip).limit(limit).order_by(ExternalPurchaseOrder.created_at.desc())

    pos = session.exec(query).all()
    return [build_po_response(po, session) for po in pos]


@router.get("/count")
def count_external_pos(
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of external purchase orders."""
    query = select(func.count(ExternalPurchaseOrder.id))

    query = company_filter.apply_filter(query, ExternalPurchaseOrder.company_id)
    if status:
        query = query.where(ExternalPurchaseOrder.status == status)
    if location_id:
        query = query.where(ExternalPurchaseOrder.location_id == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.post("", response_model=ExternalPurchaseOrderRead, status_code=status.HTTP_201_CREATED)
def create_external_po(
    po_data: ExternalPurchaseOrderCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new external purchase order."""
    # Validate location
    location = session.exec(
        select(Location).where(Location.id == po_data.locationId)
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Check for duplicate external PO number
    existing = session.exec(
        select(ExternalPurchaseOrder)
        .where(ExternalPurchaseOrder.company_id == company_filter.company_id)
        .where(ExternalPurchaseOrder.external_po_number == po_data.externalPoNumber)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"External PO number {po_data.externalPoNumber} already exists"
        )

    # Create PO (map camelCase input to snake_case DB model)
    po = ExternalPurchaseOrder(
        company_id=company_filter.company_id,
        location_id=po_data.locationId,
        external_po_number=po_data.externalPoNumber,
        external_vendor_code=po_data.externalVendorCode,
        external_vendor_name=po_data.externalVendorName,
        vendor_id=po_data.vendorId,
        po_date=po_data.poDate,
        expected_delivery_date=po_data.expectedDeliveryDate,
        remarks=po_data.remarks,
    )
    session.add(po)
    session.flush()  # Get ID

    # Create items if provided
    if po_data.items:
        for item_data in po_data.items:
            item = ExternalPOItem(
                external_po_id=po.id,
                external_sku_code=item_data.externalSkuCode,
                external_sku_name=item_data.externalSkuName,
                sku_id=item_data.skuId,
                ordered_qty=item_data.orderedQty,
                unit_price=item_data.unitPrice,
            )
            session.add(item)

        # Update totals
        po.total_lines = len(po_data.items)
        po.total_expected_qty = sum(item.orderedQty for item in po_data.items)
        session.add(po)

    session.commit()
    session.refresh(po)

    return build_po_response(po, session)


@router.get("/{po_id}", response_model=ExternalPurchaseOrderRead)
def get_external_po(
    po_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get an external purchase order with its items."""
    query = select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, ExternalPurchaseOrder.company_id)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="External purchase order not found"
        )

    # Build response with items
    response = build_po_response(po, session)
    items = session.exec(
        select(ExternalPOItem)
        .where(ExternalPOItem.external_po_id == po_id)
        .order_by(ExternalPOItem.created_at)
    ).all()
    response.items = [build_item_response(item, session) for item in items]

    return response


@router.patch("/{po_id}", response_model=ExternalPurchaseOrderRead)
def update_external_po(
    po_id: UUID,
    po_data: ExternalPurchaseOrderUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update an external purchase order."""
    query = select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, ExternalPurchaseOrder.company_id)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="External purchase order not found"
        )

    if po.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a CLOSED purchase order"
        )

    # Update fields (map camelCase input to snake_case DB fields)
    camel_to_snake = {
        "externalVendorCode": "external_vendor_code",
        "externalVendorName": "external_vendor_name",
        "vendorId": "vendor_id",
        "status": "status",
        "poDate": "po_date",
        "expectedDeliveryDate": "expected_delivery_date",
        "remarks": "remarks",
    }
    update_dict = po_data.model_dump(exclude_unset=True)
    for camel_field, value in update_dict.items():
        snake_field = camel_to_snake.get(camel_field, camel_field)
        setattr(po, snake_field, value)

    po.updated_at = datetime.utcnow()
    session.add(po)
    session.commit()
    session.refresh(po)

    return build_po_response(po, session)


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_external_po(
    po_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Delete an external purchase order (only if OPEN with no receipts)."""
    query = select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, ExternalPurchaseOrder.company_id)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="External purchase order not found"
        )

    if po.status != "OPEN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete OPEN purchase orders"
        )

    if po.total_received_qty > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete - goods have been received against this PO"
        )

    # Delete items first
    items = session.exec(
        select(ExternalPOItem).where(ExternalPOItem.external_po_id == po_id)
    ).all()
    for item in items:
        session.delete(item)

    session.delete(po)
    session.commit()


# ============================================================================
# External PO Item Endpoints
# ============================================================================

@router.post("/{po_id}/items", response_model=ExternalPOItemRead, status_code=status.HTTP_201_CREATED)
def add_po_item(
    po_id: UUID,
    item_data: ExternalPOItemCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Add an item to an external purchase order."""
    # Verify PO exists and is in OPEN status
    po = session.exec(select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == po_id)).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="External purchase order not found"
        )

    if po.status != "OPEN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only add items to OPEN purchase orders"
        )

    # Create item (map camelCase input to snake_case DB model)
    item = ExternalPOItem(
        external_po_id=po_id,
        external_sku_code=item_data.externalSkuCode,
        external_sku_name=item_data.externalSkuName,
        sku_id=item_data.skuId,
        ordered_qty=item_data.orderedQty,
        unit_price=item_data.unitPrice,
    )
    session.add(item)

    # Update PO totals
    po.total_lines += 1
    po.total_expected_qty += item.ordered_qty
    po.updated_at = datetime.utcnow()
    session.add(po)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


@router.patch("/{po_id}/items/{item_id}", response_model=ExternalPOItemRead)
def update_po_item(
    po_id: UUID,
    item_id: UUID,
    item_data: ExternalPOItemUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update an external purchase order item."""
    # Verify item exists
    item = session.exec(
        select(ExternalPOItem)
        .where(ExternalPOItem.id == item_id)
        .where(ExternalPOItem.external_po_id == po_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Verify PO status
    po = session.exec(select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == po_id)).first()
    if po.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update items in CLOSED purchase orders"
        )

    # Track quantity change for totals
    old_qty = item.ordered_qty

    # Update fields (map camelCase input to snake_case DB fields)
    camel_to_snake = {
        "externalSkuName": "external_sku_name",
        "skuId": "sku_id",
        "orderedQty": "ordered_qty",
        "receivedQty": "received_qty",
        "unitPrice": "unit_price",
        "status": "status",
    }
    update_dict = item_data.model_dump(exclude_unset=True)
    for camel_field, value in update_dict.items():
        snake_field = camel_to_snake.get(camel_field, camel_field)
        setattr(item, snake_field, value)

    item.updated_at = datetime.utcnow()
    session.add(item)

    # Update PO totals if quantity changed
    if "orderedQty" in update_dict:
        po.total_expected_qty += (item.ordered_qty - old_qty)
        po.updated_at = datetime.utcnow()
        session.add(po)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


@router.delete("/{po_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_po_item(
    po_id: UUID,
    item_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Delete an external purchase order item."""
    # Verify item exists
    item = session.exec(
        select(ExternalPOItem)
        .where(ExternalPOItem.id == item_id)
        .where(ExternalPOItem.external_po_id == po_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Verify PO status
    po = session.exec(select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == po_id)).first()
    if po.status != "OPEN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete items from OPEN purchase orders"
        )

    if item.received_qty > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete - goods have been received against this item"
        )

    # Update PO totals
    po.total_lines -= 1
    po.total_expected_qty -= item.ordered_qty
    po.updated_at = datetime.utcnow()
    session.add(po)

    session.delete(item)
    session.commit()


# ============================================================================
# Bulk Upload Endpoint
# ============================================================================

@router.post("/upload", response_model=UploadResult)
async def upload_external_pos(
    file: UploadFile = File(...),
    location_id: UUID = Query(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Bulk upload external purchase orders from CSV.

    CSV Format:
    external_po_number, external_vendor_code, external_vendor_name, po_date,
    expected_delivery_date, external_sku_code, external_sku_name, ordered_qty, unit_price
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
        upload_type="EXTERNAL_PO",
        file_name=file.filename,
        file_size=file_size,
        status="PROCESSING",
        uploaded_by=current_user.id,
    )
    session.add(upload_batch)
    session.flush()

    # Parse CSV
    errors: List[UploadError] = []
    po_items_map = {}  # Group items by PO number

    try:
        decoded = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        rows = list(reader)
        upload_batch.total_rows = len(rows)

        for idx, row in enumerate(rows, start=2):  # Start at 2 (row 1 is header)
            try:
                # Validate required fields
                if not row.get('external_po_number'):
                    errors.append(UploadError(row=idx, field='external_po_number', error='Required'))
                    continue
                if not row.get('external_sku_code'):
                    errors.append(UploadError(row=idx, field='external_sku_code', error='Required'))
                    continue
                if not row.get('ordered_qty'):
                    errors.append(UploadError(row=idx, field='ordered_qty', error='Required'))
                    continue

                po_number = row['external_po_number'].strip()

                # Parse row data
                po_row = ExternalPOUploadRow(
                    external_po_number=po_number,
                    external_vendor_code=row.get('external_vendor_code', '').strip() or None,
                    external_vendor_name=row.get('external_vendor_name', '').strip() or None,
                    po_date=row.get('po_date', '').strip() or None,
                    expected_delivery_date=row.get('expected_delivery_date', '').strip() or None,
                    external_sku_code=row['external_sku_code'].strip(),
                    external_sku_name=row.get('external_sku_name', '').strip() or None,
                    ordered_qty=int(row['ordered_qty']),
                    unit_price=float(row['unit_price']) if row.get('unit_price') else None,
                )

                # Group by PO number
                if po_number not in po_items_map:
                    po_items_map[po_number] = {
                        'vendor_code': po_row.external_vendor_code,
                        'vendor_name': po_row.external_vendor_name,
                        'po_date': po_row.po_date,
                        'expected_delivery_date': po_row.expected_delivery_date,
                        'items': []
                    }

                po_items_map[po_number]['items'].append(po_row)

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

    # Process POs
    created_pos = 0
    created_items = 0

    for po_number, po_data in po_items_map.items():
        # Check if PO already exists
        existing = session.exec(
            select(ExternalPurchaseOrder)
            .where(ExternalPurchaseOrder.company_id == company_filter.company_id)
            .where(ExternalPurchaseOrder.external_po_number == po_number)
        ).first()

        if existing:
            # Add items to existing PO if it's still OPEN
            if existing.status == "OPEN":
                for item_row in po_data['items']:
                    item = ExternalPOItem(
                        external_po_id=existing.id,
                        external_sku_code=item_row.external_sku_code,
                        external_sku_name=item_row.external_sku_name,
                        ordered_qty=item_row.ordered_qty,
                        unit_price=item_row.unit_price,
                    )
                    session.add(item)
                    created_items += 1

                # Update totals
                existing.total_lines += len(po_data['items'])
                existing.total_expected_qty += sum(i.ordered_qty for i in po_data['items'])
                existing.updated_at = datetime.utcnow()
                session.add(existing)
            else:
                errors.append(UploadError(
                    row=0,
                    field='external_po_number',
                    value=po_number,
                    error=f'PO exists but is {existing.status}'
                ))
        else:
            # Create new PO
            from dateutil.parser import parse as parse_date

            po_date = None
            if po_data['po_date']:
                try:
                    po_date = parse_date(po_data['po_date']).date()
                except:
                    pass

            expected_date = None
            if po_data['expected_delivery_date']:
                try:
                    expected_date = parse_date(po_data['expected_delivery_date']).date()
                except:
                    pass

            po = ExternalPurchaseOrder(
                company_id=company_filter.company_id,
                location_id=location_id,
                external_po_number=po_number,
                external_vendor_code=po_data['vendor_code'],
                external_vendor_name=po_data['vendor_name'],
                po_date=po_date,
                expected_delivery_date=expected_date,
                source="UPLOAD",
                upload_batch_id=upload_batch.id,
                total_lines=len(po_data['items']),
                total_expected_qty=sum(i.ordered_qty for i in po_data['items']),
            )
            session.add(po)
            session.flush()
            created_pos += 1

            # Create items
            for item_row in po_data['items']:
                item = ExternalPOItem(
                    external_po_id=po.id,
                    external_sku_code=item_row.external_sku_code,
                    external_sku_name=item_row.external_sku_name,
                    ordered_qty=item_row.ordered_qty,
                    unit_price=item_row.unit_price,
                )
                session.add(item)
                created_items += 1

    # Update batch status
    upload_batch.success_rows = upload_batch.total_rows - len(errors)
    upload_batch.error_rows = len(errors)
    upload_batch.error_log = [e.model_dump() for e in errors]
    upload_batch.status = "COMPLETED" if not errors else "PARTIALLY_COMPLETED" if created_pos > 0 else "FAILED"
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
        created_records=created_pos,
        updated_records=0,
    )
