"""
Labor Management Models for Warehouse Operations
"""
from datetime import datetime, timezone, date, time
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON, Time, Date
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class ShiftType(str, Enum):
    """Shift types"""
    MORNING = "MORNING"
    AFTERNOON = "AFTERNOON"
    NIGHT = "NIGHT"
    SPLIT = "SPLIT"
    FLEXIBLE = "FLEXIBLE"


class ShiftStatus(str, Enum):
    """Shift status"""
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TimeEntryType(str, Enum):
    """Time entry types"""
    CLOCK_IN = "CLOCK_IN"
    CLOCK_OUT = "CLOCK_OUT"
    BREAK_START = "BREAK_START"
    BREAK_END = "BREAK_END"
    LUNCH_START = "LUNCH_START"
    LUNCH_END = "LUNCH_END"


class AssignmentStatus(str, Enum):
    """Assignment status"""
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    DECLINED = "DECLINED"
    REASSIGNED = "REASSIGNED"


class SkillLevel(str, Enum):
    """Skill proficiency levels"""
    NOVICE = "NOVICE"
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    EXPERT = "EXPERT"


class IncentiveType(str, Enum):
    """Incentive types"""
    PRODUCTIVITY_BONUS = "PRODUCTIVITY_BONUS"
    ATTENDANCE_BONUS = "ATTENDANCE_BONUS"
    QUALITY_BONUS = "QUALITY_BONUS"
    OVERTIME_PREMIUM = "OVERTIME_PREMIUM"
    SHIFT_DIFFERENTIAL = "SHIFT_DIFFERENTIAL"
    REFERRAL_BONUS = "REFERRAL_BONUS"


# Database Models
class LaborShift(BaseModel, table=True):
    """Shift definitions"""
    __tablename__ = "labor_shifts"

    shiftName: str = Field(max_length=100)
    shiftType: ShiftType = Field(default=ShiftType.MORNING)
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    startTime: str = Field(max_length=10)  # HH:MM format
    endTime: str = Field(max_length=10)  # HH:MM format
    breakDurationMinutes: int = Field(default=30)
    lunchDurationMinutes: int = Field(default=60)
    maxWorkers: Optional[int] = Field(default=None)
    minWorkers: Optional[int] = Field(default=None)
    daysOfWeek: List[int] = Field(default=[1, 2, 3, 4, 5], sa_column=Column(JSON))
    isActive: bool = Field(default=True)
    overtimeAllowed: bool = Field(default=True)
    overtimeAfterHours: float = Field(default=8.0)
    description: Optional[str] = Field(default=None, max_length=500)


class LaborShiftSchedule(BaseModel, table=True):
    """Scheduled shift instances"""
    __tablename__ = "labor_shift_schedules"

    shiftId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    scheduleDate: datetime = Field(index=True)
    status: ShiftStatus = Field(default=ShiftStatus.SCHEDULED)
    actualStartTime: Optional[datetime] = Field(default=None)
    actualEndTime: Optional[datetime] = Field(default=None)
    scheduledHours: float = Field(default=8.0)
    actualHours: Optional[float] = Field(default=None)
    overtimeHours: float = Field(default=0.0)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class LaborAssignment(BaseModel, table=True):
    """Worker-to-task assignments"""
    __tablename__ = "labor_assignments"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    taskId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    taskType: str = Field(max_length=50, index=True)
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    zone: Optional[str] = Field(default=None, max_length=50)
    status: AssignmentStatus = Field(default=AssignmentStatus.PENDING)
    assignedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assignedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    startedAt: Optional[datetime] = Field(default=None)
    completedAt: Optional[datetime] = Field(default=None)
    estimatedMinutes: Optional[int] = Field(default=None)
    actualMinutes: Optional[int] = Field(default=None)
    priority: int = Field(default=0)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class LaborTimeEntry(BaseModel, table=True):
    """Clock in/out, break tracking"""
    __tablename__ = "labor_time_entries"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    shiftScheduleId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    entryType: TimeEntryType = Field(index=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    deviceId: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=100)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    isManualEntry: bool = Field(default=False)
    approvedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborProductivity(BaseModel, table=True):
    """Performance metrics"""
    __tablename__ = "labor_productivity"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    recordDate: datetime = Field(index=True)
    taskType: str = Field(max_length=50, index=True)
    tasksCompleted: int = Field(default=0)
    unitsProcessed: int = Field(default=0)
    linesProcessed: int = Field(default=0)
    ordersProcessed: int = Field(default=0)
    hoursWorked: float = Field(default=0.0)
    unitsPerHour: float = Field(default=0.0)
    linesPerHour: float = Field(default=0.0)
    accuracyRate: float = Field(default=100.0)
    errorCount: int = Field(default=0)
    targetUnitsPerHour: Optional[float] = Field(default=None)
    performanceScore: float = Field(default=100.0)
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


