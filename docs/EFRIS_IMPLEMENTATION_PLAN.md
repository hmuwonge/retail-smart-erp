# URA EFRIS Integration — Implementation Plan

## Overview

Integrate Uganda Revenue Authority (URA) Electronic Fiscal Receipting and Invoicing System (EFRIS) into the Retail Smart ERP. The system will automatically submit fiscal invoices/receipts to EFRIS via the WEAF API whenever a sale is completed, ensuring tax compliance for Ugandan businesses.

### Access Model

- **EFRIS is a premium-only feature** — available exclusively to tenants on the `enterprise` pricing tier (mapped to `plan: 'premium'`).
- **Super admin manages EFRIS** — enabling/disabling EFRIS and configuring per-tenant TIN/token is done exclusively through the Super Admin control panel (`/sys-control`), NOT by the tenant themselves.
- **TIN required during company setup** — when a company is created in Uganda (or selects the enterprise tier), the setup wizard requires the TIN field to be filled.
- **Tenants cannot change EFRIS credentials** — tenant users can only view their EFRIS status and manage product mapping. All credential configuration (TIN, token, enable/disable) is super admin controlled.

### Current State

| Component | Status |
|-----------|--------|
| `EfrisClient` class (`src/lib/integration/efris.ts`) | ✅ Implemented (auth, products, invoices, receipts, stock) |
| DB columns on `tenants` (efrisEnabled, efrisTin, efrisToken) | ✅ Defined in schema |
| DB columns on `items` (efrisItemCode, efrisTaxForm, efrisTaxRule) | ✅ Defined in schema |
| DB columns on `sales` (efrisInvoiceNo, efrisAntifakeCode, efrisQrCode, efrisStatus, efrisError) | ✅ Defined in schema |
| Postman collection (WEAF EFRIS Web API reference) | ✅ Available |
| Uganda country/tax config | ✅ Present |
| Pricing tier system (`enterprise` = premium) | ✅ Existing (`pricing_tiers`, `subscriptions`) |
| Super admin control panel (`/sys-control`) | ✅ Existing (auth, session, layout) |
| API routes for EFRIS | ❌ Missing |
| Frontend UI (settings, status, sync) | ❌ Missing |
| Sales workflow integration | ❌ Missing |
| Background retry queue | ❌ Missing |
| Environment variable docs | ❌ Missing |
| Tests | ❌ Missing |

---

## Implementation Phases

### Phase 1: Environment & Configuration

**Goal:** Make EFRIS configurable and testable.

#### 1.1 Add EFRIS environment variables to `.env.example`

```env
# ==========================================
# EFRIS (Uganda Tax Authority Integration)
# ==========================================

# Environment: 'test' or 'production'
EFRIS_ENVIRONMENT=test

# Test API base URL (default: https://test-api.weafefrisapi.space)
EFRIS_TEST_BASE_URL=

# Production API base URL (default: https://api.weafefrisapi.space)
EFRIS_PRODUCTION_BASE_URL=
```

#### 1.2 Add EFRIS feature flag to pricing tiers

The `pricing_tiers` table already has a `features: jsonb` column. Use it to gate EFRIS to the enterprise tier:

```sql
UPDATE pricing_tiers SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{efris}',
  'true'
) WHERE name = 'enterprise';

-- Ensure all other tiers have efris: false
UPDATE pricing_tiers SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{efris}',
  'false'
) WHERE name != 'enterprise';
```

#### 1.3 Create EFRIS migration file

**File:** `src/lib/db/migrations/add_efris_columns.sql`

- Verify all existing EFRIS columns on `tenants`, `items`, and `sales` (idempotent `ADD COLUMN IF NOT EXISTS`)
- Add to `sales` table:
  - `efrisSubmittedAt` — timestamp (if not present)
  - `efrisRetryCount` — integer, default 0
  - `efrisLastRetryAt` — timestamp (nullable)
- Add indexes:
  - `idx_sales_efris_status` on `sales(efris_status)`
  - `idx_items_efris_item_code` on `items(efris_item_code)`

#### 1.4 Push schema changes

```bash
npm run db:push
```

---

### Phase 2: Super Admin EFRIS Management

**Goal:** Allow super admins to configure EFRIS per tenant from the sys-control panel.

#### 2.1 Super Admin EFRIS API Routes

