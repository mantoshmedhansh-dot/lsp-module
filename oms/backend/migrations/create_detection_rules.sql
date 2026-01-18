-- ============================================================================
-- DETECTION RULES TABLE AND DEFAULT RULES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create the DetectionRule table
CREATE TABLE IF NOT EXISTS "DetectionRule" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    "ruleCode" TEXT UNIQUE NOT NULL,
    "ruleType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]',
    "severityRules" JSONB NOT NULL DEFAULT '{}',
    "severityField" TEXT DEFAULT 'createdAt',
    "severityUnit" TEXT DEFAULT 'hours',
    "defaultSeverity" TEXT DEFAULT 'MEDIUM',
    "defaultPriority" INTEGER DEFAULT 3,
    "aiActionEnabled" BOOLEAN DEFAULT FALSE,
    "aiActionType" TEXT,
    "aiActionConfig" JSONB,
    "autoResolveEnabled" BOOLEAN DEFAULT FALSE,
    "autoResolveConditions" JSONB,
    "isActive" BOOLEAN DEFAULT TRUE,
    "isGlobal" BOOLEAN DEFAULT FALSE,
    "companyId" UUID,
    "lastExecutedAt" TIMESTAMP,
    "executionCount" INTEGER DEFAULT 0,
    "exceptionsCreated" INTEGER DEFAULT 0,
    "createdBy" UUID,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_detection_rule_type ON "DetectionRule"("ruleType");
CREATE INDEX IF NOT EXISTS idx_detection_rule_entity ON "DetectionRule"("entityType");
CREATE INDEX IF NOT EXISTS idx_detection_rule_active ON "DetectionRule"("isActive");
CREATE INDEX IF NOT EXISTS idx_detection_rule_company ON "DetectionRule"("companyId");

-- ============================================================================
-- INSERT DEFAULT GLOBAL RULES
-- ============================================================================

-- Rule 1: Stuck Orders (Orders in CREATED status > 4 hours)
INSERT INTO "DetectionRule" (
    id, name, description, "ruleCode", "ruleType", "entityType",
    conditions, "severityRules", "severityField", "severityUnit",
    "defaultSeverity", "defaultPriority", "aiActionEnabled", "aiActionType",
    "autoResolveEnabled", "autoResolveConditions", "isActive", "isGlobal"
) VALUES (
    gen_random_uuid(),
    'Stuck Order Detection',
    'Detects orders that have been in CREATED status for too long without processing',
    'RULE-STU-0001',
    'STUCK_ORDER',
    'Order',
    '[{"field": "status", "operator": "=", "value": "CREATED"}, {"field": "createdAt", "operator": "AGE_HOURS", "value": 4}]'::jsonb,
    '{"CRITICAL": 24, "HIGH": 12, "MEDIUM": 4, "LOW": 2}'::jsonb,
    'createdAt',
    'hours',
    'MEDIUM',
    2,
    true,
    'RECOMMEND',
    true,
    '{"field": "status", "operator": "!=", "value": "CREATED"}'::jsonb,
    true,
    true
);

-- Rule 2: SLA Breach (Deliveries past expected delivery date)
INSERT INTO "DetectionRule" (
    id, name, description, "ruleCode", "ruleType", "entityType",
    conditions, "severityRules", "severityField", "severityUnit",
    "defaultSeverity", "defaultPriority", "aiActionEnabled", "aiActionType",
    "autoResolveEnabled", "autoResolveConditions", "isActive", "isGlobal"
) VALUES (
    gen_random_uuid(),
    'SLA Breach Detection',
    'Detects deliveries that are past their expected delivery date',
    'RULE-SLA-0001',
    'SLA_BREACH',
    'Delivery',
    '[{"field": "status", "operator": "IN", "value": ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"]}, {"field": "expectedDeliveryDate", "operator": "<", "value": "TODAY"}]'::jsonb,
    '{"CRITICAL": 3, "HIGH": 1, "MEDIUM": 0, "LOW": -1}'::jsonb,
    'expectedDeliveryDate',
    'days',
    'HIGH',
    2,
    true,
    'AUTO_ESCALATE',
    true,
    '{"field": "status", "operator": "=", "value": "DELIVERED"}'::jsonb,
    true,
    true
);

