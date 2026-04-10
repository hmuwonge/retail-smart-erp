# ERP Migration Feature — Direct API Integration Plan

## Overview

Add a seamless migration feature that allows clients to **connect directly** to their existing ERP/accounting platform (QuickBooks, FreshBooks, Zoho Books, Xero) via OAuth/API keys, automatically fetching and mapping data into Retail Smart ERP. No manual exports, no CSV uploads — just authenticate and migrate.

### How Akaunting Does It
Akaunting uses OAuth2 to connect to QuickBooks Online, fetches data via their REST APIs, maps fields automatically, and imports everything in the background. We'll build the same experience, but better.

---

## Architecture: Direct API Migration

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "Connect to QuickBooks"  →  OAuth Popup  →  Authenticated│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Our Backend Server                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Migration Engine                                         │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ QB API Client│  │ FB API Client│  │ Zoho API Client │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  │         │                │                    │           │  │
│  │  ┌──────▼────────────────▼────────────────────▼────────┐  │  │
│  │  │          Unified Data Fetcher                       │  │  │
│  │  │  (Fetches customers, items, invoices, etc.)         │  │  │
│  │  └──────────────────────┬──────────────────────────────┘  │  │
│  │                         │                                  │  │
│  │  ┌──────────────────────▼──────────────────────────────┐  │  │
│  │  │          Data Mapper & Transformer                  │  │  │
│  │  │  (Maps source schema → our schema)                  │  │  │
│  │  └──────────────────────┬──────────────────────────────┘  │  │
│  │                         │                                  │  │
│  │  ┌──────────────────────▼──────────────────────────────┐  │  │
│  │  │          Validation & Conflict Detection            │  │  │
│  │  └──────────────────────┬──────────────────────────────┘  │  │
│  │                         │                                  │  │
│  │  ┌──────────────────────▼──────────────────────────────┐  │  │
│  │  │          Batch Importer (Transaction-wrapped)       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Our Database                               │
│  customers | items | sales | suppliers | chart_of_accounts ...  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Platform Support Matrix

| Platform | Auth Method | API Base URL | Priority | Complexity |
|----------|-------------|--------------|----------|------------|
| **QuickBooks Online** | OAuth 2.0 | `https://quickbooks.api.intuit.com/v3` | P0 | High |
| **FreshBooks** | OAuth 2.0 | `https://api.freshbooks.com` | P1 | Medium |
| **Zoho Books** | OAuth 2.0 | `https://www.zohoapis.com/books/v3` | P1 | Medium |
| **Xero** | OAuth 2.0 (PKCE) | `https://api.xero.com/api.xro/2.0` | P2 | Medium |
| **CSV/Excel (Generic)** | File Upload | N/A | P0 | Low |

---

## Platform Integration Details

### 1. QuickBooks Online

**Auth Method:** OAuth 2.0  
**API Base URL:** `https://quickbooks.api.intuit.com/v3/company/{realmId}`  
**Rate Limits:** 100 requests/minute per company  

**Supported Endpoints:**

| Data Type | QB API Endpoint | Our Target |
|-----------|----------------|------------|
| Customers | `/query?query=SELECT * FROM Customer` | `customers` |
| Vendors | `/query?query=SELECT * FROM Vendor` | `suppliers` |
| Items | `/query?query=SELECT * FROM Item` | `items` |
| Invoices | `/query?query=SELECT * FROM Invoice` | `sales` |
| Bills | `/query?query=SELECT * FROM Bill` | `purchases` |
| Accounts | `/query?query=SELECT * FROM Account` | `chart_of_accounts` |
| Payments | `/query?query=SELECT * FROM Payment` | `payments` |
| Estimates | `/query?query=SELECT * FROM Estimate` | `estimates` |
| Tax Codes | `/query?query=SELECT * FROM TaxCode` | `tax_templates` |
| Classes | `/query?query=SELECT * FROM Class` | `categories` |
| Departments | `/query?query=SELECT * FROM Department` | `warehouses` |