**File:** `src/app/api/sys-control/efris/route.ts`

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/sys-control/efris/tenants` | `validateAdminSession()` | List all tenants with EFRIS eligibility and status |
| `GET` | `/api/sys-control/efris/:tenantId` | `validateAdminSession()` | Get specific tenant's EFRIS config |
| `PUT` | `/api/sys-control/efris/:tenantId` | `validateAdminSession()` | Update tenant EFRIS config (enable/disable, TIN, token) |
| `POST` | `/api/sys-control/efris/:tenantId/test` | `validateAdminSession()` | Test EFRIS connection for a tenant |

**Tenant eligibility check:** Only tenants on `enterprise` tier (`plan: 'premium'` or `subscriptions.tier.name = 'enterprise'`) can have EFRIS enabled. Attempting to enable EFRIS for non-premium tenants returns 403 with message "EFRIS is only available on the Enterprise plan."

**PUT body schema:**
```typescript
{
  efrisEnabled: boolean,
  efrisTin?: string,
  efrisToken?: string
}
```

#### 2.2 Super Admin EFRIS UI

**File:** `src/app/sys-control/(protected)/efris/page.tsx`

A management page for super admins to configure EFRIS across all eligible tenants:

- **Table** listing all tenants on the enterprise tier:
  - Tenant name, slug, country, subscription status
  - Toggle: Enable/Disable EFRIS
  - Input: TIN (editable, validated format)
  - Input: API Token (with show/hide toggle, masked by default)
  - "Test Connection" button — validates credentials against EFRIS API
  - Save button — persists config to `tenants` table
  - Status badge: "Not Configured" | "Configured" | "Enabled" | "Connection Error"
- **Filters:**
  - Country filter (default to Uganda)
  - Search by tenant name/slug
  - Status filter (enabled/disabled/not configured)
- **Bulk actions:**
  - Enable EFRIS for selected tenants
  - Disable EFRIS for selected tenants

**File:** `src/app/sys-control/(protected)/layout.tsx` — Add "EFRIS" nav link to the sidebar.

#### 2.3 Tenant EFRIS Read-Only View

**File:** `src/app/api/settings/efris/route.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/settings/efris` | Get current tenant's EFRIS status (read-only) |

**Auth:** `authWithCompany()` + `withTenant()`.
**Response:**
```typescript
{
  efrisEnabled: boolean,
  efrisConfigured: boolean,    // has TIN and token
  efrisTinMasked: string | null, // "UG******123" or null
  efrisStatus: 'enabled' | 'disabled' | 'not_configured' | 'not_available',
  planEligible: boolean,       // true if on enterprise tier
}
```

**No write operations allowed for tenants.** All configuration is super admin controlled.

**File:** `src/components/settings/EfrisStatus.tsx`

Read-only settings component for tenant users:

- If on enterprise tier and EFRIS enabled:
  - Shows "EFRIS Enabled" green badge
  - Displays masked TIN
  - Connection status indicator
- If on enterprise tier but EFRIS disabled/not configured:
  - Shows "EFRIS Not Configured" info banner
  - Message: "Contact your system administrator to enable EFRIS."
- If NOT on enterprise tier:
  - Shows "EFRIS Not Available" banner
  - Upgrade prompt: "EFRIS is available on the Enterprise plan. [Upgrade Now]"
  - Links to pricing/upgrade flow
- **No edit controls** — entirely read-only

**Integration:** Add EFRIS status section to tenant settings page (`src/app/c/[slug]/settings/`).

---

### Phase 3: Company Setup — TIN Collection

**Goal:** Collect TIN during company onboarding for eligible companies.

#### 3.1 Update Setup Wizard

**File:** `src/app/c/[slug]/setup/_components/SetupWizard.tsx`

Add TIN field to the company details step when:
- Country is set to Uganda (UG), OR
- Selected pricing tier is `enterprise`

The TIN field should be:
- **Required** when country = Uganda (with validation: format `UG` + 10 digits)
- **Optional** but recommended for other countries on enterprise tier
- Stored in `tenants.efrisTin` during setup

#### 3.2 Update Setup Complete API

**File:** `src/app/api/c/[slug]/setup/complete/route.ts`

- Accept `efrisTin` in the setup body (add to validation schema)
- If country = Uganda and TIN not provided, return validation error: "TIN is required for Ugandan companies."
- Store TIN in `tenants.efrisTin` during seed data creation
- If country = Uganda, auto-set `tenants.country = 'UG'` and flag for super admin review

#### 3.3 Update Company Creation API

**File:** `src/app/api/account/companies/route.ts`

- Accept optional `efrisTin` in the company creation body
- If `tierId` maps to `enterprise` and country = Uganda, require TIN
- Store TIN on tenant creation

#### 3.4 Validation Schema for TIN

**File:** `src/lib/validation/schemas/efris.ts`

```typescript
export const efrisTinSchema = z.string()
  .regex(/^UG\d{10}$/, 'TIN must be in format: UG followed by 10 digits')
  .or(z.string().length(0).nullable()); // Allow empty for non-Uganda
