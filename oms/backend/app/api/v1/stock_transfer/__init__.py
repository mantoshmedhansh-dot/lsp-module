"""
Stock Transfer Order (STO) API v1 - Inter-location stock transfers
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    StockTransferOrder, StockTransferOrderCreate, StockTransferOrderUpdate,
    StockTransferOrderRead,
    STOItem, STOItemCreate, STOItemUpdate, STOItemRead,
    STOApproveRequest, STOShipRequest, STOReceiveRequest,
    Location, User, SKU, Bin, Inventory,
    GoodsReceipt, GoodsReceiptItem, GoodsReceiptStatus,
)


router = APIRouter(prefix="/stock-transfers", tags=["Stock Transfers"])


# ============================================================================
# Helper Functions
# ============================================================================

def generate_sto_number(session: Session, company_id: UUID) -> str:
    """Generate next STO number."""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"STO{date_part}"

    count = session.exec(
        select(func.count(StockTransferOrder.id))
        .where(StockTransferOrder.company_id == company_id)
        .where(StockTransferOrder.sto_no.like(f"{prefix}%"))
    ).one()

    return f"{prefix}{count + 1:04d}"


def build_sto_response(sto: StockTransferOrder, session: Session) -> StockTransferOrderRead:
    """Build StockTransferOrderRead with computed fields."""
    response = StockTransferOrderRead.model_validate(sto)

    # Get location names
    source_loc = session.exec(
        select(Location).where(Location.id == sto.source_location_id)
    ).first()
    if source_loc:
        response.source_location_name = source_loc.name

    dest_loc = session.exec(
        select(Location).where(Location.id == sto.destination_location_id)
    ).first()
    if dest_loc:
        response.destination_location_name = dest_loc.name

    # Get user names
    if sto.requested_by:
        user = session.exec(select(User).where(User.id == sto.requested_by)).first()
        if user:
            response.requested_by_name = f"{user.firstName} {user.lastName}"

    if sto.approved_by:
        user = session.exec(select(User).where(User.id == sto.approved_by)).first()
        if user:
            response.approved_by_name = f"{user.firstName} {user.lastName}"

    # Calculate pending qty
    response.pending_qty = sto.total_requested_qty - sto.total_shipped_qty

    return response


def build_item_response(item: STOItem, session: Session) -> STOItemRead:
    """Build STOItemRead with SKU and bin info."""
    response = STOItemRead.model_validate(item)

    # Get SKU info
    sku = session.exec(select(SKU).where(SKU.id == item.sku_id)).first()
    if sku:
        response.sku_code = sku.code
        response.sku_name = sku.name

    # Get bin codes
    if item.source_bin_id:
        bin = session.exec(select(Bin).where(Bin.id == item.source_bin_id)).first()
        if bin:
            response.source_bin_code = bin.code

    if item.destination_bin_id:
        bin = session.exec(select(Bin).where(Bin.id == item.destination_bin_id)).first()
        if bin:
            response.destination_bin_code = bin.code

    # Calculate pending qty
    response.pending_qty = item.requested_qty - item.shipped_qty

    return response


# ============================================================================
# STO List & CRUD
# ============================================================================

@router.get("", response_model=List[StockTransferOrderRead])
def list_stock_transfers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    source_location_id: Optional[UUID] = None,
    destination_location_id: Optional[UUID] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List stock transfer orders with optional filters."""
    query = select(StockTransferOrder)

    # Apply company filter
    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)

    # Apply filters
    if status:
        query = query.where(StockTransferOrder.status == status)
    if source_location_id:
        query = query.where(StockTransferOrder.source_location_id == source_location_id)
    if destination_location_id:
        query = query.where(StockTransferOrder.destination_location_id == destination_location_id)
    if priority:
        query = query.where(StockTransferOrder.priority == priority)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(StockTransferOrder.sto_no.ilike(search_pattern))

    # Pagination and ordering
    query = query.offset(skip).limit(limit).order_by(StockTransferOrder.created_at.desc())

    stos = session.exec(query).all()
    return [build_sto_response(sto, session) for sto in stos]


@router.get("/count")
def count_stock_transfers(
    status: Optional[str] = None,
    source_location_id: Optional[UUID] = None,
    destination_location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of stock transfer orders."""
    query = select(func.count(StockTransferOrder.id))

    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)
    if status:
        query = query.where(StockTransferOrder.status == status)
    if source_location_id:
        query = query.where(StockTransferOrder.source_location_id == source_location_id)
    if destination_location_id:
        query = query.where(StockTransferOrder.destination_location_id == destination_location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/pending")
def get_pending_stos(
    source_location_id: Optional[UUID] = None,
    destination_location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get STOs pending fulfillment."""
    query = select(StockTransferOrder).where(
        StockTransferOrder.status.in_(["DRAFT", "APPROVED", "PICKING", "PICKED"])
    )

    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)
    if source_location_id:
        query = query.where(StockTransferOrder.source_location_id == source_location_id)
    if destination_location_id:
        query = query.where(StockTransferOrder.destination_location_id == destination_location_id)

    # Order by priority and required date
    query = query.order_by(
        StockTransferOrder.priority.desc(),
        StockTransferOrder.required_by_date
    )

    stos = session.exec(query).all()
    return [build_sto_response(sto, session) for sto in stos]


@router.get("/in-transit")
def get_intransit_stos(
    destination_location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get STOs currently in transit."""
    query = select(StockTransferOrder).where(
        StockTransferOrder.status == "IN_TRANSIT"
    )

    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)
    if destination_location_id:
        query = query.where(StockTransferOrder.destination_location_id == destination_location_id)

    query = query.order_by(StockTransferOrder.shipped_date.desc())

    stos = session.exec(query).all()
    return [build_sto_response(sto, session) for sto in stos]


@router.post("", response_model=StockTransferOrderRead, status_code=status.HTTP_201_CREATED)
def create_stock_transfer(
    sto_data: StockTransferOrderCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new stock transfer order."""
    # Validate source location
    source_loc = session.exec(
        select(Location).where(Location.id == sto_data.source_location_id)
    ).first()
    if not source_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source location not found"
        )

    # Validate destination location
    dest_loc = session.exec(
        select(Location).where(Location.id == sto_data.destination_location_id)
    ).first()
    if not dest_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Destination location not found"
        )

    # Source and destination must be different
    if sto_data.source_location_id == sto_data.destination_location_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination locations must be different"
        )

    # Generate STO number
    sto_no = generate_sto_number(session, company_filter.company_id)

    # Create STO
    sto_dict = sto_data.model_dump(exclude={"items"})
    sto_dict["company_id"] = company_filter.company_id
    sto_dict["sto_no"] = sto_no
    sto_dict["requested_by"] = current_user.id

    sto = StockTransferOrder(**sto_dict)
    session.add(sto)
    session.flush()

    # Create items if provided
    if sto_data.items:
        for item_data in sto_data.items:
            # Validate SKU exists
            sku = session.exec(select(SKU).where(SKU.id == item_data.sku_id)).first()
            if not sku:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"SKU {item_data.sku_id} not found"
                )

            item_dict = item_data.model_dump()
            item_dict["stock_transfer_order_id"] = sto.id
            item = STOItem(**item_dict)
            session.add(item)

        # Update totals
        sto.total_items = len(sto_data.items)
        sto.total_requested_qty = sum(item.requested_qty for item in sto_data.items)
        session.add(sto)

    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.get("/{sto_id}", response_model=StockTransferOrderRead)
def get_stock_transfer(
    sto_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a stock transfer order with its items."""
    query = select(StockTransferOrder).where(StockTransferOrder.id == sto_id)

    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)

    sto = session.exec(query).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    # Build response with items
    response = build_sto_response(sto, session)
    items = session.exec(
        select(STOItem)
        .where(STOItem.stock_transfer_order_id == sto_id)
        .order_by(STOItem.created_at)
    ).all()
    response.items = [build_item_response(item, session) for item in items]

    return response


@router.patch("/{sto_id}", response_model=StockTransferOrderRead)
def update_stock_transfer(
    sto_id: UUID,
    sto_data: StockTransferOrderUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a stock transfer order."""
    query = select(StockTransferOrder).where(StockTransferOrder.id == sto_id)

    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)

    sto = session.exec(query).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update a {sto.status} stock transfer"
        )

    # Update fields
    update_dict = sto_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(sto, field, value)

    sto.updated_at = datetime.utcnow()
    session.add(sto)
    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.delete("/{sto_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock_transfer(
    sto_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Delete a stock transfer order (only if DRAFT)."""
    query = select(StockTransferOrder).where(StockTransferOrder.id == sto_id)

    if company_filter.company_id:
        query = query.where(StockTransferOrder.company_id == company_filter.company_id)

    sto = session.exec(query).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete DRAFT stock transfers"
        )

    # Delete items first (cascade should handle this but being explicit)
    items = session.exec(
        select(STOItem).where(STOItem.stock_transfer_order_id == sto_id)
    ).all()
    for item in items:
        session.delete(item)

    session.delete(sto)
    session.commit()


# ============================================================================
# STO Item Endpoints
# ============================================================================

@router.post("/{sto_id}/items", response_model=STOItemRead, status_code=status.HTTP_201_CREATED)
def add_sto_item(
    sto_id: UUID,
    item_data: STOItemCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Add an item to a stock transfer order."""
    # Verify STO exists
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status not in ["DRAFT", "APPROVED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add items to a {sto.status} stock transfer"
        )

    # Validate SKU
    sku = session.exec(select(SKU).where(SKU.id == item_data.sku_id)).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    # Create item
    item_dict = item_data.model_dump()
    item_dict["stock_transfer_order_id"] = sto_id

    item = STOItem(**item_dict)
    session.add(item)

    # Update STO totals
    sto.total_items += 1
    sto.total_requested_qty += item.requested_qty
    sto.updated_at = datetime.utcnow()
    session.add(sto)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


@router.patch("/{sto_id}/items/{item_id}", response_model=STOItemRead)
def update_sto_item(
    sto_id: UUID,
    item_id: UUID,
    item_data: STOItemUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a stock transfer order item."""
    # Verify item exists
    item = session.exec(
        select(STOItem)
        .where(STOItem.id == item_id)
        .where(STOItem.stock_transfer_order_id == sto_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Verify STO status
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if sto.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update items in a {sto.status} stock transfer"
        )

    # Track quantity change for totals
    old_requested_qty = item.requested_qty

    # Update fields
    update_dict = item_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(item, field, value)

    item.updated_at = datetime.utcnow()
    session.add(item)

    # Update STO totals if requested qty changed
    if "requested_qty" in update_dict:
        sto.total_requested_qty += (item.requested_qty - old_requested_qty)
        sto.updated_at = datetime.utcnow()
        session.add(sto)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


# ============================================================================
# STO Workflow Endpoints
# ============================================================================

@router.post("/{sto_id}/approve", response_model=StockTransferOrderRead)
def approve_stock_transfer(
    sto_id: UUID,
    request: STOApproveRequest = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Approve a stock transfer order."""
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only approve DRAFT stock transfers"
        )

    # Check if there are items
    item_count = session.exec(
        select(func.count(STOItem.id)).where(STOItem.stock_transfer_order_id == sto_id)
    ).one()

    if item_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve - no items in stock transfer"
        )

    sto.status = "APPROVED"
    sto.approved_by = current_user.id
    sto.approved_at = datetime.utcnow()
    if request and request.remarks:
        sto.remarks = (sto.remarks or "") + f"\nApproval: {request.remarks}"
    sto.updated_at = datetime.utcnow()
    session.add(sto)
    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.post("/{sto_id}/start-picking", response_model=StockTransferOrderRead)
def start_picking(
    sto_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Start picking for a stock transfer order."""
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only start picking for APPROVED stock transfers"
        )

    sto.status = "PICKING"
    sto.updated_at = datetime.utcnow()
    session.add(sto)
    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.post("/{sto_id}/complete-picking", response_model=StockTransferOrderRead)
def complete_picking(
    sto_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Complete picking for a stock transfer order."""
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status != "PICKING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only complete picking for PICKING stock transfers"
        )

    # Update all items to PICKED status
    items = session.exec(
        select(STOItem).where(STOItem.stock_transfer_order_id == sto_id)
    ).all()

    for item in items:
        item.status = "PICKED"
        item.shipped_qty = item.requested_qty  # Assume full pick for now
        item.updated_at = datetime.utcnow()
        session.add(item)

    sto.status = "PICKED"
    sto.total_shipped_qty = sto.total_requested_qty
    sto.updated_at = datetime.utcnow()
    session.add(sto)
    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.post("/{sto_id}/ship", response_model=StockTransferOrderRead)
