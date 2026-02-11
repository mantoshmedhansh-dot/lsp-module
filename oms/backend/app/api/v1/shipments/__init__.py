"""
Shipments API v1 - B2C Courier Shipment Management
Standalone shipments for clients using only courier service (no OMS)
"""
import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import User, Location, Transporter, PaymentMode, DeliveryStatus
from app.models.shipment import (
    Shipment, ShipmentCreate, ShipmentUpdate, ShipmentResponse,
    ShipmentBrief, ShipmentStats
)

router = APIRouter(prefix="/shipments", tags=["Shipments (B2C Courier)"])


def generate_shipment_no() -> str:
    """Generate unique shipment number"""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"SHP-{timestamp}-{str(uuid4())[:4].upper()}"


def calculate_volumetric_weight(length: Decimal, width: Decimal, height: Decimal) -> Decimal:
    """Calculate volumetric weight (length x width x height / 5000)"""
    if length and width and height:
        return Decimal(str(float(length) * float(width) * float(height) / 5000))
    return Decimal("0")


# ============================================================================
# Shipment CRUD Endpoints
# ============================================================================

@router.get("", response_model=List[ShipmentBrief])
def list_shipments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[DeliveryStatus] = None,
    payment_mode: Optional[PaymentMode] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List shipments with pagination and filters."""
    query = select(Shipment)

    # Apply company filter
    query = company_filter.apply_filter(query, Shipment.companyId)

    # Apply filters
    if status:
        query = query.where(Shipment.status == status)
    if payment_mode:
        query = query.where(Shipment.paymentMode == payment_mode)
    if date_from:
        query = query.where(Shipment.createdAt >= date_from)
    if date_to:
        query = query.where(Shipment.createdAt <= date_to)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Shipment.shipmentNo.ilike(search_pattern)) |
            (Shipment.awbNo.ilike(search_pattern)) |
            (Shipment.consigneeName.ilike(search_pattern)) |
            (Shipment.consigneePhone.ilike(search_pattern)) |
            (Shipment.orderReference.ilike(search_pattern))
        )

    # Apply pagination and ordering
    query = query.offset(skip).limit(limit).order_by(Shipment.createdAt.desc())

    shipments = session.exec(query).all()
    return [ShipmentBrief.model_validate(s) for s in shipments]


@router.get("/count")
def count_shipments(
    status: Optional[DeliveryStatus] = None,
    payment_mode: Optional[PaymentMode] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get total count of shipments matching filters."""
    query = select(func.count(Shipment.id))

    query = company_filter.apply_filter(query, Shipment.companyId)
    if status:
        query = query.where(Shipment.status == status)
    if payment_mode:
        query = query.where(Shipment.paymentMode == payment_mode)
    if date_from:
        query = query.where(Shipment.createdAt >= date_from)
    if date_to:
        query = query.where(Shipment.createdAt <= date_to)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/stats", response_model=ShipmentStats)
