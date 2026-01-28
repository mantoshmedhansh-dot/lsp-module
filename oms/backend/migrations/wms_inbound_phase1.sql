-- ============================================================================
-- WMS INBOUND PHASE 1: External PO, ASN & Upload Batches
-- Date: 2026-01-28
-- Description: Add support for external client POs, ASN, and bulk uploads
-- ============================================================================

-- ============================================================================
-- 1. UPLOAD BATCHES (for tracking bulk uploads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Upload Info
    batch_no VARCHAR(50) NOT NULL,
    upload_type VARCHAR(50) NOT NULL,
    -- Types: EXTERNAL_PO, ASN, GRN, OPENING_STOCK, STOCK_ADJUSTMENT

    -- File Info
    file_name VARCHAR(255),
    file_size INT,
    total_rows INT DEFAULT 0,
    success_rows INT DEFAULT 0,
    error_rows INT DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    -- PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED

    -- Error Log (array of {row, field, error})
    error_log JSONB DEFAULT '[]'::jsonb,

    -- Processing
    uploaded_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, batch_no)
);

CREATE INDEX idx_upload_batch_company ON upload_batches(company_id);
CREATE INDEX idx_upload_batch_type ON upload_batches(upload_type);
CREATE INDEX idx_upload_batch_status ON upload_batches(status);

-- ============================================================================
-- 2. EXTERNAL PURCHASE ORDERS (for 3PL clients without ERP integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id),

    -- External References (Client's System)
    external_po_number VARCHAR(100) NOT NULL,
    external_vendor_code VARCHAR(100),
    external_vendor_name VARCHAR(255),

    -- Link to internal vendor if exists
    vendor_id UUID REFERENCES vendors(id),

    -- Status
    status VARCHAR(50) DEFAULT 'OPEN',
    -- OPEN, PARTIALLY_RECEIVED, CLOSED, CANCELLED

    -- Dates
    po_date DATE,
    expected_delivery_date DATE,

    -- Totals (auto-calculated from items)
    total_lines INT DEFAULT 0,
    total_expected_qty INT DEFAULT 0,
    total_received_qty INT DEFAULT 0,
    total_amount NUMERIC(14,2) DEFAULT 0,

    -- Source
    source VARCHAR(50) DEFAULT 'MANUAL',
    -- MANUAL, UPLOAD, API
    upload_batch_id UUID REFERENCES upload_batches(id),

    -- Metadata
    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, external_po_number)
);

CREATE INDEX idx_ext_po_company ON external_purchase_orders(company_id);
CREATE INDEX idx_ext_po_location ON external_purchase_orders(location_id);
CREATE INDEX idx_ext_po_status ON external_purchase_orders(status);
CREATE INDEX idx_ext_po_date ON external_purchase_orders(po_date);
CREATE INDEX idx_ext_po_expected ON external_purchase_orders(expected_delivery_date);

-- ============================================================================
-- 3. EXTERNAL PO ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_po_id UUID NOT NULL REFERENCES external_purchase_orders(id) ON DELETE CASCADE,

    -- SKU Reference (can be NULL if SKU not in our system yet)
    sku_id UUID REFERENCES skus(id),

    -- External SKU info (always stored for reference)
    external_sku_code VARCHAR(100) NOT NULL,
    external_sku_name VARCHAR(255),

    -- Quantities
    ordered_qty INT NOT NULL DEFAULT 0,
    received_qty INT DEFAULT 0,

    -- Pricing (optional)
    unit_price NUMERIC(12,2),

    -- Status
    status VARCHAR(50) DEFAULT 'OPEN',
    -- OPEN, PARTIALLY_RECEIVED, CLOSED

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ext_po_item_po ON external_po_items(external_po_id);
CREATE INDEX idx_ext_po_item_sku ON external_po_items(sku_id);
CREATE INDEX idx_ext_po_item_ext_sku ON external_po_items(external_sku_code);

