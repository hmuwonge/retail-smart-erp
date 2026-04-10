# EFRIS Developer Guide

## Architecture Overview

EFRIS integration follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  - Super Admin EFRIS Management (/sys-control/efris)        │
│  - Tenant EFRIS Status (Settings page)                      │
│  - Product Sync UI (Inventory → EFRIS Products)             │
│  - EFRIS Reports (/reports/efris)                           │
│  - EFRIS Status Badge (Sales list/detail)                   │
│  - POS Receipt (Print template with EFRIS data)             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  - /api/sys-control/efris/* (Super admin endpoints)         │
│  - /api/settings/efris (Tenant read-only status)            │
│  - /api/efris/products/* (Product sync endpoints)           │
│  - /api/efris/stock/* (Stock sync endpoints)                │
│  - /api/sales/[id]/efris/resubmit (Manual resubmit)         │
│  - /api/reports/efris-submissions (Report data)             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  - efris-submitter.ts (Sale → EFRIS submission)             │
│  - efris-retry-queue.ts (Failed submission retry logic)     │
│  - efris-invoice-builder.ts (Sale → EFRIS payload mapping)  │
│  - efris-stock.ts (Stock sync operations)                   │
│  - efris-mapper.ts (Product mapping helpers)                │
│  - efris-guards.ts (Access control helpers)                 │
│  - efris-errors.ts (Error message mapping)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    EfrisClient Layer                         │
│  - EfrisClient class (HTTP client for WEAF API)             │
│  - Handles authentication, request formatting, error handling│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    WEAF EFRIS API                            │
│  - Test: https://test-api.weafefrisapi.space                │
│  - Prod: https://api.weafefrisapi.space                     │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Sale → EFRIS

1. **Sale Created** via POST `/api/sales`
2. **Fire-and-Forget**: After sale is persisted, EFRIS submission triggered asynchronously
3. **Validation**: Check tenant EFRIS config, item codes, sale status
4. **Build Payload**: Convert sale to EFRIS format via `efris-invoice-builder.ts`
5. **Submit**: Call WEAF API via `EfrisClient`
6. **Update Sale**: Store EFRIS response (invoice no, antifake code, QR code)
7. **On Failure**: Mark as failed with error message → Background retry picks it up

## Key Files

### Core Integration
| File | Purpose |
|------|---------|
| `src/lib/integration/efris.ts` | EfrisClient class, config, types |
| `src/lib/integration/efris-submitter.ts` | Submit sales/returns to EFRIS |
| `src/lib/integration/efris-invoice-builder.ts` | Map sales to EFRIS format |
| `src/lib/integration/efris-retry-queue.ts` | Retry failed submissions |
| `src/lib/integration/efris-stock.ts` | Stock sync operations |
| `src/lib/integration/efris-mapper.ts` | Product mapping helpers |
| `src/lib/integration/efris-guards.ts` | Access control helpers |
| `src/lib/integration/efris-errors.ts` | Error message mapping |

### API Routes
| File | Purpose |
|------|---------|
| `src/app/api/sys-control/efris/route.ts` | Super admin management |
| `src/app/api/efris/products/route.ts` | Product sync endpoints |
| `src/app/api/efris/stock/route.ts` | Stock sync endpoints |
| `src/app/api/sales/[id]/efris/resubmit/route.ts` | Manual resubmit |
| `src/app/api/reports/efris-submissions/route.ts` | Report data |

### UI Components
| File | Purpose |
|------|---------|
| `src/app/sys-control/(protected)/efris/page.tsx` | Super admin EFRIS management |
| `src/components/settings/EfrisStatus.tsx` | Tenant read-only status |
| `src/components/inventory/EfrisProductSync.tsx` | Product sync UI |
| `src/components/sales/EfrisStatusBadge.tsx` | Status badge for sales |
| `src/components/dashboard/EfrisStatusWidget.tsx` | Dashboard widget |
| `src/app/c/[slug]/reports/efris/page.tsx` | EFRIS report page |
| `src/components/print/templates/ReceiptTemplate.tsx` | Receipt with EFRIS data |

## Adding New EFRIS Endpoints

### Pattern for API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { requireEfrisFeature, getEfrisClientOrError } from '@/lib/integration/efris-guards'
import { logError } from '@/lib/ai/error-logger'

export async function POST(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    // Get EFRIS client
    const clientResult = await getEfrisClientOrError(tenantId)
    if (clientResult instanceof NextResponse) return clientResult
    if (!clientResult) {
      return NextResponse.json({ error: 'EFRIS client not initialized' }, { status: 500 })
    }

    const { client } = clientResult
    // ... your logic here

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('api/efris/your-endpoint', error)
    return NextResponse.json({ error: 'Failed to ...' }, { status: 500 })
  }
}
```

### Pattern for Service Functions

```typescript
import { db } from '@/lib/db'
import { getEfrisClient } from '@/lib/integration/efris'
import { logToFile } from '@/lib/logging/file-logger'
import { logError } from '@/lib/ai/error-logger'

export async function yourEFRisFunction(tenantId: string, data: any) {
  try {
    // 1. Fetch tenant config
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant?.efrisEnabled || !tenant?.efrisTin || !tenant?.efrisToken) {
      return { success: false, message: 'EFRIS not configured' }
    }

    // 2. Get client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, message: 'Failed to initialize EFRIS client' }
    }

    // 3. Call EFRIS API
    await client.yourMethod(data)

    // 4. Log success
    logToFile('INFO', 'EFRIS_YOUR_OP', 'Success', { tenantId })

    return { success: true, message: 'Success' }
  } catch (error: any) {
    logError('efris-your-function', error)
    return { success: false, message: error.message }
  }
}
```

## Testing with EFRIS Sandbox

1. Set `EFRIS_ENVIRONMENT=test` in `.env`
2. Use test TIN and token provided by WEAF
3. Test API base URL defaults to `https://test-api.weafefrisapi.space`

### Running Unit Tests

```bash
npm test -- efris
```

Tests cover:
- EfrisClient HTTP interactions
- Product mapping logic
- Invoice payload building
- Error message mapping
- Validation functions

## Database Migrations

EFRIS columns are added via:
- `src/lib/db/migrations/add_efris_columns.sql`

Key tables modified:
- `tenants` (efris_enabled, efris_tin, efris_token)
- `items` (efris_item_code, efris_tax_form, efris_tax_rule)
- `sales` (efris_* fields + retry fields)

## Environment Variables

```env
# EFRIS Environment: 'test' or 'production'
EFRIS_ENVIRONMENT=test

# Test API base URL (default: https://test-api.weafefrisapi.space)
EFRIS_TEST_BASE_URL=

# Production API base URL (default: https://api.weafefrisapi.space)
EFRIS_PRODUCTION_BASE_URL=

# Enable automatic retry for failed submissions (optional)
EFRIS_AUTO_RETRY=true
```

## Feature Gating

EFRIS is gated to Enterprise tier via:
1. **Pricing Tiers**: `features.efris = true` only for enterprise tier
2. **Guards**: `requireEfrisFeature()` checks tenant subscription
3. **UI**: Components check `planEligible` before showing EFRIS features

## Error Handling

EFRIS errors are mapped to user-friendly messages via `efris-errors.ts`:
- Authentication errors → "Contact your system administrator"
- Item errors → "Register items in Inventory"
- Network errors → "Will retry automatically"
- Duplicate errors → "No action needed"

Use `mapEfrisErrorToUserMessage()` to convert raw errors.

## Common Patterns

### Fire-and-Forget EFRIS Call

```typescript
// After persisting data, fire EFRIS call without blocking response
const saleForEfris = result
;(async () => {
  try {
    const { submitSaleToEfris } = await import('@/lib/integration/efris-submitter')
    await submitSaleToEfris(saleForEfris.id, tenantId)
  } catch (efrisError) {
    console.error('[EFRIS] Auto-submit failed:', efrisError)
    // Will be retried by background job
  }
})()

return NextResponse.json(result)
```

### Dynamic Import for EFRIS

Always use dynamic imports for EFRIS modules to avoid bundling issues:

```typescript
const { syncStockOnPurchase } = await import('@/lib/integration/efris-stock')
```

## Troubleshooting Development Issues

### "EfrisClient is not a constructor"
Ensure you're importing the class correctly:
```typescript
import { EfrisClient } from '@/lib/integration/efris'
```

### "EFRIS columns not found in schema"
Run the migration:
```bash
npm run db:migrate
```

### "Tests fail with fetch mock errors"
Ensure `global.fetch` is mocked in your test file:
```typescript
const mockFetch = vi.fn()
global.fetch = mockFetch
```

---

**Last Updated:** April 2026
**Version:** 1.0