class LaborStandard(BaseModel, table=True):
    """Expected task durations"""
    __tablename__ = "labor_standards"

    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    taskType: str = Field(max_length=50, index=True)
    zone: Optional[str] = Field(default=None, max_length=50)
    standardName: str = Field(max_length=100)
    unitsPerHour: float = Field(default=0.0)
    linesPerHour: float = Field(default=0.0)
    secondsPerUnit: float = Field(default=0.0)
    secondsPerLine: float = Field(default=0.0)
    setupTimeSeconds: float = Field(default=0.0)
    travelTimePercentage: float = Field(default=10.0)
    allowancePercentage: float = Field(default=15.0)
    effectiveDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expirationDate: Optional[datetime] = Field(default=None)
    isActive: bool = Field(default=True)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class LaborIncentive(BaseModel, table=True):
    """Bonus/incentive tracking"""
    __tablename__ = "labor_incentives"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    incentiveType: IncentiveType = Field(index=True)
    periodStart: datetime = Field(index=True)
    periodEnd: datetime = Field()
    targetValue: Optional[float] = Field(default=None)
    actualValue: Optional[float] = Field(default=None)
    achievementPercentage: float = Field(default=0.0)
    amount: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=3)
    status: str = Field(default="PENDING", max_length=20)
    approvedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    approvedAt: Optional[datetime] = Field(default=None)
    paidAt: Optional[datetime] = Field(default=None)
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborSkill(BaseModel, table=True):
    """Worker skill matrix"""
    __tablename__ = "labor_skills"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    skillName: str = Field(max_length=100, index=True)
    skillCategory: str = Field(max_length=50)
    level: SkillLevel = Field(default=SkillLevel.NOVICE)
    certifiedDate: Optional[datetime] = Field(default=None)
    expirationDate: Optional[datetime] = Field(default=None)
    certifiedBy: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True)
    )
    trainingHours: float = Field(default=0.0)
    assessmentScore: Optional[float] = Field(default=None)
    isActive: bool = Field(default=True)
    notes: Optional[str] = Field(default=None, max_length=500)


# Request/Response Schemas
class LaborShiftCreate(SQLModel):
    """Schema for creating a shift"""
    shiftName: str
    shiftType: ShiftType = ShiftType.MORNING
    warehouseId: UUID
    startTime: str
    endTime: str
    breakDurationMinutes: int = 30
    lunchDurationMinutes: int = 60
    maxWorkers: Optional[int] = None
    minWorkers: Optional[int] = None
    daysOfWeek: List[int] = [1, 2, 3, 4, 5]
    overtimeAllowed: bool = True
    overtimeAfterHours: float = 8.0
    description: Optional[str] = None


class LaborShiftResponse(SQLModel):
    """Response schema for shift"""
    id: UUID
    shiftName: str
    shiftType: ShiftType
    warehouseId: UUID
    startTime: str
    endTime: str
    breakDurationMinutes: int
    lunchDurationMinutes: int
    maxWorkers: Optional[int]
    minWorkers: Optional[int]
    daysOfWeek: List[int]
    isActive: bool
    createdAt: datetime


class LaborAssignmentCreate(SQLModel):
    """Schema for creating an assignment"""
    userId: UUID
    taskId: UUID
    taskType: str
    warehouseId: UUID
    zone: Optional[str] = None
    estimatedMinutes: Optional[int] = None
    priority: int = 0
    notes: Optional[str] = None


class LaborAssignmentResponse(SQLModel):
    """Response schema for assignment"""
    id: UUID
    userId: UUID
    taskId: UUID
    taskType: str
    warehouseId: UUID
    zone: Optional[str]
    status: AssignmentStatus
    assignedAt: datetime
    startedAt: Optional[datetime]
    completedAt: Optional[datetime]
    estimatedMinutes: Optional[int]
    actualMinutes: Optional[int]


class ClockInRequest(SQLModel):
    """Request for clock in"""
    shiftScheduleId: Optional[UUID] = None
    deviceId: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ClockOutRequest(SQLModel):
    """Request for clock out"""
    notes: Optional[str] = None


class TimeEntryResponse(SQLModel):
    """Response for time entry"""
    id: UUID
    userId: UUID
    entryType: TimeEntryType
    timestamp: datetime
    location: Optional[str]
    isManualEntry: bool


class ProductivityResponse(SQLModel):
    """Response for productivity metrics"""
    id: UUID
    userId: UUID
    recordDate: datetime
    taskType: str
    tasksCompleted: int
    unitsProcessed: int
    linesProcessed: int
    hoursWorked: float
    unitsPerHour: float
    accuracyRate: float
    performanceScore: float


class TeamAnalyticsResponse(SQLModel):
    """Response for team analytics"""
    warehouseId: UUID
    periodStart: datetime
    periodEnd: datetime
    totalWorkers: int
    activeWorkers: int
    totalHoursWorked: float
    totalUnitsProcessed: int
    averageUnitsPerHour: float
    averageAccuracyRate: float
    topPerformers: List[dict]
    taskTypeBreakdown: dict


class LeaderboardEntry(SQLModel):
    """Leaderboard entry"""
    rank: int
    userId: UUID
    userName: Optional[str] = None
    unitsProcessed: int
    unitsPerHour: float
    accuracyRate: float
    performanceScore: float


class LeaderboardResponse(SQLModel):
    """Response for leaderboard"""
    warehouseId: UUID
    period: str
    taskType: Optional[str]
    entries: List[LeaderboardEntry]
    generatedAt: datetime
