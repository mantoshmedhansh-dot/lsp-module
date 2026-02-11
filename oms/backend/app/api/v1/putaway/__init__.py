"""
Putaway API v1 - Putaway task management endpoints
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    PutawayTask,
    PutawayTaskCreate,
    PutawayTaskUpdate,
    PutawayTaskAssign,
    PutawayTaskComplete,
    PutawayTaskCancel,
    PutawayTaskResponse,
    PutawayTaskBrief,
    BinSuggestionRequest,
    BinSuggestionResponse,
    BulkPutawayTaskCreate,
    BulkPutawayTaskResponse,
    User, SKU, Bin, Zone, Location,
)
from app.services.putaway import PutawayService


router = APIRouter(prefix="/putaway", tags=["Putaway"])


# ============================================================================
# Helper Functions
# ============================================================================

def build_task_response(task: PutawayTask, session: Session) -> PutawayTaskResponse:
    """Build task response with related info."""
    response = PutawayTaskResponse(
        id=task.id,
        taskNo=task.taskNo,
        goodsReceiptId=task.goodsReceiptId,
        goodsReceiptItemId=task.goodsReceiptItemId,
        skuId=task.skuId,
        quantity=task.quantity,
        batchNo=task.batchNo,
        lotNo=task.lotNo,
        expiryDate=task.expiryDate,
        fromBinId=task.fromBinId,
        toBinId=task.toBinId,
        actualBinId=task.actualBinId,
        actualQty=task.actualQty,
        status=task.status,
        priority=task.priority,
        assignedToId=task.assignedToId,
        assignedAt=task.assignedAt,
        startedAt=task.startedAt,
        completedAt=task.completedAt,
        cancelledAt=task.cancelledAt,
        cancellationReason=task.cancellationReason,
        notes=task.notes,
        locationId=task.locationId,
        companyId=task.companyId,
        createdAt=task.createdAt,
        updatedAt=task.updatedAt
    )

    # Get SKU info
    sku = session.exec(select(SKU).where(SKU.id == task.skuId)).first()
    if sku:
        response.skuCode = sku.code
        response.skuName = sku.name

    # Get from bin info
    if task.fromBinId:
        from_bin = session.exec(select(Bin).where(Bin.id == task.fromBinId)).first()
        if from_bin:
            response.fromBinCode = from_bin.code

    # Get to bin info
    to_bin = session.exec(select(Bin).where(Bin.id == task.toBinId)).first()
    if to_bin:
        response.toBinCode = to_bin.code

    # Get actual bin info
    if task.actualBinId:
        actual_bin = session.exec(select(Bin).where(Bin.id == task.actualBinId)).first()
        if actual_bin:
            response.actualBinCode = actual_bin.code

    # Get assigned user info
    if task.assignedToId:
        assigned_user = session.exec(select(User).where(User.id == task.assignedToId)).first()
        if assigned_user:
            response.assignedToName = assigned_user.name

    # Get location info
    location = session.exec(select(Location).where(Location.id == task.locationId)).first()
    if location:
        response.locationName = location.name

    return response


def build_task_brief(task: PutawayTask, session: Session) -> PutawayTaskBrief:
    """Build brief task response."""
    brief = PutawayTaskBrief(
        id=task.id,
        taskNo=task.taskNo,
        quantity=task.quantity,
        status=task.status,
        priority=task.priority,
        createdAt=task.createdAt
    )

    # Get SKU info
    sku = session.exec(select(SKU).where(SKU.id == task.skuId)).first()
    if sku:
        brief.skuCode = sku.code
        brief.skuName = sku.name

    # Get to bin info
    to_bin = session.exec(select(Bin).where(Bin.id == task.toBinId)).first()
    if to_bin:
        brief.toBinCode = to_bin.code

    # Get assigned user info
    if task.assignedToId:
        assigned_user = session.exec(select(User).where(User.id == task.assignedToId)).first()
        if assigned_user:
            brief.assignedToName = assigned_user.name

    return brief


# ============================================================================
# Task List Endpoints
# ============================================================================

@router.get("/tasks", response_model=List[PutawayTaskResponse])
def list_putaway_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    assigned_to_id: Optional[UUID] = None,
    goods_receipt_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List putaway tasks with filters."""
    query = select(PutawayTask)

    # Apply company filter
    query = company_filter.apply_filter(query, PutawayTask.companyId)

    # Apply filters
    if status:
        query = query.where(PutawayTask.status == status)
    if location_id:
        query = query.where(PutawayTask.locationId == location_id)
    if assigned_to_id:
        query = query.where(PutawayTask.assignedToId == assigned_to_id)
    if goods_receipt_id:
        query = query.where(PutawayTask.goodsReceiptId == goods_receipt_id)

    # Order by priority and creation date
    query = query.order_by(PutawayTask.priority, PutawayTask.createdAt.desc())
    query = query.offset(skip).limit(limit)

    tasks = session.exec(query).all()
    return [build_task_response(task, session) for task in tasks]


