# EFRIS User Guide

## What is EFRIS?

EFRIS (Electronic Fiscal Receipting and Invoicing System) is a Uganda Revenue Authority (URA) system that requires businesses to submit fiscal invoices and receipts for tax compliance. Our ERP system integrates directly with EFRIS via the WEAF API to automate this process.

## Who Can Use EFRIS?

EFRIS is a **premium feature** available exclusively to tenants on the **Enterprise plan**. If you're on a different plan, you'll need to upgrade to access EFRIS features.

## Checking Your EFRIS Status

1. Navigate to **Settings** from the main menu
2. Scroll to the **EFRIS Integration** section
3. You'll see one of the following statuses:

### EFRIS Enabled ✅
- You'll see a green "EFRIS Enabled" badge
- Your TIN (Tax Identification Number) will be displayed in masked format (e.g., `UG******123`)
- All sales will be automatically submitted to EFRIS

### EFRIS Not Configured ⚠️
- You'll see a yellow information banner
- Message: "EFRIS is not configured yet"
- **Action Required:** Contact your system administrator to enable EFRIS and configure your TIN and API token

### EFRIS Not Available 🔒
- You'll see a blue banner
- Message: "EFRIS is available exclusively on the Enterprise plan"
- **Action Required:** Upgrade your plan or contact your administrator

## Registering Products with EFRIS

Before you can submit sales to EFRIS, all items must be registered with EFRIS.

### Step 1: Navigate to EFRIS Products
1. Go to **Inventory** → **EFRIS Products**
   - Or navigate directly to `/c/[your-company]/inventory/efris`

### Step 2: View Product Status
You'll see a dashboard showing:
- **Mapped** (green): Products already registered with EFRIS
- **Not Mapped** (yellow): Products that need to be registered
- **Errors** (red): Products with validation issues

### Step 3: Register Products

**Option A: Sync from EFRIS**
1. Click the **"Sync from EFRIS"** button
2. The system will fetch all products from EFRIS and automatically match them to your local items by:
   - Exact name match
   - SKU match
   - Partial name match
3. Matched items will be automatically assigned EFRIS codes

**Option B: Register Individual Items**
1. Find items with "Not Mapped" status
2. Click the **"Register"** button next to each item
3. The item will be registered with EFRIS and assigned a code

**Option C: Bulk Register All**
1. Click the **"Bulk Register All"** button
2. All unmapped items will be registered at once (up to 50 at a time)
3. Review the results to see which items succeeded/failed

### Common Registration Errors

| Error | Solution |
|-------|----------|
| "Item name is required" | Edit the item and add a name |
| "Item must have a valid selling price" | Edit the item and set a selling price greater than 0 |
| "Item already has an EFRIS code" | This item is already registered |

## Viewing EFRIS Submission Status

### On Sales Receipts
When a sale is successfully submitted to EFRIS, the receipt will show:
- **Fiscal Invoice Number**: The official EFRIS invoice number
- **Anti-fake Code**: Verification code for authenticity
- **QR Code Data**: Machine-readable verification data

### In Sales List
1. Go to **Sales** → **All Sales**
2. Each sale shows its EFRIS status:
   - 🟢 **Success**: Submitted successfully (hover to see invoice number)
   - 🟡 **Pending**: Waiting to be submitted
   - 🔴 **Failed**: Submission failed (click "Resubmit" to retry)

### EFRIS Submissions Report
1. Navigate to **Reports** → **EFRIS Submissions**
2. View all submissions with filters:
   - Date range
   - Status (Success/Failed/Pending)
3. Export to CSV for record-keeping
4. Click "View Sale" to see sale details

## Troubleshooting Common Errors

### "EFRIS is not enabled for this tenant"
**Cause:** EFRIS hasn't been enabled for your company yet.
**Solution:** Contact your system administrator to enable EFRIS in the admin panel.

### "Items without EFRIS codes: [item names]"
**Cause:** Some items in the sale haven't been registered with EFRIS.
**Solution:** 
1. Go to Inventory → EFRIS Products
2. Register the missing items
3. Retry the sale or click "Resubmit" on the failed sale

### "EFRIS token expired or invalid"
**Cause:** The API token configured by your administrator has expired.
**Solution:** Contact your system administrator to update the API token.

### "EFRIS service unreachable"
**Cause:** Temporary network issue with the EFRIS API.
**Solution:** No action needed - the system will automatically retry failed submissions.

### "Invoice already submitted to EFRIS"
**Cause:** This sale was already submitted (possibly from a previous attempt).
**Solution:** No action needed. Check the sale details to see the EFRIS invoice number.

## Understanding Receipts

### POS Receipts (Thermal Printers)
When printed, receipts will show EFRIS data at the bottom:
```
----------------------------------------
Fiscal Inv:  EFRIS-2024-001234
Code:        ABC123DEF456...

[QR Code Data Block]
Scan to verify receipt
----------------------------------------
```

### Paper Receipts (A4/Letter)
Paper receipts include a dedicated EFRIS section with:
- Green badge indicating successful submission
- Fiscal invoice number
- Verification code
- QR code data block

## Getting Help

If you encounter issues with EFRIS:
1. Check the error message and refer to the troubleshooting table above
2. Contact your system administrator for configuration issues
3. Contact support for technical assistance

---

**Last Updated:** April 2026
**Version:** 1.0
