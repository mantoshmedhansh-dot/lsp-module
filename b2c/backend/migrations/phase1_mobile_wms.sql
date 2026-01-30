-- Phase 1.2: Mobile WMS Backend Migration
-- Creates tables for mobile device management, sessions, and offline sync

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Device Type Enum
DO $$ BEGIN
    CREATE TYPE device_type AS ENUM (
        'HANDHELD_SCANNER', 'SMARTPHONE', 'TABLET', 'FORKLIFT_TERMINAL', 'WEARABLE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Device Status Enum
DO $$ BEGIN
    CREATE TYPE device_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DECOMMISSIONED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Scan Type Enum
DO $$ BEGIN
    CREATE TYPE scan_type AS ENUM (
        'ITEM', 'LOCATION', 'ORDER', 'CONTAINER', 'LICENSE_PLATE', 'SERIAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Session Status Enum
DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('ACTIVE', 'IDLE', 'EXPIRED', 'TERMINATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task Type Enum
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM (
        'RECEIVING', 'PUTAWAY', 'PICKING', 'PACKING', 'SHIPPING',
        'CYCLE_COUNT', 'REPLENISHMENT', 'TRANSFER', 'ADJUSTMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task Status Enum
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task Priority Enum
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Sync Operation Type Enum
DO $$ BEGIN
    CREATE TYPE sync_operation_type AS ENUM ('CREATE', 'UPDATE', 'DELETE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Sync Status Enum
DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM (
        'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CONFLICT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Sync Entity Type Enum
DO $$ BEGIN
    CREATE TYPE sync_entity_type AS ENUM (
        'TASK', 'TASK_LINE', 'INVENTORY', 'SCAN', 'LOCATION', 'ADJUSTMENT', 'TRANSFER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Conflict Resolution Enum
DO $$ BEGIN
    CREATE TYPE conflict_resolution AS ENUM (
        'SERVER_WINS', 'CLIENT_WINS', 'MERGE', 'MANUAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ==================== Mobile Device Tables ====================

-- Table: mobile_devices
CREATE TABLE IF NOT EXISTS mobile_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" VARCHAR(255) NOT NULL UNIQUE,
    "deviceName" VARCHAR(255) NOT NULL,
    "deviceType" VARCHAR(30) DEFAULT 'HANDHELD_SCANNER',
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    "osVersion" VARCHAR(50),
    "appVersion" VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',
    "warehouseId" UUID,
    "assignedUserId" UUID,
    "lastSeenAt" TIMESTAMP WITH TIME ZONE,
    "registeredAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "registeredBy" UUID,
    "authToken" VARCHAR(500),
    "tokenExpiresAt" TIMESTAMP WITH TIME ZONE,
    "pushToken" VARCHAR(500),
    capabilities JSONB,
    settings JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_device_id ON mobile_devices("deviceId");
CREATE INDEX IF NOT EXISTS idx_mobile_devices_warehouse ON mobile_devices("warehouseId");
CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices("assignedUserId");
CREATE INDEX IF NOT EXISTS idx_mobile_devices_status ON mobile_devices(status);


-- Table: mobile_config
CREATE TABLE IF NOT EXISTS mobile_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
    "configKey" VARCHAR(100) NOT NULL,
    "configValue" TEXT NOT NULL,
    "valueType" VARCHAR(20) DEFAULT 'string',
    "isEncrypted" BOOLEAN DEFAULT FALSE,
    description VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_config_device ON mobile_config("deviceId");
CREATE INDEX IF NOT EXISTS idx_mobile_config_key ON mobile_config("configKey");


-- Table: device_location_log
CREATE TABLE IF NOT EXISTS device_location_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    "warehouseZone" VARCHAR(50),
    aisle VARCHAR(20),
    "recordedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_location_device ON device_location_log("deviceId");
CREATE INDEX IF NOT EXISTS idx_device_location_recorded ON device_location_log("recordedAt");


-- Table: barcode_scan_log
CREATE TABLE IF NOT EXISTS barcode_scan_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scanType" VARCHAR(20) NOT NULL,
    barcode VARCHAR(255) NOT NULL,
    "scannedValue" VARCHAR(500),
    "resolvedEntityId" UUID,
    "resolvedEntityType" VARCHAR(50),
    "isSuccessful" BOOLEAN DEFAULT TRUE,
    "errorMessage" VARCHAR(500),
    "scannedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location VARCHAR(100),
    "taskId" UUID,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barcode_scan_device ON barcode_scan_log("deviceId");
CREATE INDEX IF NOT EXISTS idx_barcode_scan_user ON barcode_scan_log("userId");
CREATE INDEX IF NOT EXISTS idx_barcode_scan_type ON barcode_scan_log("scanType");
CREATE INDEX IF NOT EXISTS idx_barcode_scan_barcode ON barcode_scan_log(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_scanned_at ON barcode_scan_log("scannedAt");


-- ==================== Mobile Session Tables ====================

-- Table: mobile_sessions
CREATE TABLE IF NOT EXISTS mobile_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "warehouseId" UUID,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "endedAt" TIMESTAMP WITH TIME ZONE,
    "lastActivityAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "currentTaskId" UUID,
    "currentZone" VARCHAR(50),
    "ipAddress" VARCHAR(45),
    "appVersion" VARCHAR(50),
    "sessionData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_sessions_device ON mobile_sessions("deviceId");
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_user ON mobile_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_warehouse ON mobile_sessions("warehouseId");
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_status ON mobile_sessions(status);


-- Table: mobile_tasks
CREATE TABLE IF NOT EXISTS mobile_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "taskType" VARCHAR(20) NOT NULL,
    "taskNumber" VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'PENDING',
    priority VARCHAR(10) DEFAULT 'NORMAL',
    "assignedUserId" UUID,
    "assignedDeviceId" UUID,
    "warehouseId" UUID NOT NULL,
    "sourceLocationId" UUID,
    "destinationLocationId" UUID,
    "orderId" UUID,
    "itemId" UUID,
    quantity INTEGER,
    "completedQuantity" INTEGER DEFAULT 0,
    instructions TEXT,
    "dueDate" TIMESTAMP WITH TIME ZONE,
    "startedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "taskData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_tasks_type ON mobile_tasks("taskType");
CREATE INDEX IF NOT EXISTS idx_mobile_tasks_number ON mobile_tasks("taskNumber");
CREATE INDEX IF NOT EXISTS idx_mobile_tasks_status ON mobile_tasks(status);
CREATE INDEX IF NOT EXISTS idx_mobile_tasks_user ON mobile_tasks("assignedUserId");
CREATE INDEX IF NOT EXISTS idx_mobile_tasks_warehouse ON mobile_tasks("warehouseId");
CREATE INDEX IF NOT EXISTS idx_mobile_tasks_order ON mobile_tasks("orderId");


-- Table: mobile_task_lines
CREATE TABLE IF NOT EXISTS mobile_task_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "taskId" UUID NOT NULL REFERENCES mobile_tasks(id) ON DELETE CASCADE,
    "lineNumber" INTEGER DEFAULT 1,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "sourceLocationId" UUID,
    "sourceLocation" VARCHAR(100),
    "destinationLocationId" UUID,
    "destinationLocation" VARCHAR(100),
    "requestedQuantity" INTEGER DEFAULT 1,
    "completedQuantity" INTEGER DEFAULT 0,
    uom VARCHAR(20) DEFAULT 'EACH',
    "lotNumber" VARCHAR(100),
    "serialNumber" VARCHAR(100),
    "expirationDate" TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'PENDING',
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "completedBy" UUID,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_task_lines_task ON mobile_task_lines("taskId");
CREATE INDEX IF NOT EXISTS idx_mobile_task_lines_sku ON mobile_task_lines(sku);
CREATE INDEX IF NOT EXISTS idx_mobile_task_lines_status ON mobile_task_lines(status);


-- ==================== Offline Sync Tables ====================

-- Table: offline_sync_queue
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "operationType" VARCHAR(10) NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" UUID,
    "localId" VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    "clientTimestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "serverTimestamp" TIMESTAMP WITH TIME ZONE,
    "processedAt" TIMESTAMP WITH TIME ZONE,
    "retryCount" INTEGER DEFAULT 0,
    "maxRetries" INTEGER DEFAULT 3,
    "errorMessage" TEXT,
    "conflictData" JSONB,
    resolution VARCHAR(20),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_device ON offline_sync_queue("deviceId");
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON offline_sync_queue("userId");
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON offline_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON offline_sync_queue("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_sync_queue_local ON offline_sync_queue("localId");


-- Table: sync_checkpoints
CREATE TABLE IF NOT EXISTS sync_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "lastSyncAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "lastEntityId" UUID,
    "syncVersion" INTEGER DEFAULT 0,
    checksum VARCHAR(64),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("deviceId", "entityType")
);

CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_device ON sync_checkpoints("deviceId");
CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_entity ON sync_checkpoints("entityType");


-- Table: sync_conflicts
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "syncQueueId" UUID NOT NULL REFERENCES offline_sync_queue(id) ON DELETE CASCADE,
    "deviceId" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" UUID NOT NULL,
    "clientData" JSONB NOT NULL,
    "serverData" JSONB NOT NULL,
    "conflictFields" JSONB NOT NULL,
    resolution VARCHAR(20),
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    "resolvedData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_queue ON sync_conflicts("syncQueueId");
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_device ON sync_conflicts("deviceId");
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolution ON sync_conflicts(resolution);


-- Table: sync_batches
CREATE TABLE IF NOT EXISTS sync_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deviceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "batchType" VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PROCESSING',
    "totalOperations" INTEGER DEFAULT 0,
    "completedOperations" INTEGER DEFAULT 0,
    "failedOperations" INTEGER DEFAULT 0,
    "conflictOperations" INTEGER DEFAULT 0,
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "completedAt" TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_batches_device ON sync_batches("deviceId");
CREATE INDEX IF NOT EXISTS idx_sync_batches_user ON sync_batches("userId");
CREATE INDEX IF NOT EXISTS idx_sync_batches_status ON sync_batches(status);


-- ==================== Triggers ====================

-- Auto-update triggers for all tables
DROP TRIGGER IF EXISTS update_mobile_devices_updated_at ON mobile_devices;
CREATE TRIGGER update_mobile_devices_updated_at
    BEFORE UPDATE ON mobile_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mobile_config_updated_at ON mobile_config;
CREATE TRIGGER update_mobile_config_updated_at
    BEFORE UPDATE ON mobile_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_device_location_log_updated_at ON device_location_log;
CREATE TRIGGER update_device_location_log_updated_at
    BEFORE UPDATE ON device_location_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_barcode_scan_log_updated_at ON barcode_scan_log;
CREATE TRIGGER update_barcode_scan_log_updated_at
    BEFORE UPDATE ON barcode_scan_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mobile_sessions_updated_at ON mobile_sessions;
CREATE TRIGGER update_mobile_sessions_updated_at
    BEFORE UPDATE ON mobile_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mobile_tasks_updated_at ON mobile_tasks;
CREATE TRIGGER update_mobile_tasks_updated_at
    BEFORE UPDATE ON mobile_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mobile_task_lines_updated_at ON mobile_task_lines;
CREATE TRIGGER update_mobile_task_lines_updated_at
    BEFORE UPDATE ON mobile_task_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offline_sync_queue_updated_at ON offline_sync_queue;
CREATE TRIGGER update_offline_sync_queue_updated_at
    BEFORE UPDATE ON offline_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_checkpoints_updated_at ON sync_checkpoints;
CREATE TRIGGER update_sync_checkpoints_updated_at
    BEFORE UPDATE ON sync_checkpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_conflicts_updated_at ON sync_conflicts;
CREATE TRIGGER update_sync_conflicts_updated_at
    BEFORE UPDATE ON sync_conflicts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_batches_updated_at ON sync_batches;
CREATE TRIGGER update_sync_batches_updated_at
    BEFORE UPDATE ON sync_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==================== Helper Functions ====================

-- Function to generate task number
CREATE OR REPLACE FUNCTION generate_task_number(prefix VARCHAR DEFAULT 'TSK')
RETURNS VARCHAR AS $$
DECLARE
    seq_num BIGINT;
    task_num VARCHAR;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING("taskNumber" FROM 5) AS BIGINT)), 0) + 1
    INTO seq_num
    FROM mobile_tasks
    WHERE "taskNumber" LIKE prefix || '-%';

    task_num := prefix || '-' || LPAD(seq_num::TEXT, 8, '0');
    RETURN task_num;
END;
$$ LANGUAGE plpgsql;


-- Function to expire idle sessions
CREATE OR REPLACE FUNCTION expire_idle_sessions(idle_minutes INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE mobile_sessions
    SET status = 'EXPIRED',
        "endedAt" = NOW()
    WHERE status = 'ACTIVE'
    AND "lastActivityAt" < NOW() - (idle_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;


COMMENT ON TABLE mobile_devices IS 'Registered mobile devices for WMS operations';
COMMENT ON TABLE mobile_sessions IS 'Active mobile user sessions';
COMMENT ON TABLE mobile_tasks IS 'Warehouse tasks assignable to mobile workers';
COMMENT ON TABLE offline_sync_queue IS 'Queue for offline sync operations from mobile devices';
COMMENT ON TABLE sync_conflicts IS 'Sync conflicts requiring resolution';
