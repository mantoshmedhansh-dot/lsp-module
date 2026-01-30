-- Phase 3.2: Pre-orders & Subscriptions Migration
-- Creates tables for pre-orders and subscription management

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pre-order Status Enum
DO $$ BEGIN
    CREATE TYPE preorder_status AS ENUM (
        'PENDING', 'CONFIRMED', 'PARTIALLY_AVAILABLE', 'READY_TO_SHIP', 'CONVERTED', 'CANCELLED', 'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Inventory Reservation Type Enum
DO $$ BEGIN
    CREATE TYPE inventory_reservation_type AS ENUM ('SOFT', 'HARD', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Subscription Status Enum
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'PENDING_PAYMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Subscription Frequency Enum
DO $$ BEGIN
    CREATE TYPE subscription_frequency AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Schedule Status Enum
DO $$ BEGIN
    CREATE TYPE schedule_status AS ENUM ('SCHEDULED', 'PROCESSING', 'GENERATED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==================== Pre-order Tables ====================

-- Table: preorders
CREATE TABLE IF NOT EXISTS preorders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "preorderNumber" VARCHAR(50) NOT NULL UNIQUE,
    "customerId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING',
    "expectedReleaseDate" TIMESTAMP WITH TIME ZONE,
    "actualReleaseDate" TIMESTAMP WITH TIME ZONE,
    "convertedOrderId" UUID,
    "totalAmount" DECIMAL(12,2) DEFAULT 0.0,
    "depositAmount" DECIMAL(12,2) DEFAULT 0.0,
    "depositPaid" BOOLEAN DEFAULT FALSE,
    currency VARCHAR(3) DEFAULT 'INR',
    "shippingAddressId" UUID,
    "billingAddressId" UUID,
    "notificationSent" BOOLEAN DEFAULT FALSE,
    "notificationSentAt" TIMESTAMP WITH TIME ZONE,
    "cancelledAt" TIMESTAMP WITH TIME ZONE,
    "cancelReason" VARCHAR(500),
    notes TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorders_number ON preorders("preorderNumber");
CREATE INDEX IF NOT EXISTS idx_preorders_customer ON preorders("customerId");
CREATE INDEX IF NOT EXISTS idx_preorders_warehouse ON preorders("warehouseId");
CREATE INDEX IF NOT EXISTS idx_preorders_status ON preorders(status);
CREATE INDEX IF NOT EXISTS idx_preorders_release ON preorders("expectedReleaseDate");

-- Table: preorder_lines
CREATE TABLE IF NOT EXISTS preorder_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "preorderId" UUID NOT NULL REFERENCES preorders(id) ON DELETE CASCADE,
    "lineNumber" INTEGER DEFAULT 1,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    "reservedQuantity" INTEGER DEFAULT 0,
    "availableQuantity" INTEGER DEFAULT 0,
    "unitPrice" DECIMAL(10,2) DEFAULT 0.0,
    "totalPrice" DECIMAL(12,2) DEFAULT 0.0,
    "expectedDate" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorder_lines_preorder ON preorder_lines("preorderId");
CREATE INDEX IF NOT EXISTS idx_preorder_lines_item ON preorder_lines("itemId");
CREATE INDEX IF NOT EXISTS idx_preorder_lines_sku ON preorder_lines(sku);

-- Table: preorder_inventory
CREATE TABLE IF NOT EXISTS preorder_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "preorderLineId" UUID NOT NULL REFERENCES preorder_lines(id) ON DELETE CASCADE,
    "itemId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "locationId" UUID,
    "reservationType" VARCHAR(10) DEFAULT 'SOFT',
    "reservedQuantity" INTEGER DEFAULT 0,
    "reservedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "releasedAt" TIMESTAMP WITH TIME ZONE,
    "lotNumber" VARCHAR(100),
    "serialNumber" VARCHAR(100),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preorder_inv_line ON preorder_inventory("preorderLineId");
CREATE INDEX IF NOT EXISTS idx_preorder_inv_item ON preorder_inventory("itemId");
CREATE INDEX IF NOT EXISTS idx_preorder_inv_warehouse ON preorder_inventory("warehouseId");

-- ==================== Subscription Tables ====================

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "subscriptionNumber" VARCHAR(50) NOT NULL UNIQUE,
    "customerId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    frequency VARCHAR(20) DEFAULT 'MONTHLY',
    "customIntervalDays" INTEGER,
    "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "endDate" TIMESTAMP WITH TIME ZONE,
    "nextDeliveryDate" TIMESTAMP WITH TIME ZONE,
    "lastDeliveryDate" TIMESTAMP WITH TIME ZONE,
    "totalDeliveries" INTEGER DEFAULT 0,
    "deliveriesRemaining" INTEGER,
    "shippingAddressId" UUID,
    "billingAddressId" UUID,
    "paymentMethodId" UUID,
    "totalAmount" DECIMAL(12,2) DEFAULT 0.0,
    discount DECIMAL(10,2) DEFAULT 0.0,
    "discountType" VARCHAR(20),
    currency VARCHAR(3) DEFAULT 'INR',
    "pausedAt" TIMESTAMP WITH TIME ZONE,
    "pauseReason" VARCHAR(500),
    "resumeDate" TIMESTAMP WITH TIME ZONE,
    "cancelledAt" TIMESTAMP WITH TIME ZONE,
    "cancelReason" VARCHAR(500),
    notes TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_number ON subscriptions("subscriptionNumber");
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions("customerId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_warehouse ON subscriptions("warehouseId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_delivery ON subscriptions("nextDeliveryDate");
CREATE INDEX IF NOT EXISTS idx_subscriptions_start ON subscriptions("startDate");

-- Table: subscription_lines
CREATE TABLE IF NOT EXISTS subscription_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    "lineNumber" INTEGER DEFAULT 1,
    "itemId" UUID NOT NULL,
    sku VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    "unitPrice" DECIMAL(10,2) DEFAULT 0.0,
    "totalPrice" DECIMAL(12,2) DEFAULT 0.0,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_lines_sub ON subscription_lines("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_subscription_lines_item ON subscription_lines("itemId");
CREATE INDEX IF NOT EXISTS idx_subscription_lines_sku ON subscription_lines(sku);

-- Table: subscription_schedules
CREATE TABLE IF NOT EXISTS subscription_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    "scheduledDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    "generatedOrderId" UUID,
    "generatedOrderNumber" VARCHAR(50),
    "processedAt" TIMESTAMP WITH TIME ZONE,
    "failureReason" VARCHAR(500),
    "skipReason" VARCHAR(500),
    amount DECIMAL(12,2) DEFAULT 0.0,
    "attemptCount" INTEGER DEFAULT 0,
    "nextAttemptAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_schedules_sub ON subscription_schedules("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_sub_schedules_date ON subscription_schedules("scheduledDate");
CREATE INDEX IF NOT EXISTS idx_sub_schedules_status ON subscription_schedules(status);

-- Table: subscription_history
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    "previousStatus" VARCHAR(30),
    "newStatus" VARCHAR(30),
    "changedBy" UUID,
    "changeReason" VARCHAR(500),
    details JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_history_sub ON subscription_history("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_sub_history_action ON subscription_history(action);

-- Triggers
DROP TRIGGER IF EXISTS update_preorders_updated_at ON preorders;
CREATE TRIGGER update_preorders_updated_at BEFORE UPDATE ON preorders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_preorder_lines_updated_at ON preorder_lines;
CREATE TRIGGER update_preorder_lines_updated_at BEFORE UPDATE ON preorder_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_preorder_inventory_updated_at ON preorder_inventory;
CREATE TRIGGER update_preorder_inventory_updated_at BEFORE UPDATE ON preorder_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_lines_updated_at ON subscription_lines;
CREATE TRIGGER update_subscription_lines_updated_at BEFORE UPDATE ON subscription_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_schedules_updated_at ON subscription_schedules;
CREATE TRIGGER update_subscription_schedules_updated_at BEFORE UPDATE ON subscription_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_history_updated_at ON subscription_history;
CREATE TRIGGER update_subscription_history_updated_at BEFORE UPDATE ON subscription_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE preorders IS 'Pre-order records for items not yet available';
COMMENT ON TABLE preorder_inventory IS 'Reserved inventory for pre-orders';
COMMENT ON TABLE subscriptions IS 'Subscription definitions for recurring orders';
COMMENT ON TABLE subscription_schedules IS 'Delivery schedules for subscriptions';
