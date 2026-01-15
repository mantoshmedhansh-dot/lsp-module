-- CJDQuick OMS - PostgreSQL Initialization Script
-- This script runs when the container is first created

-- Enable UUID extension (for future migration if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create database if not exists (handled by POSTGRES_DB env var)
-- This script adds extensions and performance optimizations

-- Analyze function for better query planning
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Log that initialization is complete
DO $$
BEGIN
    RAISE NOTICE 'CJDQuick OMS Database initialized successfully';
    RAISE NOTICE 'PostgreSQL version: %', version();
END $$;
