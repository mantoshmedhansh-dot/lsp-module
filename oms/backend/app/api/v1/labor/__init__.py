"""
Labor Management API v1 - Shifts, Assignments, Time Tracking, Productivity
"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, Location,
    # Shift models
    LaborShift, LaborShiftCreate, LaborShiftResponse,
    LaborShiftSchedule, LaborShiftScheduleCreate, LaborShiftScheduleResponse,
    # Assignment models
    LaborAssignment, LaborAssignmentCreate, LaborAssignmentResponse,
    AssignmentStatus,
    # Time entry models
    LaborTimeEntry, LaborTimeEntryCreate, LaborTimeEntryResponse,
    TimeEntryType,
    # Productivity models
    LaborProductivity, LaborProductivityResponse,
    # Standard models
    LaborStandard, LaborStandardCreate, LaborStandardResponse,
    # Incentive models
    LaborIncentive, LaborIncentiveResponse,
    # Skill models
    LaborSkill, LaborSkillCreate, LaborSkillResponse,
    # Summary
    LaborDashboardSummary,
)


router = APIRouter(prefix="/labor", tags=["Labor Management"])


# ============================================================================
# Shifts
# ============================================================================

@router.get("/shifts", response_model=List[LaborShiftResponse])
def list_shifts(
    location_id: Optional[UUID] = None,
    is_active: Optional[bool] = True,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List all shifts"""
    query = select(LaborShift)

    if company_filter.company_id:
        query = query.where(LaborShift.companyId == company_filter.company_id)
    if location_id:
        query = query.where(LaborShift.locationId == location_id)
    if is_active is not None:
        query = query.where(LaborShift.isActive == is_active)

    shifts = session.exec(query).all()
    return shifts


@router.post("/shifts", response_model=LaborShiftResponse, status_code=status.HTTP_201_CREATED)
def create_shift(
    data: LaborShiftCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new shift"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    shift = LaborShift(
        id=uuid4(),
        companyId=company_id,
        **data.model_dump()
    )
    session.add(shift)
    session.commit()
    session.refresh(shift)
    return shift