@router.get("/tasks/count")
def count_putaway_tasks(
    status: Optional[str] = None,
    location_id: Optional[UUID] = None,
    assigned_to_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get count of putaway tasks."""
    query = select(func.count(PutawayTask.id))

    query = company_filter.apply_filter(query, PutawayTask.companyId)
    if status:
        query = query.where(PutawayTask.status == status)
    if location_id:
        query = query.where(PutawayTask.locationId == location_id)
    if assigned_to_id:
        query = query.where(PutawayTask.assignedToId == assigned_to_id)

    count = session.exec(query).one()
    return {"count": count}


@router.get("/tasks/summary")
def get_putaway_summary(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get summary of putaway tasks."""
    service = PutawayService(session)
    return service.get_task_summary(
        location_id=location_id,
        company_id=company_filter.company_id
    )


@router.get("/tasks/my-tasks", response_model=List[PutawayTaskBrief])
def get_my_putaway_tasks(
    limit: int = Query(20, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get putaway tasks assigned to current user."""
    service = PutawayService(session)
    tasks = service.get_pending_tasks(
        company_id=company_filter.company_id,
        assigned_to_id=current_user.id,
        limit=limit
    )
    return [build_task_brief(task, session) for task in tasks]


# ============================================================================
# Task CRUD Endpoints
# ============================================================================

@router.post("/tasks", response_model=PutawayTaskResponse)
def create_putaway_task(
    data: PutawayTaskCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new putaway task."""
    company_id = company_filter.company_id
    if not company_id:
        # Get from location
        location = session.exec(
            select(Location).where(Location.id == data.locationId)
        ).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine company"
        )

    # Validate SKU
    sku = session.exec(select(SKU).where(SKU.id == data.skuId)).first()
    if not sku:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU not found"
        )

    # Validate target bin
    to_bin = session.exec(select(Bin).where(Bin.id == data.toBinId)).first()
    if not to_bin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target bin not found"
        )

    # Generate task number
    service = PutawayService(session)
    task_no = service.generate_task_no(company_id)

    # Create task
    from datetime import datetime
    from uuid import uuid4

    task = PutawayTask(
        id=uuid4(),
        taskNo=task_no,
        goodsReceiptId=data.goodsReceiptId,
        goodsReceiptItemId=data.goodsReceiptItemId,
        skuId=data.skuId,
        quantity=data.quantity,
        batchNo=data.batchNo,
        lotNo=data.lotNo,
        expiryDate=data.expiryDate,
        fromBinId=data.fromBinId,
        toBinId=data.toBinId,
        status="PENDING",
        priority=data.priority,
        notes=data.notes,
        locationId=data.locationId,
        companyId=company_id,
        createdById=current_user.id,
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow()
    )

    session.add(task)
    session.commit()
    session.refresh(task)

    return build_task_response(task, session)


@router.get("/tasks/{task_id}", response_model=PutawayTaskResponse)
def get_putaway_task(
    task_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific putaway task."""
    query = select(PutawayTask).where(PutawayTask.id == task_id)

    query = company_filter.apply_filter(query, PutawayTask.companyId)

    task = session.exec(query).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Putaway task not found"
        )

    return build_task_response(task, session)


@router.patch("/tasks/{task_id}", response_model=PutawayTaskResponse)
def update_putaway_task(
    task_id: UUID,
    data: PutawayTaskUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a putaway task."""
    query = select(PutawayTask).where(PutawayTask.id == task_id)

    query = company_filter.apply_filter(query, PutawayTask.companyId)

    task = session.exec(query).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Putaway task not found"
        )

    if task.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update completed or cancelled task"
        )

    # Update fields
    from datetime import datetime

    if data.toBinId is not None:
        # Validate new target bin
        to_bin = session.exec(select(Bin).where(Bin.id == data.toBinId)).first()
        if not to_bin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target bin not found"
            )
        task.toBinId = data.toBinId

    if data.priority is not None:
        task.priority = data.priority

    if data.notes is not None:
        task.notes = data.notes

    task.updatedAt = datetime.utcnow()

    session.add(task)
    session.commit()
    session.refresh(task)

    return build_task_response(task, session)


# ============================================================================
# Task Workflow Endpoints
# ============================================================================

