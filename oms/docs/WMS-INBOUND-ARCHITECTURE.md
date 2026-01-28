# Holistic WMS Inbound Architecture

**Version:** 2.0
**Date:** 2026-01-28
**Author:** Claude Code
**Status:** PROPOSAL

---

## 1. EXECUTIVE SUMMARY

This document proposes a comprehensive inbound architecture for a standalone Warehouse Management System (WMS) that can operate:
- As an integrated OMS+WMS for internal operations
- As a 3PL WMS provider for external clients
- With or without source system integration (ERP, POS, etc.)

### Key Design Principles

1. **Source-Agnostic Inbound** - Receive stock regardless of whether PO exists in system
2. **Unified Document Model** - Single GRN structure for all inbound types
3. **External Reference Support** - Track client's external PO/ASN/RMA numbers
4. **Bulk Operations** - Support CSV/Excel upload for POs, ASNs, and GRNs
5. **Multi-Stock Category** - Route stock to appropriate zones based on quality
6. **FIFO/FEFO Ready** - Built-in sequence tracking for proper stock rotation
7. **Audit Trail** - Complete traceability from source to bin

---

## 2. INBOUND SOURCE TYPES

### 2.1 Complete Inbound Source Matrix

| Source Type | Code | Description | Requires PO? | External Reference |
|-------------|------|-------------|--------------|-------------------|
| **Purchase Receipt** | `PURCHASE` | Stock from vendor/supplier | Optional | External PO Number |
| **Sales Return** | `RETURN_SALES` | Customer returns (unused) | No | Order Number, RMA |
| **RTO Receipt** | `RETURN_RTO` | Return to Origin (delivery failed) | No | AWB, Order Number |
| **Damage Return** | `RETURN_DAMAGE` | Damaged stock from customer | No | Order, Claim Number |
| **Stock Transfer** | `TRANSFER_IN` | From another warehouse/location | No | STO Number |
| **Production Receipt** | `PRODUCTION` | From manufacturing/assembly | No | Work Order |
| **Opening Stock** | `OPENING` | Initial stock load | No | N/A |
| **Quality Upgrade** | `QC_UPGRADE` | Stock upgraded after QC | No | Original GRN |
| **Loan Return** | `LOAN_RETURN` | Return of loaned stock | No | Loan Reference |
| **Sample Return** | `SAMPLE_RETURN` | Marketing samples returned | No | Sample Reference |

### 2.2 Movement Type Codes (SAP-Aligned)

```
INBOUND MOVEMENTS (100-199)
├── 101 - Goods Receipt from Purchase Order
├── 102 - GR Reversal
├── 103 - Goods Receipt - Free (No PO)
├── 104 - Return from Customer
├── 105 - Return to Origin (RTO)
├── 106 - Stock Transfer Receipt
├── 107 - Production Receipt
├── 108 - Opening Stock
├── 109 - Quality Upgrade

OUTBOUND MOVEMENTS (200-299)
├── 201 - Goods Issue for Sales
├── 202 - GI Reversal
├── 203 - Stock Transfer Issue
├── 204 - Sample Issue
├── 205 - Scrapping/Disposal

INTERNAL MOVEMENTS (300-399)
├── 301 - Bin to Bin Transfer
├── 302 - Zone to Zone Transfer
├── 303 - Quality Downgrade
├── 304 - Quality Upgrade

ADJUSTMENTS (500-599)
├── 501 - Positive Adjustment
├── 502 - Negative Adjustment
├── 503 - Cycle Count Adjustment
```

---

## 3. PROPOSED DATABASE SCHEMA

