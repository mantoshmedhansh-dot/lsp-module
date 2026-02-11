"""
B2B Logistics API v1 - Freight & LTL/FTL Shipment Management
Lorry Receipts, Consignees, and Bookings
"""
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import User
from app.models.b2b_logistics import (
    # Models
    B2BConsignee, LorryReceipt, B2BBooking,
    # Enums
    LRStatus, VehicleType, FreightPaymentMode, BookingType, BookingStatus, ProductType,
    # Schemas
    B2BConsigneeCreate, B2BConsigneeUpdate, B2BConsigneeResponse,
    LorryReceiptCreate, LorryReceiptUpdate, LorryReceiptResponse, LorryReceiptBrief,
    B2BBookingCreate, B2BBookingUpdate, B2BBookingResponse,
    B2BLogisticsStats,
)

router = APIRouter(prefix="/b2b-logistics", tags=["B2B Logistics"])


# ============================================================================
# Helper Functions
# ============================================================================

def generate_lr_number() -> str:
    """Generate unique LR number"""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M")
    return f"LR-{timestamp}-{str(uuid4())[:4].upper()}"


def generate_booking_number(booking_type: BookingType) -> str:
    """Generate unique booking number"""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M")
    prefix = "LTL" if booking_type == BookingType.LTL else "FTL"
    return f"BK-{prefix}-{timestamp}-{str(uuid4())[:4].upper()}"


# ============================================================================
# Stats Endpoint
# ============================================================================

@router.get("/stats", response_model=B2BLogisticsStats)
def get_b2b_logistics_stats(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get B2B Logistics dashboard statistics."""
    today_start = datetime.combine(date.today(), datetime.min.time())

    # Base queries with company filter
    lr_query = select(LorryReceipt)
    consignee_query = select(B2BConsignee)
    booking_query = select(B2BBooking)

    lr_query = company_filter.apply_filter(lr_query, LorryReceipt.companyId)
    consignee_query = company_filter.apply_filter(consignee_query, B2BConsignee.companyId)
    booking_query = company_filter.apply_filter(booking_query, B2BBooking.companyId)

    lrs = session.exec(lr_query).all()
    consignees = session.exec(consignee_query.where(B2BConsignee.isActive == True)).all()
    bookings = session.exec(booking_query).all()

    # Calculate stats
    active_statuses = [LRStatus.BOOKED, LRStatus.DISPATCHED, LRStatus.IN_TRANSIT, LRStatus.OUT_FOR_DELIVERY]
    active_lrs = sum(1 for lr in lrs if lr.status in active_statuses)
    in_transit = sum(1 for lr in lrs if lr.status == LRStatus.IN_TRANSIT)
    delivered_today = sum(1 for lr in lrs if lr.status == LRStatus.DELIVERED and lr.deliveredDate and lr.deliveredDate >= today_start)
    pod_pending = sum(1 for lr in lrs if lr.status == LRStatus.POD_PENDING)

    # Freight dues (unpaid TO_PAY LRs)
    freight_dues = sum(
        lr.balanceAmount for lr in lrs
        if lr.paymentMode == FreightPaymentMode.TO_PAY and not lr.isPaid
    )

    pending_bookings = sum(1 for b in bookings if b.status == BookingStatus.PENDING)

    return B2BLogisticsStats(
        activeLRs=active_lrs,
        inTransitVehicles=in_transit,
        deliveredToday=delivered_today,
        podPending=pod_pending,
        freightDues=freight_dues,
        totalConsignees=len(consignees),
        totalBookings=len(bookings),
        pendingBookings=pending_bookings,
    )


# ============================================================================
# Consignee CRUD Endpoints
# ============================================================================

@router.get("/consignees", response_model=List[B2BConsigneeResponse])
def list_consignees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    city: Optional[str] = None,
    active_only: bool = True,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List consignees with optional filters."""
    query = select(B2BConsignee)

    query = company_filter.apply_filter(query, B2BConsignee.companyId)

    if active_only:
        query = query.where(B2BConsignee.isActive == True)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (B2BConsignee.name.ilike(search_pattern)) |
            (B2BConsignee.city.ilike(search_pattern)) |
            (B2BConsignee.phone.ilike(search_pattern))
        )

    if city:
        query = query.where(B2BConsignee.city.ilike(f"%{city}%"))

    query = query.offset(skip).limit(limit).order_by(B2BConsignee.name)

    consignees = session.exec(query).all()
    return [B2BConsigneeResponse.model_validate(c) for c in consignees]


