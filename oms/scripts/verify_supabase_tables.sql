-- =============================================================================
-- SUPABASE TABLE VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify all required tables exist
-- Project: CJDQuick OMS (rilakxywitslblkgikzf)
-- Date: 2026-01-28
-- =============================================================================

-- Step 1: Show all existing tables
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Step 2: Count total tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- =============================================================================
-- EXPECTED TABLES CHECK (103 Tables from Backend Models)
-- =============================================================================

-- Step 3: Check CRITICAL tables (must exist for app to work)
SELECT 'CRITICAL TABLES CHECK' as check_type;
SELECT
    expected_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = expected_table
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (VALUES
    ('User'), ('Company'), ('Location'), ('Zone'), ('Bin'),
    ('Order'), ('OrderItem'), ('Delivery'),
    ('SKU'), ('Inventory'),
    ('Wave'), ('WaveItem'), ('WaveOrder'), ('Picklist'), ('PicklistItem'),
    ('Customer'), ('CustomerGroup'),
    ('Transporter'), ('TransporterConfig'), ('Manifest'),
    ('Brand')
) AS expected(expected_table)
ORDER BY status DESC, expected_table;

-- Step 4: Check HIGH PRIORITY tables
SELECT 'HIGH PRIORITY TABLES CHECK' as check_type;
SELECT
    expected_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = expected_table
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (VALUES
    ('NDR'), ('NDROutreach'), ('AIActionLog'),
    ('Inbound'), ('InboundItem'),
    ('Return'), ('ReturnItem'),
    ('GoodsReceipt'), ('GoodsReceiptItem'),
    ('ChannelConfig'), ('OrderImport'),
    ('RateCard'), ('RateCardSlab'),
    ('ShippingRule'), ('ShippingRuleCondition'),
    ('ServicePincode'), ('AWB'),
    ('CODReconciliation'), ('CODTransaction'),
    ('QCTemplate'), ('QCParameter'), ('QCExecution'), ('QCResult'), ('QCDefect'),
    ('GatePass'), ('GatePassItem'),
    ('StockAdjustment'), ('StockAdjustmentItem'),
    ('InventoryMovement'), ('InventoryAllocation'),
    ('putaway_tasks')
) AS expected(expected_table)
ORDER BY status DESC, expected_table;

-- Step 5: Check MEDIUM PRIORITY tables
SELECT 'MEDIUM PRIORITY TABLES CHECK' as check_type;
SELECT
    expected_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = expected_table
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (VALUES
    ('APIKey'), ('DetectionRule'),
    ('PriceList'), ('PriceListItem'), ('PricingTier'),
    ('Quotation'), ('QuotationItem'), ('B2BCreditTransaction'),
    ('Vendor'), ('PurchaseOrder'), ('POItem'),
    ('SKUBundle'), ('BundleItem'),
    ('VariantAttribute'), ('VariantAttributeValue'),
    ('SKUVariant'), ('SKUVariantValue'), ('SKUBrand'),
    ('CommunicationTemplate'), ('ProactiveCommunication'),
    ('ChannelInventory'), ('ChannelInventoryRule'),
    ('VirtualInventory'), ('CycleCount'), ('CycleCountItem'),
    ('B2BConsignee'), ('LorryReceipt'), ('B2BBooking'),
    ('Shipment')
) AS expected(expected_table)
ORDER BY status DESC, expected_table;

-- Step 6: Check LOGISTICS ALLOCATION tables (Phase 1)
SELECT 'LOGISTICS ALLOCATION TABLES CHECK' as check_type;
SELECT
    expected_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = expected_table
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (VALUES
    ('FTLVehicleTypeMaster'), ('FTLVendor'), ('FTLLaneRate'), ('FTLIndent'),
    ('PTLRateMatrix'), ('PTLTATMatrix'),
    ('CarrierPerformance'), ('PincodePerformance'), ('LanePerformance'),
    ('CSRScoreConfig'), ('ShippingAllocationRule'), ('AllocationAudit')
) AS expected(expected_table)
ORDER BY status DESC, expected_table;

