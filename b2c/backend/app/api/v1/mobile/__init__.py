"""
Mobile WMS API Endpoints
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.core.security import create_access_token
from app.models.mobile_device import (
    MobileDevice, MobileConfig, DeviceLocationLog, BarcodeScanLog,
    DeviceStatus, DeviceType, ScanType,
    MobileDeviceRegister, MobileDeviceAuth, MobileDeviceResponse,
    MobileDeviceAuthResponse, BarcodeScanRequest, BarcodeScanResponse,
    MobileConfigUpdate
)
from app.models.mobile_session import (
    MobileSession, MobileTask, MobileTaskLine,
    SessionStatus, TaskStatus, TaskType, TaskPriority,
    MobileSessionCreate, MobileSessionResponse,
    MobileTaskCreate, MobileTaskResponse, MobileTaskLineResponse,
    TaskCompleteRequest, InventoryLookupRequest, InventoryLookupResponse,
    PutawayRequest, PutawayResponse, PickRequest, PickResponse,
    CycleCountRequest, CycleCountResponse
)
from app.models.offline_sync import (
    SyncEntityType, SyncStatus,
    SyncPullRequest, SyncPullResponse,
    SyncPushRequest, SyncPushResponse, SyncStatusResponse,
    ConflictResolutionRequest, ConflictResolutionResponse
)
from app.services.mobile_sync import mobile_sync_service

router = APIRouter()


# ==================== Device Registration ====================

@router.post("/register", response_model=MobileDeviceResponse)
async def register_device(
    device: MobileDeviceRegister,
    db: Session = Depends(get_session)
):
    """Register a new mobile device."""
    # Check if device already exists
    statement = select(MobileDevice).where(MobileDevice.deviceId == device.deviceId)
    existing = db.exec(statement).first()

    if existing:
        # Update existing device
        existing.deviceName = device.deviceName
        existing.deviceType = device.deviceType
        existing.manufacturer = device.manufacturer
        existing.model = device.model
        existing.osVersion = device.osVersion
        existing.appVersion = device.appVersion
        existing.capabilities = device.capabilities
        existing.status = DeviceStatus.PENDING
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    # Create new device
    new_device = MobileDevice(
        deviceId=device.deviceId,
        deviceName=device.deviceName,
        deviceType=device.deviceType,
        manufacturer=device.manufacturer,
        model=device.model,
        osVersion=device.osVersion,
        appVersion=device.appVersion,
        warehouseId=device.warehouseId,
        capabilities=device.capabilities,
        status=DeviceStatus.PENDING
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return new_device


@router.post("/auth", response_model=MobileDeviceAuthResponse)
async def authenticate_device(
    auth: MobileDeviceAuth,
    db: Session = Depends(get_session)
):
    """Authenticate a mobile device and get access token."""
    # Find device
    statement = select(MobileDevice).where(MobileDevice.deviceId == auth.deviceId)
    device = db.exec(statement).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not registered"
        )

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Device status is {device.status.value}"
        )

    # Generate token
    token_data = {
        "sub": str(auth.userId),
        "device_id": auth.deviceId,
        "type": "mobile"
    }
    access_token = create_access_token(token_data)
    expires_in = 86400  # 24 hours

    # Update device
    device.assignedUserId = auth.userId
    device.lastSeenAt = datetime.now(timezone.utc)
    device.authToken = access_token
    device.tokenExpiresAt = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    db.add(device)
    db.commit()

    return MobileDeviceAuthResponse(
        accessToken=access_token,
        tokenType="bearer",
        expiresIn=expires_in,
        deviceId=auth.deviceId,
        userId=auth.userId
    )


@router.get("/devices", response_model=List[MobileDeviceResponse])
async def list_devices(
    status: Optional[DeviceStatus] = None,
    warehouse_id: Optional[UUID] = None,
    db: Session = Depends(get_session)
):
    """List registered mobile devices."""
    statement = select(MobileDevice)

    if status:
        statement = statement.where(MobileDevice.status == status)
    if warehouse_id:
        statement = statement.where(MobileDevice.warehouseId == warehouse_id)

    statement = statement.order_by(MobileDevice.createdAt.desc())
    results = db.exec(statement).all()
    return results


@router.put("/devices/{device_id}/activate")
async def activate_device(
    device_id: str,
    db: Session = Depends(get_session)
):
    """Activate a pending device."""
    statement = select(MobileDevice).where(MobileDevice.deviceId == device_id)
    device = db.exec(statement).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.status = DeviceStatus.ACTIVE
    db.add(device)
    db.commit()

    return {"message": "Device activated", "deviceId": device_id}


# ==================== Sync Operations ====================

@router.post("/sync/pull", response_model=List[SyncPullResponse])
async def sync_pull(
    request: SyncPullRequest,
    device_id: str = Query(...),
    db: Session = Depends(get_session)
):
    """Pull pending changes from server."""
    # Find device
    stmt = select(MobileDevice).where(MobileDevice.deviceId == device_id)
    device = db.exec(stmt).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    changes = await mobile_sync_service.get_pending_changes(
        db=db,
        device_id=device.id,
        entity_types=request.entityTypes,
        last_sync_at=request.lastSyncAt,
        limit=request.limit
    )

    responses = []
    for entity_type, entities in changes.items():
        responses.append(SyncPullResponse(
            entities=entities,
            entityType=entity_type,
            totalCount=len(entities),
            hasMore=len(entities) >= request.limit,
            syncTimestamp=datetime.now(timezone.utc),
            checksum=mobile_sync_service.generate_checksum({"entities": entities})
        ))

    return responses


@router.post("/sync/push", response_model=SyncPushResponse)
async def sync_push(
    request: SyncPushRequest,
    device_id: str = Query(...),
    user_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Push offline changes to server."""
    # Find device
    stmt = select(MobileDevice).where(MobileDevice.deviceId == device_id)
    device = db.exec(stmt).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    batch_id, results = await mobile_sync_service.process_push_batch(
        db=db,
        device_id=device.id,
        user_id=user_id,
        operations=request.operations
    )

    successful = sum(1 for r in results if r.status == SyncStatus.COMPLETED)
    failed = sum(1 for r in results if r.status == SyncStatus.FAILED)
    conflicts = sum(1 for r in results if r.status == SyncStatus.CONFLICT)

    return SyncPushResponse(
        batchId=batch_id,
        totalOperations=len(results),
        successful=successful,
        failed=failed,
        conflicts=conflicts,
        results=results
    )


