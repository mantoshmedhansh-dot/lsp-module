"""
Inventory API v1 - Inventory management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Inventory, InventoryCreate, InventoryUpdate, InventoryResponse,
    InventoryAdjustment, InventoryTransfer, InventorySummary,
    InventoryMovement, InventoryMovementResponse,
    SKU, Location, Bin, User
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=List[InventoryResponse])
def list_inventory(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    bin_id: Optional[UUID] = None,
    batch_no: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List inventory records with pagination and filters.
    Filtered by company via location.
    """
    query = select(Inventory)

    # Apply company filter via location
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Inventory.locationId.in_(location_ids))

    # Filter by user's location access (unless super admin)
    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Inventory.locationId.in_(current_user.locationAccess))

    # Apply filters
    if sku_id:
        query = query.where(Inventory.skuId == sku_id)
    if location_id:
        query = query.where(Inventory.locationId == location_id)
    if bin_id:
        query = query.where(Inventory.binId == bin_id)
    if batch_no:
        query = query.where(Inventory.batchNo == batch_no)

    # Apply pagination
    query = query.offset(skip).limit(limit)

    inventory_records = session.exec(query).all()

    # Build response with computed availableQty
    result = []
    for inv in inventory_records:
        response = InventoryResponse.model_validate(inv)
        response.availableQty = inv.quantity - inv.reservedQty
        result.append(response)

    return result


@router.get("/count")
def count_inventory(
    sku_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get total count of inventory records matching filters."""
    query = select(func.count(Inventory.id))

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Inventory.locationId.in_(location_ids))

    if sku_id:
        query = query.where(Inventory.skuId == sku_id)
    if location_id:
        query = query.where(Inventory.locationId == location_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/summary", response_model=List[InventorySummary])
def get_inventory_summary(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get inventory summary grouped by SKU."""
    # Build base query with SKU join
    query = select(
        Inventory.skuId,
        SKU.code.label("skuCode"),
        SKU.name.label("skuName"),
        func.sum(Inventory.quantity).label("totalQuantity"),
        func.sum(Inventory.reservedQty).label("reservedQuantity"),
        func.count(func.distinct(Inventory.locationId)).label("locationCount"),
        func.count(func.distinct(Inventory.binId)).label("binCount")
    ).join(SKU, Inventory.skuId == SKU.id)

    # Apply company filter
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Inventory.locationId.in_(location_ids))

    # Filter by user's location access
    if current_user.role != "SUPER_ADMIN" and current_user.locationAccess:
        query = query.where(Inventory.locationId.in_(current_user.locationAccess))

    if location_id:
        query = query.where(Inventory.locationId == location_id)

    query = query.group_by(Inventory.skuId, SKU.code, SKU.name)

    results = session.exec(query).all()

    return [
        InventorySummary(
            skuId=r.skuId,
            skuCode=r.skuCode,
            skuName=r.skuName,
            totalQuantity=r.totalQuantity or 0,
            reservedQuantity=r.reservedQuantity or 0,
            availableQuantity=(r.totalQuantity or 0) - (r.reservedQuantity or 0),
            locationCount=r.locationCount or 0,
            binCount=r.binCount or 0
        )
        for r in results
    ]


@router.get("/movements", response_model=List[InventoryMovementResponse])
def list_inventory_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sku_id: Optional[UUID] = None,
    movement_type: Optional[str] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List inventory movements (transaction history).
    Supports filtering by SKU, movement type, and search.
    """
    query = select(InventoryMovement)

    # Apply company filter via location
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(InventoryMovement.locationId.in_(location_ids))

    if sku_id:
        query = query.where(InventoryMovement.skuId == sku_id)
    if movement_type:
        query = query.where(InventoryMovement.movementType == movement_type)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(InventoryMovement.movementNo.ilike(search_pattern))

    query = query.order_by(InventoryMovement.performedAt.desc()).offset(skip).limit(limit)

    try:
        movements = session.exec(query).all()
        return [InventoryMovementResponse.model_validate(m) for m in movements]
    except Exception:
        return []


@router.get("/{inventory_id}", response_model=InventoryResponse)
def get_inventory(
    inventory_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific inventory record by ID."""
    query = select(Inventory).where(Inventory.id == inventory_id)

    # Apply company filter via location
    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Inventory.locationId.in_(location_ids))

    inventory = session.exec(query).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found"
        )

    # Check location access
    if (current_user.role != "SUPER_ADMIN" and
        current_user.locationAccess and
        inventory.locationId not in current_user.locationAccess):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this location"
        )

    response = InventoryResponse.model_validate(inventory)
    response.availableQty = inventory.quantity - inventory.reservedQty
    return response


