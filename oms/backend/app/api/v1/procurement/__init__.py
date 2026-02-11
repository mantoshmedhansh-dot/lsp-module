"""
Procurement API v1 - Vendors and Purchase Orders
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    Vendor, VendorCreate, VendorUpdate, VendorResponse, VendorBrief,
    PurchaseOrder, PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    POItem, POItemCreate, POItemUpdate, POItemResponse,
    User, POStatus
)

router = APIRouter(prefix="/procurement", tags=["Procurement"])


# ============================================================================
# Vendor Endpoints
# ============================================================================

@router.get("/vendors", response_model=List[VendorBrief])
def list_vendors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List vendors with filters."""
    query = select(Vendor)

    query = company_filter.apply_filter(query, Vendor.companyId)
    if is_active is not None:
        query = query.where(Vendor.isActive == is_active)
    if search:
        query = query.where(
            (Vendor.name.ilike(f"%{search}%")) |
            (Vendor.code.ilike(f"%{search}%"))
        )

    query = query.offset(skip).limit(limit).order_by(Vendor.name)
    vendors = session.exec(query).all()
    return [VendorBrief.model_validate(v) for v in vendors]


@router.get("/vendors/count")
def count_vendors(
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of vendors."""
    query = select(func.count(Vendor.id))

    query = company_filter.apply_filter(query, Vendor.companyId)
    if is_active is not None:
        query = query.where(Vendor.isActive == is_active)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get vendor by ID."""
    query = select(Vendor).where(Vendor.id == vendor_id)
    query = company_filter.apply_filter(query, Vendor.companyId)

    vendor = session.exec(query).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return VendorResponse.model_validate(vendor)


@router.post("/vendors", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    data: VendorCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new vendor."""
    vendor = Vendor.model_validate(data)
    if company_filter.company_id:
        vendor.companyId = company_filter.company_id

    session.add(vendor)
    session.commit()
    session.refresh(vendor)
    return VendorResponse.model_validate(vendor)


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: UUID,
    data: VendorUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update vendor."""
    query = select(Vendor).where(Vendor.id == vendor_id)
    query = company_filter.apply_filter(query, Vendor.companyId)

    vendor = session.exec(query).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)

    session.add(vendor)
    session.commit()
    session.refresh(vendor)
    return VendorResponse.model_validate(vendor)


@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete vendor."""
    query = select(Vendor).where(Vendor.id == vendor_id)
    query = company_filter.apply_filter(query, Vendor.companyId)

    vendor = session.exec(query).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    session.delete(vendor)
    session.commit()


# ============================================================================
# Purchase Order Endpoints
# ============================================================================

@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[POStatus] = None,
    vendor_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List purchase orders with filters."""
    query = select(PurchaseOrder)

    query = company_filter.apply_filter(query, PurchaseOrder.companyId)
    if status:
        query = query.where(PurchaseOrder.status == status)
    if vendor_id:
        query = query.where(PurchaseOrder.vendorId == vendor_id)
    if location_id:
        query = query.where(PurchaseOrder.locationId == location_id)

    query = query.offset(skip).limit(limit).order_by(PurchaseOrder.createdAt.desc())
    orders = session.exec(query).all()
    return [PurchaseOrderResponse.model_validate(o) for o in orders]


@router.get("/purchase-orders/count")
def count_purchase_orders(
    status: Optional[POStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of purchase orders."""
    query = select(func.count(PurchaseOrder.id))

    query = company_filter.apply_filter(query, PurchaseOrder.companyId)
    if status:
        query = query.where(PurchaseOrder.status == status)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    po_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get purchase order by ID."""
    query = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, PurchaseOrder.companyId)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrderResponse.model_validate(po)


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    data: PurchaseOrderCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new purchase order."""
    # Generate PO number
    count = session.exec(select(func.count(PurchaseOrder.id))).one()
    po_number = data.poNumber or f"PO-{count + 1:06d}"

    po = PurchaseOrder(
        poNumber=po_number,
        vendorId=data.vendorId,
        locationId=data.locationId,
        companyId=company_filter.company_id,
        orderDate=data.orderDate or datetime.utcnow(),
        expectedDate=data.expectedDate,
        remarks=data.remarks
    )

    session.add(po)
    session.commit()
    session.refresh(po)

    # Add items if provided
    if data.items:
        for item_data in data.items:
            item = POItem(
                purchaseOrderId=po.id,
                **item_data.model_dump()
            )
            session.add(item)
        session.commit()
        session.refresh(po)

    return PurchaseOrderResponse.model_validate(po)


@router.patch("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    po_id: UUID,
    data: PurchaseOrderUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update purchase order."""
    query = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, PurchaseOrder.companyId)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(po, field, value)

    session.add(po)
    session.commit()
    session.refresh(po)
    return PurchaseOrderResponse.model_validate(po)


@router.post("/purchase-orders/{po_id}/submit", response_model=PurchaseOrderResponse)
def submit_purchase_order(
    po_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Submit purchase order for approval."""
    query = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, PurchaseOrder.companyId)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po.status != POStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft POs can be submitted")

    po.status = POStatus.PENDING_APPROVAL
    session.add(po)
    session.commit()
    session.refresh(po)
    return PurchaseOrderResponse.model_validate(po)


@router.post("/purchase-orders/{po_id}/approve", response_model=PurchaseOrderResponse)
def approve_purchase_order(
    po_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Approve purchase order."""
    query = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    query = company_filter.apply_filter(query, PurchaseOrder.companyId)

    po = session.exec(query).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    po.status = POStatus.APPROVED
    session.add(po)
    session.commit()
    session.refresh(po)
    return PurchaseOrderResponse.model_validate(po)


# ============================================================================
# PO Item Endpoints
# ============================================================================

@router.post("/purchase-orders/{po_id}/items", response_model=POItemResponse, status_code=status.HTTP_201_CREATED)
def add_po_item(
    po_id: UUID,
    data: POItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Add item to purchase order."""
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    item = POItem(purchaseOrderId=po_id, **data.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return POItemResponse.model_validate(item)


@router.patch("/purchase-orders/{po_id}/items/{item_id}", response_model=POItemResponse)
def update_po_item(
    po_id: UUID,
    item_id: UUID,
    data: POItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update PO item."""
    query = select(POItem).where(POItem.id == item_id, POItem.purchaseOrderId == po_id)
    item = session.exec(query).first()
    if not item:
        raise HTTPException(status_code=404, detail="PO item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return POItemResponse.model_validate(item)


@router.delete("/purchase-orders/{po_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_po_item(
    po_id: UUID,
    item_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete PO item."""
    query = select(POItem).where(POItem.id == item_id, POItem.purchaseOrderId == po_id)
    item = session.exec(query).first()
    if not item:
        raise HTTPException(status_code=404, detail="PO item not found")

    session.delete(item)
    session.commit()