-- ============================================================================
-- 4. ADVANCE SHIPPING NOTICES (ASN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS advance_shipping_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id),

    -- ASN Identification
    asn_no VARCHAR(50) NOT NULL,
    external_asn_no VARCHAR(100),  -- Vendor/Client's ASN reference

    -- References
    external_po_id UUID REFERENCES external_purchase_orders(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    vendor_id UUID REFERENCES vendors(id),
    external_vendor_code VARCHAR(100),
    external_vendor_name VARCHAR(255),

    -- Status
    status VARCHAR(50) DEFAULT 'EXPECTED',
    -- EXPECTED, IN_TRANSIT, ARRIVED, RECEIVING, RECEIVED, CANCELLED

    -- Shipping Details
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),

    -- Dates
    ship_date DATE,
    expected_arrival DATE,
    actual_arrival TIMESTAMPTZ,

    -- Quantities (summary)
    total_lines INT DEFAULT 0,
    total_expected_qty INT DEFAULT 0,
    total_received_qty INT DEFAULT 0,

    -- Packing info
    total_cartons INT,
    total_pallets INT,
    total_weight_kg NUMERIC(10,3),

    -- Source
    source VARCHAR(50) DEFAULT 'MANUAL',
    -- MANUAL, UPLOAD, API, EDI
    upload_batch_id UUID REFERENCES upload_batches(id),

    -- Related GRN (created when receiving)
    goods_receipt_id UUID,  -- Will reference goods_receipts after receiving

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, asn_no)
);

CREATE INDEX idx_asn_company ON advance_shipping_notices(company_id);
CREATE INDEX idx_asn_location ON advance_shipping_notices(location_id);
CREATE INDEX idx_asn_status ON advance_shipping_notices(status);
CREATE INDEX idx_asn_expected ON advance_shipping_notices(expected_arrival);
CREATE INDEX idx_asn_ext_po ON advance_shipping_notices(external_po_id);
CREATE INDEX idx_asn_po ON advance_shipping_notices(purchase_order_id);

-- ============================================================================
-- 5. ASN ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS asn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asn_id UUID NOT NULL REFERENCES advance_shipping_notices(id) ON DELETE CASCADE,

    -- SKU (can be NULL if not mapped)
    sku_id UUID REFERENCES skus(id),
    external_sku_code VARCHAR(100),
    external_sku_name VARCHAR(255),

    -- Link to external PO item if applicable
    external_po_item_id UUID REFERENCES external_po_items(id),

    -- Quantities
    expected_qty INT NOT NULL DEFAULT 0,
    received_qty INT DEFAULT 0,

    -- Batch/Lot Info
    batch_no VARCHAR(100),
    lot_no VARCHAR(100),
    expiry_date DATE,
    mfg_date DATE,

    -- Packing
    cartons INT,
    units_per_carton INT,

    -- Status
    status VARCHAR(50) DEFAULT 'EXPECTED',
    -- EXPECTED, RECEIVED, PARTIALLY_RECEIVED

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asn_item_asn ON asn_items(asn_id);
CREATE INDEX idx_asn_item_sku ON asn_items(sku_id);

-- ============================================================================
-- 6. ENHANCE GOODS_RECEIPTS TABLE
-- ============================================================================

-- Add inbound source type
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS inbound_source VARCHAR(50) DEFAULT 'PURCHASE';
-- Values: PURCHASE, RETURN_SALES, RETURN_RTO, RETURN_DAMAGE, TRANSFER_IN,
--         PRODUCTION, OPENING, QC_UPGRADE, LOAN_RETURN, SAMPLE_RETURN, OTHER

-- Add movement type if not exists (SAP-style)
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS movement_type VARCHAR(10) DEFAULT '101';

-- External references
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS external_po_id UUID REFERENCES external_purchase_orders(id);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS asn_id UUID REFERENCES advance_shipping_notices(id);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS return_id UUID REFERENCES returns(id);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS stock_transfer_id UUID;

