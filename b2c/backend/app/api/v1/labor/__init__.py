"""
Labor Management API Endpoints
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.labor_management import (
    LaborShift, LaborShiftSchedule, LaborAssignment,
    LaborTimeEntry, LaborProductivity, LaborStandard,
    LaborIncentive, LaborSkill,
    ShiftType, ShiftStatus, AssignmentStatus, TimeEntryType,
    SkillLevel, IncentiveType,
    LaborShiftCreate, LaborShiftResponse,
    LaborAssignmentCreate, LaborAssignmentResponse,
    ClockInRequest, ClockOutRequest, TimeEntryResponse,
    ProductivityResponse, TeamAnalyticsResponse,
    LeaderboardEntry, LeaderboardResponse
)
from app.services.labor_analytics import labor_analytics_service

router = APIRouter()


# ==================== Shift Management ====================

@router.post("/shifts", response_model=LaborShiftResponse)
async def create_shift(
    shift: LaborShiftCreate,
    db: Session = Depends(get_session)
):
    """Create a new shift definition."""
    new_shift = LaborShift(
        shiftName=shift.shiftName,
        shiftType=shift.shiftType,
        warehouseId=shift.warehouseId,
        startTime=shift.startTime,
        endTime=shift.endTime,
        breakDurationMinutes=shift.breakDurationMinutes,
        lunchDurationMinutes=shift.lunchDurationMinutes,
        maxWorkers=shift.maxWorkers,
        minWorkers=shift.minWorkers,
        daysOfWeek=shift.daysOfWeek,
        overtimeAllowed=shift.overtimeAllowed,
        overtimeAfterHours=shift.overtimeAfterHours,
        description=shift.description
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    return new_shift


@router.get("/shifts", response_model=List[LaborShiftResponse])
async def list_shifts(
    warehouse_id: Optional[UUID] = None,
    shift_type: Optional[ShiftType] = None,
    is_active: bool = True,
    db: Session = Depends(get_session)
):
    """List shift definitions."""
    statement = select(LaborShift).where(LaborShift.isActive == is_active)

    if warehouse_id:
        statement = statement.where(LaborShift.warehouseId == warehouse_id)
    if shift_type:
        statement = statement.where(LaborShift.shiftType == shift_type)

    results = db.exec(statement).all()
    return results


@router.get("/shifts/{shift_id}", response_model=LaborShiftResponse)
async def get_shift(
    shift_id: UUID,
    db: Session = Depends(get_session)
):
    """Get shift details."""
    statement = select(LaborShift).where(LaborShift.id == shift_id)
    shift = db.exec(statement).first()

    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    return shift


@router.put("/shifts/{shift_id}", response_model=LaborShiftResponse)
async def update_shift(
    shift_id: UUID,
    shift_update: LaborShiftCreate,
    db: Session = Depends(get_session)
):
    """Update a shift definition."""
    statement = select(LaborShift).where(LaborShift.id == shift_id)
    shift = db.exec(statement).first()

    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    shift.shiftName = shift_update.shiftName
    shift.shiftType = shift_update.shiftType
    shift.startTime = shift_update.startTime
    shift.endTime = shift_update.endTime
    shift.breakDurationMinutes = shift_update.breakDurationMinutes
    shift.lunchDurationMinutes = shift_update.lunchDurationMinutes
    shift.maxWorkers = shift_update.maxWorkers
    shift.minWorkers = shift_update.minWorkers
    shift.daysOfWeek = shift_update.daysOfWeek
    shift.overtimeAllowed = shift_update.overtimeAllowed
    shift.overtimeAfterHours = shift_update.overtimeAfterHours
    shift.description = shift_update.description

    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.delete("/shifts/{shift_id}")
async def delete_shift(
    shift_id: UUID,
    db: Session = Depends(get_session)
):
    """Deactivate a shift."""
    statement = select(LaborShift).where(LaborShift.id == shift_id)
    shift = db.exec(statement).first()

    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    shift.isActive = False
    db.add(shift)
    db.commit()

    return {"message": "Shift deactivated", "shiftId": str(shift_id)}


# ==================== Assignment Management ====================

@router.post("/assignments", response_model=LaborAssignmentResponse)
async def create_assignment(
    assignment: LaborAssignmentCreate,
    assigned_by: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Create a new task assignment."""
    new_assignment = LaborAssignment(
        userId=assignment.userId,
        taskId=assignment.taskId,
        taskType=assignment.taskType,
        warehouseId=assignment.warehouseId,
        zone=assignment.zone,
        estimatedMinutes=assignment.estimatedMinutes,
        priority=assignment.priority,
        notes=assignment.notes,
        assignedBy=assigned_by,
        status=AssignmentStatus.PENDING
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    return new_assignment


@router.get("/assignments", response_model=List[LaborAssignmentResponse])
async def list_assignments(
    user_id: Optional[UUID] = None,
    warehouse_id: Optional[UUID] = None,
    status: Optional[AssignmentStatus] = None,
    task_type: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """List task assignments."""
    statement = select(LaborAssignment)

    if user_id:
        statement = statement.where(LaborAssignment.userId == user_id)
    if warehouse_id:
        statement = statement.where(LaborAssignment.warehouseId == warehouse_id)
    if status:
        statement = statement.where(LaborAssignment.status == status)
    if task_type:
        statement = statement.where(LaborAssignment.taskType == task_type)

    statement = statement.order_by(
        LaborAssignment.priority.desc(),
        LaborAssignment.assignedAt.desc()
    )
    results = db.exec(statement).all()
    return results


@router.put("/assignments/{assignment_id}/accept")
async def accept_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_session)
):
    """Accept an assignment."""
    statement = select(LaborAssignment).where(LaborAssignment.id == assignment_id)
    assignment = db.exec(statement).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.status != AssignmentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Assignment is not pending")

    assignment.status = AssignmentStatus.ACCEPTED
    db.add(assignment)
    db.commit()

    return {"message": "Assignment accepted", "assignmentId": str(assignment_id)}