```

---

### Phase 4: Product Sync & Registration

**Goal:** Ensure all items have EFRIS codes before invoicing.

#### 4.1 Product Sync API Routes

**File:** `src/app/api/efris/products/route.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/efris/products` | List items with/without EFRIS codes |
| `POST` | `/api/efris/products/sync` | Fetch products from EFRIS and match to local items |
| `POST` | `/api/efris/products/register` | Register a single item to EFRIS |
| `POST` | `/api/efris/products/bulk-register` | Bulk register all unmapped items |

**Auth:** `authWithCompany()` + `withTenant()`.
**EFRIS access check:** Only tenants with `efrisEnabled = true` can access these routes. Return 403 otherwise.

#### 4.2 Product Mapping Helper

**File:** `src/lib/integration/efris-mapper.ts`

- `mapItemToEfrisProduct(item)` — Convert local item schema to EFRIS product registration format
- `matchEfrisProductToLocal(efrisProduct)` — Match EFRIS product to local item by name/SKU
- Auto-detect tax form (`'101'`) and tax rule (`'STANDARD'`) from item tax template

#### 4.3 Product Sync UI

**File:** `src/components/inventory/EfrisProductSync.tsx`

- Table showing items with EFRIS mapping status (columns: item name, SKU, EFRIS code, status, actions)
- "Sync from EFRIS" button — fetches products from EFRIS and auto-matches
- "Register to EFRIS" action per unmapped item
- "Bulk Register All" button — registers all unmapped items at once
- Status indicators per item: ✅ Mapped | ⏳ Pending | ❌ Error
- Filter: show only unmapped / mapped / error items

**Integration:** Add EFRIS tab or section to the inventory items page.

---

### Phase 5: Sales Integration — Auto-Submit Invoices to EFRIS

**Goal:** Automatically submit fiscal invoices to EFRIS when a sale is completed.

#### 5.1 EFRIS Invoice Builder Service

**File:** `src/lib/integration/efris-invoice-builder.ts`

- `buildInvoicePayload(sale, saleItems, tenant, customer)` → `EfrisInvoiceRequest`
  - Maps sale data to EFRIS invoice format
  - Resolves buyer details from customer record
  - Maps payment method to EFRIS payment mode codes (101=Cash, 102=Card, 103=Mobile Money, 104=Cheque, 105=Credit, 106=Bank Transfer)
  - Maps items to EFRIS goods format with tax forms/rules
  - Handles multi-payment splits (cash + card + credit)
  - Determines invoice type (1=Invoice for credit/B2B, 2=Receipt for POS/walk-in)
  - Handles returns as credit notes
  - Includes seller place of business from tenant settings

#### 5.2 Sales Route Integration

**File:** `src/app/api/sales/route.ts` (modify existing POST handler)

After the sale is successfully created and committed in the transaction:

```typescript
// After sale creation succeeds (non-blocking, fire-and-forget)
if (tenant?.efrisEnabled && sale.status === 'completed' && tenant.plan === 'premium') {
  submitSaleToEfris(sale.id, tenantId).catch(err => {
    logError('efris/auto-submit', err)
    // Failure is recorded on the sale record, will be retried by background job
  })
}
```

For returns (`isReturn: true`):

```typescript
if (tenant?.efrisEnabled && sale.isReturn && originalSale?.efrisStatus === 'success') {
  submitReturnToEfris(sale.id, originalSale.efrisInvoiceNo, tenantId).catch(err => {
    logError('efris/auto-return', err)
  })
}
```

#### 5.3 EFRIS Submission Service

**File:** `src/lib/integration/efris-submitter.ts`

- `submitSaleToEfris(saleId, tenantId)` — Core submission function
  1. Fetches sale, items, tenant, customer from DB
  2. Checks idempotency: if `efrisStatus === 'success'`, skip
  3. Validates all items have `efrisItemCode` (throws if missing)
  4. Builds invoice payload via `buildInvoicePayload()`
  5. Calls `client.generateInvoice()` or `client.generateReceipt()` based on sale type
  6. On success: updates sale with `efrisInvoiceNo`, `efrisAntifakeCode`, `efrisQrCode`, `efrisStatus='success'`, `efrisSubmittedAt`
  7. On failure: updates sale with `efrisStatus='failed'`, `efrisError=error.message`
  8. Broadcasts change to frontend via `logAndBroadcast()`

- `submitReturnToEfris(saleId, originalInvoiceNo, tenantId)` — Handles returns via credit note
  1. Fetches return sale and tenant config
  2. Calls `client.applyCreditNote()` with reference to original invoice
  3. Updates return sale with EFRIS status

#### 5.4 Manual Resubmit API

**File:** `src/app/api/sales/[id]/efris/resubmit/route.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/sales/[id]/efris/resubmit` | Manually retry a failed EFRIS submission |

**Auth:** `authWithCompany()` + `withTenant()`.
**Logic:** Resets `efrisStatus` to `'pending'`, calls `submitSaleToEfris()`, returns result.

#### 5.5 Sale Detail UI — EFRIS Status

Modify sale detail/receipt view components:

- Show EFRIS submission status badge:
  - 🟡 Pending
  - 🟢 Success (shows antifake code + QR code)
  - 🔴 Failed (shows error message)
  - ⚪ Not enabled (hidden if EFRIS not configured)
- "Resubmit to EFRIS" button on failed status
- Tooltip on hover showing submission timestamp

---

### Phase 6: Background Retry Queue

**Goal:** Retry failed EFRIS submissions automatically.

#### 6.1 EFRIS Retry Service

**File:** `src/lib/integration/efris-retry-queue.ts`

- `getFailedSubmissions(tenantId?, since?, limit?)` — Query sales with `efrisStatus='failed'` and `efrisRetryCount < 5`
- `retryFailedSubmissions(batchSize?)` — Iterate and retry failed submissions
- Exponential backoff: `delay = 2^retryCount * 60 seconds` (1min, 2min, 4min, 8min, 16min)
- Max 5 retries per submission
- Updates `efrisRetryCount` and `efrisLastRetryAt` on each attempt

#### 6.2 Retry Trigger Mechanism

Two approaches (implement both):

**Option A: API-based on-demand (primary)**

**File:** `src/app/api/sys-control/efris/retry-failed/route.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/sys-control/efris/retry-failed` | Trigger retry batch (super admin only) |

- Auth: `validateAdminSession()`
- Optional body: `{ tenantId?, batchSize?, since? }`
- Returns: `{ retried: number, succeeded: number, stillFailed: number }`

**Option B: Cron-based (when infrastructure supports it)**

**File:** `src/lib/cron/efris-retry.ts`

- Runs every 15 minutes via `node-cron`
- Processes all failed submissions across all EFRIS-enabled tenants
- Batch size: 50 per run
- Only runs if `process.env.EFRIS_AUTO_RETRY === 'true'`

#### 6.3 Sales Retry Columns

Added in Phase 1 migration:
- `efrisRetryCount` — integer, default 0
- `efrisLastRetryAt` — timestamp (nullable)

---

### Phase 7: Stock Management (Optional)

**Goal:** Sync stock adjustments to EFRIS for inventory compliance.

#### 7.1 Stock Adjustment Integration

**File:** `src/lib/integration/efris-stock.ts`

- `syncStockOnPurchase(poId, tenantId)` — Increase stock when goods are purchased from suppliers
- `syncStockOnAdjustment(adjustmentId, tenantId)` — Handle stock adjustments (expired, damaged, personal use)
- `syncStockOnReturn(returnId, tenantId)` — Increase stock when items are returned from customers
- Maps adjustment reasons to EFRIS stockInType/adjustType codes

#### 7.2 Stock API Routes (Optional)

**File:** `src/app/api/efris/stock/route.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/efris/stock/sync` | Manual stock sync with EFRIS |
| `GET` | `/api/efris/stock/status` | View stock sync status |

---

### Phase 8: Dashboard & Reporting

**Goal:** Provide visibility into EFRIS compliance.

#### 8.1 Super Admin EFRIS Dashboard Widget

**File:** `src/app/sys-control/(protected)/dashboard/page.tsx` (modify)

Add EFRIS overview section:
- Total EFRIS-enabled tenants
- Today's submissions across all tenants (success/failed/pending)
- Tenants with connection errors
- Quick link to EFRIS management page

#### 8.2 Tenant EFRIS Dashboard Widget

**File:** `src/components/dashboard/EfrisStatusWidget.tsx`

- Today's EFRIS submission count
- Success rate percentage
- Quick stats: pending / failed count
- Link to EFRIS submissions report page
- Only visible if `efrisEnabled = true`

#### 8.3 EFRIS Submissions Report

**File:** `src/app/api/reports/efris-submissions/route.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/reports/efris-submissions` | List all EFRIS submissions with filters |

- Filter by date range, status (success/failed/pending)
- Export to CSV

**File:** `src/app/c/[slug]/reports/efris/page.tsx`

- Table of all EFRIS submissions
- Status filters
- Date range picker
- Export button
- Only visible if `efrisEnabled = true`

---

### Phase 9: Validation & Error Handling

**Goal:** Robust error handling and user feedback.

#### 9.1 Pre-Sale Validation

Before submitting to EFRIS, validate:
- Tenant is on `enterprise` tier (`plan: 'premium'`)
- Tenant has `efrisEnabled = true` and valid TIN + token
- All items have `efrisItemCode` assigned
- Customer has required fields (name at minimum)
- Payment method maps to valid EFRIS payment mode code

If validation fails, **do not block the sale** — sale proceeds normally, EFRIS submission is marked as failed with a clear error message for later retry.

#### 9.2 EFRIS Access Middleware Helper

**File:** `src/lib/integration/efris-guards.ts`

Reusable guards for API routes:

```typescript
// Check if tenant has EFRIS feature available (enterprise tier)
export async function requireEfrisFeature(tenantId: string): Promise<NextResponse | null>

