-- =============================================================================
-- Logistics & Delivery Module - Phase 1 Migration
-- Date: 2026-01-21
-- Description: Creates tables for FTL, B2B/PTL, Performance, and Allocation Engine
-- =============================================================================

-- =============================================================================
-- FTL (Full Truck Load) Tables
-- =============================================================================

-- FTL Vehicle Type Master
CREATE TABLE IF NOT EXISTS "FTLVehicleTypeMaster" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'TRUCK_22FT',

    -- Capacity specifications
    "capacityKg" INTEGER NOT NULL DEFAULT 0,
    "capacityVolumeCBM" NUMERIC(10, 2),

    -- Dimensions (internal, in feet)
    "lengthFt" NUMERIC(6, 2),
    "widthFt" NUMERIC(6, 2),
    "heightFt" NUMERIC(6, 2),

    "description" VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS "ix_ftl_vehicle_type_master_code" ON "FTLVehicleTypeMaster"("code");
CREATE INDEX IF NOT EXISTS "ix_ftl_vehicle_type_master_company" ON "FTLVehicleTypeMaster"("companyId");


-- FTL Vendor Master
CREATE TABLE IF NOT EXISTS "FTLVendor" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    -- Contact details
    "contactPerson" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(100),

    -- Address
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(10),

    -- Business details
    "gstNumber" VARCHAR(20),
    "panNumber" VARCHAR(15),

    -- Payment terms
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" NUMERIC(14, 2),

    -- Performance defaults
    "defaultTATDays" INTEGER NOT NULL DEFAULT 3,
    "reliabilityScore" NUMERIC(5, 2),

    "remarks" TEXT
);

CREATE INDEX IF NOT EXISTS "ix_ftl_vendor_code" ON "FTLVendor"("code");
CREATE INDEX IF NOT EXISTS "ix_ftl_vendor_company" ON "FTLVendor"("companyId");


-- FTL Lane Rate Matrix
CREATE TABLE IF NOT EXISTS "FTLLaneRate" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    -- Lane definition
    "originCity" VARCHAR(100) NOT NULL,
    "originState" VARCHAR(100),
    "destinationCity" VARCHAR(100) NOT NULL,
    "destinationState" VARCHAR(100),

    -- Distance (optional)
    "distanceKm" INTEGER,

    -- Rate details
    "baseRate" NUMERIC(12, 2) NOT NULL,
    "perKmRate" NUMERIC(8, 2),

    -- Additional charges
    "loadingCharges" NUMERIC(10, 2),
    "unloadingCharges" NUMERIC(10, 2),
    "tollCharges" NUMERIC(10, 2),
    "otherCharges" NUMERIC(10, 2),

    -- TAT
    "transitDays" INTEGER NOT NULL DEFAULT 1,

    -- Validity
    "validFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "validTo" TIMESTAMPTZ,

    -- Foreign Keys
    "vehicleTypeId" UUID NOT NULL REFERENCES "FTLVehicleTypeMaster"("id") ON DELETE CASCADE,
    "vendorId" UUID NOT NULL REFERENCES "FTLVendor"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_ftl_lane_rate_origin" ON "FTLLaneRate"("originCity");
CREATE INDEX IF NOT EXISTS "ix_ftl_lane_rate_destination" ON "FTLLaneRate"("destinationCity");
CREATE INDEX IF NOT EXISTS "ix_ftl_lane_rate_vehicle" ON "FTLLaneRate"("vehicleTypeId");
CREATE INDEX IF NOT EXISTS "ix_ftl_lane_rate_vendor" ON "FTLLaneRate"("vendorId");
CREATE INDEX IF NOT EXISTS "ix_ftl_lane_rate_lookup" ON "FTLLaneRate"("originCity", "destinationCity", "vehicleTypeId", "vendorId");


