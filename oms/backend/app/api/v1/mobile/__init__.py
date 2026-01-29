"""
Mobile WMS API v1 - Mobile device operations, barcode scanning, offline sync
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, Location, SKU, Bin, Inventory,
    MobileDevice, MobileDeviceRegister, MobileDeviceResponse,
    MobileConfig, MobileConfigResponse,
    DeviceLocationLog,
    BarcodeScanLog,
    MobileSession, MobileSessionResponse,
    MobileTask, MobileTaskCreate, MobileTaskResponse,
    MobileTaskLine,
    OfflineSyncQueue, OfflineSyncQueueResponse,
    SyncCheckpoint,
    SyncConflict, SyncConflictResponse,
    SyncBatch,
    DeviceStatus, SessionStatus, TaskStatus, SyncStatus,
)


router = APIRouter(prefix="/mobile", tags=["Mobile WMS"])


# ============================================================================
# Device Registration
# ============================================================================

@router.post("/register", response_model=MobileDeviceResponse, status_code=status.HTTP_201_CREATED)
def register_device(
    data: MobileDeviceRegister,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Register a mobile device"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Check if device already registered
    existing = session.exec(
        select(MobileDevice)
        .where(MobileDevice.deviceId == data.deviceId)
        .where(MobileDevice.companyId == company_filter.company_id)
    ).first()

    if existing:
        # Update existing device
        existing.deviceName = data.deviceName
        existing.platform = data.platform
        existing.osVersion = data.osVersion
        existing.appVersion = data.appVersion
        existing.lastActiveAt = datetime.utcnow()
        existing.status = DeviceStatus.ACTIVE
        existing.updatedAt = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    from uuid import uuid4
    device = MobileDevice(
        id=uuid4(),
        companyId=company_filter.company_id,
        registeredById=current_user.id,
        status=DeviceStatus.ACTIVE,
        **data.model_dump()
    )
    session.add(device)
    session.commit()
    session.refresh(device)
    return device


@router.get("/devices", response_model=List[MobileDeviceResponse])
def list_devices(
    status: Optional[DeviceStatus] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List registered devices"""
    query = select(MobileDevice)

    if company_filter.company_id:
        query = query.where(MobileDevice.companyId == company_filter.company_id)
    if status:
        query = query.where(MobileDevice.status == status)
    if location_id:
        query = query.where(MobileDevice.assignedLocationId == location_id)

    devices = session.exec(query).all()
    return devices


