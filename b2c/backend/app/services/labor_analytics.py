"""
Labor Analytics Service
Provides analytics, metrics, and reporting for labor management
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlmodel import Session, select, func
from sqlalchemy import and_, or_, desc

from app.models.labor_management import (
    LaborShift, LaborShiftSchedule, LaborAssignment,
    LaborTimeEntry, LaborProductivity, LaborStandard,
    LaborIncentive, LaborSkill,
    ShiftStatus, AssignmentStatus, TimeEntryType, SkillLevel,
    TeamAnalyticsResponse, LeaderboardEntry, LeaderboardResponse
)


class LaborAnalyticsService:
    """
    Service for labor analytics and reporting.
    Provides productivity metrics, team analytics, and leaderboards.
    """

    async def calculate_productivity(
        self,
        db: Session,
        user_id: UUID,
        start_date: datetime,
        end_date: datetime,
        task_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate productivity metrics for a user."""
        statement = select(LaborProductivity).where(
            and_(
                LaborProductivity.userId == user_id,
                LaborProductivity.recordDate >= start_date,
                LaborProductivity.recordDate <= end_date
            )
        )

        if task_type:
            statement = statement.where(LaborProductivity.taskType == task_type)

        records = db.exec(statement).all()

        if not records:
            return {
                "userId": str(user_id),
                "periodStart": start_date.isoformat(),
                "periodEnd": end_date.isoformat(),
                "totalHoursWorked": 0,
                "totalUnitsProcessed": 0,
                "totalLinesProcessed": 0,
                "averageUnitsPerHour": 0,
                "averageLinesPerHour": 0,
                "averageAccuracyRate": 0,
                "averagePerformanceScore": 0,
                "recordCount": 0
            }

        total_hours = sum(r.hoursWorked for r in records)
        total_units = sum(r.unitsProcessed for r in records)
        total_lines = sum(r.linesProcessed for r in records)
        total_errors = sum(r.errorCount for r in records)

        return {
            "userId": str(user_id),
            "periodStart": start_date.isoformat(),
            "periodEnd": end_date.isoformat(),
            "totalHoursWorked": total_hours,
            "totalUnitsProcessed": total_units,
            "totalLinesProcessed": total_lines,
            "totalErrors": total_errors,
            "averageUnitsPerHour": total_units / total_hours if total_hours > 0 else 0,
            "averageLinesPerHour": total_lines / total_hours if total_hours > 0 else 0,
            "averageAccuracyRate": sum(r.accuracyRate for r in records) / len(records),
            "averagePerformanceScore": sum(r.performanceScore for r in records) / len(records),
            "recordCount": len(records)
        }

    async def get_team_analytics(
        self,
        db: Session,
        warehouse_id: UUID,
        start_date: datetime,
        end_date: datetime,
        task_type: Optional[str] = None
    ) -> TeamAnalyticsResponse:
        """Get team analytics for a warehouse."""
        statement = select(LaborProductivity).where(
            and_(
                LaborProductivity.warehouseId == warehouse_id,
                LaborProductivity.recordDate >= start_date,
                LaborProductivity.recordDate <= end_date
            )
        )

        if task_type:
            statement = statement.where(LaborProductivity.taskType == task_type)

        records = db.exec(statement).all()

        # Get unique workers
        worker_ids = set(r.userId for r in records)

        # Calculate totals
        total_hours = sum(r.hoursWorked for r in records)
        total_units = sum(r.unitsProcessed for r in records)

        # Task type breakdown
        task_breakdown = {}
        for record in records:
            if record.taskType not in task_breakdown:
                task_breakdown[record.taskType] = {
                    "units": 0,
                    "hours": 0,
                    "workers": set()
                }
            task_breakdown[record.taskType]["units"] += record.unitsProcessed
            task_breakdown[record.taskType]["hours"] += record.hoursWorked
            task_breakdown[record.taskType]["workers"].add(str(record.userId))

        # Convert sets to counts
        for task in task_breakdown:
            task_breakdown[task]["workerCount"] = len(task_breakdown[task]["workers"])
            del task_breakdown[task]["workers"]

        # Get top performers
        worker_totals = {}
        for record in records:
            uid = str(record.userId)
            if uid not in worker_totals:
                worker_totals[uid] = {"units": 0, "hours": 0, "score": 0, "count": 0}
            worker_totals[uid]["units"] += record.unitsProcessed
            worker_totals[uid]["hours"] += record.hoursWorked
            worker_totals[uid]["score"] += record.performanceScore
            worker_totals[uid]["count"] += 1

        top_performers = sorted(
            [
                {
                    "userId": uid,
                    "unitsProcessed": data["units"],
                    "unitsPerHour": data["units"] / data["hours"] if data["hours"] > 0 else 0,
                    "avgPerformanceScore": data["score"] / data["count"]
                }
                for uid, data in worker_totals.items()
            ],
            key=lambda x: x["avgPerformanceScore"],
            reverse=True
        )[:10]

        return TeamAnalyticsResponse(
            warehouseId=warehouse_id,
            periodStart=start_date,
            periodEnd=end_date,
            totalWorkers=len(worker_ids),
            activeWorkers=len(worker_ids),
            totalHoursWorked=total_hours,
            totalUnitsProcessed=total_units,
            averageUnitsPerHour=total_units / total_hours if total_hours > 0 else 0,
            averageAccuracyRate=sum(r.accuracyRate for r in records) / len(records) if records else 0,
            topPerformers=top_performers,
            taskTypeBreakdown=task_breakdown
        )

    async def generate_leaderboard(
        self,
        db: Session,
        warehouse_id: UUID,
        period: str = "daily",
        task_type: Optional[str] = None,
        limit: int = 20
    ) -> LeaderboardResponse:
        """Generate performance leaderboard."""
        # Determine date range
        now = datetime.now(timezone.utc)
        if period == "daily":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
        elif period == "weekly":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
        elif period == "monthly":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now
        else:
            start_date = now - timedelta(days=30)
            end_date = now

        # Get productivity records
        statement = select(LaborProductivity).where(
            and_(
                LaborProductivity.warehouseId == warehouse_id,
                LaborProductivity.recordDate >= start_date,
                LaborProductivity.recordDate <= end_date
            )
        )

        if task_type:
            statement = statement.where(LaborProductivity.taskType == task_type)

        records = db.exec(statement).all()

        # Aggregate by user
        user_stats = {}
        for record in records:
            uid = record.userId
            if uid not in user_stats:
                user_stats[uid] = {
                    "units": 0,
                    "hours": 0,
                    "accuracy_sum": 0,
                    "score_sum": 0,
                    "count": 0
                }
            user_stats[uid]["units"] += record.unitsProcessed
            user_stats[uid]["hours"] += record.hoursWorked
            user_stats[uid]["accuracy_sum"] += record.accuracyRate
            user_stats[uid]["score_sum"] += record.performanceScore
            user_stats[uid]["count"] += 1

        # Calculate averages and sort
        entries = []
        for uid, stats in user_stats.items():
            entries.append({
                "userId": uid,
                "unitsProcessed": stats["units"],
                "unitsPerHour": stats["units"] / stats["hours"] if stats["hours"] > 0 else 0,
                "accuracyRate": stats["accuracy_sum"] / stats["count"],
                "performanceScore": stats["score_sum"] / stats["count"]
            })

        # Sort by performance score
        entries.sort(key=lambda x: x["performanceScore"], reverse=True)

        # Create leaderboard entries
        leaderboard_entries = [
            LeaderboardEntry(
                rank=idx + 1,
                userId=entry["userId"],
                unitsProcessed=entry["unitsProcessed"],
                unitsPerHour=round(entry["unitsPerHour"], 2),
                accuracyRate=round(entry["accuracyRate"], 2),
                performanceScore=round(entry["performanceScore"], 2)
            )
            for idx, entry in enumerate(entries[:limit])
        ]

        return LeaderboardResponse(
            warehouseId=warehouse_id,
            period=period,
            taskType=task_type,
            entries=leaderboard_entries,
            generatedAt=datetime.now(timezone.utc)
        )

    async def calculate_labor_cost(
        self,
        db: Session,
        warehouse_id: UUID,
        start_date: datetime,
        end_date: datetime,
        hourly_rate: float = 150.0
    ) -> Dict[str, Any]:
        """Calculate labor cost for a period."""
        statement = select(LaborProductivity).where(
            and_(
                LaborProductivity.warehouseId == warehouse_id,
                LaborProductivity.recordDate >= start_date,
                LaborProductivity.recordDate <= end_date
            )
        )
        records = db.exec(statement).all()

        total_hours = sum(r.hoursWorked for r in records)
        total_units = sum(r.unitsProcessed for r in records)

        labor_cost = total_hours * hourly_rate
        cost_per_unit = labor_cost / total_units if total_units > 0 else 0

        return {
            "warehouseId": str(warehouse_id),
            "periodStart": start_date.isoformat(),
            "periodEnd": end_date.isoformat(),
            "totalHours": total_hours,
            "hourlyRate": hourly_rate,
            "totalLaborCost": labor_cost,
            "totalUnitsProcessed": total_units,
            "costPerUnit": round(cost_per_unit, 2),
            "currency": "INR"
        }

    async def get_attendance_summary(
        self,
        db: Session,
        warehouse_id: UUID,
        date: datetime
    ) -> Dict[str, Any]:
        """Get attendance summary for a day."""
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        # Get shift schedules for the day
        shift_stmt = select(LaborShiftSchedule).where(
            and_(
                LaborShiftSchedule.scheduleDate >= start_of_day,
                LaborShiftSchedule.scheduleDate < end_of_day
            )
        )
        schedules = db.exec(shift_stmt).all()

        # Get time entries
        time_stmt = select(LaborTimeEntry).where(
            and_(
                LaborTimeEntry.timestamp >= start_of_day,
                LaborTimeEntry.timestamp < end_of_day,
                LaborTimeEntry.entryType == TimeEntryType.CLOCK_IN
            )
        )
        clock_ins = db.exec(time_stmt).all()

        scheduled_count = len(schedules)
        present_count = len(clock_ins)
        absent_count = scheduled_count - present_count

        return {
            "date": date.date().isoformat(),
            "warehouseId": str(warehouse_id),
            "scheduled": scheduled_count,
            "present": present_count,
            "absent": max(0, absent_count),
            "attendanceRate": (present_count / scheduled_count * 100) if scheduled_count > 0 else 0
        }

    async def record_productivity(
        self,
        db: Session,
        user_id: UUID,
        warehouse_id: UUID,
        task_type: str,
        units_processed: int,
        lines_processed: int,
        hours_worked: float,
        error_count: int = 0
    ) -> LaborProductivity:
        """Record productivity metrics."""
        # Get standard for comparison
        standard_stmt = select(LaborStandard).where(
            and_(
                LaborStandard.warehouseId == warehouse_id,
                LaborStandard.taskType == task_type,
                LaborStandard.isActive == True
            )
        )
        standard = db.exec(standard_stmt).first()

        units_per_hour = units_processed / hours_worked if hours_worked > 0 else 0
        lines_per_hour = lines_processed / hours_worked if hours_worked > 0 else 0

        # Calculate accuracy
        total_processed = units_processed + error_count
        accuracy_rate = (units_processed / total_processed * 100) if total_processed > 0 else 100

        # Calculate performance score
        performance_score = 100.0
        if standard and standard.unitsPerHour > 0:
            performance_score = (units_per_hour / standard.unitsPerHour) * 100

        productivity = LaborProductivity(
            userId=user_id,
            warehouseId=warehouse_id,
            recordDate=datetime.now(timezone.utc),
            taskType=task_type,
            unitsProcessed=units_processed,
            linesProcessed=lines_processed,
            hoursWorked=hours_worked,
            unitsPerHour=units_per_hour,
            linesPerHour=lines_per_hour,
            errorCount=error_count,
            accuracyRate=accuracy_rate,
            targetUnitsPerHour=standard.unitsPerHour if standard else None,
            performanceScore=min(150, performance_score)  # Cap at 150%
        )

        db.add(productivity)
        db.commit()
        db.refresh(productivity)

        return productivity


# Global service instance
labor_analytics_service = LaborAnalyticsService()
