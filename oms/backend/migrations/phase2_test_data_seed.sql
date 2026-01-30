-- ============================================================================
-- Phase 2: Test Data Seed Script
-- Date: 2026-01-30
-- Description: Creates comprehensive test data for end-to-end workflow testing
--
-- This script creates:
-- - 1 Company (Fashion Forward - may already exist)
-- - 2 Locations (Tokyo WH, Noida WH)
-- - 2 Zones per location
-- - 4 Bins per zone
-- - 10 SKUs
-- - 2 Vendors
-- - 5 External POs (various statuses)
-- - 3 ASNs linked to POs
-- - 5 GRNs (3 POSTED to create inventory)
-- - 20 Orders (across lifecycle statuses)
-- - 5 NDR cases
-- ============================================================================

-- Use a transaction for safety
BEGIN;

-- ============================================================================
-- 1. COMPANY (Fashion Forward)
-- ============================================================================

-- Check if Fashion Forward exists, if not create it
INSERT INTO companies (id, code, name, legal_name, gst, pan, email, phone, is_active, created_at, updated_at)
SELECT
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'FASHFWD',
    'Fashion Forward',
    'Fashion Forward Pvt Ltd',
    '27AABCF1234A1Z5',
    'AABCF1234A',
    'admin@fashionforward.com',
    '+91-9876543210',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM companies WHERE code = 'FASHFWD'
);

-- Get the company ID (either existing or newly created)
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM companies WHERE code = 'FASHFWD' LIMIT 1;

    -- Store for use in subsequent queries
    PERFORM set_config('test_data.company_id', v_company_id::text, false);
END $$;

-- ============================================================================
-- 2. LOCATIONS (2 Warehouses)
-- ============================================================================

INSERT INTO locations (id, code, name, type, company_id, address, contact_person, contact_phone, contact_email, gst, is_active, created_at, updated_at)
SELECT
    'l0000000-0000-0000-0000-000000000001'::uuid,
    'TOKYO-WH',
    'Tokyo Main Warehouse',
    'WAREHOUSE',
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    '{"line1": "1-1 Shibuya", "city": "Tokyo", "state": "Tokyo", "country": "Japan", "pincode": "150-0002"}'::jsonb,
    'Tanaka San',
    '+81-3-1234-5678',
    'tokyo@fashionforward.com',
    '27AABCF1234A1Z5',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'TOKYO-WH')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, code, name, type, company_id, address, contact_person, contact_phone, contact_email, gst, is_active, created_at, updated_at)
SELECT
    'l0000000-0000-0000-0000-000000000002'::uuid,
    'NOIDA-WH',
    'Noida Fulfillment Center',
    'WAREHOUSE',
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    '{"line1": "Sector 62", "city": "Noida", "state": "Uttar Pradesh", "country": "India", "pincode": "201301"}'::jsonb,
    'Rahul Kumar',
    '+91-9876543211',
    'noida@fashionforward.com',
    '09AABCF1234A1Z3',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'NOIDA-WH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. ZONES (2 per location)
-- ============================================================================

-- Tokyo WH Zones
INSERT INTO zones (id, code, name, type, location_id, company_id, is_active, created_at, updated_at)
SELECT
    'z0000000-0000-0000-0000-000000000001'::uuid,
    'TKY-PICK',
    'Tokyo Pick Zone',
    'PICK',
    (SELECT id FROM locations WHERE code = 'TOKYO-WH'),
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'TKY-PICK')
ON CONFLICT DO NOTHING;

INSERT INTO zones (id, code, name, type, location_id, company_id, is_active, created_at, updated_at)
SELECT
    'z0000000-0000-0000-0000-000000000002'::uuid,
    'TKY-RECV',
    'Tokyo Receiving Zone',
    'RECEIVING',
    (SELECT id FROM locations WHERE code = 'TOKYO-WH'),
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'TKY-RECV')
ON CONFLICT DO NOTHING;

-- Noida WH Zones
INSERT INTO zones (id, code, name, type, location_id, company_id, is_active, created_at, updated_at)
SELECT
    'z0000000-0000-0000-0000-000000000003'::uuid,
    'NOI-PICK',
    'Noida Pick Zone',
    'PICK',
    (SELECT id FROM locations WHERE code = 'NOIDA-WH'),
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'NOI-PICK')
ON CONFLICT DO NOTHING;

INSERT INTO zones (id, code, name, type, location_id, company_id, is_active, created_at, updated_at)
SELECT
    'z0000000-0000-0000-0000-000000000004'::uuid,
    'NOI-RECV',
    'Noida Receiving Zone',
    'RECEIVING',
    (SELECT id FROM locations WHERE code = 'NOIDA-WH'),
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'NOI-RECV')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. BINS (4 per zone = 16 total)
-- ============================================================================

-- Tokyo Pick Zone Bins
INSERT INTO bins (id, code, name, type, zone_id, location_id, company_id, capacity, is_active, created_at, updated_at)
SELECT
    'b0000000-0000-0000-0000-00000000000' || n::text,
    'TKY-A-0' || n::text,
    'Tokyo Bin A-0' || n::text,
    'PICK_FACE',
    (SELECT id FROM zones WHERE code = 'TKY-PICK'),
    (SELECT id FROM locations WHERE code = 'TOKYO-WH'),
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    100,
    true,
    NOW(),
    NOW()
FROM generate_series(1, 4) AS n
WHERE NOT EXISTS (SELECT 1 FROM bins WHERE code = 'TKY-A-0' || n::text)
ON CONFLICT DO NOTHING;

-- Noida Pick Zone Bins
INSERT INTO bins (id, code, name, type, zone_id, location_id, company_id, capacity, is_active, created_at, updated_at)
SELECT
    'b0000000-0000-0000-0000-00000000000' || (n + 4)::text,
    'NOI-A-0' || n::text,
    'Noida Bin A-0' || n::text,
    'PICK_FACE',
    (SELECT id FROM zones WHERE code = 'NOI-PICK'),
    (SELECT id FROM locations WHERE code = 'NOIDA-WH'),
    (SELECT id FROM companies WHERE code = 'FASHFWD'),
    100,
    true,
    NOW(),
    NOW()
