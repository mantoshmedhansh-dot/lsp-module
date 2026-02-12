-- ============================================================================
-- Migration: Remove CHANNELS as separate module
-- Date: 2026-02-12
-- Description: Channels & Marketplace is now part of OMS (Order Lifecycle),
--              not a separate gated module. Remove CHANNELS from plan_modules.
-- ============================================================================

-- Remove CHANNELS module entries from all plans
DELETE FROM "PlanModule" WHERE module = 'CHANNELS';
