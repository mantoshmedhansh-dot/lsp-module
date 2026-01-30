-- Phase 3.1: Cross-Docking Workflows Migration
-- Creates tables for cross-docking operations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cross-Dock Rule Type Enum
DO $$ BEGIN
    CREATE TYPE cross_dock_rule_type AS ENUM (
        'AUTO_ALLOCATE', 'PRIORITY_CUSTOMER', 'SAME_DAY', 'EXPRESS', 'BULK_TRANSFER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Cross-Dock Status Enum
DO $$ BEGIN
    CREATE TYPE cross_dock_status AS ENUM (
        'PENDING', 'ELIGIBLE', 'ALLOCATED', 'IN_STAGING', 'LOADING', 'SHIPPED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Staging Area Status Enum
DO $$ BEGIN
    CREATE TYPE staging_area_status AS ENUM ('AVAILABLE', 'RESERVED', 'IN_USE', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table: cross_dock_rules
CREATE TABLE IF NOT EXISTS cross_dock_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "ruleName" VARCHAR(100) NOT NULL,
    "ruleType" VARCHAR(30) NOT NULL,
    priority INTEGER DEFAULT 0,
    "minOrderValue" DECIMAL(10,2),
    "maxOrderAge" INTEGER,
    "customerTiers" JSONB,
    "shippingMethods" JSONB,
    "productCategories" JSONB,
    "originWarehouses" JSONB,
    "autoAllocatePercentage" DECIMAL(5,2) DEFAULT 100.0,
    conditions JSONB,
    "isActive" BOOLEAN DEFAULT TRUE,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_dock_rules_warehouse ON cross_dock_rules("warehouseId");
CREATE INDEX IF NOT EXISTS idx_cross_dock_rules_type ON cross_dock_rules("ruleType");
CREATE INDEX IF NOT EXISTS idx_cross_dock_rules_active ON cross_dock_rules("isActive");

-- Table: cross_dock_orders
CREATE TABLE IF NOT EXISTS cross_dock_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "orderId" UUID NOT NULL UNIQUE,
    "orderNumber" VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    "appliedRuleId" UUID REFERENCES cross_dock_rules(id),
    "inboundShipmentId" UUID,
    "outboundShipmentId" UUID,
    "stagingAreaId" UUID,
    "expectedArrival" TIMESTAMP WITH TIME ZONE,
    "actualArrival" TIMESTAMP WITH TIME ZONE,
    "scheduledDeparture" TIMESTAMP WITH TIME ZONE,
    "actualDeparture" TIMESTAMP WITH TIME ZONE,
    "totalUnits" INTEGER DEFAULT 0,
    "allocatedUnits" INTEGER DEFAULT 0,
    "processedUnits" INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_dock_orders_warehouse ON cross_dock_orders("warehouseId");
CREATE INDEX IF NOT EXISTS idx_cross_dock_orders_order ON cross_dock_orders("orderId");
CREATE INDEX IF NOT EXISTS idx_cross_dock_orders_status ON cross_dock_orders(status);
CREATE INDEX IF NOT EXISTS idx_cross_dock_orders_inbound ON cross_dock_orders("inboundShipmentId");

-- Table: cross_dock_allocations
CREATE TABLE IF NOT EXISTS cross_dock_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "crossDockOrderId" UUID NOT NULL REFERENCES cross_dock_orders(id),
    "inboundLineId" UUID NOT NULL,
    "outboundLineId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "allocatedQuantity" INTEGER DEFAULT 0,
    "receivedQuantity" INTEGER DEFAULT 0,
    "shippedQuantity" INTEGER DEFAULT 0,
    "allocationTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "processedTime" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_dock_alloc_order ON cross_dock_allocations("crossDockOrderId");
CREATE INDEX IF NOT EXISTS idx_cross_dock_alloc_item ON cross_dock_allocations("itemId");
CREATE INDEX IF NOT EXISTS idx_cross_dock_alloc_sku ON cross_dock_allocations(sku);

-- Table: staging_areas
CREATE TABLE IF NOT EXISTS staging_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "areaCode" VARCHAR(20) NOT NULL UNIQUE,
    "areaName" VARCHAR(100) NOT NULL,
    "areaType" VARCHAR(30) DEFAULT 'CROSS_DOCK',
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    "capacityUnits" INTEGER DEFAULT 100,
    "currentUnits" INTEGER DEFAULT 0,
    "capacityPallets" INTEGER DEFAULT 10,
    "currentPallets" INTEGER DEFAULT 0,
    "dockDoor" VARCHAR(20),
    "assignedCarrier" VARCHAR(100),
    "reservedUntil" TIMESTAMP WITH TIME ZONE,
    temperature VARCHAR(20),
    "isActive" BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staging_areas_warehouse ON staging_areas("warehouseId");
CREATE INDEX IF NOT EXISTS idx_staging_areas_code ON staging_areas("areaCode");
CREATE INDEX IF NOT EXISTS idx_staging_areas_status ON staging_areas(status);

-- Triggers
DROP TRIGGER IF EXISTS update_cross_dock_rules_updated_at ON cross_dock_rules;
CREATE TRIGGER update_cross_dock_rules_updated_at BEFORE UPDATE ON cross_dock_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cross_dock_orders_updated_at ON cross_dock_orders;
CREATE TRIGGER update_cross_dock_orders_updated_at BEFORE UPDATE ON cross_dock_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cross_dock_allocations_updated_at ON cross_dock_allocations;
CREATE TRIGGER update_cross_dock_allocations_updated_at BEFORE UPDATE ON cross_dock_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staging_areas_updated_at ON staging_areas;
CREATE TRIGGER update_staging_areas_updated_at BEFORE UPDATE ON staging_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE cross_dock_rules IS 'Auto-allocation rules for cross-docking';
COMMENT ON TABLE cross_dock_orders IS 'Orders eligible for cross-docking';
COMMENT ON TABLE cross_dock_allocations IS 'Inbound-to-outbound allocation mapping';
COMMENT ON TABLE staging_areas IS 'Cross-dock staging zones';
