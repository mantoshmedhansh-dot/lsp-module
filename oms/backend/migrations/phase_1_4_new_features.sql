-- ============================================================================
-- Phase 1-4: New OMS/WMS Features Migration
-- Date: 2026-01-29
-- Description: WebSocket, Mobile WMS, Labor Management, Slotting, Voice Picking,
--              Cross-Docking, Pre-orders, Subscriptions, Extended Finance, Marketplace
-- Database: OMS Tokyo (rilakxywitslblkgikzf)
-- ============================================================================

-- ============================================================================
-- PHASE 1: Real-time Operations Foundation
-- ============================================================================

-- WebSocket Connections
CREATE TABLE IF NOT EXISTS "WSConnection" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    client_type VARCHAR(50),
    client_version VARCHAR(50),
    user_agent VARCHAR(500),
    ip_address VARCHAR(50),
    status VARCHAR(20) DEFAULT 'CONNECTED',
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    last_ping_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_connection_company ON "WSConnection"(company_id);
CREATE INDEX IF NOT EXISTS idx_ws_connection_user ON "WSConnection"(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_connection_status ON "WSConnection"(status);

-- WebSocket Subscriptions
CREATE TABLE IF NOT EXISTS "WSSubscription" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    connection_id UUID NOT NULL REFERENCES "WSConnection"(id),
    topic VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    filters JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_subscription_company ON "WSSubscription"(company_id);
CREATE INDEX IF NOT EXISTS idx_ws_subscription_connection ON "WSSubscription"(connection_id);
CREATE INDEX IF NOT EXISTS idx_ws_subscription_topic ON "WSSubscription"(topic);

-- WebSocket Events
CREATE TABLE IF NOT EXISTS "WSEvent" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    event_type VARCHAR(50) NOT NULL,
    topic VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    payload JSONB,
    broadcasted_at TIMESTAMPTZ DEFAULT NOW(),
    recipient_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_event_company ON "WSEvent"(company_id);
CREATE INDEX IF NOT EXISTS idx_ws_event_type ON "WSEvent"(event_type);
CREATE INDEX IF NOT EXISTS idx_ws_event_topic ON "WSEvent"(topic);
CREATE INDEX IF NOT EXISTS idx_ws_event_broadcasted ON "WSEvent"(broadcasted_at);

-- Mobile Devices
CREATE TABLE IF NOT EXISTS "MobileDevice" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) DEFAULT 'HANDHELD_SCANNER',
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',
    location_id UUID REFERENCES "Location"(id),
    assigned_user_id UUID REFERENCES "User"(id),
    last_seen_at TIMESTAMPTZ,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    registered_by_id UUID REFERENCES "User"(id),
    auth_token VARCHAR(500),
    token_expires_at TIMESTAMPTZ,
    push_token VARCHAR(500),
    capabilities JSONB,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_device_company ON "MobileDevice"(company_id);
CREATE INDEX IF NOT EXISTS idx_mobile_device_status ON "MobileDevice"(status);
CREATE INDEX IF NOT EXISTS idx_mobile_device_location ON "MobileDevice"(location_id);
CREATE INDEX IF NOT EXISTS idx_mobile_device_user ON "MobileDevice"(assigned_user_id);

-- Mobile Config
CREATE TABLE IF NOT EXISTS "MobileConfig" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string',
    is_encrypted BOOLEAN DEFAULT FALSE,
    description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_config_company ON "MobileConfig"(company_id);
CREATE INDEX IF NOT EXISTS idx_mobile_config_device ON "MobileConfig"(device_id);
CREATE INDEX IF NOT EXISTS idx_mobile_config_key ON "MobileConfig"(config_key);

-- Device Location Log
CREATE TABLE IF NOT EXISTS "DeviceLocationLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    warehouse_zone VARCHAR(50),
    aisle VARCHAR(20),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_location_company ON "DeviceLocationLog"(company_id);
CREATE INDEX IF NOT EXISTS idx_device_location_device ON "DeviceLocationLog"(device_id);
CREATE INDEX IF NOT EXISTS idx_device_location_recorded ON "DeviceLocationLog"(recorded_at);

