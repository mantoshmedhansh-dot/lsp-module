-- Phase 1.1: WebSocket Infrastructure Migration
-- Creates tables for real-time WebSocket connection management

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- WebSocket Connection Status Enum
DO $$ BEGIN
    CREATE TYPE ws_connection_status AS ENUM ('CONNECTED', 'DISCONNECTED', 'RECONNECTING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- WebSocket Event Type Enum
DO $$ BEGIN
    CREATE TYPE ws_event_type AS ENUM (
        'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'ORDER_STATUS_CHANGED',
        'INVENTORY_UPDATED', 'INVENTORY_LOW_STOCK', 'INVENTORY_OUT_OF_STOCK',
        'PICKING_TASK_ASSIGNED', 'PICKING_TASK_STARTED', 'PICKING_TASK_COMPLETED', 'PICKING_TASK_PAUSED',
        'DASHBOARD_METRICS_UPDATE', 'SYSTEM_ALERT', 'USER_NOTIFICATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- WebSocket Topic Type Enum
DO $$ BEGIN
    CREATE TYPE ws_topic_type AS ENUM ('orders', 'inventory', 'picking', 'dashboard', 'alerts', 'all');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: ws_connections
-- Tracks active WebSocket connections
CREATE TABLE IF NOT EXISTS ws_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "connectionId" VARCHAR(255) NOT NULL,
    "clientIp" VARCHAR(45),
    "userAgent" VARCHAR(500),
    status VARCHAR(20) DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "disconnectedAt" TIMESTAMP WITH TIME ZONE,
    "lastPingAt" TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ws_connections
CREATE INDEX IF NOT EXISTS idx_ws_connections_user_id ON ws_connections("userId");
CREATE INDEX IF NOT EXISTS idx_ws_connections_connection_id ON ws_connections("connectionId");
CREATE INDEX IF NOT EXISTS idx_ws_connections_status ON ws_connections(status);
CREATE INDEX IF NOT EXISTS idx_ws_connections_connected_at ON ws_connections("connectedAt");

-- Table: ws_subscriptions
-- Topic subscriptions per connection
CREATE TABLE IF NOT EXISTS ws_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connectionId" UUID NOT NULL REFERENCES ws_connections(id) ON DELETE CASCADE,
    topic VARCHAR(50) NOT NULL,
    filters JSONB,
    "subscribedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ws_subscriptions
CREATE INDEX IF NOT EXISTS idx_ws_subscriptions_connection_id ON ws_subscriptions("connectionId");
CREATE INDEX IF NOT EXISTS idx_ws_subscriptions_topic ON ws_subscriptions(topic);
CREATE INDEX IF NOT EXISTS idx_ws_subscriptions_active ON ws_subscriptions("isActive");

-- Table: ws_events
-- Event log for replay/debugging
CREATE TABLE IF NOT EXISTS ws_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eventType" VARCHAR(50) NOT NULL,
    topic VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    "targetUserIds" JSONB,
    "broadcastedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "acknowledgedBy" JSONB,
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "retryCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ws_events
CREATE INDEX IF NOT EXISTS idx_ws_events_event_type ON ws_events("eventType");
CREATE INDEX IF NOT EXISTS idx_ws_events_topic ON ws_events(topic);
CREATE INDEX IF NOT EXISTS idx_ws_events_broadcasted_at ON ws_events("broadcastedAt");
CREATE INDEX IF NOT EXISTS idx_ws_events_expires_at ON ws_events("expiresAt");

-- Auto-update trigger for updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to ws_connections
DROP TRIGGER IF EXISTS update_ws_connections_updated_at ON ws_connections;
CREATE TRIGGER update_ws_connections_updated_at
    BEFORE UPDATE ON ws_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to ws_subscriptions
DROP TRIGGER IF EXISTS update_ws_subscriptions_updated_at ON ws_subscriptions;
CREATE TRIGGER update_ws_subscriptions_updated_at
    BEFORE UPDATE ON ws_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to ws_events
DROP TRIGGER IF EXISTS update_ws_events_updated_at ON ws_events;
CREATE TRIGGER update_ws_events_updated_at
    BEFORE UPDATE ON ws_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for old disconnected connections (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_old_ws_connections(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ws_connections
    WHERE status = 'DISCONNECTED'
    AND "disconnectedAt" < NOW() - (days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired events
CREATE OR REPLACE FUNCTION cleanup_expired_ws_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ws_events
    WHERE "expiresAt" IS NOT NULL
    AND "expiresAt" < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE ws_connections IS 'Tracks active WebSocket connections for real-time updates';
COMMENT ON TABLE ws_subscriptions IS 'Topic subscriptions per WebSocket connection';
COMMENT ON TABLE ws_events IS 'Event log for WebSocket messages - used for replay and debugging';
