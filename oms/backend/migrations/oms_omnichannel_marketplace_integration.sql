-- ============================================================================
-- Feature: Omni-Channel OMS - Marketplace Integration
-- Date: 2026-01-30
-- Description: Multi-marketplace integration with SKU mapping, OAuth tokens,
--              webhook events, and sync job tracking
-- ============================================================================

-- ============================================================================
-- 1. Marketplace SKU Mappings
-- Maps internal SKUs to marketplace-specific identifiers (ASIN, FSN, StyleID)
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
-- Secure storage for OAuth access/refresh tokens with expiry tracking
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
-- Queue for incoming webhook events from marketplaces
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
-- Track synchronization operations (order pull, inventory push, settlements)
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
-- 5. Channel Allocation Rules (Enhanced)
-- Extended channel inventory allocation with buffer and priority
-- ============================================================================

-- Add new columns to existing ChannelInventoryRule if not exists
DO $$
BEGIN
    -- Add buffer_qty column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'buffer_qty'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN buffer_qty INTEGER DEFAULT 0;
    END IF;

    -- Add priority column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'priority'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN priority INTEGER DEFAULT 1;
    END IF;

    -- Add sync_enabled column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'sync_enabled'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN sync_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    -- Add last_sync_at column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChannelInventoryRule' AND column_name = 'last_sync_at'
    ) THEN
        ALTER TABLE "ChannelInventoryRule" ADD COLUMN last_sync_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- 6. Settlement Line Items
-- Individual order-level settlement data for reconciliation
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
-- 7. Marketplace Order Line Sync
-- Track individual order line items synced from marketplaces
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
-- 8. Marketplace Inventory Sync Log
-- Detailed log of inventory sync operations per SKU
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
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_marketplace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all new tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'MarketplaceSkuMapping',
        'MarketplaceOAuthToken',
        'MarketplaceWebhookEvent',
        'MarketplaceSyncJob',
        'MarketplaceSettlementItem',
        'MarketplaceOrderLineSync',
        'MarketplaceInventorySyncLog'
    ])
    LOOP
        IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || lower(t) || '_updated_at') THEN
            EXECUTE 'DROP TRIGGER IF EXISTS trg_' || lower(t) || '_updated_at ON "' || t || '"';
        END IF;
        EXECUTE 'CREATE TRIGGER trg_' || lower(t) || '_updated_at
                 BEFORE UPDATE ON "' || t || '"
                 FOR EACH ROW EXECUTE FUNCTION update_marketplace_timestamp()';
    END LOOP;
END $$;

-- ============================================================================
-- Enum Types for Job Status (if not using VARCHAR)
-- ============================================================================

-- SyncJobType values: ORDER_PULL, INVENTORY_PUSH, SETTLEMENT_FETCH, RETURN_FETCH, LISTING_SYNC
-- SyncJobStatus values: PENDING, QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
-- WebhookStatus values: PENDING, PROCESSING, PROCESSED, FAILED, IGNORED
-- ReconciliationStatus values: PENDING, MATCHED, PARTIAL, EXCESS, MISSING, UNMATCHED, DISPUTED

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE "MarketplaceSkuMapping" IS 'Maps internal SKUs to marketplace-specific identifiers (ASIN, FSN, StyleID)';
COMMENT ON TABLE "MarketplaceOAuthToken" IS 'Secure storage for OAuth access/refresh tokens with expiry tracking';
COMMENT ON TABLE "MarketplaceWebhookEvent" IS 'Queue for incoming webhook events from marketplaces';
COMMENT ON TABLE "MarketplaceSyncJob" IS 'Track synchronization operations (order pull, inventory push, settlements)';
COMMENT ON TABLE "MarketplaceSettlementItem" IS 'Individual order-level settlement data for reconciliation';
COMMENT ON TABLE "MarketplaceOrderLineSync" IS 'Track individual order line items synced from marketplaces';
COMMENT ON TABLE "MarketplaceInventorySyncLog" IS 'Detailed log of inventory sync operations per SKU';

-- ============================================================================
-- End of Migration
-- ============================================================================
