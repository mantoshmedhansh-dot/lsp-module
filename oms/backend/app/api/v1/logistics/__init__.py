"""
Logistics Extended API v1 - Rate Cards, Shipping Rules, Service Pincodes, AWB
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, require_admin, CompanyFilter
from app.models import (
    RateCard, RateCardCreate, RateCardUpdate, RateCardResponse,
    RateCardSlab, RateCardSlabCreate, RateCardSlabResponse,
    ShippingRule, ShippingRuleCreate, ShippingRuleUpdate, ShippingRuleResponse,
    ShippingRuleCondition, ShippingRuleConditionCreate, ShippingRuleConditionResponse,
    ServicePincode, ServicePincodeCreate, ServicePincodeUpdate, ServicePincodeResponse,
    AWB, AWBCreate, AWBResponse,
    User
)

router = APIRouter(prefix="/logistics", tags=["Logistics"])


# ============================================================================
# Rate Card Endpoints
# ============================================================================

@router.get("/rate-cards", response_model=List[RateCardResponse])
def list_rate_cards(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    transporter_id: Optional[UUID] = None,
    status: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List rate cards."""
    query = select(RateCard)

    if company_filter.company_id:
        query = query.where(RateCard.companyId == company_filter.company_id)
    if transporter_id:
        query = query.where(RateCard.transporterId == transporter_id)
    if status:
        query = query.where(RateCard.status == status)

    query = query.offset(skip).limit(limit).order_by(RateCard.createdAt.desc())
    rate_cards = session.exec(query).all()
    return [RateCardResponse.model_validate(r) for r in rate_cards]


