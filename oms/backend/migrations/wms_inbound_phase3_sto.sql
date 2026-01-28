-- ============================================================================
-- WMS INBOUND PHASE 3: Stock Transfer Orders (STO)
-- Date: 2026-01-28
-- Description: Add support for inter-location stock transfers
-- ============================================================================

-- ============================================================================
-- 1. STOCK TRANSFER ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_transfer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,

    -- STO Number
    sto_no VARCHAR(50) NOT NULL,

    -- Source & Destination
    source_location_id UUID NOT NULL REFERENCES "Location"(id),
    destination_location_id UUID NOT NULL REFERENCES "Location"(id),

    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT',
    -- DRAFT, APPROVED, PICKING, PICKED, IN_TRANSIT, RECEIVED, CANCELLED

    -- Dates
    required_by_date TIMESTAMPTZ,
    shipped_date TIMESTAMPTZ,
    received_date TIMESTAMPTZ,

    -- Shipping details
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),

    -- Priority
    priority VARCHAR(20) DEFAULT 'NORMAL',
    -- LOW, NORMAL, HIGH, URGENT

    -- Totals (auto-calculated)
    total_items INT DEFAULT 0,
    total_requested_qty INT DEFAULT 0,
    total_shipped_qty INT DEFAULT 0,
    total_received_qty INT DEFAULT 0,

    -- Related Documents
    source_gate_pass_id UUID,
    destination_grn_id UUID,

    -- Requestor/Approver
    requested_by UUID REFERENCES "User"(id),
    approved_by UUID REFERENCES "User"(id),
    approved_at TIMESTAMPTZ,

    -- Source tracking
    source VARCHAR(50) DEFAULT 'MANUAL',
    upload_batch_id UUID REFERENCES upload_batches(id),

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, sto_no)
);

