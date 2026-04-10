-- ERP Migration Feature Tables
-- Adds support for platform connections and migration job tracking

-- ==========================================
-- 1. Platform Connections (OAuth tokens)
-- ==========================================

CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'quickbooks', 'freshbooks', 'zoho_books', 'xero'
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'connected', 'expired', 'error'
  
  -- OAuth tokens (encrypted at rest)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  
  -- Platform-specific identifiers
  realm_id VARCHAR(100),        -- QuickBooks company ID
  account_id VARCHAR(100),      -- FreshBooks account ID
  organization_id VARCHAR(100), -- Zoho organization ID
  tenant_xero_id VARCHAR(100),  -- Xero tenant ID
  
  -- Connection metadata
  company_name VARCHAR(255),
  connected_at TIMESTAMP,
  last_synced_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_tenant ON platform_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_connections_tenant_platform ON platform_connections(tenant_id, platform);

-- ==========================================
-- 2. Migration Jobs
-- ==========================================

CREATE TABLE IF NOT EXISTS migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  connection_id UUID REFERENCES platform_connections(id),
  source_platform VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, connecting, mapping, validating, running, completed, failed, rolled_back
  
  -- What to migrate
  entities JSONB NOT NULL DEFAULT '[]', -- ['customers', 'items', 'invoices', ...]
  
  -- Progress tracking
  stats JSONB DEFAULT '{}',
  current_entity VARCHAR(50),
  current_progress INTEGER DEFAULT 0,
  
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migrations_tenant ON migrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migrations_status ON migrations(status);

-- ==========================================
-- 3. Migration Entity Progress
-- ==========================================

CREATE TABLE IF NOT EXISTS migration_entity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID REFERENCES migrations(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, fetching, mapping, importing, completed, failed, skipped
  total_count INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_log JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_migration_entity_progress_migration ON migration_entity_progress(migration_id);

-- ==========================================
-- 4. Migration Error Log
-- ==========================================

CREATE TABLE IF NOT EXISTS migration_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID REFERENCES migrations(id) ON DELETE CASCADE,
  entity_type VARCHAR(50),
  source_row INTEGER,
  source_id VARCHAR(100),
  field_name VARCHAR(100),
  source_value TEXT,
  error_message TEXT,
  error_code VARCHAR(50),
  can_retry BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_errors_migration ON migration_errors(migration_id);
CREATE INDEX IF NOT EXISTS idx_migration_errors_entity ON migration_errors(entity_type);

-- ==========================================
-- 5. Migration Field Mappings (saved configs)
-- ==========================================

CREATE TABLE IF NOT EXISTS migration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  field_map JSONB NOT NULL, -- { source_field: target_field }
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES accounts(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_field_mappings_platform ON migration_field_mappings(source_platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_migration_field_mappings_default ON migration_field_mappings(source_platform, entity_type) WHERE is_default = true;

-- ==========================================
-- 6. Comments
-- ==========================================

COMMENT ON TABLE platform_connections IS 'Stores OAuth connections to external ERP/accounting platforms';
COMMENT ON TABLE migrations IS 'Tracks migration jobs from external platforms';
COMMENT ON TABLE migration_entity_progress IS 'Granular progress tracking per entity type during migration';
COMMENT ON TABLE migration_errors IS 'Detailed error log for migration failures';
COMMENT ON TABLE migration_field_mappings IS 'Saved field mapping configurations for re-use';
