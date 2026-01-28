-- ============================================================================
-- WMS INBOUND PHASE 5: Polish & Performance
-- Date: 2026-01-28
-- Description: Performance indexes and additional views for WMS Inbound
-- ============================================================================

-- ============================================================================
-- 1. PERFORMANCE INDEXES
-- ============================================================================

-- External PO indexes
CREATE INDEX IF NOT EXISTS idx_epo_status_company ON external_purchase_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_epo_created ON external_purchase_orders(created_at DESC);

-- ASN indexes
CREATE INDEX IF NOT EXISTS idx_asn_status_location ON advance_shipping_notices(location_id, status);
CREATE INDEX IF NOT EXISTS idx_asn_expected ON advance_shipping_notices(expected_arrival);
CREATE INDEX IF NOT EXISTS idx_asn_created ON advance_shipping_notices(created_at DESC);

-- GoodsReceipt indexes
CREATE INDEX IF NOT EXISTS idx_gr_status_company ON "GoodsReceipt"("companyId", status);
CREATE INDEX IF NOT EXISTS idx_gr_inbound_source ON "GoodsReceipt"("inboundSource");
CREATE INDEX IF NOT EXISTS idx_gr_posted_at ON "GoodsReceipt"("updatedAt" DESC) WHERE status = 'POSTED';

-- STO indexes
CREATE INDEX IF NOT EXISTS idx_sto_status_company ON stock_transfer_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sto_shipped ON stock_transfer_orders(shipped_date DESC) WHERE status IN ('IN_TRANSIT', 'RECEIVED');

-- Return indexes
CREATE INDEX IF NOT EXISTS idx_return_location ON "Return"("locationId");
CREATE INDEX IF NOT EXISTS idx_return_qc_status ON "Return"("qcStatus");
CREATE INDEX IF NOT EXISTS idx_return_received ON "Return"("receivedAt" DESC) WHERE status = 'RECEIVED';

-- Upload batch indexes
CREATE INDEX IF NOT EXISTS idx_upload_type_status ON upload_batches(upload_type, status);
CREATE INDEX IF NOT EXISTS idx_upload_created ON upload_batches(created_at DESC);

-- ============================================================================
-- 2. DASHBOARD MATERIALIZED VIEWS (for performance)
-- ============================================================================

-- Daily inbound summary (can be refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_inbound_summary AS
SELECT
    DATE_TRUNC('day', "updatedAt") as date,
    "companyId" as company_id,
    "locationId" as location_id,
    "inboundSource" as inbound_source,
    COUNT(*) as grn_count,
    SUM("totalAcceptedQty") as total_units,
    SUM(CASE WHEN status = 'POSTED' THEN 1 ELSE 0 END) as posted_count
FROM "GoodsReceipt"
WHERE "updatedAt" >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_inbound ON mv_daily_inbound_summary(date, company_id, location_id, inbound_source);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_inbound_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_inbound_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. HELPER VIEWS
-- ============================================================================

-- Pending inbound documents (all types combined)
CREATE OR REPLACE VIEW v_pending_inbound AS
SELECT
    'GRN' as doc_type,
    id,
    "grNo" as doc_no,
    "companyId" as company_id,
    "locationId" as location_id,
    status,
    "createdAt" as created_at,
    NULL::timestamptz as expected_at,
    "totalAcceptedQty" as total_qty
FROM "GoodsReceipt"
WHERE status = 'PENDING'

UNION ALL

SELECT
    'ASN' as doc_type,
    id,
    asn_no as doc_no,
    company_id,
    location_id,
    status,
    created_at,
    expected_arrival as expected_at,
    total_expected_qty as total_qty
FROM advance_shipping_notices
WHERE status IN ('EXPECTED', 'ARRIVED')

UNION ALL

SELECT
    'STO' as doc_type,
    id,
    sto_no as doc_no,
    company_id,
    destination_location_id as location_id,
    status,
    created_at,
    required_by_date as expected_at,
    total_requested_qty as total_qty
FROM stock_transfer_orders
WHERE status IN ('APPROVED', 'PICKING', 'PICKED', 'IN_TRANSIT')

UNION ALL

SELECT
    'RETURN' as doc_type,
    id,
    "returnNo" as doc_no,
    "companyId" as company_id,
    "locationId" as location_id,
    status::text,
    "createdAt" as created_at,
    NULL::timestamptz as expected_at,
    NULL::int as total_qty
FROM "Return"
WHERE status IN ('INITIATED', 'IN_TRANSIT', 'RECEIVED')
AND ("qcStatus" IS NULL OR "qcStatus" != 'PASSED');

-- Inbound performance metrics
CREATE OR REPLACE VIEW v_inbound_metrics AS
SELECT
    g."companyId" as company_id,
    g."locationId" as location_id,
    DATE_TRUNC('day', g."updatedAt") as date,
    COUNT(*) as grn_count,
    SUM(g."totalAcceptedQty") as units_received,
    AVG(EXTRACT(EPOCH FROM (g."updatedAt" - g."createdAt"))/3600) as avg_processing_hours
FROM "GoodsReceipt" g
WHERE g.status = 'POSTED'
AND g."updatedAt" >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3;

-- ============================================================================
-- 4. STOCK ADJUSTMENT SUPPORT
-- ============================================================================

-- Add stock adjustment type to upload_batches if not exists
-- (Already supported in upload_type column: STOCK_ADJUSTMENT)

-- Stock adjustment log table
CREATE TABLE IF NOT EXISTS stock_adjustment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES "Location"(id),

    -- Reference
    adjustment_no VARCHAR(50) NOT NULL,
    upload_batch_id UUID REFERENCES upload_batches(id),

    -- SKU & Bin
    sku_id UUID NOT NULL REFERENCES "SKU"(id),
    bin_id UUID REFERENCES "Bin"(id),

    -- Quantities
    previous_qty INT NOT NULL DEFAULT 0,
    adjusted_qty INT NOT NULL DEFAULT 0,
    new_qty INT NOT NULL DEFAULT 0,

    -- Reason
    adjustment_type VARCHAR(50) NOT NULL,  -- POSITIVE, NEGATIVE, CYCLE_COUNT
    reason VARCHAR(200),
    remarks TEXT,

    -- Audit
    adjusted_by UUID REFERENCES "User"(id),
    adjusted_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adj_company ON stock_adjustment_log(company_id);
CREATE INDEX IF NOT EXISTS idx_adj_location ON stock_adjustment_log(location_id);
CREATE INDEX IF NOT EXISTS idx_adj_sku ON stock_adjustment_log(sku_id);
CREATE INDEX IF NOT EXISTS idx_adj_date ON stock_adjustment_log(adjusted_at DESC);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_daily_inbound_summary IS 'Pre-aggregated daily inbound summary for dashboard performance';
COMMENT ON VIEW v_pending_inbound IS 'Combined view of all pending inbound documents';
COMMENT ON VIEW v_inbound_metrics IS 'Inbound processing performance metrics';
COMMENT ON TABLE stock_adjustment_log IS 'Audit log for all stock adjustments';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
