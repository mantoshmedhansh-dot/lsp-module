"""
Labor Management Models: Shifts, Assignments, Time tracking, Productivity, Skills
For warehouse labor optimization
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date, time
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class ShiftType(str, Enum):
    """Shift types"""
    MORNING = "MORNING"
    AFTERNOON = "AFTERNOON"
    NIGHT = "NIGHT"
    ROTATING = "ROTATING"
    FLEXIBLE = "FLEXIBLE"


class ShiftStatus(str, Enum):
    """Shift status"""
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class AssignmentStatus(str, Enum):
    """Assignment status"""
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TimeEntryType(str, Enum):
    """Time entry types"""
    CLOCK_IN = "CLOCK_IN"
    CLOCK_OUT = "CLOCK_OUT"
    BREAK_START = "BREAK_START"
    BREAK_END = "BREAK_END"
    TASK_START = "TASK_START"
    TASK_END = "TASK_END"


class SkillLevel(str, Enum):
    """Skill proficiency levels"""
    TRAINEE = "TRAINEE"
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    EXPERT = "EXPERT"


class IncentiveType(str, Enum):
    """Incentive types"""
    PRODUCTIVITY_BONUS = "PRODUCTIVITY_BONUS"
    ACCURACY_BONUS = "ACCURACY_BONUS"
    ATTENDANCE_BONUS = "ATTENDANCE_BONUS"
    OVERTIME = "OVERTIME"
    SPECIAL = "SPECIAL"


# ============================================================================
# LaborShift
# ============================================================================

class LaborShiftBase(SQLModel):
    """Labor shift base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    shiftName: str = Field(max_length=100)
    shiftType: ShiftType = Field(index=True)
    startTime: time
    endTime: time
    breakDuration: int = Field(default=30)  # minutes
    isActive: bool = Field(default=True)
    maxWorkers: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=500)


class LaborShift(LaborShiftBase, BaseModel, table=True):
    """Labor shift model"""
    __tablename__ = "LaborShift"


class LaborShiftCreate(SQLModel):
    """Schema for shift creation"""
    locationId: UUID
    shiftName: str
    shiftType: ShiftType
    startTime: time
    endTime: time
    breakDuration: int = 30
    maxWorkers: Optional[int] = None
    description: Optional[str] = None


