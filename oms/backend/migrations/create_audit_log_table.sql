-- ============================================================================
-- Feature: Audit Log Table
-- Date: 2026-02-14
-- Description: Create AuditLog table for tracking user actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "entityType" VARCHAR NOT NULL,
    "entityId" UUID NOT NULL,
    action VARCHAR NOT NULL,
    changes JSONB,
    "userId" UUID REFERENCES "User"(id),
    "ipAddress" VARCHAR,
    "userAgent" VARCHAR,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON "AuditLog"("entityId");
CREATE INDEX IF NOT EXISTS idx_audit_action ON "AuditLog"(action);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON "AuditLog"("createdAt" DESC);
