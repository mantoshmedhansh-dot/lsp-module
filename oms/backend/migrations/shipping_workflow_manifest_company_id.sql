-- ============================================================================
-- Feature: Shipping Workflow - Add companyId to Manifest table
-- Date: 2026-02-14
-- Description: The Manifest table was missing the companyId column needed for
--              multi-tenant manifest management in the shipping workflow.
-- ============================================================================

-- Add companyId column to Manifest
ALTER TABLE "Manifest" ADD COLUMN IF NOT EXISTS "companyId" UUID REFERENCES "Company"(id);

-- Create index for company filtering
CREATE INDEX IF NOT EXISTS idx_manifest_company_id ON "Manifest"("companyId");

-- Backfill companyId from related deliveries (if any manifests exist)
UPDATE "Manifest" m
SET "companyId" = (
    SELECT d."companyId"
    FROM "Delivery" d
    WHERE d."manifestId" = m.id
    LIMIT 1
)
WHERE m."companyId" IS NULL;