@router.put("/assignments/{assignment_id}/start")
async def start_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_session)
):
    """Start working on an assignment."""
    statement = select(LaborAssignment).where(LaborAssignment.id == assignment_id)
    assignment = db.exec(statement).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.status = AssignmentStatus.STARTED
    assignment.startedAt = datetime.now(timezone.utc)
    db.add(assignment)
    db.commit()

    return {"message": "Assignment started", "assignmentId": str(assignment_id)}


@router.put("/assignments/{assignment_id}/complete")
async def complete_assignment(
    assignment_id: UUID,
    actual_minutes: Optional[int] = None,
    db: Session = Depends(get_session)
):
    """Complete an assignment."""
    statement = select(LaborAssignment).where(LaborAssignment.id == assignment_id)
    assignment = db.exec(statement).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.status = AssignmentStatus.COMPLETED
    assignment.completedAt = datetime.now(timezone.utc)

    if actual_minutes:
        assignment.actualMinutes = actual_minutes
    elif assignment.startedAt:
        delta = datetime.now(timezone.utc) - assignment.startedAt
        assignment.actualMinutes = int(delta.total_seconds() / 60)

    db.add(assignment)
    db.commit()

    return {"message": "Assignment completed", "assignmentId": str(assignment_id)}


# ==================== Time Tracking ====================

