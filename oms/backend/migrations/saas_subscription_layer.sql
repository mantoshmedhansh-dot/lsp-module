-- ============================================================================
-- Feature: SaaS Subscription Layer
-- Date: 2026-02-11
-- Description: Adds plans, subscriptions, billing, feature flags, and
--              onboarding tables for multi-tenant SaaS conversion.
--              Also adds subscription columns to Company table.
-- ============================================================================

-- ============================================================================
-- 1. Plans Catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Plan" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    "monthlyPrice" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "annualPrice" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    "stripePriceIdMonthly" VARCHAR(100),
    "stripePriceIdAnnual" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_slug ON "Plan"(slug);
CREATE INDEX IF NOT EXISTS idx_plan_active ON "Plan"("isActive");

-- ============================================================================
-- 2. Plan Modules (which modules each plan includes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PlanModule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "planId" UUID NOT NULL REFERENCES "Plan"(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("planId", module)
);

CREATE INDEX IF NOT EXISTS idx_plan_module_plan ON "PlanModule"("planId");

-- ============================================================================
-- 3. Plan Limits (usage limits per plan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PlanLimit" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "planId" UUID NOT NULL REFERENCES "Plan"(id) ON DELETE CASCADE,
    "limitKey" VARCHAR(50) NOT NULL,
    "limitValue" INTEGER NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("planId", "limitKey")
);

CREATE INDEX IF NOT EXISTS idx_plan_limit_plan ON "PlanLimit"("planId");

-- ============================================================================
-- 4. Subscriptions (tenant subscription to a plan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TenantSubscription" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "planId" UUID NOT NULL REFERENCES "Plan"(id),
    status VARCHAR(20) NOT NULL DEFAULT 'trialing',
    "billingCycle" VARCHAR(10) NOT NULL DEFAULT 'monthly',
    "currentPeriodStart" TIMESTAMPTZ,
    "currentPeriodEnd" TIMESTAMPTZ,
    "trialEndsAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "stripeSubscriptionId" VARCHAR(100),
    "stripeCustomerId" VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscription_company ON "TenantSubscription"("companyId");
CREATE INDEX IF NOT EXISTS idx_tenant_subscription_status ON "TenantSubscription"(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscription_stripe ON "TenantSubscription"("stripeSubscriptionId");

-- ============================================================================
-- 5. Subscription Usage (monthly usage tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "SubscriptionUsage" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "skusCount" INTEGER NOT NULL DEFAULT 0,
    "usersCount" INTEGER NOT NULL DEFAULT 0,
    "locationsCount" INTEGER NOT NULL DEFAULT 0,
    "apiCallsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("companyId", period)
);

CREATE INDEX IF NOT EXISTS idx_usage_company_period ON "SubscriptionUsage"("companyId", period);

-- ============================================================================
-- 6. Billing Invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS "BillingInvoice" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "subscriptionId" UUID REFERENCES "TenantSubscription"(id),
    "invoiceNumber" VARCHAR(50),
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    "stripeInvoiceId" VARCHAR(100),
    "paidAt" TIMESTAMPTZ,
    "dueDate" TIMESTAMPTZ,
    "invoiceUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_company ON "BillingInvoice"("companyId");
CREATE INDEX IF NOT EXISTS idx_invoice_status ON "BillingInvoice"(status);

-- ============================================================================
-- 7. Feature Flags
-- ============================================================================
CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_key ON "FeatureFlag"(key);

-- ============================================================================
-- 8. Tenant Feature Overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TenantFeature" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "featureFlagId" UUID NOT NULL REFERENCES "FeatureFlag"(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("companyId", "featureFlagId")
);

CREATE INDEX IF NOT EXISTS idx_tenant_feature_company ON "TenantFeature"("companyId");

-- ============================================================================
-- 9. Onboarding Steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS "OnboardingStep" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "stepKey" VARCHAR(50) NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("companyId", "stepKey")
);

CREATE INDEX IF NOT EXISTS idx_onboarding_company ON "OnboardingStep"("companyId");

-- ============================================================================
-- 10. Alter Company table - Add subscription columns
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'subscriptionStatus'
    ) THEN
        ALTER TABLE "Company" ADD COLUMN "subscriptionStatus" VARCHAR(20) DEFAULT 'trialing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'trialEndsAt'
    ) THEN
        ALTER TABLE "Company" ADD COLUMN "trialEndsAt" TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'branding'
    ) THEN
        ALTER TABLE "Company" ADD COLUMN branding JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Company' AND column_name = 'stripeCustomerId'
    ) THEN
        ALTER TABLE "Company" ADD COLUMN "stripeCustomerId" VARCHAR(100);
    END IF;
