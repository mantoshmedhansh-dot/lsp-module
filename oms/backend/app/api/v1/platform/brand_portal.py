"""
Brand Portal API - Self-service endpoints for brand (client) users
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.deps import get_db, get_current_user
from app.models.company import Company, Location
from app.models.client_contract import ClientContract

router = APIRouter(prefix="/brand-portal", tags=["Brand Portal"])


@router.get("/my-contract")
async def get_my_contract(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the current brand user's contract, LSP info, and assigned warehouses.
    For brand users only.
    """
    company = db.exec(
        select(Company).where(Company.id == current_user.companyId)
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if company.companyType != "BRAND" or not company.parentId:
        raise HTTPException(status_code=403, detail="Only brand users can access this endpoint")

    # Get LSP info
    lsp = db.exec(select(Company).where(Company.id == company.parentId)).first()

    # Get contract
    contract = db.exec(
        select(ClientContract).where(
            ClientContract.brandCompanyId == company.id,
            ClientContract.lspCompanyId == company.parentId,
        )
    ).first()

    # Get assigned warehouses
    warehouses = []
    if contract and contract.warehouseIds:
        for wid in contract.warehouseIds:
            try:
                loc = db.get(Location, UUID(wid))
                if loc:
                    warehouses.append({
                        "id": str(loc.id),
                        "name": loc.name,
                        "code": getattr(loc, "code", None),
                        "city": getattr(loc, "city", None),
                        "state": getattr(loc, "state", None),
                    })
            except (ValueError, TypeError):
                continue

    return {
        "company": {
            "id": str(company.id),
            "name": company.name,
            "code": company.code,
            "companyType": company.companyType,
        },
        "lsp": {
            "id": str(lsp.id) if lsp else None,
            "name": lsp.name if lsp else None,
            "code": lsp.code if lsp else None,
        } if lsp else None,
        "contract": {
            "id": str(contract.id),
            "serviceModel": contract.serviceModel,
            "status": contract.status,
            "contractStart": contract.contractStart.isoformat() if contract.contractStart else None,
            "contractEnd": contract.contractEnd.isoformat() if contract.contractEnd else None,
            "billingType": contract.billingType,
            "billingRate": float(contract.billingRate) if contract.billingRate else None,
            "modules": contract.modules or [],
            "config": contract.config or {},
        } if contract else None,
        "warehouses": warehouses,
    }