// Check if EFRIS is enabled and configured for tenant
export async function requireEfrisConfigured(tenantId: string): Promise<NextResponse | null>

// Get EFRIS client or return error if not configured
export async function getEfrisClientOrError(tenantId: string): Promise<{ client: EfrisClient } | NextResponse>
```

#### 9.3 Error Messages

Map EFRIS API error codes to user-friendly messages:

| EFRIS Error | User Message |
|-------------|-------------|
| Invalid/expired token | "EFRIS token expired or invalid. Contact your system administrator." |
| Invalid TIN | "EFRIS TIN '{tin}' not found. Please verify with your administrator." |
| Item not found | "Item '{name}' not registered with EFRIS. Please register it in Inventory." |
| Missing required field | "Missing required field: {field}. Please update company settings." |
| Network/timeout | "EFRIS service unreachable. The submission will be retried automatically." |
| Duplicate invoice | "Invoice already submitted. No action needed." |

#### 9.4 Logging

- All EFRIS API calls logged via `logToFile()` with level, category, tenant ID, TIN, endpoint
- Errors logged via `logError()` for AI analysis
- Include correlation ID for tracing submission lifecycle

---

### Phase 10: Tests

**Goal:** Ensure reliability of EFRIS integration.

#### 10.1 Unit Tests

**File:** `src/lib/integration/__tests__/efris.test.ts`

- `EfrisClient` class — mock fetch, test all methods
- `efris-invoice-builder` — test payload building with various sale types (cash, credit, return, multi-payment)
- `efris-submitter` — test success/failure/idempotency paths
- `efris-mapper` — test product mapping logic
- `efris-guards` — test feature gate and config checks

#### 10.2 Integration Tests

**File:** `src/app/api/__tests__/sys-control-efris.test.ts`

- Super admin EFRIS CRUD API
- EFRIS test connection endpoint
- Product sync endpoints
- Manual resubmit endpoint

#### 10.3 E2E Tests

**File:** `e2e/tests/efris/efris-flow.spec.ts`

1. Super admin enables EFRIS for enterprise tenant → sets TIN and token
2. Tenant registers product → EFRIS code assigned
3. Tenant creates sale → EFRIS submission succeeds
4. Sale shows antifake code and QR code
5. Test failure scenario → submission fails → retry → success
6. Test return → credit note submitted to EFRIS
7. Verify non-enterprise tenant cannot access EFRIS features

---

### Phase 11: Documentation

**Goal:** Help users and developers understand the integration.

#### 11.1 User Documentation

**File:** `docs/EFRIS_USER_GUIDE.md`

- What is EFRIS and who can use it (Enterprise plan only)
- How to view your EFRIS status in settings
- How to register products with EFRIS
- How to view EFRIS invoice status on sales
- Troubleshooting common errors
- How to request EFRIS setup from your administrator

#### 11.2 Admin Documentation

**File:** `docs/EFRIS_ADMIN_GUIDE.md`

- How to enable EFRIS for a tenant (super admin guide)
- How to obtain TIN and API token from WEAF/URA
- Configuring per-tenant credentials
- Testing EFRIS connections
- Monitoring EFRIS submissions across tenants
- Managing failed submissions and retries

#### 11.3 Developer Documentation

**File:** `docs/EFRIS_DEVELOPER_GUIDE.md`

- Architecture overview and access model
- EFRIS client API reference
- Data flow diagrams (sale → EFRIS submission)
- Feature gating pattern
- How to add new EFRIS endpoints
- Testing with EFRIS sandbox environment
- Environment variable reference

---

## Implementation Order & Dependencies

```
Phase 1 (Env & Config + Migration)
  ├── Phase 2 (Super Admin EFRIS Management)
  │     └── Phase 3 (Company Setup — TIN Collection)
  │           └── Phase 4 (Product Sync)
  │                 └── Phase 5 (Sales Integration)
  │                       ├── Phase 6 (Background Retry)
  │                       └── Phase 9 (Validation & Error Handling)
  │                             └── Phase 8 (Dashboard & Reporting)
  │                                   └── Phase 7 (Stock Management) — optional
  │
  Phase 10 (Tests) — parallel with any phase after Phase 5
  Phase 11 (Documentation) — parallel with final phases
