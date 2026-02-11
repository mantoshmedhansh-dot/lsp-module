"""
Plans API - Public plan listing and SUPER_ADMIN management
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.models.plan import (
    Plan, PlanModule, PlanLimit,
    PlanResponse, PlanBrief, PlanCreate, PlanUpdate,
    PlanModuleResponse, PlanModuleCreate,
    PlanLimitResponse, PlanLimitCreate, PlanLimitUpdate,
)

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get("", response_model=List[PlanResponse])
def list_plans(
    active_only: bool = Query(True),
    session: Session = Depends(get_session),
):
    """List all available plans (public endpoint)."""
    query = select(Plan).order_by(Plan.sortOrder)
    if active_only:
        query = query.where(Plan.isActive == True)

    plans = session.exec(query).all()
    result = []
    for plan in plans:
        modules = session.exec(
            select(PlanModule).where(PlanModule.planId == plan.id)
        ).all()
        limits = session.exec(
            select(PlanLimit).where(PlanLimit.planId == plan.id)
        ).all()

        plan_resp = PlanResponse.model_validate(plan)
        plan_resp.modules = [PlanModuleResponse.model_validate(m) for m in modules]
        plan_resp.limits = [PlanLimitResponse.model_validate(l) for l in limits]
        result.append(plan_resp)

    return result


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: UUID,
    session: Session = Depends(get_session),
):
    """Get a specific plan by ID (public endpoint)."""
    plan = session.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    modules = session.exec(
        select(PlanModule).where(PlanModule.planId == plan.id)
    ).all()
    limits = session.exec(
        select(PlanLimit).where(PlanLimit.planId == plan.id)
    ).all()

    plan_resp = PlanResponse.model_validate(plan)
    plan_resp.modules = [PlanModuleResponse.model_validate(m) for m in modules]
    plan_resp.limits = [PlanLimitResponse.model_validate(l) for l in limits]
    return plan_resp


@router.post("", response_model=PlanResponse, status_code=201)
def create_plan(
    data: PlanCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Create a new plan (SUPER_ADMIN only)."""
    existing = session.exec(
        select(Plan).where(Plan.slug == data.slug)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plan with this slug already exists")

    plan = Plan.model_validate(data)
    session.add(plan)
    session.flush()
    return PlanResponse.model_validate(plan)


@router.patch("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: UUID,
    data: PlanUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Update a plan (SUPER_ADMIN only)."""
    plan = session.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plan, key, value)

    session.add(plan)
    session.flush()
    return PlanResponse.model_validate(plan)


@router.post("/{plan_id}/modules", response_model=PlanModuleResponse, status_code=201)
def add_plan_module(
    plan_id: UUID,
    data: PlanModuleCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Add a module to a plan (SUPER_ADMIN only)."""
    plan = session.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    data.planId = plan_id
    module = PlanModule.model_validate(data)
    session.add(module)
    session.flush()
    return PlanModuleResponse.model_validate(module)


@router.delete("/{plan_id}/modules/{module_id}", status_code=204)
def remove_plan_module(
    plan_id: UUID,
    module_id: UUID,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Remove a module from a plan (SUPER_ADMIN only)."""
    module = session.get(PlanModule, module_id)
    if not module or module.planId != plan_id:
        raise HTTPException(status_code=404, detail="Module not found")
    session.delete(module)


@router.post("/{plan_id}/limits", response_model=PlanLimitResponse, status_code=201)
def add_plan_limit(
    plan_id: UUID,
    data: PlanLimitCreate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Add a limit to a plan (SUPER_ADMIN only)."""
    plan = session.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    data.planId = plan_id
    limit = PlanLimit.model_validate(data)
    session.add(limit)
    session.flush()
    return PlanLimitResponse.model_validate(limit)


@router.patch("/{plan_id}/limits/{limit_id}", response_model=PlanLimitResponse)
def update_plan_limit(
    plan_id: UUID,
    limit_id: UUID,
    data: PlanLimitUpdate,
    session: Session = Depends(get_session),
    _: None = Depends(require_roles(["SUPER_ADMIN"])),
):
    """Update a plan limit (SUPER_ADMIN only)."""
    limit = session.get(PlanLimit, limit_id)
    if not limit or limit.planId != plan_id:
        raise HTTPException(status_code=404, detail="Limit not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(limit, key, value)

    session.add(limit)
    session.flush()
    return PlanLimitResponse.model_validate(limit)
