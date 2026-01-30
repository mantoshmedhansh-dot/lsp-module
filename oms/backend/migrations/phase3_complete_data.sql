-- ============================================================================
-- Phase 3: Complete Test Data - Correct Schema
-- Company: DEMO (43ab19ee-2f42-44ae-bcf2-792274d15bd8)
-- Location: Tokyo WH (2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be)
-- ============================================================================

-- ============================================================================
-- 1. ADD MORE SKUs (need 5-10 total, have 7, adding 3 more)
-- ============================================================================
INSERT INTO "SKU" (id, code, name, description, category, brand, hsn, mrp, "sellingPrice", "costPrice", weight, "companyId", "isActive", "createdAt", "updatedAt")
VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111111', 'SKU-FF-006', 'Sports Jacket Navy', 'Premium sports jacket navy blue', 'Apparel', 'Fashion Brand', '6201', 4999.00, 3999.00, 1500.00, 0.65, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('22222222-aaaa-aaaa-aaaa-222222222222', 'SKU-FF-007', 'Formal Shirt White', 'Cotton formal shirt white', 'Apparel', 'Fashion Brand', '6205', 1999.00, 1599.00, 650.00, 0.30, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('33333333-aaaa-aaaa-aaaa-333333333333', 'SKU-FF-008', 'Denim Shorts Blue', 'Casual denim shorts', 'Apparel', 'Fashion Brand', '6204', 1499.00, 1199.00, 450.00, 0.35, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. ADD SECOND VENDOR
-- ============================================================================
INSERT INTO "Vendor" (id, code, name, "contactPerson", email, phone, gst, pan, address, "paymentTerms", "isActive", "companyId", "createdAt", "updatedAt")
VALUES
    ('44444444-aaaa-aaaa-aaaa-444444444444', 'VND-FC-001', 'Fashion Corp International', 'Rajesh Kumar', 'rajesh@fashioncorp.com', '+91-9876543210', '27AABCF1234A1ZA', 'AABCF1234A', '{"line1": "456 Industrial Estate", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}', 'NET30', true, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. ADD MORE EXTERNAL POs (need 5, have 1, adding 4 more)
-- ============================================================================

-- Get existing SKU IDs for reference
-- SKU-FF-001: Premium T-Shirt White
-- SKU-FF-002: Premium T-Shirt Black
-- SKU-FF-003: Designer Jeans Blue
-- SKU-FF-004: Leather Belt Brown
-- SKU-FF-005: Canvas Sneakers White

-- PO 2: PARTIALLY_RECEIVED status
INSERT INTO external_purchase_orders (id, company_id, location_id, external_po_number, external_vendor_code, external_vendor_name, status, po_date, expected_delivery_date, total_lines, total_expected_qty, total_received_qty, total_amount, source, created_at, updated_at)
VALUES
    ('55555555-aaaa-aaaa-aaaa-555555555555', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', 'EXT-PO-2026-002', 'VND-FC-001', 'Fashion Corp International', 'PARTIALLY_RECEIVED', '2026-01-15', '2026-01-25', 2, 200, 100, 150000.00, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- PO 3: OPEN status (ready for receiving)
INSERT INTO external_purchase_orders (id, company_id, location_id, external_po_number, external_vendor_code, external_vendor_name, status, po_date, expected_delivery_date, total_lines, total_expected_qty, total_received_qty, total_amount, source, created_at, updated_at)
VALUES
    ('66666666-aaaa-aaaa-aaaa-666666666666', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', 'EXT-PO-2026-003', 'VND-PT-001', 'Premium Textile Suppliers', 'OPEN', '2026-01-25', '2026-02-05', 3, 300, 0, 225000.00, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- PO 4: CLOSED status
INSERT INTO external_purchase_orders (id, company_id, location_id, external_po_number, external_vendor_code, external_vendor_name, status, po_date, expected_delivery_date, total_lines, total_expected_qty, total_received_qty, total_amount, source, created_at, updated_at)
VALUES
    ('77777777-aaaa-aaaa-aaaa-777777777777', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', 'EXT-PO-2026-004', 'VND-FC-001', 'Fashion Corp International', 'CLOSED', '2026-01-01', '2026-01-10', 2, 150, 150, 112500.00, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- PO 5: CANCELLED status
INSERT INTO external_purchase_orders (id, company_id, location_id, external_po_number, external_vendor_code, external_vendor_name, status, po_date, expected_delivery_date, total_lines, total_expected_qty, total_received_qty, total_amount, source, created_at, updated_at)
VALUES
    ('88888888-aaaa-aaaa-aaaa-888888888888', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', 'EXT-PO-2026-005', 'VND-PT-001', 'Premium Textile Suppliers', 'CANCELLED', '2026-01-20', '2026-02-01', 1, 50, 0, 37500.00, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. ADD EXTERNAL PO ITEMS
-- ============================================================================

-- Items for PO-002 (PARTIALLY_RECEIVED)
INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '55555551-aaaa-aaaa-aaaa-555555555551'::uuid,
    '55555555-aaaa-aaaa-aaaa-555555555555'::uuid,
    id,
    'EXT-SKU-006',
    'Sports Jacket',
    100,
    50,
    1500.00,
    'PARTIALLY_RECEIVED',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-006'
ON CONFLICT (id) DO NOTHING;

INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '55555552-aaaa-aaaa-aaaa-555555555552'::uuid,
    '55555555-aaaa-aaaa-aaaa-555555555555'::uuid,
    id,
    'EXT-SKU-007',
    'Formal Shirt',
    100,
    50,
    650.00,
    'PARTIALLY_RECEIVED',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-007'
ON CONFLICT (id) DO NOTHING;

-- Items for PO-003 (OPEN)
INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '66666661-aaaa-aaaa-aaaa-666666666661'::uuid,
    '66666666-aaaa-aaaa-aaaa-666666666666'::uuid,
    id,
    'EXT-SKU-001',
    'T-Shirt White',
    100,
    0,
    350.00,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '66666662-aaaa-aaaa-aaaa-666666666662'::uuid,
    '66666666-aaaa-aaaa-aaaa-666666666666'::uuid,
    id,
    'EXT-SKU-002',
    'T-Shirt Black',
    100,
    0,
    350.00,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-002'
ON CONFLICT (id) DO NOTHING;

INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '66666663-aaaa-aaaa-aaaa-666666666663'::uuid,
    '66666666-aaaa-aaaa-aaaa-666666666666'::uuid,
    id,
    'EXT-SKU-003',
    'Designer Jeans',
    100,
    0,
    800.00,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-003'
ON CONFLICT (id) DO NOTHING;

-- Items for PO-004 (CLOSED)
INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '77777771-aaaa-aaaa-aaaa-777777777771'::uuid,
    '77777777-aaaa-aaaa-aaaa-777777777777'::uuid,
    id,
    'EXT-SKU-004',
    'Leather Belt',
    100,
    100,
    250.00,
    'RECEIVED',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO external_po_items (id, external_po_id, sku_id, external_sku_code, external_sku_name, ordered_qty, received_qty, unit_price, status, created_at, updated_at)
SELECT
    '77777772-aaaa-aaaa-aaaa-777777777772'::uuid,
    '77777777-aaaa-aaaa-aaaa-777777777777'::uuid,
    id,
    'EXT-SKU-005',
    'Canvas Sneakers',
    50,
    50,
    1200.00,
    'RECEIVED',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-005'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ADD MORE ASNs (need 3, have 1, adding 2 more)
-- ============================================================================

-- ASN 2: IN_TRANSIT (linked to PO-003)
INSERT INTO advance_shipping_notices (id, company_id, location_id, asn_no, external_asn_no, external_po_id, external_vendor_code, external_vendor_name, status, carrier, tracking_number, vehicle_number, driver_name, ship_date, expected_arrival, total_lines, total_expected_qty, total_received_qty, total_cartons, source, created_at, updated_at)
VALUES
    ('99999999-aaaa-aaaa-aaaa-999999999999', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', 'ASN-2026-0002', 'EXT-ASN-002', '66666666-aaaa-aaaa-aaaa-666666666666', 'VND-PT-001', 'Premium Textile Suppliers', 'IN_TRANSIT', 'Blue Dart Express', 'BD987654321', 'MH-01-AB-1234', 'Suresh Kumar', '2026-01-28', '2026-02-01', 3, 300, 0, 30, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ASN 3: ARRIVED (linked to PO-002, ready for GRN)
INSERT INTO advance_shipping_notices (id, company_id, location_id, asn_no, external_asn_no, external_po_id, external_vendor_code, external_vendor_name, status, carrier, tracking_number, vehicle_number, driver_name, ship_date, expected_arrival, actual_arrival, total_lines, total_expected_qty, total_received_qty, total_cartons, source, created_at, updated_at)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', 'ASN-2026-0003', 'EXT-ASN-003', '55555555-aaaa-aaaa-aaaa-555555555555', 'VND-FC-001', 'Fashion Corp International', 'ARRIVED', 'DTDC Courier', 'DTDC123456', 'TN-09-XY-5678', 'Ramesh Patel', '2026-01-25', '2026-01-28', NOW() - INTERVAL '1 day', 2, 100, 0, 10, 'MANUAL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. ADD ASN ITEMS
-- ============================================================================

-- Items for ASN-2 (IN_TRANSIT)
INSERT INTO asn_items (id, asn_id, sku_id, external_sku_code, external_sku_name, expected_qty, received_qty, cartons, units_per_carton, status, created_at, updated_at)
SELECT
    '99999991-aaaa-aaaa-aaaa-999999999991'::uuid,
    '99999999-aaaa-aaaa-aaaa-999999999999'::uuid,
    id,
    'EXT-SKU-001',
    'T-Shirt White',
    100,
    0,
    10,
    10,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-001'
ON CONFLICT (id) DO NOTHING;

INSERT INTO asn_items (id, asn_id, sku_id, external_sku_code, external_sku_name, expected_qty, received_qty, cartons, units_per_carton, status, created_at, updated_at)
SELECT
    '99999992-aaaa-aaaa-aaaa-999999999992'::uuid,
    '99999999-aaaa-aaaa-aaaa-999999999999'::uuid,
    id,
    'EXT-SKU-002',
    'T-Shirt Black',
    100,
    0,
    10,
    10,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-002'
ON CONFLICT (id) DO NOTHING;

INSERT INTO asn_items (id, asn_id, sku_id, external_sku_code, external_sku_name, expected_qty, received_qty, cartons, units_per_carton, status, created_at, updated_at)
SELECT
    '99999993-aaaa-aaaa-aaaa-999999999993'::uuid,
    '99999999-aaaa-aaaa-aaaa-999999999999'::uuid,
    id,
    'EXT-SKU-003',
    'Designer Jeans',
    100,
    0,
    10,
    10,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-003'
ON CONFLICT (id) DO NOTHING;

-- Items for ASN-3 (ARRIVED)
INSERT INTO asn_items (id, asn_id, sku_id, external_sku_code, external_sku_name, expected_qty, received_qty, cartons, units_per_carton, batch_no, status, created_at, updated_at)
SELECT
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    id,
    'EXT-SKU-006',
    'Sports Jacket',
    50,
    0,
    5,
    10,
    'BATCH-2026-001',
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-006'
ON CONFLICT (id) DO NOTHING;

INSERT INTO asn_items (id, asn_id, sku_id, external_sku_code, external_sku_name, expected_qty, received_qty, cartons, units_per_carton, batch_no, status, created_at, updated_at)
SELECT
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    id,
    'EXT-SKU-007',
    'Formal Shirt',
    50,
    0,
    5,
    10,
    'BATCH-2026-002',
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-007'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. ADD MORE GRNs (need 10, have 6, adding 4 more)
-- ============================================================================

-- GRN 7: POSTED (creates inventory)
INSERT INTO "GoodsReceipt" (id, "grNo", "asnNo", status, "movementType", "totalQty", "totalValue", "locationId", "companyId", "receivedAt", "postedAt", "createdAt", "updatedAt", "inboundSource", "externalPoId", "asnId", "vehicleNumber", "driverName", "totalAcceptedQty", "totalRejectedQty")
VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'GR-000007', 'ASN-2026-0003', 'POSTED', '101', 100, 215000.00, '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 days', NOW(), 'ASN', '55555555-aaaa-aaaa-aaaa-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TN-09-XY-5678', 'Ramesh Patel', 100, 0)
ON CONFLICT (id) DO NOTHING;

-- GRN 8: POSTED (creates inventory)
INSERT INTO "GoodsReceipt" (id, "grNo", status, "movementType", "totalQty", "totalValue", "locationId", "companyId", "receivedAt", "postedAt", "createdAt", "updatedAt", "inboundSource", "externalPoId", "vehicleNumber", "totalAcceptedQty", "totalRejectedQty")
VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'GR-000008', 'POSTED', '101', 150, 112500.00, '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '6 days', NOW(), 'EXTERNAL_PO', '77777777-aaaa-aaaa-aaaa-777777777777', 'DL-01-AB-9999', 150, 0)
ON CONFLICT (id) DO NOTHING;

-- GRN 9: DRAFT (waiting to start)
INSERT INTO "GoodsReceipt" (id, "grNo", status, "movementType", "totalQty", "totalValue", "locationId", "companyId", "createdAt", "updatedAt", "inboundSource", "totalAcceptedQty", "totalRejectedQty")
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'GR-000009', 'DRAFT', '101', 0, 0, '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW(), NOW(), 'MANUAL', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- GRN 10: RECEIVING
INSERT INTO "GoodsReceipt" (id, "grNo", status, "movementType", "totalQty", "totalValue", "locationId", "companyId", "receivedAt", "createdAt", "updatedAt", "inboundSource", "vehicleNumber", "driverName", "totalAcceptedQty", "totalRejectedQty")
VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GR-000010', 'RECEIVING', '101', 200, 70000.00, '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '1 day', NOW(), 'MANUAL', 'KA-01-MN-7777', 'Mohan Das', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. ADD GRN ITEMS FOR POSTED GRNs
-- ============================================================================

-- Items for GR-000007 (POSTED)
INSERT INTO "GoodsReceiptItem" (id, "goodsReceiptId", "skuId", "expectedQty", "receivedQty", "acceptedQty", "rejectedQty", "batchNo", "costPrice", "fifoSequence", "createdAt", "updatedAt")
SELECT
    'bbbbbb01-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    id,
    50,
    50,
    50,
    0,
    'BATCH-2026-001',
    1500.00,
    101,
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-006'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "GoodsReceiptItem" (id, "goodsReceiptId", "skuId", "expectedQty", "receivedQty", "acceptedQty", "rejectedQty", "batchNo", "costPrice", "fifoSequence", "createdAt", "updatedAt")
SELECT
    'bbbbbb02-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    id,
    50,
    50,
    50,
    0,
    'BATCH-2026-002',
    650.00,
    102,
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-007'
ON CONFLICT (id) DO NOTHING;

-- Items for GR-000008 (POSTED)
INSERT INTO "GoodsReceiptItem" (id, "goodsReceiptId", "skuId", "expectedQty", "receivedQty", "acceptedQty", "rejectedQty", "costPrice", "fifoSequence", "createdAt", "updatedAt")
SELECT
    'cccccc01-cccc-cccc-cccc-cccccccccccc'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    id,
    100,
    100,
    100,
    0,
    250.00,
    103,
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "GoodsReceiptItem" (id, "goodsReceiptId", "skuId", "expectedQty", "receivedQty", "acceptedQty", "rejectedQty", "costPrice", "fifoSequence", "createdAt", "updatedAt")
SELECT
    'cccccc02-cccc-cccc-cccc-cccccccccccc'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    id,
    50,
    50,
    50,
    0,
    1200.00,
    104,
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-005'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. ADD INVENTORY (from POSTED GRNs)
-- Note: binId is required, using existing bins from Tokyo WH
-- ============================================================================

-- Inventory from GR-000007
INSERT INTO "Inventory" (id, "skuId", "locationId", "companyId", "binId", quantity, "reservedQty", "fifoSequence", "batchNo", "createdAt", "updatedAt")
SELECT
    'f0f00001-aaaa-aaaa-aaaa-111111111111'::uuid,
    id,
    '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be'::uuid,
    '43ab19ee-2f42-44ae-bcf2-792274d15bd8'::uuid,
    'de6d1773-3105-485f-9f42-ade3f360fef0'::uuid,
    50,
    0,
    101,
    'BATCH-2026-001',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-006'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Inventory" (id, "skuId", "locationId", "companyId", "binId", quantity, "reservedQty", "fifoSequence", "batchNo", "createdAt", "updatedAt")
SELECT
    'f0f00002-aaaa-aaaa-aaaa-222222222222'::uuid,
    id,
    '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be'::uuid,
    '43ab19ee-2f42-44ae-bcf2-792274d15bd8'::uuid,
    '7e6f6f13-ea3e-409f-b9b1-dfb37d8b0f52'::uuid,
    50,
    0,
    102,
    'BATCH-2026-002',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-007'
ON CONFLICT (id) DO NOTHING;

-- Inventory from GR-000008
INSERT INTO "Inventory" (id, "skuId", "locationId", "companyId", "binId", quantity, "reservedQty", "fifoSequence", "createdAt", "updatedAt")
SELECT
    'f0f00003-aaaa-aaaa-aaaa-333333333333'::uuid,
    id,
    '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be'::uuid,
    '43ab19ee-2f42-44ae-bcf2-792274d15bd8'::uuid,
    '5b6a23b1-a9f4-4db3-bdba-ae8bd439729a'::uuid,
    100,
    0,
    103,
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Inventory" (id, "skuId", "locationId", "companyId", "binId", quantity, "reservedQty", "fifoSequence", "createdAt", "updatedAt")
SELECT
    'f0f00004-aaaa-aaaa-aaaa-444444444444'::uuid,
    id,
    '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be'::uuid,
    '43ab19ee-2f42-44ae-bcf2-792274d15bd8'::uuid,
    '756a05f1-2ec6-4d7e-b0aa-4afcf9759d27'::uuid,
    50,
    0,
    104,
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-005'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. ADD MORE ORDERS (need 20, have 11, adding 9 more)
-- ============================================================================

INSERT INTO "Order" (id, "orderNo", channel, "orderType", "paymentMode", status, "customerName", "customerPhone", "customerEmail", "shippingAddress", subtotal, "taxAmount", "totalAmount", "orderDate", "locationId", "companyId", "createdAt", "updatedAt")
VALUES
    -- PICKLIST_GENERATED
    ('a0de0012-1111-1111-1111-111111111111', 'ORD-2026-0012', 'WEBSITE', 'B2C', 'PREPAID', 'PICKLIST_GENERATED', 'Anita Sharma', '+91-9876543220', 'anita@example.com', '{"line1": "555 Hill View", "city": "Lucknow", "state": "Uttar Pradesh", "pincode": "226001"}', 1999.00, 359.82, 2358.82, NOW() - INTERVAL '2 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '2 days', NOW()),

    -- PICKED (changed from PICKING)
    ('a0de0013-1111-1111-1111-111111111111', 'ORD-2026-0013', 'AMAZON', 'B2C', 'COD', 'PICKED', 'Sunil Verma', '+91-9876543221', 'sunil@example.com', '{"line1": "666 Market Road", "city": "Kanpur", "state": "Uttar Pradesh", "pincode": "208001"}', 2499.00, 449.82, 2948.82, NOW() - INTERVAL '3 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '3 days', NOW()),

    -- PACKED (changed from INVOICED)
    ('a0de0014-1111-1111-1111-111111111111', 'ORD-2026-0014', 'FLIPKART', 'B2C', 'PREPAID', 'PACKED', 'Pooja Gupta', '+91-9876543222', 'pooja@example.com', '{"line1": "777 Station Road", "city": "Nagpur", "state": "Maharashtra", "pincode": "440001"}', 3499.00, 629.82, 4128.82, NOW() - INTERVAL '4 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '4 days', NOW()),

    -- SHIPPED (changed from DISPATCHED)
    ('a0de0015-1111-1111-1111-111111111111', 'ORD-2026-0015', 'WEBSITE', 'B2C', 'COD', 'SHIPPED', 'Ravi Shankar', '+91-9876543223', 'ravi@example.com', '{"line1": "888 Ring Road", "city": "Indore", "state": "Madhya Pradesh", "pincode": "452001"}', 1599.00, 287.82, 1886.82, NOW() - INTERVAL '5 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '5 days', NOW()),

    -- SHIPPED (changed from IN_TRANSIT)
    ('a0de0016-1111-1111-1111-111111111111', 'ORD-2026-0016', 'AMAZON', 'B2C', 'PREPAID', 'SHIPPED', 'Deepa Menon', '+91-9876543224', 'deepa@example.com', '{"line1": "999 MG Road", "city": "Bhopal", "state": "Madhya Pradesh", "pincode": "462001"}', 4999.00, 899.82, 5898.82, NOW() - INTERVAL '6 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '6 days', NOW()),

    -- SHIPPED (changed from OUT_FOR_DELIVERY)
    ('a0de0017-1111-1111-1111-111111111111', 'ORD-2026-0017', 'FLIPKART', 'B2C', 'COD', 'SHIPPED', 'Kiran Reddy', '+91-9876543225', 'kiran@example.com', '{"line1": "101 Jubilee Hills", "city": "Hyderabad", "state": "Telangana", "pincode": "500033"}', 1999.00, 359.82, 2358.82, NOW() - INTERVAL '7 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '7 days', NOW()),

    -- More DELIVERED
    ('a0de0018-1111-1111-1111-111111111111', 'ORD-2026-0018', 'WEBSITE', 'B2C', 'PREPAID', 'DELIVERED', 'Suman Das', '+91-9876543226', 'suman@example.com', '{"line1": "202 Salt Lake", "city": "Kolkata", "state": "West Bengal", "pincode": "700091"}', 649.00, 116.82, 765.82, NOW() - INTERVAL '12 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '12 days', NOW()),
    ('a0de0019-1111-1111-1111-111111111111', 'ORD-2026-0019', 'AMAZON', 'B2C', 'COD', 'DELIVERED', 'Tarun Jain', '+91-9876543227', 'tarun@example.com', '{"line1": "303 Civil Lines", "city": "Jaipur", "state": "Rajasthan", "pincode": "302006"}', 2499.00, 449.82, 2948.82, NOW() - INTERVAL '15 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '15 days', NOW()),

    -- CREATED (changed from CANCELLED - will mark as cancelled via flag if needed)
    ('a0de0020-1111-1111-1111-111111111111', 'ORD-2026-0020', 'FLIPKART', 'B2C', 'PREPAID', 'CREATED', 'Uma Shankar', '+91-9876543228', 'uma@example.com', '{"line1": "404 Sector 18", "city": "Noida", "state": "Uttar Pradesh", "pincode": "201301"}', 1499.00, 269.82, 1768.82, NOW() - INTERVAL '8 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '8 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 11. ADD ORDER ITEMS FOR NEW ORDERS
-- ============================================================================

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00012-1111-1111-1111-111111111111'::uuid,
    'a0de0012-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    1999.00,
    359.82,
    0,
    2358.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00013-1111-1111-1111-111111111111'::uuid,
    'a0de0013-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    2499.00,
    449.82,
    0,
    2948.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00014-1111-1111-1111-111111111111'::uuid,
    'a0de0014-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    3499.00,
    629.82,
    0,
    4128.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-005'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00015-1111-1111-1111-111111111111'::uuid,
    'a0de0015-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    1599.00,
    287.82,
    0,
    1886.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-007'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00016-1111-1111-1111-111111111111'::uuid,
    'a0de0016-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    4999.00,
    899.82,
    0,
    5898.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-006'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00017-1111-1111-1111-111111111111'::uuid,
    'a0de0017-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    1999.00,
    359.82,
    0,
    2358.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00018-1111-1111-1111-111111111111'::uuid,
    'a0de0018-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    649.00,
    116.82,
    0,
    765.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00019-1111-1111-1111-111111111111'::uuid,
    'a0de0019-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    2499.00,
    449.82,
    0,
    2948.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
SELECT
    'b1e00020-1111-1111-1111-111111111111'::uuid,
    'a0de0020-1111-1111-1111-111111111111'::uuid,
    id,
    1,
    1499.00,
    269.82,
    0,
    1768.82,
    'PENDING',
    NOW(),
    NOW()
FROM "SKU" WHERE code = 'SKU-FF-008'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Phase 3 Complete Data - Inserted Successfully!' as status;
