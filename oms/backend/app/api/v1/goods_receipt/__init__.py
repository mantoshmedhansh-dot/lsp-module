"""
Goods Receipt API v1 - Goods receipt (MIGO) management endpoints
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_admin, require_manager, CompanyFilter
from app.models import (
    GoodsReceipt, GoodsReceiptCreate, GoodsReceiptUpdate,
    GoodsReceiptResponse, GoodsReceiptBrief, GoodsReceiptWithItems,
    GoodsReceiptItem, GoodsReceiptItemCreate, GoodsReceiptItemUpdate,
    GoodsReceiptItemResponse,
    GoodsReceiptStatus, Location, User, SKU, Inventory, Bin, Zone,
    ChannelInventoryRule, ChannelInventory, ZoneType,
    # Phase 2 imports
    Return, ReturnItem,
)
from app.services.fifo_sequence import FifoSequenceService


router = APIRouter(prefix="/goods-receipts", tags=["Goods Receipts"])


# ============================================================================
# DEBUG: Test endpoints - MUST be defined first to avoid route conflicts
# ============================================================================
@router.get("/debug-location/{location_id}")
def debug_location_zones_bins(
    location_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Debug endpoint to check zones and bins at a location."""
    # Get all zones at this location
    zones = session.exec(
        select(Zone).where(Zone.locationId == location_id)
    ).all()

    zone_data = []
    for z in zones:
        # Get bins for this zone
        bins = session.exec(
            select(Bin).where(Bin.zoneId == z.id)
        ).all()
        zone_data.append({
            "id": str(z.id),
            "code": z.code,
            "name": z.name,
            "type": str(z.type),
            "isActive": z.isActive if hasattr(z, 'isActive') else True,
            "bins": [{"id": str(b.id), "code": b.code, "isActive": b.isActive} for b in bins]
        })

    # Check specifically for saleable zones with active bins
    saleable_bins = session.exec(
        select(Bin)
        .join(Zone)
        .where(Zone.locationId == location_id)
        .where(Zone.type == ZoneType.SALEABLE)
        .where(Bin.isActive == True)
    ).all()

    return {
        "locationId": str(location_id),
        "zones": zone_data,
        "saleableBinsCount": len(saleable_bins),
        "saleableBins": [{"id": str(b.id), "code": b.code} for b in saleable_bins]
    }


@router.post("/test-inv")
def test_inventory_creation_debug(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Simple test endpoint to verify inventory creation works."""
    from uuid import UUID as PyUUID
    try:
        # Try to create a simple inventory record
        test_inv = Inventory(
            skuId=PyUUID("8e3f1bfb-8b52-410d-956c-0bf5f66b5148"),  # SKU-001
            binId=PyUUID("de6d1773-3105-485f-9f42-ade3f360fef0"),  # A-01-01
            locationId=PyUUID("49363e31-c1c5-4cd4-a312-a7177c0bf07c"),  # Mumbai
            companyId=PyUUID("43ab19ee-2f42-44ae-bcf2-792274d15bd8"),  # Demo Company
            quantity=1,
            reservedQty=0,
            fifoSequence=9999  # Test sequence
        )
        session.add(test_inv)
        session.flush()
        session.rollback()  # Don't actually save
        return {"status": "ok", "message": "Inventory creation test passed"}
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()[:500]}


# ============================================================================
# Helper Functions
# ============================================================================

def generate_gr_number(session: Session) -> str:
    """Generate next GR document number."""
    count = session.exec(select(func.count(GoodsReceipt.id))).one()
    return f"GR-{count + 1:06d}"


def build_gr_response(gr: GoodsReceipt, session: Session) -> GoodsReceiptResponse:
    """Build GoodsReceiptResponse with computed fields."""
    response = GoodsReceiptResponse.model_validate(gr)
    item_count = session.exec(
        select(func.count(GoodsReceiptItem.id))
        .where(GoodsReceiptItem.goodsReceiptId == gr.id)
    ).one()
    response.itemCount = item_count
    return response


def build_item_response(item: GoodsReceiptItem, session: Session) -> GoodsReceiptItemResponse:
    """Build GoodsReceiptItemResponse with SKU info."""
    response = GoodsReceiptItemResponse.model_validate(item)
    sku = session.exec(select(SKU).where(SKU.id == item.skuId)).first()
    if sku:
        response.skuCode = sku.code
        response.skuName = sku.name
    return response


# ============================================================================
# Goods Receipt Endpoints
# ============================================================================

@router.get("", response_model=List[GoodsReceiptResponse])
def list_goods_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List goods receipts with optional filters."""
    query = select(GoodsReceipt)

    # Apply company filter
    if company_filter.company_id:
        query = query.where(GoodsReceipt.companyId == company_filter.company_id)

    # Apply filters
    if status:
        query = query.where(GoodsReceipt.status == status)
    if location_id:
        query = query.where(GoodsReceipt.locationId == location_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (GoodsReceipt.grNo.ilike(search_pattern)) |
            (GoodsReceipt.asnNo.ilike(search_pattern))
        )

    # Pagination and ordering
    query = query.offset(skip).limit(limit).order_by(GoodsReceipt.createdAt.desc())

    goods_receipts = session.exec(query).all()
    return [build_gr_response(gr, session) for gr in goods_receipts]


@router.get("/count")
def count_goods_receipts(
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of goods receipts."""
    query = select(func.count(GoodsReceipt.id))

    if company_filter.company_id:
        query = query.where(GoodsReceipt.companyId == company_filter.company_id)
    if status:
        query = query.where(GoodsReceipt.status == status)
    if location_id:
        query = query.where(GoodsReceipt.locationId == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.post("", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_goods_receipt(
    gr_data: GoodsReceiptCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new goods receipt document."""
    # Validate location
    location = session.exec(
        select(Location).where(Location.id == gr_data.locationId)
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Generate GR number
    gr_no = generate_gr_number(session)

    # Create goods receipt
    gr_dict = gr_data.model_dump()
    gr_dict["grNo"] = gr_no
    gr_dict["status"] = GoodsReceiptStatus.DRAFT.value

    goods_receipt = GoodsReceipt(**gr_dict)
    session.add(goods_receipt)
    session.commit()
    session.refresh(goods_receipt)

    return build_gr_response(goods_receipt, session)


@router.get("/{gr_id}", response_model=GoodsReceiptWithItems)
def get_goods_receipt(
    gr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a goods receipt with its items."""
    query = select(GoodsReceipt).where(GoodsReceipt.id == gr_id)

    if company_filter.company_id:
        query = query.where(GoodsReceipt.companyId == company_filter.company_id)

    gr = session.exec(query).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    # Build response with items
    response = GoodsReceiptWithItems.model_validate(gr)
    items = session.exec(
        select(GoodsReceiptItem)
        .where(GoodsReceiptItem.goodsReceiptId == gr_id)
        .order_by(GoodsReceiptItem.createdAt)
    ).all()
    response.items = [build_item_response(item, session) for item in items]
    response.itemCount = len(items)

    return response


@router.patch("/{gr_id}", response_model=GoodsReceiptResponse)
def update_goods_receipt(
    gr_id: UUID,
    gr_data: GoodsReceiptUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a goods receipt (only DRAFT status)."""
    query = select(GoodsReceipt).where(GoodsReceipt.id == gr_id)

    if company_filter.company_id:
        query = query.where(GoodsReceipt.companyId == company_filter.company_id)

    gr = session.exec(query).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status != GoodsReceiptStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update DRAFT goods receipts"
        )

    # Update fields
    update_dict = gr_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(gr, field, value)

    session.add(gr)
    session.commit()
    session.refresh(gr)

    return build_gr_response(gr, session)


# ============================================================================
# Goods Receipt Item Endpoints
# ============================================================================

@router.post("/{gr_id}/items", response_model=GoodsReceiptItemResponse, status_code=status.HTTP_201_CREATED)
def add_gr_item(
    gr_id: UUID,
    item_data: GoodsReceiptItemCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Add an item to a goods receipt."""
    # Verify GR exists and is in DRAFT status
    gr = session.exec(select(GoodsReceipt).where(GoodsReceipt.id == gr_id)).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status not in [GoodsReceiptStatus.DRAFT.value, GoodsReceiptStatus.RECEIVING.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only add items to DRAFT or RECEIVING goods receipts"
        )

    # Verify SKU exists
    sku = session.exec(select(SKU).where(SKU.id == item_data.skuId)).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    # Create item
    item_dict = item_data.model_dump()
    item_dict["goodsReceiptId"] = gr_id

    item = GoodsReceiptItem(**item_dict)
    session.add(item)

    # Update GR totals
    gr.totalQty += item.receivedQty
    if item.costPrice:
        gr.totalValue += item.costPrice * item.receivedQty
    session.add(gr)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


@router.patch("/{gr_id}/items/{item_id}", response_model=GoodsReceiptItemResponse)
def update_gr_item(
    gr_id: UUID,
    item_id: UUID,
    item_data: GoodsReceiptItemUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a goods receipt item."""
    # Verify item exists
    item = session.exec(
        select(GoodsReceiptItem)
        .where(GoodsReceiptItem.id == item_id)
        .where(GoodsReceiptItem.goodsReceiptId == gr_id)
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Verify GR status
    gr = session.exec(select(GoodsReceipt).where(GoodsReceipt.id == gr_id)).first()
    if gr.status not in [GoodsReceiptStatus.DRAFT.value, GoodsReceiptStatus.RECEIVING.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update items in DRAFT or RECEIVING goods receipts"
        )

    # Track quantity change for totals
    old_qty = item.receivedQty
    old_value = (item.costPrice or Decimal("0")) * old_qty

    # Update fields
    update_dict = item_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(item, field, value)

    session.add(item)

    # Update GR totals
    new_value = (item.costPrice or Decimal("0")) * item.receivedQty
    gr.totalQty += (item.receivedQty - old_qty)
    gr.totalValue += (new_value - old_value)
    session.add(gr)

    session.commit()
    session.refresh(item)

    return build_item_response(item, session)


# ============================================================================
# Goods Receipt Workflow Endpoints
# ============================================================================

@router.post("/{gr_id}/receive", response_model=GoodsReceiptResponse)
def start_receiving(
    gr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Start receiving process - changes status from DRAFT to RECEIVING."""
    gr = session.exec(select(GoodsReceipt).where(GoodsReceipt.id == gr_id)).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status != GoodsReceiptStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only start receiving from DRAFT status"
        )

    # Check if there are items
    item_count = session.exec(
        select(func.count(GoodsReceiptItem.id))
        .where(GoodsReceiptItem.goodsReceiptId == gr_id)
    ).one()

    if item_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start receiving - no items added"
        )

    gr.status = GoodsReceiptStatus.RECEIVING.value
    gr.receivedById = current_user.id
    gr.receivedAt = datetime.utcnow()
    session.add(gr)
    session.commit()
    session.refresh(gr)

    return build_gr_response(gr, session)


@router.post("/{gr_id}/post")  # Temporarily removed response_model for debugging
def post_goods_receipt(
    gr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Post the goods receipt - creates inventory records with FIFO sequences.
    This is the final step that actually adds inventory to the system.

    Channel-wise Inventory Allocation:
    - If ChannelInventoryRule exists for SKU + Location, splits inventory by channel
    - Creates ChannelInventory records for each channel allocation
    - Unallocated quantity goes to 'UNALLOCATED' channel pool
    """
    gr = session.exec(select(GoodsReceipt).where(GoodsReceipt.id == gr_id)).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status not in [GoodsReceiptStatus.DRAFT.value, GoodsReceiptStatus.RECEIVING.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only post DRAFT or RECEIVING goods receipts"
        )

    # Get all items
    items = session.exec(
        select(GoodsReceiptItem)
        .where(GoodsReceiptItem.goodsReceiptId == gr_id)
    ).all()

    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot post - no items in goods receipt"
        )

    # Initialize FIFO service
    fifo_service = FifoSequenceService(session)

    # Create inventory records for each accepted item
    for item in items:
        if item.acceptedQty <= 0:
            continue

        # Determine target bin (use first bin in saleable zone if not specified)
        target_bin_id = item.targetBinId
        if not target_bin_id:
            # Find default bin in saleable zone
            # Try with enum first, then string value as fallback
            default_bin = session.exec(
                select(Bin)
                .join(Zone)
                .where(Zone.locationId == gr.locationId)
                .where(Zone.type == ZoneType.SALEABLE)
                .where(Zone.isActive == True)
                .where(Bin.isActive == True)
                .limit(1)
            ).first()

            # Fallback: try with string value in case enum comparison fails
            if not default_bin:
                default_bin = session.exec(
                    select(Bin)
                    .join(Zone)
                    .where(Zone.locationId == gr.locationId)
                    .where(Zone.type == "SALEABLE")
                    .where(Zone.isActive == True)
                    .where(Bin.isActive == True)
                    .limit(1)
                ).first()

            if default_bin:
                target_bin_id = default_bin.id

        if not target_bin_id:
            # Get diagnostic info for better error message
            sku = session.exec(select(SKU).where(SKU.id == item.skuId)).first()
            sku_info = sku.code if sku else str(item.skuId)

            # Check what zones exist at this location
            all_zones = session.exec(
                select(Zone).where(Zone.locationId == gr.locationId)
            ).all()
            zone_info = ", ".join([f"{z.code}({z.type})" for z in all_zones]) if all_zones else "No zones"

            # Check for SALEABLE zones specifically (both active and inactive)
            all_saleable_zones = session.exec(
                select(Zone)
                .where(Zone.locationId == gr.locationId)
                .where(Zone.type == ZoneType.SALEABLE)
            ).all()

            active_saleable_zones = [z for z in all_saleable_zones if z.isActive]

            # Check for bins in active saleable zones
            bins_info = "No SALEABLE zones found"
            if all_saleable_zones:
                inactive_count = len(all_saleable_zones) - len(active_saleable_zones)
                if inactive_count > 0:
                    bins_info = f"{len(all_saleable_zones)} SALEABLE zones ({inactive_count} inactive)"
                else:
                    bins_info = f"{len(all_saleable_zones)} active SALEABLE zones"

                if active_saleable_zones:
                    saleable_zone_ids = [z.id for z in active_saleable_zones]
                    all_bins = session.exec(
                        select(Bin).where(Bin.zoneId.in_(saleable_zone_ids))
                    ).all()
                    active_bins = [b for b in all_bins if b.isActive]
                    inactive_bins = len(all_bins) - len(active_bins)
                    bins_info += f". Bins: {len(active_bins)} active, {inactive_bins} inactive"
                else:
                    bins_info += ". All SALEABLE zones are inactive"

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No bin available for SKU {sku_info}. Location zones: [{zone_info}]. {bins_info}. Please ensure you have an active bin in an active SALEABLE zone."
            )

        # Get next FIFO sequence
        fifo_seq = fifo_service.get_next_sequence(item.skuId, gr.locationId)

        # Create main inventory record (unified warehouse inventory)
        try:
            # Handle serialNumbers - use None if empty to match existing data pattern
            serial_nums = item.serialNumbers if item.serialNumbers else None

            inventory = Inventory(
                skuId=item.skuId,
                binId=target_bin_id,
                locationId=gr.locationId,
                companyId=gr.companyId,  # Required field
                quantity=item.acceptedQty,
                reservedQty=0,
                batchNo=item.batchNo,
                lotNo=item.lotNo,
                expiryDate=item.expiryDate,
                mfgDate=item.mfgDate,
                mrp=item.mrp or Decimal("0"),
                costPrice=item.costPrice or Decimal("0"),
                fifoSequence=fifo_seq
            )
            # Only set serialNumbers if it's not empty
            if serial_nums:
                inventory.serialNumbers = serial_nums

            session.add(inventory)
            session.flush()  # Force immediate insert to catch errors early
        except Exception as e:
            import traceback
            tb_str = traceback.format_exc()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create inventory for SKU {item.skuId}: {type(e).__name__}: {str(e)}. TB: {tb_str[:300]}"
            )

        # Update item with assigned FIFO sequence
        item.fifoSequence = fifo_seq
        session.add(item)

        # ================================================================
        # CHANNEL-WISE INVENTORY ALLOCATION
        # ================================================================
        # Allocate inventory to channels based on rules defined per SKU + Location
        channel_rules = session.exec(
            select(ChannelInventoryRule)
            .where(ChannelInventoryRule.skuId == item.skuId)
            .where(ChannelInventoryRule.locationId == gr.locationId)
            .where(ChannelInventoryRule.isActive == True)
            .order_by(ChannelInventoryRule.priority)
        ).all()

        remaining_qty = item.acceptedQty
        channel_fifo_offset = 0

        if channel_rules:
            # Allocate based on rules (absolute quantities per channel)
            for rule in channel_rules:
                if remaining_qty <= 0:
                    break

                # Allocate up to the rule's allocatedQty or remaining, whichever is less
                qty_for_channel = min(rule.allocatedQty, remaining_qty)

                if qty_for_channel > 0:
                    # Get next FIFO sequence for channel inventory
                    channel_fifo_seq = fifo_seq + channel_fifo_offset
                    channel_fifo_offset += 1

                    try:
                        channel_inv = ChannelInventory(
                            skuId=item.skuId,
                            locationId=gr.locationId,
                            binId=target_bin_id,
                            channel=rule.channel,
                            quantity=qty_for_channel,
                            reservedQty=0,
                            fifoSequence=channel_fifo_seq,
                            grNo=gr.grNo,
                            goodsReceiptId=gr.id,
                            companyId=gr.companyId,
                        )
                        session.add(channel_inv)
                        session.flush()  # Force immediate insert
                    except Exception as e:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to create channel inventory for {rule.channel}: {type(e).__name__}: {str(e)}"
                        )
                    remaining_qty -= qty_for_channel

        # Any remaining quantity goes to UNALLOCATED channel pool
        if remaining_qty > 0:
            channel_fifo_seq = fifo_seq + channel_fifo_offset
            try:
                unallocated_inv = ChannelInventory(
                    skuId=item.skuId,
                    locationId=gr.locationId,
                    binId=target_bin_id,
                    channel="UNALLOCATED",
                    quantity=remaining_qty,
                    reservedQty=0,
                    fifoSequence=channel_fifo_seq,
                    grNo=gr.grNo,
                    goodsReceiptId=gr.id,
                    companyId=gr.companyId,
                )
                session.add(unallocated_inv)
                session.flush()  # Force immediate insert
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create UNALLOCATED channel inventory: {type(e).__name__}: {str(e)}"
                )

    # Update GR status
    gr.status = GoodsReceiptStatus.POSTED.value
    gr.postedById = current_user.id
    gr.postedAt = datetime.utcnow()
    session.add(gr)

    try:
        session.commit()
        session.refresh(gr)
    except Exception as e:
        session.rollback()
        import traceback
        error_details = traceback.format_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post goods receipt: {type(e).__name__}: {str(e)}. Traceback: {error_details[:500]}"
        )

    # For debugging, return a simple dict instead of using response model
    return {"status": "posted", "id": str(gr.id), "grNo": gr.grNo}


