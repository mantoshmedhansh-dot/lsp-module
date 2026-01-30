-- ============================================================================
-- Complete OMS Omni-Channel Migration (camelCase columns)
-- ============================================================================

-- First, create dependent tables if they don't exist

-- MarketplaceSettlement
CREATE TABLE IF NOT EXISTS "MarketplaceSettlement" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "connectionId" UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    channel VARCHAR(50),
    "settlementId" VARCHAR(100) NOT NULL,
    "settlementDate" DATE NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    currency VARCHAR(10) DEFAULT 'INR',
    "totalAmount" DECIMAL(14, 2) DEFAULT 0,
    "orderAmount" DECIMAL(14, 2) DEFAULT 0,
    "refundAmount" DECIMAL(14, 2) DEFAULT 0,
    "commissionAmount" DECIMAL(14, 2) DEFAULT 0,
    "feeAmount" DECIMAL(14, 2) DEFAULT 0,
    "taxAmount" DECIMAL(14, 2) DEFAULT 0,
    "adjustmentAmount" DECIMAL(14, 2) DEFAULT 0,
    "netAmount" DECIMAL(14, 2) DEFAULT 0,
    "orderCount" INTEGER DEFAULT 0,
    "refundCount" INTEGER DEFAULT 0,
    "reconciliationStatus" VARCHAR(20) DEFAULT 'PENDING',
    "reconciledAt" TIMESTAMPTZ,
    "reconciledBy" UUID,
    "reconciliationNotes" TEXT,
    "matchedAmount" DECIMAL(14, 2) DEFAULT 0,
    "unmatchedAmount" DECIMAL(14, 2) DEFAULT 0,
    "discrepancyAmount" DECIMAL(14, 2) DEFAULT 0,
    "rawData" JSONB,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_company ON "MarketplaceSettlement"("companyId");
CREATE INDEX IF NOT EXISTS idx_settlement_connection ON "MarketplaceSettlement"("connectionId");
CREATE INDEX IF NOT EXISTS idx_settlement_date ON "MarketplaceSettlement"("settlementDate");
CREATE INDEX IF NOT EXISTS idx_settlement_status ON "MarketplaceSettlement"("reconciliationStatus");

-- MarketplaceOrderSync
CREATE TABLE IF NOT EXISTS "MarketplaceOrderSync" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "connectionId" UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    "syncJobId" UUID,
    "orderId" UUID REFERENCES "Order"(id) ON DELETE SET NULL,
    "marketplaceOrderId" VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    "orderStatus" VARCHAR(50),
    "orderDate" TIMESTAMPTZ,
    "totalAmount" DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    "customerName" VARCHAR(255),
    "customerEmail" VARCHAR(255),
    "customerPhone" VARCHAR(50),
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "fulfillmentType" VARCHAR(50),
    "paymentMethod" VARCHAR(50),
    "paymentStatus" VARCHAR(50),
    "shipByDate" TIMESTAMPTZ,
    "deliverByDate" TIMESTAMPTZ,
    "syncStatus" VARCHAR(20) DEFAULT 'SYNCED',
    "syncError" TEXT,
    "rawOrderData" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_sync_company ON "MarketplaceOrderSync"("companyId");
CREATE INDEX IF NOT EXISTS idx_order_sync_connection ON "MarketplaceOrderSync"("connectionId");
CREATE INDEX IF NOT EXISTS idx_order_sync_marketplace_id ON "MarketplaceOrderSync"("marketplaceOrderId");
CREATE INDEX IF NOT EXISTS idx_order_sync_order ON "MarketplaceOrderSync"("orderId");