@router.get("/shifts/{shift_id}", response_model=LaborShiftResponse)
def get_shift(
    shift_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific shift"""
    query = select(LaborShift).where(LaborShift.id == shift_id)
    if company_filter.company_id:
        query = query.where(LaborShift.companyId == company_filter.company_id)

    shift = session.exec(query).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift(
    shift_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Delete/deactivate a shift"""
    query = select(LaborShift).where(LaborShift.id == shift_id)
    if company_filter.company_id:
        query = query.where(LaborShift.companyId == company_filter.company_id)

    shift = session.exec(query).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    shift.isActive = False
    shift.updatedAt = datetime.utcnow()
    session.add(shift)
    session.commit()


# ============================================================================
# Shift Schedules
# ============================================================================

@router.get("/schedules", response_model=List[LaborShiftScheduleResponse])
def list_schedules(
    shift_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    schedule_date: Optional[date] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List shift schedules"""
    query = select(LaborShiftSchedule)

    if company_filter.company_id:
        query = query.where(LaborShiftSchedule.companyId == company_filter.company_id)
    if shift_id:
        query = query.where(LaborShiftSchedule.shiftId == shift_id)
    if user_id:
        query = query.where(LaborShiftSchedule.userId == user_id)
    if schedule_date:
        query = query.where(LaborShiftSchedule.scheduleDate == schedule_date)

    schedules = session.exec(query).all()
    return schedules


@router.post("/schedules", response_model=LaborShiftScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    data: LaborShiftScheduleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a shift schedule"""
    shift = session.exec(select(LaborShift).where(LaborShift.id == data.shiftId)).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    from uuid import uuid4
    schedule = LaborShiftSchedule(
        id=uuid4(),
        companyId=shift.companyId,
        **data.model_dump()
    )
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


# ============================================================================
# Assignments
# ============================================================================

@router.get("/assignments", response_model=List[LaborAssignmentResponse])
def list_assignments(
    user_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    status: Optional[AssignmentStatus] = None,
    task_type: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List labor assignments"""
    query = select(LaborAssignment)

    if company_filter.company_id:
        query = query.where(LaborAssignment.companyId == company_filter.company_id)
    if user_id:
        query = query.where(LaborAssignment.userId == user_id)
    if location_id:
        query = query.where(LaborAssignment.locationId == location_id)
    if status:
        query = query.where(LaborAssignment.status == status)
    if task_type:
        query = query.where(LaborAssignment.taskType == task_type)

    query = query.order_by(LaborAssignment.priority.desc(), LaborAssignment.assignedAt.desc())
    assignments = session.exec(query).all()
    return assignments


@router.post("/assignments", response_model=LaborAssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    data: LaborAssignmentCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a labor assignment"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    assignment = LaborAssignment(
        id=uuid4(),
        companyId=company_id,
        **data.model_dump()
    )
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment


@router.post("/assignments/{assignment_id}/start", response_model=LaborAssignmentResponse)
def start_assignment(
    assignment_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start working on an assignment"""
    query = select(LaborAssignment).where(LaborAssignment.id == assignment_id)
    if company_filter.company_id:
        query = query.where(LaborAssignment.companyId == company_filter.company_id)

    assignment = session.exec(query).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.status != AssignmentStatus.PENDING and assignment.status != AssignmentStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Assignment cannot be started")

    assignment.status = AssignmentStatus.IN_PROGRESS
    assignment.startedAt = datetime.utcnow()
    assignment.updatedAt = datetime.utcnow()
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment


@router.post("/assignments/{assignment_id}/complete", response_model=LaborAssignmentResponse)
def complete_assignment(
    assignment_id: UUID,
    actual_quantity: Optional[int] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Complete an assignment"""
    query = select(LaborAssignment).where(LaborAssignment.id == assignment_id)
    if company_filter.company_id:
        query = query.where(LaborAssignment.companyId == company_filter.company_id)

    assignment = session.exec(query).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.status != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Assignment is not in progress")

    assignment.status = AssignmentStatus.COMPLETED
    assignment.completedAt = datetime.utcnow()
    if actual_quantity is not None:
        assignment.actualQuantity = actual_quantity
    assignment.updatedAt = datetime.utcnow()
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment


# ============================================================================
# Time Entries (Clock In/Out)
# ============================================================================

@router.post("/clock-in", response_model=LaborTimeEntryResponse)
def clock_in(
    data: LaborTimeEntryCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Clock in for work"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Check if already clocked in
    last_entry = session.exec(
        select(LaborTimeEntry)
        .where(LaborTimeEntry.userId == current_user.id)
        .where(LaborTimeEntry.companyId == company_filter.company_id)
        .order_by(LaborTimeEntry.timestamp.desc())
    ).first()

    if last_entry and last_entry.entryType == TimeEntryType.CLOCK_IN:
        raise HTTPException(status_code=400, detail="Already clocked in")

    from uuid import uuid4
    entry = LaborTimeEntry(
        id=uuid4(),
        companyId=company_filter.company_id,
        userId=current_user.id,
        entryType=TimeEntryType.CLOCK_IN,
        **data.model_dump(exclude={"entryType"})
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.post("/clock-out", response_model=LaborTimeEntryResponse)
def clock_out(
    data: LaborTimeEntryCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Clock out from work"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Check if clocked in
    last_entry = session.exec(
        select(LaborTimeEntry)
        .where(LaborTimeEntry.userId == current_user.id)
        .where(LaborTimeEntry.companyId == company_filter.company_id)
        .order_by(LaborTimeEntry.timestamp.desc())
    ).first()

    if not last_entry or last_entry.entryType == TimeEntryType.CLOCK_OUT:
        raise HTTPException(status_code=400, detail="Not clocked in")

    from uuid import uuid4
    entry = LaborTimeEntry(
        id=uuid4(),
        companyId=company_filter.company_id,
        userId=current_user.id,
        entryType=TimeEntryType.CLOCK_OUT,
        shiftScheduleId=last_entry.shiftScheduleId,
        **data.model_dump(exclude={"entryType"})
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/time-entries", response_model=List[LaborTimeEntryResponse])
def list_time_entries(
    user_id: Optional[UUID] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List time entries"""
    query = select(LaborTimeEntry)

    if company_filter.company_id:
        query = query.where(LaborTimeEntry.companyId == company_filter.company_id)
    if user_id:
        query = query.where(LaborTimeEntry.userId == user_id)
    if from_date:
        query = query.where(func.date(LaborTimeEntry.timestamp) >= from_date)
    if to_date:
        query = query.where(func.date(LaborTimeEntry.timestamp) <= to_date)

    query = query.order_by(LaborTimeEntry.timestamp.desc())
    entries = session.exec(query).all()
    return entries


# ============================================================================
# Productivity
# ============================================================================

@router.get("/productivity/{user_id}", response_model=List[LaborProductivityResponse])
def get_user_productivity(
    user_id: UUID,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    task_type: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get productivity metrics for a user"""
    query = select(LaborProductivity).where(LaborProductivity.userId == user_id)

    if company_filter.company_id:
        query = query.where(LaborProductivity.companyId == company_filter.company_id)
    if from_date:
        query = query.where(LaborProductivity.recordDate >= from_date)
    if to_date:
        query = query.where(LaborProductivity.recordDate <= to_date)
    if task_type:
        query = query.where(LaborProductivity.taskType == task_type)

    query = query.order_by(LaborProductivity.recordDate.desc())
    records = session.exec(query).all()
    return records


@router.get("/analytics/team")
def get_team_analytics(
    location_id: Optional[UUID] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get team productivity analytics"""
    query = select(
        LaborProductivity.taskType,
        func.count(func.distinct(LaborProductivity.userId)).label("workerCount"),
        func.sum(LaborProductivity.completedTasks).label("totalTasks"),
        func.sum(LaborProductivity.processedUnits).label("totalUnits"),
        func.avg(LaborProductivity.performanceScore).label("avgPerformance"),
        func.avg(LaborProductivity.accuracyRate).label("avgAccuracy")
    ).group_by(LaborProductivity.taskType)

    if company_filter.company_id:
        query = query.where(LaborProductivity.companyId == company_filter.company_id)
    if location_id:
        query = query.where(LaborProductivity.locationId == location_id)
    if from_date:
        query = query.where(LaborProductivity.recordDate >= from_date)
    if to_date:
        query = query.where(LaborProductivity.recordDate <= to_date)

    results = session.exec(query).all()
    return [
        {
            "taskType": r[0],
            "workerCount": r[1],
            "totalTasks": r[2] or 0,
            "totalUnits": r[3] or 0,
            "avgPerformance": float(r[4] or 0),
            "avgAccuracy": float(r[5] or 0)
        }
        for r in results
    ]


@router.get("/leaderboard")
def get_leaderboard(
    location_id: Optional[UUID] = None,
    task_type: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get performance leaderboard"""
    query = select(
        LaborProductivity.userId,
        func.sum(LaborProductivity.completedTasks).label("totalTasks"),
        func.sum(LaborProductivity.processedUnits).label("totalUnits"),
        func.avg(LaborProductivity.performanceScore).label("avgPerformance")
    ).group_by(LaborProductivity.userId)

    if company_filter.company_id:
        query = query.where(LaborProductivity.companyId == company_filter.company_id)
    if location_id:
        query = query.where(LaborProductivity.locationId == location_id)
    if task_type:
        query = query.where(LaborProductivity.taskType == task_type)

    # Last 30 days
    from datetime import timedelta
    thirty_days_ago = date.today() - timedelta(days=30)
    query = query.where(LaborProductivity.recordDate >= thirty_days_ago)

    query = query.order_by(func.avg(LaborProductivity.performanceScore).desc()).limit(limit)
    results = session.exec(query).all()

    leaderboard = []
    for i, r in enumerate(results):
        user = session.exec(select(User).where(User.id == r[0])).first()
        leaderboard.append({
            "rank": i + 1,
            "userId": str(r[0]),
            "userName": user.name if user else "Unknown",
            "totalTasks": r[1] or 0,
            "totalUnits": r[2] or 0,
            "avgPerformance": float(r[3] or 0)
        })

    return leaderboard


# ============================================================================
# Standards
# ============================================================================

@router.get("/standards", response_model=List[LaborStandardResponse])
def list_standards(
    location_id: Optional[UUID] = None,
    task_type: Optional[str] = None,
    is_active: bool = True,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List labor standards"""
    query = select(LaborStandard).where(LaborStandard.isActive == is_active)

    if company_filter.company_id:
        query = query.where(LaborStandard.companyId == company_filter.company_id)
    if location_id:
        query = query.where(LaborStandard.locationId == location_id)
    if task_type:
        query = query.where(LaborStandard.taskType == task_type)

    standards = session.exec(query).all()
    return standards


@router.post("/standards", response_model=LaborStandardResponse, status_code=status.HTTP_201_CREATED)
def create_standard(
    data: LaborStandardCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a labor standard"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    standard = LaborStandard(
        id=uuid4(),
        companyId=company_id,
        **data.model_dump()
    )
    session.add(standard)
    session.commit()
    session.refresh(standard)
    return standard


# ============================================================================
# Skills
# ============================================================================

@router.get("/skills", response_model=List[LaborSkillResponse])
def list_skills(
    user_id: Optional[UUID] = None,
    skill_category: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List labor skills"""
    query = select(LaborSkill).where(LaborSkill.isActive == True)

    if company_filter.company_id:
        query = query.where(LaborSkill.companyId == company_filter.company_id)
    if user_id:
        query = query.where(LaborSkill.userId == user_id)
    if skill_category:
        query = query.where(LaborSkill.skillCategory == skill_category)

    skills = session.exec(query).all()
    return skills


@router.post("/skills", response_model=LaborSkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(
    data: LaborSkillCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Add a skill to a user"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4
    skill = LaborSkill(
        id=uuid4(),
        companyId=company_filter.company_id,
        **data.model_dump()
    )
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return skill


# ============================================================================
# Dashboard
# ============================================================================

@router.get("/dashboard", response_model=LaborDashboardSummary)
def get_labor_dashboard(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get labor dashboard summary"""
    from decimal import Decimal

    # Count workers with schedules today
    today = date.today()

    schedule_query = select(func.count(func.distinct(LaborShiftSchedule.userId))).where(
        LaborShiftSchedule.scheduleDate == today
    )
    if company_filter.company_id:
        schedule_query = schedule_query.where(LaborShiftSchedule.companyId == company_filter.company_id)

    total_workers = session.exec(schedule_query).one() or 0

    # Active workers (clocked in)
    active_query = select(func.count(func.distinct(LaborTimeEntry.userId))).where(
        LaborTimeEntry.entryType == TimeEntryType.CLOCK_IN,
        func.date(LaborTimeEntry.timestamp) == today
    )
    if company_filter.company_id:
        active_query = active_query.where(LaborTimeEntry.companyId == company_filter.company_id)

    active_workers = session.exec(active_query).one() or 0

    # Tasks today
    task_query = select(
        func.count(LaborAssignment.id).filter(LaborAssignment.status == AssignmentStatus.COMPLETED),
        func.count(LaborAssignment.id).filter(LaborAssignment.status.in_([AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS]))
    ).where(func.date(LaborAssignment.assignedAt) == today)

    if company_filter.company_id:
        task_query = task_query.where(LaborAssignment.companyId == company_filter.company_id)

    task_result = session.exec(task_query).first()
    tasks_completed = task_result[0] if task_result else 0
    tasks_pending = task_result[1] if task_result else 0

    return LaborDashboardSummary(
        totalWorkers=total_workers,
        activeWorkers=active_workers,
        onBreak=0,
        avgProductivity=Decimal("0"),
        tasksCompleted=tasks_completed,
        tasksPending=tasks_pending,
        topPerformers=[]
    )