-- External reference numbers (for display/search when source not in system)
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS external_reference_type VARCHAR(50);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS external_reference_no VARCHAR(100);

-- Vehicle/Delivery Details
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS gate_entry_no VARCHAR(50);

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS gate_entry_time TIMESTAMPTZ;

-- Quality Summary
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS total_accepted_qty INT DEFAULT 0;

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS total_rejected_qty INT DEFAULT 0;

-- Source tracking
ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'MANUAL';

ALTER TABLE goods_receipts
ADD COLUMN IF NOT EXISTS upload_batch_id UUID REFERENCES upload_batches(id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_gr_inbound_source ON goods_receipts(inbound_source);
CREATE INDEX IF NOT EXISTS idx_gr_external_po ON goods_receipts(external_po_id);
CREATE INDEX IF NOT EXISTS idx_gr_asn ON goods_receipts(asn_id);
CREATE INDEX IF NOT EXISTS idx_gr_return ON goods_receipts(return_id);
CREATE INDEX IF NOT EXISTS idx_gr_external_ref ON goods_receipts(external_reference_no);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to generate ASN number
CREATE OR REPLACE FUNCTION generate_asn_number(p_company_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix VARCHAR(10) := 'ASN';
    v_date_part VARCHAR(8) := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    v_sequence INT;
    v_asn_no VARCHAR(50);
BEGIN
    -- Get next sequence for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(asn_no FROM LENGTH(v_prefix || v_date_part) + 1) AS INT)
    ), 0) + 1
    INTO v_sequence
    FROM advance_shipping_notices
    WHERE company_id = p_company_id
    AND asn_no LIKE v_prefix || v_date_part || '%';

    v_asn_no := v_prefix || v_date_part || LPAD(v_sequence::TEXT, 4, '0');

    RETURN v_asn_no;
END;
$$ LANGUAGE plpgsql;