### 3.1 Core Entities Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INBOUND DOCUMENT FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐               │
│  │   External   │ ───► │     ASN      │ ───► │   Goods      │               │
│  │  Purchase    │      │  (Advance    │      │   Receipt    │               │
│  │   Order      │      │  Shipping    │      │   Note       │               │
│  │              │      │  Notice)     │      │   (GRN)      │               │
│  └──────────────┘      └──────────────┘      └──────────────┘               │
│         │                     │                     │                        │
│         │                     │                     ▼                        │
│         │                     │              ┌──────────────┐               │
│         │                     │              │   GRN Item   │               │
│         │                     │              │   + QC       │               │
│         │                     │              └──────────────┘               │
│         │                     │                     │                        │
│         ▼                     ▼                     ▼                        │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                     INVENTORY (per SKU + Bin)                     │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │       │
│  │  │  Saleable   │  │ Quarantine  │  │   Damaged   │  ...          │       │
│  │  │   Zone      │  │   Zone      │  │    Zone     │               │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 New/Enhanced Tables

#### 3.2.1 `external_purchase_orders` (NEW)

For clients who don't manage POs in our system but need to reference them.

```sql
CREATE TABLE external_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    location_id UUID NOT NULL REFERENCES locations(id),

    -- External References (Client's System)
    external_po_number VARCHAR(100) NOT NULL,  -- Client's PO number
    external_vendor_code VARCHAR(100),          -- Client's vendor code
    external_vendor_name VARCHAR(255),          -- Vendor name for display

    -- Status
    status VARCHAR(50) DEFAULT 'OPEN',  -- OPEN, PARTIALLY_RECEIVED, CLOSED, CANCELLED

    -- Dates
    po_date TIMESTAMPTZ,
    expected_delivery_date TIMESTAMPTZ,

    -- Totals
    total_expected_qty INT DEFAULT 0,
    total_received_qty INT DEFAULT 0,
    total_lines INT DEFAULT 0,

    -- Source
    upload_batch_id UUID,  -- For bulk uploads
    source VARCHAR(50) DEFAULT 'MANUAL',  -- MANUAL, UPLOAD, API

    -- Metadata
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique per company
    UNIQUE(company_id, external_po_number)
);

CREATE INDEX idx_ext_po_company ON external_purchase_orders(company_id);
CREATE INDEX idx_ext_po_status ON external_purchase_orders(status);
CREATE INDEX idx_ext_po_location ON external_purchase_orders(location_id);
```

#### 3.2.2 `external_po_items` (NEW)

```sql
CREATE TABLE external_po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_po_id UUID NOT NULL REFERENCES external_purchase_orders(id) ON DELETE CASCADE,

    -- SKU Reference
    sku_id UUID REFERENCES skus(id),  -- Can be NULL if SKU not in system
    external_sku_code VARCHAR(100) NOT NULL,  -- Client's SKU code
    external_sku_name VARCHAR(255),

    -- Quantities
    ordered_qty INT NOT NULL,
    received_qty INT DEFAULT 0,
    pending_qty INT GENERATED ALWAYS AS (ordered_qty - received_qty) STORED,

    -- Pricing (optional)
    unit_price NUMERIC(12,2),

    -- Status
    status VARCHAR(50) DEFAULT 'OPEN',  -- OPEN, PARTIALLY_RECEIVED, CLOSED

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ext_po_item_po ON external_po_items(external_po_id);
```

#### 3.2.3 `advance_shipping_notices` (NEW)

```sql
CREATE TABLE advance_shipping_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    location_id UUID NOT NULL REFERENCES locations(id),

    -- ASN Identification
    asn_no VARCHAR(50) UNIQUE NOT NULL,
    external_asn_no VARCHAR(100),  -- Client/Vendor ASN reference

    -- References
    external_po_id UUID REFERENCES external_purchase_orders(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),  -- Internal PO
    vendor_id UUID REFERENCES vendors(id),
    external_vendor_code VARCHAR(100),

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
    expected_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,

    -- Quantities
    total_expected_qty INT DEFAULT 0,
    total_received_qty INT DEFAULT 0,
    total_cartons INT,
    total_pallets INT,
    total_weight NUMERIC(10,3),

    -- Source
    source VARCHAR(50) DEFAULT 'MANUAL',  -- MANUAL, UPLOAD, API, EDI
    upload_batch_id UUID,

    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asn_company ON advance_shipping_notices(company_id);
CREATE INDEX idx_asn_status ON advance_shipping_notices(status);
CREATE INDEX idx_asn_expected ON advance_shipping_notices(expected_arrival);
```