-- Step 7: Check LOW PRIORITY tables (System/Analytics)
SELECT 'LOW PRIORITY TABLES CHECK' as check_type;
SELECT
    expected_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = expected_table
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (VALUES
    ('AuditLog'), ('Exception'), ('Sequence'), ('Session'), ('BrandUser'),
    ('AnalyticsSnapshot'), ('DemandForecast'), ('ScheduledReport'), ('ReportExecution'),
    ('WaveItemDistribution')
) AS expected(expected_table)
ORDER BY status DESC, expected_table;

-- =============================================================================
-- SUMMARY: Missing Tables
-- =============================================================================
SELECT 'MISSING TABLES SUMMARY' as check_type;

WITH expected_tables AS (
    SELECT unnest(ARRAY[
        -- Critical
        'User', 'Company', 'Location', 'Zone', 'Bin', 'Brand',
        'Order', 'OrderItem', 'Delivery',
        'SKU', 'Inventory',
        'Wave', 'WaveItem', 'WaveOrder', 'Picklist', 'PicklistItem',
        'Customer', 'CustomerGroup',
        'Transporter', 'TransporterConfig', 'Manifest',
        -- High
        'NDR', 'NDROutreach', 'AIActionLog',
        'Inbound', 'InboundItem',
        'Return', 'ReturnItem',
        'GoodsReceipt', 'GoodsReceiptItem',
        'ChannelConfig', 'OrderImport',
        'RateCard', 'RateCardSlab',
        'ShippingRule', 'ShippingRuleCondition',
        'ServicePincode', 'AWB',
        'CODReconciliation', 'CODTransaction',
        'QCTemplate', 'QCParameter', 'QCExecution', 'QCResult', 'QCDefect',
        'GatePass', 'GatePassItem',
        'StockAdjustment', 'StockAdjustmentItem',
        'InventoryMovement', 'InventoryAllocation',
        'putaway_tasks',
        -- Medium
        'APIKey', 'DetectionRule',
        'PriceList', 'PriceListItem', 'PricingTier',
        'Quotation', 'QuotationItem', 'B2BCreditTransaction',
        'Vendor', 'PurchaseOrder', 'POItem',
        'SKUBundle', 'BundleItem',
        'VariantAttribute', 'VariantAttributeValue',
        'SKUVariant', 'SKUVariantValue', 'SKUBrand',
        'CommunicationTemplate', 'ProactiveCommunication',
        'ChannelInventory', 'ChannelInventoryRule',
        'VirtualInventory', 'CycleCount', 'CycleCountItem',
        'B2BConsignee', 'LorryReceipt', 'B2BBooking',
        'Shipment',
        -- Logistics Allocation
        'FTLVehicleTypeMaster', 'FTLVendor', 'FTLLaneRate', 'FTLIndent',
        'PTLRateMatrix', 'PTLTATMatrix',
        'CarrierPerformance', 'PincodePerformance', 'LanePerformance',
        'CSRScoreConfig', 'ShippingAllocationRule', 'AllocationAudit',
        -- Low
        'AuditLog', 'Exception', 'Sequence', 'Session', 'BrandUser',
        'AnalyticsSnapshot', 'DemandForecast', 'ScheduledReport', 'ReportExecution',
        'WaveItemDistribution'
    ]) as table_name
)
SELECT table_name as missing_table
FROM expected_tables e
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = e.table_name
)
ORDER BY table_name;

-- =============================================================================
-- FIELD CONSISTENCY CHECK
-- Check if critical tables have required fields (id, companyId, createdAt, updatedAt)
-- =============================================================================
SELECT 'FIELD CONSISTENCY CHECK' as check_type;

SELECT
    t.table_name,
    MAX(CASE WHEN c.column_name = 'id' THEN 'YES' ELSE 'NO' END) as has_id,
    MAX(CASE WHEN c.column_name = 'companyId' THEN 'YES' ELSE 'NO' END) as has_companyId,
    MAX(CASE WHEN c.column_name = 'createdAt' THEN 'YES' ELSE 'NO' END) as has_createdAt,
    MAX(CASE WHEN c.column_name = 'updatedAt' THEN 'YES' ELSE 'NO' END) as has_updatedAt
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name IN ('User', 'Company', 'Location', 'Order', 'SKU', 'Inventory', 'Wave', 'NDR', 'Return')
GROUP BY t.table_name
ORDER BY t.table_name;
