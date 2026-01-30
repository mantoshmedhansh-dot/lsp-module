-- Phase 2.1: Labor Management System Migration
-- Creates tables for labor management, shifts, assignments, productivity tracking

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shift Type Enum
DO $$ BEGIN
    CREATE TYPE shift_type AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'SPLIT', 'FLEXIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Shift Status Enum
DO $$ BEGIN
    CREATE TYPE shift_status AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Time Entry Type Enum
DO $$ BEGIN
    CREATE TYPE time_entry_type AS ENUM (
        'CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END', 'LUNCH_START', 'LUNCH_END'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Assignment Status Enum
DO $$ BEGIN
    CREATE TYPE assignment_status AS ENUM (
        'PENDING', 'ACCEPTED', 'STARTED', 'COMPLETED', 'DECLINED', 'REASSIGNED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Skill Level Enum
DO $$ BEGIN
    CREATE TYPE skill_level AS ENUM ('NOVICE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Incentive Type Enum
DO $$ BEGIN
    CREATE TYPE incentive_type AS ENUM (
        'PRODUCTIVITY_BONUS', 'ATTENDANCE_BONUS', 'QUALITY_BONUS',
        'OVERTIME_PREMIUM', 'SHIFT_DIFFERENTIAL', 'REFERRAL_BONUS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ==================== Shift Tables ====================

-- Table: labor_shifts
CREATE TABLE IF NOT EXISTS labor_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "shiftName" VARCHAR(100) NOT NULL,
    "shiftType" VARCHAR(20) DEFAULT 'MORNING',
    "warehouseId" UUID NOT NULL,
    "startTime" VARCHAR(10) NOT NULL,
    "endTime" VARCHAR(10) NOT NULL,
    "breakDurationMinutes" INTEGER DEFAULT 30,
    "lunchDurationMinutes" INTEGER DEFAULT 60,
    "maxWorkers" INTEGER,
    "minWorkers" INTEGER,
    "daysOfWeek" JSONB DEFAULT '[1,2,3,4,5]',
    "isActive" BOOLEAN DEFAULT TRUE,
    "overtimeAllowed" BOOLEAN DEFAULT TRUE,
    "overtimeAfterHours" DECIMAL(4,2) DEFAULT 8.0,
    description VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_shifts_warehouse ON labor_shifts("warehouseId");
CREATE INDEX IF NOT EXISTS idx_labor_shifts_type ON labor_shifts("shiftType");
CREATE INDEX IF NOT EXISTS idx_labor_shifts_active ON labor_shifts("isActive");


-- Table: labor_shift_schedules
CREATE TABLE IF NOT EXISTS labor_shift_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "shiftId" UUID NOT NULL REFERENCES labor_shifts(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL,
    "scheduleDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    "actualStartTime" TIMESTAMP WITH TIME ZONE,
    "actualEndTime" TIMESTAMP WITH TIME ZONE,
    "scheduledHours" DECIMAL(4,2) DEFAULT 8.0,
    "actualHours" DECIMAL(4,2),
    "overtimeHours" DECIMAL(4,2) DEFAULT 0.0,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_schedules_shift ON labor_shift_schedules("shiftId");
CREATE INDEX IF NOT EXISTS idx_shift_schedules_user ON labor_shift_schedules("userId");
CREATE INDEX IF NOT EXISTS idx_shift_schedules_date ON labor_shift_schedules("scheduleDate");
CREATE INDEX IF NOT EXISTS idx_shift_schedules_status ON labor_shift_schedules(status);


-- ==================== Assignment Tables ====================

-- Table: labor_assignments
CREATE TABLE IF NOT EXISTS labor_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "taskType" VARCHAR(50) NOT NULL,
    "warehouseId" UUID NOT NULL,
    zone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "assignedBy" UUID,
    "startedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    priority INTEGER DEFAULT 0,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_assignments_user ON labor_assignments("userId");
CREATE INDEX IF NOT EXISTS idx_labor_assignments_task ON labor_assignments("taskId");
CREATE INDEX IF NOT EXISTS idx_labor_assignments_type ON labor_assignments("taskType");
CREATE INDEX IF NOT EXISTS idx_labor_assignments_warehouse ON labor_assignments("warehouseId");
CREATE INDEX IF NOT EXISTS idx_labor_assignments_status ON labor_assignments(status);


-- ==================== Time Tracking Tables ====================

-- Table: labor_time_entries
CREATE TABLE IF NOT EXISTS labor_time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "shiftScheduleId" UUID REFERENCES labor_shift_schedules(id) ON DELETE SET NULL,
    "entryType" VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "deviceId" VARCHAR(255),
    location VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    "isManualEntry" BOOLEAN DEFAULT FALSE,
    "approvedBy" UUID,
    notes VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user ON labor_time_entries("userId");
CREATE INDEX IF NOT EXISTS idx_time_entries_schedule ON labor_time_entries("shiftScheduleId");
CREATE INDEX IF NOT EXISTS idx_time_entries_type ON labor_time_entries("entryType");
CREATE INDEX IF NOT EXISTS idx_time_entries_timestamp ON labor_time_entries(timestamp);


-- ==================== Productivity Tables ====================

-- Table: labor_productivity
CREATE TABLE IF NOT EXISTS labor_productivity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "recordDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "taskType" VARCHAR(50) NOT NULL,
    "tasksCompleted" INTEGER DEFAULT 0,
    "unitsProcessed" INTEGER DEFAULT 0,
    "linesProcessed" INTEGER DEFAULT 0,
    "ordersProcessed" INTEGER DEFAULT 0,
    "hoursWorked" DECIMAL(6,2) DEFAULT 0.0,
    "unitsPerHour" DECIMAL(8,2) DEFAULT 0.0,
    "linesPerHour" DECIMAL(8,2) DEFAULT 0.0,
    "accuracyRate" DECIMAL(5,2) DEFAULT 100.0,
    "errorCount" INTEGER DEFAULT 0,
    "targetUnitsPerHour" DECIMAL(8,2),
    "performanceScore" DECIMAL(5,2) DEFAULT 100.0,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productivity_user ON labor_productivity("userId");
CREATE INDEX IF NOT EXISTS idx_productivity_warehouse ON labor_productivity("warehouseId");
CREATE INDEX IF NOT EXISTS idx_productivity_date ON labor_productivity("recordDate");
CREATE INDEX IF NOT EXISTS idx_productivity_task_type ON labor_productivity("taskType");


-- Table: labor_standards
CREATE TABLE IF NOT EXISTS labor_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "taskType" VARCHAR(50) NOT NULL,
    zone VARCHAR(50),
    "standardName" VARCHAR(100) NOT NULL,
    "unitsPerHour" DECIMAL(8,2) DEFAULT 0.0,
    "linesPerHour" DECIMAL(8,2) DEFAULT 0.0,
    "secondsPerUnit" DECIMAL(8,2) DEFAULT 0.0,
    "secondsPerLine" DECIMAL(8,2) DEFAULT 0.0,
    "setupTimeSeconds" DECIMAL(8,2) DEFAULT 0.0,
    "travelTimePercentage" DECIMAL(5,2) DEFAULT 10.0,
    "allowancePercentage" DECIMAL(5,2) DEFAULT 15.0,
    "effectiveDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "expirationDate" TIMESTAMP WITH TIME ZONE,
    "isActive" BOOLEAN DEFAULT TRUE,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_standards_warehouse ON labor_standards("warehouseId");
CREATE INDEX IF NOT EXISTS idx_standards_task_type ON labor_standards("taskType");
CREATE INDEX IF NOT EXISTS idx_standards_active ON labor_standards("isActive");


-- ==================== Incentive Tables ====================

-- Table: labor_incentives
CREATE TABLE IF NOT EXISTS labor_incentives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "incentiveType" VARCHAR(30) NOT NULL,
    "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
    "periodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
    "targetValue" DECIMAL(10,2),
    "actualValue" DECIMAL(10,2),
    "achievementPercentage" DECIMAL(5,2) DEFAULT 0.0,
    amount DECIMAL(10,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'PENDING',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP WITH TIME ZONE,
    "paidAt" TIMESTAMP WITH TIME ZONE,
    notes VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incentives_user ON labor_incentives("userId");
CREATE INDEX IF NOT EXISTS idx_incentives_warehouse ON labor_incentives("warehouseId");
CREATE INDEX IF NOT EXISTS idx_incentives_type ON labor_incentives("incentiveType");
CREATE INDEX IF NOT EXISTS idx_incentives_period ON labor_incentives("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS idx_incentives_status ON labor_incentives(status);


-- ==================== Skills Tables ====================

-- Table: labor_skills
CREATE TABLE IF NOT EXISTS labor_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "skillName" VARCHAR(100) NOT NULL,
    "skillCategory" VARCHAR(50) NOT NULL,
    level VARCHAR(20) DEFAULT 'NOVICE',
    "certifiedDate" TIMESTAMP WITH TIME ZONE,
    "expirationDate" TIMESTAMP WITH TIME ZONE,
    "certifiedBy" UUID,
    "trainingHours" DECIMAL(6,2) DEFAULT 0.0,
    "assessmentScore" DECIMAL(5,2),
    "isActive" BOOLEAN DEFAULT TRUE,
    notes VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_user ON labor_skills("userId");
CREATE INDEX IF NOT EXISTS idx_skills_name ON labor_skills("skillName");
CREATE INDEX IF NOT EXISTS idx_skills_category ON labor_skills("skillCategory");
CREATE INDEX IF NOT EXISTS idx_skills_active ON labor_skills("isActive");


-- ==================== Triggers ====================

DROP TRIGGER IF EXISTS update_labor_shifts_updated_at ON labor_shifts;
CREATE TRIGGER update_labor_shifts_updated_at
    BEFORE UPDATE ON labor_shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_shift_schedules_updated_at ON labor_shift_schedules;
CREATE TRIGGER update_labor_shift_schedules_updated_at
    BEFORE UPDATE ON labor_shift_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_assignments_updated_at ON labor_assignments;
CREATE TRIGGER update_labor_assignments_updated_at
    BEFORE UPDATE ON labor_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_time_entries_updated_at ON labor_time_entries;
CREATE TRIGGER update_labor_time_entries_updated_at
    BEFORE UPDATE ON labor_time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_productivity_updated_at ON labor_productivity;
CREATE TRIGGER update_labor_productivity_updated_at
    BEFORE UPDATE ON labor_productivity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_standards_updated_at ON labor_standards;
CREATE TRIGGER update_labor_standards_updated_at
    BEFORE UPDATE ON labor_standards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_incentives_updated_at ON labor_incentives;
CREATE TRIGGER update_labor_incentives_updated_at
    BEFORE UPDATE ON labor_incentives
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_skills_updated_at ON labor_skills;
CREATE TRIGGER update_labor_skills_updated_at
    BEFORE UPDATE ON labor_skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==================== Helper Functions ====================

-- Function to calculate worked hours between clock in and clock out
CREATE OR REPLACE FUNCTION calculate_worked_hours(p_user_id UUID, p_date DATE)
RETURNS DECIMAL AS $$
DECLARE
    clock_in_time TIMESTAMP WITH TIME ZONE;
    clock_out_time TIMESTAMP WITH TIME ZONE;
    total_break_minutes INTEGER := 0;
    worked_hours DECIMAL;
BEGIN
    -- Get clock in time
    SELECT timestamp INTO clock_in_time
    FROM labor_time_entries
    WHERE "userId" = p_user_id
    AND DATE(timestamp) = p_date
    AND "entryType" = 'CLOCK_IN'
    ORDER BY timestamp ASC
    LIMIT 1;

    -- Get clock out time
    SELECT timestamp INTO clock_out_time
    FROM labor_time_entries
    WHERE "userId" = p_user_id
    AND DATE(timestamp) = p_date
    AND "entryType" = 'CLOCK_OUT'
    ORDER BY timestamp DESC
    LIMIT 1;

    IF clock_in_time IS NULL OR clock_out_time IS NULL THEN
        RETURN 0;
    END IF;

    -- Calculate total break time
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
            SELECT MIN(e2.timestamp)
            FROM labor_time_entries e2
            WHERE e2."userId" = p_user_id
            AND DATE(e2.timestamp) = p_date
            AND e2."entryType" IN ('BREAK_END', 'LUNCH_END')
            AND e2.timestamp > e1.timestamp
        ) - e1.timestamp) / 60
    ), 0) INTO total_break_minutes
    FROM labor_time_entries e1
    WHERE e1."userId" = p_user_id
    AND DATE(e1.timestamp) = p_date
    AND e1."entryType" IN ('BREAK_START', 'LUNCH_START');

    -- Calculate worked hours
    worked_hours := EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600
                    - (total_break_minutes / 60.0);

    RETURN ROUND(worked_hours::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql;


-- Function to get user performance score
CREATE OR REPLACE FUNCTION get_user_performance_score(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS DECIMAL AS $$
DECLARE
    avg_score DECIMAL;
BEGIN
    SELECT AVG("performanceScore") INTO avg_score
    FROM labor_productivity
    WHERE "userId" = p_user_id
    AND DATE("recordDate") BETWEEN p_start_date AND p_end_date;

    RETURN COALESCE(avg_score, 0);
END;
$$ LANGUAGE plpgsql;


COMMENT ON TABLE labor_shifts IS 'Shift definitions for warehouse operations';
COMMENT ON TABLE labor_shift_schedules IS 'Scheduled shift instances for workers';
COMMENT ON TABLE labor_assignments IS 'Worker-to-task assignments';
COMMENT ON TABLE labor_time_entries IS 'Clock in/out and break tracking';
COMMENT ON TABLE labor_productivity IS 'Performance metrics per worker';
COMMENT ON TABLE labor_standards IS 'Expected task durations and targets';
COMMENT ON TABLE labor_incentives IS 'Bonus and incentive tracking';
COMMENT ON TABLE labor_skills IS 'Worker skill matrix';
