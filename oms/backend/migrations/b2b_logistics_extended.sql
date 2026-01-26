-- Migration: B2B & Logistics Extended Tables
-- Date: 2026-01-26
-- Description: Add missing tables for Rate Cards, Price Lists, Quotations, etc.

-- ============================================================================
-- RATE CARD TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "RateCard" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "type" VARCHAR(50) DEFAULT 'BOTH',
    "status" VARCHAR(50) DEFAULT 'DRAFT',
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validTo" TIMESTAMPTZ,
    "baseWeight" NUMERIC(10,3) DEFAULT 0.5,
    "baseRate" NUMERIC(10,2) NOT NULL,
    "additionalWeightRate" NUMERIC(10,2) NOT NULL,
    "codPercent" NUMERIC(5,2),
    "codMinCharge" NUMERIC(10,2),
    "fuelSurchargePercent" NUMERIC(5,2),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ratecard_transporter" ON "RateCard"("transporterId");
CREATE INDEX IF NOT EXISTS "idx_ratecard_company" ON "RateCard"("companyId");
CREATE INDEX IF NOT EXISTS "idx_ratecard_status" ON "RateCard"("status");

CREATE TABLE IF NOT EXISTS "RateCardSlab" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rateCardId" UUID NOT NULL REFERENCES "RateCard"("id") ON DELETE CASCADE,
    "fromWeight" NUMERIC(10,3) NOT NULL,
    "toWeight" NUMERIC(10,3) NOT NULL,
    "zoneCode" VARCHAR(50),
    "rate" NUMERIC(10,2) NOT NULL,
    "additionalRate" NUMERIC(10,2),
    "minCharge" NUMERIC(10,2),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ratecardslab_ratecard" ON "RateCardSlab"("rateCardId");

-- ============================================================================
-- SHIPPING RULE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ShippingRule" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "type" VARCHAR(50) DEFAULT 'ALLOCATION',
    "priority" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "conditions" JSONB DEFAULT '[]',
    "actions" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shippingrule_company" ON "ShippingRule"("companyId");
CREATE INDEX IF NOT EXISTS "idx_shippingrule_active" ON "ShippingRule"("isActive");

CREATE TABLE IF NOT EXISTS "ShippingRuleCondition" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "shippingRuleId" UUID NOT NULL REFERENCES "ShippingRule"("id") ON DELETE CASCADE,
    "field" VARCHAR(100) NOT NULL,
    "operator" VARCHAR(50) NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shippingrulecondition_rule" ON "ShippingRuleCondition"("shippingRuleId");

-- ============================================================================
-- SERVICE PINCODE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ServicePincode" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE,
    "pincode" VARCHAR(10) NOT NULL,
    "city" VARCHAR(255),
    "state" VARCHAR(255),
    "zoneCode" VARCHAR(50),
    "isServiceable" BOOLEAN DEFAULT true,
    "codAvailable" BOOLEAN DEFAULT true,
    "prepaidAvailable" BOOLEAN DEFAULT true,
    "reverseAvailable" BOOLEAN DEFAULT false,
    "estimatedDays" INTEGER,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("transporterId", "pincode")
);

CREATE INDEX IF NOT EXISTS "idx_servicepincode_transporter" ON "ServicePincode"("transporterId");
CREATE INDEX IF NOT EXISTS "idx_servicepincode_pincode" ON "ServicePincode"("pincode");

-- ============================================================================
-- AWB TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AWB" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "awbNo" VARCHAR(100) NOT NULL UNIQUE,
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE,
    "isUsed" BOOLEAN DEFAULT false,
    "usedAt" TIMESTAMPTZ,
    "usedFor" VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_awb_transporter" ON "AWB"("transporterId");
CREATE INDEX IF NOT EXISTS "idx_awb_used" ON "AWB"("isUsed");

-- ============================================================================
-- PRICE LIST TABLES (B2B)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "PriceList" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "type" VARCHAR(50) DEFAULT 'STANDARD',
    "isActive" BOOLEAN DEFAULT true,
    "validFrom" TIMESTAMPTZ,
    "validTo" TIMESTAMPTZ,
    "discountPercent" NUMERIC(5,2),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_pricelist_company" ON "PriceList"("companyId");
CREATE INDEX IF NOT EXISTS "idx_pricelist_active" ON "PriceList"("isActive");

