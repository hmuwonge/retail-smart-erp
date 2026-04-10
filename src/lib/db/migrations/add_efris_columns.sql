-- EFRIS Integration Migration
-- This migration adds EFRIS-related columns and feature flags

-- ==========================================
-- 1. Add EFRIS feature flag to pricing tiers
-- ==========================================

-- Enable EFRIS for enterprise tier only
UPDATE pricing_tiers 
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{efris}',
  'true'
) 
WHERE name = 'enterprise';

-- Disable EFRIS for all other tiers
UPDATE pricing_tiers 
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{efris}',
  'false'
) 
WHERE name != 'enterprise';

-- ==========================================
-- 2. Verify/Add EFRIS columns to tenants table
-- ==========================================

ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS efrisEnabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS efrisTin TEXT,
  ADD COLUMN IF NOT EXISTS efrisToken TEXT;

-- ==========================================
-- 3. Verify/Add EFRIS columns to items table
-- ==========================================

ALTER TABLE items 
  ADD COLUMN IF NOT EXISTS efrisItemCode TEXT,
  ADD COLUMN IF NOT EXISTS efrisTaxForm TEXT,
  ADD COLUMN IF NOT EXISTS efrisTaxRule TEXT;

-- ==========================================
-- 4. Verify/Add EFRIS columns to sales table
-- ==========================================

ALTER TABLE sales 
  ADD COLUMN IF NOT EXISTS efrisInvoiceNo TEXT,
  ADD COLUMN IF NOT EXISTS efrisAntifakeCode TEXT,
  ADD COLUMN IF NOT EXISTS efrisQrCode TEXT,
  ADD COLUMN IF NOT EXISTS efrisStatus TEXT,
  ADD COLUMN IF NOT EXISTS efrisError TEXT,
  ADD COLUMN IF NOT EXISTS efrisSubmittedAt TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS efrisRetryCount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS efrisLastRetryAt TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- 5. Add indexes for EFRIS queries
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_sales_efris_status ON sales(efrisStatus);
CREATE INDEX IF NOT EXISTS idx_items_efris_item_code ON items(efrisItemCode);
CREATE INDEX IF NOT EXISTS idx_tenants_efris_enabled ON tenants(efrisEnabled) WHERE efrisEnabled = TRUE;

-- ==========================================
-- 6. Add comments for documentation
-- ==========================================

COMMENT ON COLUMN tenants.efrisEnabled IS 'Whether EFRIS integration is enabled for this tenant';
COMMENT ON COLUMN tenants.efrisTin IS 'Tax Identification Number for EFRIS (format: UG + 10 digits)';
COMMENT ON COLUMN tenants.efrisToken IS 'EFRIS API authentication token';

COMMENT ON COLUMN items.efrisItemCode IS 'EFRIS product code for this item';
COMMENT ON COLUMN items.efrisTaxForm IS 'EFRIS tax form code (e.g., ''101'')';
COMMENT ON COLUMN items.efrisTaxRule IS 'EFRIS tax rule (e.g., ''STANDARD'')';

COMMENT ON COLUMN sales.efrisInvoiceNo IS 'EFRIS fiscal invoice number';
COMMENT ON COLUMN sales.efrisAntifakeCode IS 'EFRIS antifake code for verification';
COMMENT ON COLUMN sales.efrisQrCode IS 'EFRIS QR code data';
COMMENT ON COLUMN sales.efrisStatus IS 'EFRIS submission status: pending, success, failed';
COMMENT ON COLUMN sales.efrisError IS 'EFRIS submission error message';
COMMENT ON COLUMN sales.efrisSubmittedAt IS 'Timestamp when sale was submitted to EFRIS';
COMMENT ON COLUMN sales.efrisRetryCount IS 'Number of retry attempts for EFRIS submission';
COMMENT ON COLUMN sales.efrisLastRetryAt IS 'Timestamp of last EFRIS retry attempt';