class LaborShiftResponse(LaborShiftBase):
    """Response schema for shift"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# LaborShiftSchedule
# ============================================================================

class LaborShiftScheduleBase(SQLModel):
    """Labor shift schedule base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    shiftId: UUID = Field(foreign_key="LaborShift.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    scheduleDate: date = Field(index=True)
    status: ShiftStatus = Field(default=ShiftStatus.SCHEDULED, index=True)
    actualStartTime: Optional[datetime] = None
    actualEndTime: Optional[datetime] = None
    totalWorkMinutes: Optional[int] = None
    totalBreakMinutes: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborShiftSchedule(LaborShiftScheduleBase, BaseModel, table=True):
    """Labor shift schedule model"""
    __tablename__ = "LaborShiftSchedule"


class LaborShiftScheduleCreate(SQLModel):
    """Schema for schedule creation"""
    shiftId: UUID
    userId: UUID
    scheduleDate: date
    notes: Optional[str] = None


class LaborShiftScheduleResponse(LaborShiftScheduleBase):
    """Response schema for schedule"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# LaborAssignment
# ============================================================================

class LaborAssignmentBase(SQLModel):
    """Labor assignment base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    shiftScheduleId: Optional[UUID] = Field(default=None, foreign_key="LaborShiftSchedule.id")
    taskType: str = Field(max_length=50, index=True)
    zone: Optional[str] = Field(default=None, max_length=50)
    status: AssignmentStatus = Field(default=AssignmentStatus.PENDING, index=True)
    assignedAt: datetime = Field(default_factory=datetime.utcnow)
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    priority: int = Field(default=0)
    targetQuantity: Optional[int] = None
    actualQuantity: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborAssignment(LaborAssignmentBase, BaseModel, table=True):
    """Labor assignment model"""
    __tablename__ = "LaborAssignment"


class LaborAssignmentCreate(SQLModel):
    """Schema for assignment creation"""
    locationId: UUID
    userId: UUID
    shiftScheduleId: Optional[UUID] = None
    taskType: str
    zone: Optional[str] = None
    priority: int = 0
    targetQuantity: Optional[int] = None
    notes: Optional[str] = None


class LaborAssignmentResponse(LaborAssignmentBase):
    """Response schema for assignment"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# LaborTimeEntry
# ============================================================================

class LaborTimeEntryBase(SQLModel):
    """Labor time entry base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    shiftScheduleId: Optional[UUID] = Field(default=None, foreign_key="LaborShiftSchedule.id")
    entryType: TimeEntryType = Field(index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    location: Optional[str] = Field(default=None, max_length=100)
    deviceId: Optional[UUID] = Field(default=None, foreign_key="MobileDevice.id")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    isManual: bool = Field(default=False)
    approvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborTimeEntry(LaborTimeEntryBase, BaseModel, table=True):
    """Labor time entry model"""
    __tablename__ = "LaborTimeEntry"


class LaborTimeEntryCreate(SQLModel):
    """Schema for time entry creation"""
    entryType: TimeEntryType
    location: Optional[str] = None
    deviceId: Optional[UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class LaborTimeEntryResponse(LaborTimeEntryBase):
    """Response schema for time entry"""
    id: UUID
    createdAt: datetime


# ============================================================================
# LaborProductivity
# ============================================================================

class LaborProductivityBase(SQLModel):
    """Labor productivity base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    recordDate: date = Field(index=True)
    taskType: str = Field(max_length=50, index=True)
    totalTasks: int = Field(default=0)
    completedTasks: int = Field(default=0)
    totalUnits: int = Field(default=0)
    processedUnits: int = Field(default=0)
    totalMinutes: int = Field(default=0)
    unitsPerHour: Decimal = Field(default=Decimal("0"))
    accuracyRate: Decimal = Field(default=Decimal("100"))
    errorCount: int = Field(default=0)
    performanceScore: Decimal = Field(default=Decimal("0"))


class LaborProductivity(LaborProductivityBase, BaseModel, table=True):
    """Labor productivity model"""
    __tablename__ = "LaborProductivity"


class LaborProductivityResponse(LaborProductivityBase):
    """Response schema for productivity"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# LaborStandard
# ============================================================================

class LaborStandardBase(SQLModel):
    """Labor standard base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    taskType: str = Field(max_length=50, index=True)
    standardName: str = Field(max_length=100)
    expectedUnitsPerHour: Decimal
    minimumUnitsPerHour: Decimal
    targetUnitsPerHour: Decimal
    unitOfMeasure: str = Field(default="units", max_length=20)
    isActive: bool = Field(default=True)
    effectiveFrom: date
    effectiveTo: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborStandard(LaborStandardBase, BaseModel, table=True):
    """Labor standard model"""
    __tablename__ = "LaborStandard"


class LaborStandardCreate(SQLModel):
    """Schema for standard creation"""
    locationId: UUID
    taskType: str
    standardName: str
    expectedUnitsPerHour: Decimal
    minimumUnitsPerHour: Decimal
    targetUnitsPerHour: Decimal
    unitOfMeasure: str = "units"
    effectiveFrom: date
    effectiveTo: Optional[date] = None
    notes: Optional[str] = None


class LaborStandardResponse(LaborStandardBase):
    """Response schema for standard"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# LaborIncentive
# ============================================================================

class LaborIncentiveBase(SQLModel):
    """Labor incentive base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    incentiveType: IncentiveType = Field(index=True)
    periodStart: date
    periodEnd: date
    baseAmount: Decimal = Field(default=Decimal("0"))
    earnedAmount: Decimal = Field(default=Decimal("0"))
    targetValue: Optional[Decimal] = None
    actualValue: Optional[Decimal] = None
    achievementPercent: Decimal = Field(default=Decimal("0"))
    isApproved: bool = Field(default=False)
    approvedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    approvedAt: Optional[datetime] = None
    paidAt: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborIncentive(LaborIncentiveBase, BaseModel, table=True):
    """Labor incentive model"""
    __tablename__ = "LaborIncentive"


class LaborIncentiveResponse(LaborIncentiveBase):
    """Response schema for incentive"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# LaborSkill
# ============================================================================

class LaborSkillBase(SQLModel):
    """Labor skill base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    skillName: str = Field(max_length=100, index=True)
    skillCategory: str = Field(max_length=50)
    level: SkillLevel = Field(default=SkillLevel.BEGINNER)
    certifiedAt: Optional[datetime] = None
    certifiedById: Optional[UUID] = Field(default=None, foreign_key="User.id")
    expiresAt: Optional[datetime] = None
    isActive: bool = Field(default=True)
    trainingHours: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class LaborSkill(LaborSkillBase, BaseModel, table=True):
    """Labor skill model"""
    __tablename__ = "LaborSkill"


class LaborSkillCreate(SQLModel):
    """Schema for skill creation"""
    userId: UUID
    skillName: str
    skillCategory: str
    level: SkillLevel = SkillLevel.BEGINNER
    trainingHours: Optional[int] = None
    notes: Optional[str] = None


class LaborSkillResponse(LaborSkillBase):
    """Response schema for skill"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Summary Schemas
# ============================================================================

class LaborDashboardSummary(SQLModel):
    """Labor dashboard summary"""
    totalWorkers: int = 0
    activeWorkers: int = 0
    onBreak: int = 0
    avgProductivity: Decimal = Decimal("0")
    tasksCompleted: int = 0
    tasksPending: int = 0
    topPerformers: List[dict] = []
