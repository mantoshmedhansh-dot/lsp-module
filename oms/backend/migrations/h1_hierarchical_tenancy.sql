-- ============================================================================
-- Feature: Hierarchical Multi-Tenancy (LSP + Brand Architecture)
-- Date: 2026-02-11
-- Description: Adds hierarchical tenancy support so an LSP (Logistics Service
--              Provider) company can onboard multiple Brand clients. Introduces
--              companyType/parentId on Company, a ClientContract junction table,
--              and ownerCompanyId/isShared on Location.
-- ============================================================================

-- ============================================================================
-- 1. ALTER TABLE "Company" — Add companyType and parentId
-- ============================================================================
DO $$
BEGIN
    -- companyType: 'LSP' or 'BRAND' (default BRAND for backward compat)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'companyType'
    ) THEN
        ALTER TABLE "Company" ADD COLUMN "companyType" VARCHAR(20) DEFAULT 'BRAND';
    END IF;

    -- parentId: self-referencing FK for LSP → Brand hierarchy (null = top-level)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'parentId'
    ) THEN
        ALTER TABLE "Company" ADD COLUMN "parentId" UUID REFERENCES "Company"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes on the new Company columns
CREATE INDEX IF NOT EXISTS idx_company_parent ON "Company"("parentId");
CREATE INDEX IF NOT EXISTS idx_company_type ON "Company"("companyType");

-- ============================================================================
-- 2. CREATE TABLE "ClientContract" — LSP ↔ Brand service agreements
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ClientContract" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parties
    "lspCompanyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "brandCompanyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,

    -- Service scope
    "serviceModel" VARCHAR(20) NOT NULL DEFAULT 'FULL',
        -- values: 'WAREHOUSING', 'LOGISTICS', 'FULL'

    -- Lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active',
        -- values: 'active', 'onboarding', 'suspended', 'terminated'
    "contractStart" DATE,
    "contractEnd" DATE,

    -- Billing
    "billingType" VARCHAR(20) DEFAULT 'per_order',
        -- values: 'per_order', 'per_sqft', 'fixed', 'hybrid'
    "billingRate" NUMERIC(12, 2) DEFAULT 0,

    -- Warehouse / module access
    "warehouseIds" JSONB DEFAULT '[]'::jsonb,
        -- array of Location UUIDs this brand client is allowed to use
    modules JSONB DEFAULT '[]'::jsonb,
        -- which OMS/WMS modules the brand client can access

    -- Custom configuration per client (SLA thresholds, rules, etc.)
    config JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),

    -- One contract per LSP-Brand pair
    UNIQUE("lspCompanyId", "brandCompanyId")
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_contract_lsp ON "ClientContract"("lspCompanyId");
CREATE INDEX IF NOT EXISTS idx_client_contract_brand ON "ClientContract"("brandCompanyId");
CREATE INDEX IF NOT EXISTS idx_client_contract_status ON "ClientContract"(status);

-- ============================================================================
-- 3. ALTER TABLE "Location" — Add ownerCompanyId and isShared
-- ============================================================================
DO $$
BEGIN
    -- ownerCompanyId: the LSP company that owns the physical warehouse
    -- null = self-owned (backward compat for existing single-tenant rows)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Location' AND column_name = 'ownerCompanyId'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN "ownerCompanyId" UUID REFERENCES "Company"(id);
    END IF;

    -- isShared: whether this warehouse serves multiple brand clients
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Location' AND column_name = 'isShared'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN "isShared" BOOLEAN DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_location_owner ON "Location"("ownerCompanyId");

-- ============================================================================
-- 4. Trigger: auto-update "updatedAt" on ClientContract
-- ============================================================================
CREATE OR REPLACE FUNCTION update_client_contract_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ClientContract_updated_at ON "ClientContract";
CREATE TRIGGER trg_ClientContract_updated_at
    BEFORE UPDATE ON "ClientContract"
    FOR EACH ROW EXECUTE FUNCTION update_client_contract_timestamp();

-- ============================================================================
-- 5. CHECK constraints (idempotent via DO block)
-- ============================================================================
DO $$
BEGIN
    -- companyType must be LSP or BRAND
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_company_type_valid'
    ) THEN
        ALTER TABLE "Company"
            ADD CONSTRAINT chk_company_type_valid
            CHECK ("companyType" IN ('LSP', 'BRAND'));
    END IF;

    -- serviceModel must be WAREHOUSING, LOGISTICS, or FULL
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_contract_service_model'
    ) THEN
        ALTER TABLE "ClientContract"
            ADD CONSTRAINT chk_contract_service_model
            CHECK ("serviceModel" IN ('WAREHOUSING', 'LOGISTICS', 'FULL'));
    END IF;

    -- status must be one of the allowed values
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_contract_status'
    ) THEN
        ALTER TABLE "ClientContract"
            ADD CONSTRAINT chk_contract_status
            CHECK (status IN ('active', 'onboarding', 'suspended', 'terminated'));
    END IF;

    -- billingType must be one of the allowed values
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_contract_billing_type'
    ) THEN
        ALTER TABLE "ClientContract"
            ADD CONSTRAINT chk_contract_billing_type
            CHECK ("billingType" IN ('per_order', 'per_sqft', 'fixed', 'hybrid'));
    END IF;
END $$;