@router.post("/{gr_id}/reverse", response_model=GoodsReceiptResponse)
def reverse_goods_receipt(
    gr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin())
):
    """
    Reverse a posted goods receipt - removes inventory.
    Only SUPER_ADMIN or ADMIN can reverse.
    """
    gr = session.exec(select(GoodsReceipt).where(GoodsReceipt.id == gr_id)).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status != GoodsReceiptStatus.POSTED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only reverse POSTED goods receipts"
        )

    # Get all items and check if inventory can be reversed
    items = session.exec(
        select(GoodsReceiptItem)
        .where(GoodsReceiptItem.goodsReceiptId == gr_id)
    ).all()

    # Find and remove/reduce corresponding inventory
    for item in items:
        if item.acceptedQty <= 0:
            continue

        # Find inventory with matching FIFO sequence
        inventory = session.exec(
            select(Inventory)
            .where(Inventory.skuId == item.skuId)
            .where(Inventory.locationId == gr.locationId)
            .where(Inventory.fifoSequence == item.fifoSequence)
        ).first()

        if inventory:
            # Check if inventory can be reversed (not reserved)
            if inventory.reservedQty > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot reverse - inventory for SKU {item.skuId} has reservations"
                )

            # Reduce or delete inventory
            if inventory.quantity <= item.acceptedQty:
                session.delete(inventory)
            else:
                inventory.quantity -= item.acceptedQty
                session.add(inventory)

    # Update GR status
    gr.status = GoodsReceiptStatus.REVERSED.value
    session.add(gr)

    session.commit()
    session.refresh(gr)

    return build_gr_response(gr, session)