-- FTL Indent/Trip Management
CREATE TABLE IF NOT EXISTS "FTLIndent" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

    "indentNo" VARCHAR(50) NOT NULL UNIQUE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    -- Origin
    "originCity" VARCHAR(100) NOT NULL,
    "originState" VARCHAR(100),
    "originAddress" TEXT,
    "originPincode" VARCHAR(10),

    -- Destination
    "destinationCity" VARCHAR(100) NOT NULL,
    "destinationState" VARCHAR(100),
    "destinationAddress" TEXT,
    "destinationPincode" VARCHAR(10),

    -- Cargo details
    "materialDescription" TEXT,
    "totalWeight" NUMERIC(12, 2),
    "totalPackages" INTEGER NOT NULL DEFAULT 0,
    "invoiceValue" NUMERIC(14, 2),
    "invoiceNumbers" VARCHAR(500),

    -- E-way bill
    "ewayBillNumber" VARCHAR(20),
    "ewayBillDate" TIMESTAMPTZ,
    "ewayBillExpiry" TIMESTAMPTZ,

    -- Vehicle assignment
    "vehicleNumber" VARCHAR(20),
    "driverName" VARCHAR(100),
    "driverPhone" VARCHAR(20),
    "driverLicense" VARCHAR(30),

    -- Dates
    "requestedPickupDate" TIMESTAMPTZ,
    "actualPickupDate" TIMESTAMPTZ,
    "expectedDeliveryDate" TIMESTAMPTZ,
    "actualDeliveryDate" TIMESTAMPTZ,

    -- Financials
    "agreedRate" NUMERIC(12, 2),
    "advanceAmount" NUMERIC(12, 2),
    "balanceAmount" NUMERIC(12, 2),

    -- POD
    "podImage" VARCHAR(500),
    "podReceivedBy" VARCHAR(100),
    "podRemarks" TEXT,
    "podDate" TIMESTAMPTZ,

    "remarks" TEXT,

    -- Foreign Keys
    "vehicleTypeId" UUID REFERENCES "FTLVehicleTypeMaster"("id"),
    "vendorId" UUID REFERENCES "FTLVendor"("id"),
    "laneRateId" UUID REFERENCES "FTLLaneRate"("id"),
    "createdById" UUID
);

CREATE INDEX IF NOT EXISTS "ix_ftl_indent_no" ON "FTLIndent"("indentNo");
CREATE INDEX IF NOT EXISTS "ix_ftl_indent_status" ON "FTLIndent"("status");
CREATE INDEX IF NOT EXISTS "ix_ftl_indent_company" ON "FTLIndent"("companyId");


-- =============================================================================
-- B2B/PTL Rate Matrix Tables
-- =============================================================================

-- PTL Rate Matrix (N×N Origin-Destination-Weight)
CREATE TABLE IF NOT EXISTS "PTLRateMatrix" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    -- Lane definition
    "originCity" VARCHAR(100) NOT NULL,
    "originState" VARCHAR(100),
    "destinationCity" VARCHAR(100) NOT NULL,
    "destinationState" VARCHAR(100),

    -- Weight slabs (rates per kg)
    "rate0to50" NUMERIC(10, 2),       -- 0-50 kg
    "rate50to100" NUMERIC(10, 2),     -- 50-100 kg
    "rate100to250" NUMERIC(10, 2),    -- 100-250 kg
    "rate250to500" NUMERIC(10, 2),    -- 250-500 kg
    "rate500to1000" NUMERIC(10, 2),   -- 500-1000 kg
    "rate1000plus" NUMERIC(10, 2),    -- 1000+ kg

    -- Minimum charge
    "minimumCharge" NUMERIC(10, 2),

    -- Additional charges
    "fodCharge" NUMERIC(10, 2),       -- Fuel/ODA surcharge
    "odaCharge" NUMERIC(10, 2),       -- Out of delivery area
    "codPercent" NUMERIC(5, 2),       -- COD collection charge %

    -- Validity
    "validFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "validTo" TIMESTAMPTZ,

    -- Foreign Key
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_ptl_rate_matrix_origin" ON "PTLRateMatrix"("originCity");
CREATE INDEX IF NOT EXISTS "ix_ptl_rate_matrix_destination" ON "PTLRateMatrix"("destinationCity");
CREATE INDEX IF NOT EXISTS "ix_ptl_rate_matrix_transporter" ON "PTLRateMatrix"("transporterId");
CREATE INDEX IF NOT EXISTS "ix_ptl_rate_matrix_lookup" ON "PTLRateMatrix"("originCity", "destinationCity", "transporterId");