**Data Fetching Strategy:**
```typescript
// Paginated fetch with STARTPOSITION / MAXRESULTS
async function fetchAllCustomers(realmId: string, oauthToken: string) {
  let startPosition = 1
  const maxResults = 1000
  let allCustomers = []

  while (true) {
    const query = `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qbApi.get(`/query`, {
      params: { query },
      headers: { Authorization: `Bearer ${oauthToken}` }
    })

    allCustomers.push(...response.QueryResponse.Customer)

    if (response.QueryResponse.maxReturned < maxResults) break
    startPosition += maxResults
  }

  return allCustomers
}
```

**Field Mapping (QuickBooks → Us):**
```typescript
const quickbooksCustomerMapping = {
  'DisplayName': 'name',
  'PrimaryEmailAddr.Address': 'email',
  'PrimaryPhone.FreeFormNumber': 'phone',
  'MobilePhone.FreeFormNumber': 'mobilePhone',
  'BillAddr.Line1': 'address',
  'BillAddr.City': 'city',
  'BillAddr.Country': 'country',
  'Balance': 'openingBalance',
  'Notes': 'notes',
}
```

---

### 2. FreshBooks

**Auth Method:** OAuth 2.0  
**API Base URL:** `https://api.freshbooks.com`  
**Rate Limits:** 400 requests/minute  

**Supported Endpoints:**

| Data Type | FB API Endpoint | Our Target |
|-----------|----------------|------------|
| Clients | `/accounting/clients/clients?businessid={accountId}` | `customers` |
| Items | `/accounting/items/items?businessid={accountId}` | `items` |
| Invoices | `/accounting/invoices/invoices?businessid={accountId}` | `sales` |
| Expenses | `/accounting/expenses/expenses?businessid={accountId}` | `purchases` |
| Taxes | `/accounting/taxes?businessid={accountId}` | `tax_templates` |
| Projects | `/accounting/projects/projects?businessid={accountId}` | `work_orders` |

**FreshBooks Specifics:**
- Uses `businessid` (accountId) in all requests
- Date format: `YYYY-MM-DD`
- Currency handled per-business

---

### 3. Zoho Books

**Auth Method:** OAuth 2.0  
**API Base URL:** `https://www.zohoapis.com/books/v3`  
**Rate Limits:** 100 requests/3 minutes per organization  

**Supported Endpoints:**

| Data Type | Zoho API Endpoint | Our Target |
|-----------|------------------|------------|
| Contacts | `/contacts?organization_id={orgId}` | `customers` + `suppliers` |
| Items | `/items?organization_id={orgId}` | `items` |
| Invoices | `/invoices?organization_id={orgId}` | `sales` |
| Bills | `/bills?organization_id={orgId}` | `purchases` |
| Accounts | `/chartofaccounts?organization_id={orgId}` | `chart_of_accounts` |
| Tax Groups | `/tax/groups?organization_id={orgId}` | `tax_templates` |

**Zoho Specifics:**
- Contacts can be both customer and vendor (`contact_type` field)
- Uses `organization_id` in all requests
- Pagination via `page` and `per_page` params

---

### 4. Xero

**Auth Method:** OAuth 2.0 (PKCE)  
**API Base URL:** `https://api.xero.com/api.xro/2.0`  
**Rate Limits:** 60 requests/minute  

**Supported Endpoints:**

| Data Type | Xero API Endpoint | Our Target |
|-----------|------------------|------------|
| Contacts | `/Contacts?contactStatuses=ACTIVE` | `customers` + `suppliers` |
| Items | `/Items` | `items` |
| Invoices | `/Invoices?statuses=AUTHORISED` | `sales` |
| Accounts | `/Accounts` | `chart_of_accounts` |
| Tax Rates | `/TaxRates` | `tax_templates` |

---

## Database Schema Additions