-- Rule 3: NDR Escalation (Open NDRs > 48 hours)
INSERT INTO "DetectionRule" (
    id, name, description, "ruleCode", "ruleType", "entityType",
    conditions, "severityRules", "severityField", "severityUnit",
    "defaultSeverity", "defaultPriority", "aiActionEnabled", "aiActionType",
    "autoResolveEnabled", "autoResolveConditions", "isActive", "isGlobal"
) VALUES (
    gen_random_uuid(),
    'NDR Escalation Detection',
    'Detects NDRs that have been open for too long without resolution',
    'RULE-NDR-0001',
    'NDR_ESCALATION',
    'NDR',
    '[{"field": "status", "operator": "=", "value": "OPEN"}, {"field": "createdAt", "operator": "AGE_HOURS", "value": 24}]'::jsonb,
    '{"CRITICAL": 96, "HIGH": 48, "MEDIUM": 24, "LOW": 12}'::jsonb,
    'createdAt',
    'hours',
    'HIGH',
    2,
    true,
    'AUTO_OUTREACH',
    true,
    '{"field": "status", "operator": "IN", "value": ["RESOLVED", "RTO"]}'::jsonb,
    true,
    true
);

-- Rule 4: Carrier Delay (Shipments in transit > 72 hours)
INSERT INTO "DetectionRule" (
    id, name, description, "ruleCode", "ruleType", "entityType",
    conditions, "severityRules", "severityField", "severityUnit",
    "defaultSeverity", "defaultPriority", "aiActionEnabled", "aiActionType",
    "autoResolveEnabled", "autoResolveConditions", "isActive", "isGlobal"
) VALUES (
    gen_random_uuid(),
    'Carrier Delay Detection',
    'Detects shipments that have been in transit for too long',
    'RULE-CAR-0001',
    'CARRIER_DELAY',
    'Delivery',
    '[{"field": "status", "operator": "IN", "value": ["PICKED_UP", "IN_TRANSIT"]}, {"field": "dispatchedAt", "operator": "AGE_HOURS", "value": 48}]'::jsonb,
    '{"CRITICAL": 120, "HIGH": 72, "MEDIUM": 48, "LOW": 24}'::jsonb,
    'dispatchedAt',
    'hours',
    'MEDIUM',
    3,
    true,
    'RECOMMEND',
    true,
    '{"field": "status", "operator": "IN", "value": ["DELIVERED", "OUT_FOR_DELIVERY"]}'::jsonb,
    true,
    true
);

-- Rule 5: High Value Stuck Order (Orders > 10000 stuck)
INSERT INTO "DetectionRule" (
    id, name, description, "ruleCode", "ruleType", "entityType",
    conditions, "severityRules", "severityField", "severityUnit",
    "defaultSeverity", "defaultPriority", "aiActionEnabled", "aiActionType",
    "autoResolveEnabled", "autoResolveConditions", "isActive", "isGlobal"
) VALUES (
    gen_random_uuid(),
    'High Value Order Alert',
    'Prioritizes high-value orders that are stuck',
    'RULE-HVO-0001',
    'STUCK_ORDER',
    'Order',
    '[{"field": "status", "operator": "=", "value": "CREATED"}, {"field": "totalAmount", "operator": ">", "value": 10000}, {"field": "createdAt", "operator": "AGE_HOURS", "value": 2}]'::jsonb,
    '{"CRITICAL": 8, "HIGH": 4, "MEDIUM": 2, "LOW": 1}'::jsonb,
    'createdAt',
    'hours',
    'HIGH',
    1,
    true,
    'AUTO_ESCALATE',
    true,
    '{"field": "status", "operator": "!=", "value": "CREATED"}'::jsonb,
    true,
    true
);

-- Verify insertion
SELECT "ruleCode", name, "ruleType", "entityType", "isActive" FROM "DetectionRule";
