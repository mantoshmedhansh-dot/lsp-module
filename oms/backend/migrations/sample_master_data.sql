-- ============================================================================
-- Sample Master Data for CJDQuick OMS (Super Admin)
-- Date: 2026-01-30
-- Description: Creates sample locations, SKUs, vendors, External PO, and ASN
--              for testing the GRN material flow in Super Admin panel
-- ============================================================================

-- For this migration, we'll use a DO block with a variable
DO $$
DECLARE
    v_company_id UUID;
    v_location_id UUID;
    v_sku_id_1 UUID;
    v_sku_id_2 UUID;
    v_sku_id_3 UUID;
    v_sku_id_4 UUID;
    v_sku_id_5 UUID;
    v_vendor_id UUID;
    v_zone_id UUID;
    v_bin_id UUID;
    v_external_po_id UUID;
    v_asn_id UUID;
BEGIN
    -- Find Super Admin's company (admin@demo.com)
    SELECT c.id INTO v_company_id
    FROM "Company" c
    JOIN "User" u ON u."companyId" = c.id
    WHERE u.email = 'admin@demo.com'
    LIMIT 1;

    -- If not found, try to find any company
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id FROM "Company" LIMIT 1;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No company found. Please create a company first.';
    END IF;

    RAISE NOTICE 'Using company_id: %', v_company_id;

    -- ========================================================================
    -- Step 2: Create Warehouse Location
    -- ========================================================================
    v_location_id := gen_random_uuid();

    INSERT INTO "Location" (id, code, name, type, address, "companyId", "isActive", "createdAt", "updatedAt")
    VALUES (
        v_location_id,
        'WH-TK-01',
        'Tokyo Main Warehouse',
        'WAREHOUSE',
        '{"line1": "1-2-3 Shibuya", "city": "Tokyo", "state": "Tokyo", "country": "Japan", "pincode": "150-0002"}'::jsonb,
        v_company_id,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (code, "companyId") DO UPDATE SET
        name = EXCLUDED.name,
        "isActive" = true,
        "updatedAt" = NOW()
    RETURNING id INTO v_location_id;

    RAISE NOTICE 'Created/Updated location: % (id: %)', 'Tokyo Main Warehouse', v_location_id;

    -- ========================================================================
    -- Step 3: Create Zone (SALEABLE) for the warehouse
    -- ========================================================================
    v_zone_id := gen_random_uuid();

    INSERT INTO "Zone" (id, code, name, type, "locationId", priority, "isActive", "createdAt", "updatedAt")
    VALUES (v_zone_id, 'ZONE-A', 'Zone A - Saleable', 'SALEABLE', v_location_id, 1, true, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    -- Get the zone ID if it was already there
    SELECT id INTO v_zone_id FROM "Zone" WHERE code = 'ZONE-A' AND "locationId" = v_location_id LIMIT 1;

    RAISE NOTICE 'Created/Found zone: % (id: %)', 'Zone A - Saleable', v_zone_id;

    -- ========================================================================
    -- Step 4: Create Bin in the zone
    -- ========================================================================
    v_bin_id := gen_random_uuid();

    INSERT INTO "Bin" (id, code, name, "zoneId", "binType", "isActive", aisle, rack, level, position, "createdAt", "updatedAt")
    VALUES (v_bin_id, 'A-01-01-01', 'Bin A-01-01-01', v_zone_id, 'SHELF', true, 'A', '01', '01', '01', NOW(), NOW())
    ON CONFLICT DO NOTHING;

    -- Get the bin ID if it was already there
    SELECT id INTO v_bin_id FROM "Bin" WHERE code = 'A-01-01-01' AND "zoneId" = v_zone_id LIMIT 1;

    RAISE NOTICE 'Created/Found bin: % (id: %)', 'A-01-01-01', v_bin_id;

    -- ========================================================================
    -- Step 5: Create Sample SKUs
    -- ========================================================================
    v_sku_id_1 := gen_random_uuid();
    v_sku_id_2 := gen_random_uuid();
    v_sku_id_3 := gen_random_uuid();
    v_sku_id_4 := gen_random_uuid();
    v_sku_id_5 := gen_random_uuid();

    INSERT INTO "SKU" (id, code, name, category, brand, "companyId", "isActive", mrp, "costPrice", "createdAt", "updatedAt")
    VALUES
        (v_sku_id_1, 'SKU-FF-001', 'Premium T-Shirt White', 'Apparel', 'Fashion Forward', v_company_id, true, 1999.00, 800.00, NOW(), NOW()),
        (v_sku_id_2, 'SKU-FF-002', 'Premium T-Shirt Black', 'Apparel', 'Fashion Forward', v_company_id, true, 1999.00, 800.00, NOW(), NOW()),
        (v_sku_id_3, 'SKU-FF-003', 'Designer Jeans Blue', 'Apparel', 'Fashion Forward', v_company_id, true, 4999.00, 2000.00, NOW(), NOW()),
        (v_sku_id_4, 'SKU-FF-004', 'Leather Belt Brown', 'Accessories', 'Fashion Forward', v_company_id, true, 2499.00, 1000.00, NOW(), NOW()),
        (v_sku_id_5, 'SKU-FF-005', 'Canvas Sneakers White', 'Footwear', 'Fashion Forward', v_company_id, true, 3999.00, 1600.00, NOW(), NOW())
    ON CONFLICT (code, "companyId") DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        brand = EXCLUDED.brand,
        mrp = EXCLUDED.mrp,
        "costPrice" = EXCLUDED."costPrice",
        "isActive" = true,
        "updatedAt" = NOW();

    -- Get actual IDs
    SELECT id INTO v_sku_id_1 FROM "SKU" WHERE code = 'SKU-FF-001' AND "companyId" = v_company_id;
    SELECT id INTO v_sku_id_2 FROM "SKU" WHERE code = 'SKU-FF-002' AND "companyId" = v_company_id;
    SELECT id INTO v_sku_id_3 FROM "SKU" WHERE code = 'SKU-FF-003' AND "companyId" = v_company_id;

    RAISE NOTICE 'Created/Updated 5 SKUs for testing';

    -- ========================================================================
    -- Step 6: Create Sample Vendor
    -- ========================================================================
    v_vendor_id := gen_random_uuid();

    INSERT INTO "Vendor" (id, code, name, "contactPerson", email, phone, "companyId", "isActive", "createdAt", "updatedAt")
    VALUES (v_vendor_id, 'VND-PT-001', 'Premium Textile Suppliers', 'Tanaka-san', 'tanaka@premiumtextile.jp', '+81-3-1234-5678', v_company_id, true, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    -- Get actual vendor ID
    SELECT id INTO v_vendor_id FROM "Vendor" WHERE code = 'VND-PT-001' AND "companyId" = v_company_id LIMIT 1;

    RAISE NOTICE 'Created/Found vendor: % (id: %)', 'Premium Textile Suppliers', v_vendor_id;

    -- ========================================================================
    -- Step 7: Create External Purchase Order
    -- ========================================================================
    v_external_po_id := gen_random_uuid();

    INSERT INTO external_purchase_orders (
        id, company_id, location_id, external_po_number, external_vendor_code,
        external_vendor_name, vendor_id, status, po_date, expected_delivery_date,
        total_lines, total_expected_qty, total_received_qty, total_amount,
        source, created_at, updated_at
    )
    VALUES (
        v_external_po_id, v_company_id, v_location_id, 'EXT-PO-2026-001',
        'VND-PT-001', 'Premium Textile Suppliers', v_vendor_id, 'OPEN',
        NOW(), NOW() + INTERVAL '7 days',
        3, 150, 0, 52950.00,
        'MANUAL', NOW(), NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Get actual PO ID
    SELECT id INTO v_external_po_id FROM external_purchase_orders
    WHERE external_po_number = 'EXT-PO-2026-001' AND company_id = v_company_id LIMIT 1;

    RAISE NOTICE 'Created/Found External PO: % (id: %)', 'EXT-PO-2026-001', v_external_po_id;

    -- ========================================================================
    -- Step 8: Create External PO Items
    -- ========================================================================
    INSERT INTO external_po_items (
        id, external_po_id, external_sku_code, external_sku_name,
        sku_id, ordered_qty, received_qty, unit_price, status, created_at, updated_at
    )
    VALUES
        (gen_random_uuid(), v_external_po_id, 'SKU-FF-001', 'Premium T-Shirt White', v_sku_id_1, 50, 0, 800.00, 'OPEN', NOW(), NOW()),
        (gen_random_uuid(), v_external_po_id, 'SKU-FF-002', 'Premium T-Shirt Black', v_sku_id_2, 50, 0, 800.00, 'OPEN', NOW(), NOW()),
        (gen_random_uuid(), v_external_po_id, 'SKU-FF-003', 'Designer Jeans Blue', v_sku_id_3, 50, 0, 2000.00, 'OPEN', NOW(), NOW())
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created External PO Items for EXT-PO-2026-001';

    -- ========================================================================
    -- Step 9: Create ASN (Advance Shipping Notice)
    -- ========================================================================
    v_asn_id := gen_random_uuid();

    INSERT INTO advance_shipping_notices (
        id, company_id, location_id, asn_no, external_asn_no, external_po_id,
        vendor_id, external_vendor_code, external_vendor_name,
        status, carrier, tracking_number, vehicle_number, driver_name, driver_phone,
        ship_date, expected_arrival,
        total_cartons, total_pallets, total_weight_kg,
        source, total_lines, total_expected_qty, total_received_qty,
        created_at, updated_at
    )
    VALUES (
        v_asn_id, v_company_id, v_location_id, 'ASN-2026-0001', 'VND-ASN-0001', v_external_po_id,
        v_vendor_id, 'VND-PT-001', 'Premium Textile Suppliers',
        'ARRIVED', 'Yamato Transport', 'YMT-123456789', 'TK-1234', 'Yamamoto-san', '+81-90-1234-5678',
        NOW() - INTERVAL '2 days', NOW(),
        10, 2, 150.00,
        'MANUAL', 3, 150, 0,
        NOW(), NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Get actual ASN ID
    SELECT id INTO v_asn_id FROM advance_shipping_notices
    WHERE asn_no = 'ASN-2026-0001' AND company_id = v_company_id LIMIT 1;

    RAISE NOTICE 'Created/Found ASN: % (id: %)', 'ASN-2026-0001', v_asn_id;

    -- ========================================================================
    -- Step 10: Create ASN Items
    -- ========================================================================
    INSERT INTO asn_items (
        id, asn_id, sku_id, external_sku_code, external_sku_name,
        expected_qty, received_qty, batch_no, lot_no,
        cartons, units_per_carton, status, created_at, updated_at
    )
    VALUES
        (gen_random_uuid(), v_asn_id, v_sku_id_1, 'SKU-FF-001', 'Premium T-Shirt White', 50, 0, 'BATCH-2026-01', 'LOT-001', 5, 10, 'EXPECTED', NOW(), NOW()),
        (gen_random_uuid(), v_asn_id, v_sku_id_2, 'SKU-FF-002', 'Premium T-Shirt Black', 50, 0, 'BATCH-2026-01', 'LOT-002', 5, 10, 'EXPECTED', NOW(), NOW()),
        (gen_random_uuid(), v_asn_id, v_sku_id_3, 'SKU-FF-003', 'Designer Jeans Blue', 50, 0, 'BATCH-2026-01', 'LOT-003', 5, 10, 'EXPECTED', NOW(), NOW())
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created ASN Items for ASN-2026-0001';

    -- ========================================================================
    -- Summary
    -- ========================================================================
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SAMPLE DATA CREATION COMPLETE';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Company ID: %', v_company_id;
    RAISE NOTICE 'Location: Tokyo Main Warehouse (id: %)', v_location_id;
    RAISE NOTICE 'Zone: Zone A - Saleable (id: %)', v_zone_id;
    RAISE NOTICE 'Bin: A-01-01-01 (id: %)', v_bin_id;
    RAISE NOTICE 'SKUs: 5 products created (SKU-FF-001 to SKU-FF-005)';
    RAISE NOTICE 'Vendor: Premium Textile Suppliers (id: %)', v_vendor_id;
    RAISE NOTICE 'External PO: EXT-PO-2026-001 with 3 items (status: OPEN)';
    RAISE NOTICE 'ASN: ASN-2026-0001 with 3 items (status: ARRIVED)';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'TEST FLOW (Super Admin Panel):';
    RAISE NOTICE '1. Login as admin@demo.com / admin123';
    RAISE NOTICE '2. Go to Inbound > Goods Receipt';
    RAISE NOTICE '3. See Pending Inbounds section with ASN and PO';
    RAISE NOTICE '4. Click "Create GRN" or use New GRN dropdown';
    RAISE NOTICE '5. Select source (External PO or ASN)';
    RAISE NOTICE '6. Create GRN and Post to create inventory';
    RAISE NOTICE '============================================================';

END $$;

-- Verify the data
SELECT 'Locations' as entity, COUNT(*) as count FROM "Location" WHERE name LIKE '%Tokyo%'
UNION ALL
SELECT 'SKUs' as entity, COUNT(*) as count FROM "SKU" WHERE code LIKE 'SKU-FF-%'
UNION ALL
SELECT 'Vendors' as entity, COUNT(*) as count FROM "Vendor" WHERE code = 'VND-PT-001'
UNION ALL
SELECT 'External POs' as entity, COUNT(*) as count FROM external_purchase_orders WHERE external_po_number = 'EXT-PO-2026-001'
UNION ALL
SELECT 'ASNs' as entity, COUNT(*) as count FROM advance_shipping_notices WHERE asn_no = 'ASN-2026-0001';
