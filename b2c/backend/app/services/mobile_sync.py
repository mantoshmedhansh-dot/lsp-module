"""
Mobile Sync Service for WMS Operations
Handles offline data synchronization between mobile devices and server
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID, uuid4
import hashlib
import json

from sqlmodel import Session, select
from sqlalchemy import and_, or_

from app.models.offline_sync import (
    OfflineSyncQueue, SyncCheckpoint, SyncConflict, SyncBatch,
    SyncOperationType, SyncStatus, SyncEntityType, ConflictResolution,
    SyncPushOperation, SyncPushResult
)
from app.models.mobile_session import MobileTask, MobileTaskLine


class MobileSyncService:
    """
    Service for handling mobile device synchronization.
    Supports offline-first operations with conflict resolution.
    """

    def __init__(self):
        self.conflict_handlers: Dict[SyncEntityType, callable] = {}

    def generate_checksum(self, data: dict) -> str:
        """Generate checksum for data integrity verification."""
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode()).hexdigest()[:16]

    async def get_pending_changes(
        self,
        db: Session,
        device_id: UUID,
        entity_types: Optional[List[SyncEntityType]] = None,
        last_sync_at: Optional[datetime] = None,
        limit: int = 100
    ) -> Dict[SyncEntityType, List[dict]]:
        """
        Get pending changes from server for a device.
        """
        changes: Dict[SyncEntityType, List[dict]] = {}

        if entity_types is None:
            entity_types = list(SyncEntityType)

        for entity_type in entity_types:
            checkpoint = await self._get_or_create_checkpoint(
                db, device_id, entity_type
            )

            sync_time = last_sync_at or checkpoint.lastSyncAt

            # Get changes based on entity type
            if entity_type == SyncEntityType.TASK:
                entities = await self._get_task_changes(db, sync_time, limit)
            elif entity_type == SyncEntityType.TASK_LINE:
                entities = await self._get_task_line_changes(db, sync_time, limit)
            else:
                entities = []

            changes[entity_type] = entities

        return changes

    async def _get_task_changes(
        self,
        db: Session,
        since: datetime,
        limit: int
    ) -> List[dict]:
        """Get task changes since timestamp."""
        statement = select(MobileTask).where(
            MobileTask.updatedAt > since
        ).order_by(MobileTask.updatedAt).limit(limit)

        results = db.exec(statement).all()
        return [
            {
                "id": str(task.id),
                "taskType": task.taskType.value,
                "taskNumber": task.taskNumber,
                "status": task.status.value,
                "priority": task.priority.value,
                "assignedUserId": str(task.assignedUserId) if task.assignedUserId else None,
                "warehouseId": str(task.warehouseId),
                "quantity": task.quantity,
                "completedQuantity": task.completedQuantity,
                "instructions": task.instructions,
                "dueDate": task.dueDate.isoformat() if task.dueDate else None,
                "updatedAt": task.updatedAt.isoformat()
            }
            for task in results
        ]

    async def _get_task_line_changes(
        self,
        db: Session,
        since: datetime,
        limit: int
    ) -> List[dict]:
        """Get task line changes since timestamp."""
        statement = select(MobileTaskLine).where(
            MobileTaskLine.updatedAt > since
        ).order_by(MobileTaskLine.updatedAt).limit(limit)

        results = db.exec(statement).all()
        return [
            {
                "id": str(line.id),
                "taskId": str(line.taskId),
                "lineNumber": line.lineNumber,
                "sku": line.sku,
                "itemName": line.itemName,
                "sourceLocation": line.sourceLocation,
                "destinationLocation": line.destinationLocation,
                "requestedQuantity": line.requestedQuantity,
                "completedQuantity": line.completedQuantity,
                "status": line.status.value,
                "updatedAt": line.updatedAt.isoformat()
            }
            for line in results
        ]

    async def _get_or_create_checkpoint(
        self,
        db: Session,
        device_id: UUID,
        entity_type: SyncEntityType
    ) -> SyncCheckpoint:
        """Get or create a sync checkpoint for device and entity type."""
        statement = select(SyncCheckpoint).where(
            and_(
                SyncCheckpoint.deviceId == device_id,
                SyncCheckpoint.entityType == entity_type
            )
        )
        checkpoint = db.exec(statement).first()

        if not checkpoint:
            checkpoint = SyncCheckpoint(
                deviceId=device_id,
                entityType=entity_type,
                lastSyncAt=datetime.now(timezone.utc) - timedelta(days=30)
            )
            db.add(checkpoint)
            db.commit()
            db.refresh(checkpoint)

        return checkpoint

    async def process_push_batch(
        self,
        db: Session,
        device_id: UUID,
        user_id: UUID,
        operations: List[SyncPushOperation]
    ) -> Tuple[UUID, List[SyncPushResult]]:
        """
        Process a batch of sync operations from a mobile device.
        Returns batch ID and results for each operation.
        """
        # Create batch record
        batch = SyncBatch(
            deviceId=device_id,
            userId=user_id,
            batchType="push",
            status=SyncStatus.PROCESSING,
            totalOperations=len(operations)
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        results: List[SyncPushResult] = []
        successful = 0
        failed = 0
        conflicts = 0

        for operation in operations:
            # Create queue entry
            queue_entry = OfflineSyncQueue(
                deviceId=device_id,
                userId=user_id,
                operationType=operation.operationType,
                entityType=operation.entityType,
                entityId=operation.entityId,
                localId=operation.localId,
                payload=operation.payload,
                clientTimestamp=operation.clientTimestamp,
                status=SyncStatus.PROCESSING
            )
            db.add(queue_entry)
            db.commit()
            db.refresh(queue_entry)

            # Process the operation
            result = await self._process_operation(db, queue_entry)
            results.append(result)

            if result.status == SyncStatus.COMPLETED:
                successful += 1
            elif result.status == SyncStatus.CONFLICT:
                conflicts += 1
            else:
                failed += 1

        # Update batch status
        batch.status = SyncStatus.COMPLETED
        batch.completedOperations = successful
        batch.failedOperations = failed
        batch.conflictOperations = conflicts
        batch.completedAt = datetime.now(timezone.utc)
        db.add(batch)
        db.commit()

        return batch.id, results

    async def _process_operation(
        self,
        db: Session,
        queue_entry: OfflineSyncQueue
    ) -> SyncPushResult:
        """Process a single sync operation."""
        try:
            # Check for conflicts
            conflict = await self._check_conflict(db, queue_entry)
            if conflict:
                # Create conflict record
                conflict_record = SyncConflict(
                    syncQueueId=queue_entry.id,
                    deviceId=queue_entry.deviceId,
                    entityType=queue_entry.entityType,
                    entityId=queue_entry.entityId,
                    clientData=queue_entry.payload,
                    serverData=conflict["serverData"],
                    conflictFields=conflict["fields"]
                )
                db.add(conflict_record)
                db.commit()
                db.refresh(conflict_record)

                queue_entry.status = SyncStatus.CONFLICT
                queue_entry.conflictData = conflict
                db.add(queue_entry)
                db.commit()

                return SyncPushResult(
                    localId=queue_entry.localId,
                    entityId=queue_entry.entityId,
                    status=SyncStatus.CONFLICT,
                    conflictId=conflict_record.id
                )

            # Apply the operation
            entity_id = await self._apply_operation(db, queue_entry)

            queue_entry.status = SyncStatus.COMPLETED
            queue_entry.entityId = entity_id
            queue_entry.processedAt = datetime.now(timezone.utc)
            db.add(queue_entry)
            db.commit()

            return SyncPushResult(
                localId=queue_entry.localId,
                entityId=entity_id,
                status=SyncStatus.COMPLETED
            )

        except Exception as e:
            queue_entry.status = SyncStatus.FAILED
            queue_entry.errorMessage = str(e)
            queue_entry.retryCount += 1
            db.add(queue_entry)
            db.commit()

            return SyncPushResult(
                localId=queue_entry.localId,
                entityId=queue_entry.entityId,
                status=SyncStatus.FAILED,
                errorMessage=str(e)
            )

    async def _check_conflict(
        self,
        db: Session,
        queue_entry: OfflineSyncQueue
    ) -> Optional[dict]:
        """Check if there's a conflict with server data."""
        if queue_entry.operationType == SyncOperationType.CREATE:
            return None

        if not queue_entry.entityId:
            return None

        # Get current server version
        if queue_entry.entityType == SyncEntityType.TASK:
            statement = select(MobileTask).where(MobileTask.id == queue_entry.entityId)
            entity = db.exec(statement).first()

            if entity:
                # Check if server version is newer
                client_timestamp = queue_entry.clientTimestamp
                if entity.updatedAt > client_timestamp:
                    return {
                        "serverData": {
                            "status": entity.status.value,
                            "completedQuantity": entity.completedQuantity,
                            "updatedAt": entity.updatedAt.isoformat()
                        },
                        "fields": ["status", "completedQuantity"]
                    }

        return None

    async def _apply_operation(
        self,
        db: Session,
        queue_entry: OfflineSyncQueue
    ) -> UUID:
        """Apply a sync operation to the database."""
        payload = queue_entry.payload

        if queue_entry.entityType == SyncEntityType.TASK:
            return await self._apply_task_operation(db, queue_entry, payload)
        elif queue_entry.entityType == SyncEntityType.TASK_LINE:
            return await self._apply_task_line_operation(db, queue_entry, payload)
        else:
            raise ValueError(f"Unsupported entity type: {queue_entry.entityType}")

    async def _apply_task_operation(
        self,
        db: Session,
        queue_entry: OfflineSyncQueue,
        payload: dict
    ) -> UUID:
        """Apply task operation."""
        from app.models.mobile_session import TaskStatus, TaskType, TaskPriority

        if queue_entry.operationType == SyncOperationType.UPDATE:
            statement = select(MobileTask).where(MobileTask.id == queue_entry.entityId)
            task = db.exec(statement).first()

            if task:
                if "status" in payload:
                    task.status = TaskStatus(payload["status"])
                if "completedQuantity" in payload:
                    task.completedQuantity = payload["completedQuantity"]
                if "startedAt" in payload:
                    task.startedAt = datetime.fromisoformat(payload["startedAt"])
                if "completedAt" in payload:
                    task.completedAt = datetime.fromisoformat(payload["completedAt"])

                task.updatedAt = datetime.now(timezone.utc)
                db.add(task)
                db.commit()
                return task.id

        raise ValueError(f"Task not found: {queue_entry.entityId}")

    async def _apply_task_line_operation(
        self,
        db: Session,
        queue_entry: OfflineSyncQueue,
        payload: dict
    ) -> UUID:
        """Apply task line operation."""
        from app.models.mobile_session import TaskStatus

        if queue_entry.operationType == SyncOperationType.UPDATE:
            statement = select(MobileTaskLine).where(
                MobileTaskLine.id == queue_entry.entityId
            )
            line = db.exec(statement).first()

            if line:
                if "status" in payload:
                    line.status = TaskStatus(payload["status"])
                if "completedQuantity" in payload:
                    line.completedQuantity = payload["completedQuantity"]
                if "completedAt" in payload:
                    line.completedAt = datetime.fromisoformat(payload["completedAt"])

                line.updatedAt = datetime.now(timezone.utc)
                db.add(line)
                db.commit()
                return line.id

        raise ValueError(f"Task line not found: {queue_entry.entityId}")

    async def resolve_conflict(
        self,
        db: Session,
        conflict_id: UUID,
        resolution: ConflictResolution,
        resolved_by: UUID,
        resolved_data: Optional[dict] = None
    ) -> bool:
        """Resolve a sync conflict."""
        statement = select(SyncConflict).where(SyncConflict.id == conflict_id)
        conflict = db.exec(statement).first()

        if not conflict:
            return False

        conflict.resolution = resolution
        conflict.resolvedBy = resolved_by
        conflict.resolvedAt = datetime.now(timezone.utc)

        if resolution == ConflictResolution.CLIENT_WINS:
            conflict.resolvedData = conflict.clientData
        elif resolution == ConflictResolution.SERVER_WINS:
            conflict.resolvedData = conflict.serverData
        elif resolution == ConflictResolution.MERGE and resolved_data:
            conflict.resolvedData = resolved_data
        elif resolution == ConflictResolution.MANUAL and resolved_data:
            conflict.resolvedData = resolved_data

        db.add(conflict)

        # Apply resolved data
        if conflict.resolvedData:
            queue_stmt = select(OfflineSyncQueue).where(
                OfflineSyncQueue.id == conflict.syncQueueId
            )
            queue_entry = db.exec(queue_stmt).first()
            if queue_entry:
                queue_entry.payload = conflict.resolvedData
                queue_entry.status = SyncStatus.PENDING
                queue_entry.resolution = resolution
                db.add(queue_entry)

        db.commit()
        return True

    async def get_sync_status(
        self,
        db: Session,
        device_id: UUID
    ) -> dict:
        """Get sync status for a device."""
        # Count pending push operations
        push_stmt = select(OfflineSyncQueue).where(
            and_(
                OfflineSyncQueue.deviceId == device_id,
                OfflineSyncQueue.status == SyncStatus.PENDING
            )
        )
        pending_push = len(db.exec(push_stmt).all())

        # Count conflicts
        conflict_stmt = select(SyncConflict).where(
            and_(
                SyncConflict.deviceId == device_id,
                SyncConflict.resolution == None
            )
        )
        conflict_count = len(db.exec(conflict_stmt).all())

        # Get last sync time
        checkpoint_stmt = select(SyncCheckpoint).where(
            SyncCheckpoint.deviceId == device_id
        ).order_by(SyncCheckpoint.lastSyncAt.desc())
        last_checkpoint = db.exec(checkpoint_stmt).first()

        return {
            "deviceId": str(device_id),
            "lastSyncAt": last_checkpoint.lastSyncAt if last_checkpoint else None,
            "pendingPushCount": pending_push,
            "pendingPullCount": 0,  # Calculated separately
            "conflictCount": conflict_count,
            "isOnline": True
        }


# Global service instance
mobile_sync_service = MobileSyncService()
