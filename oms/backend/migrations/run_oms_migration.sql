-- ============================================================================
-- Complete OMS Omni-Channel Migration
-- Run this file in Supabase SQL Editor
-- ============================================================================

-- First, create dependent tables if they don't exist

-- MarketplaceSettlement (parent of MarketplaceSettlementItem)
CREATE TABLE IF NOT EXISTS "MarketplaceSettlement" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    channel VARCHAR(50),
    settlement_id VARCHAR(100) NOT NULL,
    settlement_date DATE NOT NULL,
    period_start DATE,
    period_end DATE,
    currency VARCHAR(10) DEFAULT 'INR',
    total_amount DECIMAL(14, 2) DEFAULT 0,
    order_amount DECIMAL(14, 2) DEFAULT 0,
    refund_amount DECIMAL(14, 2) DEFAULT 0,
    commission_amount DECIMAL(14, 2) DEFAULT 0,
    fee_amount DECIMAL(14, 2) DEFAULT 0,
    tax_amount DECIMAL(14, 2) DEFAULT 0,
    adjustment_amount DECIMAL(14, 2) DEFAULT 0,
    net_amount DECIMAL(14, 2) DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    refund_count INTEGER DEFAULT 0,
    reconciliation_status VARCHAR(20) DEFAULT 'PENDING',
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID,
    reconciliation_notes TEXT,
    matched_amount DECIMAL(14, 2) DEFAULT 0,
    unmatched_amount DECIMAL(14, 2) DEFAULT 0,
    discrepancy_amount DECIMAL(14, 2) DEFAULT 0,
    raw_data JSONB,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_company ON "MarketplaceSettlement"(company_id);