FROM generate_series(1, 4) AS n
WHERE NOT EXISTS (SELECT 1 FROM bins WHERE code = 'NOI-A-0' || n::text)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. SKUs (10 Products)
-- ============================================================================

INSERT INTO skus (id, code, name, description, category, sub_category, brand, hsn, weight, mrp, cost_price, selling_price, tax_rate, is_serialised, is_batch_tracked, reorder_level, reorder_qty, is_active, company_id, created_at, updated_at)
VALUES
    ('s0000000-0000-0000-0000-000000000001'::uuid, 'SKU-TSHIRT-WHT-M', 'Classic White T-Shirt (M)', 'Premium cotton white t-shirt, medium size', 'Apparel', 'T-Shirts', 'Fashion Forward', '6109', 0.25, 999.00, 350.00, 799.00, 18.00, false, false, 50, 100, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000002'::uuid, 'SKU-TSHIRT-BLK-M', 'Classic Black T-Shirt (M)', 'Premium cotton black t-shirt, medium size', 'Apparel', 'T-Shirts', 'Fashion Forward', '6109', 0.25, 999.00, 350.00, 799.00, 18.00, false, false, 50, 100, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000003'::uuid, 'SKU-JEANS-BLU-32', 'Slim Fit Blue Jeans (32)', 'Denim slim fit blue jeans, waist 32', 'Apparel', 'Jeans', 'Fashion Forward', '6203', 0.50, 2499.00, 800.00, 1999.00, 12.00, false, false, 30, 50, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000004'::uuid, 'SKU-JACKET-BLK-L', 'Leather Jacket Black (L)', 'Premium faux leather jacket, large', 'Apparel', 'Jackets', 'Fashion Forward', '6201', 1.20, 5999.00, 2000.00, 4999.00, 18.00, false, false, 20, 30, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000005'::uuid, 'SKU-SNEAKER-WHT-9', 'White Sneakers (Size 9)', 'Casual white sneakers, size 9', 'Footwear', 'Sneakers', 'Fashion Forward', '6404', 0.80, 3499.00, 1200.00, 2999.00, 18.00, false, false, 25, 40, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000006'::uuid, 'SKU-CAP-RED', 'Red Baseball Cap', 'Adjustable red baseball cap', 'Accessories', 'Caps', 'Fashion Forward', '6505', 0.15, 599.00, 150.00, 499.00, 12.00, false, false, 100, 200, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000007'::uuid, 'SKU-WATCH-SLV', 'Silver Analog Watch', 'Classic silver analog wrist watch', 'Accessories', 'Watches', 'Fashion Forward', '9102', 0.10, 4999.00, 1500.00, 3999.00, 18.00, true, false, 15, 25, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000008'::uuid, 'SKU-BAG-BRN', 'Brown Leather Bag', 'Premium brown leather messenger bag', 'Accessories', 'Bags', 'Fashion Forward', '4202', 0.60, 3999.00, 1200.00, 2999.00, 18.00, false, false, 20, 35, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000009'::uuid, 'SKU-BELT-BLK', 'Black Leather Belt', 'Classic black leather belt', 'Accessories', 'Belts', 'Fashion Forward', '4203', 0.20, 1499.00, 400.00, 1199.00, 18.00, false, false, 40, 80, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('s0000000-0000-0000-0000-000000000010'::uuid, 'SKU-SOCKS-WHT-3', 'White Socks (Pack of 3)', 'Cotton white ankle socks, pack of 3', 'Apparel', 'Socks', 'Fashion Forward', '6115', 0.10, 399.00, 100.00, 299.00, 5.00, false, true, 200, 500, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. VENDORS (2)
-- ============================================================================

INSERT INTO vendors (id, code, name, contact_person, email, phone, gst, pan, address, payment_terms, lead_time_days, is_active, company_id, created_at, updated_at)
VALUES
    ('v0000000-0000-0000-0000-000000000001'::uuid, 'VND-PREMIUM', 'Premium Textile Mills', 'Amit Sharma', 'amit@premiumtextile.com', '+91-9876500001', '27AABCP1234B1Z5', 'AABCP1234B', '{"line1": "Industrial Area", "city": "Surat", "state": "Gujarat", "country": "India", "pincode": "395003"}'::jsonb, 'NET_30', 7, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('v0000000-0000-0000-0000-000000000002'::uuid, 'VND-GLOBAL', 'Global Fashion Supplies', 'Chen Wei', 'chen@globalfashion.com', '+86-21-12345678', NULL, NULL, '{"line1": "Fashion District", "city": "Shanghai", "state": "Shanghai", "country": "China", "pincode": "200000"}'::jsonb, 'NET_45', 14, true, (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. EXTERNAL PURCHASE ORDERS (5 with various statuses)
-- ============================================================================

INSERT INTO external_pos (id, external_po_number, company_id, location_id, vendor_id, external_vendor_code, external_vendor_name, status, po_date, expected_delivery_date, source, total_lines, total_expected_qty, total_received_qty, total_amount, created_at, updated_at)
VALUES
    -- PO 1: OPEN (for GRN creation)
    ('ep000000-0000-0000-0000-000000000001'::uuid, 'EXT-PO-2026-001', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM vendors WHERE code = 'VND-PREMIUM'), 'PTM-001', 'Premium Textile Mills', 'OPEN', '2026-01-25', '2026-02-05', 'MANUAL', 3, 150, 0, 65000.00, NOW(), NOW()),
    -- PO 2: OPEN (for ASN creation)
    ('ep000000-0000-0000-0000-000000000002'::uuid, 'EXT-PO-2026-002', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM vendors WHERE code = 'VND-GLOBAL'), 'GFS-001', 'Global Fashion Supplies', 'OPEN', '2026-01-20', '2026-02-10', 'MANUAL', 4, 200, 0, 120000.00, NOW(), NOW()),
    -- PO 3: PARTIALLY_RECEIVED
    ('ep000000-0000-0000-0000-000000000003'::uuid, 'EXT-PO-2026-003', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM vendors WHERE code = 'VND-PREMIUM'), 'PTM-001', 'Premium Textile Mills', 'PARTIALLY_RECEIVED', '2026-01-15', '2026-01-25', 'MANUAL', 2, 100, 60, 40000.00, NOW(), NOW()),
    -- PO 4: CLOSED
    ('ep000000-0000-0000-0000-000000000004'::uuid, 'EXT-PO-2026-004', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM vendors WHERE code = 'VND-PREMIUM'), 'PTM-001', 'Premium Textile Mills', 'CLOSED', '2026-01-10', '2026-01-20', 'MANUAL', 3, 80, 80, 32000.00, NOW(), NOW()),
    -- PO 5: CANCELLED
    ('ep000000-0000-0000-0000-000000000005'::uuid, 'EXT-PO-2026-005', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM vendors WHERE code = 'VND-GLOBAL'), 'GFS-001', 'Global Fashion Supplies', 'CANCELLED', '2026-01-05', '2026-01-15', 'MANUAL', 2, 50, 0, 25000.00, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- External PO Items
INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
VALUES
    -- PO 1 Items (OPEN)
    ('epi00000-0000-0000-0000-000000000001'::uuid, 'ep000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 'PTM-TSH-W', 'White T-Shirt', 50, 0, 350.00, 'OPEN', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000002'::uuid, 'ep000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-BLK-M'), 'PTM-TSH-B', 'Black T-Shirt', 50, 0, 350.00, 'OPEN', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000003'::uuid, 'ep000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JEANS-BLU-32'), 'PTM-JNS-B', 'Blue Jeans', 50, 0, 800.00, 'OPEN', NOW(), NOW()),
    -- PO 2 Items (OPEN)
    ('epi00000-0000-0000-0000-000000000004'::uuid, 'ep000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 'GFS-JKT-B', 'Black Jacket', 30, 0, 2000.00, 'OPEN', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000005'::uuid, 'ep000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SNEAKER-WHT-9'), 'GFS-SNK-W', 'White Sneakers', 50, 0, 1200.00, 'OPEN', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000006'::uuid, 'ep000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BAG-BRN'), 'GFS-BAG-B', 'Brown Bag', 40, 0, 1200.00, 'OPEN', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000007'::uuid, 'ep000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-WATCH-SLV'), 'GFS-WTC-S', 'Silver Watch', 80, 0, 1500.00, 'OPEN', NOW(), NOW()),
    -- PO 3 Items (PARTIALLY_RECEIVED)
    ('epi00000-0000-0000-0000-000000000008'::uuid, 'ep000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), 'PTM-CAP-R', 'Red Cap', 50, 50, 150.00, 'CLOSED', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000009'::uuid, 'ep000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BELT-BLK'), 'PTM-BLT-B', 'Black Belt', 50, 10, 400.00, 'PARTIALLY_RECEIVED', NOW(), NOW()),
    -- PO 4 Items (CLOSED - fully received)
    ('epi00000-0000-0000-0000-000000000010'::uuid, 'ep000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 'PTM-TSH-W', 'White T-Shirt', 30, 30, 350.00, 'CLOSED', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000011'::uuid, 'ep000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SOCKS-WHT-3'), 'PTM-SOK-W', 'White Socks', 30, 30, 100.00, 'CLOSED', NOW(), NOW()),
    ('epi00000-0000-0000-0000-000000000012'::uuid, 'ep000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), 'PTM-CAP-R', 'Red Cap', 20, 20, 150.00, 'CLOSED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. ASNs (3 linked to POs)
-- ============================================================================

INSERT INTO asns (id, asn_no, company_id, location_id, external_po_id, external_po_number, status, external_asn_no, carrier, tracking_number, vehicle_number, ship_date, expected_arrival, total_lines, total_expected_qty, total_received_qty, source, created_at, updated_at)
VALUES
    -- ASN 1: ARRIVED (ready for GRN)
    ('asn00000-0000-0000-0000-000000000001'::uuid, 'ASN-2026-0001', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), 'ep000000-0000-0000-0000-000000000001'::uuid, 'EXT-PO-2026-001', 'ARRIVED', 'VND-ASN-001', 'DHL Express', 'DHL123456789', 'TK-1234', '2026-01-28', '2026-02-01', 3, 150, 0, 'MANUAL', NOW(), NOW()),
    -- ASN 2: IN_TRANSIT
    ('asn00000-0000-0000-0000-000000000002'::uuid, 'ASN-2026-0002', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), 'ep000000-0000-0000-0000-000000000002'::uuid, 'EXT-PO-2026-002', 'IN_TRANSIT', 'VND-ASN-002', 'FedEx', 'FDX987654321', NULL, '2026-01-29', '2026-02-08', 4, 200, 0, 'MANUAL', NOW(), NOW()),
    -- ASN 3: RECEIVED (linked to GRN)
    ('asn00000-0000-0000-0000-000000000003'::uuid, 'ASN-2026-0003', (SELECT id FROM companies WHERE code = 'FASHFWD'), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), 'ep000000-0000-0000-0000-000000000004'::uuid, 'EXT-PO-2026-004', 'RECEIVED', 'VND-ASN-003', 'BlueDart', 'BD555666777', 'UP-5678', '2026-01-18', '2026-01-20', 3, 80, 80, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ASN Items