```

**Recommended execution order:**
1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 9 → Phase 8
2. Phase 7 (Stock Management) can be done anytime after Phase 5 or skipped if not needed
3. Phase 10 (Tests) should be written alongside Phase 5+ code
4. Phase 11 (Documentation) written during or after implementation

---

## Estimated File Changes Summary

### New Files (approx. 25)

| File | Purpose |
|------|---------|
| `src/lib/db/migrations/add_efris_columns.sql` | Migration for EFRIS columns + retry fields |
| `src/lib/integration/efris-guards.ts` | Feature gate and config guard helpers |
| `src/lib/integration/efris-mapper.ts` | Product mapping helpers |
| `src/lib/integration/efris-invoice-builder.ts` | Invoice payload builder |
| `src/lib/integration/efris-submitter.ts` | Sale → EFRIS submission service |
| `src/lib/integration/efris-retry-queue.ts` | Failed submission retry logic |
| `src/lib/integration/efris-stock.ts` (optional) | Stock sync with EFRIS |
| `src/lib/cron/efris-retry.ts` (optional) | Cron job for auto-retries |
| `src/app/api/sys-control/efris/route.ts` | Super admin EFRIS management API |
| `src/app/api/sys-control/efris/retry-failed/route.ts` | Trigger retry batch (super admin) |
| `src/app/api/settings/efris/route.ts` | Tenant EFRIS status (read-only) |
| `src/app/api/efris/products/route.ts` | Product sync API |
| `src/app/api/sales/[id]/efris/resubmit/route.ts` | Manual resubmit API |
| `src/app/api/reports/efris-submissions/route.ts` | EFRIS report API |
| `src/app/sys-control/(protected)/efris/page.tsx` | Super admin EFRIS management UI |
| `src/components/settings/EfrisStatus.tsx` | Tenant EFRIS status (read-only) |
| `src/components/inventory/EfrisProductSync.tsx` | Product sync UI |
| `src/components/dashboard/EfrisStatusWidget.tsx` | Dashboard widget |
| `src/components/sales/EfrisStatusBadge.tsx` | EFRIS status indicator on sales |
| `src/app/c/[slug]/reports/efris/page.tsx` | EFRIS report page |
| `src/lib/validation/schemas/efris.ts` | EFRIS validation schemas (TIN format, etc.) |
| `src/lib/integration/__tests__/efris.test.ts` | Unit tests |
| `src/app/api/__tests__/sys-control-efris.test.ts` | Integration tests |
| `docs/EFRIS_USER_GUIDE.md` | User documentation |
| `docs/EFRIS_ADMIN_GUIDE.md` | Super admin documentation |
| `docs/EFRIS_DEVELOPER_GUIDE.md` | Developer documentation |

### Modified Files (approx. 7)

| File | Change |
|------|--------|
| `.env.example` | Add EFRIS environment variables |
| `src/app/api/sales/route.ts` | Hook EFRIS submission after sale creation |
| `src/app/api/sales/[id]/route.ts` | Include EFRIS status in sale detail response |
| `src/app/c/[slug]/settings/page.tsx` | Add EFRIS status section (read-only) |
| `src/app/c/[slug]/setup/_components/SetupWizard.tsx` | Add TIN field for Uganda/enterprise |
| `src/app/api/c/[slug]/setup/complete/route.ts` | Accept and validate TIN during setup |
| `src/app/api/account/companies/route.ts` | Accept TIN during company creation |
| `src/lib/db/schema.ts` | Add `efrisRetryCount`, `efrisLastRetryAt` to sales |
| `pricing_tiers` (data) | Set `features->efris = true` for enterprise tier |

---

## Key Design Decisions

### 1. Non-blocking EFRIS Submission

Sales are **never blocked** by EFRIS failures. The sale completes regardless of EFRIS status. Failed submissions are recorded and retried. This ensures business continuity even when EFRIS is down.

### 2. Super Admin Controlled Configuration

EFRIS credentials (TIN, token, enable/disable) are managed **exclusively by super admins** via `/sys-control`. Tenants can only view their status. This centralizes control, prevents misconfiguration, and ensures compliance.

### 3. Premium-Only Feature Gating

EFRIS is gated to the `enterprise` pricing tier (`plan: 'premium'`). This is enforced at multiple levels:
- **API routes** return 403 if tenant is not on enterprise tier
- **Super admin UI** only shows EFRIS controls for enterprise tenants
- **Sales integration** skips EFRIS submission for non-enterprise tenants
- **Tenant UI** shows upgrade prompt for non-enterprise tenants

### 4. Per-Tenant Credentials

Each tenant has their own `efrisTin` and `efrisToken` stored in the `tenants` table. This allows:
- Multiple Ugandan companies on the same platform, each with their own URA registration
- Super admin to manage credentials independently per tenant
- No shared/global token (unless explicitly desired via migration)

### 5. TIN Collection at Company Setup

For Ugandan companies, TIN is collected during the setup wizard. This ensures:
- No EFRIS-enabled company is missing its TIN
- Super admin can later enable EFRIS without needing to collect the TIN separately
- Data integrity: TIN is validated at entry point

### 6. Invoice vs Receipt

- **Receipt (invoiceType=2):** POS sales, walk-in customers, immediate payment
- **Invoice (invoiceType=1):** Credit sales, B2B transactions, delayed payment
- Determined by sale's payment status and whether a customer (business) is attached

### 7. Idempotency

EFRIS submissions are idempotent — `submitSaleToEfris()` checks if a sale has already been successfully submitted (`efrisStatus === 'success'`) before attempting. Failed submissions can be retried safely.

### 8. Returns as Credit Notes

Sales returns are submitted to EFRIS as **credit notes** referencing the original invoice number, following URA EFRIS requirements. The original sale's `efrisInvoiceNo` is used as `oriInvoiceNo`.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| EFRIS API downtime | Non-blocking submission + automatic retry queue |
| Missing EFRIS item codes | Pre-sale validation warns; submission fails with clear error for retry |
| Token expiration | Super admin dashboard shows connection errors; test connection button |
| Duplicate submissions | Idempotency check before each submission |
| Partial payments | Multi-payment split mapping to EFRIS payment modes |
| Network latency | Fire-and-forget async; no impact on sale speed |
| Non-enterprise tenant attempting EFRIS | Feature gate at API level + UI upgrade prompt |
| TIN missing for Uganda company | Required field in setup wizard; super admin cannot enable without it |