def ship_stock_transfer(
    sto_id: UUID,
    request: STOShipRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Mark stock transfer as shipped (in transit)."""
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status != "PICKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only ship PICKED stock transfers"
        )

    # Update shipping details
    if request.carrier:
        sto.carrier = request.carrier
    if request.tracking_number:
        sto.tracking_number = request.tracking_number
    if request.vehicle_number:
        sto.vehicle_number = request.vehicle_number
    if request.driver_name:
        sto.driver_name = request.driver_name
    if request.driver_phone:
        sto.driver_phone = request.driver_phone
    if request.remarks:
        sto.remarks = (sto.remarks or "") + f"\nShipped: {request.remarks}"

    # Update all items to SHIPPED status
    items = session.exec(
        select(STOItem).where(STOItem.stock_transfer_order_id == sto_id)
    ).all()

    for item in items:
        item.status = "SHIPPED"
        item.updated_at = datetime.utcnow()
        session.add(item)

    sto.status = "IN_TRANSIT"
    sto.shipped_date = datetime.utcnow()
    sto.updated_at = datetime.utcnow()
    session.add(sto)
    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.post("/{sto_id}/receive", response_model=StockTransferOrderRead)
def receive_stock_transfer(
    sto_id: UUID,
    request: STOReceiveRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Receive a stock transfer at destination.
    Creates a GRN for the received items.
    """
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status != "IN_TRANSIT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only receive IN_TRANSIT stock transfers"
        )

    # Update each item with received quantities
    total_received = 0
    total_damaged = 0

    for item_receive in request.items:
        item = session.exec(
            select(STOItem)
            .where(STOItem.id == item_receive.item_id)
            .where(STOItem.stock_transfer_order_id == sto_id)
        ).first()

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item {item_receive.item_id} not found"
            )

        item.received_qty = item_receive.received_qty
        item.damaged_qty = item_receive.damaged_qty
        if item_receive.destination_bin_id:
            item.destination_bin_id = item_receive.destination_bin_id
        if item_receive.remarks:
            item.remarks = item_receive.remarks

        # Determine status
        if item.received_qty >= item.shipped_qty:
            item.status = "RECEIVED"
        elif item.received_qty > 0:
            item.status = "PARTIALLY_RECEIVED"

        item.updated_at = datetime.utcnow()
        session.add(item)

        total_received += item_receive.received_qty
        total_damaged += item_receive.damaged_qty

    # Update STO totals and status
    sto.total_received_qty = total_received
    sto.received_date = datetime.utcnow()

    if total_received >= sto.total_shipped_qty:
        sto.status = "RECEIVED"
    else:
        # Partial receipt - stay IN_TRANSIT for remaining
        pass

    if request.vehicle_number:
        sto.vehicle_number = request.vehicle_number
    if request.remarks:
        sto.remarks = (sto.remarks or "") + f"\nReceived: {request.remarks}"

    sto.updated_at = datetime.utcnow()
    session.add(sto)

    # Create GRN at destination
    gr_count = session.exec(select(func.count(GoodsReceipt.id))).one()
    gr_no = f"GR-{gr_count + 1:06d}"

    grn = GoodsReceipt(
        grNo=gr_no,
        status=GoodsReceiptStatus.DRAFT.value,
        movementType="106",  # Stock Transfer Receipt
        locationId=sto.destination_location_id,
        companyId=sto.company_id,
        stockTransferId=sto.id,
        externalReferenceType="STO",
        externalReferenceNo=sto.sto_no,
        inboundSource="TRANSFER_IN",
        vehicleNumber=request.vehicle_number or sto.vehicle_number,
        driverName=sto.driver_name,
        source="STO",
        notes=f"Auto-created from STO {sto.sto_no}",
        totalQty=total_received,
    )
    session.add(grn)
    session.flush()

    # Create GRN items
    for item_receive in request.items:
        sto_item = session.exec(
            select(STOItem).where(STOItem.id == item_receive.item_id)
        ).first()

        if sto_item and item_receive.received_qty > 0:
            grn_item = GoodsReceiptItem(
                goodsReceiptId=grn.id,
                skuId=sto_item.sku_id,
                expectedQty=sto_item.shipped_qty,
                receivedQty=item_receive.received_qty,
                acceptedQty=item_receive.received_qty - item_receive.damaged_qty,
                rejectedQty=item_receive.damaged_qty,
                batchNo=sto_item.batch_no,
                lotNo=sto_item.lot_no,
                targetBinId=item_receive.destination_bin_id,
            )
            session.add(grn_item)

    # Link GRN to STO
    sto.destination_grn_id = grn.id
    session.add(sto)

    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)


@router.post("/{sto_id}/cancel", response_model=StockTransferOrderRead)
def cancel_stock_transfer(
    sto_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Cancel a stock transfer order."""
    sto = session.exec(select(StockTransferOrder).where(StockTransferOrder.id == sto_id)).first()
    if not sto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock transfer order not found"
        )

    if sto.status in ["IN_TRANSIT", "RECEIVED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a {sto.status} stock transfer"
        )

    sto.status = "CANCELLED"
    sto.updated_at = datetime.utcnow()
    session.add(sto)
    session.commit()
    session.refresh(sto)

    return build_sto_response(sto, session)
