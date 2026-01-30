-- Phase 2.2: Slotting Optimization Migration
-- Creates tables for slotting optimization and warehouse bin management

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Velocity Class Enum
DO $$ BEGIN
    CREATE TYPE velocity_class AS ENUM ('A', 'B', 'C');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Variability Class Enum
DO $$ BEGIN
    CREATE TYPE variability_class AS ENUM ('X', 'Y', 'Z');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bin Type Enum
DO $$ BEGIN
    CREATE TYPE bin_type AS ENUM (
        'SHELF', 'FLOOR', 'RACK', 'PALLET', 'CAROUSEL', 'FLOW_RACK', 'MEZZANINE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Zone Type Enum
DO $$ BEGIN
    CREATE TYPE zone_type AS ENUM (
        'RECEIVING', 'STAGING', 'BULK', 'RESERVE', 'FORWARD_PICK',
        'PACKING', 'SHIPPING', 'RETURNS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recommendation Status Enum
DO $$ BEGIN
    CREATE TYPE recommendation_status AS ENUM (
        'PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recommendation Type Enum
DO $$ BEGIN
    CREATE TYPE recommendation_type AS ENUM (
        'NEW_SLOT', 'MOVE', 'CONSOLIDATE', 'REPLENISH', 'DEACTIVATE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ==================== SKU Velocity Tables ====================

-- Table: sku_velocity
CREATE TABLE IF NOT EXISTS sku_velocity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "velocityClass" VARCHAR(1) DEFAULT 'C',
    "variabilityClass" VARCHAR(1) DEFAULT 'Z',
    "combinedClass" VARCHAR(2) DEFAULT 'CZ',
    "pickCountLast30Days" INTEGER DEFAULT 0,
    "pickCountLast90Days" INTEGER DEFAULT 0,
    "unitsSoldLast30Days" INTEGER DEFAULT 0,
    "unitsSoldLast90Days" INTEGER DEFAULT 0,
    "averagePicksPerDay" DECIMAL(8,2) DEFAULT 0.0,
    "demandVariability" DECIMAL(5,2) DEFAULT 0.0,
    "pickFrequency" DECIMAL(8,2) DEFAULT 0.0,
    "seasonalityFactor" DECIMAL(4,2) DEFAULT 1.0,
    "analysisDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "nextReviewDate" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_velocity_warehouse ON sku_velocity("warehouseId");
CREATE INDEX IF NOT EXISTS idx_sku_velocity_item ON sku_velocity("itemId");
CREATE INDEX IF NOT EXISTS idx_sku_velocity_sku ON sku_velocity(sku);
CREATE INDEX IF NOT EXISTS idx_sku_velocity_class ON sku_velocity("velocityClass");
CREATE INDEX IF NOT EXISTS idx_sku_velocity_combined ON sku_velocity("combinedClass");
CREATE UNIQUE INDEX IF NOT EXISTS idx_sku_velocity_unique ON sku_velocity("warehouseId", "itemId");


-- ==================== Bin Characteristics Tables ====================

-- Table: bin_characteristics
CREATE TABLE IF NOT EXISTS bin_characteristics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "locationId" UUID NOT NULL UNIQUE,
    "locationCode" VARCHAR(50) NOT NULL,
    "binType" VARCHAR(20) DEFAULT 'SHELF',
    "zoneType" VARCHAR(20) DEFAULT 'FORWARD_PICK',
    aisle VARCHAR(10) NOT NULL,
    rack VARCHAR(10),
    level VARCHAR(10),
    position VARCHAR(10),
    "widthCm" DECIMAL(8,2) DEFAULT 0.0,
    "heightCm" DECIMAL(8,2) DEFAULT 0.0,
    "depthCm" DECIMAL(8,2) DEFAULT 0.0,
    "volumeCubicCm" DECIMAL(12,2) DEFAULT 0.0,
    "maxWeightKg" DECIMAL(8,2) DEFAULT 0.0,
    "currentWeightKg" DECIMAL(8,2) DEFAULT 0.0,
    "pickSequence" INTEGER DEFAULT 0,
    "travelTimeSeconds" DECIMAL(8,2) DEFAULT 0.0,
    "ergonomicScore" DECIMAL(5,2) DEFAULT 100.0,
    "temperatureZone" VARCHAR(20),
    "isActive" BOOLEAN DEFAULT TRUE,
    restrictions JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bin_char_warehouse ON bin_characteristics("warehouseId");
CREATE INDEX IF NOT EXISTS idx_bin_char_location ON bin_characteristics("locationId");
CREATE INDEX IF NOT EXISTS idx_bin_char_code ON bin_characteristics("locationCode");
CREATE INDEX IF NOT EXISTS idx_bin_char_aisle ON bin_characteristics(aisle);
CREATE INDEX IF NOT EXISTS idx_bin_char_zone ON bin_characteristics("zoneType");
CREATE INDEX IF NOT EXISTS idx_bin_char_sequence ON bin_characteristics("pickSequence");


-- ==================== Slotting Rules Tables ====================

-- Table: slotting_rules
CREATE TABLE IF NOT EXISTS slotting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "ruleName" VARCHAR(100) NOT NULL,
    "ruleType" VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 0,
    "velocityClasses" JSONB,
    "variabilityClasses" JSONB,
    "zoneTypes" JSONB,
    "binTypes" JSONB,
    "minPicksPerDay" DECIMAL(8,2),
    "maxPicksPerDay" DECIMAL(8,2),
    "preferredAisles" JSONB,
    "preferredLevels" JSONB,
    "weightLimit" DECIMAL(8,2),
    "volumeLimit" DECIMAL(12,2),
    conditions JSONB,
    "isActive" BOOLEAN DEFAULT TRUE,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slotting_rules_warehouse ON slotting_rules("warehouseId");
CREATE INDEX IF NOT EXISTS idx_slotting_rules_type ON slotting_rules("ruleType");
CREATE INDEX IF NOT EXISTS idx_slotting_rules_active ON slotting_rules("isActive");
CREATE INDEX IF NOT EXISTS idx_slotting_rules_priority ON slotting_rules(priority DESC);


-- ==================== Recommendations Tables ====================

-- Table: slotting_recommendations
CREATE TABLE IF NOT EXISTS slotting_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "warehouseId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "recommendationType" VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    "currentLocationId" UUID,
    "currentLocation" VARCHAR(100),
    "recommendedLocationId" UUID,
    "recommendedLocation" VARCHAR(100),
    "appliedRuleId" UUID REFERENCES slotting_rules(id) ON DELETE SET NULL,
    reason VARCHAR(500) NOT NULL,
    "expectedBenefit" VARCHAR(500),
    "estimatedSavingsMinutes" DECIMAL(8,2) DEFAULT 0.0,
    "estimatedSavingsPercent" DECIMAL(5,2) DEFAULT 0.0,
    quantity INTEGER,
    priority INTEGER DEFAULT 0,
    "generatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_warehouse ON slotting_recommendations("warehouseId");
CREATE INDEX IF NOT EXISTS idx_recommendations_item ON slotting_recommendations("itemId");
CREATE INDEX IF NOT EXISTS idx_recommendations_sku ON slotting_recommendations(sku);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON slotting_recommendations("recommendationType");
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON slotting_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON slotting_recommendations(priority DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON slotting_recommendations("expiresAt");


-- ==================== Triggers ====================

DROP TRIGGER IF EXISTS update_sku_velocity_updated_at ON sku_velocity;
CREATE TRIGGER update_sku_velocity_updated_at
    BEFORE UPDATE ON sku_velocity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bin_characteristics_updated_at ON bin_characteristics;
CREATE TRIGGER update_bin_characteristics_updated_at
    BEFORE UPDATE ON bin_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_slotting_rules_updated_at ON slotting_rules;
CREATE TRIGGER update_slotting_rules_updated_at
    BEFORE UPDATE ON slotting_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_slotting_recommendations_updated_at ON slotting_recommendations;
CREATE TRIGGER update_slotting_recommendations_updated_at
    BEFORE UPDATE ON slotting_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==================== Helper Functions ====================

-- Function to calculate combined ABC-XYZ class
CREATE OR REPLACE FUNCTION calculate_combined_class(
    p_velocity_class VARCHAR,
    p_variability_class VARCHAR
)
RETURNS VARCHAR AS $$
BEGIN
    RETURN p_velocity_class || p_variability_class;
END;
$$ LANGUAGE plpgsql;


-- Function to expire old recommendations
CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE slotting_recommendations
    SET status = 'EXPIRED'
    WHERE status = 'PENDING'
    AND "expiresAt" < NOW();

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;


-- Function to get optimal location for velocity class
CREATE OR REPLACE FUNCTION get_optimal_zone_for_velocity(p_velocity_class VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    CASE p_velocity_class
        WHEN 'A' THEN RETURN 'FORWARD_PICK';
        WHEN 'B' THEN RETURN 'FORWARD_PICK';
        WHEN 'C' THEN RETURN 'RESERVE';
        ELSE RETURN 'BULK';
    END CASE;
END;
$$ LANGUAGE plpgsql;


COMMENT ON TABLE sku_velocity IS 'ABC/XYZ velocity classification for SKUs';
COMMENT ON TABLE bin_characteristics IS 'Physical characteristics of warehouse bins/locations';
COMMENT ON TABLE slotting_rules IS 'Rules for automated slotting decisions';
COMMENT ON TABLE slotting_recommendations IS 'Generated slotting optimization recommendations';
