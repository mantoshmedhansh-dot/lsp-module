"""
Customers API v1 - Customer and CustomerGroup management endpoints
"""
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_admin, require_manager, CompanyFilter
from app.models import (
    Customer, CustomerCreate, CustomerUpdate, CustomerResponse, CustomerBrief,
    CustomerCreditUpdate, CustomerGroup, CustomerGroupCreate, CustomerGroupUpdate,
    CustomerGroupResponse, CustomerGroupBrief,
    CustomerType, CustomerStatus, CreditStatus, User
)

router = APIRouter(prefix="/customers", tags=["Customers"])


# ============================================================================
# Customer Endpoints
# ============================================================================

@router.get("", response_model=List[CustomerBrief])
def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type: Optional[CustomerType] = None,
    status: Optional[CustomerStatus] = None,
    credit_status: Optional[CreditStatus] = None,
    group_id: Optional[UUID] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """
    List customers with pagination and filters.
    Filtered by company.
    """
    query = select(Customer)

    # Apply company filter
    query = company_filter.apply_filter(query, Customer.companyId)

    # Apply filters
    if type:
        query = query.where(Customer.type == type)
    if status:
        query = query.where(Customer.status == status)
    if credit_status:
        query = query.where(Customer.creditStatus == credit_status)
    if group_id:
        query = query.where(Customer.customerGroupId == group_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Customer.name.ilike(search_pattern)) |
            (Customer.code.ilike(search_pattern)) |
            (Customer.phone.ilike(search_pattern)) |
            (Customer.email.ilike(search_pattern))
        )

    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Customer.name)

    customers = session.exec(query).all()
    return [CustomerBrief.model_validate(c) for c in customers]


@router.get("/count")
def count_customers(
    type: Optional[CustomerType] = None,
    status: Optional[CustomerStatus] = None,
    credit_status: Optional[CreditStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get total count of customers matching filters."""
    query = select(func.count(Customer.id))

    query = company_filter.apply_filter(query, Customer.companyId)
    if type:
        query = query.where(Customer.type == type)
    if status:
        query = query.where(Customer.status == status)
    if credit_status:
        query = query.where(Customer.creditStatus == credit_status)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/credit-summary")
def get_credit_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get summary of credit usage across all customers."""
    query = select(
        func.count(Customer.id).label("total_customers"),
        func.sum(Customer.creditLimit).label("total_credit_limit"),
        func.sum(Customer.creditUsed).label("total_credit_used"),
        func.sum(Customer.creditAvailable).label("total_credit_available")
    ).where(Customer.creditEnabled == True)

    query = company_filter.apply_filter(query, Customer.companyId)

    result = session.exec(query).first()

    # Count by credit status
    status_counts = {}
    for cs in CreditStatus:
        count_query = select(func.count(Customer.id)).where(
            Customer.creditStatus == cs,
            Customer.creditEnabled == True
        )
        count_query = company_filter.apply_filter(count_query, Customer.companyId)
        status_counts[cs.value] = session.exec(count_query).one()

    return {
        "total_credit_customers": result.total_customers or 0,
        "total_credit_limit": float(result.total_credit_limit or 0),
        "total_credit_used": float(result.total_credit_used or 0),
        "total_credit_available": float(result.total_credit_available or 0),
        "credit_status_counts": status_counts
    }


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a specific customer by ID."""
    query = select(Customer).where(Customer.id == customer_id)

    query = company_filter.apply_filter(query, Customer.companyId)

    customer = session.exec(query).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    return CustomerResponse.model_validate(customer)


@router.get("/code/{code}", response_model=CustomerResponse)
def get_customer_by_code(
    code: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a customer by code."""
    query = select(Customer).where(Customer.code == code)

    query = company_filter.apply_filter(query, Customer.companyId)

    customer = session.exec(query).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    return CustomerResponse.model_validate(customer)


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_data: CustomerCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Create a new customer. Requires MANAGER or higher role."""
    # Non-super-admins can only create customers for their own company
    if company_filter.company_id:
        if customer_data.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create customers for other companies"
            )

    # Check if code already exists for this company
    existing = session.exec(
        select(Customer).where(
            Customer.code == customer_data.code,
            Customer.companyId == customer_data.companyId
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer code already exists"
        )

    # Create customer
    customer_dict = customer_data.model_dump()

    # Calculate creditAvailable if creditEnabled
    if customer_dict.get("creditEnabled"):
        customer_dict["creditAvailable"] = customer_dict.get("creditLimit", Decimal("0"))
        customer_dict["creditStatus"] = CreditStatus.AVAILABLE

    customer = Customer(**customer_dict)
    session.add(customer)
    session.commit()
    session.refresh(customer)

    return CustomerResponse.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """Update a customer. Requires MANAGER or higher role."""
    query = select(Customer).where(Customer.id == customer_id)

    query = company_filter.apply_filter(query, Customer.companyId)

    customer = session.exec(query).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Update fields
    update_dict = customer_data.model_dump(exclude_unset=True)

    # Check code uniqueness if being updated
    if "code" in update_dict and update_dict["code"] != customer.code:
        existing = session.exec(
            select(Customer).where(
                Customer.code == update_dict["code"],
                Customer.companyId == customer.companyId
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer code already exists"
            )

    # Recalculate creditAvailable if creditLimit changes
    if "creditLimit" in update_dict:
        new_limit = update_dict["creditLimit"]
        update_dict["creditAvailable"] = new_limit - customer.creditUsed

        # Update credit status
        if update_dict["creditAvailable"] <= 0:
            update_dict["creditStatus"] = CreditStatus.EXHAUSTED
        elif update_dict["creditAvailable"] < new_limit * Decimal("0.1"):
            update_dict["creditStatus"] = CreditStatus.LOW
        else:
            update_dict["creditStatus"] = CreditStatus.AVAILABLE

    for field, value in update_dict.items():
        setattr(customer, field, value)

    session.add(customer)
    session.commit()
    session.refresh(customer)

    return CustomerResponse.model_validate(customer)


@router.post("/{customer_id}/credit-adjustment", response_model=CustomerResponse)
def adjust_customer_credit(
    customer_id: UUID,
    adjustment: CustomerCreditUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_manager())
):
    """
    Adjust customer credit (add or subtract).
    Requires MANAGER or higher role.
    """
    query = select(Customer).where(Customer.id == customer_id)

    query = company_filter.apply_filter(query, Customer.companyId)

    customer = session.exec(query).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    if not customer.creditEnabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credit is not enabled for this customer"
        )

    # Calculate new credit values
    new_credit_used = customer.creditUsed - adjustment.amount  # Negative amount increases usage
    new_credit_available = customer.creditLimit - new_credit_used

    if new_credit_used < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credit adjustment would result in negative credit used"
        )

    if new_credit_available < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient credit available"
        )

    customer.creditUsed = new_credit_used
    customer.creditAvailable = new_credit_available

    # Update credit status
    if customer.creditAvailable <= 0:
        customer.creditStatus = CreditStatus.EXHAUSTED
    elif customer.creditAvailable < customer.creditLimit * Decimal("0.1"):
        customer.creditStatus = CreditStatus.LOW
    else:
        customer.creditStatus = CreditStatus.AVAILABLE

    session.add(customer)
    session.commit()
    session.refresh(customer)

    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Soft delete a customer (set status to INACTIVE). Requires ADMIN or higher role."""
    query = select(Customer).where(Customer.id == customer_id)

    query = company_filter.apply_filter(query, Customer.companyId)

    customer = session.exec(query).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    customer.status = CustomerStatus.INACTIVE
    session.add(customer)
    session.commit()

    return None


# ============================================================================
# Customer Group Endpoints
# ============================================================================

@router.get("/groups", response_model=List[CustomerGroupBrief])
def list_customer_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """List customer groups."""
    query = select(CustomerGroup)

    query = company_filter.apply_filter(query, CustomerGroup.companyId)

    if is_active is not None:
        query = query.where(CustomerGroup.isActive == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (CustomerGroup.name.ilike(search_pattern)) |
            (CustomerGroup.code.ilike(search_pattern))
        )

    query = query.offset(skip).limit(limit).order_by(CustomerGroup.name)

    groups = session.exec(query).all()
    return [CustomerGroupBrief.model_validate(g) for g in groups]


@router.get("/groups/{group_id}", response_model=CustomerGroupResponse)
def get_customer_group(
    group_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session)
):
    """Get a specific customer group by ID."""
    query = select(CustomerGroup).where(CustomerGroup.id == group_id)

    query = company_filter.apply_filter(query, CustomerGroup.companyId)

    group = session.exec(query).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer group not found"
        )

    return CustomerGroupResponse.model_validate(group)