@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(
    device_id: str = Query(...),
    db: Session = Depends(get_session)
):
    """Get sync status for a device."""
    stmt = select(MobileDevice).where(MobileDevice.deviceId == device_id)
    device = db.exec(stmt).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    status_data = await mobile_sync_service.get_sync_status(db, device.id)
    return SyncStatusResponse(**status_data)


# ==================== Barcode Scanning ====================

@router.post("/scan", response_model=BarcodeScanResponse)
async def process_scan(
    scan: BarcodeScanRequest,
    device_id: str = Query(...),
    user_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Process a barcode scan."""
    # Find device
    stmt = select(MobileDevice).where(MobileDevice.deviceId == device_id)
    device = db.exec(stmt).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Determine scan type if not provided
    scan_type = scan.scanType
    resolved_entity_id = None
    resolved_entity_type = None
    scanned_value = None
    is_successful = True
    error_message = None

    # Auto-detect scan type based on barcode format
    if not scan_type:
        if scan.barcode.startswith("LOC-"):
            scan_type = ScanType.LOCATION
        elif scan.barcode.startswith("ORD-"):
            scan_type = ScanType.ORDER
        elif scan.barcode.startswith("LP-"):
            scan_type = ScanType.LICENSE_PLATE
        elif scan.barcode.startswith("SN-"):
            scan_type = ScanType.SERIAL
        else:
            scan_type = ScanType.ITEM

    # Log the scan
    scan_log = BarcodeScanLog(
        deviceId=device.id,
        userId=user_id,
        scanType=scan_type,
        barcode=scan.barcode,
        scannedValue=scanned_value,
        resolvedEntityId=resolved_entity_id,
        resolvedEntityType=resolved_entity_type,
        isSuccessful=is_successful,
        errorMessage=error_message,
        location=scan.location,
        taskId=scan.taskId,
        metadata=scan.metadata
    )
    db.add(scan_log)
    db.commit()
    db.refresh(scan_log)

    return BarcodeScanResponse(
        id=scan_log.id,
        scanType=scan_type,
        barcode=scan.barcode,
        scannedValue=scanned_value,
        resolvedEntityId=resolved_entity_id,
        resolvedEntityType=resolved_entity_type,
        isSuccessful=is_successful,
        errorMessage=error_message,
        scannedAt=scan_log.scannedAt
    )


# ==================== Task Management ====================

@router.get("/tasks", response_model=List[MobileTaskResponse])
async def get_assigned_tasks(
    user_id: UUID = Query(...),
    task_type: Optional[TaskType] = None,
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_session)
):
    """Get tasks assigned to a user."""
    statement = select(MobileTask).where(MobileTask.assignedUserId == user_id)

    if task_type:
        statement = statement.where(MobileTask.taskType == task_type)
    if status:
        statement = statement.where(MobileTask.status == status)
    else:
        # Default: exclude completed and cancelled
        statement = statement.where(
            MobileTask.status.not_in([TaskStatus.COMPLETED, TaskStatus.CANCELLED])
        )

    statement = statement.order_by(
        MobileTask.priority.desc(),
        MobileTask.dueDate.asc()
    )
    results = db.exec(statement).all()
    return results


@router.get("/tasks/{task_id}", response_model=MobileTaskResponse)
async def get_task(
    task_id: UUID,
    db: Session = Depends(get_session)
):
    """Get task details."""
    statement = select(MobileTask).where(MobileTask.id == task_id)
    task = db.exec(statement).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


@router.get("/tasks/{task_id}/lines", response_model=List[MobileTaskLineResponse])
async def get_task_lines(
    task_id: UUID,
    db: Session = Depends(get_session)
):
    """Get task lines."""
    statement = select(MobileTaskLine).where(
        MobileTaskLine.taskId == task_id
    ).order_by(MobileTaskLine.lineNumber)
    results = db.exec(statement).all()
    return results


@router.post("/tasks/{task_id}/start")
async def start_task(
    task_id: UUID,
    user_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Start working on a task."""
    statement = select(MobileTask).where(MobileTask.id == task_id)
    task = db.exec(statement).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status not in [TaskStatus.PENDING, TaskStatus.ASSIGNED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start task in {task.status.value} status"
        )

    task.status = TaskStatus.IN_PROGRESS
    task.startedAt = datetime.now(timezone.utc)
    task.assignedUserId = user_id
    db.add(task)
    db.commit()

    return {"message": "Task started", "taskId": str(task_id)}


@router.post("/tasks/{task_id}/complete", response_model=MobileTaskResponse)
async def complete_task(
    task_id: UUID,
    request: TaskCompleteRequest,
    db: Session = Depends(get_session)
):
    """Complete a task."""
    statement = select(MobileTask).where(MobileTask.id == task_id)
    task = db.exec(statement).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete task in {task.status.value} status"
        )

    task.status = TaskStatus.COMPLETED
    task.completedAt = datetime.now(timezone.utc)
    if request.completedQuantity is not None:
        task.completedQuantity = request.completedQuantity
    if request.actualMinutes is not None:
        task.actualMinutes = request.actualMinutes

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@router.post("/tasks/{task_id}/pause")
async def pause_task(
    task_id: UUID,
    db: Session = Depends(get_session)
):
    """Pause a task."""
    statement = select(MobileTask).where(MobileTask.id == task_id)
    task = db.exec(statement).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pause task in {task.status.value} status"
        )

    task.status = TaskStatus.PAUSED
    db.add(task)
    db.commit()

    return {"message": "Task paused", "taskId": str(task_id)}


