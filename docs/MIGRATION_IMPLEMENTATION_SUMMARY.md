# ERP Migration Feature — Implementation Summary

## 🎯 Overview
A multi-platform data migration system allowing users to seamlessly switch from accounting/ERP software (QuickBooks, FreshBooks, Zoho Books, Xero) to Retail Smart ERP. 

**Key Features:**
* **Zero Friction:** Users authenticate via OAuth — no manual exports or CSV uploads.
* **Intelligent Mapping:** Automatically maps external data fields to our schema, handling duplicates and updates.
* **Stock Migration:** Preserves inventory levels by importing stock into the default warehouse.
* **Real-time Wizard:** Interactive UI showing data counts, selection, and live progress.

---

## 🏗️ Architecture

### 1. Platform Providers (The Connectors)
Handle OAuth flows, token refresh, and API pagination for each specific platform.
* `QuickBooksProvider` (Intuit API, Realm ID)
* `FreshBooksProvider` (Business ID resolution)
* `ZohoBooksProvider` (Organization ID resolution)
* `XeroProvider` (Tenant ID resolution)

### 2. Data Mappers (The Translators)
Transform external JSON structures into our DB schema.
* **Specific Mappers:** Tailored for QuickBooks (`customer-mapper.ts`, `item-mapper.ts`).
* **Generic Mappers:** Unified logic for FreshBooks, Zoho, and Xero (`generic-mapper.ts`).
* **Duplicate Detection:** Matches records by Email/SKU/Name before inserting.

### 3. Migration Engine (The Brain)
Orchestrates the process:
1.  Fetch Connection from DB.
2.  Initialize correct Provider.
3.  Fetch all records for selected entities.
4.  Loop through records → Map → Insert/Update.
5.  Track progress in `migration_entity_progress`.

### 4. UI Components
* **Migration Page:** Landing page with platform cards.
* **Connection Modal:** Explains the OAuth flow.
* **Migration Wizard:** Handles Preview → Select → Migrate → Results.

---

## 📦 File Structure

```
src/lib/migration/
├── core/
│   └── migration-engine.ts           # Orchestrator
├── providers/
│   ├── quickbooks-provider.ts        # Intuit API
│   ├── freshbooks-provider.ts        # FreshBooks API
│   ├── zoho-books-provider.ts        # Zoho API
│   └── xero-provider.ts              # Xero API
├── mappers/
│   ├── customer-mapper.ts            # QB → Our Customers
│   ├── item-mapper.ts                # QB → Our Items (+ Stock)
│   ├── invoice-mapper.ts             # QB → Our Sales
│   └── generic-mapper.ts             # Generic mappers for other platforms
└── types/
    └── migration.ts                  # TypeScript interfaces

src/app/api/migration/
├── connect/[platform]/route.ts       # Initiate OAuth
├── callback/[platform]/route.ts      # Handle OAuth Callback
├── preview/route.ts                  # Get data counts
├── start/route.ts                    # Trigger migration
└── connections/route.ts              # Fetch user's connections

src/components/migration/
├── MigrationWizard.tsx               # Multi-step wizard UI
└── MigrationConnectionModal.tsx      # "Connect to..." modal

src/app/c/[slug]/settings/migration/
└── page.tsx                          # Migration dashboard

src/lib/db/
└── migrations/
    └── add_migration_tables.sql      # DB migration script
```

---

## 🗄️ Database Schema

**Tables Added:**
1.  `platform_connections`: Stores OAuth tokens (access/refresh) and Platform IDs (Realm ID, Org ID, etc.) per tenant.
2.  `migrations`: Tracks migration jobs (Status, StartedAt, CompletedAt).
3.  `migration_entity_progress`: Granular progress for each entity type (e.g., Customers: 100/100).
4.  `migration_errors`: Detailed error log for failed records.

---

## 🚀 User Flow

1.  **Dashboard:** User clicks "Switch / Migrate".
2.  **Select Platform:** User clicks "QuickBooks Online" card.
3.  **Authenticate:** User is redirected to Intuit, signs in, and clicks "Allow".
4.  **Callback:** User is redirected back. System saves tokens and shows the **Migration Wizard**.
5.  **Preview:** Wizard fetches counts: "Found 150 Customers, 83 Items, 50 Invoices."
6.  **Select:** User checks "Customers" and "Items".
7.  **Migrate:** User clicks "Start". System fetches data, maps it, and inserts it.
8.  **Results:** "Migration Complete. Created 148 Customers, Skipped 2."

---

## ⚙️ Environment Variables

Add these to `.env` to support the platforms:
```env
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
FRESHBOOKS_CLIENT_ID=
FRESHBOOKS_CLIENT_SECRET=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
```

---

## ⚠️ Troubleshooting

**Error:** `ReferenceError: migration_entity_progress is not defined`
**Fix:** Run `npm run db:push` to sync the new tables defined in `schema.ts`.

**Error:** `Missing Realm ID / Organization ID`
**Fix:** Ensure the OAuth Callback successfully fetched the ID from the provider (handled in `callback/route.ts`).

**Error:** `Provider not initialized (Missing IDs)`
**Fix:** Check that the `platform_connections` table has the correct ID populated for the specific platform (RealmId for QB, AccountId for FB, OrgId for Zoho, TenantId for Xero).