```sql
-- OAuth connection storage
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'quickbooks', 'freshbooks', 'zoho_books', 'xero'
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  
  -- OAuth tokens (encrypted)
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

-- Migration jobs
CREATE TABLE migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  connection_id UUID REFERENCES platform_connections(id),
  source_platform VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- What to migrate
  entities JSONB NOT NULL, -- ['customers', 'items', 'invoices', ...]
  
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

-- Migration entity progress
CREATE TABLE migration_entity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID REFERENCES migrations(id),
  entity_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_count INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_log JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Migration error log (detailed errors for review)
CREATE TABLE migration_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID REFERENCES migrations(id),
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

-- Migration field mappings (saved configurations)
CREATE TABLE migration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  field_map JSONB NOT NULL, -- { source_field: target_field }
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES accounts(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Migration Wizard UI (Direct Connection)

### Step 1: Choose Source Platform

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Where are you migrating from?                              │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  📘      │ │  🟢      │ │  🔵      │ │  🟣      │       │
│  │  Quick   │ │  Fresh   │ │  Zoho    │ │  Xero    │       │
│  │  Books   │ │  Books   │ │  Books   │ │          │       │
│  │          │ │          │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  Or import from a CSV/Excel file →                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Connect via OAuth

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Connect to QuickBooks Online                               │
│                                                             │
│  Click below to securely connect your QuickBooks account.   │
│  We'll never store your password.                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │   [ 🔗 Connect to QuickBooks ]                        │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  🔒 Secure OAuth 2.0 connection                            │
│  📖 We only request read access                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Select Data to Migrate

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Select Data to Migrate                                     │
│                                                             │
│  Connected to: MyCompany QB (QuickBooks Online)             │
│                                                             │
│  ✅ Customers (1,247 found)                                 │
│  ✅ Items/Products (834 found)                              │
│  ✅ Invoices (3,456 found)                                  │
│  ✅ Suppliers/Vendors (156 found)                           │
│  ✅ Chart of Accounts (42 found)                            │
│  ✅ Payments (5,678 found)                                  │
│  ✅ Tax Rates (8 found)                                     │
│  ○ Estimates (skip)                                         │
│  ○ Work Orders (skip)                                       │
│                                                             │
│  [Continue]                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Review & Confirm

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Review & Confirm Migration                                 │
│                                                             │
│  We'll import:                                              │
│  • 1,247 customers → your Customers                         │
│  • 834 items → your Items                                   │
│  • 3,456 invoices → your Sales                              │
│  • 156 vendors → your Suppliers                             │
│  • 42 accounts → your Chart of Accounts                     │
│  • 5,678 payments → your Payments                           │
│                                                             │
│  ⚠️  Duplicate Detection:                                   │
│     23 customers may already exist in your system           │
│     [Review Duplicates]                                     │
│                                                             │
│  📊 Estimated time: ~5 minutes                              │
│                                                             │
│  [Start Migration]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 5: Live Migration Progress

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Migration in Progress...                                   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░ 67%           │
│                                                             │
│  ✅ Customers        1,247 / 1,247                          │
│  ✅ Items            834 / 834                              │
│  🔄 Invoices         2,312 / 3,456                          │
│  ░░ Suppliers        0 / 156                                │
│  ░░ Chart of Accounts 0 / 42                                │
│  ░░ Payments         0 / 5,678                              │
│                                                             │
│  Estimated time remaining: 2 minutes                        │
│                                                             │
│  [Pause Migration]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 6: Migration Complete

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Migration Complete! 🎉                                     │
│                                                             │
│  Successfully imported:                                     │
│  ✅ 11,413 records                                          │
│  ⚠️  23 duplicates skipped                                  │
│  ❌  5 errors (view report)                                 │
│                                                             │
│  Summary by Entity:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Entity        │ Source │ Imported │ Skipped │ Errors│  │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Customers     │ 1,247  │ 1,247    │ 0       │ 0     │  │
│  │  Items         │ 834    │ 834      │ 0       │ 0     │  │
│  │  Invoices      │ 3,456  │ 3,451    │ 0       │ 5     │  │
│  │  Suppliers     │ 156    │ 156      │ 0       │ 0     │  │
│  │  Payments      │ 5,678  │ 5,678    │ 0       │ 0     │  │
│  │  Chart of Acc. │ 42     │ 42       │ 0       │ 0     │  │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Go to Dashboard]  [View Migration Report]  [Download CSV] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Conflict Resolution UI

```
┌─────────────────────────────────────────────────────────────┐
│  Resolve Duplicates (23 found)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  John Doe — Matched by Email                                │
│  ┌─────────────────┬───────────────────────────────────────┐│
│  │  From QuickBooks│  In Our System                        ││
│  ├─────────────────┼───────────────────────────────────────┤│
│  │  j@oldco.com    │  john@newco.com                       ││
│  │  555-001        │  555-002                              ││
│  │  Balance: $500  │  Balance: $0                          ││
│  └─────────────────┴───────────────────────────────────────┘│
│                                                             │
│  ○ Skip this record                                         │
│  ○ Overwrite existing with source data                      │
│  ● Merge (combine both records)                             │
│  ○ Keep existing, skip source                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Apply to All Similar]  [Skip All]  [Continue]             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: OAuth Infrastructure & QuickBooks Integration (P0)

