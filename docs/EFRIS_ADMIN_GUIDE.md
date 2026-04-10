# EFRIS Admin Guide

## Overview

This guide is for system administrators who manage EFRIS configuration across multiple tenants. EFRIS configuration is exclusively managed through the Super Admin control panel.

## Prerequisites

1. Access to the Super Admin panel (`/sys-control`)
2. Valid URA TIN (Tax Identification Number) for each tenant
3. Valid WEAF API token for authentication

## Enabling EFRIS for a Tenant

### Step 1: Verify Tenant Eligibility
Only tenants on the **Enterprise plan** (`plan: 'premium'` or subscription tier `name: 'enterprise'`) can have EFRIS enabled.

1. Log in to the Super Admin panel
2. Navigate to **EFRIS** from the sidebar
3. Verify the tenant shows "Enterprise" in the Plan column

### Step 2: Configure EFRIS
1. Click **"Configure"** next to the tenant
2. In the modal:
   - Toggle **"Enable EFRIS"** to ON
   - Enter the **EFRIS TIN** (format: `UG` + 10 digits, e.g., `UG1234567890`)
   - Enter the **API Token** (provided by WEAF/URA)
   - Click **"Save Configuration"**

### Step 3: Test Connection
1. After saving, click the **"Test Connection"** button (green checkmark icon)
2. A success message will appear if the connection is valid
3. If the test fails, verify the TIN and token are correct

### Step 4: Verify Tenant View
1. Ask the tenant user to check their Settings page
2. They should see "EFRIS Enabled" with their masked TIN

## Managing Multiple Tenants

### Bulk Operations
1. Click **"Select Multiple"** at the top of the EFRIS management page
2. Select tenants using checkboxes
3. Click **"Enable Selected"** or **"Disable Selected"**

**Note:** Bulk enable requires that all selected tenants already have TIN and token configured.

### Filtering Tenants
Use the filters to find specific tenants:
- **Search**: By tenant name or slug
- **Country**: Default is Uganda (UG), can show all countries
- **Status**: Filter by Enabled/Disabled/Not Configured

## Monitoring EFRIS Submissions

### Retry Failed Submissions
1. Navigate to **EFRIS** in the admin panel
2. Scroll to the bottom (or find the retry section)
3. Click **"Retry Failed Submissions"**
4. The system will:
   - Find all failed submissions across all tenants
   - Retry with exponential backoff (1min, 2min, 4min, 8min, 16min)
   - Maximum 5 retries per submission
   - Report results (succeeded/still failed)

### Monitoring via Logs
EFRIS operations are logged with category `EFRIS_*`. Check:
- **Error Logs** in the admin panel
- Application logs for `EFRIS_API`, `EFRIS_SUBMIT`, `EFRIS_RETRY` categories

## Troubleshooting Admin Issues

### "EFRIS is only available on the Enterprise plan"
**Cause:** Attempting to enable EFRIS for a non-Enterprise tenant.
**Solution:** Upgrade the tenant's subscription to Enterprise first.

### "TIN and API Token are required to enable EFRIS"
**Cause:** Trying to enable EFRIS without providing credentials.
**Solution:** Fill in both TIN and Token fields before enabling.

### "Invalid TIN format"
**Cause:** TIN doesn't match the required format.
**Solution:** Ensure TIN format is `UG` followed by exactly 10 digits (e.g., `UG1234567890`).

### "Connection test failed"
**Possible Causes:**
1. Invalid API token
2. Invalid TIN
3. Network connectivity issues
4. EFRIS API downtime

**Solutions:**
1. Verify the token with WEAF/URA
2. Double-check the TIN format
3. Check network connectivity to `https://test-api.weafefrisapi.space` (test) or `https://api.weafefrisapi.space` (production)
4. Check EFRIS API status page

## Environment Configuration

Add these variables to your `.env` file:

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

## Database Schema

EFRIS adds the following columns:

### Tenants Table
- `efris_enabled` (boolean): Whether EFRIS is enabled
- `efris_tin` (varchar): Tax Identification Number
- `efris_token` (text): API authentication token

### Items Table
- `efris_item_code` (varchar): EFRIS product code
- `efris_tax_form` (varchar): Tax form code (e.g., '101')
- `efris_tax_rule` (varchar): Tax rule (e.g., 'STANDARD')

### Sales Table
- `efris_invoice_no` (varchar): EFRIS fiscal invoice number
- `efris_antifake_code` (varchar): Anti-fake verification code
- `efris_qr_code` (text): QR code data
- `efris_status` (varchar): Submission status (pending/success/failed)
- `efris_error` (text): Error message if failed
- `efris_submitted_at` (timestamp): When submitted
- `efris_retry_count` (integer): Number of retry attempts
- `efris_last_retry_at` (timestamp): Last retry timestamp

## Security Considerations

1. **Token Storage**: EFRIS tokens are stored in plaintext in the database. Ensure database access is restricted.
2. **Masked Display**: TINs are masked in the UI (e.g., `UG******123`) to protect sensitive information.
3. **Admin-Only Configuration**: Tenants cannot modify EFRIS settings themselves. Only super admins can configure credentials.
4. **Audit Logging**: All EFRIS configuration changes are logged in the admin audit log.

## API Endpoints

### Super Admin Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sys-control/efris/tenants` | List all tenants with EFRIS status |
| GET | `/api/sys-control/efris/:tenantId` | Get specific tenant's EFRIS config |
| PUT | `/api/sys-control/efris/:tenantId` | Update tenant EFRIS config |
| POST | `/api/sys-control/efris/:tenantId/test` | Test EFRIS connection |
| POST | `/api/sys-control/efris/retry-failed` | Retry failed submissions |

### Tenant Endpoints (Read-Only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/settings/efris` | Get current tenant's EFRIS status |
| GET | `/api/efris/products` | List items with EFRIS codes |
| POST | `/api/efris/products/sync` | Sync products from EFRIS |
| PUT | `/api/efris/products/register` | Register single item |
| PATCH | `/api/efris/products/bulk-register` | Bulk register items |
| POST | `/api/sales/[id]/efris/resubmit` | Resubmit failed sale |
| GET | `/api/reports/efris-submissions` | View submission report |

## Cron Jobs

To enable automatic retry of failed submissions, add this to your cron scheduler:

```typescript
import cron from 'node-cron'
import { runEfrisRetryCron } from '@/lib/cron/efris-retry'

// Run every 15 minutes
cron.schedule('*/15 * * * *', runEfrisRetryCron)
```

**Note:** The cron job only runs if `EFRIS_AUTO_RETRY=true` is set in the environment.

---

**Last Updated:** April 2026
**Version:** 1.0