# ==================== Inventory Operations ====================

@router.get("/inventory/lookup", response_model=InventoryLookupResponse)
async def lookup_inventory(
    barcode: Optional[str] = None,
    sku: Optional[str] = None,
    location_code: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Quick inventory lookup."""
    # This would integrate with actual inventory system
    # For now, return placeholder response
    return InventoryLookupResponse(
        itemId=None,
        sku=sku or barcode,
        itemName=None,
        locationId=None,
        locationCode=location_code,
        quantityOnHand=0,
        quantityAvailable=0,
        quantityReserved=0
    )


@router.post("/putaway", response_model=PutawayResponse)
async def mobile_putaway(
    request: PutawayRequest,
    user_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Perform putaway operation from mobile device."""
    # This would integrate with actual inventory system
    transaction_id = uuid4()

    return PutawayResponse(
        success=True,
        message="Putaway completed successfully",
        transactionId=transaction_id,
        itemId=request.itemId,
        locationId=request.locationId,
        quantity=request.quantity
    )


@router.post("/pick", response_model=PickResponse)
async def mobile_pick(
    request: PickRequest,
    user_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Perform pick operation from mobile device."""
    # Get task line
    statement = select(MobileTaskLine).where(MobileTaskLine.id == request.lineId)
    line = db.exec(statement).first()

    if not line:
        raise HTTPException(status_code=404, detail="Task line not found")

    # Update line
    line.completedQuantity += request.quantity
    if line.completedQuantity >= line.requestedQuantity:
        line.status = TaskStatus.COMPLETED
        line.completedAt = datetime.now(timezone.utc)
        line.completedBy = user_id

    db.add(line)
    db.commit()

    transaction_id = uuid4()
    remaining = line.requestedQuantity - line.completedQuantity

    return PickResponse(
        success=True,
        message="Pick completed",
        transactionId=transaction_id,
        taskId=request.taskId,
        lineId=request.lineId,
        pickedQuantity=request.quantity,
        remainingQuantity=max(0, remaining)
    )


@router.post("/cycle-count", response_model=CycleCountResponse)
async def mobile_cycle_count(
    request: CycleCountRequest,
    user_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Perform cycle count from mobile device."""
    # This would integrate with actual inventory system
    transaction_id = uuid4()
    system_quantity = 0  # Would be fetched from inventory
    variance = request.countedQuantity - system_quantity

    return CycleCountResponse(
        success=True,
        message="Cycle count recorded",
        transactionId=transaction_id,
        locationId=request.locationId,
        itemId=request.itemId,
        countedQuantity=request.countedQuantity,
        systemQuantity=system_quantity,
        variance=variance
    )


# ==================== Session Management ====================

@router.post("/session/start", response_model=MobileSessionResponse)
async def start_session(
    session: MobileSessionCreate,
    db: Session = Depends(get_session)
):
    """Start a mobile session."""
    # End any existing active sessions for this device
    stmt = select(MobileSession).where(
        and_(
            MobileSession.deviceId == session.deviceId,
            MobileSession.status == SessionStatus.ACTIVE
        )
    )
    existing_sessions = db.exec(stmt).all()
    for s in existing_sessions:
        s.status = SessionStatus.TERMINATED
        s.endedAt = datetime.now(timezone.utc)
        db.add(s)

    # Create new session
    new_session = MobileSession(
        deviceId=session.deviceId,
        userId=session.userId,
        warehouseId=session.warehouseId,
        status=SessionStatus.ACTIVE,
        appVersion=session.appVersion
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session


@router.post("/session/end")
async def end_session(
    session_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """End a mobile session."""
    statement = select(MobileSession).where(MobileSession.id == session_id)
    session = db.exec(statement).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.TERMINATED
    session.endedAt = datetime.now(timezone.utc)
    db.add(session)
    db.commit()

    return {"message": "Session ended", "sessionId": str(session_id)}


@router.post("/session/heartbeat")
async def session_heartbeat(
    session_id: UUID = Query(...),
    zone: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Update session activity."""
    statement = select(MobileSession).where(MobileSession.id == session_id)
    session = db.exec(statement).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.lastActivityAt = datetime.now(timezone.utc)
    if zone:
        session.currentZone = zone
    db.add(session)
    db.commit()

    return {"message": "Heartbeat received", "sessionId": str(session_id)}