@router.patch("/devices/{device_id}/assign")
def assign_device_to_location(
    device_id: UUID,
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Assign device to a location"""
    device = session.exec(select(MobileDevice).where(MobileDevice.id == device_id)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.assignedLocationId = location_id
    device.updatedAt = datetime.utcnow()
    session.add(device)
    session.commit()

    return {"success": True, "message": "Device assigned to location"}


# ============================================================================
# Device Authentication
# ============================================================================

@router.post("/auth")
def authenticate_device(
    device_id: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Authenticate a mobile device session"""
    from uuid import uuid4

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    device = session.exec(
        select(MobileDevice)
        .where(MobileDevice.deviceId == device_id)
        .where(MobileDevice.companyId == company_filter.company_id)
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not registered")

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Device is not active")

    # Create session
    mobile_session = MobileSession(
        id=uuid4(),
        companyId=company_filter.company_id,
        deviceId=device.id,
        userId=current_user.id,
        status=SessionStatus.ACTIVE,
        startedAt=datetime.utcnow()
    )
    session.add(mobile_session)

    device.lastActiveAt = datetime.utcnow()
    device.assignedUserId = current_user.id
    session.add(device)

    session.commit()

    return {
        "success": True,
        "sessionId": str(mobile_session.id),
        "deviceId": str(device.id),
        "locationId": str(device.assignedLocationId) if device.assignedLocationId else None
    }


# ============================================================================
# Barcode Scanning
# ============================================================================

@router.post("/scan")
def process_barcode_scan(
    barcode: str,
    scan_type: str = "SKU",
    device_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Process a barcode scan"""
    from uuid import uuid4

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    result = None
    entity_type = None
    entity_id = None

    if scan_type == "SKU":
        sku = session.exec(
            select(SKU)
            .where(SKU.barcode == barcode)
            .where(SKU.companyId == company_filter.company_id)
        ).first()
        if sku:
            result = {
                "type": "SKU",
                "id": str(sku.id),
                "code": sku.code,
                "name": sku.name,
                "barcode": sku.barcode
            }
            entity_type = "SKU"
            entity_id = sku.id
    elif scan_type == "BIN":
        bin_ = session.exec(
            select(Bin)
            .where(Bin.barcode == barcode)
            .where(Bin.companyId == company_filter.company_id)
        ).first()
        if bin_:
            result = {
                "type": "BIN",
                "id": str(bin_.id),
                "code": bin_.code,
                "barcode": bin_.barcode
            }
            entity_type = "BIN"
            entity_id = bin_.id

    # Log scan
    scan_log = BarcodeScanLog(
        id=uuid4(),
        companyId=company_filter.company_id,
        deviceId=device_id,
        userId=current_user.id,
        barcode=barcode,
        scanType=scan_type,
        resolvedEntityType=entity_type,
        resolvedEntityId=entity_id,
        isSuccessful=result is not None
    )
    session.add(scan_log)
    session.commit()

    if not result:
        return {"success": False, "message": f"Barcode not found: {barcode}"}

    return {"success": True, "data": result}


# ============================================================================
# Tasks
# ============================================================================

@router.get("/tasks", response_model=List[MobileTaskResponse])
def list_mobile_tasks(
    status: Optional[TaskStatus] = None,
    task_type: Optional[str] = None,
    assigned_to_me: bool = True,
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get mobile tasks"""
    query = select(MobileTask)

    if company_filter.company_id:
        query = query.where(MobileTask.companyId == company_filter.company_id)
    if status:
        query = query.where(MobileTask.status == status)
    if task_type:
        query = query.where(MobileTask.taskType == task_type)
    if assigned_to_me:
        query = query.where(MobileTask.assignedToId == current_user.id)

    query = query.order_by(MobileTask.priority.desc(), MobileTask.createdAt).limit(limit)
    tasks = session.exec(query).all()
    return tasks


@router.post("/tasks", response_model=MobileTaskResponse, status_code=status.HTTP_201_CREATED)
def create_mobile_task(
    data: MobileTaskCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a mobile task"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4

    task = MobileTask(
        id=uuid4(),
        companyId=company_filter.company_id,
        status=TaskStatus.PENDING,
        **data.model_dump()
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/tasks/{task_id}/start", response_model=MobileTaskResponse)
def start_task(
    task_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start working on a task"""
    task = session.exec(select(MobileTask).where(MobileTask.id == task_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != TaskStatus.PENDING and task.status != TaskStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Task cannot be started")

    task.status = TaskStatus.IN_PROGRESS
    task.startedAt = datetime.utcnow()
    task.updatedAt = datetime.utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/tasks/{task_id}/complete", response_model=MobileTaskResponse)
def complete_task(
    task_id: UUID,
    notes: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete a task"""
    task = session.exec(select(MobileTask).where(MobileTask.id == task_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Task is not in progress")

    task.status = TaskStatus.COMPLETED
    task.completedAt = datetime.utcnow()
    if notes:
        task.notes = notes
    task.updatedAt = datetime.utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


# ============================================================================
# Inventory Lookup
# ============================================================================

@router.get("/inventory/lookup")
def lookup_inventory(
    sku_id: Optional[UUID] = None,
    barcode: Optional[str] = None,
    bin_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Quick inventory lookup for mobile"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Resolve SKU from barcode if needed
    if barcode and not sku_id:
        sku = session.exec(
            select(SKU)
            .where(SKU.barcode == barcode)
            .where(SKU.companyId == company_filter.company_id)
        ).first()
        if sku:
            sku_id = sku.id

    if not sku_id:
        raise HTTPException(status_code=400, detail="SKU ID or barcode required")

    query = select(Inventory).where(
        Inventory.skuId == sku_id,
        Inventory.companyId == company_filter.company_id
    )

    if bin_id:
        query = query.where(Inventory.binId == bin_id)
    if location_id:
        query = query.where(Inventory.locationId == location_id)

    inventory = session.exec(query).all()

    results = []
    for inv in inventory:
        bin_ = session.exec(select(Bin).where(Bin.id == inv.binId)).first()
        results.append({
            "binId": str(inv.binId),
            "binCode": bin_.code if bin_ else None,
            "quantity": inv.quantity,
            "availableQty": inv.availableQty,
            "reservedQty": inv.reservedQty
        })

    return {
        "skuId": str(sku_id),
        "totalQuantity": sum(r["quantity"] for r in results),
        "locations": results
    }


# ============================================================================
# Putaway
# ============================================================================

@router.post("/putaway")
def mobile_putaway(
    sku_id: UUID,
    bin_id: UUID,
    quantity: int,
    lot_no: Optional[str] = None,
    device_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Execute putaway from mobile device"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Validate SKU and Bin
    sku = session.exec(select(SKU).where(SKU.id == sku_id)).first()
    bin_ = session.exec(select(Bin).where(Bin.id == bin_id)).first()

    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    if not bin_:
        raise HTTPException(status_code=404, detail="Bin not found")

    # Update or create inventory
    existing = session.exec(
        select(Inventory)
        .where(Inventory.skuId == sku_id)
        .where(Inventory.binId == bin_id)
        .where(Inventory.companyId == company_filter.company_id)
    ).first()

    if existing:
        existing.quantity += quantity
        existing.availableQty += quantity
        existing.updatedAt = datetime.utcnow()
        session.add(existing)
    else:
        from uuid import uuid4
        inv = Inventory(
            id=uuid4(),
            companyId=company_filter.company_id,
            skuId=sku_id,
            binId=bin_id,
            locationId=bin_.locationId,
            quantity=quantity,
            availableQty=quantity,
            reservedQty=0
        )
        session.add(inv)

    session.commit()

    return {
        "success": True,
        "message": f"Put away {quantity} units of {sku.code} to {bin_.code}"
    }


# ============================================================================
# Picking
# ============================================================================

@router.post("/pick")
def mobile_pick(
    sku_id: UUID,
    bin_id: UUID,
    quantity: int,
    order_id: Optional[UUID] = None,
    device_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Execute pick from mobile device"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Find inventory
    inventory = session.exec(
        select(Inventory)
        .where(Inventory.skuId == sku_id)
        .where(Inventory.binId == bin_id)
        .where(Inventory.companyId == company_filter.company_id)
    ).first()

    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found at this location")

    if inventory.availableQty < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient quantity. Available: {inventory.availableQty}"
        )

    inventory.quantity -= quantity
    inventory.availableQty -= quantity
    inventory.updatedAt = datetime.utcnow()
    session.add(inventory)
    session.commit()

    return {
        "success": True,
        "message": f"Picked {quantity} units",
        "remainingQty": inventory.quantity
    }


# ============================================================================
# Cycle Count
# ============================================================================

@router.post("/cycle-count")
def mobile_cycle_count(
    bin_id: UUID,
    sku_id: UUID,
    counted_qty: int,
    device_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Submit cycle count from mobile device"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    inventory = session.exec(
        select(Inventory)
        .where(Inventory.skuId == sku_id)
        .where(Inventory.binId == bin_id)
        .where(Inventory.companyId == company_filter.company_id)
    ).first()

    system_qty = inventory.quantity if inventory else 0
    variance = counted_qty - system_qty

    # Update inventory if exists
    if inventory:
        inventory.quantity = counted_qty
        inventory.availableQty = counted_qty - inventory.reservedQty
        inventory.updatedAt = datetime.utcnow()
        session.add(inventory)
        session.commit()

    return {
        "success": True,
        "systemQty": system_qty,
        "countedQty": counted_qty,
        "variance": variance,
        "adjusted": inventory is not None
    }


# ============================================================================
# Offline Sync
# ============================================================================

@router.post("/sync/pull")
def pull_sync_data(
    device_id: UUID,
    last_sync_at: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Pull data for offline sync"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Get pending tasks
    tasks = session.exec(
        select(MobileTask)
        .where(MobileTask.companyId == company_filter.company_id)
        .where(MobileTask.assignedToId == current_user.id)
        .where(MobileTask.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED]))
    ).all()

    # Get recent SKUs (for lookup)
    skus = session.exec(
        select(SKU)
        .where(SKU.companyId == company_filter.company_id)
        .where(SKU.isActive == True)
        .limit(1000)
    ).all()

    # Update checkpoint
    from uuid import uuid4
    checkpoint = SyncCheckpoint(
        id=uuid4(),
        companyId=company_filter.company_id,
        deviceId=device_id,
        userId=current_user.id,
        lastSyncAt=datetime.utcnow(),
        syncDirection="PULL",
        recordsCount=len(tasks) + len(skus)
    )
    session.add(checkpoint)
    session.commit()

    return {
        "success": True,
        "syncedAt": datetime.utcnow().isoformat(),
        "data": {
            "tasks": [t.model_dump() for t in tasks],
            "skuCount": len(skus)
        }
    }


@router.post("/sync/push")
def push_sync_data(
    device_id: UUID,
    operations: List[dict],
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Push offline operations to server"""
    from uuid import uuid4

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Create sync batch
    batch = SyncBatch(
        id=uuid4(),
        companyId=company_filter.company_id,
        deviceId=device_id,
        userId=current_user.id,
        totalOperations=len(operations),
        status=SyncStatus.PROCESSING,
        startedAt=datetime.utcnow()
    )
    session.add(batch)

    processed = 0
    errors = []

    for op in operations:
        try:
            # Create queue entry
            queue_entry = OfflineSyncQueue(
                id=uuid4(),
                companyId=company_filter.company_id,
                deviceId=device_id,
                batchId=batch.id,
                operationType=op.get("type", "UNKNOWN"),
                entityType=op.get("entityType"),
                entityId=op.get("entityId"),
                payload=op.get("data", {}),
                status=SyncStatus.COMPLETED,
                processedAt=datetime.utcnow()
            )
            session.add(queue_entry)
            processed += 1
        except Exception as e:
            errors.append({"operation": op, "error": str(e)})

    batch.successfulOperations = processed
    batch.failedOperations = len(errors)
    batch.status = SyncStatus.COMPLETED if not errors else SyncStatus.PARTIAL
    batch.completedAt = datetime.utcnow()
    session.add(batch)
    session.commit()

    return {
        "success": True,
        "batchId": str(batch.id),
        "processed": processed,
        "failed": len(errors),
        "errors": errors
    }


@router.get("/sync/conflicts", response_model=List[SyncConflictResponse])
def get_sync_conflicts(
    device_id: Optional[UUID] = None,
    is_resolved: bool = False,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get sync conflicts"""
    query = select(SyncConflict).where(SyncConflict.isResolved == is_resolved)

    if company_filter.company_id:
        query = query.where(SyncConflict.companyId == company_filter.company_id)
    if device_id:
        query = query.where(SyncConflict.deviceId == device_id)

    conflicts = session.exec(query).all()
    return conflicts


@router.post("/sync/conflicts/{conflict_id}/resolve")
def resolve_sync_conflict(
    conflict_id: UUID,
    resolution: str,  # "USE_SERVER" or "USE_CLIENT"
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Resolve a sync conflict"""
    conflict = session.exec(select(SyncConflict).where(SyncConflict.id == conflict_id)).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")

    conflict.isResolved = True
    conflict.resolution = resolution
    conflict.resolvedById = current_user.id
    conflict.resolvedAt = datetime.utcnow()
    session.add(conflict)
    session.commit()

    return {"success": True, "message": f"Conflict resolved using {resolution}"}
