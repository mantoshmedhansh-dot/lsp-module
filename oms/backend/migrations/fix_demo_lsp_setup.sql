-- ============================================================================
-- Fix Demo LSP Account Setup
-- Date: 2026-02-19
-- Status: ALREADY EXECUTED on Supabase
-- Description: Configures demo accounts for LSP→Brand multi-tenancy.
--   1. Sets admin@demo.com's company (Demo Company) as LSP
--   2. Creates Fashion Forward brand company under the LSP
--   3. Moves client@fashionforward.com to Fashion Forward company
--   4. Creates ClientContract linking LSP → Brand (serviceModel=FULL)
--   5. Creates subscription for Fashion Forward
--   6. Sets shared warehouse ownership on LSP locations
-- ============================================================================

-- Step 1: Set Demo Company to LSP, clear any self-referencing parentId
UPDATE "Company"
SET "companyType" = 'LSP', "parentId" = NULL
WHERE id = (
    SELECT "companyId" FROM "User" WHERE email = 'admin@demo.com' LIMIT 1
);

-- Step 2: Create Fashion Forward brand company under the LSP
INSERT INTO "Company" (id, code, name, "companyType", "parentId", "isActive", "subscriptionStatus", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(), 'FFW-0001', 'Fashion Forward', 'BRAND',
    (SELECT "companyId" FROM "User" WHERE email = 'admin@demo.com' LIMIT 1),
    true, 'active', NOW(), NOW()
);

-- Step 3: Move client@fashionforward.com to the new Fashion Forward company
UPDATE "User"
SET "companyId" = (SELECT id FROM "Company" WHERE code = 'FFW-0001' LIMIT 1)
WHERE email = 'client@fashionforward.com';

-- Step 4: Create ClientContract linking LSP → Fashion Forward
INSERT INTO "ClientContract" (
    id, "lspCompanyId", "brandCompanyId", "serviceModel", status,
    modules, "billingType", "billingRate", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    (SELECT "companyId" FROM "User" WHERE email = 'admin@demo.com' LIMIT 1),
    (SELECT id FROM "Company" WHERE code = 'FFW-0001' LIMIT 1),
    'FULL', 'active',
    '["OMS","WMS","LOGISTICS","CONTROL_TOWER","FINANCE","ANALYTICS"]'::jsonb,
    'per_order', 0, NOW(), NOW();

-- Step 5: Create subscription for Fashion Forward (Enterprise plan)
INSERT INTO "TenantSubscription" (id, "companyId", "planId", status, "billingCycle", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    (SELECT id FROM "Company" WHERE code = 'FFW-0001' LIMIT 1),
    (SELECT id FROM "Plan" WHERE slug = 'enterprise' AND "isActive" = true LIMIT 1),
    'active', 'monthly', NOW(), NOW();

-- Step 6: Set ownerCompanyId and isShared on LSP locations
UPDATE "Location"
SET "ownerCompanyId" = (
        SELECT "companyId" FROM "User" WHERE email = 'admin@demo.com' LIMIT 1
    ),
    "isShared" = true
WHERE "companyId" = (
    SELECT "companyId" FROM "User" WHERE email = 'admin@demo.com' LIMIT 1
)
AND ("ownerCompanyId" IS NULL OR "isShared" IS NOT TRUE);