CREATE INDEX IF NOT EXISTS idx_settlement_connection ON "MarketplaceSettlement"(connection_id);
CREATE INDEX IF NOT EXISTS idx_settlement_date ON "MarketplaceSettlement"(settlement_date);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON "MarketplaceSettlement"(reconciliation_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_unique ON "MarketplaceSettlement"(company_id, connection_id, settlement_id);

-- MarketplaceOrderSync (parent of MarketplaceOrderLineSync)
CREATE TABLE IF NOT EXISTS "MarketplaceOrderSync" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    sync_job_id UUID REFERENCES "MarketplaceSyncJob"(id) ON DELETE SET NULL,
    order_id UUID REFERENCES "Order"(id) ON DELETE SET NULL,
    marketplace_order_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    order_status VARCHAR(50),
    order_date TIMESTAMPTZ,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    shipping_address JSONB,
    billing_address JSONB,
    fulfillment_type VARCHAR(50),
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),
    ship_by_date TIMESTAMPTZ,
    deliver_by_date TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'SYNCED',
    sync_error TEXT,
    raw_order_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_sync_company ON "MarketplaceOrderSync"(company_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_connection ON "MarketplaceOrderSync"(connection_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_marketplace_id ON "MarketplaceOrderSync"(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_order ON "MarketplaceOrderSync"(order_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_job ON "MarketplaceOrderSync"(sync_job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_sync_unique ON "MarketplaceOrderSync"(company_id, connection_id, marketplace_order_id);

-- Now run the main migration

-- ============================================================================
-- 1. Marketplace SKU Mappings
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceSkuMapping" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES "SKU"(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES "MarketplaceConnection"(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    marketplace_sku VARCHAR(100) NOT NULL,
    marketplace_sku_name VARCHAR(255),
    listing_status VARCHAR(20) DEFAULT 'ACTIVE',
    marketplace_listing_id VARCHAR(255),
    price DECIMAL(12, 2),
    mrp DECIMAL(12, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    last_synced_at TIMESTAMPTZ,
    last_price_update_at TIMESTAMPTZ,
    last_inventory_update_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT TRUE,
    attributes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, channel, marketplace_sku)
);

CREATE INDEX IF NOT EXISTS idx_sku_mapping_company_channel ON "MarketplaceSkuMapping"(company_id, channel);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_sku ON "MarketplaceSkuMapping"(sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_connection ON "MarketplaceSkuMapping"(connection_id);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_marketplace_sku ON "MarketplaceSkuMapping"(marketplace_sku);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_listing_status ON "MarketplaceSkuMapping"(listing_status);

-- ============================================================================
-- 2. Marketplace OAuth Tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceOAuthToken" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ,
    refresh_expires_at TIMESTAMPTZ,
    scope TEXT,
    token_metadata JSONB,
    is_valid BOOLEAN DEFAULT TRUE,
    last_refreshed_at TIMESTAMPTZ,
    refresh_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_token_company ON "MarketplaceOAuthToken"(company_id);
CREATE INDEX IF NOT EXISTS idx_oauth_token_connection ON "MarketplaceOAuthToken"(connection_id);
CREATE INDEX IF NOT EXISTS idx_oauth_token_expires ON "MarketplaceOAuthToken"(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_token_unique_connection ON "MarketplaceOAuthToken"(connection_id) WHERE is_valid = TRUE;

-- ============================================================================
-- 3. Marketplace Webhook Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceWebhookEvent" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES "MarketplaceConnection"(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    payload JSONB NOT NULL,
    headers JSONB,
    status VARCHAR(20) DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    error_details JSONB,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON "MarketplaceWebhookEvent"(status, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_company_channel ON "MarketplaceWebhookEvent"(company_id, channel);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON "MarketplaceWebhookEvent"(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON "MarketplaceWebhookEvent"(status, next_retry_at) WHERE status = 'FAILED';
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_idempotency ON "MarketplaceWebhookEvent"(company_id, channel, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 4. Marketplace Sync Jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceSyncJob" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    records_total INTEGER DEFAULT 0,
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    sync_from_date TIMESTAMPTZ,
    sync_to_date TIMESTAMPTZ,
    last_cursor VARCHAR(500),
    error_log JSONB,
    error_message TEXT,
    result_summary JSONB,
    triggered_by VARCHAR(50),
    triggered_by_id UUID,
    parent_job_id UUID REFERENCES "MarketplaceSyncJob"(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_company ON "MarketplaceSyncJob"(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection ON "MarketplaceSyncJob"(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON "MarketplaceSyncJob"(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type_status ON "MarketplaceSyncJob"(job_type, status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_scheduled ON "MarketplaceSyncJob"(scheduled_at) WHERE status = 'PENDING';

-- ============================================================================
-- 5. Channel Inventory Rule Enhancements
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'buffer_qty'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN buffer_qty INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'priority'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN priority INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'sync_enabled'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN sync_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'last_sync_at'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN last_sync_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- 6. Settlement Line Items
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceSettlementItem" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    settlement_id UUID NOT NULL REFERENCES "MarketplaceSettlement"(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    order_id UUID REFERENCES "Order"(id) ON DELETE SET NULL,
    marketplace_order_id VARCHAR(100) NOT NULL,
    sku_id UUID REFERENCES "SKU"(id) ON DELETE SET NULL,
    marketplace_sku VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    item_price DECIMAL(12, 2) DEFAULT 0,
    shipping_charge DECIMAL(12, 2) DEFAULT 0,
    gift_wrap_charge DECIMAL(12, 2) DEFAULT 0,
    marketplace_fee DECIMAL(12, 2) DEFAULT 0,
    commission DECIMAL(12, 2) DEFAULT 0,
    fixed_fee DECIMAL(12, 2) DEFAULT 0,
    closing_fee DECIMAL(12, 2) DEFAULT 0,
    pick_pack_fee DECIMAL(12, 2) DEFAULT 0,
    weight_handling_fee DECIMAL(12, 2) DEFAULT 0,
    tax_collected DECIMAL(12, 2) DEFAULT 0,
    tax_remitted DECIMAL(12, 2) DEFAULT 0,
    tcs DECIMAL(12, 2) DEFAULT 0,
    tds DECIMAL(12, 2) DEFAULT 0,
    promotion_discount DECIMAL(12, 2) DEFAULT 0,
    seller_discount DECIMAL(12, 2) DEFAULT 0,
    refund_amount DECIMAL(12, 2) DEFAULT 0,
    net_amount DECIMAL(12, 2) DEFAULT 0,
    reconciliation_status VARCHAR(20) DEFAULT 'PENDING',
    reconciled_at TIMESTAMPTZ,
    discrepancy_amount DECIMAL(12, 2),
    discrepancy_reason VARCHAR(255),
    transaction_date DATE,
    settlement_date DATE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_item_settlement ON "MarketplaceSettlementItem"(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_item_order ON "MarketplaceSettlementItem"(order_id);
CREATE INDEX IF NOT EXISTS idx_settlement_item_marketplace_order ON "MarketplaceSettlementItem"(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_settlement_item_reconciliation ON "MarketplaceSettlementItem"(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_settlement_item_company ON "MarketplaceSettlementItem"(company_id);

-- ============================================================================
-- 7. Order Line Sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceOrderLineSync" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    order_sync_id UUID NOT NULL REFERENCES "MarketplaceOrderSync"(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES "OrderItem"(id) ON DELETE SET NULL,
    marketplace_line_id VARCHAR(100),
    marketplace_sku VARCHAR(100) NOT NULL,
    sku_id UUID REFERENCES "SKU"(id) ON DELETE SET NULL,
    sku_mapping_id UUID REFERENCES "MarketplaceSkuMapping"(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) DEFAULT 0,
    total_price DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_charge DECIMAL(12, 2) DEFAULT 0,
    gift_wrap_charge DECIMAL(12, 2) DEFAULT 0,
    fulfillment_type VARCHAR(50),
    item_status VARCHAR(50),
    line_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_line_sync_order ON "MarketplaceOrderLineSync"(order_sync_id);
CREATE INDEX IF NOT EXISTS idx_order_line_sync_sku ON "MarketplaceOrderLineSync"(sku_id);
CREATE INDEX IF NOT EXISTS idx_order_line_sync_mapping ON "MarketplaceOrderLineSync"(sku_mapping_id);

-- ============================================================================
-- 8. Inventory Sync Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceInventorySyncLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    sync_job_id UUID REFERENCES "MarketplaceSyncJob"(id) ON DELETE SET NULL,
    sku_id UUID NOT NULL REFERENCES "SKU"(id) ON DELETE CASCADE,
    sku_mapping_id UUID REFERENCES "MarketplaceSkuMapping"(id) ON DELETE SET NULL,
    marketplace_sku VARCHAR(100) NOT NULL,
    location_id UUID REFERENCES "Location"(id) ON DELETE SET NULL,
    previous_qty INTEGER DEFAULT 0,
    calculated_qty INTEGER DEFAULT 0,
    buffer_applied INTEGER DEFAULT 0,
    pushed_qty INTEGER DEFAULT 0,
    marketplace_acknowledged_qty INTEGER,
    sync_status VARCHAR(20) DEFAULT 'PENDING',
    synced_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_sync_log_company ON "MarketplaceInventorySyncLog"(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_connection ON "MarketplaceInventorySyncLog"(connection_id);
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_sku ON "MarketplaceInventorySyncLog"(sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_job ON "MarketplaceInventorySyncLog"(sync_job_id);
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_status ON "MarketplaceInventorySyncLog"(sync_status);

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_marketplace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'MarketplaceSettlement',
        'MarketplaceOrderSync',
        'MarketplaceSkuMapping',
        'MarketplaceOAuthToken',
        'MarketplaceWebhookEvent',
        'MarketplaceSyncJob',
        'MarketplaceSettlementItem',
        'MarketplaceOrderLineSync'
    ])
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS trg_' || lower(t) || '_updated_at ON "' || t || '"';
        EXECUTE 'CREATE TRIGGER trg_' || lower(t) || '_updated_at
                 BEFORE UPDATE ON "' || t || '"
                 FOR EACH ROW EXECUTE FUNCTION update_marketplace_timestamp()';
    END LOOP;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE "MarketplaceSettlement" IS 'Settlement reports from marketplaces for reconciliation';
COMMENT ON TABLE "MarketplaceOrderSync" IS 'Orders synced from marketplaces';
COMMENT ON TABLE "MarketplaceSkuMapping" IS 'Maps internal SKUs to marketplace-specific identifiers';
COMMENT ON TABLE "MarketplaceOAuthToken" IS 'OAuth tokens for marketplace API access';
COMMENT ON TABLE "MarketplaceWebhookEvent" IS 'Webhook events received from marketplaces';
COMMENT ON TABLE "MarketplaceSyncJob" IS 'Background sync job tracking';
COMMENT ON TABLE "MarketplaceSettlementItem" IS 'Line-item level settlement data';
COMMENT ON TABLE "MarketplaceOrderLineSync" IS 'Order line items synced from marketplaces';
COMMENT ON TABLE "MarketplaceInventorySyncLog" IS 'Inventory sync operation logs';

-- ============================================================================
-- Migration Complete
-- ============================================================================
SELECT 'OMS Omni-Channel Migration Completed Successfully' as status;