-- PTL TAT Matrix (Transit Time per Lane per Transporter)
CREATE TABLE IF NOT EXISTS "PTLTATMatrix" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    -- Lane definition
    "originCity" VARCHAR(100) NOT NULL,
    "originState" VARCHAR(100),
    "destinationCity" VARCHAR(100) NOT NULL,
    "destinationState" VARCHAR(100),

    -- TAT in days
    "transitDays" INTEGER NOT NULL DEFAULT 3,
    "minTransitDays" INTEGER,
    "maxTransitDays" INTEGER,

    -- Reliability metrics (auto-calculated)
    "onTimeDeliveryPercent" NUMERIC(5, 2),

    -- Foreign Key
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_ptl_tat_matrix_origin" ON "PTLTATMatrix"("originCity");
CREATE INDEX IF NOT EXISTS "ix_ptl_tat_matrix_destination" ON "PTLTATMatrix"("destinationCity");
CREATE INDEX IF NOT EXISTS "ix_ptl_tat_matrix_transporter" ON "PTLTATMatrix"("transporterId");
CREATE INDEX IF NOT EXISTS "ix_ptl_tat_matrix_lookup" ON "PTLTATMatrix"("originCity", "destinationCity", "transporterId");


-- =============================================================================
-- Performance Tracking Tables
-- =============================================================================

-- Carrier Performance (Aggregated)
CREATE TABLE IF NOT EXISTS "CarrierPerformance" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

    -- Period
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,

    -- Shipment type
    "shipmentType" VARCHAR(20) NOT NULL DEFAULT 'B2C',

    -- Volume metrics
    "totalShipments" INTEGER NOT NULL DEFAULT 0,
    "deliveredShipments" INTEGER NOT NULL DEFAULT 0,
    "rtoShipments" INTEGER NOT NULL DEFAULT 0,

    -- Performance scores (0-100)
    "costScore" NUMERIC(5, 2),
    "speedScore" NUMERIC(5, 2),
    "reliabilityScore" NUMERIC(5, 2),
    "overallScore" NUMERIC(5, 2),

    -- Raw metrics
    "avgTATDays" NUMERIC(6, 2),
    "avgCostPerKg" NUMERIC(10, 2),
    "successRate" NUMERIC(5, 2),
    "rtoRate" NUMERIC(5, 2),
    "onTimeRate" NUMERIC(5, 2),

    -- Foreign Key
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_carrier_performance_period" ON "CarrierPerformance"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "ix_carrier_performance_transporter" ON "CarrierPerformance"("transporterId");
CREATE INDEX IF NOT EXISTS "ix_carrier_performance_company" ON "CarrierPerformance"("companyId");


-- Pincode Performance (B2C - Pincode-level)
CREATE TABLE IF NOT EXISTS "PincodePerformance" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

    "pincode" VARCHAR(10) NOT NULL,

    -- Period
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,

    -- Volume metrics
    "totalShipments" INTEGER NOT NULL DEFAULT 0,
    "deliveredShipments" INTEGER NOT NULL DEFAULT 0,
    "rtoShipments" INTEGER NOT NULL DEFAULT 0,

    -- Performance scores (0-100)
    "costScore" NUMERIC(5, 2),
    "speedScore" NUMERIC(5, 2),
    "reliabilityScore" NUMERIC(5, 2),
    "overallScore" NUMERIC(5, 2),

    -- Raw metrics
    "avgTATDays" NUMERIC(6, 2),
    "avgCost" NUMERIC(10, 2),
    "successRate" NUMERIC(5, 2),
    "rtoRate" NUMERIC(5, 2),
    "onTimeRate" NUMERIC(5, 2),

    -- Foreign Key
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_pincode_performance_pincode" ON "PincodePerformance"("pincode");
CREATE INDEX IF NOT EXISTS "ix_pincode_performance_period" ON "PincodePerformance"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "ix_pincode_performance_transporter" ON "PincodePerformance"("transporterId");
CREATE INDEX IF NOT EXISTS "ix_pincode_performance_lookup" ON "PincodePerformance"("pincode", "transporterId");