**Goal:** Connect to QuickBooks Online and fetch all data types.

#### 1.1 OAuth App Registration
- Register OAuth apps with QuickBooks, FreshBooks, Zoho, Xero
- Store `client_id` and `client_secret` in environment variables
- Configure redirect URIs for each platform

#### 1.2 OAuth Connection Flow
```
User clicks "Connect to QuickBooks"
  → Redirect to QB OAuth consent screen
  → User authorizes
  → QB redirects to our callback with `code`
  → Backend exchanges `code` for `access_token` + `refresh_token`
  → Store tokens (encrypted) in `platform_connections`
  → Redirect user back to migration wizard
```

**API Endpoints:**
```
GET  /api/migration/connect/:platform     → Redirect to OAuth consent
GET  /api/migration/callback/:platform    → Handle OAuth callback
POST /api/migration/disconnect/:platform  → Revoke tokens
GET  /api/migration/connection/status     → Check connection status
```

#### 1.3 QuickBooks Data Fetcher
```typescript
// src/lib/migration/providers/quickbooks.ts

export class QuickBooksProvider {
  private realmId: string
  private accessToken: string

  async fetchCustomers(): Promise<SourceCustomer[]>
  async fetchVendors(): Promise<SourceVendor[]>
  async fetchItems(): Promise<SourceItem[]>
  async fetchInvoices(): Promise<SourceInvoice[]>
  async fetchBills(): Promise<SourceBill[]>
  async fetchAccounts(): Promise<SourceAccount[]>
  async fetchPayments(): Promise<SourcePayment[]>
  async fetchEstimates(): Promise<SourceEstimate[]>
  async fetchTaxCodes(): Promise<SourceTaxCode[]>
  async fetchClasses(): Promise<SourceClass[]>
  async fetchDepartments(): Promise<SourceDepartment[]>
  
  private async query<T>(soql: string): Promise<T[]>
  private async refreshAccessToken(): Promise<void>
}
```

#### 1.4 Data Mapper (QuickBooks → Us)
```typescript
// Maps QuickBooks Customer to our Customer
function mapQBCustomerToOurCustomer(qbCustomer: QuickBooksCustomer): CustomerInput {
  return {
    name: qbCustomer.DisplayName,
    email: qbCustomer.PrimaryEmailAddr?.Address,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber,
    address: qbCustomer.BillAddr?.Line1,
    city: qbCustomer.BillAddr?.City,
    country: qbCustomer.BillAddr?.Country,
    openingBalance: qbCustomer.Balance || 0,
    currency: qbCustomer.CurrencyRef?.value || 'UGX',
  }
}
```

---

### Phase 2: Migration Engine & Progress Tracking

**Goal:** Core engine that orchestrates data fetching, mapping, and importing.

#### 2.1 Migration Engine
```typescript
// src/lib/migration/core/migration-engine.ts

export class MigrationEngine {
  async startMigration(connectionId: string, entities: string[]) {
    // 1. Create migration job
    // 2. For each entity:
    //    a. Fetch from source API (paginated)
    //    b. Map to our schema
    //    c. Validate
    //    d. Import in batches (transaction-wrapped)
    //    e. Update progress
    // 3. Mark complete
  }

  async pauseMigration(migrationId: string)
  async resumeMigration(migrationId: string)
  async rollbackMigration(migrationId: string)
}
```

#### 2.2 Real-Time Progress via WebSocket
```typescript
// Broadcast progress updates to frontend
logAndBroadcast(tenantId, 'migration-progress', {
  migrationId,
  entity: 'invoices',
  progress: 67,
  total: 3456,
  current: 2312,
})
```