INSERT INTO asn_items (id, asn_id, sku_id, external_sku_code, external_sku_name, external_po_item_id, expected_qty, received_qty, batch_no, status, created_at, updated_at)
VALUES
    -- ASN 1 Items (ARRIVED)
    ('asni0000-0000-0000-0000-000000000001'::uuid, 'asn00000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 'PTM-TSH-W', 'White T-Shirt', 'epi00000-0000-0000-0000-000000000001'::uuid, 50, 0, 'BATCH-2026-001', 'EXPECTED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000002'::uuid, 'asn00000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-BLK-M'), 'PTM-TSH-B', 'Black T-Shirt', 'epi00000-0000-0000-0000-000000000002'::uuid, 50, 0, 'BATCH-2026-001', 'EXPECTED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000003'::uuid, 'asn00000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JEANS-BLU-32'), 'PTM-JNS-B', 'Blue Jeans', 'epi00000-0000-0000-0000-000000000003'::uuid, 50, 0, 'BATCH-2026-001', 'EXPECTED', NOW(), NOW()),
    -- ASN 2 Items (IN_TRANSIT)
    ('asni0000-0000-0000-0000-000000000004'::uuid, 'asn00000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 'GFS-JKT-B', 'Black Jacket', 'epi00000-0000-0000-0000-000000000004'::uuid, 30, 0, NULL, 'EXPECTED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000005'::uuid, 'asn00000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SNEAKER-WHT-9'), 'GFS-SNK-W', 'White Sneakers', 'epi00000-0000-0000-0000-000000000005'::uuid, 50, 0, NULL, 'EXPECTED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000006'::uuid, 'asn00000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BAG-BRN'), 'GFS-BAG-B', 'Brown Bag', 'epi00000-0000-0000-0000-000000000006'::uuid, 40, 0, NULL, 'EXPECTED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000007'::uuid, 'asn00000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-WATCH-SLV'), 'GFS-WTC-S', 'Silver Watch', 'epi00000-0000-0000-0000-000000000007'::uuid, 80, 0, NULL, 'EXPECTED', NOW(), NOW()),
    -- ASN 3 Items (RECEIVED)
    ('asni0000-0000-0000-0000-000000000008'::uuid, 'asn00000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 'PTM-TSH-W', 'White T-Shirt', 'epi00000-0000-0000-0000-000000000010'::uuid, 30, 30, 'BATCH-2026-002', 'RECEIVED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000009'::uuid, 'asn00000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SOCKS-WHT-3'), 'PTM-SOK-W', 'White Socks', 'epi00000-0000-0000-0000-000000000011'::uuid, 30, 30, 'BATCH-2026-002', 'RECEIVED', NOW(), NOW()),
    ('asni0000-0000-0000-0000-000000000010'::uuid, 'asn00000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), 'PTM-CAP-R', 'Red Cap', 'epi00000-0000-0000-0000-000000000012'::uuid, 20, 20, 'BATCH-2026-002', 'RECEIVED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. GOODS RECEIPTS (5 - 3 POSTED to create inventory)
-- ============================================================================

INSERT INTO goods_receipts (id, gr_no, location_id, company_id, status, movement_type, asn_id, external_po_id, inbound_source, total_qty, total_value, total_accepted_qty, total_rejected_qty, vehicle_number, notes, source, posted_at, created_at, updated_at)
VALUES
    -- GRN 1: POSTED (from ASN 3) - Creates inventory at Noida
    ('gr000000-0000-0000-0000-000000000001'::uuid, 'GR-2026-0001', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 'POSTED', '101', 'asn00000-0000-0000-0000-000000000003'::uuid, 'ep000000-0000-0000-0000-000000000004'::uuid, 'PURCHASE', 80, 32000.00, 80, 0, 'UP-5678', 'Full receipt from ASN-2026-0003', 'ASN', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW()),
    -- GRN 2: POSTED (manual) - Creates inventory at Tokyo
    ('gr000000-0000-0000-0000-000000000002'::uuid, 'GR-2026-0002', (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 'POSTED', '101', NULL, 'ep000000-0000-0000-0000-000000000003'::uuid, 'PURCHASE', 60, 15000.00, 60, 0, 'TK-9999', 'Partial receipt for caps and belts', 'MANUAL', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW()),
    -- GRN 3: POSTED (manual) - Additional inventory at Noida
    ('gr000000-0000-0000-0000-000000000003'::uuid, 'GR-2026-0003', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 'POSTED', '101', NULL, NULL, 'PURCHASE', 100, 50000.00, 100, 0, 'DL-1234', 'Opening stock for new products', 'MANUAL', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW()),
    -- GRN 4: DRAFT (pending receiving)
    ('gr000000-0000-0000-0000-000000000004'::uuid, 'GR-2026-0004', (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 'DRAFT', '101', 'asn00000-0000-0000-0000-000000000001'::uuid, 'ep000000-0000-0000-0000-000000000001'::uuid, 'PURCHASE', 150, 65000.00, 0, 0, NULL, 'Waiting for ASN arrival confirmation', 'ASN', NULL, NOW(), NOW()),
    -- GRN 5: RECEIVING (in progress)
    ('gr000000-0000-0000-0000-000000000005'::uuid, 'GR-2026-0005', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 'RECEIVING', '101', NULL, NULL, 'PURCHASE', 50, 25000.00, 25, 0, 'UP-7890', 'QC in progress', 'MANUAL', NULL, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (id) DO NOTHING;

-- GRN Items
INSERT INTO goods_receipt_items (id, goods_receipt_id, sku_id, expected_qty, received_qty, accepted_qty, rejected_qty, batch_no, mrp, cost_price, fifo_sequence, created_at, updated_at)
VALUES
    -- GRN 1 Items (POSTED)
    ('gri00000-0000-0000-0000-000000000001'::uuid, 'gr000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 30, 30, 30, 0, 'BATCH-2026-002', 999.00, 350.00, 1, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000002'::uuid, 'gr000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SOCKS-WHT-3'), 30, 30, 30, 0, 'BATCH-2026-002', 399.00, 100.00, 1, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000003'::uuid, 'gr000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), 20, 20, 20, 0, 'BATCH-2026-002', 599.00, 150.00, 1, NOW(), NOW()),
    -- GRN 2 Items (POSTED)
    ('gri00000-0000-0000-0000-000000000004'::uuid, 'gr000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), 50, 50, 50, 0, 'BATCH-2026-003', 599.00, 150.00, 2, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000005'::uuid, 'gr000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BELT-BLK'), 10, 10, 10, 0, 'BATCH-2026-003', 1499.00, 400.00, 1, NOW(), NOW()),
    -- GRN 3 Items (POSTED - opening stock)
    ('gri00000-0000-0000-0000-000000000006'::uuid, 'gr000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 20, 20, 20, 0, 'BATCH-OPEN-001', 5999.00, 2000.00, 1, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000007'::uuid, 'gr000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SNEAKER-WHT-9'), 30, 30, 30, 0, 'BATCH-OPEN-001', 3499.00, 1200.00, 1, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000008'::uuid, 'gr000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BAG-BRN'), 25, 25, 25, 0, 'BATCH-OPEN-001', 3999.00, 1200.00, 1, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000009'::uuid, 'gr000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-WATCH-SLV'), 25, 25, 25, 0, 'BATCH-OPEN-001', 4999.00, 1500.00, 1, NOW(), NOW()),
    -- GRN 4 Items (DRAFT)
    ('gri00000-0000-0000-0000-000000000010'::uuid, 'gr000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 50, 0, 0, 0, NULL, 999.00, 350.00, NULL, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000011'::uuid, 'gr000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-BLK-M'), 50, 0, 0, 0, NULL, 999.00, 350.00, NULL, NOW(), NOW()),
    ('gri00000-0000-0000-0000-000000000012'::uuid, 'gr000000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JEANS-BLU-32'), 50, 0, 0, 0, NULL, 2499.00, 800.00, NULL, NOW(), NOW()),
    -- GRN 5 Items (RECEIVING)
    ('gri00000-0000-0000-0000-000000000013'::uuid, 'gr000000-0000-0000-0000-000000000005'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JEANS-BLU-32'), 50, 25, 25, 0, 'BATCH-2026-004', 2499.00, 800.00, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. INVENTORY (Created from POSTED GRNs)
-- ============================================================================

-- Get a default bin for each location
INSERT INTO inventory (id, sku_id, bin_id, location_id, company_id, quantity, reserved_qty, batch_no, mrp, cost_price, valuation_method, fifo_sequence, created_at, updated_at)
VALUES
    -- Noida WH Inventory (from GRN 1 & 3)
    ('inv00000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), (SELECT id FROM bins WHERE code = 'NOI-A-01' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 30, 0, 'BATCH-2026-002', 999.00, 350.00, 'FIFO', 1, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SOCKS-WHT-3'), (SELECT id FROM bins WHERE code = 'NOI-A-01' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 30, 0, 'BATCH-2026-002', 399.00, 100.00, 'FIFO', 1, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), (SELECT id FROM bins WHERE code = 'NOI-A-02' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 20, 0, 'BATCH-2026-002', 599.00, 150.00, 'FIFO', 1, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), (SELECT id FROM bins WHERE code = 'NOI-A-03' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 20, 0, 'BATCH-OPEN-001', 5999.00, 2000.00, 'FIFO', 1, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000005'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SNEAKER-WHT-9'), (SELECT id FROM bins WHERE code = 'NOI-A-03' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 30, 0, 'BATCH-OPEN-001', 3499.00, 1200.00, 'FIFO', 1, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000006'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BAG-BRN'), (SELECT id FROM bins WHERE code = 'NOI-A-04' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 25, 0, 'BATCH-OPEN-001', 3999.00, 1200.00, 'FIFO', 1, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000007'::uuid, (SELECT id FROM skus WHERE code = 'SKU-WATCH-SLV'), (SELECT id FROM bins WHERE code = 'NOI-A-04' LIMIT 1), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 25, 0, 'BATCH-OPEN-001', 4999.00, 1500.00, 'FIFO', 1, NOW(), NOW()),
    -- Tokyo WH Inventory (from GRN 2)
    ('inv00000-0000-0000-0000-000000000008'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), (SELECT id FROM bins WHERE code = 'TKY-A-01' LIMIT 1), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 50, 0, 'BATCH-2026-003', 599.00, 150.00, 'FIFO', 2, NOW(), NOW()),
    ('inv00000-0000-0000-0000-000000000009'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BELT-BLK'), (SELECT id FROM bins WHERE code = 'TKY-A-02' LIMIT 1), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), 10, 0, 'BATCH-2026-003', 1499.00, 400.00, 'FIFO', 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 11. ORDERS (20 across various statuses)
-- ============================================================================

INSERT INTO orders (id, order_no, channel, order_type, payment_mode, status, customer_name, customer_phone, customer_email, shipping_address, subtotal, tax_amount, total_amount, order_date, location_id, company_id, created_at, updated_at)
VALUES
    -- CREATED (3)
    ('ord00000-0000-0000-0000-000000000001'::uuid, 'ORD-2026-0001', 'WEBSITE', 'B2C', 'PREPAID', 'CREATED', 'Ravi Kumar', '+91-9876543001', 'ravi@email.com', '{"line1": "123 MG Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}'::jsonb, 1698.00, 305.64, 2003.64, NOW(), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('ord00000-0000-0000-0000-000000000002'::uuid, 'ORD-2026-0002', 'AMAZON', 'B2C', 'COD', 'CREATED', 'Priya Sharma', '+91-9876543002', 'priya@email.com', '{"line1": "456 Park Street", "city": "Kolkata", "state": "West Bengal", "pincode": "700001"}'::jsonb, 2999.00, 539.82, 3538.82, NOW(), (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    ('ord00000-0000-0000-0000-000000000003'::uuid, 'ORD-2026-0003', 'FLIPKART', 'B2C', 'PREPAID', 'CREATED', 'Amit Patel', '+91-9876543003', 'amit@email.com', '{"line1": "789 Ring Road", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380001"}'::jsonb, 4999.00, 899.82, 5898.82, NOW(), (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW(), NOW()),
    -- CONFIRMED (2)
    ('ord00000-0000-0000-0000-000000000004'::uuid, 'ORD-2026-0004', 'WEBSITE', 'B2C', 'PREPAID', 'CONFIRMED', 'Neha Singh', '+91-9876543004', 'neha@email.com', '{"line1": "101 Janpath", "city": "Delhi", "state": "Delhi", "pincode": "110001"}'::jsonb, 799.00, 143.82, 942.82, NOW() - INTERVAL '1 hour', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '1 hour', NOW()),
    ('ord00000-0000-0000-0000-000000000005'::uuid, 'ORD-2026-0005', 'MYNTRA', 'B2C', 'PREPAID', 'CONFIRMED', 'Vikram Rao', '+91-9876543005', 'vikram@email.com', '{"line1": "202 Brigade Road", "city": "Bangalore", "state": "Karnataka", "pincode": "560001"}'::jsonb, 3999.00, 719.82, 4718.82, NOW() - INTERVAL '2 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '2 hours', NOW()),
    -- ALLOCATED (3)
    ('ord00000-0000-0000-0000-000000000006'::uuid, 'ORD-2026-0006', 'WEBSITE', 'B2C', 'PREPAID', 'ALLOCATED', 'Sunita Gupta', '+91-9876543006', 'sunita@email.com', '{"line1": "303 Civil Lines", "city": "Jaipur", "state": "Rajasthan", "pincode": "302001"}'::jsonb, 1199.00, 215.82, 1414.82, NOW() - INTERVAL '3 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '3 hours', NOW()),
    ('ord00000-0000-0000-0000-000000000007'::uuid, 'ORD-2026-0007', 'AMAZON', 'B2C', 'COD', 'ALLOCATED', 'Rajesh Verma', '+91-9876543007', 'rajesh@email.com', '{"line1": "404 Gandhi Nagar", "city": "Pune", "state": "Maharashtra", "pincode": "411001"}'::jsonb, 2499.00, 449.82, 2948.82, NOW() - INTERVAL '4 hours', (SELECT id FROM locations WHERE code = 'TOKYO-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '4 hours', NOW()),
    ('ord00000-0000-0000-0000-000000000008'::uuid, 'ORD-2026-0008', 'FLIPKART', 'B2C', 'PREPAID', 'ALLOCATED', 'Meera Nair', '+91-9876543008', 'meera@email.com', '{"line1": "505 Marine Drive", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001"}'::jsonb, 599.00, 71.88, 670.88, NOW() - INTERVAL '5 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '5 hours', NOW()),
    -- PICKLIST_GENERATED (2)
    ('ord00000-0000-0000-0000-000000000009'::uuid, 'ORD-2026-0009', 'WEBSITE', 'B2C', 'PREPAID', 'PICKLIST_GENERATED', 'Ankit Jain', '+91-9876543009', 'ankit@email.com', '{"line1": "606 Residency Road", "city": "Hyderabad", "state": "Telangana", "pincode": "500001"}'::jsonb, 1998.00, 359.64, 2357.64, NOW() - INTERVAL '6 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '6 hours', NOW()),
    ('ord00000-0000-0000-0000-000000000010'::uuid, 'ORD-2026-0010', 'MYNTRA', 'B2C', 'PREPAID', 'PICKLIST_GENERATED', 'Pooja Mehta', '+91-9876543010', 'pooja@email.com', '{"line1": "707 Linking Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400050"}'::jsonb, 4999.00, 899.82, 5898.82, NOW() - INTERVAL '7 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '7 hours', NOW()),
    -- PICKED (2)
    ('ord00000-0000-0000-0000-000000000011'::uuid, 'ORD-2026-0011', 'WEBSITE', 'B2C', 'PREPAID', 'PICKED', 'Karan Malhotra', '+91-9876543011', 'karan@email.com', '{"line1": "808 Connaught Place", "city": "Delhi", "state": "Delhi", "pincode": "110001"}'::jsonb, 299.00, 14.95, 313.95, NOW() - INTERVAL '8 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '8 hours', NOW()),
    ('ord00000-0000-0000-0000-000000000012'::uuid, 'ORD-2026-0012', 'AMAZON', 'B2C', 'PREPAID', 'PICKED', 'Divya Reddy', '+91-9876543012', 'divya@email.com', '{"line1": "909 Jubilee Hills", "city": "Hyderabad", "state": "Telangana", "pincode": "500033"}'::jsonb, 3499.00, 629.82, 4128.82, NOW() - INTERVAL '9 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '9 hours', NOW()),
    -- PACKED (2)
    ('ord00000-0000-0000-0000-000000000013'::uuid, 'ORD-2026-0013', 'FLIPKART', 'B2C', 'PREPAID', 'PACKED', 'Sanjay Kapoor', '+91-9876543013', 'sanjay@email.com', '{"line1": "1010 Sector 17", "city": "Chandigarh", "state": "Chandigarh", "pincode": "160017"}'::jsonb, 2999.00, 539.82, 3538.82, NOW() - INTERVAL '10 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '10 hours', NOW()),
    ('ord00000-0000-0000-0000-000000000014'::uuid, 'ORD-2026-0014', 'WEBSITE', 'B2C', 'COD', 'PACKED', 'Ritika Agarwal', '+91-9876543014', 'ritika@email.com', '{"line1": "1111 Mall Road", "city": "Shimla", "state": "Himachal Pradesh", "pincode": "171001"}'::jsonb, 5999.00, 1079.82, 7078.82, NOW() - INTERVAL '11 hours', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '11 hours', NOW()),
    -- SHIPPED (2)
    ('ord00000-0000-0000-0000-000000000015'::uuid, 'ORD-2026-0015', 'AMAZON', 'B2C', 'PREPAID', 'SHIPPED', 'Arun Saxena', '+91-9876543015', 'arun@email.com', '{"line1": "1212 Law Garden", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380006"}'::jsonb, 1499.00, 269.82, 1768.82, NOW() - INTERVAL '1 day', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '1 day', NOW()),
    ('ord00000-0000-0000-0000-000000000016'::uuid, 'ORD-2026-0016', 'MYNTRA', 'B2C', 'PREPAID', 'SHIPPED', 'Nisha Desai', '+91-9876543016', 'nisha@email.com', '{"line1": "1313 FC Road", "city": "Pune", "state": "Maharashtra", "pincode": "411004"}'::jsonb, 3999.00, 719.82, 4718.82, NOW() - INTERVAL '1 day', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '1 day', NOW()),
    -- DELIVERED (2)
    ('ord00000-0000-0000-0000-000000000017'::uuid, 'ORD-2026-0017', 'WEBSITE', 'B2C', 'PREPAID', 'DELIVERED', 'Vivek Khanna', '+91-9876543017', 'vivek@email.com', '{"line1": "1414 Banjara Hills", "city": "Hyderabad", "state": "Telangana", "pincode": "500034"}'::jsonb, 799.00, 143.82, 942.82, NOW() - INTERVAL '3 days', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '3 days', NOW()),
    ('ord00000-0000-0000-0000-000000000018'::uuid, 'ORD-2026-0018', 'FLIPKART', 'B2C', 'COD', 'DELIVERED', 'Shweta Iyer', '+91-9876543018', 'shweta@email.com', '{"line1": "1515 Adyar", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600020"}'::jsonb, 2499.00, 449.82, 2948.82, NOW() - INTERVAL '4 days', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '4 days', NOW()),
    -- NDR / RTO (2 - for NDR testing)
    ('ord00000-0000-0000-0000-000000000019'::uuid, 'ORD-2026-0019', 'AMAZON', 'B2C', 'COD', 'SHIPPED', 'Deepak Sharma', '+91-9876543019', 'deepak@email.com', '{"line1": "1616 Sector 18", "city": "Noida", "state": "Uttar Pradesh", "pincode": "201301"}'::jsonb, 4999.00, 899.82, 5898.82, NOW() - INTERVAL '2 days', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '2 days', NOW()),
    ('ord00000-0000-0000-0000-000000000020'::uuid, 'ORD-2026-0020', 'WEBSITE', 'B2C', 'COD', 'SHIPPED', 'Lakshmi Pillai', '+91-9876543020', 'lakshmi@email.com', '{"line1": "1717 Koramangala", "city": "Bangalore", "state": "Karnataka", "pincode": "560034"}'::jsonb, 1199.00, 215.82, 1414.82, NOW() - INTERVAL '2 days', (SELECT id FROM locations WHERE code = 'NOIDA-WH'), (SELECT id FROM companies WHERE code = 'FASHFWD'), NOW() - INTERVAL '2 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- Order Items (simplified - 1-2 items per order)
INSERT INTO order_items (id, order_id, sku_id, quantity, unit_price, tax_amount, total_price, status, allocated_qty, picked_qty, packed_qty, created_at, updated_at)
VALUES
    -- Order 1-3 (CREATED)
    ('oi000000-0000-0000-0000-000000000001'::uuid, 'ord00000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 2, 799.00, 143.64, 1741.64, 'PENDING', 0, 0, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000002'::uuid, 'ord00000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SNEAKER-WHT-9'), 1, 2999.00, 539.82, 3538.82, 'PENDING', 0, 0, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000003'::uuid, 'ord00000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 1, 4999.00, 899.82, 5898.82, 'PENDING', 0, 0, 0, NOW(), NOW()),
    -- Order 4-5 (CONFIRMED)
    ('oi000000-0000-0000-0000-000000000004'::uuid, 'ord00000-0000-0000-0000-000000000004'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 1, 799.00, 143.82, 942.82, 'PENDING', 0, 0, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000005'::uuid, 'ord00000-0000-0000-0000-000000000005'::uuid, (SELECT id FROM skus WHERE code = 'SKU-WATCH-SLV'), 1, 3999.00, 719.82, 4718.82, 'PENDING', 0, 0, 0, NOW(), NOW()),
    -- Order 6-8 (ALLOCATED)
    ('oi000000-0000-0000-0000-000000000006'::uuid, 'ord00000-0000-0000-0000-000000000006'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BELT-BLK'), 1, 1199.00, 215.82, 1414.82, 'ALLOCATED', 1, 0, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000007'::uuid, 'ord00000-0000-0000-0000-000000000007'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JEANS-BLU-32'), 1, 2499.00, 449.82, 2948.82, 'ALLOCATED', 1, 0, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000008'::uuid, 'ord00000-0000-0000-0000-000000000008'::uuid, (SELECT id FROM skus WHERE code = 'SKU-CAP-RED'), 1, 599.00, 71.88, 670.88, 'ALLOCATED', 1, 0, 0, NOW(), NOW()),
    -- Order 9-10 (PICKLIST_GENERATED)
    ('oi000000-0000-0000-0000-000000000009'::uuid, 'ord00000-0000-0000-0000-000000000009'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-WHT-M'), 2, 799.00, 143.64, 1741.64, 'ALLOCATED', 2, 0, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000010'::uuid, 'ord00000-0000-0000-0000-000000000010'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 1, 4999.00, 899.82, 5898.82, 'ALLOCATED', 1, 0, 0, NOW(), NOW()),
    -- Order 11-12 (PICKED)
    ('oi000000-0000-0000-0000-000000000011'::uuid, 'ord00000-0000-0000-0000-000000000011'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SOCKS-WHT-3'), 1, 299.00, 14.95, 313.95, 'PICKED', 1, 1, 0, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000012'::uuid, 'ord00000-0000-0000-0000-000000000012'::uuid, (SELECT id FROM skus WHERE code = 'SKU-SNEAKER-WHT-9'), 1, 3499.00, 629.82, 4128.82, 'PICKED', 1, 1, 0, NOW(), NOW()),
    -- Order 13-14 (PACKED)
    ('oi000000-0000-0000-0000-000000000013'::uuid, 'ord00000-0000-0000-0000-000000000013'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BAG-BRN'), 1, 2999.00, 539.82, 3538.82, 'PACKED', 1, 1, 1, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000014'::uuid, 'ord00000-0000-0000-0000-000000000014'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 1, 5999.00, 1079.82, 7078.82, 'PACKED', 1, 1, 1, NOW(), NOW()),
    -- Order 15-16 (SHIPPED)
    ('oi000000-0000-0000-0000-000000000015'::uuid, 'ord00000-0000-0000-0000-000000000015'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BELT-BLK'), 1, 1499.00, 269.82, 1768.82, 'SHIPPED', 1, 1, 1, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000016'::uuid, 'ord00000-0000-0000-0000-000000000016'::uuid, (SELECT id FROM skus WHERE code = 'SKU-WATCH-SLV'), 1, 3999.00, 719.82, 4718.82, 'SHIPPED', 1, 1, 1, NOW(), NOW()),
    -- Order 17-18 (DELIVERED)
    ('oi000000-0000-0000-0000-000000000017'::uuid, 'ord00000-0000-0000-0000-000000000017'::uuid, (SELECT id FROM skus WHERE code = 'SKU-TSHIRT-BLK-M'), 1, 799.00, 143.82, 942.82, 'DELIVERED', 1, 1, 1, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000018'::uuid, 'ord00000-0000-0000-0000-000000000018'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JEANS-BLU-32'), 1, 2499.00, 449.82, 2948.82, 'DELIVERED', 1, 1, 1, NOW(), NOW()),
    -- Order 19-20 (SHIPPED - for NDR)
    ('oi000000-0000-0000-0000-000000000019'::uuid, 'ord00000-0000-0000-0000-000000000019'::uuid, (SELECT id FROM skus WHERE code = 'SKU-JACKET-BLK-L'), 1, 4999.00, 899.82, 5898.82, 'SHIPPED', 1, 1, 1, NOW(), NOW()),
    ('oi000000-0000-0000-0000-000000000020'::uuid, 'ord00000-0000-0000-0000-000000000020'::uuid, (SELECT id FROM skus WHERE code = 'SKU-BELT-BLK'), 1, 1199.00, 215.82, 1414.82, 'SHIPPED', 1, 1, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 12. DELIVERIES (for shipped orders)
-- ============================================================================

INSERT INTO deliveries (id, delivery_no, order_id, company_id, status, awb_no, weight, boxes, created_at, updated_at)
VALUES
    ('del00000-0000-0000-0000-000000000015'::uuid, 'DEL-2026-0015', 'ord00000-0000-0000-0000-000000000015'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'IN_TRANSIT', 'AWB123456015', 0.20, 1, NOW(), NOW()),
    ('del00000-0000-0000-0000-000000000016'::uuid, 'DEL-2026-0016', 'ord00000-0000-0000-0000-000000000016'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'IN_TRANSIT', 'AWB123456016', 0.10, 1, NOW(), NOW()),
    ('del00000-0000-0000-0000-000000000017'::uuid, 'DEL-2026-0017', 'ord00000-0000-0000-0000-000000000017'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'DELIVERED', 'AWB123456017', 0.25, 1, NOW(), NOW()),
    ('del00000-0000-0000-0000-000000000018'::uuid, 'DEL-2026-0018', 'ord00000-0000-0000-0000-000000000018'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'DELIVERED', 'AWB123456018', 0.50, 1, NOW(), NOW()),
    ('del00000-0000-0000-0000-000000000019'::uuid, 'DEL-2026-0019', 'ord00000-0000-0000-0000-000000000019'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'NDR', 'AWB123456019', 1.20, 1, NOW(), NOW()),
    ('del00000-0000-0000-0000-000000000020'::uuid, 'DEL-2026-0020', 'ord00000-0000-0000-0000-000000000020'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'NDR', 'AWB123456020', 0.20, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 13. NDR CASES (5)
-- ============================================================================

INSERT INTO ndrs (id, ndr_code, order_id, delivery_id, company_id, status, reason, priority, risk_score, attempt_number, customer_name, customer_phone, customer_address, awb_no, carrier_name, created_at, updated_at)
VALUES
    ('ndr00000-0000-0000-0000-000000000001'::uuid, 'NDR-2026-0001', 'ord00000-0000-0000-0000-000000000019'::uuid, 'del00000-0000-0000-0000-000000000019'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'OPEN', 'CUSTOMER_UNAVAILABLE', 'HIGH', 75, 1, 'Deepak Sharma', '+91-9876543019', '{"line1": "1616 Sector 18", "city": "Noida", "state": "Uttar Pradesh", "pincode": "201301"}'::jsonb, 'AWB123456019', 'BlueDart', NOW() - INTERVAL '1 day', NOW()),
    ('ndr00000-0000-0000-0000-000000000002'::uuid, 'NDR-2026-0002', 'ord00000-0000-0000-0000-000000000020'::uuid, 'del00000-0000-0000-0000-000000000020'::uuid, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'OPEN', 'WRONG_ADDRESS', 'CRITICAL', 90, 2, 'Lakshmi Pillai', '+91-9876543020', '{"line1": "1717 Koramangala", "city": "Bangalore", "state": "Karnataka", "pincode": "560034"}'::jsonb, 'AWB123456020', 'Delhivery', NOW() - INTERVAL '1 day', NOW()),
    ('ndr00000-0000-0000-0000-000000000003'::uuid, 'NDR-2026-0003', NULL, NULL, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'ACTION_REQUESTED', 'COD_NOT_READY', 'MEDIUM', 50, 1, 'Test Customer 1', '+91-9876500001', '{"city": "Mumbai"}'::jsonb, 'AWB-TEST-001', 'DTDC', NOW() - INTERVAL '2 days', NOW()),
    ('ndr00000-0000-0000-0000-000000000004'::uuid, 'NDR-2026-0004', NULL, NULL, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'RESOLVED', 'PHONE_UNREACHABLE', 'LOW', 30, 1, 'Test Customer 2', '+91-9876500002', '{"city": "Delhi"}'::jsonb, 'AWB-TEST-002', 'Ecom Express', NOW() - INTERVAL '5 days', NOW()),
    ('ndr00000-0000-0000-0000-000000000005'::uuid, 'NDR-2026-0005', NULL, NULL, (SELECT id FROM companies WHERE code = 'FASHFWD'), 'RTO', 'CUSTOMER_REFUSED', 'HIGH', 85, 3, 'Test Customer 3', '+91-9876500003', '{"city": "Chennai"}'::jsonb, 'AWB-TEST-003', 'XpressBees', NOW() - INTERVAL '7 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run separately to verify data)
-- ============================================================================

-- SELECT 'Companies' as entity, COUNT(*) as count FROM companies WHERE code = 'FASHFWD'
-- UNION ALL SELECT 'Locations', COUNT(*) FROM locations WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'Zones', COUNT(*) FROM zones WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'Bins', COUNT(*) FROM bins WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'SKUs', COUNT(*) FROM skus WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'Vendors', COUNT(*) FROM vendors WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'External POs', COUNT(*) FROM external_pos WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'ASNs', COUNT(*) FROM asns WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'Goods Receipts', COUNT(*) FROM goods_receipts WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'Inventory', COUNT(*) FROM inventory WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'Orders', COUNT(*) FROM orders WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD')
-- UNION ALL SELECT 'NDRs', COUNT(*) FROM ndrs WHERE company_id = (SELECT id FROM companies WHERE code = 'FASHFWD');