CREATE TABLE IF NOT EXISTS "PriceListItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "priceListId" UUID NOT NULL REFERENCES "PriceList"("id") ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"("id") ON DELETE CASCADE,
    "price" NUMERIC(10,2) NOT NULL,
    "minQuantity" INTEGER DEFAULT 1,
    "maxQuantity" INTEGER,
    "discountPercent" NUMERIC(5,2),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_pricelistitem_pricelist" ON "PriceListItem"("priceListId");
CREATE INDEX IF NOT EXISTS "idx_pricelistitem_sku" ON "PriceListItem"("skuId");

-- ============================================================================
-- QUOTATION TABLES (B2B)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Quotation" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quotationNo" VARCHAR(100) NOT NULL UNIQUE,
    "customerId" UUID NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "status" VARCHAR(50) DEFAULT 'DRAFT',
    "validUntil" TIMESTAMPTZ,
    "subtotal" NUMERIC(12,2) DEFAULT 0,
    "taxAmount" NUMERIC(12,2) DEFAULT 0,
    "discount" NUMERIC(12,2) DEFAULT 0,
    "totalAmount" NUMERIC(12,2) DEFAULT 0,
    "paymentTermType" VARCHAR(50),
    "paymentTermDays" INTEGER,
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "remarks" TEXT,
    "approvedById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_quotation_customer" ON "Quotation"("customerId");
CREATE INDEX IF NOT EXISTS "idx_quotation_company" ON "Quotation"("companyId");
CREATE INDEX IF NOT EXISTS "idx_quotation_status" ON "Quotation"("status");