#### 2.3 Batch Importer
```typescript
// Import in chunks of 100 to avoid memory issues
async function importInBatches(
  items: any[],
  batchSize: number,
  importFn: (batch: any[]) => Promise<void>
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await importFn(batch)
    
    // Update progress
    await updateProgress(i + batch.length, items.length)
    
    // Small delay to avoid overwhelming the DB
    await sleep(50)
  }
}
```

---

### Phase 3: Additional Platforms (FreshBooks, Zoho, Xero)

**Goal:** Add support for other major platforms using the same OAuth + API pattern.

Each platform follows the same pattern:
1. OAuth connection flow
2. API client with paginated fetching
3. Data mapper to our schema
4. Validation rules

**Platform Priority:**
| Platform | Why First? | Effort |
|----------|-----------|--------|
| **FreshBooks** | Large SMB user base, simpler API | Medium |
| **Zoho Books** | Popular in emerging markets, good API docs | Medium |
| **Xero** | Strong in UK/Australia/NZ | Medium |

---

### Phase 4: Conflict Resolution & Duplicate Handling

**Goal:** Smart duplicate detection and user-controlled merge/skip decisions.

#### 4.1 Duplicate Detection
```typescript
// Check for existing records before import
async function findDuplicates(entityType: string, sourceRecords: any[], tenantId: string) {
  const duplicates = []
  
  for (const record of sourceRecords) {
    let existing = null
    
    if (entityType === 'customers') {
      existing = await db.query.customers.findFirst({
        where: or(
          eq(customers.email, record.email),
          eq(customers.name, record.name)
        )
      })
    }
    
    if (existing) {
      duplicates.push({
        source: record,
        existing,
        matchReason: existing.email === record.email ? 'email' : 'name',
      })
    }
  }
  
  return duplicates
}
```

---

### Phase 5: CSV/Excel Fallback

**Goal:** Allow migration via file upload when direct API isn't available or user prefers manual export.

Same UI flow, but instead of OAuth:
1. User downloads our CSV template
2. Exports data from their platform manually
3. Uploads to our wizard
4. Auto-detects columns and maps fields
5. Validates and imports

---

### Phase 6: Post-Migration Verification

**Goal:** Ensure data integrity after migration.

#### 6.1 Verification Report
```typescript
// After migration completes, generate report
{
  summary: {
    totalRecords: 11413,
    imported: 11390,
    skipped: 23,
    errors: 5,
  },
  byEntity: {
    customers: { total: 1247, imported: 1247, errors: 0 },
    items: { total: 834, imported: 834, errors: 0 },
    invoices: { total: 3456, imported: 3451, errors: 5 },
    // ...
  },
  errors: [
    { entity: 'invoice', sourceId: 'INV-123', reason: 'Missing customer reference' },
    // ...
  ]
}
```

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/migration/connect/:platform` | Start OAuth flow |
| GET | `/api/migration/callback/:platform` | Handle OAuth callback |
| POST | `/api/migration/disconnect` | Remove connection |
| GET | `/api/migration/connection/status` | Check connection |
| POST | `/api/migration/preview` | Fetch entity counts from source |
| POST | `/api/migration/start` | Start migration job |
| GET | `/api/migration/:id/status` | Get progress |
| POST | `/api/migration/:id/pause` | Pause migration |
| POST | `/api/migration/:id/resume` | Resume migration |
| POST | `/api/migration/:id/rollback` | Rollback migration |
| GET | `/api/migration/:id/report` | Get migration report |
| POST | `/api/migration/resolve-conflicts` | Submit conflict resolutions |

---

## File Structure

```
src/lib/migration/
├── core/
│   ├── migration-engine.ts        # Orchestrates the migration process
│   ├── migration-validator.ts     # Validates data before import
│   ├── migration-rollback.ts      # Rollback functionality
│   └── migration-progress.ts      # Real-time progress tracking
├── providers/
│   ├── base-provider.ts           # Abstract base class for all providers
│   ├── quickbooks-provider.ts     # QuickBooks Online API client
│   ├── freshbooks-provider.ts     # FreshBooks API client
│   ├── zoho-books-provider.ts     # Zoho Books API client
│   └── xero-provider.ts           # Xero API client
├── mappers/
│   ├── customer-mapper.ts         # Maps source customers → our customers
│   ├── item-mapper.ts             # Maps source items → our items
│   ├── invoice-mapper.ts          # Maps source invoices → our sales
│   ├── vendor-mapper.ts           # Maps source vendors → our suppliers
│   ├── chart-of-accounts-mapper.ts
│   └── transaction-mapper.ts      # Maps transactions → our GL entries
├── templates/
│   ├── csv-templates.ts           # CSV template definitions
│   └── export-guides.ts           # Instructions for manual exports
├── types/
│   └── migration.ts               # TypeScript interfaces
└── index.ts