-- ============================================================================
-- 1. Marketplace SKU Mappings
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceSkuMapping" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"(id) ON DELETE CASCADE,
    "connectionId" UUID REFERENCES "MarketplaceConnection"(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    "marketplaceSku" VARCHAR(100) NOT NULL,
    "marketplaceSkuName" VARCHAR(255),
    "listingStatus" VARCHAR(20) DEFAULT 'ACTIVE',
    "marketplaceListingId" VARCHAR(255),
    price DECIMAL(12, 2),
    mrp DECIMAL(12, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    "lastSyncedAt" TIMESTAMPTZ,
    "lastPriceUpdateAt" TIMESTAMPTZ,
    "lastInventoryUpdateAt" TIMESTAMPTZ,
    "syncEnabled" BOOLEAN DEFAULT TRUE,
    attributes JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("companyId", channel, "marketplaceSku")
);

CREATE INDEX IF NOT EXISTS idx_sku_mapping_company_channel ON "MarketplaceSkuMapping"("companyId", channel);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_sku ON "MarketplaceSkuMapping"("skuId");
CREATE INDEX IF NOT EXISTS idx_sku_mapping_connection ON "MarketplaceSkuMapping"("connectionId");
CREATE INDEX IF NOT EXISTS idx_sku_mapping_marketplace_sku ON "MarketplaceSkuMapping"("marketplaceSku");
CREATE INDEX IF NOT EXISTS idx_sku_mapping_listing_status ON "MarketplaceSkuMapping"("listingStatus");

-- ============================================================================
-- 2. Marketplace OAuth Tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceOAuthToken" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "connectionId" UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenType" VARCHAR(50) DEFAULT 'Bearer',
    "expiresAt" TIMESTAMPTZ,
    "refreshExpiresAt" TIMESTAMPTZ,
    scope TEXT,
    "tokenMetadata" JSONB,
    "isValid" BOOLEAN DEFAULT TRUE,
    "lastRefreshedAt" TIMESTAMPTZ,
    "refreshCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_token_company ON "MarketplaceOAuthToken"("companyId");
CREATE INDEX IF NOT EXISTS idx_oauth_token_connection ON "MarketplaceOAuthToken"("connectionId");
CREATE INDEX IF NOT EXISTS idx_oauth_token_expires ON "MarketplaceOAuthToken"("expiresAt");

-- ============================================================================
-- 3. Marketplace Webhook Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceWebhookEvent" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "connectionId" UUID REFERENCES "MarketplaceConnection"(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "eventId" VARCHAR(255),
    payload JSONB NOT NULL,
    headers JSONB,
    status VARCHAR(20) DEFAULT 'PENDING',
    "retryCount" INTEGER DEFAULT 0,
    "maxRetries" INTEGER DEFAULT 3,
    "nextRetryAt" TIMESTAMPTZ,
    "processedAt" TIMESTAMPTZ,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "idempotencyKey" VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON "MarketplaceWebhookEvent"(status, "createdAt");
CREATE INDEX IF NOT EXISTS idx_webhook_events_company_channel ON "MarketplaceWebhookEvent"("companyId", channel);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON "MarketplaceWebhookEvent"("eventType");

-- ============================================================================
-- 4. Marketplace Sync Jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceSyncJob" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "connectionId" UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    "jobType" VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    "scheduledAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "recordsTotal" INTEGER DEFAULT 0,
    "recordsProcessed" INTEGER DEFAULT 0,
    "recordsSuccess" INTEGER DEFAULT 0,
    "recordsFailed" INTEGER DEFAULT 0,
    "recordsSkipped" INTEGER DEFAULT 0,
    "syncFromDate" TIMESTAMPTZ,
    "syncToDate" TIMESTAMPTZ,
    "lastCursor" VARCHAR(500),
    "errorLog" JSONB,
    "errorMessage" TEXT,
    "resultSummary" JSONB,
    "triggeredBy" VARCHAR(50),
    "triggeredById" UUID,
    "parentJobId" UUID REFERENCES "MarketplaceSyncJob"(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_company ON "MarketplaceSyncJob"("companyId");
CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection ON "MarketplaceSyncJob"("connectionId");
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON "MarketplaceSyncJob"(status, "createdAt");
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type_status ON "MarketplaceSyncJob"("jobType", status);

-- ============================================================================
-- 5. Settlement Line Items
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceSettlementItem" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "settlementId" UUID NOT NULL REFERENCES "MarketplaceSettlement"(id) ON DELETE CASCADE,
    "connectionId" UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    "orderId" UUID REFERENCES "Order"(id) ON DELETE SET NULL,
    "marketplaceOrderId" VARCHAR(100) NOT NULL,
    "skuId" UUID REFERENCES "SKU"(id) ON DELETE SET NULL,
    "marketplaceSku" VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    "itemPrice" DECIMAL(12, 2) DEFAULT 0,
    "shippingCharge" DECIMAL(12, 2) DEFAULT 0,
    "giftWrapCharge" DECIMAL(12, 2) DEFAULT 0,
    "marketplaceFee" DECIMAL(12, 2) DEFAULT 0,
    commission DECIMAL(12, 2) DEFAULT 0,
    "fixedFee" DECIMAL(12, 2) DEFAULT 0,
    "closingFee" DECIMAL(12, 2) DEFAULT 0,
    "pickPackFee" DECIMAL(12, 2) DEFAULT 0,
    "weightHandlingFee" DECIMAL(12, 2) DEFAULT 0,
    "taxCollected" DECIMAL(12, 2) DEFAULT 0,
    "taxRemitted" DECIMAL(12, 2) DEFAULT 0,
    tcs DECIMAL(12, 2) DEFAULT 0,
    tds DECIMAL(12, 2) DEFAULT 0,
    "promotionDiscount" DECIMAL(12, 2) DEFAULT 0,
    "sellerDiscount" DECIMAL(12, 2) DEFAULT 0,
    "refundAmount" DECIMAL(12, 2) DEFAULT 0,
    "netAmount" DECIMAL(12, 2) DEFAULT 0,
    "reconciliationStatus" VARCHAR(20) DEFAULT 'PENDING',
    "reconciledAt" TIMESTAMPTZ,
    "discrepancyAmount" DECIMAL(12, 2),
    "discrepancyReason" VARCHAR(255),
    "transactionDate" DATE,
    "settlementDate" DATE,
    "rawData" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_item_settlement ON "MarketplaceSettlementItem"("settlementId");
CREATE INDEX IF NOT EXISTS idx_settlement_item_order ON "MarketplaceSettlementItem"("orderId");
CREATE INDEX IF NOT EXISTS idx_settlement_item_marketplace_order ON "MarketplaceSettlementItem"("marketplaceOrderId");
CREATE INDEX IF NOT EXISTS idx_settlement_item_reconciliation ON "MarketplaceSettlementItem"("reconciliationStatus");
CREATE INDEX IF NOT EXISTS idx_settlement_item_company ON "MarketplaceSettlementItem"("companyId");

-- ============================================================================
-- 6. Order Line Sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceOrderLineSync" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "orderSyncId" UUID NOT NULL REFERENCES "MarketplaceOrderSync"(id) ON DELETE CASCADE,
    "orderItemId" UUID REFERENCES "OrderItem"(id) ON DELETE SET NULL,
    "marketplaceLineId" VARCHAR(100),
    "marketplaceSku" VARCHAR(100) NOT NULL,
    "skuId" UUID REFERENCES "SKU"(id) ON DELETE SET NULL,
    "skuMappingId" UUID REFERENCES "MarketplaceSkuMapping"(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12, 2) DEFAULT 0,
    "totalPrice" DECIMAL(12, 2) DEFAULT 0,
    "taxAmount" DECIMAL(12, 2) DEFAULT 0,
    "discountAmount" DECIMAL(12, 2) DEFAULT 0,
    "shippingCharge" DECIMAL(12, 2) DEFAULT 0,
    "giftWrapCharge" DECIMAL(12, 2) DEFAULT 0,
    "fulfillmentType" VARCHAR(50),
    "itemStatus" VARCHAR(50),
    "lineData" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_line_sync_order ON "MarketplaceOrderLineSync"("orderSyncId");
CREATE INDEX IF NOT EXISTS idx_order_line_sync_sku ON "MarketplaceOrderLineSync"("skuId");
CREATE INDEX IF NOT EXISTS idx_order_line_sync_mapping ON "MarketplaceOrderLineSync"("skuMappingId");

-- ============================================================================
-- 7. Inventory Sync Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceInventorySyncLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "connectionId" UUID NOT NULL REFERENCES "MarketplaceConnection"(id) ON DELETE CASCADE,
    "syncJobId" UUID REFERENCES "MarketplaceSyncJob"(id) ON DELETE SET NULL,
    "skuId" UUID NOT NULL REFERENCES "SKU"(id) ON DELETE CASCADE,
    "skuMappingId" UUID REFERENCES "MarketplaceSkuMapping"(id) ON DELETE SET NULL,
    "marketplaceSku" VARCHAR(100) NOT NULL,
    "locationId" UUID REFERENCES "Location"(id) ON DELETE SET NULL,
    "previousQty" INTEGER DEFAULT 0,
    "calculatedQty" INTEGER DEFAULT 0,
    "bufferApplied" INTEGER DEFAULT 0,
    "pushedQty" INTEGER DEFAULT 0,
    "marketplaceAcknowledgedQty" INTEGER,
    "syncStatus" VARCHAR(20) DEFAULT 'PENDING',
    "syncedAt" TIMESTAMPTZ,
    "acknowledgedAt" TIMESTAMPTZ,
    "errorMessage" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_sync_log_company ON "MarketplaceInventorySyncLog"("companyId");
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_connection ON "MarketplaceInventorySyncLog"("connectionId");
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_sku ON "MarketplaceInventorySyncLog"("skuId");
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_job ON "MarketplaceInventorySyncLog"("syncJobId");
CREATE INDEX IF NOT EXISTS idx_inv_sync_log_status ON "MarketplaceInventorySyncLog"("syncStatus");

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_marketplace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
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
-- Add syncJobId FK to MarketplaceOrderSync after MarketplaceSyncJob exists
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_order_sync_job'
    ) THEN
        ALTER TABLE "MarketplaceOrderSync"
        ADD CONSTRAINT fk_order_sync_job
        FOREIGN KEY ("syncJobId") REFERENCES "MarketplaceSyncJob"(id) ON DELETE SET NULL;
    END IF;
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
