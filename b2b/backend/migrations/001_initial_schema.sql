-- CJDQuick B2B Logistics Database Schema
-- Run this in Supabase SQL Editor for project: ngrjnhfxrmcclqxorjwl (Mumbai)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Company Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Company" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    "legalName" VARCHAR(255),
    gst VARCHAR(20),
    pan VARCHAR(20),
    logo TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    settings JSONB,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_code ON "Company"(code);

-- ============================================================================
-- User Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'OPERATOR',
    "isActive" BOOLEAN DEFAULT true,
    "companyId" UUID REFERENCES "Company"(id),
    "locationAccess" UUID[] DEFAULT '{}',
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_company ON "User"("companyId");

-- ============================================================================
-- Seed Data: Default Company and Admin User
-- ============================================================================

-- Create default company
INSERT INTO "Company" (id, code, name, "legalName", email, phone, "isActive")
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'B2B-MAIN',
    'CJDQuick B2B Logistics',
    'CJDQuick B2B Logistics Pvt Ltd',
    'admin@b2b-logistics.com',
    '+91-9876543210',
    true
) ON CONFLICT (code) DO NOTHING;

-- Create admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO "User" (id, email, password, name, phone, role, "isActive", "companyId")
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'admin@b2b-logistics.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGYS0EXKUm2',
    'B2B Admin',
    '+91-9876543210',
    'SUPER_ADMIN',
    true,
    'a0000000-0000-0000-0000-000000000001'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- Update Trigger for updatedAt
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_updated_at
    BEFORE UPDATE ON "Company"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Verify Setup
-- ============================================================================
SELECT 'Company count:' as info, count(*) FROM "Company";
SELECT 'User count:' as info, count(*) FROM "User";
SELECT 'Admin user:' as info, email, name, role FROM "User" WHERE role = 'SUPER_ADMIN';