@router.post("/groups", response_model=CustomerGroupResponse, status_code=status.HTTP_201_CREATED)
def create_customer_group(
    group_data: CustomerGroupCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Create a new customer group. Requires ADMIN or higher role."""
    if company_filter.company_id:
        if group_data.companyId != company_filter.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create customer groups for other companies"
            )

    # Check if code already exists
    existing = session.exec(
        select(CustomerGroup).where(
            CustomerGroup.code == group_data.code,
            CustomerGroup.companyId == group_data.companyId
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer group code already exists"
        )

    group = CustomerGroup(**group_data.model_dump())
    session.add(group)
    session.commit()
    session.refresh(group)

    return CustomerGroupResponse.model_validate(group)


@router.patch("/groups/{group_id}", response_model=CustomerGroupResponse)
def update_customer_group(
    group_id: UUID,
    group_data: CustomerGroupUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Update a customer group. Requires ADMIN or higher role."""
    query = select(CustomerGroup).where(CustomerGroup.id == group_id)

    query = company_filter.apply_filter(query, CustomerGroup.companyId)

    group = session.exec(query).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer group not found"
        )

    update_dict = group_data.model_dump(exclude_unset=True)

    # Check code uniqueness if being updated
    if "code" in update_dict and update_dict["code"] != group.code:
        existing = session.exec(
            select(CustomerGroup).where(
                CustomerGroup.code == update_dict["code"],
                CustomerGroup.companyId == group.companyId
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer group code already exists"
            )

    for field, value in update_dict.items():
        setattr(group, field, value)

    session.add(group)
    session.commit()
    session.refresh(group)

    return CustomerGroupResponse.model_validate(group)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_group(
    group_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    _: None = Depends(require_admin())
):
    """Soft delete a customer group. Requires ADMIN or higher role."""
    query = select(CustomerGroup).where(CustomerGroup.id == group_id)

    query = company_filter.apply_filter(query, CustomerGroup.companyId)

    group = session.exec(query).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer group not found"
        )

    group.isActive = False
    session.add(group)
    session.commit()

    return None