@router.post("/tasks/{task_id}/assign", response_model=PutawayTaskResponse)
def assign_putaway_task(
    task_id: UUID,
    data: PutawayTaskAssign,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Assign a putaway task to a user."""
    # Validate user exists
    assigned_user = session.exec(select(User).where(User.id == data.assignedToId)).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    service = PutawayService(session)
    task = service.assign_task(
        task_id=task_id,
        assigned_to_id=data.assignedToId,
        assigned_by_id=current_user.id
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not assign task. Task may not exist or is not in assignable status."
        )

    return build_task_response(task, session)


@router.post("/tasks/{task_id}/start", response_model=PutawayTaskResponse)
def start_putaway_task(
    task_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start working on a putaway task."""
    service = PutawayService(session)
    task = service.start_task(task_id=task_id, user_id=current_user.id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not start task. Task may not exist or is already started/completed."
        )

    return build_task_response(task, session)


@router.post("/tasks/{task_id}/complete", response_model=PutawayTaskResponse)
def complete_putaway_task(
    task_id: UUID,
    data: PutawayTaskComplete,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete a putaway task."""
    # Validate actual bin if provided
    if data.actualBinId:
        actual_bin = session.exec(select(Bin).where(Bin.id == data.actualBinId)).first()
        if not actual_bin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Actual bin not found"
            )

    service = PutawayService(session)
    task = service.complete_task(
        task_id=task_id,
        completed_by_id=current_user.id,
        actual_bin_id=data.actualBinId,
        actual_qty=data.actualQty,
        notes=data.notes
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not complete task. Task may not exist or is already completed/cancelled."
        )

    return build_task_response(task, session)


@router.post("/tasks/{task_id}/cancel", response_model=PutawayTaskResponse)
def cancel_putaway_task(
    task_id: UUID,
    data: PutawayTaskCancel,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Cancel a putaway task."""
    service = PutawayService(session)
    task = service.cancel_task(
        task_id=task_id,
        cancelled_by_id=current_user.id,
        reason=data.reason
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not cancel task. Task may not exist or is already completed/cancelled."
        )

    return build_task_response(task, session)


# ============================================================================
# Bin Suggestion Endpoint
# ============================================================================

@router.post("/suggest-bin", response_model=BinSuggestionResponse)
def suggest_bin(
    data: BinSuggestionRequest,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get bin suggestions for putaway."""
    company_id = company_filter.company_id
    if not company_id:
        # Get from location
        location = session.exec(
            select(Location).where(Location.id == data.locationId)
        ).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine company"
        )

    service = PutawayService(session)
    return service.suggest_bin(data, company_id)


# ============================================================================
# Bulk Operations
# ============================================================================

@router.post("/tasks/bulk-create", response_model=BulkPutawayTaskResponse)
def bulk_create_putaway_tasks(
    data: BulkPutawayTaskCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create putaway tasks from a goods receipt."""
    from app.models import GoodsReceipt

    # Validate goods receipt
    gr = session.exec(
        select(GoodsReceipt).where(GoodsReceipt.id == data.goodsReceiptId)
    ).first()

    if not gr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goods receipt not found"
        )

    if gr.status != "POSTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Goods receipt must be posted before creating putaway tasks"
        )

    company_id = company_filter.company_id or gr.companyId

    service = PutawayService(session)
    tasks = service.create_tasks_from_goods_receipt(
        goods_receipt_id=data.goodsReceiptId,
        auto_suggest_bins=data.autoSuggestBins,
        created_by_id=current_user.id,
        company_id=company_id
    )

    return BulkPutawayTaskResponse(
        success=True,
        tasksCreated=len(tasks),
        tasks=[build_task_response(task, session) for task in tasks],
        errors=[]
    )


@router.post("/tasks/bulk-assign")
def bulk_assign_putaway_tasks(
    task_ids: List[UUID],
    assigned_to_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Bulk assign multiple putaway tasks."""
    # Validate user exists
    assigned_user = session.exec(select(User).where(User.id == assigned_to_id)).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    service = PutawayService(session)
    assigned_count = 0
    errors = []

    for task_id in task_ids:
        try:
            task = service.assign_task(
                task_id=task_id,
                assigned_to_id=assigned_to_id,
                assigned_by_id=current_user.id
            )
            if task:
                assigned_count += 1
            else:
                errors.append(f"Task {task_id}: Could not assign")
        except Exception as e:
            errors.append(f"Task {task_id}: {str(e)}")

    return {
        "success": assigned_count > 0,
        "assignedCount": assigned_count,
        "totalRequested": len(task_ids),
        "errors": errors
    }


# ============================================================================
# Goods Receipt Integration
# ============================================================================

@router.get("/goods-receipt/{goods_receipt_id}/tasks", response_model=List[PutawayTaskBrief])
def get_goods_receipt_tasks(
    goods_receipt_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get putaway tasks for a goods receipt."""
    query = select(PutawayTask).where(PutawayTask.goodsReceiptId == goods_receipt_id)

    query = company_filter.apply_filter(query, PutawayTask.companyId)

    query = query.order_by(PutawayTask.createdAt)
    tasks = session.exec(query).all()

    return [build_task_brief(task, session) for task in tasks]
