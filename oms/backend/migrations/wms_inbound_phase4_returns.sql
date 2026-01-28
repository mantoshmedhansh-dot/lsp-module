-- ============================================================================
-- WMS INBOUND PHASE 4: Return Integration
-- Date: 2026-01-28
-- Description: Enhance returns for WMS receiving workflow
-- ============================================================================

-- ============================================================================
-- 1. ADD NEW COLUMNS TO RETURN TABLE
-- ============================================================================

-- Add location reference (receiving location)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'locationId'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "locationId" UUID REFERENCES "Location"(id);
        CREATE INDEX IF NOT EXISTS idx_return_location ON "Return"("locationId");
    END IF;
END $$;

-- Add goods receipt reference (created when return is received)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'goodsReceiptId'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "goodsReceiptId" UUID REFERENCES "GoodsReceipt"(id);
    END IF;
END $$;

-- Add destination zone for QC routing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'destinationZoneId'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "destinationZoneId" UUID REFERENCES "Zone"(id);
    END IF;
END $$;

-- Add vehicle and driver info for receiving
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'vehicleNumber'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "vehicleNumber" VARCHAR(50);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'driverName'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "driverName" VARCHAR(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'driverPhone'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "driverPhone" VARCHAR(20);
    END IF;
END $$;

-- Add received by user reference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Return' AND column_name = 'receivedBy'
    ) THEN
        ALTER TABLE "Return" ADD COLUMN "receivedBy" UUID REFERENCES "User"(id);
    END IF;
END $$;

-- ============================================================================
-- 2. ADD NEW COLUMNS TO RETURN ITEM TABLE
-- ============================================================================

-- Add destination bin for putaway
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ReturnItem' AND column_name = 'destinationBinId'
    ) THEN
        ALTER TABLE "ReturnItem" ADD COLUMN "destinationBinId" UUID REFERENCES "Bin"(id);
    END IF;
END $$;

-- Add restocked bin reference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ReturnItem' AND column_name = 'restockedBinId'
    ) THEN
        ALTER TABLE "ReturnItem" ADD COLUMN "restockedBinId" UUID REFERENCES "Bin"(id);
    END IF;
END $$;

-- Add disposed bin reference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ReturnItem' AND column_name = 'disposedBinId'
    ) THEN
        ALTER TABLE "ReturnItem" ADD COLUMN "disposedBinId" UUID REFERENCES "Bin"(id);
    END IF;
END $$;

-- Add inventory reference for restocked items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ReturnItem' AND column_name = 'restockedInventoryId'
    ) THEN
        ALTER TABLE "ReturnItem" ADD COLUMN "restockedInventoryId" UUID;
    END IF;
END $$;

-- Add batch/lot for traceability
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ReturnItem' AND column_name = 'batchNo'
    ) THEN
        ALTER TABLE "ReturnItem" ADD COLUMN "batchNo" VARCHAR(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ReturnItem' AND column_name = 'lotNo'
    ) THEN
        ALTER TABLE "ReturnItem" ADD COLUMN "lotNo" VARCHAR(100);
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE QC ZONE ROUTING CONFIG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS return_zone_routing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES "Location"(id),

    -- Routing rules
    qc_grade VARCHAR(50) NOT NULL,  -- A, B, C, DEFECTIVE, DAMAGED
    destination_zone_id UUID REFERENCES "Zone"(id),

    -- Action
    action VARCHAR(50) DEFAULT 'RESTOCK',  -- RESTOCK, REFURBISH, DISPOSE, RETURN_TO_VENDOR

    -- Priority (lower = higher priority)
    priority INT DEFAULT 100,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, location_id, qc_grade)
);

CREATE INDEX IF NOT EXISTS idx_rzr_company ON return_zone_routing(company_id);
CREATE INDEX IF NOT EXISTS idx_rzr_location ON return_zone_routing(location_id);

-- ============================================================================
-- 4. CREATE VIEWS
-- ============================================================================

-- Pending return receipts view
CREATE OR REPLACE VIEW v_pending_return_receipts AS
SELECT
    r.id,
    r."returnNo",
    r.type,
    r.status,
    r."companyId",
    r."orderId",
    r."awbNo",
    r.reason,
    r."initiatedAt",
    l.name as location_name,
    (SELECT COUNT(*) FROM "ReturnItem" ri WHERE ri."returnId" = r.id) as total_items,
    (SELECT COALESCE(SUM(quantity), 0) FROM "ReturnItem" ri WHERE ri."returnId" = r.id) as total_qty
FROM "Return" r
LEFT JOIN "Location" l ON r."locationId" = l.id
WHERE r.status IN ('INITIATED', 'PICKUP_SCHEDULED', 'IN_TRANSIT')
ORDER BY r."initiatedAt" DESC;

-- Returns pending QC view
CREATE OR REPLACE VIEW v_returns_pending_qc AS
SELECT
    r.id,
    r."returnNo",
    r.type,
    r.status,
    r."companyId",
    r."receivedAt",
    l.name as location_name,
    (SELECT COUNT(*) FROM "ReturnItem" ri WHERE ri."returnId" = r.id AND ri."qcStatus" IS NULL) as pending_qc_items,
    (SELECT COUNT(*) FROM "ReturnItem" ri WHERE ri."returnId" = r.id) as total_items
FROM "Return" r
LEFT JOIN "Location" l ON r."locationId" = l.id
WHERE r.status = 'RECEIVED'
AND r."qcStatus" IS NULL
ORDER BY r."receivedAt" ASC;

-- Returns ready for restock view
CREATE OR REPLACE VIEW v_returns_ready_for_restock AS
SELECT
    r.id,
    r."returnNo",
    r.type,
    r."companyId",
    r."qcCompletedAt",
    l.name as location_name,
    (SELECT COUNT(*) FROM "ReturnItem" ri
     WHERE ri."returnId" = r.id
     AND ri."qcStatus" = 'PASSED'
     AND ri."restockedQty" < ri."receivedQty") as pending_restock_items,
    (SELECT COALESCE(SUM(ri."receivedQty" - ri."restockedQty"), 0) FROM "ReturnItem" ri
     WHERE ri."returnId" = r.id
     AND ri."qcStatus" = 'PASSED'
     AND ri."restockedQty" < ri."receivedQty") as pending_restock_qty
FROM "Return" r
LEFT JOIN "Location" l ON r."locationId" = l.id
WHERE r."qcStatus" = 'PASSED'
ORDER BY r."qcCompletedAt" ASC;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE return_zone_routing IS 'QC-based zone routing configuration for returns';
COMMENT ON COLUMN "Return"."locationId" IS 'Warehouse location where return is received';
COMMENT ON COLUMN "Return"."goodsReceiptId" IS 'GRN created when return is received';
COMMENT ON COLUMN "Return"."destinationZoneId" IS 'Zone where return items should be placed after QC';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
