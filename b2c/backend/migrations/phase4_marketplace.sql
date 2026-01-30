-- Phase 4.2: Marketplace Integrations Migration
-- Creates tables for multi-marketplace integration

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Marketplace Type Enum
DO $$ BEGIN
    CREATE TYPE marketplace_type AS ENUM (
        'AMAZON', 'FLIPKART', 'MYNTRA', 'AJIO', 'NYKAA', 'MEESHO', 'SHOPIFY'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Connection Status Enum
DO $$ BEGIN
    CREATE TYPE connection_status AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Listing Status Enum
DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'SUPPRESSED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Return Status Enum
DO $$ BEGIN
    CREATE TYPE return_status AS ENUM (
        'INITIATED', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSED', 'REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table: marketplace_connections
CREATE TABLE IF NOT EXISTS marketplace_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace VARCHAR(20) NOT NULL,
    "accountId" VARCHAR(100) NOT NULL,
    "accountName" VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    "warehouseId" UUID,
    "apiKey" VARCHAR(500),
    "apiSecret" VARCHAR(500),
    "accessToken" VARCHAR(1000),
    "refreshToken" VARCHAR(1000),
    "tokenExpiresAt" TIMESTAMP WITH TIME ZONE,
    "sellerId" VARCHAR(100),
    region VARCHAR(10) DEFAULT 'IN',
    "webhookUrl" VARCHAR(500),
    "webhookSecret" VARCHAR(255),
    settings JSONB,
    "lastSyncAt" TIMESTAMP WITH TIME ZONE,
    "errorMessage" VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(marketplace, "accountId")
);

CREATE INDEX IF NOT EXISTS idx_mp_connections_marketplace ON marketplace_connections(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_connections_account ON marketplace_connections("accountId");
CREATE INDEX IF NOT EXISTS idx_mp_connections_status ON marketplace_connections(status);
CREATE INDEX IF NOT EXISTS idx_mp_connections_warehouse ON marketplace_connections("warehouseId");

-- Table: marketplace_listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connectionId" UUID NOT NULL REFERENCES marketplace_connections(id),
    marketplace VARCHAR(20) NOT NULL,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "marketplaceSku" VARCHAR(100),
    asin VARCHAR(20),
    fsn VARCHAR(50),
    "listingId" VARCHAR(100),
    status VARCHAR(20) DEFAULT 'DRAFT',
    title VARCHAR(500),
    price DECIMAL(10,2) DEFAULT 0.0,
    "salePrice" DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'INR',
    quantity INTEGER DEFAULT 0,
    "fulfillmentChannel" VARCHAR(20),
    "lastSyncAt" TIMESTAMP WITH TIME ZONE,
    "syncStatus" VARCHAR(20) DEFAULT 'PENDING',
    "errorMessage" VARCHAR(500),
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_listings_connection ON marketplace_listings("connectionId");
CREATE INDEX IF NOT EXISTS idx_mp_listings_marketplace ON marketplace_listings(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_listings_item ON marketplace_listings("itemId");
CREATE INDEX IF NOT EXISTS idx_mp_listings_sku ON marketplace_listings(sku);
CREATE INDEX IF NOT EXISTS idx_mp_listings_mp_sku ON marketplace_listings("marketplaceSku");
CREATE INDEX IF NOT EXISTS idx_mp_listings_status ON marketplace_listings(status);

-- Table: marketplace_orders_sync
CREATE TABLE IF NOT EXISTS marketplace_orders_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connectionId" UUID NOT NULL REFERENCES marketplace_connections(id),
    marketplace VARCHAR(20) NOT NULL,
    "marketplaceOrderId" VARCHAR(100) NOT NULL,
    "orderId" UUID,
    "orderNumber" VARCHAR(50),
    "syncStatus" VARCHAR(20) DEFAULT 'PENDING',
    "syncDirection" VARCHAR(20) DEFAULT 'INBOUND',
    "orderDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "orderAmount" DECIMAL(12,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    "syncedAt" TIMESTAMP WITH TIME ZONE,
    "errorMessage" VARCHAR(500),
    "rawData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_orders_connection ON marketplace_orders_sync("connectionId");
CREATE INDEX IF NOT EXISTS idx_mp_orders_marketplace ON marketplace_orders_sync(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_orders_mp_id ON marketplace_orders_sync("marketplaceOrderId");
CREATE INDEX IF NOT EXISTS idx_mp_orders_order ON marketplace_orders_sync("orderId");
CREATE INDEX IF NOT EXISTS idx_mp_orders_status ON marketplace_orders_sync("syncStatus");

-- Table: marketplace_inventory_sync
CREATE TABLE IF NOT EXISTS marketplace_inventory_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connectionId" UUID NOT NULL REFERENCES marketplace_connections(id),
    "listingId" UUID NOT NULL REFERENCES marketplace_listings(id),
    marketplace VARCHAR(20) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "previousQuantity" INTEGER DEFAULT 0,
    "newQuantity" INTEGER DEFAULT 0,
    "syncStatus" VARCHAR(20) DEFAULT 'PENDING',
    "syncedAt" TIMESTAMP WITH TIME ZONE,
    "acknowledgedAt" TIMESTAMP WITH TIME ZONE,
    "errorMessage" VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_inv_connection ON marketplace_inventory_sync("connectionId");
CREATE INDEX IF NOT EXISTS idx_mp_inv_listing ON marketplace_inventory_sync("listingId");
CREATE INDEX IF NOT EXISTS idx_mp_inv_sku ON marketplace_inventory_sync(sku);
CREATE INDEX IF NOT EXISTS idx_mp_inv_status ON marketplace_inventory_sync("syncStatus");

-- Table: marketplace_returns
CREATE TABLE IF NOT EXISTS marketplace_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connectionId" UUID NOT NULL REFERENCES marketplace_connections(id),
    marketplace VARCHAR(20) NOT NULL,
    "marketplaceReturnId" VARCHAR(100) NOT NULL,
    "marketplaceOrderId" VARCHAR(100) NOT NULL,
    "orderId" UUID,
    "returnId" UUID,
    status VARCHAR(20) DEFAULT 'INITIATED',
    "returnReason" VARCHAR(255),
    "returnType" VARCHAR(50),
    "refundAmount" DECIMAL(10,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    "initiatedDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "receivedDate" TIMESTAMP WITH TIME ZONE,
    "processedDate" TIMESTAMP WITH TIME ZONE,
    "syncStatus" VARCHAR(20) DEFAULT 'PENDING',
    "rawData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_returns_connection ON marketplace_returns("connectionId");
CREATE INDEX IF NOT EXISTS idx_mp_returns_marketplace ON marketplace_returns(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_returns_mp_id ON marketplace_returns("marketplaceReturnId");
CREATE INDEX IF NOT EXISTS idx_mp_returns_order ON marketplace_returns("orderId");
CREATE INDEX IF NOT EXISTS idx_mp_returns_status ON marketplace_returns(status);

-- Table: marketplace_settlements
CREATE TABLE IF NOT EXISTS marketplace_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "connectionId" UUID NOT NULL REFERENCES marketplace_connections(id),
    marketplace VARCHAR(20) NOT NULL,
    "settlementId" VARCHAR(100) NOT NULL UNIQUE,
    "settlementDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
    "periodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
    "totalAmount" DECIMAL(14,2) DEFAULT 0.0,
    "ordersAmount" DECIMAL(14,2) DEFAULT 0.0,
    "refundsAmount" DECIMAL(12,2) DEFAULT 0.0,
    "feesAmount" DECIMAL(12,2) DEFAULT 0.0,
    "otherAmount" DECIMAL(12,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    "transactionCount" INTEGER DEFAULT 0,
    "syncStatus" VARCHAR(20) DEFAULT 'PENDING',
    "importedAt" TIMESTAMP WITH TIME ZONE,
    "rawData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_settlements_connection ON marketplace_settlements("connectionId");
CREATE INDEX IF NOT EXISTS idx_mp_settlements_marketplace ON marketplace_settlements(marketplace);
CREATE INDEX IF NOT EXISTS idx_mp_settlements_id ON marketplace_settlements("settlementId");
CREATE INDEX IF NOT EXISTS idx_mp_settlements_date ON marketplace_settlements("settlementDate");

-- Triggers
DROP TRIGGER IF EXISTS update_marketplace_connections_updated_at ON marketplace_connections;
CREATE TRIGGER update_marketplace_connections_updated_at BEFORE UPDATE ON marketplace_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_orders_sync_updated_at ON marketplace_orders_sync;
CREATE TRIGGER update_marketplace_orders_sync_updated_at BEFORE UPDATE ON marketplace_orders_sync
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_inventory_sync_updated_at ON marketplace_inventory_sync;
CREATE TRIGGER update_marketplace_inventory_sync_updated_at BEFORE UPDATE ON marketplace_inventory_sync
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_returns_updated_at ON marketplace_returns;
CREATE TRIGGER update_marketplace_returns_updated_at BEFORE UPDATE ON marketplace_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_settlements_updated_at ON marketplace_settlements;
CREATE TRIGGER update_marketplace_settlements_updated_at BEFORE UPDATE ON marketplace_settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE marketplace_connections IS 'OAuth/API credentials for marketplaces';
COMMENT ON TABLE marketplace_listings IS 'Product listings on marketplaces';
COMMENT ON TABLE marketplace_orders_sync IS 'Order sync log';
COMMENT ON TABLE marketplace_inventory_sync IS 'Inventory push log';
COMMENT ON TABLE marketplace_returns IS 'Return sync from marketplaces';
COMMENT ON TABLE marketplace_settlements IS 'Settlement import from marketplaces';