CREATE INDEX IF NOT EXISTS idx_sto_company ON stock_transfer_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_sto_status ON stock_transfer_orders(status);
CREATE INDEX IF NOT EXISTS idx_sto_source_loc ON stock_transfer_orders(source_location_id);
CREATE INDEX IF NOT EXISTS idx_sto_dest_loc ON stock_transfer_orders(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_sto_required_by ON stock_transfer_orders(required_by_date);

-- ============================================================================
-- 2. STO ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sto_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transfer_order_id UUID NOT NULL REFERENCES stock_transfer_orders(id) ON DELETE CASCADE,

    -- SKU
    sku_id UUID NOT NULL REFERENCES "SKU"(id),

    -- Quantities
    requested_qty INT NOT NULL DEFAULT 0,
    shipped_qty INT DEFAULT 0,
    received_qty INT DEFAULT 0,
    damaged_qty INT DEFAULT 0,

    -- Bins
    source_bin_id UUID REFERENCES "Bin"(id),
    destination_bin_id UUID REFERENCES "Bin"(id),

    -- Batch/Lot (for traceability)
    batch_no VARCHAR(100),
    lot_no VARCHAR(100),

    -- Inventory reference (for FIFO tracking)
    source_inventory_id UUID,
    fifo_sequence INT,

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    -- PENDING, PICKED, SHIPPED, RECEIVED, PARTIALLY_RECEIVED

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sto_item_sto ON sto_items(stock_transfer_order_id);
CREATE INDEX IF NOT EXISTS idx_sto_item_sku ON sto_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_sto_item_status ON sto_items(status);

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

-- Function to generate STO number
CREATE OR REPLACE FUNCTION generate_sto_number(p_company_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix VARCHAR(10) := 'STO';
    v_date_part VARCHAR(8) := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    v_sequence INT;
BEGIN
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(sto_no FROM LENGTH(v_prefix || v_date_part) + 1) AS INT)
    ), 0) + 1
    INTO v_sequence
    FROM stock_transfer_orders
    WHERE company_id = p_company_id
    AND sto_no LIKE v_prefix || v_date_part || '%';

    RETURN v_prefix || v_date_part || LPAD(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Trigger to update STO totals when items change
CREATE OR REPLACE FUNCTION update_sto_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stock_transfer_orders
    SET
        total_items = (SELECT COUNT(*) FROM sto_items WHERE stock_transfer_order_id = COALESCE(NEW.stock_transfer_order_id, OLD.stock_transfer_order_id)),
        total_requested_qty = (SELECT COALESCE(SUM(requested_qty), 0) FROM sto_items WHERE stock_transfer_order_id = COALESCE(NEW.stock_transfer_order_id, OLD.stock_transfer_order_id)),
        total_shipped_qty = (SELECT COALESCE(SUM(shipped_qty), 0) FROM sto_items WHERE stock_transfer_order_id = COALESCE(NEW.stock_transfer_order_id, OLD.stock_transfer_order_id)),
        total_received_qty = (SELECT COALESCE(SUM(received_qty), 0) FROM sto_items WHERE stock_transfer_order_id = COALESCE(NEW.stock_transfer_order_id, OLD.stock_transfer_order_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.stock_transfer_order_id, OLD.stock_transfer_order_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_sto_totals ON sto_items;
CREATE TRIGGER trg_update_sto_totals
AFTER INSERT OR UPDATE OR DELETE ON sto_items
FOR EACH ROW EXECUTE FUNCTION update_sto_totals();

-- Trigger to auto-update STO status based on received qty
CREATE OR REPLACE FUNCTION update_sto_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stock_transfer_orders
    SET
        status = CASE
            WHEN total_received_qty = 0 AND status NOT IN ('DRAFT', 'APPROVED', 'PICKING', 'PICKED', 'CANCELLED') THEN status
            WHEN total_received_qty >= total_requested_qty THEN 'RECEIVED'
            WHEN total_received_qty > 0 AND total_received_qty < total_requested_qty THEN 'IN_TRANSIT'
            ELSE status
        END,
        received_date = CASE
            WHEN total_received_qty >= total_requested_qty AND received_date IS NULL THEN NOW()
            ELSE received_date
        END,
        updated_at = NOW()
    WHERE id = NEW.id
    AND status NOT IN ('DRAFT', 'CANCELLED');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_sto_status ON stock_transfer_orders;
CREATE TRIGGER trg_update_sto_status
AFTER UPDATE OF total_received_qty ON stock_transfer_orders
FOR EACH ROW EXECUTE FUNCTION update_sto_status();

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

-- Pending STOs view
CREATE OR REPLACE VIEW v_pending_stos AS
SELECT
    s.id,
    s.sto_no,
    s.company_id,
    s.status,
    s.priority,
    s.source_location_id,
    sl.name as source_location_name,
    s.destination_location_id,
    dl.name as destination_location_name,
    s.required_by_date,
    s.total_items,
    s.total_requested_qty,
    s.total_shipped_qty,
    (s.total_requested_qty - s.total_shipped_qty) as pending_qty,
    s.created_at
FROM stock_transfer_orders s
LEFT JOIN "Location" sl ON s.source_location_id = sl.id
LEFT JOIN "Location" dl ON s.destination_location_id = dl.id
WHERE s.status IN ('DRAFT', 'APPROVED', 'PICKING', 'PICKED')
ORDER BY
    CASE s.priority
        WHEN 'URGENT' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'NORMAL' THEN 3
        ELSE 4
    END,
    s.required_by_date ASC NULLS LAST;

-- In-transit STOs view
CREATE OR REPLACE VIEW v_intransit_stos AS
SELECT
    s.id,
    s.sto_no,
    s.company_id,
    s.status,
    sl.name as source_location_name,
    dl.name as destination_location_name,
    s.carrier,
    s.tracking_number,
    s.vehicle_number,
    s.shipped_date,
    s.total_items,
    s.total_shipped_qty,
    s.total_received_qty,
    (s.total_shipped_qty - s.total_received_qty) as pending_receipt_qty
FROM stock_transfer_orders s
LEFT JOIN "Location" sl ON s.source_location_id = sl.id
LEFT JOIN "Location" dl ON s.destination_location_id = dl.id
WHERE s.status = 'IN_TRANSIT'
ORDER BY s.shipped_date DESC;

-- ============================================================================
-- 6. ADD REFERENCE TO GOODS RECEIPT
-- ============================================================================

-- Add foreign key from goods_receipts to stock_transfer_orders
-- (column already exists from Phase 1, just add the foreign key if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_gr_stock_transfer'
        AND table_name = 'GoodsReceipt'
    ) THEN
        ALTER TABLE "GoodsReceipt"
        ADD CONSTRAINT fk_gr_stock_transfer
        FOREIGN KEY ("stockTransferId") REFERENCES stock_transfer_orders(id);
    END IF;
EXCEPTION WHEN others THEN
    -- Ignore if column doesn't exist or constraint already exists
    NULL;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE stock_transfer_orders IS 'Inter-location stock transfer orders';
COMMENT ON TABLE sto_items IS 'Line items for stock transfer orders';
