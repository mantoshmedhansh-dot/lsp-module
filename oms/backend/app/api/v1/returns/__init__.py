"""
Returns API v1 - Customer returns management endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Return, ReturnCreate, ReturnUpdate, ReturnResponse, ReturnBrief,
    ReturnItem, ReturnItemCreate, ReturnItemUpdate, ReturnItemResponse,
    User, ReturnType, ReturnStatus, QCStatus,
    # Phase 4: WMS Integration
    ReturnZoneRouting, ReturnReceiveRequest, ReturnQCRequest,
    ReturnRestockRequest, ReturnZoneRoutingCreate, ReturnZoneRoutingResponse,
    Inventory
)

router = APIRouter(prefix="/returns", tags=["Returns"])


# ============================================================================
# Return Endpoints
# ============================================================================

@router.get("", response_model=List[ReturnBrief])
def list_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[ReturnStatus] = None,
    return_type: Optional[ReturnType] = None,
    order_id: Optional[UUID] = None,
    qc_status: Optional[QCStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List returns with pagination and filters."""
    query = select(Return)

    # Apply company filter for multi-tenancy
    if company_filter.company_id:
        query = query.where(Return.companyId == company_filter.company_id)

    if status:
        query = query.where(Return.status == status)
    if return_type:
        query = query.where(Return.type == return_type)
    if order_id:
        query = query.where(Return.orderId == order_id)
    if qc_status:
        query = query.where(Return.qcStatus == qc_status)
    if date_from:
        query = query.where(Return.initiatedAt >= date_from)
    if date_to:
        query = query.where(Return.initiatedAt <= date_to)

    query = query.offset(skip).limit(limit).order_by(Return.initiatedAt.desc())

    returns = session.exec(query).all()
    return [ReturnBrief.model_validate(r) for r in returns]