#### 3.2.4 `asn_items` (NEW)

```sql
CREATE TABLE asn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asn_id UUID NOT NULL REFERENCES advance_shipping_notices(id) ON DELETE CASCADE,

    -- SKU
    sku_id UUID REFERENCES skus(id),
    external_sku_code VARCHAR(100),

    -- Quantities
    expected_qty INT NOT NULL,
    received_qty INT DEFAULT 0,

    -- Batch/Lot Info
    batch_no VARCHAR(100),
    lot_no VARCHAR(100),
    expiry_date DATE,
    mfg_date DATE,

    -- Packing
    cartons INT,
    units_per_carton INT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asn_item_asn ON asn_items(asn_id);
```

#### 3.2.5 Enhanced `goods_receipts` Table

```sql
-- Add columns to existing goods_receipts table
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS inbound_source VARCHAR(50) DEFAULT 'PURCHASE';
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS movement_type VARCHAR(10) DEFAULT '101';

-- External References
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS external_po_id UUID REFERENCES external_purchase_orders(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS asn_id UUID REFERENCES advance_shipping_notices(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS return_id UUID REFERENCES returns(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS stock_transfer_id UUID;  -- Future STO reference

-- External Reference Numbers (for display/search)
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS external_reference_type VARCHAR(50);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS external_reference_no VARCHAR(100);

-- Vehicle/Delivery Details
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS gate_entry_no VARCHAR(50);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS gate_entry_time TIMESTAMPTZ;

-- Quality Summary
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS total_accepted_qty INT DEFAULT 0;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS total_rejected_qty INT DEFAULT 0;

-- Source
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'MANUAL';
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS upload_batch_id UUID;

-- Create enum type for inbound source
DO $$ BEGIN
    CREATE TYPE inbound_source_type AS ENUM (
        'PURCHASE', 'RETURN_SALES', 'RETURN_RTO', 'RETURN_DAMAGE',
        'TRANSFER_IN', 'PRODUCTION', 'OPENING', 'QC_UPGRADE',
        'LOAN_RETURN', 'SAMPLE_RETURN', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX idx_gr_inbound_source ON goods_receipts(inbound_source);
CREATE INDEX idx_gr_external_ref ON goods_receipts(external_reference_no);
```

#### 3.2.6 `stock_transfer_orders` (NEW)

```sql
CREATE TABLE stock_transfer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),

    -- STO Identification
    sto_no VARCHAR(50) UNIQUE NOT NULL,

    -- Source & Destination
    source_location_id UUID NOT NULL REFERENCES locations(id),
    destination_location_id UUID NOT NULL REFERENCES locations(id),

    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT',
    -- DRAFT, APPROVED, PICKING, PICKED, IN_TRANSIT, RECEIVED, CANCELLED

    -- Dates
    requested_date TIMESTAMPTZ DEFAULT NOW(),
    required_by_date TIMESTAMPTZ,
    shipped_date TIMESTAMPTZ,
    received_date TIMESTAMPTZ,

    -- Shipping
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    vehicle_number VARCHAR(50),

    -- Quantities
    total_items INT DEFAULT 0,
    total_qty INT DEFAULT 0,

    -- Related Documents
    source_grn_id UUID,  -- GRN at source (for issue)
    destination_grn_id UUID REFERENCES goods_receipts(id),  -- GRN at destination

    -- Requestor
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),

    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sto_company ON stock_transfer_orders(company_id);
CREATE INDEX idx_sto_status ON stock_transfer_orders(status);
CREATE INDEX idx_sto_source ON stock_transfer_orders(source_location_id);
CREATE INDEX idx_sto_dest ON stock_transfer_orders(destination_location_id);
```

#### 3.2.7 `sto_items` (NEW)

```sql
CREATE TABLE sto_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transfer_order_id UUID NOT NULL REFERENCES stock_transfer_orders(id) ON DELETE CASCADE,

    -- SKU
    sku_id UUID NOT NULL REFERENCES skus(id),

    -- Quantities
    requested_qty INT NOT NULL,
    shipped_qty INT DEFAULT 0,
    received_qty INT DEFAULT 0,
    damaged_qty INT DEFAULT 0,

    -- Source Bin (picked from)
    source_bin_id UUID REFERENCES bins(id),

    -- Batch/Lot (for traceability)
    batch_no VARCHAR(100),
    lot_no VARCHAR(100),

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    -- PENDING, PICKED, SHIPPED, RECEIVED

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sto_item_sto ON sto_items(stock_transfer_order_id);
```

#### 3.2.8 `upload_batches` (NEW) - For Bulk Operations

```sql
CREATE TABLE upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),

    -- Upload Info
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    upload_type VARCHAR(50) NOT NULL,
    -- Types: EXTERNAL_PO, ASN, GRN, STOCK_ADJUSTMENT, OPENING_STOCK

    -- File Info
    file_name VARCHAR(255),
    file_size INT,
    total_rows INT,
    success_rows INT DEFAULT 0,
    error_rows INT DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    -- PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED

    -- Error Log
    error_log JSONB,  -- Array of {row, errors[]}

    -- Uploaded By
    uploaded_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_upload_batch_company ON upload_batches(company_id);
CREATE INDEX idx_upload_batch_type ON upload_batches(upload_type);
```

#### 3.2.9 Enhanced `inventory` for Zone-based Stock

```sql
-- Add stock category to inventory for multi-zone stock tracking
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock_category VARCHAR(50) DEFAULT 'SALEABLE';
-- Categories: SALEABLE, QUARANTINE, DAMAGED, BLOCKED, RESERVED, EXPIRED

-- Add source tracking
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);  -- Inbound source type
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_document_id UUID;  -- GRN ID
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_document_no VARCHAR(50);  -- GRN number

CREATE INDEX idx_inventory_category ON inventory(stock_category);
```

---

## 4. INBOUND WORKFLOWS

### 4.1 Standard Purchase Receipt (With PO in System)

```
┌─────────────────┐
│ Create/Upload   │
│  Purchase Order │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vendor Ships   │
│  (Optional ASN) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create GRN     │
│  against PO     │
│  (Auto-populate │
│   expected qty) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Receiving      │
│  - Scan/Count   │
│  - Record Batch │
│  - Initial QC   │
└────────┬────────┘
         │
    ┌────┴────┐
    │  QC     │
    │Required?│
    └────┬────┘
         │
    ┌────┴────┐
   Yes        No
    │         │
    ▼         │
┌─────────┐   │
│Full QC  │   │
│Execution│   │
└────┬────┘   │
     │        │
     ▼        │
┌─────────────────┐
│  Post GRN       │◄──┘
│  - Create Inv   │
│  - Route to     │
│    Zone/Bin     │
│  - FIFO Seq     │
└─────────────────┘
```

### 4.2 External Client PO Receipt (3PL Model)

```
┌─────────────────────┐
│ Client Uploads PO   │
│ via CSV/API         │
│ (External PO Table) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Match SKUs          │
│ - Auto-map by code  │
│ - Flag unmapped     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ASN Received        │
│ (Optional)          │
│ - Links to Ext PO   │
│ - Expected dates    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Create GRN          │
│ - Link to Ext PO    │
│ - Copy expected qty │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Standard Receiving  │
│ & Posting Flow      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Update Ext PO       │
│ - Mark received qty │
│ - Update status     │
└─────────────────────┘
```

### 4.3 Return Receipt (Sales Return / RTO)

```
┌─────────────────────┐
│ Return Initiated    │
│ (Order System)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Return Record       │
│ Created             │
│ - Type: RTO/RETURN  │
│ - Order Reference   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Stock Arrives       │
│ at Warehouse        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Create Return GRN   │
│ - inbound_source:   │
│   RETURN_RTO or     │
│   RETURN_SALES      │
│ - movement_type:    │
│   104 or 105        │
│ - Link return_id    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Return QC           │
│ (Mandatory)         │
│ - Grade: A/B/C/D    │
│ - Action Decision   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │  QC Result  │
    └──────┬──────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐
│Grade ││Grade ││Grade │
│ A    ││ B/C  ││ D    │
│      ││      ││      │
│Route ││Route ││Route │
│SALEABLE│QUARANTINE│DAMAGE│
└──────┘└──────┘└──────┘
```

### 4.4 Stock Transfer Receipt

```
┌─────────────────────┐
│ STO Created at      │
│ Source Location     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Picking at Source   │
│ (Creates GI Doc)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ In-Transit          │
│ - Vehicle tracking  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Arrival at          │
│ Destination         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Create GRN          │
│ - inbound_source:   │
│   TRANSFER_IN       │
│ - movement_type: 106│
│ - Link STO          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Verify Quantities   │
│ - Match with STO    │
│ - Note discrepancies│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Post GRN            │
│ Update STO Status   │
└─────────────────────┘
```

---

## 5. STOCK CATEGORIZATION & ZONE ROUTING

### 5.1 Stock Categories

| Category | Code | Description | Sellable? | Typical Zone |
|----------|------|-------------|-----------|--------------|
| Saleable | `SALEABLE` | Good condition, ready to sell | Yes | SALEABLE |
| Quarantine | `QUARANTINE` | Pending QC or investigation | No | QUARANTINE |
| Damaged | `DAMAGED` | Physical damage, not sellable | No | DAMAGED |
| Blocked | `BLOCKED` | Hold for any reason | No | Any |
| Reserved | `RESERVED` | Reserved for specific order | Yes | SALEABLE |
| Expired | `EXPIRED` | Past expiry date | No | QUARANTINE |
| Near-Expiry | `NEAR_EXPIRY` | Within X days of expiry | Yes* | SALEABLE |

### 5.2 Automatic Zone Routing Rules

```
GRN Posted → Item QC Result → Zone Routing

QC Result Mapping:
┌─────────────┬──────────────────┬──────────────┐
│ QC Status   │ Stock Category   │ Target Zone  │
├─────────────┼──────────────────┼──────────────┤
│ PASSED      │ SALEABLE         │ SALEABLE     │
│ CONDITIONAL │ SALEABLE         │ SALEABLE     │
│ PARTIAL     │ QUARANTINE       │ QUARANTINE   │
│ FAILED      │ DAMAGED/RETURN   │ DAMAGED      │
│ PENDING     │ QUARANTINE       │ QUARANTINE   │
└─────────────┴──────────────────┴──────────────┘

Expiry-Based Routing:
┌─────────────────────┬──────────────────┐
│ Days to Expiry      │ Stock Category   │
├─────────────────────┼──────────────────┤
│ > 90 days           │ SALEABLE         │
│ 30-90 days          │ NEAR_EXPIRY      │
│ < 30 days           │ NEAR_EXPIRY*     │
│ Expired             │ EXPIRED          │
└─────────────────────┴──────────────────┘
* Configurable per company
```

---

## 6. BULK UPLOAD SPECIFICATIONS

### 6.1 External PO Upload Template

```csv
external_po_number,external_vendor_code,external_vendor_name,po_date,expected_delivery_date,external_sku_code,external_sku_name,ordered_qty,unit_price
PO-2026-001,V001,ABC Suppliers,2026-01-28,2026-02-05,SKU-A001,Blue T-Shirt L,100,250.00
PO-2026-001,V001,ABC Suppliers,2026-01-28,2026-02-05,SKU-A002,Blue T-Shirt XL,150,250.00
PO-2026-002,V002,XYZ Trading,2026-01-28,2026-02-10,SKU-B001,Black Jeans 32,200,850.00
```

### 6.2 ASN Upload Template

```csv
external_asn_no,external_po_number,carrier,tracking_number,expected_arrival,external_sku_code,expected_qty,batch_no,expiry_date,cartons
ASN-001,PO-2026-001,BlueDart,BD123456,2026-02-05,SKU-A001,100,BATCH-001,2027-01-01,10
ASN-001,PO-2026-001,BlueDart,BD123456,2026-02-05,SKU-A002,150,BATCH-001,2027-01-01,15
```

### 6.3 Opening Stock Upload Template

```csv
location_code,sku_code,bin_code,quantity,batch_no,lot_no,expiry_date,mfg_date,cost_price,mrp
WH-001,SKU-A001,BIN-A-01-01,500,BATCH-001,,2027-06-01,2026-01-01,200.00,299.00
WH-001,SKU-A002,BIN-A-01-02,300,BATCH-002,LOT-001,2027-03-01,2025-09-01,200.00,299.00
```

### 6.4 Upload Processing Flow

```
1. File Upload → upload_batches record created
2. Parse & Validate Headers
3. For each row:
   a. Validate required fields
   b. Map external codes to internal IDs (SKU, Location, Bin)
   c. Create/update records
   d. Track success/error
4. Update batch status
5. Return summary + error details
```

---

## 7. API ENDPOINTS

### 7.1 External Purchase Orders

```
GET    /api/v1/external-pos                 # List with filters
POST   /api/v1/external-pos                 # Create single
POST   /api/v1/external-pos/upload          # Bulk upload CSV
GET    /api/v1/external-pos/{id}            # Get with items
PATCH  /api/v1/external-pos/{id}            # Update
DELETE /api/v1/external-pos/{id}            # Delete (if no GRN)
GET    /api/v1/external-pos/{id}/grns       # List GRNs against this PO
```

### 7.2 Advance Shipping Notices

```
GET    /api/v1/asn                          # List with filters
POST   /api/v1/asn                          # Create
POST   /api/v1/asn/upload                   # Bulk upload
GET    /api/v1/asn/{id}                     # Get with items
PATCH  /api/v1/asn/{id}                     # Update
POST   /api/v1/asn/{id}/mark-arrived        # Update status to ARRIVED
DELETE /api/v1/asn/{id}                     # Delete
```

### 7.3 Enhanced Goods Receipts

```
# Existing endpoints remain
# New endpoints:
POST   /api/v1/goods-receipts/from-external-po/{external_po_id}  # Create from ext PO
POST   /api/v1/goods-receipts/from-asn/{asn_id}                  # Create from ASN
POST   /api/v1/goods-receipts/from-return/{return_id}            # Create from return
POST   /api/v1/goods-receipts/from-sto/{sto_id}                  # Create from STO
POST   /api/v1/goods-receipts/upload                             # Bulk upload
```

### 7.4 Stock Transfer Orders

```
GET    /api/v1/stock-transfers              # List
POST   /api/v1/stock-transfers              # Create
GET    /api/v1/stock-transfers/{id}         # Get with items
PATCH  /api/v1/stock-transfers/{id}         # Update
POST   /api/v1/stock-transfers/{id}/approve # Approve
POST   /api/v1/stock-transfers/{id}/pick    # Mark picking started
POST   /api/v1/stock-transfers/{id}/ship    # Mark shipped
POST   /api/v1/stock-transfers/{id}/receive # Create receiving GRN
DELETE /api/v1/stock-transfers/{id}         # Cancel
```

### 7.5 Upload Batches

```
GET    /api/v1/upload-batches               # List uploads
GET    /api/v1/upload-batches/{id}          # Get with errors
POST   /api/v1/upload-batches/{id}/retry    # Retry failed rows
GET    /api/v1/upload-batches/templates/{type}  # Download template
```

---

## 8. FRONTEND STRUCTURE

### 8.1 Enhanced Inbound Module

```
/inbound/
├── page.tsx                      # Dashboard with pending ASNs, GRNs
├── purchase-orders/
│   ├── page.tsx                  # Internal POs (existing)
│   └── external/
│       ├── page.tsx              # External PO list
│       ├── upload/page.tsx       # Bulk upload
│       └── [id]/page.tsx         # External PO detail
├── asn/
│   ├── page.tsx                  # ASN list (enhanced)
│   ├── new/page.tsx              # Create ASN
│   ├── upload/page.tsx           # Bulk upload ASN
│   └── [id]/page.tsx             # ASN detail
├── goods-receipt/
│   ├── page.tsx                  # GRN list (existing, enhanced)
│   ├── new/page.tsx              # Create GRN (enhanced with source selection)
│   ├── upload/page.tsx           # Bulk upload GRN/Opening stock
│   └── [id]/page.tsx             # GRN detail (existing)
├── stock-transfer/
│   ├── page.tsx                  # STO list
│   ├── new/page.tsx              # Create STO
│   └── [id]/page.tsx             # STO detail
├── receiving/                     # Active receiving station
├── putaway/                       # Putaway tasks
└── qc/                           # Inbound QC

/returns/
├── page.tsx                      # Returns list (existing)
├── receive/                      # Return receiving
│   ├── page.tsx                  # Pending returns to receive
│   └── [id]/page.tsx             # Receive specific return
├── qc/                           # Return QC (existing)
└── restock/                      # Restock approved returns
```

---

## 9. IMPLEMENTATION PHASES

### Phase 1: Core External PO & ASN (Week 1-2)
- [ ] Create `external_purchase_orders` table
- [ ] Create `external_po_items` table
- [ ] Create `advance_shipping_notices` table
- [ ] Create `asn_items` table
- [ ] Build CRUD APIs for External PO
- [ ] Build CRUD APIs for ASN
- [ ] Build basic upload functionality
- [ ] Create frontend pages

### Phase 2: Enhanced GRN Flow (Week 2-3)
- [ ] Enhance `goods_receipts` table
- [ ] Add inbound source types
- [ ] Create GRN from External PO
- [ ] Create GRN from ASN
- [ ] Update receiving workflow
- [ ] Zone-based stock routing

### Phase 3: Stock Transfers (Week 3-4)
- [ ] Create `stock_transfer_orders` table
- [ ] Create `sto_items` table
- [ ] Build STO workflow APIs
- [ ] Integrate with GRN for receiving
- [ ] Create frontend pages

### Phase 4: Return Integration (Week 4)
- [ ] Link Returns to GRN flow
- [ ] Return receiving workflow
- [ ] QC-based zone routing
- [ ] Restock flow

### Phase 5: Bulk Operations & Polish (Week 5)
- [ ] Complete upload templates
- [ ] Error handling improvements
- [ ] Dashboard widgets
- [ ] Reports

---

## 10. MIGRATION STRATEGY

### Step 1: Add New Tables (Non-Breaking)
```sql
-- Run all CREATE TABLE statements
-- No existing data affected
```

### Step 2: Enhance Existing Tables
```sql
-- Add new columns with defaults
-- Existing records get default values
ALTER TABLE goods_receipts ADD COLUMN inbound_source VARCHAR(50) DEFAULT 'PURCHASE';
```

### Step 3: Data Migration (Optional)
```sql
-- Update existing GRNs with source based on references
UPDATE goods_receipts
SET inbound_source = 'PURCHASE',
    movement_type = '101'
WHERE purchase_order_id IS NOT NULL;

UPDATE goods_receipts
SET inbound_source = 'RETURN_RTO',
    movement_type = '105'
WHERE return_id IS NOT NULL;
```

---

## 11. CONCLUSION

This architecture provides:

1. **Complete Inbound Coverage** - All source types supported
2. **External Client Ready** - Bulk upload, external references
3. **3PL Capable** - Works without client's ERP integration
4. **Audit Trail** - Full traceability
5. **Multi-Zone Stock** - Quality-based routing
6. **Scalable** - Phase-wise implementation
7. **Backward Compatible** - Existing flows unchanged

The design follows SAP-inspired movement types while remaining simple enough for standalone WMS operation. External clients can:
- Upload their POs without system integration
- Track ASNs and expected arrivals
- Receive stock with full batch tracking
- Get visibility into received quantities

---

*Document prepared by Claude Code - 2026-01-28*