-- Lane Performance (FTL/B2B - Lane-level)
CREATE TABLE IF NOT EXISTS "LanePerformance" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

    -- Lane definition
    "originCity" VARCHAR(100) NOT NULL,
    "destinationCity" VARCHAR(100) NOT NULL,

    -- Shipment type (FTL or B2B_PTL)
    "shipmentType" VARCHAR(20) NOT NULL DEFAULT 'B2B_PTL',

    -- Period
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,

    -- Volume metrics
    "totalShipments" INTEGER NOT NULL DEFAULT 0,
    "deliveredShipments" INTEGER NOT NULL DEFAULT 0,

    -- Performance scores (0-100)
    "costScore" NUMERIC(5, 2),
    "speedScore" NUMERIC(5, 2),
    "reliabilityScore" NUMERIC(5, 2),
    "overallScore" NUMERIC(5, 2),

    -- Raw metrics
    "avgTATDays" NUMERIC(6, 2),
    "avgCost" NUMERIC(12, 2),
    "onTimeRate" NUMERIC(5, 2),

    -- Foreign Key
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ix_lane_performance_origin" ON "LanePerformance"("originCity");
CREATE INDEX IF NOT EXISTS "ix_lane_performance_destination" ON "LanePerformance"("destinationCity");
CREATE INDEX IF NOT EXISTS "ix_lane_performance_period" ON "LanePerformance"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "ix_lane_performance_transporter" ON "LanePerformance"("transporterId");
CREATE INDEX IF NOT EXISTS "ix_lane_performance_lookup" ON "LanePerformance"("originCity", "destinationCity", "transporterId");


-- =============================================================================
-- Allocation Engine Tables
-- =============================================================================

-- CSR Score Configuration
CREATE TABLE IF NOT EXISTS "CSRScoreConfig" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),

    -- Shipment type this config applies to (NULL = all)
    "shipmentType" VARCHAR(20),

    -- Weights (must sum to 1.0)
    "costWeight" NUMERIC(4, 2) NOT NULL DEFAULT 0.50,
    "speedWeight" NUMERIC(4, 2) NOT NULL DEFAULT 0.30,
    "reliabilityWeight" NUMERIC(4, 2) NOT NULL DEFAULT 0.20,

    -- Thresholds
    "minReliabilityScore" NUMERIC(5, 2),
    "maxCostThreshold" NUMERIC(12, 2),

    -- Default allocation mode
    "defaultMode" VARCHAR(20) NOT NULL DEFAULT 'AUTO',

    "isDefault" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS "ix_csr_score_config_company" ON "CSRScoreConfig"("companyId");
CREATE INDEX IF NOT EXISTS "ix_csr_score_config_default" ON "CSRScoreConfig"("isDefault") WHERE "isDefault" = true;


-- Shipping Allocation Rule (Enhanced)
CREATE TABLE IF NOT EXISTS "ShippingAllocationRule" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,

    -- Priority (lower = higher priority)
    "priority" INTEGER NOT NULL DEFAULT 100,

    -- Shipment type filter (NULL = all)
    "shipmentType" VARCHAR(20),

    -- Conditions (JSON)
    "conditions" JSONB,

    -- Action: assign this transporter
    "transporterId" UUID,

    -- Or use CSR scoring
    "useCSRScoring" BOOLEAN NOT NULL DEFAULT false,
    "csrConfigId" UUID REFERENCES "CSRScoreConfig"("id"),

    -- Fallback transporter
    "fallbackTransporterId" UUID
);

CREATE INDEX IF NOT EXISTS "ix_shipping_allocation_rule_code" ON "ShippingAllocationRule"("code");
CREATE INDEX IF NOT EXISTS "ix_shipping_allocation_rule_company" ON "ShippingAllocationRule"("companyId");
CREATE INDEX IF NOT EXISTS "ix_shipping_allocation_rule_priority" ON "ShippingAllocationRule"("priority");
CREATE INDEX IF NOT EXISTS "ix_shipping_allocation_rule_active" ON "ShippingAllocationRule"("isActive") WHERE "isActive" = true;


