"""
Client Management API - LSP manages brand clients and contracts
"""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.deps import get_db, get_current_user, require_admin
from app.models.company import Company, CompanyCreate, CompanyResponse, Location
from app.models.client_contract import (
    ClientContract,
    ClientContractCreate,
    ClientContractUpdate,
    ClientContractResponse,
)

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
