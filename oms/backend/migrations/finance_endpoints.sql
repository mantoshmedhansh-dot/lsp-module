-- ============================================================================
-- Finance Endpoints Migration
-- Date: 2026-02-12
-- Description: Creates Invoice, WeightDiscrepancy, and PaymentLedger tables
-- ============================================================================

-- Invoice table
CREATE TABLE IF NOT EXISTS "Invoice" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "invoiceNumber" VARCHAR(50) NOT NULL,
    "invoiceType" VARCHAR(20) NOT NULL DEFAULT 'freight',
    "customerId" UUID,
    "transporterId" UUID,
    "invoiceDate" DATE,
    "dueDate" DATE,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    "taxAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes TEXT,
    "lineItems" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_company ON "Invoice"("companyId");
CREATE INDEX IF NOT EXISTS idx_invoice_number ON "Invoice"("invoiceNumber");

-- Weight Discrepancy table
CREATE TABLE IF NOT EXISTS "WeightDiscrepancy" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "shipmentId" UUID,
    "awbNumber" VARCHAR(50),
    "courierName" VARCHAR(100),
    "declaredWeight" NUMERIC(8,3) NOT NULL DEFAULT 0,
    "actualWeight" NUMERIC(8,3) NOT NULL DEFAULT 0,
    "weightDiff" NUMERIC(8,3) NOT NULL DEFAULT 0,
    "chargedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "expectedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "excessCharge" NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    "disputeReason" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weight_disc_company ON "WeightDiscrepancy"("companyId");
CREATE INDEX IF NOT EXISTS idx_weight_disc_awb ON "WeightDiscrepancy"("awbNumber");

-- Payment Ledger table
CREATE TABLE IF NOT EXISTS "PaymentLedger" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "entryDate" DATE,
    "entryType" VARCHAR(20) NOT NULL DEFAULT 'credit',
    category VARCHAR(30) NOT NULL DEFAULT 'order_payment',
    "referenceType" VARCHAR(30),
    "referenceId" UUID,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    "runningBalance" NUMERIC(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_company ON "PaymentLedger"("companyId");

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_invoice_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_invoice_updated BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

CREATE OR REPLACE FUNCTION update_weight_discrepancy_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_weight_disc_updated BEFORE UPDATE ON "WeightDiscrepancy" FOR EACH ROW EXECUTE FUNCTION update_weight_discrepancy_timestamp();

CREATE OR REPLACE FUNCTION update_payment_ledger_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_payment_ledger_updated BEFORE UPDATE ON "PaymentLedger" FOR EACH ROW EXECUTE FUNCTION update_payment_ledger_timestamp();