@router.post("", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
def create_inventory(
    inventory_data: InventoryCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Create a new inventory record. Requires MANAGER or higher role."""
    # Validate location belongs to company
    location = session.exec(
        select(Location).where(Location.id == inventory_data.locationId)
    ).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    if company_filter.company_id and location.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create inventory for other companies"
        )

    # Validate bin belongs to location
    bin_obj = session.exec(
        select(Bin).where(Bin.id == inventory_data.binId)
    ).first()

    if not bin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bin not found"
        )

    # Validate SKU exists and belongs to company
    sku = session.exec(
        select(SKU).where(SKU.id == inventory_data.skuId)
    ).first()

    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    if company_filter.company_id and sku.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SKU does not belong to your company"
        )

    # Check for existing inventory record (same SKU + Bin + Batch)
    existing_query = select(Inventory).where(
        Inventory.skuId == inventory_data.skuId,
        Inventory.binId == inventory_data.binId
    )
    if inventory_data.batchNo:
        existing_query = existing_query.where(Inventory.batchNo == inventory_data.batchNo)
    else:
        existing_query = existing_query.where(Inventory.batchNo.is_(None))

    existing = session.exec(existing_query).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventory record already exists for this SKU/Bin/Batch combination"
        )

    # Create inventory - auto-fill companyId from location if not provided
    inventory_dict = inventory_data.model_dump()
    if not inventory_dict.get('companyId'):
        inventory_dict['companyId'] = location.companyId
    inventory = Inventory(**inventory_dict)
    session.add(inventory)
    session.commit()
    session.refresh(inventory)

    response = InventoryResponse.model_validate(inventory)
    response.availableQty = inventory.quantity - inventory.reservedQty
    return response


@router.patch("/{inventory_id}", response_model=InventoryResponse)
def update_inventory(
    inventory_id: UUID,
    inventory_data: InventoryUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update an inventory record. Requires MANAGER or higher role."""
    query = select(Inventory).where(Inventory.id == inventory_id)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Inventory.locationId.in_(location_ids))

    inventory = session.exec(query).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found"
        )

    # Update fields
    update_dict = inventory_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(inventory, field, value)

    session.add(inventory)
    session.commit()
    session.refresh(inventory)

    response = InventoryResponse.model_validate(inventory)
    response.availableQty = inventory.quantity - inventory.reservedQty
    return response


@router.post("/adjust", response_model=InventoryResponse)
def adjust_inventory(
    adjustment: InventoryAdjustment,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """
    Adjust inventory quantity (add or subtract).
    Requires MANAGER or higher role.
    """
    # Validate location access
    location = session.exec(
        select(Location).where(Location.id == adjustment.locationId)
    ).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    if company_filter.company_id and location.companyId != company_filter.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this location"
        )

    # Find existing inventory record
    query = select(Inventory).where(
        Inventory.skuId == adjustment.skuId,
        Inventory.binId == adjustment.binId,
        Inventory.locationId == adjustment.locationId
    )
    if adjustment.batchNo:
        query = query.where(Inventory.batchNo == adjustment.batchNo)
    else:
        query = query.where(Inventory.batchNo.is_(None))

    inventory = session.exec(query).first()

    if not inventory:
        # Create new inventory record if adding
        if adjustment.adjustmentQty > 0:
            inventory = Inventory(
                skuId=adjustment.skuId,
                binId=adjustment.binId,
                locationId=adjustment.locationId,
                companyId=location.companyId,
                batchNo=adjustment.batchNo,
                quantity=adjustment.adjustmentQty,
                serialNumbers=adjustment.serialNumbers or []
            )
            session.add(inventory)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory record not found"
            )
    else:
        # Adjust quantity
        new_qty = inventory.quantity + adjustment.adjustmentQty
        if new_qty < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory. Current: {inventory.quantity}, Adjustment: {adjustment.adjustmentQty}"
            )

        inventory.quantity = new_qty

        # Update serial numbers if provided
        if adjustment.serialNumbers:
            if adjustment.adjustmentQty > 0:
                inventory.serialNumbers = list(set(inventory.serialNumbers + adjustment.serialNumbers))
            else:
                inventory.serialNumbers = [sn for sn in inventory.serialNumbers if sn not in adjustment.serialNumbers]

        session.add(inventory)

    session.commit()
    session.refresh(inventory)

    response = InventoryResponse.model_validate(inventory)
    response.availableQty = inventory.quantity - inventory.reservedQty
    return response