CREATE TABLE IF NOT EXISTS "QuotationItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quotationId" UUID NOT NULL REFERENCES "Quotation"("id") ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"("id") ON DELETE CASCADE,
    "quantity" INTEGER DEFAULT 1,
    "unitPrice" NUMERIC(10,2) NOT NULL,
    "taxRate" NUMERIC(5,2),
    "taxAmount" NUMERIC(10,2) DEFAULT 0,
    "discount" NUMERIC(10,2) DEFAULT 0,
    "totalPrice" NUMERIC(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_quotationitem_quotation" ON "QuotationItem"("quotationId");
CREATE INDEX IF NOT EXISTS "idx_quotationitem_sku" ON "QuotationItem"("skuId");

-- ============================================================================
-- B2B CREDIT TRANSACTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "B2BCreditTransaction" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "transactionNo" VARCHAR(100) NOT NULL UNIQUE,
    "type" VARCHAR(50) NOT NULL,
    "customerId" UUID NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
    "amount" NUMERIC(12,2) NOT NULL,
    "balanceBefore" NUMERIC(12,2) NOT NULL,
    "balanceAfter" NUMERIC(12,2) NOT NULL,
    "orderId" UUID REFERENCES "Order"("id") ON DELETE SET NULL,
    "quotationId" UUID REFERENCES "Quotation"("id") ON DELETE SET NULL,
    "paymentRef" VARCHAR(255),
    "invoiceNo" VARCHAR(100),
    "dueDate" TIMESTAMPTZ,
    "remarks" TEXT,
    "createdById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_b2bcredittransaction_customer" ON "B2BCreditTransaction"("customerId");
CREATE INDEX IF NOT EXISTS "idx_b2bcredittransaction_type" ON "B2BCreditTransaction"("type");

-- ============================================================================
-- ADD creditBalance TO CUSTOMER IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Customer' AND column_name = 'creditBalance'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "creditBalance" NUMERIC(12,2) DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- RETURN & NDR TABLES (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Return" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "returnNo" VARCHAR(100) NOT NULL UNIQUE,
    "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "type" VARCHAR(50) DEFAULT 'CUSTOMER',
    "status" VARCHAR(50) DEFAULT 'REQUESTED',
    "reason" VARCHAR(255),
    "remarks" TEXT,
    "initiatedAt" TIMESTAMPTZ DEFAULT NOW(),
    "receivedAt" TIMESTAMPTZ,
    "processedAt" TIMESTAMPTZ,
    "refundAmount" NUMERIC(12,2),
    "refundStatus" VARCHAR(50),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_return_order" ON "Return"("orderId");
CREATE INDEX IF NOT EXISTS "idx_return_company" ON "Return"("companyId");
CREATE INDEX IF NOT EXISTS "idx_return_status" ON "Return"("status");

CREATE TABLE IF NOT EXISTS "ReturnItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "returnId" UUID NOT NULL REFERENCES "Return"("id") ON DELETE CASCADE,
    "orderItemId" UUID NOT NULL REFERENCES "OrderItem"("id") ON DELETE CASCADE,
    "quantity" INTEGER DEFAULT 1,
    "reason" VARCHAR(255),
    "condition" VARCHAR(50),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_returnitem_return" ON "ReturnItem"("returnId");

CREATE TABLE IF NOT EXISTS "NDR" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "deliveryId" UUID NOT NULL REFERENCES "Delivery"("id") ON DELETE CASCADE,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "status" VARCHAR(50) DEFAULT 'OPEN',
    "reason" VARCHAR(100),
    "subReason" VARCHAR(255),
    "priority" VARCHAR(50) DEFAULT 'NORMAL',
    "attemptCount" INTEGER DEFAULT 1,
    "lastAttemptAt" TIMESTAMPTZ,
    "nextAttemptAt" TIMESTAMPTZ,
    "customerFeedback" TEXT,
    "resolution" VARCHAR(100),
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ndr_delivery" ON "NDR"("deliveryId");
CREATE INDEX IF NOT EXISTS "idx_ndr_company" ON "NDR"("companyId");
CREATE INDEX IF NOT EXISTS "idx_ndr_status" ON "NDR"("status");

-- ============================================================================
-- INBOUND TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Inbound" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "inboundNo" VARCHAR(100) NOT NULL UNIQUE,
    "locationId" UUID NOT NULL REFERENCES "Location"("id") ON DELETE CASCADE,
    "type" VARCHAR(50) DEFAULT 'PURCHASE_ORDER',
    "status" VARCHAR(50) DEFAULT 'DRAFT',
    "sourceRef" VARCHAR(255),
    "expectedDate" TIMESTAMPTZ,
    "receivedDate" TIMESTAMPTZ,
    "totalItems" INTEGER DEFAULT 0,
    "receivedItems" INTEGER DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_inbound_location" ON "Inbound"("locationId");
CREATE INDEX IF NOT EXISTS "idx_inbound_status" ON "Inbound"("status");

CREATE TABLE IF NOT EXISTS "InboundItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "inboundId" UUID NOT NULL REFERENCES "Inbound"("id") ON DELETE CASCADE,
    "skuId" UUID NOT NULL REFERENCES "SKU"("id") ON DELETE CASCADE,
    "expectedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER DEFAULT 0,
    "damagedQty" INTEGER DEFAULT 0,
    "batchNo" VARCHAR(100),
    "lotNo" VARCHAR(100),
    "expiryDate" DATE,
    "mfgDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_inbounditem_inbound" ON "InboundItem"("inboundId");
CREATE INDEX IF NOT EXISTS "idx_inbounditem_sku" ON "InboundItem"("skuId");

-- ============================================================================
-- QC TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "QCTemplate" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "type" VARCHAR(50) DEFAULT 'INBOUND',
    "isActive" BOOLEAN DEFAULT true,
    "parameters" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_qctemplate_company" ON "QCTemplate"("companyId");

CREATE TABLE IF NOT EXISTS "QCExecution" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL REFERENCES "QCTemplate"("id") ON DELETE CASCADE,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "result" VARCHAR(50),
    "executedById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "executedAt" TIMESTAMPTZ,
    "remarks" TEXT,
    "results" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_qcexecution_template" ON "QCExecution"("templateId");
CREATE INDEX IF NOT EXISTS "idx_qcexecution_entity" ON "QCExecution"("entityType", "entityId");

-- ============================================================================
-- CHANNEL CONFIG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ChannelConfig" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "channel" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "credentials" JSONB DEFAULT '{}',
    "settings" JSONB DEFAULT '{}',
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_channelconfig_company" ON "ChannelConfig"("companyId");
CREATE INDEX IF NOT EXISTS "idx_channelconfig_channel" ON "ChannelConfig"("channel");

-- ============================================================================
-- FINANCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "CODRemittance" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "remittanceNo" VARCHAR(100) NOT NULL UNIQUE,
    "companyId" UUID REFERENCES "Company"("id") ON DELETE SET NULL,
    "transporterId" UUID NOT NULL REFERENCES "Transporter"("id") ON DELETE CASCADE,
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "totalAmount" NUMERIC(12,2) NOT NULL,
    "remittedAmount" NUMERIC(12,2) DEFAULT 0,
    "deductions" NUMERIC(12,2) DEFAULT 0,
    "remittanceDate" TIMESTAMPTZ,
    "utrNo" VARCHAR(100),
    "remarks" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_codremittance_company" ON "CODRemittance"("companyId");
CREATE INDEX IF NOT EXISTS "idx_codremittance_transporter" ON "CODRemittance"("transporterId");

-- Done!
SELECT 'Migration completed: B2B & Logistics Extended Tables created' as status;