@router.post("/clock-in", response_model=TimeEntryResponse)
async def clock_in(
    user_id: UUID = Query(...),
    request: ClockInRequest = None,
    db: Session = Depends(get_session)
):
    """Clock in for work."""
    request = request or ClockInRequest()

    # Check if already clocked in
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing = db.exec(
        select(LaborTimeEntry).where(
            and_(
                LaborTimeEntry.userId == user_id,
                LaborTimeEntry.entryType == TimeEntryType.CLOCK_IN,
                LaborTimeEntry.timestamp >= today_start
            )
        )
    ).first()

    if existing:
        # Check if clocked out
        clock_out = db.exec(
            select(LaborTimeEntry).where(
                and_(
                    LaborTimeEntry.userId == user_id,
                    LaborTimeEntry.entryType == TimeEntryType.CLOCK_OUT,
                    LaborTimeEntry.timestamp >= existing.timestamp
                )
            )
        ).first()

        if not clock_out:
            raise HTTPException(
                status_code=400,
                detail="Already clocked in. Please clock out first."
            )

    entry = LaborTimeEntry(
        userId=user_id,
        shiftScheduleId=request.shiftScheduleId,
        entryType=TimeEntryType.CLOCK_IN,
        deviceId=request.deviceId,
        location=request.location,
        latitude=request.latitude,
        longitude=request.longitude
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


@router.post("/clock-out", response_model=TimeEntryResponse)
async def clock_out(
    user_id: UUID = Query(...),
    request: ClockOutRequest = None,
    db: Session = Depends(get_session)
):
    """Clock out from work."""
    request = request or ClockOutRequest()

    # Find the most recent clock-in without a clock-out
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    clock_in_entry = db.exec(
        select(LaborTimeEntry).where(
            and_(
                LaborTimeEntry.userId == user_id,
                LaborTimeEntry.entryType == TimeEntryType.CLOCK_IN,
                LaborTimeEntry.timestamp >= today_start
            )
        ).order_by(LaborTimeEntry.timestamp.desc())
    ).first()

    if not clock_in_entry:
        raise HTTPException(
            status_code=400,
            detail="No clock-in found. Please clock in first."
        )

    entry = LaborTimeEntry(
        userId=user_id,
        shiftScheduleId=clock_in_entry.shiftScheduleId,
        entryType=TimeEntryType.CLOCK_OUT,
        notes=request.notes
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


@router.get("/time-entries", response_model=List[TimeEntryResponse])
async def list_time_entries(
    user_id: UUID = Query(...),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_session)
):
    """List time entries for a user."""
    statement = select(LaborTimeEntry).where(LaborTimeEntry.userId == user_id)

    if start_date:
        statement = statement.where(LaborTimeEntry.timestamp >= start_date)
    if end_date:
        statement = statement.where(LaborTimeEntry.timestamp <= end_date)

    statement = statement.order_by(LaborTimeEntry.timestamp.desc())
    results = db.exec(statement).all()
    return results


# ==================== Productivity & Analytics ====================

@router.get("/productivity/{user_id}", response_model=List[ProductivityResponse])
async def get_user_productivity(
    user_id: UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    task_type: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Get productivity metrics for a user."""
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=30)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    statement = select(LaborProductivity).where(
        and_(
            LaborProductivity.userId == user_id,
            LaborProductivity.recordDate >= start_date,
            LaborProductivity.recordDate <= end_date
        )
    )

    if task_type:
        statement = statement.where(LaborProductivity.taskType == task_type)

    statement = statement.order_by(LaborProductivity.recordDate.desc())
    results = db.exec(statement).all()
    return results


@router.get("/analytics/team", response_model=TeamAnalyticsResponse)
async def get_team_analytics(
    warehouse_id: UUID = Query(...),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    task_type: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """Get team analytics for a warehouse."""
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=7)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    return await labor_analytics_service.get_team_analytics(
        db=db,
        warehouse_id=warehouse_id,
        start_date=start_date,
        end_date=end_date,
        task_type=task_type
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    warehouse_id: UUID = Query(...),
    period: str = Query("daily", regex="^(daily|weekly|monthly)$"),
    task_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_session)
):
    """Get performance leaderboard."""
    return await labor_analytics_service.generate_leaderboard(
        db=db,
        warehouse_id=warehouse_id,
        period=period,
        task_type=task_type,
        limit=limit
    )


@router.get("/analytics/labor-cost")
async def get_labor_cost(
    warehouse_id: UUID = Query(...),
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    hourly_rate: float = Query(150.0),
    db: Session = Depends(get_session)
):
    """Calculate labor cost for a period."""
    return await labor_analytics_service.calculate_labor_cost(
        db=db,
        warehouse_id=warehouse_id,
        start_date=start_date,
        end_date=end_date,
        hourly_rate=hourly_rate
    )


@router.get("/analytics/attendance")
async def get_attendance_summary(
    warehouse_id: UUID = Query(...),
    date: Optional[datetime] = None,
    db: Session = Depends(get_session)
):
    """Get attendance summary for a day."""
    if not date:
        date = datetime.now(timezone.utc)

    return await labor_analytics_service.get_attendance_summary(
        db=db,
        warehouse_id=warehouse_id,
        date=date
    )


# ==================== Skills Management ====================

@router.get("/skills/{user_id}")
async def get_user_skills(
    user_id: UUID,
    db: Session = Depends(get_session)
):
    """Get skills for a user."""
    statement = select(LaborSkill).where(
        and_(
            LaborSkill.userId == user_id,
            LaborSkill.isActive == True
        )
    )
    results = db.exec(statement).all()
    return results


@router.post("/skills")
async def add_user_skill(
    user_id: UUID = Query(...),
    skill_name: str = Query(...),
    skill_category: str = Query(...),
    level: SkillLevel = Query(SkillLevel.NOVICE),
    certified_by: Optional[UUID] = None,
    db: Session = Depends(get_session)
):
    """Add a skill to a user."""
    skill = LaborSkill(
        userId=user_id,
        skillName=skill_name,
        skillCategory=skill_category,
        level=level,
        certifiedBy=certified_by,
        certifiedDate=datetime.now(timezone.utc) if certified_by else None
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill
