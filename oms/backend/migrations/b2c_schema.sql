-- =============================================================================
-- B2C CLIENT DATABASE SCHEMA MIGRATION
-- =============================================================================
-- This script creates all necessary tables for a B2C client deployment.
-- Run this in the Supabase SQL Editor for the B2C client's Supabase project.
--
-- Connection: postgresql://postgres.qfqztrmnvbdmejyclvvc:Aquapurite2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- COMPANY & ORGANIZATION TABLES
-- =============================================================================

-- Company (Tenant root)
CREATE TABLE IF NOT EXISTS "Company" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    "legalName" VARCHAR,
    gst VARCHAR,
    pan VARCHAR,
    cin VARCHAR,
    logo VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    address JSONB,
    settings JSONB,
    "defaultValuationMethod" VARCHAR DEFAULT 'FIFO',
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_code ON "Company"(code);

-- User
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR NOT NULL UNIQUE,
    password VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    phone VARCHAR,
    avatar VARCHAR,
    role VARCHAR DEFAULT 'OPERATOR',
    "isActive" BOOLEAN DEFAULT true,
    "companyId" UUID REFERENCES "Company"(id),
    "locationAccess" UUID[] DEFAULT '{}',
    "lastLoginAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_company ON "User"("companyId");

-- Location (Warehouse/Store)
CREATE TABLE IF NOT EXISTS "Location" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    address JSONB,
    "contactPerson" VARCHAR,
    "contactPhone" VARCHAR,
    "contactEmail" VARCHAR,
    gst VARCHAR,
    "isActive" BOOLEAN DEFAULT true,
    settings JSONB,
    "valuationMethod" VARCHAR,
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_company ON "Location"("companyId");
CREATE INDEX IF NOT EXISTS idx_location_code ON "Location"(code);

-- Zone (Warehouse zones)
CREATE TABLE IF NOT EXISTS "Zone" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    description VARCHAR,
    "temperatureType" VARCHAR,
    "minTemp" NUMERIC(10, 2),
    "maxTemp" NUMERIC(10, 2),
    priority INTEGER DEFAULT 100,
    "isActive" BOOLEAN DEFAULT true,
    "locationId" UUID NOT NULL REFERENCES "Location"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zone_location ON "Zone"("locationId");

-- Bin (Storage bins)
CREATE TABLE IF NOT EXISTS "Bin" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL,
    name VARCHAR,
    description VARCHAR,
    "binType" VARCHAR,
    capacity INTEGER,
    "maxWeight" NUMERIC(10, 2),
    "maxVolume" NUMERIC(10, 4),
    "maxUnits" INTEGER,
    "currentWeight" NUMERIC(10, 2) DEFAULT 0,
    "currentVolume" NUMERIC(10, 4) DEFAULT 0,
    "currentUnits" INTEGER DEFAULT 0,
    aisle VARCHAR,
    rack VARCHAR,
    level VARCHAR,
    position VARCHAR,
    "pickSequence" INTEGER DEFAULT 0,
    "isPickFace" BOOLEAN DEFAULT false,
    "isReserve" BOOLEAN DEFAULT false,
    "isStaging" BOOLEAN DEFAULT false,
    "isActive" BOOLEAN DEFAULT true,
    "zoneId" UUID NOT NULL REFERENCES "Zone"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bin_zone ON "Bin"("zoneId");
CREATE INDEX IF NOT EXISTS idx_bin_pick_sequence ON "Bin"("pickSequence");

-- =============================================================================
-- PRODUCT & INVENTORY TABLES
-- =============================================================================

-- SKU (Product master)
CREATE TABLE IF NOT EXISTS "SKU" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    category VARCHAR,
    "subCategory" VARCHAR,
    brand VARCHAR,
    hsn VARCHAR,
    weight NUMERIC(10, 3),
    length NUMERIC(10, 2),
    width NUMERIC(10, 2),
    height NUMERIC(10, 2),
    mrp NUMERIC(12, 2),
    "costPrice" NUMERIC(12, 2),
    "sellingPrice" NUMERIC(12, 2),
    "taxRate" NUMERIC(5, 2),
    "isSerialised" BOOLEAN DEFAULT false,
    "isBatchTracked" BOOLEAN DEFAULT false,
    "reorderLevel" INTEGER,
    "reorderQty" INTEGER,
    barcodes VARCHAR[] DEFAULT '{}',
    images VARCHAR[] DEFAULT '{}',
    attributes JSONB,
    "isActive" BOOLEAN DEFAULT true,
    "valuationMethod" VARCHAR,
    "isVariantParent" BOOLEAN DEFAULT false,
    "isVariant" BOOLEAN DEFAULT false,
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sku_code ON "SKU"(code);
CREATE INDEX IF NOT EXISTS idx_sku_name ON "SKU"(name);
CREATE INDEX IF NOT EXISTS idx_sku_company ON "SKU"("companyId");

-- Inventory
CREATE TABLE IF NOT EXISTS "Inventory" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quantity INTEGER DEFAULT 0,
    "reservedQty" INTEGER DEFAULT 0,
    "batchNo" VARCHAR,
    "lotNo" VARCHAR,
    "expiryDate" TIMESTAMP,
    "mfgDate" TIMESTAMP,
    mrp NUMERIC(12, 2),
    "costPrice" NUMERIC(12, 2),
    "serialNumbers" VARCHAR[] DEFAULT '{}',
    "valuationMethod" VARCHAR DEFAULT 'FIFO',
    "fifoSequence" INTEGER,
    "skuId" UUID NOT NULL REFERENCES "SKU"(id),
    "binId" UUID NOT NULL REFERENCES "Bin"(id),
    "locationId" UUID NOT NULL REFERENCES "Location"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON "Inventory"("skuId");
CREATE INDEX IF NOT EXISTS idx_inventory_bin ON "Inventory"("binId");
CREATE INDEX IF NOT EXISTS idx_inventory_location ON "Inventory"("locationId");
CREATE INDEX IF NOT EXISTS idx_inventory_fifo ON "Inventory"("fifoSequence");

-- =============================================================================
-- CUSTOMER TABLES
-- =============================================================================

-- CustomerGroup
CREATE TABLE IF NOT EXISTS "CustomerGroup" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    "discountPercent" NUMERIC(5, 2) DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_group_company ON "CustomerGroup"("companyId");

-- Customer
CREATE TABLE IF NOT EXISTS "Customer" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR,
    name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    type VARCHAR DEFAULT 'RETAIL',
    status VARCHAR DEFAULT 'ACTIVE',
    gst VARCHAR,
    pan VARCHAR,
    "billingAddress" JSONB,
    "shippingAddress" JSONB,
    "creditLimit" NUMERIC(12, 2) DEFAULT 0,
    "creditUsed" NUMERIC(12, 2) DEFAULT 0,
    "creditStatus" VARCHAR DEFAULT 'AVAILABLE',
    "paymentTermType" VARCHAR,
    "paymentTermDays" INTEGER,
    "isActive" BOOLEAN DEFAULT true,
    "groupId" UUID REFERENCES "CustomerGroup"(id),
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_company ON "Customer"("companyId");
CREATE INDEX IF NOT EXISTS idx_customer_email ON "Customer"(email);

-- =============================================================================
-- ORDER TABLES
-- =============================================================================

-- Order
CREATE TABLE IF NOT EXISTS "Order" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orderNo" VARCHAR NOT NULL UNIQUE,
    "externalOrderNo" VARCHAR,
    channel VARCHAR NOT NULL,
    "orderType" VARCHAR DEFAULT 'B2C',
    "paymentMode" VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'CREATED',
    "customerName" VARCHAR NOT NULL,
    "customerPhone" VARCHAR NOT NULL,
    "customerEmail" VARCHAR,
    "shippingAddress" JSONB NOT NULL,
    "billingAddress" JSONB,
    subtotal NUMERIC(12, 2) NOT NULL,
    "taxAmount" NUMERIC(12, 2) NOT NULL,
    "shippingCharges" NUMERIC(12, 2) DEFAULT 0,
    discount NUMERIC(12, 2) DEFAULT 0,
    "codCharges" NUMERIC(12, 2) DEFAULT 0,
    "totalAmount" NUMERIC(12, 2) NOT NULL,
    "orderDate" TIMESTAMP NOT NULL,
    "shipByDate" TIMESTAMP,
    "promisedDate" TIMESTAMP,
    priority INTEGER DEFAULT 0,
    tags VARCHAR[] DEFAULT '{}',
    remarks VARCHAR,
    "importId" UUID,
    "csvLineNumber" INTEGER,
    "dataSourceType" VARCHAR,
    "replacementForReturnId" UUID UNIQUE,
    "locationId" UUID NOT NULL REFERENCES "Location"(id),
    "customerId" UUID REFERENCES "Customer"(id),
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "paymentTermType" VARCHAR,
    "paymentTermDays" INTEGER,
    "creditDueDate" TIMESTAMP,
    "poNumber" VARCHAR,
    "gstInvoiceNo" VARCHAR,
    "gstInvoiceDate" TIMESTAMP,
    "eWayBillNo" VARCHAR,
    "irnNo" VARCHAR,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_no ON "Order"("orderNo");
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"(status);
CREATE INDEX IF NOT EXISTS idx_order_location ON "Order"("locationId");
CREATE INDEX IF NOT EXISTS idx_order_company ON "Order"("companyId");
CREATE INDEX IF NOT EXISTS idx_order_customer ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS idx_order_import ON "Order"("importId");

-- OrderItem
CREATE TABLE IF NOT EXISTS "OrderItem" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orderId" UUID NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"(id),
    "externalItemId" VARCHAR,
    quantity INTEGER DEFAULT 1,
    "allocatedQty" INTEGER DEFAULT 0,
    "pickedQty" INTEGER DEFAULT 0,
    "packedQty" INTEGER DEFAULT 0,
    "shippedQty" INTEGER DEFAULT 0,
    "unitPrice" NUMERIC(12, 2) NOT NULL,
    "taxAmount" NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0,
    "totalPrice" NUMERIC(12, 2) NOT NULL,
    status VARCHAR DEFAULT 'PENDING',
    "serialNumbers" VARCHAR[] DEFAULT '{}',
    "batchNo" VARCHAR,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_item_order ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS idx_order_item_sku ON "OrderItem"("skuId");

-- =============================================================================
-- TRANSPORTER & SHIPPING TABLES
-- =============================================================================

-- Transporter
CREATE TABLE IF NOT EXISTS "Transporter" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    logo VARCHAR,
    "apiEnabled" BOOLEAN DEFAULT false,
    "apiConfig" JSONB,
    "trackingUrlTemplate" VARCHAR,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transporter_code ON "Transporter"(code);

-- TransporterConfig
CREATE TABLE IF NOT EXISTS "TransporterConfig" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "companyId" UUID NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "transporterId" UUID NOT NULL REFERENCES "Transporter"(id) ON DELETE CASCADE,
    "isActive" BOOLEAN DEFAULT true,
    "accountCode" VARCHAR,
    credentials JSONB,
    priority INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", "transporterId")
);

CREATE INDEX IF NOT EXISTS idx_transporter_config_company ON "TransporterConfig"("companyId");

-- Manifest
CREATE TABLE IF NOT EXISTS "Manifest" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "manifestNo" VARCHAR NOT NULL UNIQUE,
    "transporterId" UUID NOT NULL REFERENCES "Transporter"(id),
    status VARCHAR DEFAULT 'OPEN',
    "vehicleNo" VARCHAR,
    "driverName" VARCHAR,
    "driverPhone" VARCHAR,
    "handoverImage" VARCHAR,
    "confirmedAt" TIMESTAMP,
    "confirmedBy" UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manifest_no ON "Manifest"("manifestNo");
CREATE INDEX IF NOT EXISTS idx_manifest_status ON "Manifest"(status);
CREATE INDEX IF NOT EXISTS idx_manifest_transporter ON "Manifest"("transporterId");

-- Delivery
CREATE TABLE IF NOT EXISTS "Delivery" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deliveryNo" VARCHAR NOT NULL UNIQUE,
    "orderId" UUID NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "transporterId" UUID REFERENCES "Transporter"(id),
    "manifestId" UUID REFERENCES "Manifest"(id),
    status VARCHAR DEFAULT 'PENDING',
    "awbNo" VARCHAR,
    "trackingUrl" VARCHAR,
    weight NUMERIC(10, 3),
    length NUMERIC(10, 2),
    width NUMERIC(10, 2),
    height NUMERIC(10, 2),
    "volumetricWeight" NUMERIC(10, 3),
    boxes INTEGER DEFAULT 1,
    "invoiceNo" VARCHAR,
    "invoiceDate" TIMESTAMP,
    "invoiceUrl" VARCHAR,
    "labelUrl" VARCHAR,
    "packDate" TIMESTAMP,
    "shipDate" TIMESTAMP,
    "shippedAt" TIMESTAMP,
    "deliveryDate" TIMESTAMP,
    "podImage" VARCHAR,
    "podSignature" VARCHAR,
    "podRemarks" VARCHAR,
    "receivedBy" VARCHAR,
    remarks VARCHAR,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_no ON "Delivery"("deliveryNo");
CREATE INDEX IF NOT EXISTS idx_delivery_order ON "Delivery"("orderId");
CREATE INDEX IF NOT EXISTS idx_delivery_company ON "Delivery"("companyId");
CREATE INDEX IF NOT EXISTS idx_delivery_status ON "Delivery"(status);
CREATE INDEX IF NOT EXISTS idx_delivery_awb ON "Delivery"("awbNo");
CREATE INDEX IF NOT EXISTS idx_delivery_manifest ON "Delivery"("manifestId");

-- =============================================================================
-- WAVE & PICKLIST TABLES
-- =============================================================================

-- Wave
CREATE TABLE IF NOT EXISTS "Wave" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "waveNo" VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    type VARCHAR DEFAULT 'BATCH_PICK',
    status VARCHAR DEFAULT 'DRAFT',
    "plannedDate" TIMESTAMP,
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "locationId" UUID NOT NULL REFERENCES "Location"(id),
    "assignedTo" UUID REFERENCES "User"(id),
    "createdBy" UUID REFERENCES "User"(id),
    notes VARCHAR,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wave_no ON "Wave"("waveNo");
CREATE INDEX IF NOT EXISTS idx_wave_status ON "Wave"(status);
CREATE INDEX IF NOT EXISTS idx_wave_location ON "Wave"("locationId");

-- WaveItem
CREATE TABLE IF NOT EXISTS "WaveItem" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "waveId" UUID NOT NULL REFERENCES "Wave"(id) ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"(id),
    "totalQty" INTEGER DEFAULT 0,
    "pickedQty" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wave_item_wave ON "WaveItem"("waveId");
CREATE INDEX IF NOT EXISTS idx_wave_item_sku ON "WaveItem"("skuId");

-- WaveOrder
CREATE TABLE IF NOT EXISTS "WaveOrder" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "waveId" UUID NOT NULL REFERENCES "Wave"(id) ON DELETE CASCADE,
    "orderId" UUID NOT NULL REFERENCES "Order"(id),
    sequence INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("waveId", "orderId")
);

CREATE INDEX IF NOT EXISTS idx_wave_order_wave ON "WaveOrder"("waveId");
CREATE INDEX IF NOT EXISTS idx_wave_order_order ON "WaveOrder"("orderId");

-- Picklist
CREATE TABLE IF NOT EXISTS "Picklist" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "picklistNo" VARCHAR NOT NULL UNIQUE,
    "waveId" UUID NOT NULL REFERENCES "Wave"(id),
    status VARCHAR DEFAULT 'PENDING',
    "assignedTo" UUID REFERENCES "User"(id),
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    notes VARCHAR,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_picklist_no ON "Picklist"("picklistNo");
CREATE INDEX IF NOT EXISTS idx_picklist_wave ON "Picklist"("waveId");
CREATE INDEX IF NOT EXISTS idx_picklist_status ON "Picklist"(status);

-- PicklistItem
CREATE TABLE IF NOT EXISTS "PicklistItem" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "picklistId" UUID NOT NULL REFERENCES "Picklist"(id) ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"(id),
    "binId" UUID NOT NULL REFERENCES "Bin"(id),
    "orderItemId" UUID REFERENCES "OrderItem"(id),
    "requiredQty" INTEGER NOT NULL,
    "pickedQty" INTEGER DEFAULT 0,
    sequence INTEGER DEFAULT 0,
    "batchNo" VARCHAR,
    "serialNumbers" VARCHAR[] DEFAULT '{}',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_picklist_item_picklist ON "PicklistItem"("picklistId");
CREATE INDEX IF NOT EXISTS idx_picklist_item_sku ON "PicklistItem"("skuId");
CREATE INDEX IF NOT EXISTS idx_picklist_item_bin ON "PicklistItem"("binId");

-- =============================================================================
-- INVENTORY ALLOCATION TABLE
-- =============================================================================

-- InventoryAllocation
CREATE TABLE IF NOT EXISTS "InventoryAllocation" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orderItemId" UUID NOT NULL REFERENCES "OrderItem"(id) ON DELETE CASCADE,
    "inventoryId" UUID NOT NULL REFERENCES "Inventory"(id),
    "skuId" UUID NOT NULL REFERENCES "SKU"(id),
    "binId" UUID NOT NULL REFERENCES "Bin"(id),
    "locationId" UUID NOT NULL REFERENCES "Location"(id),
    quantity INTEGER NOT NULL,
    "allocatedQty" INTEGER NOT NULL,
    "pickedQty" INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'ALLOCATED',
    "batchNo" VARCHAR,
    "serialNumbers" VARCHAR[] DEFAULT '{}',
    "allocatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "pickedAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allocation_order_item ON "InventoryAllocation"("orderItemId");
CREATE INDEX IF NOT EXISTS idx_allocation_inventory ON "InventoryAllocation"("inventoryId");
CREATE INDEX IF NOT EXISTS idx_allocation_sku ON "InventoryAllocation"("skuId");
CREATE INDEX IF NOT EXISTS idx_allocation_status ON "InventoryAllocation"(status);

-- =============================================================================
-- BRAND TABLE (for multi-brand support)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Brand" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    logo VARCHAR,
    description VARCHAR,
    "isActive" BOOLEAN DEFAULT true,
    "companyId" UUID NOT NULL REFERENCES "Company"(id),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand_company ON "Brand"("companyId");