@router.post("/transfer", response_model=dict)
def transfer_inventory(
    transfer: InventoryTransfer,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """
    Transfer inventory between bins.
    Requires MANAGER or higher role.
    """
    # Find source inventory
    source_query = select(Inventory).where(
        Inventory.skuId == transfer.skuId,
        Inventory.binId == transfer.fromBinId
    )
    if transfer.batchNo:
        source_query = source_query.where(Inventory.batchNo == transfer.batchNo)
    else:
        source_query = source_query.where(Inventory.batchNo.is_(None))

    source_inventory = session.exec(source_query).first()

    if not source_inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source inventory not found"
        )

    # Check company access
    if company_filter.company_id:
        source_location = session.exec(
            select(Location).where(Location.id == source_inventory.locationId)
        ).first()
        if source_location and source_location.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to source location"
            )

    # Check available quantity
    available = source_inventory.quantity - source_inventory.reservedQty
    if transfer.quantity > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient available inventory. Available: {available}, Requested: {transfer.quantity}"
        )

    # Get destination bin details
    dest_bin = session.exec(
        select(Bin).where(Bin.id == transfer.toBinId)
    ).first()

    if not dest_bin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Destination bin not found"
        )

    # Get destination location from zone
    from app.models import Zone
    dest_zone = session.exec(
        select(Zone).where(Zone.id == dest_bin.zoneId)
    ).first()

    if not dest_zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Destination zone not found"
        )

    dest_location_id = dest_zone.locationId

    # Find or create destination inventory
    dest_query = select(Inventory).where(
        Inventory.skuId == transfer.skuId,
        Inventory.binId == transfer.toBinId
    )
    if transfer.batchNo:
        dest_query = dest_query.where(Inventory.batchNo == transfer.batchNo)
    else:
        dest_query = dest_query.where(Inventory.batchNo.is_(None))

    dest_inventory = session.exec(dest_query).first()

    # Deduct from source
    source_inventory.quantity -= transfer.quantity

    # Handle serial numbers
    transferred_serials = []
    if transfer.serialNumbers:
        transferred_serials = transfer.serialNumbers[:transfer.quantity]
        source_inventory.serialNumbers = [
            sn for sn in source_inventory.serialNumbers
            if sn not in transferred_serials
        ]

    if dest_inventory:
        # Add to existing destination
        dest_inventory.quantity += transfer.quantity
        if transferred_serials:
            dest_inventory.serialNumbers = list(set(dest_inventory.serialNumbers + transferred_serials))
    else:
        # Create new destination inventory
        dest_inventory = Inventory(
            skuId=transfer.skuId,
            binId=transfer.toBinId,
            locationId=dest_location_id,
            batchNo=transfer.batchNo,
            quantity=transfer.quantity,
            serialNumbers=transferred_serials,
            mrp=source_inventory.mrp,
            costPrice=source_inventory.costPrice,
            expiryDate=source_inventory.expiryDate,
            mfgDate=source_inventory.mfgDate,
            valuationMethod=source_inventory.valuationMethod
        )
        session.add(dest_inventory)

    session.add(source_inventory)
    session.commit()

    return {
        "message": "Transfer completed successfully",
        "quantity_transferred": transfer.quantity,
        "from_bin_id": str(transfer.fromBinId),
        "to_bin_id": str(transfer.toBinId)
    }


@router.delete("/{inventory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory(
    inventory_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Delete an inventory record. Requires MANAGER or higher role."""
    query = select(Inventory).where(Inventory.id == inventory_id)

    if company_filter.company_id:
        location_ids = session.exec(
            select(Location.id).where(Location.companyId == company_filter.company_id)
        ).all()
        query = query.where(Inventory.locationId.in_(location_ids))

    inventory = session.exec(query).first()

    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found"
        )

    if inventory.reservedQty > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete inventory with reserved quantity"
        )

    session.delete(inventory)
    session.commit()

    return None
