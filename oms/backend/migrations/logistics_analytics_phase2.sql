-- ============================================================================
-- Feature: Logistics Intelligence — Analytics Aggregation & Webhook Hardening
-- Date: 2026-02-16
-- Description: Phase 2 migration for CarrierWebhookLog, performance indexes,
--              and unique composite indexes for analytics upserts.
-- ============================================================================

-- 1. CarrierWebhookLog table
CREATE TABLE IF NOT EXISTS "CarrierWebhookLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "carrierCode" VARCHAR NOT NULL,
    "awbNumber" VARCHAR NOT NULL,
    "eventType" VARCHAR DEFAULT 'TRACKING_UPDATE',
    "carrierStatus" VARCHAR NOT NULL,
    "omsStatus" VARCHAR,
    "rawPayload" JSONB,
    "isProcessed" BOOLEAN DEFAULT TRUE,
    "isDuplicate" BOOLEAN DEFAULT FALSE,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMPTZ DEFAULT NOW(),
    "processingResult" JSONB,
    "companyId" UUID REFERENCES "Company"(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for webhook idempotency check
CREATE INDEX IF NOT EXISTS idx_webhook_log_idempotency
    ON "CarrierWebhookLog"("awbNumber", "carrierStatus", "carrierCode")
    WHERE "isProcessed" = TRUE;

CREATE INDEX IF NOT EXISTS idx_webhook_log_awb
    ON "CarrierWebhookLog"("awbNumber");

CREATE INDEX IF NOT EXISTS idx_webhook_log_carrier
    ON "CarrierWebhookLog"("carrierCode");

CREATE INDEX IF NOT EXISTS idx_webhook_log_created
    ON "CarrierWebhookLog"("createdAt");

-- 3. Performance indexes for analytics aggregation on Delivery/Shipment
CREATE INDEX IF NOT EXISTS idx_delivery_transporter_status
    ON "Delivery"("transporterId", status);

CREATE INDEX IF NOT EXISTS idx_delivery_company_created
    ON "Delivery"("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_shipment_transporter_status
    ON "Shipment"("transporterId", status);

-- 4. Unique indexes for upsert on analytics tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_carrier_perf_upsert
    ON "CarrierPerformance"("transporterId", "companyId", "periodStart", "periodEnd", "shipmentType");

CREATE UNIQUE INDEX IF NOT EXISTS idx_lane_perf_upsert
    ON "LanePerformance"("transporterId", "companyId", "originCity", "destinationCity", "periodStart", "periodEnd", "shipmentType");

CREATE UNIQUE INDEX IF NOT EXISTS idx_pincode_perf_upsert
    ON "PincodePerformance"("transporterId", "companyId", pincode, "periodStart", "periodEnd");

-- 5. Trigger for updated_at on CarrierWebhookLog
CREATE OR REPLACE FUNCTION update_carrier_webhook_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_carrier_webhook_log_updated_at ON "CarrierWebhookLog";
CREATE TRIGGER trg_carrier_webhook_log_updated_at
    BEFORE UPDATE ON "CarrierWebhookLog"
    FOR EACH ROW EXECUTE FUNCTION update_carrier_webhook_log_timestamp();