-- Barcode Scan Log
CREATE TABLE IF NOT EXISTS "BarcodeScanLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    scan_type VARCHAR(50) NOT NULL,
    barcode VARCHAR(255) NOT NULL,
    scanned_value VARCHAR(500),
    resolved_entity_id UUID,
    resolved_entity_type VARCHAR(50),
    is_successful BOOLEAN DEFAULT TRUE,
    error_message VARCHAR(500),
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    location VARCHAR(100),
    task_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barcode_scan_company ON "BarcodeScanLog"(company_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_device ON "BarcodeScanLog"(device_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_user ON "BarcodeScanLog"(user_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_type ON "BarcodeScanLog"(scan_type);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_barcode ON "BarcodeScanLog"(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_at ON "BarcodeScanLog"(scanned_at);

-- Mobile Sessions
CREATE TABLE IF NOT EXISTS "MobileSession" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    session_token VARCHAR(500) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    current_zone VARCHAR(50),
    current_aisle VARCHAR(20),
    tasks_completed INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    session_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_session_company ON "MobileSession"(company_id);
CREATE INDEX IF NOT EXISTS idx_mobile_session_device ON "MobileSession"(device_id);
CREATE INDEX IF NOT EXISTS idx_mobile_session_user ON "MobileSession"(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_session_status ON "MobileSession"(status);

-- Mobile Tasks
CREATE TABLE IF NOT EXISTS "MobileTask" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    session_id UUID REFERENCES "MobileSession"(id),
    task_no VARCHAR(50) UNIQUE NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    priority VARCHAR(20) DEFAULT 'NORMAL',
    location_id UUID NOT NULL REFERENCES "Location"(id),
    assigned_user_id UUID REFERENCES "User"(id),
    source_entity_type VARCHAR(50),
    source_entity_id UUID,
    source_zone VARCHAR(50),
    source_bin VARCHAR(50),
    target_zone VARCHAR(50),
    target_bin VARCHAR(50),
    total_lines INTEGER DEFAULT 0,
    completed_lines INTEGER DEFAULT 0,
    total_quantity NUMERIC(15,4) DEFAULT 0,
    completed_quantity NUMERIC(15,4) DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_duration INTEGER,
    actual_duration INTEGER,
    instructions VARCHAR(1000),
    task_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_task_company ON "MobileTask"(company_id);
CREATE INDEX IF NOT EXISTS idx_mobile_task_session ON "MobileTask"(session_id);
CREATE INDEX IF NOT EXISTS idx_mobile_task_type ON "MobileTask"(task_type);
CREATE INDEX IF NOT EXISTS idx_mobile_task_status ON "MobileTask"(status);
CREATE INDEX IF NOT EXISTS idx_mobile_task_priority ON "MobileTask"(priority);
CREATE INDEX IF NOT EXISTS idx_mobile_task_location ON "MobileTask"(location_id);
CREATE INDEX IF NOT EXISTS idx_mobile_task_user ON "MobileTask"(assigned_user_id);

-- Mobile Task Lines
CREATE TABLE IF NOT EXISTS "MobileTaskLine" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    task_id UUID NOT NULL REFERENCES "MobileTask"(id),
    line_no INTEGER DEFAULT 1,
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    sku_code VARCHAR(100) NOT NULL,
    sku_name VARCHAR(255),
    barcode VARCHAR(100),
    required_quantity NUMERIC(15,4) NOT NULL,
    completed_quantity NUMERIC(15,4) DEFAULT 0,
    source_bin VARCHAR(50),
    target_bin VARCHAR(50),
    lot_no VARCHAR(100),
    serial_no VARCHAR(100),
    expiry_date TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by_id UUID REFERENCES "User"(id),
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_task_line_company ON "MobileTaskLine"(company_id);
CREATE INDEX IF NOT EXISTS idx_mobile_task_line_task ON "MobileTaskLine"(task_id);
CREATE INDEX IF NOT EXISTS idx_mobile_task_line_sku ON "MobileTaskLine"(sku_id);

-- Offline Sync Queue
CREATE TABLE IF NOT EXISTS "OfflineSyncQueue" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    session_id UUID REFERENCES "MobileSession"(id),
    operation_type VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    local_id VARCHAR(100),
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    server_entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_company ON "OfflineSyncQueue"(company_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_device ON "OfflineSyncQueue"(device_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON "OfflineSyncQueue"(status);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queued ON "OfflineSyncQueue"(queued_at);
CREATE INDEX IF NOT EXISTS idx_offline_sync_local ON "OfflineSyncQueue"(local_id);

-- Sync Checkpoints
CREATE TABLE IF NOT EXISTS "SyncCheckpoint" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    entity_type VARCHAR(50) NOT NULL,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_id UUID,
    sync_version INTEGER DEFAULT 0,
    record_count INTEGER DEFAULT 0,
    checkpoint_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_checkpoint_company ON "SyncCheckpoint"(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_checkpoint_device ON "SyncCheckpoint"(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_checkpoint_entity ON "SyncCheckpoint"(entity_type);

-- Sync Conflicts
CREATE TABLE IF NOT EXISTS "SyncConflict" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    sync_queue_id UUID NOT NULL REFERENCES "OfflineSyncQueue"(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    client_data JSONB NOT NULL,
    server_data JSONB NOT NULL,
    conflict_fields JSONB DEFAULT '[]',
    resolution VARCHAR(20),
    resolved_data JSONB,
    resolved_at TIMESTAMPTZ,
    resolved_by_id UUID REFERENCES "User"(id),
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_conflict_company ON "SyncConflict"(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflict_queue ON "SyncConflict"(sync_queue_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflict_entity ON "SyncConflict"(entity_type);

-- Sync Batches
CREATE TABLE IF NOT EXISTS "SyncBatch" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    direction VARCHAR(10) NOT NULL,
    total_operations INTEGER DEFAULT 0,
    completed_operations INTEGER DEFAULT 0,
    failed_operations INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_batch_company ON "SyncBatch"(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_batch_device ON "SyncBatch"(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_batch_status ON "SyncBatch"(status);

-- ============================================================================
-- PHASE 2: Labor & Warehouse Optimization
-- ============================================================================

-- Labor Shifts
CREATE TABLE IF NOT EXISTS "LaborShift" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    shift_name VARCHAR(100) NOT NULL,
    shift_type VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    max_workers INTEGER,
    description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_shift_company ON "LaborShift"(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_shift_location ON "LaborShift"(location_id);
CREATE INDEX IF NOT EXISTS idx_labor_shift_type ON "LaborShift"(shift_type);

-- Labor Shift Schedules
CREATE TABLE IF NOT EXISTS "LaborShiftSchedule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    shift_id UUID NOT NULL REFERENCES "LaborShift"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    schedule_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    total_work_minutes INTEGER,
    total_break_minutes INTEGER,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_schedule_company ON "LaborShiftSchedule"(company_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedule_shift ON "LaborShiftSchedule"(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedule_user ON "LaborShiftSchedule"(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedule_date ON "LaborShiftSchedule"(schedule_date);
CREATE INDEX IF NOT EXISTS idx_shift_schedule_status ON "LaborShiftSchedule"(status);

-- Labor Assignments
CREATE TABLE IF NOT EXISTS "LaborAssignment" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    shift_schedule_id UUID REFERENCES "LaborShiftSchedule"(id),
    task_type VARCHAR(50) NOT NULL,
    zone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,
    target_quantity INTEGER,
    actual_quantity INTEGER,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_assignment_company ON "LaborAssignment"(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_assignment_location ON "LaborAssignment"(location_id);
CREATE INDEX IF NOT EXISTS idx_labor_assignment_user ON "LaborAssignment"(user_id);
CREATE INDEX IF NOT EXISTS idx_labor_assignment_type ON "LaborAssignment"(task_type);
CREATE INDEX IF NOT EXISTS idx_labor_assignment_status ON "LaborAssignment"(status);

-- Labor Time Entries
CREATE TABLE IF NOT EXISTS "LaborTimeEntry" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    shift_schedule_id UUID REFERENCES "LaborShiftSchedule"(id),
    entry_type VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    location VARCHAR(100),
    device_id UUID REFERENCES "MobileDevice"(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_manual BOOLEAN DEFAULT FALSE,
    approved_by_id UUID REFERENCES "User"(id),
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entry_company ON "LaborTimeEntry"(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_user ON "LaborTimeEntry"(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_type ON "LaborTimeEntry"(entry_type);
CREATE INDEX IF NOT EXISTS idx_time_entry_timestamp ON "LaborTimeEntry"(timestamp);

-- Labor Productivity
CREATE TABLE IF NOT EXISTS "LaborProductivity" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    record_date DATE NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    processed_units INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    units_per_hour NUMERIC(10,2) DEFAULT 0,
    accuracy_rate NUMERIC(5,2) DEFAULT 100,
    error_count INTEGER DEFAULT 0,
    performance_score NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productivity_company ON "LaborProductivity"(company_id);
CREATE INDEX IF NOT EXISTS idx_productivity_user ON "LaborProductivity"(user_id);
CREATE INDEX IF NOT EXISTS idx_productivity_location ON "LaborProductivity"(location_id);
CREATE INDEX IF NOT EXISTS idx_productivity_date ON "LaborProductivity"(record_date);
CREATE INDEX IF NOT EXISTS idx_productivity_type ON "LaborProductivity"(task_type);

-- Labor Standards
CREATE TABLE IF NOT EXISTS "LaborStandard" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    task_type VARCHAR(50) NOT NULL,
    standard_name VARCHAR(100) NOT NULL,
    expected_units_per_hour NUMERIC(10,2) NOT NULL,
    minimum_units_per_hour NUMERIC(10,2) NOT NULL,
    target_units_per_hour NUMERIC(10,2) NOT NULL,
    unit_of_measure VARCHAR(20) DEFAULT 'units',
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_standard_company ON "LaborStandard"(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_standard_location ON "LaborStandard"(location_id);
CREATE INDEX IF NOT EXISTS idx_labor_standard_type ON "LaborStandard"(task_type);

-- Labor Incentives
CREATE TABLE IF NOT EXISTS "LaborIncentive" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    incentive_type VARCHAR(30) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    base_amount NUMERIC(15,2) DEFAULT 0,
    earned_amount NUMERIC(15,2) DEFAULT 0,
    target_value NUMERIC(15,2),
    actual_value NUMERIC(15,2),
    achievement_percent NUMERIC(5,2) DEFAULT 0,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by_id UUID REFERENCES "User"(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incentive_company ON "LaborIncentive"(company_id);
CREATE INDEX IF NOT EXISTS idx_incentive_user ON "LaborIncentive"(user_id);
CREATE INDEX IF NOT EXISTS idx_incentive_type ON "LaborIncentive"(incentive_type);

-- Labor Skills
CREATE TABLE IF NOT EXISTS "LaborSkill" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(50) NOT NULL,
    level VARCHAR(20) DEFAULT 'BEGINNER',
    certified_at TIMESTAMPTZ,
    certified_by_id UUID REFERENCES "User"(id),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    training_hours INTEGER,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_company ON "LaborSkill"(company_id);
CREATE INDEX IF NOT EXISTS idx_skill_user ON "LaborSkill"(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_name ON "LaborSkill"(skill_name);

-- SKU Velocity
CREATE TABLE IF NOT EXISTS "SkuVelocity" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    analysis_date DATE NOT NULL,
    period_days INTEGER DEFAULT 30,
    total_picks INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    avg_daily_picks NUMERIC(10,2) DEFAULT 0,
    avg_daily_units NUMERIC(10,2) DEFAULT 0,
    pick_frequency NUMERIC(10,2) DEFAULT 0,
    velocity_class VARCHAR(5) DEFAULT 'C',
    demand_variability NUMERIC(10,2) DEFAULT 0,
    avg_order_quantity NUMERIC(10,2) DEFAULT 0,
    peak_day_picks INTEGER DEFAULT 0,
    last_pick_date DATE,
    days_since_last_pick INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_velocity_company ON "SkuVelocity"(company_id);
CREATE INDEX IF NOT EXISTS idx_sku_velocity_sku ON "SkuVelocity"(sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_velocity_location ON "SkuVelocity"(location_id);
CREATE INDEX IF NOT EXISTS idx_sku_velocity_date ON "SkuVelocity"(analysis_date);
CREATE INDEX IF NOT EXISTS idx_sku_velocity_class ON "SkuVelocity"(velocity_class);

-- Bin Characteristics
CREATE TABLE IF NOT EXISTS "BinCharacteristics" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    bin_id UUID NOT NULL REFERENCES "Bin"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    zone_id UUID NOT NULL REFERENCES "Zone"(id),
    pick_zone VARCHAR(50) NOT NULL,
    aisle VARCHAR(20) NOT NULL,
    level INTEGER DEFAULT 1,
    position INTEGER DEFAULT 1,
    height_cm NUMERIC(10,2),
    width_cm NUMERIC(10,2),
    depth_cm NUMERIC(10,2),
    volume_cubic_cm NUMERIC(15,2),
    max_weight_kg NUMERIC(10,2),
    current_weight_kg NUMERIC(10,2) DEFAULT 0,
    utilization_percent NUMERIC(5,2) DEFAULT 0,
    accessibility_score INTEGER DEFAULT 5,
    ergonomic_score INTEGER DEFAULT 5,
    distance_from_dock INTEGER,
    pick_path_sequence INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bin_char_company ON "BinCharacteristics"(company_id);
CREATE INDEX IF NOT EXISTS idx_bin_char_bin ON "BinCharacteristics"(bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_char_location ON "BinCharacteristics"(location_id);
CREATE INDEX IF NOT EXISTS idx_bin_char_zone ON "BinCharacteristics"(pick_zone);
CREATE INDEX IF NOT EXISTS idx_bin_char_aisle ON "BinCharacteristics"(aisle);

-- Slotting Rules
CREATE TABLE IF NOT EXISTS "SlottingRule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    rule_name VARCHAR(100) NOT NULL,
    rule_description VARCHAR(500),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    velocity_classes JSONB DEFAULT '[]',
    target_zones JSONB DEFAULT '[]',
    bin_level_min INTEGER,
    bin_level_max INTEGER,
    min_accessibility_score INTEGER,
    max_distance_from_dock INTEGER,
    category_filters JSONB,
    attribute_filters JSONB,
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slotting_rule_company ON "SlottingRule"(company_id);
CREATE INDEX IF NOT EXISTS idx_slotting_rule_location ON "SlottingRule"(location_id);
CREATE INDEX IF NOT EXISTS idx_slotting_rule_priority ON "SlottingRule"(priority);

-- Slotting Recommendations
CREATE TABLE IF NOT EXISTS "SlottingRecommendation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    recommendation_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    current_bin_id UUID REFERENCES "Bin"(id),
    suggested_bin_id UUID,
    current_zone VARCHAR(50),
    suggested_zone VARCHAR(50),
    reason VARCHAR(500) NOT NULL,
    expected_benefit VARCHAR(500),
    priority_score NUMERIC(10,2) DEFAULT 0,
    estimated_pick_reduction NUMERIC(10,2),
    estimated_travel_reduction NUMERIC(10,2),
    rule_id UUID REFERENCES "SlottingRule"(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    approved_by_id UUID REFERENCES "User"(id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slotting_rec_company ON "SlottingRecommendation"(company_id);
CREATE INDEX IF NOT EXISTS idx_slotting_rec_location ON "SlottingRecommendation"(location_id);
CREATE INDEX IF NOT EXISTS idx_slotting_rec_sku ON "SlottingRecommendation"(sku_id);
CREATE INDEX IF NOT EXISTS idx_slotting_rec_type ON "SlottingRecommendation"(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_slotting_rec_status ON "SlottingRecommendation"(status);
CREATE INDEX IF NOT EXISTS idx_slotting_rec_generated ON "SlottingRecommendation"(generated_at);

-- Voice Profiles
CREATE TABLE IF NOT EXISTS "VoiceProfile" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID UNIQUE NOT NULL REFERENCES "User"(id),
    language VARCHAR(10) DEFAULT 'EN_US',
    speech_rate INTEGER DEFAULT 100,
    volume INTEGER DEFAULT 80,
    confirmation_mode VARCHAR(20) DEFAULT 'digit',
    repeat_count INTEGER DEFAULT 2,
    timeout_seconds INTEGER DEFAULT 10,
    is_training_complete BOOLEAN DEFAULT FALSE,
    training_completed_at TIMESTAMPTZ,
    voice_model_data JSONB,
    custom_vocabulary JSONB,
    preferences JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_profile_company ON "VoiceProfile"(company_id);
CREATE INDEX IF NOT EXISTS idx_voice_profile_user ON "VoiceProfile"(user_id);

-- Voice Commands
CREATE TABLE IF NOT EXISTS "VoiceCommand" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    command_type VARCHAR(30) NOT NULL,
    language VARCHAR(10) NOT NULL,
    spoken_phrases JSONB DEFAULT '[]',
    response_template TEXT NOT NULL,
    confirmation_required BOOLEAN DEFAULT FALSE,
    parameters JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_command_company ON "VoiceCommand"(company_id);
CREATE INDEX IF NOT EXISTS idx_voice_command_type ON "VoiceCommand"(command_type);
CREATE INDEX IF NOT EXISTS idx_voice_command_language ON "VoiceCommand"(language);

-- Voice Sessions
CREATE TABLE IF NOT EXISTS "VoiceSession" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    user_id UUID NOT NULL REFERENCES "User"(id),
    device_id UUID NOT NULL REFERENCES "MobileDevice"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    session_token VARCHAR(500) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    task_id UUID REFERENCES "MobileTask"(id),
    picklist_id UUID REFERENCES "Picklist"(id),
    language VARCHAR(10) DEFAULT 'EN_US',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_commands INTEGER DEFAULT 0,
    successful_commands INTEGER DEFAULT 0,
    error_commands INTEGER DEFAULT 0,
    total_picks INTEGER DEFAULT 0,
    completed_picks INTEGER DEFAULT 0,
    avg_response_time NUMERIC(10,2),
    session_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_session_company ON "VoiceSession"(company_id);
CREATE INDEX IF NOT EXISTS idx_voice_session_user ON "VoiceSession"(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_session_device ON "VoiceSession"(device_id);
CREATE INDEX IF NOT EXISTS idx_voice_session_status ON "VoiceSession"(status);

-- Voice Interactions
CREATE TABLE IF NOT EXISTS "VoiceInteraction" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    session_id UUID NOT NULL REFERENCES "VoiceSession"(id),
    sequence_no INTEGER NOT NULL,
    command_type VARCHAR(30),
    spoken_input TEXT,
    recognized_text TEXT,
    confidence NUMERIC(5,4),
    system_response TEXT,
    is_successful BOOLEAN DEFAULT TRUE,
    error_type VARCHAR(50),
    response_time_ms INTEGER,
    context JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_interaction_company ON "VoiceInteraction"(company_id);
CREATE INDEX IF NOT EXISTS idx_voice_interaction_session ON "VoiceInteraction"(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_interaction_timestamp ON "VoiceInteraction"(timestamp);

-- ============================================================================
-- PHASE 3: Advanced Fulfillment
-- ============================================================================

-- Cross-Dock Rules
CREATE TABLE IF NOT EXISTS "CrossDockRule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    description VARCHAR(500),
    conditions JSONB DEFAULT '{}',
    channels JSONB,
    customer_ids JSONB,
    sku_categories JSONB,
    min_order_value NUMERIC(15,2),
    max_order_age INTEGER,
    target_staging_area VARCHAR(50),
    auto_allocate BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crossdock_rule_company ON "CrossDockRule"(company_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_rule_location ON "CrossDockRule"(location_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_rule_type ON "CrossDockRule"(rule_type);
CREATE INDEX IF NOT EXISTS idx_crossdock_rule_priority ON "CrossDockRule"(priority);

-- Cross-Dock Orders
CREATE TABLE IF NOT EXISTS "CrossDockOrder" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    order_id UUID NOT NULL REFERENCES "Order"(id),
    order_no VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    rule_id UUID REFERENCES "CrossDockRule"(id),
    inbound_asn_id UUID,
    inbound_expected_at TIMESTAMPTZ,
    inbound_received_at TIMESTAMPTZ,
    staging_area_id UUID,
    staged_at TIMESTAMPTZ,
    outbound_manifest_id UUID,
    shipped_at TIMESTAMPTZ,
    total_items INTEGER DEFAULT 0,
    allocated_items INTEGER DEFAULT 0,
    received_items INTEGER DEFAULT 0,
    loaded_items INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crossdock_order_company ON "CrossDockOrder"(company_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_order_location ON "CrossDockOrder"(location_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_order_order ON "CrossDockOrder"(order_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_order_status ON "CrossDockOrder"(status);

-- Cross-Dock Allocations
CREATE TABLE IF NOT EXISTS "CrossDockAllocation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    cross_dock_order_id UUID NOT NULL REFERENCES "CrossDockOrder"(id),
    order_id UUID NOT NULL REFERENCES "Order"(id),
    order_item_id UUID NOT NULL REFERENCES "OrderItem"(id),
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    inbound_line_id UUID,
    allocated_quantity NUMERIC(15,4) NOT NULL,
    received_quantity NUMERIC(15,4) DEFAULT 0,
    loaded_quantity NUMERIC(15,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ALLOCATED',
    staging_location VARCHAR(50),
    lot_no VARCHAR(100),
    serial_numbers JSONB,
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crossdock_alloc_company ON "CrossDockAllocation"(company_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_alloc_order ON "CrossDockAllocation"(cross_dock_order_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_alloc_sku ON "CrossDockAllocation"(sku_id);
CREATE INDEX IF NOT EXISTS idx_crossdock_alloc_status ON "CrossDockAllocation"(status);

-- Staging Areas
CREATE TABLE IF NOT EXISTS "StagingArea" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    area_code VARCHAR(50) UNIQUE NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    area_type VARCHAR(50) DEFAULT 'CROSS_DOCK',
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    capacity INTEGER DEFAULT 100,
    current_count INTEGER DEFAULT 0,
    dock_door VARCHAR(20),
    assigned_transporter_id UUID REFERENCES "Transporter"(id),
    assigned_route VARCHAR(100),
    reserved_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staging_area_company ON "StagingArea"(company_id);
CREATE INDEX IF NOT EXISTS idx_staging_area_location ON "StagingArea"(location_id);
CREATE INDEX IF NOT EXISTS idx_staging_area_status ON "StagingArea"(status);

-- Preorders
CREATE TABLE IF NOT EXISTS "Preorder" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    preorder_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES "Customer"(id),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    channel VARCHAR(50),
    external_order_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'DRAFT',
    location_id UUID NOT NULL REFERENCES "Location"(id),
    expected_available_date DATE,
    expiry_date DATE,
    total_items INTEGER DEFAULT 0,
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) DEFAULT 0,
    deposit_amount NUMERIC(15,2) DEFAULT 0,
    deposit_paid_at TIMESTAMPTZ,
    converted_order_id UUID REFERENCES "Order"(id),
    converted_at TIMESTAMPTZ,
    notes VARCHAR(1000),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorder_company ON "Preorder"(company_id);
CREATE INDEX IF NOT EXISTS idx_preorder_customer ON "Preorder"(customer_id);
CREATE INDEX IF NOT EXISTS idx_preorder_channel ON "Preorder"(channel);
CREATE INDEX IF NOT EXISTS idx_preorder_status ON "Preorder"(status);
CREATE INDEX IF NOT EXISTS idx_preorder_location ON "Preorder"(location_id);

-- Preorder Lines
CREATE TABLE IF NOT EXISTS "PreorderLine" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    preorder_id UUID NOT NULL REFERENCES "Preorder"(id),
    line_no INTEGER DEFAULT 1,
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    sku_code VARCHAR(100) NOT NULL,
    sku_name VARCHAR(255),
    quantity NUMERIC(15,4) NOT NULL,
    allocated_quantity NUMERIC(15,4) DEFAULT 0,
    unit_price NUMERIC(15,2) NOT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    line_total NUMERIC(15,2) NOT NULL,
    expected_available_date DATE,
    is_allocated BOOLEAN DEFAULT FALSE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorder_line_company ON "PreorderLine"(company_id);
CREATE INDEX IF NOT EXISTS idx_preorder_line_preorder ON "PreorderLine"(preorder_id);
CREATE INDEX IF NOT EXISTS idx_preorder_line_sku ON "PreorderLine"(sku_id);

-- Preorder Inventory
CREATE TABLE IF NOT EXISTS "PreorderInventory" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    preorder_id UUID NOT NULL REFERENCES "Preorder"(id),
    preorder_line_id UUID NOT NULL REFERENCES "PreorderLine"(id),
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    location_id UUID NOT NULL REFERENCES "Location"(id),
    reserved_quantity NUMERIC(15,4) NOT NULL,
    fulfilled_quantity NUMERIC(15,4) DEFAULT 0,
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    expected_arrival_date DATE,
    source_type VARCHAR(50),
    source_id UUID,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorder_inv_company ON "PreorderInventory"(company_id);
CREATE INDEX IF NOT EXISTS idx_preorder_inv_preorder ON "PreorderInventory"(preorder_id);
CREATE INDEX IF NOT EXISTS idx_preorder_inv_sku ON "PreorderInventory"(sku_id);
CREATE INDEX IF NOT EXISTS idx_preorder_inv_location ON "PreorderInventory"(location_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS "Subscription" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    subscription_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES "Customer"(id),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'DRAFT',
    frequency VARCHAR(20) NOT NULL,
    custom_interval_days INTEGER,
    location_id UUID NOT NULL REFERENCES "Location"(id),
    shipping_address_id UUID,
    billing_address_id UUID,
    start_date DATE NOT NULL,
    end_date DATE,
    next_delivery_date DATE,
    last_delivery_date DATE,
    total_deliveries INTEGER DEFAULT 0,
    completed_deliveries INTEGER DEFAULT 0,
    max_deliveries INTEGER,
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    shipping_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_token_id VARCHAR(255),
    auto_renew BOOLEAN DEFAULT TRUE,
    reminder_days INTEGER DEFAULT 3,
    paused_at TIMESTAMPTZ,
    paused_until DATE,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(500),
    notes VARCHAR(1000),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_company ON "Subscription"(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_customer ON "Subscription"(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON "Subscription"(status);
CREATE INDEX IF NOT EXISTS idx_subscription_frequency ON "Subscription"(frequency);
CREATE INDEX IF NOT EXISTS idx_subscription_location ON "Subscription"(location_id);

-- Subscription Lines
CREATE TABLE IF NOT EXISTS "SubscriptionLine" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    subscription_id UUID NOT NULL REFERENCES "Subscription"(id),
    line_no INTEGER DEFAULT 1,
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    sku_code VARCHAR(100) NOT NULL,
    sku_name VARCHAR(255),
    quantity NUMERIC(15,4) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    line_total NUMERIC(15,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_line_company ON "SubscriptionLine"(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_line_subscription ON "SubscriptionLine"(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_line_sku ON "SubscriptionLine"(sku_id);

-- Subscription Schedules
CREATE TABLE IF NOT EXISTS "SubscriptionSchedule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    subscription_id UUID NOT NULL REFERENCES "Subscription"(id),
    sequence_no INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    order_id UUID REFERENCES "Order"(id),
    order_no VARCHAR(50),
    generated_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_message VARCHAR(500),
    skip_reason VARCHAR(500),
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_sched_company ON "SubscriptionSchedule"(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_sched_subscription ON "SubscriptionSchedule"(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_sched_date ON "SubscriptionSchedule"(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_subscription_sched_status ON "SubscriptionSchedule"(status);

-- Subscription History
CREATE TABLE IF NOT EXISTS "SubscriptionHistory" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    subscription_id UUID NOT NULL REFERENCES "Subscription"(id),
    action_type VARCHAR(50) NOT NULL,
    action_date TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES "User"(id),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    changes JSONB,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_hist_company ON "SubscriptionHistory"(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_hist_subscription ON "SubscriptionHistory"(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_hist_type ON "SubscriptionHistory"(action_type);
CREATE INDEX IF NOT EXISTS idx_subscription_hist_date ON "SubscriptionHistory"(action_date);

-- ============================================================================
-- PHASE 4: Financial & Marketplace Integration
-- ============================================================================

-- Payment Settlements
CREATE TABLE IF NOT EXISTS "PaymentSettlement" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    settlement_no VARCHAR(50) UNIQUE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    transporter_id UUID REFERENCES "Transporter"(id),
    status VARCHAR(30) DEFAULT 'PENDING',
    settlement_date DATE NOT NULL,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    gross_amount NUMERIC(15,2) DEFAULT 0,
    commission_amount NUMERIC(15,2) DEFAULT 0,
    tds_amount NUMERIC(15,2) DEFAULT 0,
    shipping_deduction NUMERIC(15,2) DEFAULT 0,
    other_deductions NUMERIC(15,2) DEFAULT 0,
    net_amount NUMERIC(15,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    matched_orders INTEGER DEFAULT 0,
    unmatched_orders INTEGER DEFAULT 0,
    bank_reference VARCHAR(100),
    bank_account_no VARCHAR(50),
    received_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,
    reconciled_by_id UUID REFERENCES "User"(id),
    file_url VARCHAR(500),
    raw_data JSONB,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_company ON "PaymentSettlement"(company_id);
CREATE INDEX IF NOT EXISTS idx_settlement_channel ON "PaymentSettlement"(channel);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON "PaymentSettlement"(status);
CREATE INDEX IF NOT EXISTS idx_settlement_date ON "PaymentSettlement"(settlement_date);

-- Chargebacks
CREATE TABLE IF NOT EXISTS "Chargeback" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    chargeback_no VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES "Order"(id),
    order_no VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'RECEIVED',
    reason VARCHAR(50) NOT NULL,
    reason_detail VARCHAR(500),
    chargeback_amount NUMERIC(15,2) NOT NULL,
    original_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    chargeback_date DATE NOT NULL,
    deadline_date DATE,
    payment_gateway_ref VARCHAR(100),
    card_last4 VARCHAR(4),
    evidence_submitted_at TIMESTAMPTZ,
    evidence_data JSONB,
    resolved_at TIMESTAMPTZ,
    resolved_by_id UUID REFERENCES "User"(id),
    outcome VARCHAR(50),
    outcome_amount NUMERIC(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chargeback_company ON "Chargeback"(company_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_order ON "Chargeback"(order_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_channel ON "Chargeback"(channel);
CREATE INDEX IF NOT EXISTS idx_chargeback_status ON "Chargeback"(status);
CREATE INDEX IF NOT EXISTS idx_chargeback_date ON "Chargeback"(chargeback_date);

-- Escrow Holds
CREATE TABLE IF NOT EXISTS "EscrowHold" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    escrow_no VARCHAR(50) UNIQUE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    order_id UUID REFERENCES "Order"(id),
    order_no VARCHAR(50),
    status VARCHAR(20) DEFAULT 'HELD',
    hold_reason VARCHAR(100) NOT NULL,
    hold_amount NUMERIC(15,2) NOT NULL,
    released_amount NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    hold_date DATE NOT NULL,
    expected_release_date DATE,
    actual_release_date DATE,
    released_by_id UUID REFERENCES "User"(id),
    partial_releases JSONB,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_company ON "EscrowHold"(company_id);
CREATE INDEX IF NOT EXISTS idx_escrow_channel ON "EscrowHold"(channel);
CREATE INDEX IF NOT EXISTS idx_escrow_order ON "EscrowHold"(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON "EscrowHold"(status);
CREATE INDEX IF NOT EXISTS idx_escrow_date ON "EscrowHold"(hold_date);

-- Reconciliation Discrepancies
CREATE TABLE IF NOT EXISTS "ReconciliationDiscrepancy" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    settlement_id UUID REFERENCES "PaymentSettlement"(id),
    order_id UUID REFERENCES "Order"(id),
    order_no VARCHAR(50),
    discrepancy_type VARCHAR(30) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    expected_amount NUMERIC(15,2) NOT NULL,
    actual_amount NUMERIC(15,2) NOT NULL,
    difference_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by_id UUID REFERENCES "User"(id),
    resolution VARCHAR(500),
    system_data JSONB,
    settlement_data JSONB,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discrepancy_company ON "ReconciliationDiscrepancy"(company_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_settlement ON "ReconciliationDiscrepancy"(settlement_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_order ON "ReconciliationDiscrepancy"(order_no);
CREATE INDEX IF NOT EXISTS idx_discrepancy_type ON "ReconciliationDiscrepancy"(discrepancy_type);
CREATE INDEX IF NOT EXISTS idx_discrepancy_channel ON "ReconciliationDiscrepancy"(channel);
CREATE INDEX IF NOT EXISTS idx_discrepancy_resolved ON "ReconciliationDiscrepancy"(is_resolved);
CREATE INDEX IF NOT EXISTS idx_discrepancy_detected ON "ReconciliationDiscrepancy"(detected_at);

-- Marketplace Connections
CREATE TABLE IF NOT EXISTS "MarketplaceConnection" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    marketplace VARCHAR(30) NOT NULL,
    connection_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    seller_id VARCHAR(100),
    seller_name VARCHAR(255),
    region VARCHAR(50),
    api_endpoint VARCHAR(500),
    credentials JSONB,
    access_token VARCHAR(2000),
    refresh_token VARCHAR(2000),
    token_expires_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    sync_settings JSONB,
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    error_message VARCHAR(1000),
    error_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_connection_company ON "MarketplaceConnection"(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_connection_marketplace ON "MarketplaceConnection"(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_connection_status ON "MarketplaceConnection"(status);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS "MarketplaceListing" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id),
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    marketplace VARCHAR(30) NOT NULL,
    listing_id VARCHAR(255) NOT NULL,
    asin VARCHAR(50),
    fsn VARCHAR(50),
    style_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'DRAFT',
    title VARCHAR(500),
    description TEXT,
    price NUMERIC(15,2) DEFAULT 0,
    mrp NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    stock_quantity INTEGER DEFAULT 0,
    is_in_stock BOOLEAN DEFAULT TRUE,
    fulfillment_type VARCHAR(50),
    category VARCHAR(255),
    brand VARCHAR(100),
    image_urls JSONB,
    attributes JSONB,
    last_synced_at TIMESTAMPTZ,
    suppressed_reason VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_listing_company ON "MarketplaceListing"(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_listing_connection ON "MarketplaceListing"(connection_id);
CREATE INDEX IF NOT EXISTS idx_mp_listing_sku ON "MarketplaceListing"(sku_id);
CREATE INDEX IF NOT EXISTS idx_mp_listing_marketplace ON "MarketplaceListing"(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_listing_id ON "MarketplaceListing"(listing_id);
CREATE INDEX IF NOT EXISTS idx_mp_listing_status ON "MarketplaceListing"(status);

-- Marketplace Order Sync
CREATE TABLE IF NOT EXISTS "MarketplaceOrderSync" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id),
    marketplace VARCHAR(30) NOT NULL,
    marketplace_order_id VARCHAR(100) NOT NULL,
    order_id UUID REFERENCES "Order"(id),
    order_no VARCHAR(50),
    sync_status VARCHAR(20) DEFAULT 'PENDING',
    sync_direction VARCHAR(20) DEFAULT 'INBOUND',
    order_data JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    error_message VARCHAR(1000),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_order_sync_company ON "MarketplaceOrderSync"(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_sync_connection ON "MarketplaceOrderSync"(connection_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_sync_marketplace ON "MarketplaceOrderSync"(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_order_sync_mp_order ON "MarketplaceOrderSync"(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_sync_status ON "MarketplaceOrderSync"(sync_status);

-- Marketplace Inventory Sync
CREATE TABLE IF NOT EXISTS "MarketplaceInventorySync" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id),
    listing_id UUID NOT NULL REFERENCES "MarketplaceListing"(id),
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    marketplace VARCHAR(30) NOT NULL,
    previous_quantity INTEGER DEFAULT 0,
    new_quantity INTEGER DEFAULT 0,
    sync_status VARCHAR(20) DEFAULT 'PENDING',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    error_message VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_inv_sync_company ON "MarketplaceInventorySync"(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_inv_sync_connection ON "MarketplaceInventorySync"(connection_id);
CREATE INDEX IF NOT EXISTS idx_mp_inv_sync_listing ON "MarketplaceInventorySync"(listing_id);
CREATE INDEX IF NOT EXISTS idx_mp_inv_sync_sku ON "MarketplaceInventorySync"(sku_id);
CREATE INDEX IF NOT EXISTS idx_mp_inv_sync_status ON "MarketplaceInventorySync"(sync_status);
CREATE INDEX IF NOT EXISTS idx_mp_inv_sync_at ON "MarketplaceInventorySync"(synced_at);

-- Marketplace Returns
CREATE TABLE IF NOT EXISTS "MarketplaceReturn" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id),
    marketplace VARCHAR(30) NOT NULL,
    marketplace_return_id VARCHAR(100) NOT NULL,
    marketplace_order_id VARCHAR(100) NOT NULL,
    order_id UUID REFERENCES "Order"(id),
    return_id UUID REFERENCES "Return"(id),
    status VARCHAR(20) DEFAULT 'INITIATED',
    return_reason VARCHAR(255),
    return_sub_reason VARCHAR(255),
    customer_comments VARCHAR(1000),
    return_quantity INTEGER DEFAULT 1,
    refund_amount NUMERIC(15,2) DEFAULT 0,
    refund_status VARCHAR(50),
    refunded_at TIMESTAMPTZ,
    pickup_scheduled_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    return_data JSONB,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_return_company ON "MarketplaceReturn"(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_return_connection ON "MarketplaceReturn"(connection_id);
CREATE INDEX IF NOT EXISTS idx_mp_return_marketplace ON "MarketplaceReturn"(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_return_mp_return ON "MarketplaceReturn"(marketplace_return_id);
CREATE INDEX IF NOT EXISTS idx_mp_return_mp_order ON "MarketplaceReturn"(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_mp_return_status ON "MarketplaceReturn"(status);

-- Marketplace Settlements
CREATE TABLE IF NOT EXISTS "MarketplaceSettlement" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id),
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id),
    marketplace VARCHAR(30) NOT NULL,
    settlement_id VARCHAR(100) NOT NULL,
    settlement_date DATE NOT NULL,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    gross_sales NUMERIC(15,2) DEFAULT 0,
    marketplace_fee NUMERIC(15,2) DEFAULT 0,
    shipping_fee NUMERIC(15,2) DEFAULT 0,
    tax_collected NUMERIC(15,2) DEFAULT 0,
    tax_remitted NUMERIC(15,2) DEFAULT 0,
    promotions NUMERIC(15,2) DEFAULT 0,
    refunds NUMERIC(15,2) DEFAULT 0,
    chargebacks NUMERIC(15,2) DEFAULT 0,
    adjustments NUMERIC(15,2) DEFAULT 0,
    net_amount NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_reference VARCHAR(100),
    payment_date DATE,
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    file_url VARCHAR(500),
    raw_data JSONB,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_settlement_company ON "MarketplaceSettlement"(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_settlement_connection ON "MarketplaceSettlement"(connection_id);
CREATE INDEX IF NOT EXISTS idx_mp_settlement_marketplace ON "MarketplaceSettlement"(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_settlement_id ON "MarketplaceSettlement"(settlement_id);
CREATE INDEX IF NOT EXISTS idx_mp_settlement_date ON "MarketplaceSettlement"(settlement_date);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all new tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'WSConnection', 'WSSubscription', 'WSEvent',
            'MobileDevice', 'MobileConfig', 'DeviceLocationLog', 'BarcodeScanLog',
            'MobileSession', 'MobileTask', 'MobileTaskLine',
            'OfflineSyncQueue', 'SyncCheckpoint', 'SyncConflict', 'SyncBatch',
            'LaborShift', 'LaborShiftSchedule', 'LaborAssignment', 'LaborTimeEntry',
            'LaborProductivity', 'LaborStandard', 'LaborIncentive', 'LaborSkill',
            'SkuVelocity', 'BinCharacteristics', 'SlottingRule', 'SlottingRecommendation',
            'VoiceProfile', 'VoiceCommand', 'VoiceSession', 'VoiceInteraction',
            'CrossDockRule', 'CrossDockOrder', 'CrossDockAllocation', 'StagingArea',
            'Preorder', 'PreorderLine', 'PreorderInventory',
            'Subscription', 'SubscriptionLine', 'SubscriptionSchedule', 'SubscriptionHistory',
            'PaymentSettlement', 'Chargeback', 'EscrowHold', 'ReconciliationDiscrepancy',
            'MarketplaceConnection', 'MarketplaceListing', 'MarketplaceOrderSync',
            'MarketplaceInventorySync', 'MarketplaceReturn', 'MarketplaceSettlement'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
            CREATE TRIGGER trg_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', lower(t), t, lower(t), t);
    END LOOP;
END;
$$;

-- ============================================================================
-- Migration Complete
-- Total Tables: 52 new tables
-- ============================================================================
