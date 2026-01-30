-- ============================================================================
-- Phase 2: Simple Test Data Seed (Correct Schema)
-- Uses existing DEMO company (43ab19ee-2f42-44ae-bcf2-792274d15bd8)
-- ============================================================================

-- Variables (use existing IDs)
-- DEMO Company ID: 43ab19ee-2f42-44ae-bcf2-792274d15bd8
-- Tokyo Location ID: 2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be
-- Noida Location ID: 9d66e5ba-c6ed-4117-b0d7-478c14d30e32

-- ============================================================================
-- 1. ADD MORE SKUS
-- ============================================================================
INSERT INTO "SKU" (id, code, name, description, category, brand, "hsnCode", "mrp", "sellingPrice", "costPrice", weight, "companyId", "isActive", "createdAt", "updatedAt")
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'SKU-TSH-WHT-M', 'T-Shirt White Medium', 'Premium cotton t-shirt white color medium size', 'Apparel', 'Fashion Brand', '6109', 999.00, 799.00, 350.00, 0.25, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('a2222222-2222-2222-2222-222222222222', 'SKU-TSH-BLK-M', 'T-Shirt Black Medium', 'Premium cotton t-shirt black color medium size', 'Apparel', 'Fashion Brand', '6109', 999.00, 799.00, 350.00, 0.25, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('a3333333-3333-3333-3333-333333333333', 'SKU-JNS-BLU-32', 'Jeans Blue 32', 'Slim fit blue jeans size 32', 'Apparel', 'Fashion Brand', '6203', 2499.00, 1999.00, 800.00, 0.45, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('a4444444-4444-4444-4444-444444444444', 'SKU-SNK-WHT-9', 'Sneakers White 9', 'White sports sneakers size 9', 'Footwear', 'Sports Brand', '6402', 3499.00, 2799.00, 1200.00, 0.80, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('a5555555-5555-5555-5555-555555555555', 'SKU-CAP-BLK', 'Cap Black', 'Sports cap black color', 'Accessories', 'Sports Brand', '6505', 599.00, 449.00, 150.00, 0.10, '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. ADD ZONES
-- ============================================================================
INSERT INTO "Zone" (id, code, name, type, "locationId", "companyId", "isActive", "createdAt", "updatedAt")
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'ZONE-A', 'Receiving Zone', 'RECEIVING', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('b2222222-2222-2222-2222-222222222222', 'ZONE-B', 'Storage Zone', 'STORAGE', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('b3333333-3333-3333-3333-333333333333', 'ZONE-C', 'Picking Zone', 'PICKING', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW()),
    ('b4444444-4444-4444-4444-444444444444', 'ZONE-D', 'Dispatch Zone', 'DISPATCH', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. ADD BINS
-- ============================================================================
INSERT INTO "Bin" (id, code, name, type, "zoneId", "locationId", "companyId", capacity, "isActive", "createdAt", "updatedAt")
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'A-01-01-01', 'Bin A-01-01-01', 'STORAGE', 'b2222222-2222-2222-2222-222222222222', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 100, true, NOW(), NOW()),
    ('c2222222-2222-2222-2222-222222222222', 'A-01-01-02', 'Bin A-01-01-02', 'STORAGE', 'b2222222-2222-2222-2222-222222222222', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 100, true, NOW(), NOW()),
    ('c3333333-3333-3333-3333-333333333333', 'A-01-02-01', 'Bin A-01-02-01', 'STORAGE', 'b2222222-2222-2222-2222-222222222222', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 100, true, NOW(), NOW()),
    ('c4444444-4444-4444-4444-444444444444', 'A-01-02-02', 'Bin A-01-02-02', 'STORAGE', 'b2222222-2222-2222-2222-222222222222', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 100, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. ADD INVENTORY
-- ============================================================================
INSERT INTO "Inventory" (id, "skuId", "binId", "locationId", "companyId", quantity, "reservedQty", "fifoSequence", "createdAt", "updatedAt")
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 50, 0, 1, NOW(), NOW()),
    ('d2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 45, 0, 2, NOW(), NOW()),
    ('d3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'c2222222-2222-2222-2222-222222222222', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 30, 0, 3, NOW(), NOW()),
    ('d4444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', 'c3333333-3333-3333-3333-333333333333', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 20, 0, 4, NOW(), NOW()),
    ('d5555555-5555-5555-5555-555555555555', 'a5555555-5555-5555-5555-555555555555', 'c4444444-4444-4444-4444-444444444444', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 100, 0, 5, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ADD ORDERS (Various Statuses)
-- ============================================================================
INSERT INTO "Order" (id, "orderNo", channel, "orderType", "paymentMode", status, "customerName", "customerPhone", "customerEmail", "shippingAddress", subtotal, "taxAmount", "totalAmount", "orderDate", "locationId", "companyId", "createdAt", "updatedAt")
VALUES
    -- CREATED orders
    ('e1111111-1111-1111-1111-111111111111', 'ORD-2026-0001', 'WEBSITE', 'B2C', 'PREPAID', 'CREATED', 'Rahul Sharma', '+91-9876543210', 'rahul@example.com', '{"line1": "123 Main Street", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}', 799.00, 143.82, 942.82, NOW() - INTERVAL '2 hours', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '2 hours', NOW()),
    ('e2222222-2222-2222-2222-222222222222', 'ORD-2026-0002', 'AMAZON', 'B2C', 'COD', 'CREATED', 'Priya Patel', '+91-9876543211', 'priya@example.com', '{"line1": "456 Park Avenue", "city": "Delhi", "state": "Delhi", "pincode": "110001"}', 1999.00, 359.82, 2358.82, NOW() - INTERVAL '1 hour', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '1 hour', NOW()),

    -- CONFIRMED orders
    ('e3333333-3333-3333-3333-333333333333', 'ORD-2026-0003', 'FLIPKART', 'B2C', 'PREPAID', 'CONFIRMED', 'Amit Kumar', '+91-9876543212', 'amit@example.com', '{"line1": "789 Gandhi Road", "city": "Bangalore", "state": "Karnataka", "pincode": "560001"}', 2799.00, 503.82, 3302.82, NOW() - INTERVAL '1 day', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '1 day', NOW()),

    -- ALLOCATED orders
    ('e4444444-4444-4444-4444-444444444444', 'ORD-2026-0004', 'WEBSITE', 'B2C', 'PREPAID', 'ALLOCATED', 'Neha Singh', '+91-9876543213', 'neha@example.com', '{"line1": "321 Lake View", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001"}', 449.00, 80.82, 529.82, NOW() - INTERVAL '2 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '2 days', NOW()),

    -- PICKED orders
    ('e5555555-5555-5555-5555-555555555555', 'ORD-2026-0005', 'AMAZON', 'B2C', 'COD', 'PICKED', 'Vikram Reddy', '+91-9876543214', 'vikram@example.com', '{"line1": "654 Tech Park", "city": "Hyderabad", "state": "Telangana", "pincode": "500001"}', 1598.00, 287.64, 1885.64, NOW() - INTERVAL '3 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '3 days', NOW()),

    -- PACKED orders
    ('e6666666-6666-6666-6666-666666666666', 'ORD-2026-0006', 'FLIPKART', 'B2C', 'PREPAID', 'PACKED', 'Sanjay Gupta', '+91-9876543215', 'sanjay@example.com', '{"line1": "987 Business Center", "city": "Pune", "state": "Maharashtra", "pincode": "411001"}', 3248.00, 584.64, 3832.64, NOW() - INTERVAL '4 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '4 days', NOW()),

    -- SHIPPED orders (for NDR testing)
    ('e7777777-7777-7777-7777-777777777777', 'ORD-2026-0007', 'WEBSITE', 'B2C', 'COD', 'SHIPPED', 'Meera Joshi', '+91-9876543216', 'meera@example.com', '{"line1": "111 Hill Road", "city": "Jaipur", "state": "Rajasthan", "pincode": "302001"}', 799.00, 143.82, 942.82, NOW() - INTERVAL '5 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '5 days', NOW()),
    ('e8888888-8888-8888-8888-888888888888', 'ORD-2026-0008', 'AMAZON', 'B2C', 'PREPAID', 'SHIPPED', 'Arjun Nair', '+91-9876543217', 'arjun@example.com', '{"line1": "222 Beach Road", "city": "Kochi", "state": "Kerala", "pincode": "682001"}', 2799.00, 503.82, 3302.82, NOW() - INTERVAL '6 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '6 days', NOW()),
    ('e9999999-9999-9999-9999-999999999999', 'ORD-2026-0009', 'FLIPKART', 'B2C', 'COD', 'SHIPPED', 'Kavita Rao', '+91-9876543218', 'kavita@example.com', '{"line1": "333 College Street", "city": "Kolkata", "state": "West Bengal", "pincode": "700001"}', 1999.00, 359.82, 2358.82, NOW() - INTERVAL '7 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '7 days', NOW()),

    -- DELIVERED orders
    ('eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ORD-2026-0010', 'WEBSITE', 'B2C', 'PREPAID', 'DELIVERED', 'Raj Malhotra', '+91-9876543219', 'raj@example.com', '{"line1": "444 Industrial Area", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380001"}', 449.00, 80.82, 529.82, NOW() - INTERVAL '10 days', '2c2ad88d-a85c-48cf-a5ff-1b1a9bdd70be', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '10 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. ADD ORDER ITEMS
-- ============================================================================
INSERT INTO "OrderItem" (id, "orderId", "skuId", quantity, "unitPrice", "taxAmount", discount, "totalPrice", status, "createdAt", "updatedAt")
VALUES
    ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1, 799.00, 143.82, 0, 942.82, 'PENDING', NOW(), NOW()),
    ('f2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 1, 1999.00, 359.82, 0, 2358.82, 'PENDING', NOW(), NOW()),
    ('f3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 1, 2799.00, 503.82, 0, 3302.82, 'PENDING', NOW(), NOW()),
    ('f4444444-4444-4444-4444-444444444444', 'e4444444-4444-4444-4444-444444444444', 'a5555555-5555-5555-5555-555555555555', 1, 449.00, 80.82, 0, 529.82, 'PENDING', NOW(), NOW()),
    ('f5555555-5555-5555-5555-555555555555', 'e5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 2, 799.00, 287.64, 0, 1885.64, 'PENDING', NOW(), NOW()),
    ('f6666666-6666-6666-6666-666666666666', 'e6666666-6666-6666-6666-666666666666', 'a3333333-3333-3333-3333-333333333333', 1, 1999.00, 359.82, 0, 2358.82, 'PENDING', NOW(), NOW()),
    ('f6666667-6666-6666-6666-666666666666', 'e6666666-6666-6666-6666-666666666666', 'a5555555-5555-5555-5555-555555555555', 1, 449.00, 80.82, 0, 529.82, 'PENDING', NOW(), NOW()),
    ('f7777777-7777-7777-7777-777777777777', 'e7777777-7777-7777-7777-777777777777', 'a1111111-1111-1111-1111-111111111111', 1, 799.00, 143.82, 0, 942.82, 'PENDING', NOW(), NOW()),
    ('f8888888-8888-8888-8888-888888888888', 'e8888888-8888-8888-8888-888888888888', 'a4444444-4444-4444-4444-444444444444', 1, 2799.00, 503.82, 0, 3302.82, 'PENDING', NOW(), NOW()),
    ('f9999999-9999-9999-9999-999999999999', 'e9999999-9999-9999-9999-999999999999', 'a3333333-3333-3333-3333-333333333333', 1, 1999.00, 359.82, 0, 2358.82, 'PENDING', NOW(), NOW()),
    ('faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a5555555-5555-5555-5555-555555555555', 1, 449.00, 80.82, 0, 529.82, 'PENDING', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. ADD DELIVERIES (for shipped orders)
-- ============================================================================
INSERT INTO "Delivery" (id, "deliveryNo", "orderId", "companyId", status, "awbNo", weight, boxes, "createdAt", "updatedAt")
VALUES
    ('11111111-1111-1111-1111-111111111111', 'DEL-2026-0001', 'e7777777-7777-7777-7777-777777777777', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'IN_TRANSIT', 'AWB123456001', 0.30, 1, NOW() - INTERVAL '4 days', NOW()),
    ('22222222-2222-2222-2222-222222222222', 'DEL-2026-0002', 'e8888888-8888-8888-8888-888888888888', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'IN_TRANSIT', 'AWB123456002', 0.85, 1, NOW() - INTERVAL '5 days', NOW()),
    ('33333333-3333-3333-3333-333333333333', 'DEL-2026-0003', 'e9999999-9999-9999-9999-999999999999', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'OUT_FOR_DELIVERY', 'AWB123456003', 0.50, 1, NOW() - INTERVAL '6 days', NOW()),
    ('44444444-4444-4444-4444-444444444444', 'DEL-2026-0004', 'eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'DELIVERED', 'AWB123456004', 0.15, 1, NOW() - INTERVAL '9 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. ADD NDRs (Non-Delivery Reports)
-- ============================================================================
INSERT INTO "NDR" (id, "ndrCode", "orderId", "deliveryId", "companyId", status, reason, priority, "attemptNumber", "attemptDate", "carrierRemark", "riskScore", "createdAt", "updatedAt")
VALUES
    -- OPEN NDRs
    ('aaaa1111-1111-1111-1111-111111111111', 'NDR-2026-0001', 'e7777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'OPEN', 'CUSTOMER_UNAVAILABLE', 'HIGH', 1, NOW() - INTERVAL '1 day', 'Customer not available at delivery address', 75, NOW() - INTERVAL '1 day', NOW()),
    ('aaaa2222-2222-2222-2222-222222222222', 'NDR-2026-0002', 'e8888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'OPEN', 'WRONG_ADDRESS', 'CRITICAL', 2, NOW() - INTERVAL '2 days', 'Address incomplete, could not locate', 90, NOW() - INTERVAL '2 days', NOW()),
    ('aaaa3333-3333-3333-3333-333333333333', 'NDR-2026-0003', 'e9999999-9999-9999-9999-999999999999', '33333333-3333-3333-3333-333333333333', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'OPEN', 'COD_NOT_READY', 'MEDIUM', 1, NOW() - INTERVAL '12 hours', 'Customer did not have cash for COD', 50, NOW() - INTERVAL '12 hours', NOW()),

    -- ACTION_REQUESTED NDR
    ('aaaa4444-4444-4444-4444-444444444444', 'NDR-2026-0004', 'e7777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'ACTION_REQUESTED', 'PHONE_UNREACHABLE', 'HIGH', 3, NOW() - INTERVAL '3 days', 'Phone switched off, no response', 85, NOW() - INTERVAL '3 days', NOW()),

    -- REATTEMPT_SCHEDULED NDR
    ('aaaa5555-5555-5555-5555-555555555555', 'NDR-2026-0005', 'e8888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', 'REATTEMPT_SCHEDULED', 'CUSTOMER_UNAVAILABLE', 'MEDIUM', 2, NOW() - INTERVAL '1 day', 'Rescheduled for tomorrow morning', 40, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. ADD NDR OUTREACH RECORDS
-- ============================================================================
INSERT INTO "NDROutreach" (id, "ndrId", channel, "attemptNumber", "templateId", "messageContent", status, "companyId", "createdAt", "updatedAt")
VALUES
    ('bbbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'WHATSAPP', 1, 'ndr_unavailable', 'Hi Meera, we tried to deliver your order ORD-2026-0007 but you were unavailable. Please confirm your availability.', 'SENT', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '20 hours', NOW()),
    ('bbbb2222-2222-2222-2222-222222222222', 'aaaa2222-2222-2222-2222-222222222222', 'SMS', 1, 'ndr_wrong_address', 'Hi Arjun, we could not find your address for order ORD-2026-0008. Please share correct address.', 'DELIVERED', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '1 day', NOW()),
    ('bbbb3333-3333-3333-3333-333333333333', 'aaaa2222-2222-2222-2222-222222222222', 'WHATSAPP', 2, 'ndr_wrong_address', 'Hi Arjun, this is a reminder. Please update your delivery address for order ORD-2026-0008.', 'READ', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '12 hours', NOW()),
    ('bbbb4444-4444-4444-4444-444444444444', 'aaaa4444-4444-4444-4444-444444444444', 'WHATSAPP', 1, 'ndr_phone_unreachable', 'Hi, we could not reach you for delivery of order ORD-2026-0007. Please call back.', 'RESPONDED', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '2 days', NOW()),
    ('bbbb5555-5555-5555-5555-555555555555', 'aaaa5555-5555-5555-5555-555555555555', 'SMS', 1, 'ndr_reschedule_confirm', 'Your delivery for order ORD-2026-0008 is rescheduled for tomorrow 9AM-12PM.', 'DELIVERED', '43ab19ee-2f42-44ae-bcf2-792274d15bd8', NOW() - INTERVAL '6 hours', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
SELECT 'Test data inserted successfully!' as status;

SELECT 'SKUs' as entity, COUNT(*) as count FROM "SKU" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'Zones', COUNT(*) FROM "Zone" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'Bins', COUNT(*) FROM "Bin" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'Inventory', COUNT(*) FROM "Inventory" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'Orders', COUNT(*) FROM "Order" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'OrderItems', COUNT(*) FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8')
UNION ALL SELECT 'Deliveries', COUNT(*) FROM "Delivery" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'NDRs', COUNT(*) FROM "NDR" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8'
UNION ALL SELECT 'NDROutreaches', COUNT(*) FROM "NDROutreach" WHERE "companyId" = '43ab19ee-2f42-44ae-bcf2-792274d15bd8';
