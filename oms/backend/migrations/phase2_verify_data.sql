-- ============================================================================
-- Phase 2: Data Verification Script
-- Run this after phase2_test_data_seed.sql to verify data was created correctly
-- ============================================================================

-- Summary counts
SELECT
    'Fashion Forward Test Data Summary' as report,
    NOW() as generated_at;

SELECT '====== ENTITY COUNTS ======' as section;

SELECT
    entity,
    count,
    CASE
        WHEN count >= expected THEN '✓ OK'
        ELSE '✗ MISSING'
    END as status
FROM (
    SELECT 'Companies' as entity, COUNT(*) as count, 1 as expected FROM companies WHERE code = 'FASHFWD'
    UNION ALL SELECT 'Locations', COUNT(*), 2 FROM locations WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'Zones', COUNT(*), 4 FROM zones WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'Bins', COUNT(*), 8 FROM bins WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'SKUs', COUNT(*), 10 FROM skus WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'Vendors', COUNT(*), 2 FROM vendors WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'External POs', COUNT(*), 5 FROM external_pos WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'External PO Items', COUNT(*), 12 FROM external_po_items WHERE external_po_id IN (SELECT id FROM external_pos WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD'))
    UNION ALL SELECT 'ASNs', COUNT(*), 3 FROM asns WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'ASN Items', COUNT(*), 10 FROM asn_items WHERE asn_id IN (SELECT id FROM asns WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD'))
    UNION ALL SELECT 'Goods Receipts', COUNT(*), 5 FROM goods_receipts WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'GRN Items', COUNT(*), 13 FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM goods_receipts WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD'))
    UNION ALL SELECT 'Inventory', COUNT(*), 9 FROM inventory WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'Orders', COUNT(*), 20 FROM orders WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'Order Items', COUNT(*), 20 FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD'))
    UNION ALL SELECT 'Deliveries', COUNT(*), 6 FROM deliveries WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
    UNION ALL SELECT 'NDRs', COUNT(*), 5 FROM ndrs WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
) counts
ORDER BY entity;

SELECT '====== LOCATIONS ======' as section;
SELECT code, name, type, is_active FROM locations WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD');

SELECT '====== ORDER STATUS DISTRIBUTION ======' as section;
SELECT status, COUNT(*) as count
FROM orders
WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
GROUP BY status
ORDER BY
    CASE status
        WHEN 'CREATED' THEN 1
        WHEN 'CONFIRMED' THEN 2
        WHEN 'ALLOCATED' THEN 3
        WHEN 'PICKLIST_GENERATED' THEN 4
        WHEN 'PICKED' THEN 5
        WHEN 'PACKED' THEN 6
        WHEN 'SHIPPED' THEN 7
        WHEN 'DELIVERED' THEN 8
    END;

SELECT '====== EXTERNAL PO STATUS ======' as section;
SELECT status, COUNT(*) as count
FROM external_pos
WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
GROUP BY status;

SELECT '====== ASN STATUS ======' as section;
SELECT status, COUNT(*) as count
FROM asns
WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
GROUP BY status;

SELECT '====== GRN STATUS ======' as section;
SELECT status, COUNT(*) as count
FROM goods_receipts
WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
GROUP BY status;

SELECT '====== INVENTORY BY LOCATION ======' as section;
SELECT
    l.name as location,
    COUNT(DISTINCT i.sku_id) as unique_skus,
    SUM(i.quantity) as total_qty,
    SUM(i.reserved_qty) as reserved_qty,
    SUM(i.quantity - i.reserved_qty) as available_qty
FROM inventory i
JOIN locations l ON i.location_id = l.id
WHERE i.company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
GROUP BY l.name;

SELECT '====== NDR STATUS ======' as section;
SELECT status, priority, COUNT(*) as count
FROM ndrs
WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
GROUP BY status, priority
ORDER BY status, priority;

SELECT '====== TEST DATA READY FOR WORKFLOW ======' as section;
SELECT 'Test data is ready! You can now test:' as message
UNION ALL SELECT '1. Create Order → Allocate → Pick → Pack → Invoice → Dispatch'
UNION ALL SELECT '2. Create GRN from External PO (EXT-PO-2026-001 is OPEN)'
UNION ALL SELECT '3. Create GRN from ASN (ASN-2026-0001 is ARRIVED)'
UNION ALL SELECT '4. Process NDR cases (5 cases across different statuses)'
UNION ALL SELECT '5. View Dashboard metrics';
