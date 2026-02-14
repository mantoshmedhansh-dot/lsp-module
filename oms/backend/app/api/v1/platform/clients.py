"""
Client Management API - LSP manages brand clients and contracts
"""
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.deps import get_db, get_current_user, require_admin
from app.models.company import Company, CompanyCreate, CompanyResponse, Location
from app.models.client_contract import (
    ClientContract,
    ClientContractCreate,
    ClientContractUpdate,
    ClientContractResponse,
)
from app.models.user import User

router = APIRouter(prefix="/clients", tags=["Client Management"])


# ── List brand clients under current LSP ──────────────────────────────────
@router.get("", response_model=List[CompanyResponse])
async def list_clients(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all brand clients under the current user's LSP company."""
    company = db.exec(select(Company).where(Company.id == current_user.companyId)).first()
    if not company or company.companyType != "LSP":
        raise HTTPException(status_code=403, detail="Only LSP companies can manage clients")

    query = select(Company).where(Company.parentId == current_user.companyId)
    if search:
        query = query.where(Company.name.ilike(f"%{search}%"))
    query = query.offset(skip).limit(limit)
    clients = db.exec(query).all()
    return clients


# ── Get single client ──────────────────────────────────────────────────────
@router.get("/{client_id}", response_model=CompanyResponse)
async def get_client(
    client_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific brand client under the current LSP."""
    client = db.exec(
        select(Company).where(
            Company.id == client_id,
            Company.parentId == current_user.companyId,
        )
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


# ── Onboard a new brand client ────────────────────────────────────────────
@router.post("", response_model=CompanyResponse, status_code=201)
async def create_client(
    data: CompanyCreate,
    current_user=Depends(get_current_user),
    _=Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Onboard a new brand client under the current LSP."""
    lsp = db.exec(select(Company).where(Company.id == current_user.companyId)).first()
    if not lsp or lsp.companyType != "LSP":
        raise HTTPException(status_code=403, detail="Only LSP companies can onboard clients")

    client = Company(**data.model_dump(exclude_unset=True))
    client.companyType = "BRAND"
    client.parentId = current_user.companyId
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


# ── Update a brand client ─────────────────────────────────────────────────
@router.patch("/{client_id}", response_model=CompanyResponse)
async def update_client(
    client_id: UUID,
    data: dict,
    current_user=Depends(get_current_user),
    _=Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Update a brand client under the current LSP."""
    client = db.exec(
        select(Company).where(
            Company.id == client_id,
            Company.parentId == current_user.companyId,
        )
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for key, value in data.items():
        if key not in ("id", "parentId", "companyType", "createdAt", "updatedAt"):
            if hasattr(client, key):
                setattr(client, key, value)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


# ── Contracts ──────────────────────────────────────────────────────────────

@router.get("/{client_id}/contract", response_model=ClientContractResponse)
async def get_contract(
    client_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the service contract for a brand client."""
    contract = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.post("/{client_id}/contract", response_model=ClientContractResponse, status_code=201)
async def create_contract(
    client_id: UUID,
    data: ClientContractCreate,
    current_user=Depends(get_current_user),
    _=Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Create a service contract for a brand client."""
    # Verify client belongs to this LSP
    client = db.exec(
        select(Company).where(
            Company.id == client_id,
            Company.parentId == current_user.companyId,
        )
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found under this LSP")

    # Check no existing contract
    existing = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contract already exists for this client")

    contract = ClientContract(**data.model_dump(exclude_unset=True))
    contract.lspCompanyId = current_user.companyId
    contract.brandCompanyId = client_id
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.patch("/{client_id}/contract", response_model=ClientContractResponse)
async def update_contract(
    client_id: UUID,
    data: ClientContractUpdate,
    current_user=Depends(get_current_user),
    _=Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Update the service contract for a brand client."""
    contract = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contract, key, value)
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


# ── List all contracts (for current LSP) ──────────────────────────────────
@router.get("/contracts/all", response_model=List[ClientContractResponse])
async def list_contracts(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all service contracts for the current LSP."""
    query = select(ClientContract).where(
        ClientContract.lspCompanyId == current_user.companyId
    )
    if status_filter:
        query = query.where(ClientContract.status == status_filter)
    query = query.offset(skip).limit(limit)
    contracts = db.exec(query).all()
    return contracts


# ── Get LSP's warehouses (for contract warehouse assignment) ─────────────
@router.get("/warehouses/available")
async def list_lsp_warehouses(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all warehouses owned by the current LSP (for assigning to brand contracts)."""
    company = db.exec(select(Company).where(Company.id == current_user.companyId)).first()
    if not company or company.companyType != "LSP":
        raise HTTPException(status_code=403, detail="Only LSP companies can list warehouses")

    locations = db.exec(
        select(Location).where(Location.companyId == current_user.companyId)
    ).all()
    return [
        {
            "id": str(loc.id),
            "name": loc.name,
            "code": getattr(loc, "code", None),
            "locationType": getattr(loc, "locationType", None),
            "city": getattr(loc, "city", None),
            "state": getattr(loc, "state", None),
        }
        for loc in locations
    ]


# ── Feature 1: Client Users ─────────────────────────────────────────────

@router.get("/{client_id}/users")
async def list_client_users(
    client_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List users belonging to a specific brand client."""
    client = db.exec(
        select(Company).where(
            Company.id == client_id,
            Company.parentId == current_user.companyId,
        )
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    users = db.exec(
        select(User).where(User.companyId == client_id).order_by(User.createdAt.desc())
    ).all()
    return [
        {
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "isActive": u.isActive,
            "createdAt": u.createdAt.isoformat() if u.createdAt else None,
        }
        for u in users
    ]


# ── Feature 4: Client Dashboard / KPIs ──────────────────────────────────

@router.get("/{client_id}/dashboard")
async def client_dashboard(
    client_id: UUID,
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get KPI dashboard for a brand client."""
    from app.models.order import Order, OrderStatus
    from app.models.inventory import Inventory

    client = db.exec(
        select(Company).where(
            Company.id == client_id,
            Company.parentId == current_user.companyId,
        )
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get locations assigned to this client via contract
    contract = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    warehouse_ids = contract.warehouseIds if contract and contract.warehouseIds else []
    location_uuids = [UUID(wid) for wid in warehouse_ids if wid]

    since = datetime.utcnow() - timedelta(days=days)

    # Base order query
    order_query = select(Order).where(Order.companyId == client_id)
    if location_uuids:
        order_query = order_query.where(Order.locationId.in_(location_uuids))
    orders = db.exec(order_query).all()

    # Period filter
    period_orders = [o for o in orders if o.orderDate and o.orderDate >= since]

    # Stats
    total_orders = len(period_orders)
    revenue = sum(float(o.totalAmount or 0) for o in period_orders)

    status_counts: Dict[str, int] = {}
    delivered = 0
    for o in period_orders:
        s = o.status.value if hasattr(o.status, "value") else str(o.status)
        status_counts[s] = status_counts.get(s, 0) + 1
        if s == "DELIVERED":
            delivered += 1

    fulfillment_rate = round((delivered / total_orders * 100) if total_orders else 0, 1)

    # Daily trend
    daily: Dict[str, int] = {}
    for o in period_orders:
        d = o.orderDate.strftime("%Y-%m-%d") if o.orderDate else "unknown"
        daily[d] = daily.get(d, 0) + 1
    trend = [{"date": k, "count": v} for k, v in sorted(daily.items())]

    # Inventory by warehouse
    inventory_summary = []
    for wid in location_uuids:
        inv = db.exec(
            select(func.sum(Inventory.quantity)).where(Inventory.locationId == wid)
        ).one() or 0
        loc = db.get(Location, wid)
        inventory_summary.append({
            "warehouseId": str(wid),
            "warehouseName": loc.name if loc else str(wid),
            "totalQty": int(inv),
        })

    return {
        "totalOrders": total_orders,
        "revenue": round(revenue, 2),
        "fulfillmentRate": fulfillment_rate,
        "statusCounts": status_counts,
        "orderTrend": trend,
        "inventorySummary": inventory_summary,
        "period": days,
    }


# ── Feature 6: Rate Cards Per Client ────────────────────────────────────

@router.get("/{client_id}/rate-cards")
async def get_client_rate_cards(
    client_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get rate card associations for a brand client."""
    contract = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    config = contract.config or {}
    return {"rateCards": config.get("rateCards", {})}


@router.patch("/{client_id}/rate-cards")
async def update_client_rate_cards(
    client_id: UUID,
    data: dict,
    current_user=Depends(get_current_user),
    _=Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Update rate card associations for a brand client."""
    contract = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    config = contract.config or {}
    config["rateCards"] = data.get("rateCards", {})
    contract.config = config
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return {"rateCards": config.get("rateCards", {})}


# ── Feature 8: SLA Compliance ────────────────────────────────────────────

@router.get("/{client_id}/sla-compliance")
async def get_sla_compliance(
    client_id: UUID,
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get SLA compliance metrics for a brand client."""
    from app.models.order import Order, Delivery

    contract = db.exec(
        select(ClientContract).where(
            ClientContract.lspCompanyId == current_user.companyId,
            ClientContract.brandCompanyId == client_id,
        )
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    sla_config = contract.config.get("slaConfig", {}) if contract.config else {}

    since = datetime.utcnow() - timedelta(days=days)
    orders = db.exec(
        select(Order).where(
            Order.companyId == client_id,
            Order.orderDate >= since,
        )
    ).all()

    total = len(orders)
    delivered = 0
    dispatch_times = []
    for o in orders:
        s = o.status.value if hasattr(o.status, "value") else str(o.status)
        if s == "DELIVERED":
            delivered += 1
        # Approximate dispatch time as time from order to first status change
        if o.updatedAt and o.orderDate:
            diff_hrs = (o.updatedAt - o.orderDate).total_seconds() / 3600
            if diff_hrs > 0:
                dispatch_times.append(diff_hrs)

    avg_dispatch = round(sum(dispatch_times) / len(dispatch_times), 1) if dispatch_times else 0
    accuracy_rate = round((delivered / total * 100) if total else 0, 1)

    return {
        "period": days,
        "totalOrders": total,
        "deliveredOrders": delivered,
        "avgDispatchHours": avg_dispatch,
        "accuracyRate": accuracy_rate,
        "targets": sla_config,
        "compliance": {
            "dispatchHours": {
                "actual": avg_dispatch,
                "target": sla_config.get("targetDispatchHours"),
                "met": avg_dispatch <= sla_config["targetDispatchHours"] if sla_config.get("targetDispatchHours") else None,
            },
            "accuracyRate": {
                "actual": accuracy_rate,
                "target": sla_config.get("targetAccuracyRate"),
                "met": accuracy_rate >= sla_config["targetAccuracyRate"] if sla_config.get("targetAccuracyRate") else None,
            },
        },
    }


# ── Feature 9: Bulk Client Import ────────────────────────────────────────

@router.get("/bulk-import/template")
async def get_import_template(
    current_user=Depends(get_current_user),
):
    """Get CSV template for bulk client import."""
    return {
        "columns": [
            "company_name", "code", "legal_name", "gst", "pan",
            "service_model", "billing_type", "billing_rate",
        ],
        "example": {
            "company_name": "Acme Corp",
            "code": "ACME",
            "legal_name": "Acme Corporation Pvt Ltd",
            "gst": "29ABCDE1234F1Z5",
            "pan": "ABCDE1234F",
            "service_model": "FULL",
            "billing_type": "per_order",
            "billing_rate": "15.00",
        },
    }


@router.post("/bulk-import")
async def bulk_import_clients(
    data: dict,
    current_user=Depends(get_current_user),
    _=Depends(require_admin()),
    db: Session = Depends(get_db),
):
    """Bulk import clients from parsed CSV rows."""
    lsp = db.exec(select(Company).where(Company.id == current_user.companyId)).first()
    if not lsp or lsp.companyType != "LSP":
        raise HTTPException(status_code=403, detail="Only LSP companies can import clients")

    rows = data.get("rows", [])
    results = {"total": len(rows), "created": 0, "errors": []}

    for i, row in enumerate(rows):
        try:
            name = row.get("company_name")
            code = row.get("code")
            if not name or not code:
                results["errors"].append({"row": i + 1, "message": "company_name and code are required"})
                continue

            existing = db.exec(select(Company).where(Company.code == code)).first()
            if existing:
                results["errors"].append({"row": i + 1, "message": f"Company code '{code}' already exists"})
                continue

            company = Company(
                name=name,
                code=code,
                legalName=row.get("legal_name"),
                gst=row.get("gst"),
                pan=row.get("pan"),
                companyType="BRAND",
                parentId=current_user.companyId,
            )
            db.add(company)
            db.flush()

            contract = ClientContract(
                lspCompanyId=current_user.companyId,
                brandCompanyId=company.id,
                serviceModel=row.get("service_model", "FULL"),
                billingType=row.get("billing_type", "per_order"),
                billingRate=float(row.get("billing_rate", 0)),
                status="onboarding",
            )
            db.add(contract)
            results["created"] += 1
        except Exception as e:
            results["errors"].append({"row": i + 1, "message": str(e)})

    if results["created"] > 0:
        db.commit()

    return results