src/app/api/migration/
├── connect/[platform]/route.ts
├── callback/[platform]/route.ts
├── disconnect/route.ts
├── connection/status/route.ts
├── preview/route.ts
├── start/route.ts
├── [id]/status/route.ts
├── [id]/pause/route.ts
├── [id]/resume/route.ts
├── [id]/rollback/route.ts
├── [id]/report/route.ts
└── resolve-conflicts/route.ts

src/components/migration/
├── MigrationWizard.tsx
├── PlatformSelector.tsx
├── OAuthConnectButton.tsx
├── EntitySelector.tsx
├── MigrationReview.tsx
├── MigrationProgress.tsx
├── ConflictResolver.tsx
├── MigrationReport.tsx
├── MigrationSuccess.tsx
└── CsvUploadFallback.tsx

src/app/c/[slug]/settings/
└── migration/page.tsx

src/lib/db/migrations/
└── add_migration_tables.sql
```

---

## Environment Variables

```env
# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/migration/callback/quickbooks
QUICKBOOKS_ENVIRONMENT=sandbox # or production

# FreshBooks OAuth
FRESHBOOKS_CLIENT_ID=
FRESHBOOKS_CLIENT_SECRET=
FRESHBOOKS_REDIRECT_URI=http://localhost:3000/api/migration/callback/freshbooks

# Zoho Books OAuth
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=http://localhost:3000/api/migration/callback/zoho
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com

# Xero OAuth
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=http://localhost:3000/api/migration/callback/xero