@router.get("/rate-cards/{rate_card_id}", response_model=RateCardResponse)
def get_rate_card(
    rate_card_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get rate card by ID."""
    query = select(RateCard).where(RateCard.id == rate_card_id)
    if company_filter.company_id:
        query = query.where(RateCard.companyId == company_filter.company_id)

    rate_card = session.exec(query).first()
    if not rate_card:
        raise HTTPException(status_code=404, detail="Rate card not found")
    return RateCardResponse.model_validate(rate_card)


@router.post("/rate-cards", response_model=RateCardResponse, status_code=status.HTTP_201_CREATED)
def create_rate_card(
    data: RateCardCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new rate card."""
    rate_card = RateCard(
        code=data.code,
        name=data.name,
        description=data.description,
        transporterId=data.transporterId,
        companyId=company_filter.company_id,
        type=data.type,
        validFrom=data.validFrom,
        validTo=data.validTo,
        baseWeight=data.baseWeight,
        baseRate=data.baseRate,
        additionalWeightRate=data.additionalWeightRate,
        codPercent=data.codPercent,
        codMinCharge=data.codMinCharge,
        fuelSurchargePercent=data.fuelSurchargePercent
    )

    session.add(rate_card)
    session.commit()
    session.refresh(rate_card)

    # Add slabs if provided
    if data.slabs:
        for slab_data in data.slabs:
            slab = RateCardSlab(rateCardId=rate_card.id, **slab_data.model_dump())
            session.add(slab)
        session.commit()
        session.refresh(rate_card)

    return RateCardResponse.model_validate(rate_card)


@router.patch("/rate-cards/{rate_card_id}", response_model=RateCardResponse)
def update_rate_card(
    rate_card_id: UUID,
    data: RateCardUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update rate card."""
    query = select(RateCard).where(RateCard.id == rate_card_id)
    if company_filter.company_id:
        query = query.where(RateCard.companyId == company_filter.company_id)

    rate_card = session.exec(query).first()
    if not rate_card:
        raise HTTPException(status_code=404, detail="Rate card not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rate_card, field, value)

    session.add(rate_card)
    session.commit()
    session.refresh(rate_card)
    return RateCardResponse.model_validate(rate_card)


@router.post("/rate-cards/{rate_card_id}/activate", response_model=RateCardResponse)
def activate_rate_card(
    rate_card_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Activate rate card."""
    query = select(RateCard).where(RateCard.id == rate_card_id)
    if company_filter.company_id:
        query = query.where(RateCard.companyId == company_filter.company_id)

    rate_card = session.exec(query).first()
    if not rate_card:
        raise HTTPException(status_code=404, detail="Rate card not found")

    rate_card.status = "ACTIVE"
    session.add(rate_card)
    session.commit()
    session.refresh(rate_card)
    return RateCardResponse.model_validate(rate_card)


# ============================================================================
# Shipping Rule Endpoints
# ============================================================================

@router.get("/shipping-rules", response_model=List[ShippingRuleResponse])
def list_shipping_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List shipping rules."""
    query = select(ShippingRule)

    if company_filter.company_id:
        query = query.where(ShippingRule.companyId == company_filter.company_id)
    if is_active is not None:
        query = query.where(ShippingRule.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(ShippingRule.priority.desc())
    rules = session.exec(query).all()
    return [ShippingRuleResponse.model_validate(r) for r in rules]


@router.get("/shipping-rules/{rule_id}", response_model=ShippingRuleResponse)
def get_shipping_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get shipping rule by ID."""
    query = select(ShippingRule).where(ShippingRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(ShippingRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Shipping rule not found")
    return ShippingRuleResponse.model_validate(rule)


@router.post("/shipping-rules", response_model=ShippingRuleResponse, status_code=status.HTTP_201_CREATED)
def create_shipping_rule(
    data: ShippingRuleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new shipping rule."""
    rule = ShippingRule.model_validate(data)
    if company_filter.company_id:
        rule.companyId = company_filter.company_id

    session.add(rule)
    session.commit()
    session.refresh(rule)
    return ShippingRuleResponse.model_validate(rule)


@router.patch("/shipping-rules/{rule_id}", response_model=ShippingRuleResponse)
def update_shipping_rule(
    rule_id: UUID,
    data: ShippingRuleUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update shipping rule."""
    query = select(ShippingRule).where(ShippingRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(ShippingRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Shipping rule not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    session.add(rule)
    session.commit()
    session.refresh(rule)
    return ShippingRuleResponse.model_validate(rule)


@router.delete("/shipping-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shipping_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete shipping rule."""
    query = select(ShippingRule).where(ShippingRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(ShippingRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Shipping rule not found")

    session.delete(rule)
    session.commit()


# ============================================================================
# Service Pincode Endpoints
# ============================================================================

@router.get("/service-pincodes", response_model=List[ServicePincodeResponse])
def list_service_pincodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    transporter_id: Optional[UUID] = None,
    pincode: Optional[str] = None,
    is_serviceable: Optional[bool] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List service pincodes."""
    query = select(ServicePincode)

    if transporter_id:
        query = query.where(ServicePincode.transporterId == transporter_id)
    if pincode:
        query = query.where(ServicePincode.pincode == pincode)
    if is_serviceable is not None:
        query = query.where(ServicePincode.isServiceable == is_serviceable)

    query = query.offset(skip).limit(limit).order_by(ServicePincode.pincode)
    pincodes = session.exec(query).all()
    return [ServicePincodeResponse.model_validate(p) for p in pincodes]


@router.get("/service-pincodes/check/{pincode}")
def check_pincode_serviceability(
    pincode: str,
    transporter_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Check serviceability of a pincode."""
    query = select(ServicePincode).where(
        ServicePincode.pincode == pincode,
        ServicePincode.isServiceable == True
    )
    if transporter_id:
        query = query.where(ServicePincode.transporterId == transporter_id)

    pincodes = session.exec(query).all()

    return {
        "pincode": pincode,
        "serviceable": len(pincodes) > 0,
        "transporters": [
            {
                "transporterId": str(p.transporterId),
                "codAvailable": p.codAvailable,
                "prepaidAvailable": p.prepaidAvailable,
                "zoneCode": p.zoneCode
            }
            for p in pincodes
        ]
    }


@router.post("/service-pincodes", response_model=ServicePincodeResponse, status_code=status.HTTP_201_CREATED)
def create_service_pincode(
    data: ServicePincodeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Create service pincode."""
    pincode = ServicePincode.model_validate(data)
    session.add(pincode)
    session.commit()
    session.refresh(pincode)
    return ServicePincodeResponse.model_validate(pincode)


@router.post("/service-pincodes/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
def bulk_create_service_pincodes(
    pincodes: List[ServicePincodeCreate],
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Bulk create service pincodes."""
    created = 0
    for data in pincodes:
        pincode = ServicePincode.model_validate(data)
        session.add(pincode)
        created += 1

    session.commit()
    return {"created": created}


@router.patch("/service-pincodes/{pincode_id}", response_model=ServicePincodeResponse)
def update_service_pincode(
    pincode_id: UUID,
    data: ServicePincodeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Update service pincode."""
    pincode = session.get(ServicePincode, pincode_id)
    if not pincode:
        raise HTTPException(status_code=404, detail="Service pincode not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pincode, field, value)

    session.add(pincode)
    session.commit()
    session.refresh(pincode)
    return ServicePincodeResponse.model_validate(pincode)


# ============================================================================
# AWB Endpoints
# ============================================================================

@router.get("/awb", response_model=List[AWBResponse])
def list_awbs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    transporter_id: Optional[UUID] = None,
    is_used: Optional[bool] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List AWB numbers."""
    query = select(AWB)

    if transporter_id:
        query = query.where(AWB.transporterId == transporter_id)
    if is_used is not None:
        query = query.where(AWB.isUsed == is_used)

    query = query.offset(skip).limit(limit).order_by(AWB.createdAt.desc())
    awbs = session.exec(query).all()
    return [AWBResponse.model_validate(a) for a in awbs]


@router.get("/awb/available")
def get_available_awb(
    transporter_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get next available AWB for a transporter."""
    query = select(AWB).where(
        AWB.transporterId == transporter_id,
        AWB.isUsed == False
    ).limit(1)

    awb = session.exec(query).first()
    if not awb:
        raise HTTPException(status_code=404, detail="No available AWB numbers")

    return AWBResponse.model_validate(awb)


@router.post("/awb", response_model=AWBResponse, status_code=status.HTTP_201_CREATED)
def create_awb(
    data: AWBCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create AWB number."""
    awb = AWB.model_validate(data)
    session.add(awb)
    session.commit()
    session.refresh(awb)
    return AWBResponse.model_validate(awb)


@router.post("/awb/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
def bulk_create_awbs(
    transporter_id: UUID,
    awb_numbers: List[str],
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Bulk create AWB numbers."""
    created = 0
    for awb_no in awb_numbers:
        awb = AWB(awbNo=awb_no, transporterId=transporter_id)
        session.add(awb)
        created += 1

    session.commit()
    return {"created": created}


@router.post("/awb/{awb_id}/use", response_model=AWBResponse)
def use_awb(
    awb_id: UUID,
    used_for: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Mark AWB as used."""
    awb = session.get(AWB, awb_id)
    if not awb:
        raise HTTPException(status_code=404, detail="AWB not found")

    if awb.isUsed:
        raise HTTPException(status_code=400, detail="AWB already used")

    awb.isUsed = True
    awb.usedAt = datetime.utcnow()
    awb.usedFor = used_for

    session.add(awb)
    session.commit()
    session.refresh(awb)
    return AWBResponse.model_validate(awb)