-- Allocation Audit Trail
CREATE TABLE IF NOT EXISTS "AllocationAudit" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,

    -- Shipment type
    "shipmentType" VARCHAR(20) NOT NULL,

    -- Reference to order/shipment
    "orderId" UUID,
    "deliveryId" UUID,
    "ftlIndentId" UUID,

    -- Allocation mode used
    "allocationMode" VARCHAR(20) NOT NULL,

    -- Selected carrier
    "selectedTransporterId" UUID NOT NULL,

    -- Decision reason
    "decisionReason" VARCHAR(50) NOT NULL,

    -- Scores at time of allocation
    "costScore" NUMERIC(5, 2),
    "speedScore" NUMERIC(5, 2),
    "reliabilityScore" NUMERIC(5, 2),
    "overallScore" NUMERIC(5, 2),

    -- Calculated rate
    "calculatedRate" NUMERIC(12, 2),

    -- All candidates considered (JSON)
    "candidatesConsidered" JSONB,

    -- Rule that matched
    "matchedRuleId" UUID REFERENCES "ShippingAllocationRule"("id"),

    -- User who triggered (for manual/hybrid)
    "allocatedById" UUID,

    -- Override reason (for manual)
    "overrideReason" VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS "ix_allocation_audit_company" ON "AllocationAudit"("companyId");
CREATE INDEX IF NOT EXISTS "ix_allocation_audit_order" ON "AllocationAudit"("orderId");
CREATE INDEX IF NOT EXISTS "ix_allocation_audit_delivery" ON "AllocationAudit"("deliveryId");
CREATE INDEX IF NOT EXISTS "ix_allocation_audit_ftl_indent" ON "AllocationAudit"("ftlIndentId");
CREATE INDEX IF NOT EXISTS "ix_allocation_audit_transporter" ON "AllocationAudit"("selectedTransporterId");
CREATE INDEX IF NOT EXISTS "ix_allocation_audit_created" ON "AllocationAudit"("createdAt");


-- =============================================================================
-- Trigger for updatedAt timestamps
-- =============================================================================

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all new tables
DROP TRIGGER IF EXISTS update_ftl_vehicle_type_master_updated_at ON "FTLVehicleTypeMaster";
CREATE TRIGGER update_ftl_vehicle_type_master_updated_at
    BEFORE UPDATE ON "FTLVehicleTypeMaster"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ftl_vendor_updated_at ON "FTLVendor";
CREATE TRIGGER update_ftl_vendor_updated_at
    BEFORE UPDATE ON "FTLVendor"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ftl_lane_rate_updated_at ON "FTLLaneRate";
CREATE TRIGGER update_ftl_lane_rate_updated_at
    BEFORE UPDATE ON "FTLLaneRate"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ftl_indent_updated_at ON "FTLIndent";
CREATE TRIGGER update_ftl_indent_updated_at
    BEFORE UPDATE ON "FTLIndent"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ptl_rate_matrix_updated_at ON "PTLRateMatrix";
CREATE TRIGGER update_ptl_rate_matrix_updated_at
    BEFORE UPDATE ON "PTLRateMatrix"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ptl_tat_matrix_updated_at ON "PTLTATMatrix";
CREATE TRIGGER update_ptl_tat_matrix_updated_at
    BEFORE UPDATE ON "PTLTATMatrix"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carrier_performance_updated_at ON "CarrierPerformance";
CREATE TRIGGER update_carrier_performance_updated_at
    BEFORE UPDATE ON "CarrierPerformance"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pincode_performance_updated_at ON "PincodePerformance";
CREATE TRIGGER update_pincode_performance_updated_at
    BEFORE UPDATE ON "PincodePerformance"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lane_performance_updated_at ON "LanePerformance";
CREATE TRIGGER update_lane_performance_updated_at
    BEFORE UPDATE ON "LanePerformance"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_csr_score_config_updated_at ON "CSRScoreConfig";
CREATE TRIGGER update_csr_score_config_updated_at
    BEFORE UPDATE ON "CSRScoreConfig"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_allocation_rule_updated_at ON "ShippingAllocationRule";
CREATE TRIGGER update_shipping_allocation_rule_updated_at
    BEFORE UPDATE ON "ShippingAllocationRule"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_allocation_audit_updated_at ON "AllocationAudit";
