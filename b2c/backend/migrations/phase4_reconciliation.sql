-- Phase 4.1: Payment Reconciliation Migration
-- Creates tables for payment reconciliation and financial tracking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Settlement Status Enum
DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM (
        'PENDING', 'PROCESSING', 'MATCHED', 'PARTIALLY_MATCHED', 'RECONCILED', 'DISPUTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- COD Status Enum
DO $$ BEGIN
    CREATE TYPE cod_status AS ENUM (
        'COLLECTED', 'PENDING_REMITTANCE', 'REMITTED', 'PARTIALLY_REMITTED', 'DISPUTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chargeback Status Enum
DO $$ BEGIN
    CREATE TYPE chargeback_status AS ENUM (
        'INITIATED', 'PENDING_RESPONSE', 'RESPONDED', 'WON', 'LOST', 'ACCEPTED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chargeback Reason Enum
DO $$ BEGIN
    CREATE TYPE chargeback_reason AS ENUM (
        'PRODUCT_NOT_RECEIVED', 'PRODUCT_NOT_AS_DESCRIBED', 'UNAUTHORIZED_TRANSACTION',
        'DUPLICATE_CHARGE', 'REFUND_NOT_PROCESSED', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Discrepancy Type Enum
DO $$ BEGIN
    CREATE TYPE discrepancy_type AS ENUM (
        'AMOUNT_MISMATCH', 'MISSING_PAYMENT', 'DUPLICATE_PAYMENT', 'FEE_DISCREPANCY', 'TIMING_DIFFERENCE'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Escrow Status Enum
DO $$ BEGIN
    CREATE TYPE escrow_status AS ENUM ('HELD', 'RELEASED', 'PARTIALLY_RELEASED', 'FORFEITED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table: payment_settlements
CREATE TABLE IF NOT EXISTS payment_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "settlementId" VARCHAR(100) NOT NULL UNIQUE,
    "paymentGateway" VARCHAR(50) NOT NULL,
    marketplace VARCHAR(50),
    status VARCHAR(30) DEFAULT 'PENDING',
    "settlementDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
    "periodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
    "totalAmount" DECIMAL(14,2) DEFAULT 0.0,
    "totalOrders" INTEGER DEFAULT 0,
    "matchedAmount" DECIMAL(14,2) DEFAULT 0.0,
    "matchedOrders" INTEGER DEFAULT 0,
    "unmatchedAmount" DECIMAL(14,2) DEFAULT 0.0,
    "unmatchedOrders" INTEGER DEFAULT 0,
    "feeAmount" DECIMAL(12,2) DEFAULT 0.0,
    "taxAmount" DECIMAL(12,2) DEFAULT 0.0,
    "netAmount" DECIMAL(14,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    "bankReference" VARCHAR(100),
    "importedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "reconciledAt" TIMESTAMP WITH TIME ZONE,
    "reconciledBy" UUID,
    "rawData" JSONB,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_id ON payment_settlements("settlementId");
CREATE INDEX IF NOT EXISTS idx_settlements_gateway ON payment_settlements("paymentGateway");
CREATE INDEX IF NOT EXISTS idx_settlements_marketplace ON payment_settlements(marketplace);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON payment_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_date ON payment_settlements("settlementDate");

-- Table: cod_remittances
CREATE TABLE IF NOT EXISTS cod_remittances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "remittanceId" VARCHAR(100) NOT NULL UNIQUE,
    "courierPartner" VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'COLLECTED',
    "collectionDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "remittanceDate" TIMESTAMP WITH TIME ZONE,
    "totalCollected" DECIMAL(14,2) DEFAULT 0.0,
    "totalOrders" INTEGER DEFAULT 0,
    "remittedAmount" DECIMAL(14,2) DEFAULT 0.0,
    "pendingAmount" DECIMAL(14,2) DEFAULT 0.0,
    deductions DECIMAL(12,2) DEFAULT 0.0,
    "deductionDetails" JSONB,
    currency VARCHAR(3) DEFAULT 'INR',
    "bankReference" VARCHAR(100),
    "orderIds" JSONB,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cod_remittance_id ON cod_remittances("remittanceId");
CREATE INDEX IF NOT EXISTS idx_cod_courier ON cod_remittances("courierPartner");
CREATE INDEX IF NOT EXISTS idx_cod_status ON cod_remittances(status);
CREATE INDEX IF NOT EXISTS idx_cod_date ON cod_remittances("collectionDate");

-- Table: chargebacks
CREATE TABLE IF NOT EXISTS chargebacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "chargebackId" VARCHAR(100) NOT NULL UNIQUE,
    "orderId" UUID NOT NULL,
    "orderNumber" VARCHAR(50) NOT NULL,
    "transactionId" VARCHAR(100) NOT NULL,
    "paymentGateway" VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'INITIATED',
    reason VARCHAR(50) NOT NULL,
    "reasonDetails" VARCHAR(500),
    amount DECIMAL(12,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    "initiatedDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "responseDeadline" TIMESTAMP WITH TIME ZONE,
    "respondedAt" TIMESTAMP WITH TIME ZONE,
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    resolution VARCHAR(50),
    evidence JSONB,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chargebacks_id ON chargebacks("chargebackId");
CREATE INDEX IF NOT EXISTS idx_chargebacks_order ON chargebacks("orderId");
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_reason ON chargebacks(reason);
CREATE INDEX IF NOT EXISTS idx_chargebacks_date ON chargebacks("initiatedDate");

-- Table: escrow_holds
CREATE TABLE IF NOT EXISTS escrow_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "escrowId" VARCHAR(100) NOT NULL UNIQUE,
    "orderId" UUID NOT NULL,
    "orderNumber" VARCHAR(50) NOT NULL,
    marketplace VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'HELD',
    "holdAmount" DECIMAL(12,2) DEFAULT 0.0,
    "releasedAmount" DECIMAL(12,2) DEFAULT 0.0,
    "forfeitedAmount" DECIMAL(12,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    "holdDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "expectedReleaseDate" TIMESTAMP WITH TIME ZONE,
    "actualReleaseDate" TIMESTAMP WITH TIME ZONE,
    "holdReason" VARCHAR(255),
    "releaseConditions" JSONB,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_id ON escrow_holds("escrowId");
CREATE INDEX IF NOT EXISTS idx_escrow_order ON escrow_holds("orderId");
CREATE INDEX IF NOT EXISTS idx_escrow_marketplace ON escrow_holds(marketplace);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_holds(status);
CREATE INDEX IF NOT EXISTS idx_escrow_date ON escrow_holds("holdDate");

-- Table: reconciliation_discrepancies
CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "settlementId" UUID NOT NULL REFERENCES payment_settlements(id),
    "orderId" UUID,
    "orderNumber" VARCHAR(50),
    "discrepancyType" VARCHAR(30) NOT NULL,
    "expectedAmount" DECIMAL(12,2) DEFAULT 0.0,
    "actualAmount" DECIMAL(12,2) DEFAULT 0.0,
    "differenceAmount" DECIMAL(12,2) DEFAULT 0.0,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    "resolvedBy" UUID,
    resolution VARCHAR(255),
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discrepancies_settlement ON reconciliation_discrepancies("settlementId");
CREATE INDEX IF NOT EXISTS idx_discrepancies_order ON reconciliation_discrepancies("orderId");
CREATE INDEX IF NOT EXISTS idx_discrepancies_type ON reconciliation_discrepancies("discrepancyType");
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON reconciliation_discrepancies(status);

-- Triggers
DROP TRIGGER IF EXISTS update_payment_settlements_updated_at ON payment_settlements;
CREATE TRIGGER update_payment_settlements_updated_at BEFORE UPDATE ON payment_settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cod_remittances_updated_at ON cod_remittances;
CREATE TRIGGER update_cod_remittances_updated_at BEFORE UPDATE ON cod_remittances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chargebacks_updated_at ON chargebacks;
CREATE TRIGGER update_chargebacks_updated_at BEFORE UPDATE ON chargebacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escrow_holds_updated_at ON escrow_holds;
CREATE TRIGGER update_escrow_holds_updated_at BEFORE UPDATE ON escrow_holds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reconciliation_discrepancies_updated_at ON reconciliation_discrepancies;
CREATE TRIGGER update_reconciliation_discrepancies_updated_at BEFORE UPDATE ON reconciliation_discrepancies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payment_settlements IS 'Settlement batches from payment gateways';
COMMENT ON TABLE cod_remittances IS 'COD collection and remittance tracking';
COMMENT ON TABLE chargebacks IS 'Chargeback management';
COMMENT ON TABLE escrow_holds IS 'Escrow tracking for marketplace orders';
COMMENT ON TABLE reconciliation_discrepancies IS 'Payment mismatches and discrepancies';
