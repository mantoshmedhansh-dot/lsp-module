-- ============================================================================
-- Feature: Client Management Enhancements
-- Date: 2026-02-14
-- Description: Add slaConfig to ClientContract for SLA tracking (Feature 8)
-- ============================================================================

-- Add slaConfig JSONB column to ClientContract
ALTER TABLE "ClientContract" ADD COLUMN IF NOT EXISTS "slaConfig" JSONB DEFAULT '{}';

-- Structure:
-- {
--   "targetDispatchHours": 24,
--   "targetDeliveryDays": 5,
--   "targetAccuracyRate": 95,
--   "targetReturnRate": 5
-- }