END $$;

-- ============================================================================
-- 11. Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_saas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'Plan', 'PlanModule', 'PlanLimit', 'TenantSubscription',
        'SubscriptionUsage', 'BillingInvoice', 'FeatureFlag',
        'TenantFeature', 'OnboardingStep'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
             CREATE TRIGGER trg_%I_updated_at
                 BEFORE UPDATE ON %I
                 FOR EACH ROW EXECUTE FUNCTION update_saas_timestamp();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================================================
-- 12. Seed Data: Plans, Modules, and Limits
-- ============================================================================

-- Insert plans
INSERT INTO "Plan" (slug, name, description, "monthlyPrice", "annualPrice", "sortOrder")
VALUES
    ('free', 'Free Trial', '14-day free trial with basic OMS features', 0, 0, 0),
    ('starter', 'Starter', 'OMS + WMS for growing businesses', 3999, 39990, 1),
    ('growth', 'Growth', 'Full OMS + WMS + Logistics for scaling operations', 11999, 119990, 2),
    ('enterprise', 'Enterprise', 'All modules with unlimited usage and priority support', 39999, 399990, 3)
ON CONFLICT (slug) DO NOTHING;

-- Insert plan modules
INSERT INTO "PlanModule" ("planId", module)
SELECT p.id, m.module
FROM "Plan" p
CROSS JOIN (VALUES ('OMS')) AS m(module)
WHERE p.slug = 'free'
ON CONFLICT ("planId", module) DO NOTHING;

INSERT INTO "PlanModule" ("planId", module)
SELECT p.id, m.module
FROM "Plan" p
CROSS JOIN (VALUES ('OMS'), ('WMS')) AS m(module)
WHERE p.slug = 'starter'
ON CONFLICT ("planId", module) DO NOTHING;

INSERT INTO "PlanModule" ("planId", module)
SELECT p.id, m.module
FROM "Plan" p
CROSS JOIN (VALUES ('OMS'), ('WMS'), ('LOGISTICS')) AS m(module)
WHERE p.slug = 'growth'
ON CONFLICT ("planId", module) DO NOTHING;

INSERT INTO "PlanModule" ("planId", module)
SELECT p.id, m.module
FROM "Plan" p
CROSS JOIN (VALUES ('OMS'), ('WMS'), ('LOGISTICS'), ('CONTROL_TOWER'), ('FINANCE'), ('ANALYTICS'), ('CHANNELS')) AS m(module)
WHERE p.slug = 'enterprise'
ON CONFLICT ("planId", module) DO NOTHING;

-- Insert plan limits (-1 = unlimited)
-- Free plan limits
INSERT INTO "PlanLimit" ("planId", "limitKey", "limitValue")
SELECT p.id, l."limitKey", l."limitValue"
FROM "Plan" p
CROSS JOIN (VALUES
    ('orders_per_month', 100),
    ('skus', 50),
    ('users', 2),
    ('locations', 1),
    ('api_access', 0)
) AS l("limitKey", "limitValue")
WHERE p.slug = 'free'
ON CONFLICT ("planId", "limitKey") DO NOTHING;

-- Starter plan limits
INSERT INTO "PlanLimit" ("planId", "limitKey", "limitValue")
SELECT p.id, l."limitKey", l."limitValue"
FROM "Plan" p
CROSS JOIN (VALUES
    ('orders_per_month', 1000),
    ('skus', 500),
    ('users', 5),
    ('locations', 3),
    ('api_access', 1)
) AS l("limitKey", "limitValue")
WHERE p.slug = 'starter'
ON CONFLICT ("planId", "limitKey") DO NOTHING;

-- Growth plan limits
INSERT INTO "PlanLimit" ("planId", "limitKey", "limitValue")
SELECT p.id, l."limitKey", l."limitValue"
FROM "Plan" p
CROSS JOIN (VALUES
    ('orders_per_month', 10000),
    ('skus', 5000),
    ('users', 20),
    ('locations', 10),
    ('api_access', 1)
) AS l("limitKey", "limitValue")
WHERE p.slug = 'growth'
ON CONFLICT ("planId", "limitKey") DO NOTHING;

-- Enterprise plan limits (all unlimited = -1)
INSERT INTO "PlanLimit" ("planId", "limitKey", "limitValue")
SELECT p.id, l."limitKey", l."limitValue"
FROM "Plan" p
CROSS JOIN (VALUES
    ('orders_per_month', -1),
    ('skus', -1),
    ('users', -1),
    ('locations', -1),
    ('api_access', 1)
) AS l("limitKey", "limitValue")
WHERE p.slug = 'enterprise'
ON CONFLICT ("planId", "limitKey") DO NOTHING;