# Encryption key for storing OAuth tokens
MIGRATION_TOKEN_ENCRYPTION_KEY=
```

---

## Security Considerations

1. **Token Storage:** OAuth tokens are encrypted at rest using AES-256
2. **Token Rotation:** Refresh tokens are rotated on each use (per OAuth spec)
3. **Scopes:** Request minimum required scopes (read-only for migration)
4. **Revocation:** Tokens are revoked when user disconnects
5. **Data Isolation:** Migration data is scoped to tenant
6. **Audit Log:** All migration actions are logged
7. **Rate Limiting:** Respect platform rate limits with backoff strategies
8. **No Credentials Stored:** We never store user passwords — only OAuth tokens

---

## Key Technical Decisions

### 1. Migration Strategy: Batch vs Streaming
- **Recommendation:** Batch processing with chunked imports (100-500 records per batch)
- **Why:** Allows progress tracking, pause/resume, and error recovery

### 2. Field Mapping: Auto vs Manual
- **Recommendation:** Auto-detect with manual override
- **Why:** 80% of fields map automatically; users handle edge cases

### 3. Data Validation: Strict vs Lenient
- **Recommendation:** Lenient with warnings (skip invalid rows but continue)
- **Why:** Prevents one bad record from blocking entire migration

### 4. Rollback: Full vs Partial
- **Recommendation:** Full rollback only (atomic per entity type)
- **Why:** Partial rollback is complex and error-prone

### 5. File Storage: Local vs Cloud
- **Recommendation:** Store uploaded CSV files in R2/S3 temporarily
- **Why:** Large files shouldn't block server memory; cleanup after migration

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Migration success rate | >95% |
| Average migration time (500 records) | <5 minutes |
| User satisfaction (post-migration survey) | >4.5/5 |
| Support tickets per migration | <0.5 |
| Data accuracy after migration | 100% |

---

## Competitive Analysis

### Akaunting (Open Source)
- ✅ OAuth connection to QuickBooks
- ✅ CSV import with field mapping
- ✅ Multiple entity support
- ❌ No automatic conflict resolution
- ❌ No rollback capability
- ❌ Limited platform support

### FreshBooks → Competitors
- ✅ Guided migration wizards
- ✅ Dedicated support during migration

### QuickBooks Online
- ✅ Data migration tools for partners
- ❌ Complex export process for users

### Our Advantages
- ✅ Direct OAuth connection (no file exports needed)
- ✅ Beautiful guided wizard with real-time progress
- ✅ Automatic conflict resolution with merge options
- ✅ Rollback safety net
- ✅ Multi-platform support (QB, FB, Zoho, Xero)
- ✅ Comprehensive error reporting and post-migration verification
- ✅ CSV fallback for platforms without API access

---

## Recommended Implementation Order

| Week | Phase | Deliverable |
|------|-------|-------------|
| **1-2** | Phase 1 | QuickBooks OAuth + Data Fetcher + Mapper |
| **3** | Phase 2 | Migration Engine + Progress Tracking |
| **4** | Phase 4 | Conflict Resolution UI |
| **5** | Phase 3 | FreshBooks + Zoho Books integrations |
| **6** | Phase 5 | CSV/Excel fallback |
| **7** | Phase 6 | Post-migration verification |
| **8** | Polish | Testing, docs, video tutorials |

---

## Estimated Effort by Phase

| Phase | Complexity | Estimated Files | Key Deliverables |
|-------|------------|-----------------|------------------|
| **Phase 1** | High | 12+ | OAuth flow, QB provider, data mapper |
| **Phase 2** | Medium | 8+ | Migration engine, progress tracking |
| **Phase 3** | Medium | 10+ | FreshBooks + Zoho providers |
| **Phase 4** | Medium | 5+ | Duplicate detection, conflict UI |
| **Phase 5** | Low | 5+ | CSV upload, auto-detect, mapping |
| **Phase 6** | Low | 4+ | Verification report, reconciliation |

---

## New Files Summary (Approx. 45+ files)

### Core Engine (8 files)
```
src/lib/migration/core/
├── migration-engine.ts
├── migration-validator.ts
├── migration-rollback.ts
└── migration-progress.ts
src/lib/migration/
├── base-provider.ts
├── types/migration.ts
└── index.ts
```

### Platform Providers (4-5 files)
```
src/lib/migration/providers/
├── quickbooks-provider.ts
├── freshbooks-provider.ts
├── zoho-books-provider.ts
└── xero-provider.ts
```

### Data Mappers (6 files)
```
src/lib/migration/mappers/
├── customer-mapper.ts
├── item-mapper.ts
├── invoice-mapper.ts
├── vendor-mapper.ts
├── chart-of-accounts-mapper.ts
└── transaction-mapper.ts
```

### API Routes (11 files)
```
src/app/api/migration/
├── connect/[platform]/route.ts
├── callback/[platform]/route.ts
├── disconnect/route.ts
├── connection/status/route.ts
├── preview/route.ts
├── start/route.ts
├── [id]/status/route.ts
├── [id]/pause/route.ts
├── [id]/resume/route.ts
├── [id]/rollback/route.ts
└── [id]/report/route.ts
```

### UI Components (10 files)
```
src/components/migration/
├── MigrationWizard.tsx
├── PlatformSelector.tsx
├── OAuthConnectButton.tsx
├── EntitySelector.tsx
├── MigrationReview.tsx
├── MigrationProgress.tsx
├── ConflictResolver.tsx
├── MigrationReport.tsx
├── MigrationSuccess.tsx
└── CsvUploadFallback.tsx
```

### Database Migration (1 file)
```
src/lib/db/migrations/add_migration_tables.sql
```

### Page (1 file)
```
src/app/c/[slug]/settings/migration/page.tsx
```

### Tests (5 files)
```
src/lib/migration/__tests__/
├── migration-engine.test.ts
├── quickbooks-provider.test.ts
├── validation.test.ts
├── rollback.test.ts
└── mappers.test.ts
```

---

This plan provides a complete, production-ready migration feature that rivals and exceeds what Akaunting offers. Users simply click "Connect to QuickBooks", authenticate, select what to migrate, and watch it happen in real-time — no file exports, no CSV uploads, no manual mapping.

---

**Last Updated:** April 2026
**Version:** 1.0