-- Function to generate upload batch number
CREATE OR REPLACE FUNCTION generate_batch_number(p_company_id UUID, p_type VARCHAR)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_date_part VARCHAR(8) := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    v_sequence INT;
BEGIN
    -- Set prefix based on type
    v_prefix := CASE p_type
        WHEN 'EXTERNAL_PO' THEN 'EPO'
        WHEN 'ASN' THEN 'ASN'
        WHEN 'GRN' THEN 'GRN'
        WHEN 'OPENING_STOCK' THEN 'OPN'
        ELSE 'UPL'
    END;

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(batch_no FROM LENGTH(v_prefix || v_date_part) + 1) AS INT)
    ), 0) + 1
    INTO v_sequence
    FROM upload_batches
    WHERE company_id = p_company_id
    AND batch_no LIKE v_prefix || v_date_part || '%';

    RETURN v_prefix || v_date_part || LPAD(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TRIGGERS FOR AUTO-UPDATE
-- ============================================================================

-- Trigger to update external_po totals when items change
CREATE OR REPLACE FUNCTION update_external_po_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE external_purchase_orders
    SET
        total_lines = (SELECT COUNT(*) FROM external_po_items WHERE external_po_id = COALESCE(NEW.external_po_id, OLD.external_po_id)),
        total_expected_qty = (SELECT COALESCE(SUM(ordered_qty), 0) FROM external_po_items WHERE external_po_id = COALESCE(NEW.external_po_id, OLD.external_po_id)),
        total_received_qty = (SELECT COALESCE(SUM(received_qty), 0) FROM external_po_items WHERE external_po_id = COALESCE(NEW.external_po_id, OLD.external_po_id)),
        total_amount = (SELECT COALESCE(SUM(ordered_qty * COALESCE(unit_price, 0)), 0) FROM external_po_items WHERE external_po_id = COALESCE(NEW.external_po_id, OLD.external_po_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.external_po_id, OLD.external_po_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_external_po_totals ON external_po_items;
CREATE TRIGGER trg_update_external_po_totals
AFTER INSERT OR UPDATE OR DELETE ON external_po_items
FOR EACH ROW EXECUTE FUNCTION update_external_po_totals();

-- Trigger to update ASN totals when items change
CREATE OR REPLACE FUNCTION update_asn_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE advance_shipping_notices
    SET
        total_lines = (SELECT COUNT(*) FROM asn_items WHERE asn_id = COALESCE(NEW.asn_id, OLD.asn_id)),
        total_expected_qty = (SELECT COALESCE(SUM(expected_qty), 0) FROM asn_items WHERE asn_id = COALESCE(NEW.asn_id, OLD.asn_id)),
        total_received_qty = (SELECT COALESCE(SUM(received_qty), 0) FROM asn_items WHERE asn_id = COALESCE(NEW.asn_id, OLD.asn_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.asn_id, OLD.asn_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_asn_totals ON asn_items;
CREATE TRIGGER trg_update_asn_totals
AFTER INSERT OR UPDATE OR DELETE ON asn_items
FOR EACH ROW EXECUTE FUNCTION update_asn_totals();

-- Trigger to auto-update external PO status based on received qty
CREATE OR REPLACE FUNCTION update_external_po_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE external_purchase_orders
    SET
        status = CASE
            WHEN total_received_qty = 0 THEN 'OPEN'
            WHEN total_received_qty >= total_expected_qty THEN 'CLOSED'
            ELSE 'PARTIALLY_RECEIVED'
        END,
        updated_at = NOW()
    WHERE id = NEW.id
    AND status != 'CANCELLED';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_external_po_status ON external_purchase_orders;
CREATE TRIGGER trg_update_external_po_status
AFTER UPDATE OF total_received_qty ON external_purchase_orders
FOR EACH ROW EXECUTE FUNCTION update_external_po_status();

-- ============================================================================
-- 9. VIEWS FOR REPORTING
-- ============================================================================

-- Pending ASN view
CREATE OR REPLACE VIEW v_pending_asns AS
SELECT
    a.id,
    a.asn_no,
    a.external_asn_no,
    a.company_id,
    a.location_id,
    l.name as location_name,
    a.status,
    a.carrier,
    a.tracking_number,
    a.expected_arrival,
    a.total_lines,
    a.total_expected_qty,
    COALESCE(a.external_vendor_name, v.name) as vendor_name,
    epo.external_po_number,
    a.created_at
FROM advance_shipping_notices a
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN vendors v ON a.vendor_id = v.id
LEFT JOIN external_purchase_orders epo ON a.external_po_id = epo.id
WHERE a.status IN ('EXPECTED', 'IN_TRANSIT', 'ARRIVED')
ORDER BY a.expected_arrival ASC NULLS LAST;

-- External PO summary view
CREATE OR REPLACE VIEW v_external_po_summary AS
SELECT
    epo.id,
    epo.external_po_number,
    epo.company_id,
    epo.location_id,
    l.name as location_name,
    epo.status,
    COALESCE(epo.external_vendor_name, v.name) as vendor_name,
    epo.po_date,
    epo.expected_delivery_date,
    epo.total_lines,
    epo.total_expected_qty,
    epo.total_received_qty,
    (epo.total_expected_qty - epo.total_received_qty) as pending_qty,
    epo.total_amount,
    epo.source,
    epo.created_at
FROM external_purchase_orders epo
LEFT JOIN locations l ON epo.location_id = l.id
LEFT JOIN vendors v ON epo.vendor_id = v.id
ORDER BY epo.created_at DESC;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE external_purchase_orders IS 'Purchase orders from external clients (3PL model) - not managed in our system';
COMMENT ON TABLE advance_shipping_notices IS 'Pre-arrival notifications for incoming shipments';
COMMENT ON TABLE upload_batches IS 'Track bulk upload operations for POs, ASNs, stock etc.';
