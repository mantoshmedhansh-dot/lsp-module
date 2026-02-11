"""
B2B API v1 - Price Lists, Quotations, Credit Transactions
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    PriceList, PriceListCreate, PriceListUpdate, PriceListResponse,
    PriceListItem, PriceListItemCreate, PriceListItemUpdate, PriceListItemResponse,
    Quotation, QuotationCreate, QuotationUpdate, QuotationResponse,
    QuotationItem, QuotationItemCreate, QuotationItemResponse,
    B2BCreditTransaction, B2BCreditTransactionCreate, B2BCreditTransactionResponse,
    User, Customer
)

router = APIRouter(prefix="/b2b", tags=["B2B"])


# ============================================================================
# Price List Endpoints
# ============================================================================

@router.get("/price-lists", response_model=List[PriceListResponse])
def list_price_lists(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List price lists."""
    query = select(PriceList)

    query = company_filter.apply_filter(query, PriceList.companyId)
    if is_active is not None:
        query = query.where(PriceList.isActive == is_active)

    query = query.offset(skip).limit(limit).order_by(PriceList.name)
    price_lists = session.exec(query).all()
    return [PriceListResponse.model_validate(p) for p in price_lists]


@router.get("/price-lists/{price_list_id}", response_model=PriceListResponse)
def get_price_list(
    price_list_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get price list by ID."""
    query = select(PriceList).where(PriceList.id == price_list_id)
    query = company_filter.apply_filter(query, PriceList.companyId)

    price_list = session.exec(query).first()
    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found")
    return PriceListResponse.model_validate(price_list)


@router.post("/price-lists", response_model=PriceListResponse, status_code=status.HTTP_201_CREATED)
def create_price_list(
    data: PriceListCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new price list."""
    price_list = PriceList.model_validate(data)
    if company_filter.company_id:
        price_list.companyId = company_filter.company_id

    session.add(price_list)
    session.commit()
    session.refresh(price_list)
    return PriceListResponse.model_validate(price_list)


@router.patch("/price-lists/{price_list_id}", response_model=PriceListResponse)
def update_price_list(
    price_list_id: UUID,
    data: PriceListUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update price list."""
    query = select(PriceList).where(PriceList.id == price_list_id)
    query = company_filter.apply_filter(query, PriceList.companyId)

    price_list = session.exec(query).first()
    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(price_list, field, value)

    session.add(price_list)
    session.commit()
    session.refresh(price_list)
    return PriceListResponse.model_validate(price_list)


@router.delete("/price-lists/{price_list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_list(
    price_list_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete price list."""
    query = select(PriceList).where(PriceList.id == price_list_id)
    query = company_filter.apply_filter(query, PriceList.companyId)

    price_list = session.exec(query).first()
    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found")

    session.delete(price_list)
    session.commit()


# ============================================================================
# Price List Item Endpoints
# ============================================================================

@router.post("/price-lists/{price_list_id}/items", response_model=PriceListItemResponse, status_code=status.HTTP_201_CREATED)
def add_price_list_item(
    price_list_id: UUID,
    data: PriceListItemCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Add item to price list."""
    price_list = session.get(PriceList, price_list_id)
    if not price_list:
        raise HTTPException(status_code=404, detail="Price list not found")

    item = PriceListItem(priceListId=price_list_id, **data.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return PriceListItemResponse.model_validate(item)


@router.patch("/price-lists/{price_list_id}/items/{item_id}", response_model=PriceListItemResponse)
def update_price_list_item(
    price_list_id: UUID,
    item_id: UUID,
    data: PriceListItemUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update price list item."""
    query = select(PriceListItem).where(
        PriceListItem.id == item_id,
        PriceListItem.priceListId == price_list_id
    )
    item = session.exec(query).first()
    if not item:
        raise HTTPException(status_code=404, detail="Price list item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return PriceListItemResponse.model_validate(item)


@router.delete("/price-lists/{price_list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_list_item(
    price_list_id: UUID,
    item_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Delete price list item."""
    query = select(PriceListItem).where(
        PriceListItem.id == item_id,
        PriceListItem.priceListId == price_list_id
    )
    item = session.exec(query).first()
    if not item:
        raise HTTPException(status_code=404, detail="Price list item not found")

    session.delete(item)
    session.commit()


# ============================================================================
# Quotation Endpoints
# ============================================================================

@router.get("/quotations", response_model=List[QuotationResponse])
def list_quotations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    customer_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List quotations."""
    query = select(Quotation)

    query = company_filter.apply_filter(query, Quotation.companyId)
    if status:
        query = query.where(Quotation.status == status)
    if customer_id:
        query = query.where(Quotation.customerId == customer_id)

    query = query.offset(skip).limit(limit).order_by(Quotation.createdAt.desc())
    quotations = session.exec(query).all()
    return [QuotationResponse.model_validate(q) for q in quotations]


@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
def get_quotation(
    quotation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get quotation by ID."""
    query = select(Quotation).where(Quotation.id == quotation_id)
    query = company_filter.apply_filter(query, Quotation.companyId)

    quotation = session.exec(query).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return QuotationResponse.model_validate(quotation)


@router.post("/quotations", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
def create_quotation(
    data: QuotationCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create new quotation."""
    # Generate quotation number
    count = session.exec(select(func.count(Quotation.id))).one()
    quotation_no = f"QT-{count + 1:06d}"

    quotation = Quotation(
        quotationNo=quotation_no,
        customerId=data.customerId,
        companyId=company_filter.company_id,
        validUntil=data.validUntil,
        paymentTermType=data.paymentTermType,
        paymentTermDays=data.paymentTermDays,
        shippingAddress=data.shippingAddress,
        billingAddress=data.billingAddress,
        remarks=data.remarks
    )

    session.add(quotation)
    session.commit()
    session.refresh(quotation)

    # Add items if provided
    if data.items:
        for item_data in data.items:
            item = QuotationItem(
                quotationId=quotation.id,
                **item_data.model_dump()
            )
            session.add(item)
        session.commit()
        session.refresh(quotation)

    return QuotationResponse.model_validate(quotation)


@router.patch("/quotations/{quotation_id}", response_model=QuotationResponse)
def update_quotation(
    quotation_id: UUID,
    data: QuotationUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Update quotation."""
    query = select(Quotation).where(Quotation.id == quotation_id)
    query = company_filter.apply_filter(query, Quotation.companyId)

    quotation = session.exec(query).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(quotation, field, value)

    session.add(quotation)
    session.commit()
    session.refresh(quotation)
    return QuotationResponse.model_validate(quotation)


@router.post("/quotations/{quotation_id}/approve", response_model=QuotationResponse)
def approve_quotation(
    quotation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Approve quotation."""
    query = select(Quotation).where(Quotation.id == quotation_id)
    query = company_filter.apply_filter(query, Quotation.companyId)

    quotation = session.exec(query).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quotation.status = "APPROVED"
    quotation.approvedById = current_user.id
    quotation.approvedAt = datetime.utcnow()

    session.add(quotation)
    session.commit()
    session.refresh(quotation)
    return QuotationResponse.model_validate(quotation)


# ============================================================================
# Credit Transaction Endpoints
# ============================================================================

@router.get("/credit-transactions", response_model=List[B2BCreditTransactionResponse])
def list_credit_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    customer_id: Optional[UUID] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List credit transactions."""
    query = select(B2BCreditTransaction)

    if customer_id:
        query = query.where(B2BCreditTransaction.customerId == customer_id)

    query = query.offset(skip).limit(limit).order_by(B2BCreditTransaction.createdAt.desc())
    transactions = session.exec(query).all()
    return [B2BCreditTransactionResponse.model_validate(t) for t in transactions]


@router.get("/credit-transactions/{transaction_id}", response_model=B2BCreditTransactionResponse)
def get_credit_transaction(
    transaction_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get credit transaction by ID."""
    transaction = session.get(B2BCreditTransaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return B2BCreditTransactionResponse.model_validate(transaction)


@router.post("/credit-transactions", response_model=B2BCreditTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_credit_transaction(
    data: B2BCreditTransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_manager)
):
    """Create credit transaction."""
    # Get customer balance
    customer = session.get(Customer, data.customerId)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    balance_before = customer.creditBalance or 0

    # Generate transaction number
    count = session.exec(select(func.count(B2BCreditTransaction.id))).one()
    transaction_no = f"CT-{count + 1:06d}"

    # Calculate new balance based on transaction type
    if data.type.value in ["CREDIT", "PAYMENT_RECEIVED", "REFUND"]:
        balance_after = balance_before + data.amount
    else:
        balance_after = balance_before - data.amount

    transaction = B2BCreditTransaction(
        transactionNo=transaction_no,
        type=data.type,
        customerId=data.customerId,
        amount=data.amount,
        balanceBefore=balance_before,
        balanceAfter=balance_after,
        orderId=data.orderId,
        quotationId=data.quotationId,
        paymentRef=data.paymentRef,
        invoiceNo=data.invoiceNo,
        dueDate=data.dueDate,
        remarks=data.remarks,
        createdById=current_user.id
    )

    # Update customer balance
    customer.creditBalance = balance_after

    session.add(transaction)
    session.add(customer)
    session.commit()
    session.refresh(transaction)
    return B2BCreditTransactionResponse.model_validate(transaction)