def get_shipment_stats(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get shipment statistics."""
    base_query = select(Shipment)

    base_query = company_filter.apply_filter(base_query, Shipment.companyId)
    if date_from:
        base_query = base_query.where(Shipment.createdAt >= date_from)
    if date_to:
        base_query = base_query.where(Shipment.createdAt <= date_to)

    shipments = session.exec(base_query).all()

    stats = ShipmentStats(
        total=len(shipments),
        pending=sum(1 for s in shipments if s.status == DeliveryStatus.PENDING),
        pickedUp=sum(1 for s in shipments if s.status == DeliveryStatus.PACKED),
        inTransit=sum(1 for s in shipments if s.status == DeliveryStatus.IN_TRANSIT),
        outForDelivery=sum(1 for s in shipments if s.status == DeliveryStatus.OUT_FOR_DELIVERY),
        delivered=sum(1 for s in shipments if s.status == DeliveryStatus.DELIVERED),
        ndr=sum(1 for s in shipments if s.status == DeliveryStatus.NDR),
        rto=sum(1 for s in shipments if s.status in [DeliveryStatus.RTO, DeliveryStatus.RTO_INITIATED, DeliveryStatus.RTO_IN_TRANSIT, DeliveryStatus.RTO_DELIVERED]),
        codPending=sum(s.codAmount for s in shipments if s.paymentMode == PaymentMode.COD and s.status != DeliveryStatus.DELIVERED),
        codCollected=sum(s.codAmount for s in shipments if s.paymentMode == PaymentMode.COD and s.status == DeliveryStatus.DELIVERED),
    )

    return stats


@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(
    shipment_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get shipment by ID."""
    query = select(Shipment).where(Shipment.id == shipment_id)
    query = company_filter.apply_filter(query, Shipment.companyId)

    shipment = session.exec(query).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    return ShipmentResponse.model_validate(shipment)


@router.post("", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
def create_shipment(
    data: ShipmentCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new shipment."""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    # Generate shipment number
    shipment_no = generate_shipment_no()

    # Get pickup address details if provided
    pickup_address_dict = None
    if data.pickupAddressId:
        location = session.get(Location, data.pickupAddressId)
        if location:
            pickup_address_dict = {
                "name": location.name,
                "addressLine1": location.addressLine1,
                "addressLine2": location.addressLine2,
                "city": location.city,
                "state": location.state,
                "pincode": location.pincode,
                "phone": location.phone,
            }

    # Calculate volumetric weight
    volumetric_weight = None
    if data.length and data.width and data.height:
        volumetric_weight = calculate_volumetric_weight(data.length, data.width, data.height)

    # Get courier name if transporter provided
    courier_name = None
    if data.transporterId:
        transporter = session.get(Transporter, data.transporterId)
        if transporter:
            courier_name = transporter.name

    shipment = Shipment(
        shipmentNo=shipment_no,
        orderReference=data.orderReference,
        paymentMode=data.paymentMode,
        codAmount=data.codAmount if data.paymentMode == PaymentMode.COD else Decimal("0"),
        declaredValue=data.declaredValue,
        consigneeName=data.consigneeName,
        consigneePhone=data.consigneePhone,
        consigneeEmail=data.consigneeEmail,
        deliveryAddress=data.deliveryAddress,
        pickupAddressId=data.pickupAddressId,
        pickupAddress=pickup_address_dict,
        weight=data.weight,
        length=data.length,
        width=data.width,
        height=data.height,
        volumetricWeight=volumetric_weight,
        productDescription=data.productDescription,
        productCategory=data.productCategory,
        boxes=data.boxes,
        transporterId=data.transporterId,
        courierName=courier_name,
        pickupDate=data.pickupDate,
        remarks=data.remarks,
        companyId=company_filter.company_id,
        status=DeliveryStatus.PENDING,
    )

    session.add(shipment)
    session.commit()
    session.refresh(shipment)

    return ShipmentResponse.model_validate(shipment)


@router.patch("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(
    shipment_id: UUID,
    data: ShipmentUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a shipment."""
    query = select(Shipment).where(Shipment.id == shipment_id)
    query = company_filter.apply_filter(query, Shipment.companyId)

    shipment = session.exec(query).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    update_data = data.model_dump(exclude_unset=True)

    # Update volumetric weight if dimensions change
    length = update_data.get('length', shipment.length)
    width = update_data.get('width', shipment.width)
    height = update_data.get('height', shipment.height)
    if length and width and height:
        update_data['volumetricWeight'] = calculate_volumetric_weight(length, width, height)

    # Get courier name if transporter changes
    if 'transporterId' in update_data and update_data['transporterId']:
        transporter = session.get(Transporter, update_data['transporterId'])
        if transporter:
            update_data['courierName'] = transporter.name

    for field, value in update_data.items():
        setattr(shipment, field, value)

    session.add(shipment)
    session.commit()
    session.refresh(shipment)

    return ShipmentResponse.model_validate(shipment)


@router.delete("/{shipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shipment(
    shipment_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete a shipment (only if PENDING)."""
    query = select(Shipment).where(Shipment.id == shipment_id)
    query = company_filter.apply_filter(query, Shipment.companyId)

    shipment = session.exec(query).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.status != DeliveryStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only delete pending shipments")

    session.delete(shipment)
    session.commit()


# ============================================================================
# Shipment Actions
# ============================================================================

@router.post("/{shipment_id}/assign-awb", response_model=ShipmentResponse)
def assign_awb(
    shipment_id: UUID,
    awb_no: str,
    transporter_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Assign AWB number to shipment."""
    query = select(Shipment).where(Shipment.id == shipment_id)
    query = company_filter.apply_filter(query, Shipment.companyId)

    shipment = session.exec(query).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.awbNo = awb_no
    if transporter_id:
        shipment.transporterId = transporter_id
        transporter = session.get(Transporter, transporter_id)
        if transporter:
            shipment.courierName = transporter.name

    session.add(shipment)
    session.commit()
    session.refresh(shipment)

    return ShipmentResponse.model_validate(shipment)


@router.post("/{shipment_id}/ship", response_model=ShipmentResponse)
def ship_shipment(
    shipment_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark shipment as shipped."""
    query = select(Shipment).where(Shipment.id == shipment_id)
    query = company_filter.apply_filter(query, Shipment.companyId)

    shipment = session.exec(query).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not shipment.awbNo:
        raise HTTPException(status_code=400, detail="AWB number required before shipping")

    shipment.status = DeliveryStatus.SHIPPED
    shipment.shipDate = datetime.utcnow()

    session.add(shipment)
    session.commit()
    session.refresh(shipment)

    return ShipmentResponse.model_validate(shipment)


@router.post("/{shipment_id}/deliver", response_model=ShipmentResponse)
def deliver_shipment(
    shipment_id: UUID,
    received_by: Optional[str] = None,
    pod_remarks: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark shipment as delivered."""
    query = select(Shipment).where(Shipment.id == shipment_id)
    query = company_filter.apply_filter(query, Shipment.companyId)

    shipment = session.exec(query).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.status = DeliveryStatus.DELIVERED
    shipment.deliveredDate = datetime.utcnow()
    if received_by:
        shipment.receivedBy = received_by
    if pod_remarks:
        shipment.podRemarks = pod_remarks

    session.add(shipment)
    session.commit()
    session.refresh(shipment)

    return ShipmentResponse.model_validate(shipment)


# ============================================================================
# Bulk Import
# ============================================================================

@router.post("/bulk-import")
async def bulk_import_shipments(
    file: UploadFile = File(...),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk import shipments from CSV file.

    Expected columns:
    order_number, consignee_name, consignee_phone, consignee_email,
    address_line_1, address_line_2, city, state, pincode,
    weight_kg, length_cm, width_cm, height_cm,
    payment_mode (COD/PREPAID), cod_amount, product_description
    """
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company context required")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    import_id = uuid4()
    created = []
    errors = []
    row_num = 1

    for row in reader:
        row_num += 1
        try:
            # Parse payment mode
            payment_mode_str = row.get('payment_mode', 'PREPAID').upper().strip()
            payment_mode = PaymentMode.COD if payment_mode_str == 'COD' else PaymentMode.PREPAID

            # Parse amounts
            cod_amount = Decimal(row.get('cod_amount', '0') or '0')
            weight = Decimal(row.get('weight_kg', '0.5') or '0.5')

            # Parse dimensions
            length = Decimal(row.get('length_cm', '0') or '0') if row.get('length_cm') else None
            width = Decimal(row.get('width_cm', '0') or '0') if row.get('width_cm') else None
            height = Decimal(row.get('height_cm', '0') or '0') if row.get('height_cm') else None

            # Build delivery address
            delivery_address = {
                "addressLine1": row.get('address_line_1', ''),
                "addressLine2": row.get('address_line_2', ''),
                "city": row.get('city', ''),
                "state": row.get('state', ''),
                "pincode": row.get('pincode', ''),
                "country": "India"
            }

            # Validate required fields
            if not row.get('consignee_name'):
                errors.append({"row": row_num, "message": "consignee_name is required"})
                continue
            if not row.get('consignee_phone'):
                errors.append({"row": row_num, "message": "consignee_phone is required"})
                continue
            if not row.get('address_line_1'):
                errors.append({"row": row_num, "message": "address_line_1 is required"})
                continue
            if not row.get('pincode'):
                errors.append({"row": row_num, "message": "pincode is required"})
                continue

            # Calculate volumetric weight
            volumetric_weight = None
            if length and width and height:
                volumetric_weight = calculate_volumetric_weight(length, width, height)

            shipment = Shipment(
                shipmentNo=generate_shipment_no(),
                orderReference=row.get('order_number'),
                paymentMode=payment_mode,
                codAmount=cod_amount if payment_mode == PaymentMode.COD else Decimal("0"),
                consigneeName=row.get('consignee_name', '').strip(),
                consigneePhone=row.get('consignee_phone', '').strip(),
                consigneeEmail=row.get('consignee_email', '').strip() or None,
                deliveryAddress=delivery_address,
                weight=weight,
                length=length,
                width=width,
                height=height,
                volumetricWeight=volumetric_weight,
                productDescription=row.get('product_description', 'General Cargo').strip(),
                companyId=company_filter.company_id,
                status=DeliveryStatus.PENDING,
                importId=import_id,
                csvLineNumber=row_num,
            )

            session.add(shipment)
            created.append({
                "shipmentNo": shipment.shipmentNo,
                "orderReference": shipment.orderReference,
                "consignee": shipment.consigneeName
            })

        except Exception as e:
            errors.append({"row": row_num, "message": str(e)})

    session.commit()

    return {
        "success": True,
        "importId": str(import_id),
        "totalRows": row_num - 1,
        "successCount": len(created),
        "errorCount": len(errors),
        "shipments": created,
        "errors": errors
    }


# ============================================================================
# Rate Check
# ============================================================================

@router.post("/rate-check")
def check_shipping_rates(
    origin_pincode: str,
    destination_pincode: str,
    weight: Decimal,
    payment_mode: PaymentMode = PaymentMode.PREPAID,
    cod_amount: Decimal = Decimal("0"),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Check available shipping rates for given parameters.
    Returns list of available couriers with rates.
    """
    # Get active transporters
    transporters = session.exec(
        select(Transporter).where(Transporter.isActive == True)
    ).all()

    quotes = []
    for t in transporters:
        # Base rate calculation (simplified)
        base_rate = Decimal("50") + (weight * Decimal("10"))
        fuel_surcharge = base_rate * Decimal("0.1")
        cod_charge = Decimal("0")

        if payment_mode == PaymentMode.COD:
            cod_charge = max(Decimal("25"), cod_amount * Decimal("0.02"))

        total = base_rate + fuel_surcharge + cod_charge

        quotes.append({
            "transporterId": str(t.id),
            "courierName": t.name,
            "serviceType": t.type.value if t.type else "COURIER",
            "estimatedDays": 3,  # Default estimate
            "baseRate": float(base_rate),
            "fuelSurcharge": float(fuel_surcharge),
            "codCharge": float(cod_charge),
            "totalRate": float(total)
        })

    return {"quotes": quotes}