@router.get("/consignees/{consignee_id}", response_model=B2BConsigneeResponse)
def get_consignee(
    consignee_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get consignee by ID."""
    query = select(B2BConsignee).where(B2BConsignee.id == consignee_id)
    query = company_filter.apply_filter(query, B2BConsignee.companyId)

    consignee = session.exec(query).first()
    if not consignee:
        raise HTTPException(status_code=404, detail="Consignee not found")

    return B2BConsigneeResponse.model_validate(consignee)


@router.post("/consignees", response_model=B2BConsigneeResponse, status_code=status.HTTP_201_CREATED)
def create_consignee(
    data: B2BConsigneeCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new consignee."""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    consignee = B2BConsignee(
        name=data.name,
        code=data.code,
        contactPerson=data.contactPerson,
        phone=data.phone,
        email=data.email,
        addressLine1=data.addressLine1,
        addressLine2=data.addressLine2,
        city=data.city,
        state=data.state,
        pincode=data.pincode,
        gstNumber=data.gstNumber,
        companyId=company_filter.company_id,
    )

    session.add(consignee)
    session.commit()
    session.refresh(consignee)

    return B2BConsigneeResponse.model_validate(consignee)


@router.put("/consignees/{consignee_id}", response_model=B2BConsigneeResponse)
def update_consignee(
    consignee_id: UUID,
    data: B2BConsigneeUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a consignee."""
    query = select(B2BConsignee).where(B2BConsignee.id == consignee_id)
    query = company_filter.apply_filter(query, B2BConsignee.companyId)

    consignee = session.exec(query).first()
    if not consignee:
        raise HTTPException(status_code=404, detail="Consignee not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(consignee, field, value)

    session.add(consignee)
    session.commit()
    session.refresh(consignee)

    return B2BConsigneeResponse.model_validate(consignee)


@router.delete("/consignees/{consignee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consignee(
    consignee_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete a consignee (soft delete - sets isActive=False)."""
    query = select(B2BConsignee).where(B2BConsignee.id == consignee_id)
    query = company_filter.apply_filter(query, B2BConsignee.companyId)

    consignee = session.exec(query).first()
    if not consignee:
        raise HTTPException(status_code=404, detail="Consignee not found")

    # Soft delete
    consignee.isActive = False
    session.add(consignee)
    session.commit()


# ============================================================================
# Lorry Receipt CRUD Endpoints
# ============================================================================

@router.get("/lr", response_model=List[LorryReceiptBrief])
def list_lorry_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[LRStatus] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    consignee_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List Lorry Receipts with pagination and filters."""
    query = select(LorryReceipt)

    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    if status:
        query = query.where(LorryReceipt.status == status)

    if consignee_id:
        query = query.where(LorryReceipt.consigneeId == consignee_id)

    if date_from:
        query = query.where(LorryReceipt.bookingDate >= date_from)
    if date_to:
        query = query.where(LorryReceipt.bookingDate <= date_to)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (LorryReceipt.lrNumber.ilike(search_pattern)) |
            (LorryReceipt.consigneeName.ilike(search_pattern)) |
            (LorryReceipt.vehicleNumber.ilike(search_pattern)) |
            (LorryReceipt.destination.ilike(search_pattern))
        )

    query = query.offset(skip).limit(limit).order_by(LorryReceipt.createdAt.desc())

    lrs = session.exec(query).all()
    return [LorryReceiptBrief.model_validate(lr) for lr in lrs]


@router.get("/lr/count")
def count_lorry_receipts(
    status: Optional[LRStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of LRs matching filters."""
    query = select(func.count(LorryReceipt.id))

    query = company_filter.apply_filter(query, LorryReceipt.companyId)
    if status:
        query = query.where(LorryReceipt.status == status)
    if date_from:
        query = query.where(LorryReceipt.bookingDate >= date_from)
    if date_to:
        query = query.where(LorryReceipt.bookingDate <= date_to)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/lr/{lr_id}", response_model=LorryReceiptResponse)
def get_lorry_receipt(
    lr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get Lorry Receipt by ID."""
    query = select(LorryReceipt).where(LorryReceipt.id == lr_id)
    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    lr = session.exec(query).first()
    if not lr:
        raise HTTPException(status_code=404, detail="LR not found")

    return LorryReceiptResponse.model_validate(lr)


@router.post("/lr", response_model=LorryReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_lorry_receipt(
    data: LorryReceiptCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new Lorry Receipt."""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    lr_number = generate_lr_number()

    # Calculate balance amount
    balance = data.freightAmount - data.advanceAmount

    # Convert cargo items to dict if provided
    cargo_items_dict = None
    if data.cargoItems:
        cargo_items_dict = [item.model_dump() for item in data.cargoItems]

    lr = LorryReceipt(
        lrNumber=lr_number,
        bookingDate=datetime.utcnow(),
        consigneeId=data.consigneeId,
        consigneeName=data.consigneeName,
        consigneeAddress=data.consigneeAddress,
        consigneePhone=data.consigneePhone,
        destination=data.destination,
        origin=data.origin,
        originAddress=data.originAddress,
        vehicleNumber=data.vehicleNumber,
        vehicleType=data.vehicleType,
        driverName=data.driverName,
        driverPhone=data.driverPhone,
        cargoItems=cargo_items_dict,
        totalPackages=data.totalPackages,
        totalWeight=data.totalWeight,
        freightAmount=data.freightAmount,
        advanceAmount=data.advanceAmount,
        balanceAmount=balance,
        paymentMode=data.paymentMode,
        isPaid=data.paymentMode == FreightPaymentMode.PAID,
        remarks=data.remarks,
        ewayBillNumber=data.ewayBillNumber,
        invoiceNumber=data.invoiceNumber,
        invoiceValue=data.invoiceValue,
        status=LRStatus.BOOKED,
        companyId=company_filter.company_id,
    )

    session.add(lr)

    # Update consignee stats if linked
    if data.consigneeId:
        consignee = session.get(B2BConsignee, data.consigneeId)
        if consignee:
            consignee.totalLRs += 1
            consignee.totalFreight += data.freightAmount
            session.add(consignee)

    session.commit()
    session.refresh(lr)

    return LorryReceiptResponse.model_validate(lr)


@router.patch("/lr/{lr_id}", response_model=LorryReceiptResponse)
def update_lorry_receipt(
    lr_id: UUID,
    data: LorryReceiptUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a Lorry Receipt."""
    query = select(LorryReceipt).where(LorryReceipt.id == lr_id)
    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    lr = session.exec(query).first()
    if not lr:
        raise HTTPException(status_code=404, detail="LR not found")

    update_data = data.model_dump(exclude_unset=True)

    # Recalculate balance if freight or advance changes
    freight = update_data.get('freightAmount', lr.freightAmount)
    advance = update_data.get('advanceAmount', lr.advanceAmount)
    if 'freightAmount' in update_data or 'advanceAmount' in update_data:
        update_data['balanceAmount'] = freight - advance

    for field, value in update_data.items():
        setattr(lr, field, value)

    session.add(lr)
    session.commit()
    session.refresh(lr)

    return LorryReceiptResponse.model_validate(lr)


@router.delete("/lr/{lr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lorry_receipt(
    lr_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete a Lorry Receipt (only if BOOKED status)."""
    query = select(LorryReceipt).where(LorryReceipt.id == lr_id)
    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    lr = session.exec(query).first()
    if not lr:
        raise HTTPException(status_code=404, detail="LR not found")

    if lr.status != LRStatus.BOOKED:
        raise HTTPException(status_code=400, detail="Can only delete LRs in BOOKED status")

    session.delete(lr)
    session.commit()


# ============================================================================
# LR Actions
# ============================================================================

@router.post("/lr/{lr_id}/dispatch", response_model=LorryReceiptResponse)
def dispatch_lr(
    lr_id: UUID,
    vehicle_number: Optional[str] = None,
    driver_name: Optional[str] = None,
    driver_phone: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark LR as dispatched."""
    query = select(LorryReceipt).where(LorryReceipt.id == lr_id)
    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    lr = session.exec(query).first()
    if not lr:
        raise HTTPException(status_code=404, detail="LR not found")

    lr.status = LRStatus.DISPATCHED
    lr.dispatchDate = datetime.utcnow()
    if vehicle_number:
        lr.vehicleNumber = vehicle_number
    if driver_name:
        lr.driverName = driver_name
    if driver_phone:
        lr.driverPhone = driver_phone

    session.add(lr)
    session.commit()
    session.refresh(lr)

    return LorryReceiptResponse.model_validate(lr)


@router.post("/lr/{lr_id}/deliver", response_model=LorryReceiptResponse)
def deliver_lr(
    lr_id: UUID,
    received_by: Optional[str] = None,
    pod_remarks: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark LR as delivered."""
    query = select(LorryReceipt).where(LorryReceipt.id == lr_id)
    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    lr = session.exec(query).first()
    if not lr:
        raise HTTPException(status_code=404, detail="LR not found")

    lr.status = LRStatus.DELIVERED
    lr.deliveredDate = datetime.utcnow()
    if received_by:
        lr.podReceivedBy = received_by
    if pod_remarks:
        lr.podRemarks = pod_remarks

    session.add(lr)
    session.commit()
    session.refresh(lr)

    return LorryReceiptResponse.model_validate(lr)


@router.post("/lr/{lr_id}/upload-pod", response_model=LorryReceiptResponse)
def upload_pod(
    lr_id: UUID,
    pod_image: Optional[str] = None,
    pod_signature: Optional[str] = None,
    received_by: Optional[str] = None,
    pod_remarks: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload POD for an LR."""
    query = select(LorryReceipt).where(LorryReceipt.id == lr_id)
    query = company_filter.apply_filter(query, LorryReceipt.companyId)

    lr = session.exec(query).first()
    if not lr:
        raise HTTPException(status_code=404, detail="LR not found")

    lr.status = LRStatus.POD_RECEIVED
    lr.podDate = datetime.utcnow()
    if pod_image:
        lr.podImage = pod_image
    if pod_signature:
        lr.podSignature = pod_signature
    if received_by:
        lr.podReceivedBy = received_by
    if pod_remarks:
        lr.podRemarks = pod_remarks

    session.add(lr)
    session.commit()
    session.refresh(lr)

    return LorryReceiptResponse.model_validate(lr)


# ============================================================================
# Booking CRUD Endpoints
# ============================================================================

@router.get("/bookings", response_model=List[B2BBookingResponse])
def list_bookings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    booking_type: Optional[BookingType] = None,
    status: Optional[BookingStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List bookings with filters."""
    query = select(B2BBooking)

    query = company_filter.apply_filter(query, B2BBooking.companyId)

    if booking_type:
        query = query.where(B2BBooking.bookingType == booking_type)
    if status:
        query = query.where(B2BBooking.status == status)

    query = query.offset(skip).limit(limit).order_by(B2BBooking.createdAt.desc())

    bookings = session.exec(query).all()
    return [B2BBookingResponse.model_validate(b) for b in bookings]


@router.get("/bookings/{booking_id}", response_model=B2BBookingResponse)
def get_booking(
    booking_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get booking by ID."""
    query = select(B2BBooking).where(B2BBooking.id == booking_id)
    query = company_filter.apply_filter(query, B2BBooking.companyId)

    booking = session.exec(query).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    return B2BBookingResponse.model_validate(booking)


@router.post("/bookings", response_model=B2BBookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    data: B2BBookingCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new booking."""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    booking_number = generate_booking_number(data.bookingType)

    booking = B2BBooking(
        bookingNumber=booking_number,
        bookingType=data.bookingType,
        status=BookingStatus.PENDING,
        origin=data.origin,
        originAddress=data.originAddress,
        originPincode=data.originPincode,
        destination=data.destination,
        destinationAddress=data.destinationAddress,
        destinationPincode=data.destinationPincode,
        consigneeName=data.consigneeName,
        consigneePhone=data.consigneePhone,
        consigneeId=data.consigneeId,
        packages=data.packages,
        weight=data.weight,
        productType=data.productType,
        pickupDate=data.pickupDate,
        requestedDeliveryDate=data.requestedDeliveryDate,
        remarks=data.remarks,
        companyId=company_filter.company_id,
    )

    session.add(booking)
    session.commit()
    session.refresh(booking)

    return B2BBookingResponse.model_validate(booking)


@router.patch("/bookings/{booking_id}", response_model=B2BBookingResponse)
def update_booking(
    booking_id: UUID,
    data: B2BBookingUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a booking."""
    query = select(B2BBooking).where(B2BBooking.id == booking_id)
    query = company_filter.apply_filter(query, B2BBooking.companyId)

    booking = session.exec(query).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking, field, value)

    session.add(booking)
    session.commit()
    session.refresh(booking)

    return B2BBookingResponse.model_validate(booking)


@router.delete("/bookings/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete/cancel a booking."""
    query = select(B2BBooking).where(B2BBooking.id == booking_id)
    query = company_filter.apply_filter(query, B2BBooking.companyId)

    booking = session.exec(query).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status not in [BookingStatus.PENDING, BookingStatus.CONFIRMED]:
        raise HTTPException(status_code=400, detail="Cannot delete assigned bookings")

    booking.status = BookingStatus.CANCELLED
    session.add(booking)
    session.commit()


@router.post("/bookings/{booking_id}/convert-to-lr", response_model=LorryReceiptResponse)
def convert_booking_to_lr(
    booking_id: UUID,
    vehicle_number: Optional[str] = None,
    driver_name: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Convert a confirmed booking to a Lorry Receipt."""
    query = select(B2BBooking).where(B2BBooking.id == booking_id)
    query = company_filter.apply_filter(query, B2BBooking.companyId)

    booking = session.exec(query).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.lrId:
        raise HTTPException(status_code=400, detail="Booking already converted to LR")

    lr_number = generate_lr_number()

    lr = LorryReceipt(
        lrNumber=lr_number,
        bookingDate=datetime.utcnow(),
        consigneeId=booking.consigneeId,
        consigneeName=booking.consigneeName,
        destination=booking.destination,
        destinationAddress=booking.destinationAddress,
        origin=booking.origin,
        originAddress=booking.originAddress,
        vehicleNumber=vehicle_number,
        driverName=driver_name,
        totalPackages=booking.packages,
        totalWeight=booking.weight,
        freightAmount=booking.quotedRate or Decimal("0"),
        balanceAmount=booking.quotedRate or Decimal("0"),
        paymentMode=FreightPaymentMode.TO_PAY,
        remarks=booking.remarks,
        status=LRStatus.BOOKED,
        companyId=company_filter.company_id,
        bookingId=booking.id,
    )

    session.add(lr)

    # Update booking
    booking.status = BookingStatus.ASSIGNED
    booking.lrId = lr.id
    session.add(booking)

    session.commit()
    session.refresh(lr)

    return LorryReceiptResponse.model_validate(lr)