CREATE TRIGGER update_allocation_audit_updated_at
    BEFORE UPDATE ON "AllocationAudit"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- Enable Row Level Security (RLS)
-- =============================================================================

ALTER TABLE "FTLVehicleTypeMaster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FTLVendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FTLLaneRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FTLIndent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PTLRateMatrix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PTLTATMatrix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CarrierPerformance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PincodePerformance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LanePerformance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CSRScoreConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingAllocationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AllocationAudit" ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Grant permissions to service role (Supabase)
-- =============================================================================

GRANT ALL ON "FTLVehicleTypeMaster" TO service_role;
GRANT ALL ON "FTLVendor" TO service_role;
GRANT ALL ON "FTLLaneRate" TO service_role;
GRANT ALL ON "FTLIndent" TO service_role;
GRANT ALL ON "PTLRateMatrix" TO service_role;
GRANT ALL ON "PTLTATMatrix" TO service_role;
GRANT ALL ON "CarrierPerformance" TO service_role;
GRANT ALL ON "PincodePerformance" TO service_role;
GRANT ALL ON "LanePerformance" TO service_role;
GRANT ALL ON "CSRScoreConfig" TO service_role;
GRANT ALL ON "ShippingAllocationRule" TO service_role;
GRANT ALL ON "AllocationAudit" TO service_role;


-- =============================================================================
-- Create RLS Policies (company-based isolation)
-- =============================================================================

-- FTLVehicleTypeMaster policies
CREATE POLICY "FTLVehicleTypeMaster company isolation" ON "FTLVehicleTypeMaster"
    FOR ALL USING (true);

-- FTLVendor policies
CREATE POLICY "FTLVendor company isolation" ON "FTLVendor"
    FOR ALL USING (true);

-- FTLLaneRate policies
CREATE POLICY "FTLLaneRate company isolation" ON "FTLLaneRate"
    FOR ALL USING (true);

-- FTLIndent policies
CREATE POLICY "FTLIndent company isolation" ON "FTLIndent"
    FOR ALL USING (true);

-- PTLRateMatrix policies
CREATE POLICY "PTLRateMatrix company isolation" ON "PTLRateMatrix"
    FOR ALL USING (true);

-- PTLTATMatrix policies
CREATE POLICY "PTLTATMatrix company isolation" ON "PTLTATMatrix"
    FOR ALL USING (true);

-- CarrierPerformance policies
CREATE POLICY "CarrierPerformance company isolation" ON "CarrierPerformance"
    FOR ALL USING (true);

-- PincodePerformance policies
CREATE POLICY "PincodePerformance company isolation" ON "PincodePerformance"
    FOR ALL USING (true);

-- LanePerformance policies
CREATE POLICY "LanePerformance company isolation" ON "LanePerformance"
    FOR ALL USING (true);

-- CSRScoreConfig policies
CREATE POLICY "CSRScoreConfig company isolation" ON "CSRScoreConfig"
    FOR ALL USING (true);

-- ShippingAllocationRule policies
CREATE POLICY "ShippingAllocationRule company isolation" ON "ShippingAllocationRule"
    FOR ALL USING (true);

-- AllocationAudit policies
CREATE POLICY "AllocationAudit company isolation" ON "AllocationAudit"
    FOR ALL USING (true);


-- =============================================================================
-- Summary
-- =============================================================================
-- Tables created: 12
-- 1. FTLVehicleTypeMaster - FTL vehicle type master
-- 2. FTLVendor - FTL vendor/transporter master
-- 3. FTLLaneRate - FTL lane-wise rate matrix
-- 4. FTLIndent - FTL trip/indent management
-- 5. PTLRateMatrix - B2B/PTL N×N rate matrix
-- 6. PTLTATMatrix - B2B/PTL transit time matrix
-- 7. CarrierPerformance - Aggregated carrier performance
-- 8. PincodePerformance - Pincode-level B2C performance
-- 9. LanePerformance - Lane-level FTL/B2B performance
-- 10. CSRScoreConfig - Cost/Speed/Reliability weight config
-- 11. ShippingAllocationRule - Enhanced allocation rules
-- 12. AllocationAudit - Allocation decision audit trail
-- =============================================================================