@router.post("/{gr_id}/cancel", response_model=GoodsReceiptResponse)
def cancel_goods_receipt(
    gr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Cancel a goods receipt (only DRAFT or RECEIVING status)."""
    gr = session.exec(select(GoodsReceipt).where(GoodsReceipt.id == gr_id)).first()
    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status not in [GoodsReceiptStatus.DRAFT.value, GoodsReceiptStatus.RECEIVING.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only cancel DRAFT or RECEIVING goods receipts"
        )

    gr.status = GoodsReceiptStatus.CANCELLED.value
    session.add(gr)
    session.commit()
    session.refresh(gr)

    return build_gr_response(gr, session)


# ============================================================================
# Phase 2: Create from Source Endpoints
# ============================================================================

@router.post("/from-external-po/{external_po_id}", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_gr_from_external_po(
    external_po_id: UUID,
    vehicle_number: Optional[str] = None,
    driver_name: Optional[str] = None,
    gate_entry_no: Optional[str] = None,
    notes: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Create a Goods Receipt from an External Purchase Order.
    Auto-populates expected items from the external PO.
    """
    from app.models import ExternalPurchaseOrder, ExternalPOItem

    # Fetch external PO
    ext_po = session.exec(
        select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == external_po_id)
    ).first()

    if not ext_po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="External purchase order not found"
        )

    if ext_po.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="External PO is already closed"
        )

    if ext_po.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="External PO is cancelled"
        )

    # Validate location
    location = session.exec(
        select(Location).where(Location.id == ext_po.location_id)
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Generate GR number
    gr_no = generate_gr_number(session)

    # Create goods receipt
    goods_receipt = GoodsReceipt(
        grNo=gr_no,
        status=GoodsReceiptStatus.DRAFT.value,
        movementType="101",  # GR from PO
        locationId=ext_po.location_id,
        companyId=ext_po.company_id,
        externalPoId=external_po_id,
        externalReferenceType="EXTERNAL_PO",
        externalReferenceNo=ext_po.external_po_number,
        inboundSource="PURCHASE",
        vehicleNumber=vehicle_number,
        driverName=driver_name,
        gateEntryNo=gate_entry_no,
        gateEntryTime=datetime.utcnow() if gate_entry_no else None,
        source="EXTERNAL_PO",
        notes=notes,
    )
    session.add(goods_receipt)
    session.flush()

    # Get pending items from external PO
    ext_po_items = session.exec(
        select(ExternalPOItem)
        .where(ExternalPOItem.external_po_id == external_po_id)
        .where(ExternalPOItem.status != "CLOSED")
    ).all()

    total_qty = 0
    for ext_item in ext_po_items:
        pending_qty = ext_item.ordered_qty - ext_item.received_qty
        if pending_qty <= 0:
            continue

        # Try to find matching SKU by external code
        sku = None
        if ext_item.sku_id:
            sku = session.exec(select(SKU).where(SKU.id == ext_item.sku_id)).first()
        else:
            # Try to match by code
            sku = session.exec(
                select(SKU).where(SKU.code == ext_item.external_sku_code)
            ).first()

        if not sku:
            # Skip items without mapped SKU (or could create placeholder)
            continue

        # Create GR item
        gr_item = GoodsReceiptItem(
            goodsReceiptId=goods_receipt.id,
            skuId=sku.id,
            expectedQty=pending_qty,
            receivedQty=0,
            acceptedQty=0,
            rejectedQty=0,
            costPrice=ext_item.unit_price,
        )
        session.add(gr_item)
        total_qty += pending_qty

    goods_receipt.totalQty = total_qty
    session.add(goods_receipt)
    session.commit()
    session.refresh(goods_receipt)

    return build_gr_response(goods_receipt, session)


@router.post("/from-asn/{asn_id}", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_gr_from_asn(
    asn_id: UUID,
    vehicle_number: Optional[str] = None,
    driver_name: Optional[str] = None,
    gate_entry_no: Optional[str] = None,
    notes: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Create a Goods Receipt from an Advance Shipping Notice.
    Auto-populates expected items from the ASN.
    """
    from app.models import AdvanceShippingNotice, ASNItem, ExternalPurchaseOrder

    # Fetch ASN
    asn = session.exec(
        select(AdvanceShippingNotice).where(AdvanceShippingNotice.id == asn_id)
    ).first()

    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Advance shipping notice not found"
        )

    if asn.status == "RECEIVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ASN has already been fully received"
        )

    if asn.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ASN is cancelled"
        )

    # Check if GRN already exists for this ASN
    existing_gr = session.exec(
        select(GoodsReceipt)
        .where(GoodsReceipt.asnId == asn_id)
        .where(GoodsReceipt.status != GoodsReceiptStatus.CANCELLED.value)
    ).first()

    if existing_gr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GRN {existing_gr.grNo} already exists for this ASN"
        )

    # Validate location
    location = session.exec(
        select(Location).where(Location.id == asn.location_id)
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Generate GR number
    gr_no = generate_gr_number(session)

    # Get external PO number if linked
    ext_po_number = None
    if asn.external_po_id:
        ext_po = session.exec(
            select(ExternalPurchaseOrder).where(ExternalPurchaseOrder.id == asn.external_po_id)
        ).first()
        if ext_po:
            ext_po_number = ext_po.external_po_number

    # Create goods receipt
    goods_receipt = GoodsReceipt(
        grNo=gr_no,
        status=GoodsReceiptStatus.DRAFT.value,
        movementType="101",
        locationId=asn.location_id,
        companyId=asn.company_id,
        asnId=asn_id,
        asnNo=asn.asn_no,
        externalPoId=asn.external_po_id,
        purchaseOrderId=asn.purchase_order_id,
        externalReferenceType="ASN",
        externalReferenceNo=asn.external_asn_no or asn.asn_no,
        inboundSource="PURCHASE",
        vehicleNumber=vehicle_number or asn.vehicle_number,
        driverName=driver_name or asn.driver_name,
        gateEntryNo=gate_entry_no,
        gateEntryTime=datetime.utcnow() if gate_entry_no else None,
        source="ASN",
        notes=notes,
    )
    session.add(goods_receipt)
    session.flush()

    # Get items from ASN
    asn_items = session.exec(
        select(ASNItem)
        .where(ASNItem.asn_id == asn_id)
        .where(ASNItem.status != "RECEIVED")
    ).all()

    total_qty = 0
    for asn_item in asn_items:
        pending_qty = asn_item.expected_qty - asn_item.received_qty
        if pending_qty <= 0:
            continue

        # Try to find matching SKU
        sku = None
        if asn_item.sku_id:
            sku = session.exec(select(SKU).where(SKU.id == asn_item.sku_id)).first()
        elif asn_item.external_sku_code:
            sku = session.exec(
                select(SKU).where(SKU.code == asn_item.external_sku_code)
            ).first()

        if not sku:
            continue

        # Create GR item with batch info from ASN
        gr_item = GoodsReceiptItem(
            goodsReceiptId=goods_receipt.id,
            skuId=sku.id,
            expectedQty=pending_qty,
            receivedQty=0,
            acceptedQty=0,
            rejectedQty=0,
            batchNo=asn_item.batch_no,
            lotNo=asn_item.lot_no,
            expiryDate=asn_item.expiry_date,
            mfgDate=asn_item.mfg_date,
        )
        session.add(gr_item)
        total_qty += pending_qty

    goods_receipt.totalQty = total_qty
    session.add(goods_receipt)

    # Update ASN status to RECEIVING
    if asn.status in ["EXPECTED", "IN_TRANSIT", "ARRIVED"]:
        asn.status = "RECEIVING"
        if not asn.actual_arrival:
            asn.actual_arrival = datetime.utcnow()
        asn.goods_receipt_id = goods_receipt.id
        session.add(asn)

    session.commit()
    session.refresh(goods_receipt)

    return build_gr_response(goods_receipt, session)


@router.post("/from-return/{return_id}", response_model=GoodsReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_gr_from_return(
    return_id: UUID,
    location_id: UUID,
    notes: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """
    Create a Goods Receipt from a Return (Sales Return / RTO).
    """
    from app.models import Return, ReturnItem

    # Fetch return
    ret = session.exec(
        select(Return).where(Return.id == return_id)
    ).first()

    if not ret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Return not found"
        )

    # Determine inbound source and movement type based on return type
    inbound_source = "RETURN_SALES"
    movement_type = "104"  # Return from customer

    if hasattr(ret, 'returnType'):
        if ret.returnType == "RTO":
            inbound_source = "RETURN_RTO"
            movement_type = "105"
        elif ret.returnType == "DAMAGE":
            inbound_source = "RETURN_DAMAGE"
            movement_type = "104"

    # Validate location
    location = session.exec(
        select(Location).where(Location.id == location_id)
    ).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Generate GR number
    gr_no = generate_gr_number(session)

    # Create goods receipt
    goods_receipt = GoodsReceipt(
        grNo=gr_no,
        status=GoodsReceiptStatus.DRAFT.value,
        movementType=movement_type,
        locationId=location_id,
        companyId=company_filter.company_id,
        returnId=return_id,
        externalReferenceType="RETURN",
        externalReferenceNo=ret.returnNo if hasattr(ret, 'returnNo') else str(return_id),
        inboundSource=inbound_source,
        source="RETURN",
        notes=notes,
    )
    session.add(goods_receipt)
    session.flush()

    # Get items from return
    return_items = session.exec(
        select(ReturnItem).where(ReturnItem.returnId == return_id)
    ).all()

    total_qty = 0
    for ret_item in return_items:
        qty = ret_item.quantity if hasattr(ret_item, 'quantity') else 1

        gr_item = GoodsReceiptItem(
            goodsReceiptId=goods_receipt.id,
            skuId=ret_item.skuId,
            expectedQty=qty,
            receivedQty=0,
            acceptedQty=0,
            rejectedQty=0,
        )
        session.add(gr_item)
        total_qty += qty

    goods_receipt.totalQty = total_qty
    session.add(goods_receipt)
    session.commit()
    session.refresh(goods_receipt)

    return build_gr_response(goods_receipt, session)