CREATE INDEX IF NOT EXISTS idx_brand_code ON "Brand"(code);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables (individual statements to avoid quoting issues)
DROP TRIGGER IF EXISTS update_company_updated_at ON "Company";
CREATE TRIGGER update_company_updated_at BEFORE UPDATE ON "Company" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_updated_at ON "User";
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_location_updated_at ON "Location";
CREATE TRIGGER update_location_updated_at BEFORE UPDATE ON "Location" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_zone_updated_at ON "Zone";
CREATE TRIGGER update_zone_updated_at BEFORE UPDATE ON "Zone" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bin_updated_at ON "Bin";
CREATE TRIGGER update_bin_updated_at BEFORE UPDATE ON "Bin" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sku_updated_at ON "SKU";
CREATE TRIGGER update_sku_updated_at BEFORE UPDATE ON "SKU" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON "Inventory";
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON "Inventory" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customergroup_updated_at ON "CustomerGroup";
CREATE TRIGGER update_customergroup_updated_at BEFORE UPDATE ON "CustomerGroup" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_updated_at ON "Customer";
CREATE TRIGGER update_customer_updated_at BEFORE UPDATE ON "Customer" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_updated_at ON "Order";
CREATE TRIGGER update_order_updated_at BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orderitem_updated_at ON "OrderItem";
CREATE TRIGGER update_orderitem_updated_at BEFORE UPDATE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transporter_updated_at ON "Transporter";
CREATE TRIGGER update_transporter_updated_at BEFORE UPDATE ON "Transporter" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transporterconfig_updated_at ON "TransporterConfig";
CREATE TRIGGER update_transporterconfig_updated_at BEFORE UPDATE ON "TransporterConfig" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_manifest_updated_at ON "Manifest";
CREATE TRIGGER update_manifest_updated_at BEFORE UPDATE ON "Manifest" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_updated_at ON "Delivery";
CREATE TRIGGER update_delivery_updated_at BEFORE UPDATE ON "Delivery" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wave_updated_at ON "Wave";
CREATE TRIGGER update_wave_updated_at BEFORE UPDATE ON "Wave" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_waveitem_updated_at ON "WaveItem";
CREATE TRIGGER update_waveitem_updated_at BEFORE UPDATE ON "WaveItem" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_waveorder_updated_at ON "WaveOrder";
CREATE TRIGGER update_waveorder_updated_at BEFORE UPDATE ON "WaveOrder" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_picklist_updated_at ON "Picklist";
CREATE TRIGGER update_picklist_updated_at BEFORE UPDATE ON "Picklist" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_picklistitem_updated_at ON "PicklistItem";
CREATE TRIGGER update_picklistitem_updated_at BEFORE UPDATE ON "PicklistItem" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventoryallocation_updated_at ON "InventoryAllocation";
CREATE TRIGGER update_inventoryallocation_updated_at BEFORE UPDATE ON "InventoryAllocation" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_updated_at ON "Brand";
CREATE TRIGGER update_brand_updated_at BEFORE UPDATE ON "Brand" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DATA: Default Company and Admin User
-- =============================================================================

-- Insert default company
INSERT INTO "Company" (id, code, name, email, "isActive")
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'B2C-CLIENT',
    'B2C Client Company',
    'admin@b2c-client.com',
    true
) ON CONFLICT (code) DO NOTHING;

-- Insert admin user (password: admin123 - bcrypt hash)
INSERT INTO "User" (id, email, password, name, role, "companyId", "isActive")
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'admin@b2c-client.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4AoKJGj0tmGXfYRq',
    'B2C Admin',
    'ADMIN',
    'a0000000-0000-0000-0000-000000000001',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert default location
INSERT INTO "Location" (id, code, name, type, "companyId", "isActive")
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'WH-MAIN',
    'Main Warehouse',
    'WAREHOUSE',
    'a0000000-0000-0000-0000-000000000001',
    true
) ON CONFLICT DO NOTHING;

-- Insert default zone
INSERT INTO "Zone" (id, code, name, type, "locationId", "isActive")
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'ZONE-SALEABLE',
    'Saleable Zone',
    'SALEABLE',
    'c0000000-0000-0000-0000-000000000001',
    true
) ON CONFLICT DO NOTHING;

-- Insert default bin
INSERT INTO "Bin" (id, code, name, "binType", "zoneId", "isActive", "isPickFace")
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'BIN-A01',
    'Default Bin A01',
    'PICK_FACE',
    'd0000000-0000-0000-0000-000000000001',
    true,
    true
) ON CONFLICT DO NOTHING;

-- Insert default transporters
INSERT INTO "Transporter" (id, code, name, type, "isActive")
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'DELHIVERY', 'Delhivery', 'COURIER', true),
    ('f0000000-0000-0000-0000-000000000002', 'SELF-SHIP', 'Self Ship', 'SELF', true)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Uncomment these to verify the schema was created correctly:

-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT * FROM "Company";
-- SELECT * FROM "User";
-- SELECT * FROM "Location";
-- SELECT * FROM "Zone";
-- SELECT * FROM "Bin";
-- SELECT * FROM "Transporter";

-- =============================================================================
-- END OF SCHEMA MIGRATION
-- =============================================================================