@router.get("/count")
def count_returns(
    status: Optional[ReturnStatus] = None,
    return_type: Optional[ReturnType] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of returns."""
    query = select(func.count(Return.id))

    # Apply company filter for multi-tenancy
    if company_filter.company_id:
        query = query.where(Return.companyId == company_filter.company_id)

    if status:
        query = query.where(Return.status == status)
    if return_type:
        query = query.where(Return.type == return_type)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/summary")
def get_return_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get return summary statistics."""
    try:
        query = select(Return)
        # Apply company filter for multi-tenancy
        if company_filter.company_id:
            query = query.where(Return.companyId == company_filter.company_id)
        returns = session.exec(query).all()

        # Use string comparison to avoid enum issues
        def get_status_str(r):
            return r.status.value if hasattr(r.status, 'value') else str(r.status)

        def get_type_str(r):
            return r.type.value if hasattr(r.type, 'value') else str(r.type)

        pending = sum(1 for r in returns if get_status_str(r) in ["INITIATED", "PICKUP_SCHEDULED", "IN_TRANSIT"])
        received = sum(1 for r in returns if get_status_str(r) in ["RECEIVED", "QC_PENDING"])
        processed = sum(1 for r in returns if get_status_str(r) in ["QC_PASSED", "QC_FAILED"])

        by_type = {}
        by_status = {}
        by_reason = {}
        rto_count = 0

        for r in returns:
            type_str = get_type_str(r)
            status_str = get_status_str(r)
            by_type[type_str] = by_type.get(type_str, 0) + 1
            by_status[status_str] = by_status.get(status_str, 0) + 1

            # Track RTO reasons
            if type_str == "RTO":
                rto_count += 1
                reason = r.reason or "Unknown"
                by_reason[reason] = by_reason.get(reason, 0) + 1

        # Calculate RTO rate as percentage of total returns
        total_returns = len(returns)
        rto_rate = rto_count / total_returns if total_returns > 0 else 0

        return {
            "totalReturns": total_returns,
            "pendingReturns": pending,
            "receivedReturns": received,
            "processedReturns": processed,
            "byType": by_type,
            "byStatus": by_status,
            "byReason": by_reason,
            "rtoRate": round(rto_rate, 4),
            "rtoCount": rto_count
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Summary error: {str(e)}\n{traceback.format_exc()}")


@router.get("/{return_id}", response_model=ReturnResponse)
def get_return(
    return_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get return by ID."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    # Check company access
    if company_filter.company_id and ret.companyId != company_filter.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this return")

    return ReturnResponse.model_validate(ret)


@router.post("", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
def create_return(
    data: ReturnCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create new return."""
    ret = Return.model_validate(data)
    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.patch("/{return_id}", response_model=ReturnResponse)
def update_return(
    return_id: UUID,
    data: ReturnUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update return."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ret, field, value)

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/receive", response_model=ReturnResponse)
def receive_return(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark return as received."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.status = ReturnStatus.RECEIVED
    ret.receivedAt = datetime.utcnow()

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/qc", response_model=ReturnResponse)
def update_qc_status(
    return_id: UUID,
    qc_status: QCStatus,
    qc_remarks: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update QC status for return."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.qcStatus = qc_status
    ret.qcCompletedAt = datetime.utcnow()
    ret.qcCompletedBy = current_user.id
    ret.qcRemarks = qc_remarks

    if qc_status == QCStatus.PASSED:
        ret.status = ReturnStatus.QC_PASSED
    elif qc_status == QCStatus.FAILED:
        ret.status = ReturnStatus.QC_FAILED

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/process", response_model=ReturnResponse)
def process_return(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark return as processed."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    ret.status = ReturnStatus.PROCESSED
    ret.processedAt = datetime.utcnow()

    session.add(ret)
    session.commit()
    session.refresh(ret)
    return ReturnResponse.model_validate(ret)


# ============================================================================
# Return Items Endpoints
# ============================================================================

@router.get("/{return_id}/items", response_model=List[ReturnItemResponse])
def list_return_items(
    return_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List items in a return."""
    query = select(ReturnItem).where(ReturnItem.returnId == return_id)
    items = session.exec(query).all()
    return [ReturnItemResponse.model_validate(i) for i in items]


@router.post("/{return_id}/items", response_model=ReturnItemResponse, status_code=status.HTTP_201_CREATED)
def add_return_item(
    return_id: UUID,
    data: ReturnItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add item to return."""
    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    item_data = data.model_dump()
    item_data["returnId"] = return_id
    item = ReturnItem.model_validate(item_data)

    session.add(item)
    session.commit()
    session.refresh(item)
    return ReturnItemResponse.model_validate(item)


@router.patch("/items/{item_id}", response_model=ReturnItemResponse)
def update_return_item(
    item_id: UUID,
    data: ReturnItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update return item (QC, action, etc.)."""
    item = session.get(ReturnItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Return item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return ReturnItemResponse.model_validate(item)


# ============================================================================
# Phase 4: WMS Workflow Endpoints
# ============================================================================

@router.post("/{return_id}/receive-at-warehouse", response_model=ReturnResponse)
def receive_return_at_warehouse(
    return_id: UUID,
    data: "ReturnReceiveRequest",
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Receive return at warehouse with optional GRN creation.
    This is the enhanced WMS receiving workflow.
    """
    from app.models import (
        ReturnReceiveRequest, GoodsReceipt, GoodsReceiptItem,
        Location, SKU
    )

    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    # Verify location exists
    location = session.get(Location, data.locationId)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Update return with receiving info
    ret.locationId = data.locationId
    ret.status = ReturnStatus.RECEIVED
    ret.receivedAt = datetime.utcnow()
    ret.receivedBy = current_user.id
    ret.vehicleNumber = data.vehicleNumber
    ret.driverName = data.driverName
    ret.driverPhone = data.driverPhone

    # Process items if provided
    if data.items:
        for item_data in data.items:
            item = session.get(ReturnItem, item_data.itemId)
            if item and item.returnId == return_id:
                item.receivedQty = item_data.receivedQty
                item.destinationBinId = item_data.destinationBinId
                item.batchNo = item_data.batchNo
                item.lotNo = item_data.lotNo
                session.add(item)

    # Create GRN if requested
    if data.createGrn:
        # Generate GRN number
        grn_no = f"GRN-RET-{ret.returnNo}"

        grn = GoodsReceipt(
            grNo=grn_no,
            companyId=ret.companyId,
            locationId=data.locationId,
            returnId=return_id,
            inboundSource="RETURN_SALES" if ret.type == ReturnType.CUSTOMER_RETURN else "RETURN_RTO",
            status="PENDING",
            vehicleNumber=data.vehicleNumber,
            driverName=data.driverName,
            remarks=data.remarks or f"Auto-created from Return {ret.returnNo}"
        )
        session.add(grn)
        session.flush()

        # Create GRN items from return items
        query = select(ReturnItem).where(ReturnItem.returnId == return_id)
        return_items = session.exec(query).all()

        for ri in return_items:
            grn_item = GoodsReceiptItem(
                goodsReceiptId=grn.id,
                skuId=ri.skuId,
                expectedQty=ri.quantity,
                receivedQty=ri.receivedQty,
                acceptedQty=ri.receivedQty,
                binId=ri.destinationBinId,
                batchNo=ri.batchNo,
                lotNo=ri.lotNo,
                status="PENDING"
            )
            session.add(grn_item)

        ret.goodsReceiptId = grn.id

    session.add(ret)
    session.commit()
    session.refresh(ret)

    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/complete-qc", response_model=ReturnResponse)
def complete_return_qc(
    return_id: UUID,
    data: "ReturnQCRequest",
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Complete QC for return items with grade and action assignment.
    Uses zone routing rules to determine destination zones.
    """
    from app.models import ReturnQCRequest, ReturnZoneRouting

    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    all_passed = True
    all_failed = True

    for item_qc in data.items:
        item = session.get(ReturnItem, item_qc.itemId)
        if not item or item.returnId != return_id:
            continue

        item.qcStatus = item_qc.qcStatus
        item.qcGrade = item_qc.qcGrade
        item.action = item_qc.action
        item.qcRemarks = item_qc.remarks

        # Track pass/fail status
        if item_qc.qcStatus == "PASSED":
            all_failed = False
        else:
            all_passed = False

        # Get zone routing if location is set
        if ret.locationId and item_qc.qcGrade:
            routing = session.exec(
                select(ReturnZoneRouting)
                .where(ReturnZoneRouting.locationId == ret.locationId)
                .where(ReturnZoneRouting.qcGrade == item_qc.qcGrade)
                .where(ReturnZoneRouting.isActive == True)
                .order_by(ReturnZoneRouting.priority)
            ).first()

            if routing:
                item.action = routing.action
                # Set destination zone on return if not already set
                if not ret.destinationZoneId and routing.destinationZoneId:
                    ret.destinationZoneId = routing.destinationZoneId

        session.add(item)

    # Update return QC status
    ret.qcCompletedAt = datetime.utcnow()
    ret.qcCompletedBy = current_user.id
    ret.qcRemarks = data.remarks

    if all_passed:
        ret.qcStatus = QCStatus.PASSED
        ret.status = ReturnStatus.QC_PASSED
    elif all_failed:
        ret.qcStatus = QCStatus.FAILED
        ret.status = ReturnStatus.QC_FAILED
    else:
        ret.qcStatus = QCStatus.PARTIAL
        ret.status = ReturnStatus.QC_PASSED  # Partial is still considered passed

    session.add(ret)
    session.commit()
    session.refresh(ret)

    return ReturnResponse.model_validate(ret)


@router.post("/{return_id}/restock", response_model=ReturnResponse)
def restock_return_items(
    return_id: UUID,
    data: "ReturnRestockRequest",
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Restock QC-passed return items to saleable inventory.
    Creates inventory entries and updates bin stock.
    """
    from app.models import ReturnRestockRequest, Inventory, Bin

    ret = session.get(Return, return_id)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")

    if ret.qcStatus != QCStatus.PASSED and ret.qcStatus != QCStatus.PARTIAL:
        raise HTTPException(
            status_code=400,
            detail="Return must pass QC before restocking"
        )

    for item_restock in data.items:
        item = session.get(ReturnItem, item_restock.itemId)
        if not item or item.returnId != return_id:
            continue

        if item.qcStatus != "PASSED":
            continue  # Skip items that didn't pass QC

        # Verify destination bin
        bin_obj = session.get(Bin, item_restock.destinationBinId)
        if not bin_obj:
            raise HTTPException(
                status_code=404,
                detail=f"Bin not found: {item_restock.destinationBinId}"
            )

        # Check for existing inventory in this bin
        existing_inv = session.exec(
            select(Inventory)
            .where(Inventory.skuId == item.skuId)
            .where(Inventory.binId == item_restock.destinationBinId)
            .where(Inventory.companyId == ret.companyId)
        ).first()

        if existing_inv:
            # Add to existing inventory
            existing_inv.quantity = (existing_inv.quantity or 0) + item_restock.restockQty
            existing_inv.availableQty = (existing_inv.availableQty or 0) + item_restock.restockQty
            session.add(existing_inv)
            item.restockedInventoryId = existing_inv.id
        else:
            # Create new inventory entry
            new_inv = Inventory(
                companyId=ret.companyId,
                locationId=ret.locationId,
                skuId=item.skuId,
                binId=item_restock.destinationBinId,
                quantity=item_restock.restockQty,
                availableQty=item_restock.restockQty,
                reservedQty=0,
                batchNo=item_restock.batchNo or item.batchNo,
                lotNo=item_restock.lotNo or item.lotNo,
            )
            session.add(new_inv)
            session.flush()
            item.restockedInventoryId = new_inv.id

        item.restockedQty = (item.restockedQty or 0) + item_restock.restockQty
        item.restockedBinId = item_restock.destinationBinId
        session.add(item)

    # Check if all items are fully restocked
    query = select(ReturnItem).where(ReturnItem.returnId == return_id)
    all_items = session.exec(query).all()

    all_processed = all(
        (i.restockedQty >= i.receivedQty) or (i.disposedQty >= i.receivedQty) or (i.qcStatus != "PASSED")
        for i in all_items
    )

    if all_processed:
        ret.status = ReturnStatus.PROCESSED
        ret.processedAt = datetime.utcnow()

    session.add(ret)
    session.commit()
    session.refresh(ret)

    return ReturnResponse.model_validate(ret)


# ============================================================================
# Zone Routing Configuration Endpoints
# ============================================================================

@router.get("/zone-routing", response_model=List["ReturnZoneRoutingResponse"])
def list_zone_routing(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List zone routing rules."""
    from app.models import ReturnZoneRouting, ReturnZoneRoutingResponse

    query = select(ReturnZoneRouting)

    if company_filter.company_id:
        query = query.where(ReturnZoneRouting.companyId == company_filter.company_id)

    if location_id:
        query = query.where(ReturnZoneRouting.locationId == location_id)

    query = query.order_by(ReturnZoneRouting.priority)
    rules = session.exec(query).all()

    return [ReturnZoneRoutingResponse.model_validate(r) for r in rules]


@router.post("/zone-routing", response_model="ReturnZoneRoutingResponse", status_code=status.HTTP_201_CREATED)
def create_zone_routing(
    data: "ReturnZoneRoutingCreate",
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create zone routing rule."""
    from app.models import ReturnZoneRouting, ReturnZoneRoutingCreate, ReturnZoneRoutingResponse

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    rule = ReturnZoneRouting(
        companyId=company_filter.company_id,
        locationId=data.locationId,
        qcGrade=data.qcGrade,
        destinationZoneId=data.destinationZoneId,
        action=data.action,
        priority=data.priority
    )

    session.add(rule)
    session.commit()
    session.refresh(rule)

    return ReturnZoneRoutingResponse.model_validate(rule)


@router.delete("/zone-routing/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone_routing(
    rule_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete zone routing rule."""
    from app.models import ReturnZoneRouting

    rule = session.get(ReturnZoneRouting, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    session.delete(rule)
    session.commit()
