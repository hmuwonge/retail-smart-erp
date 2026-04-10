import { db } from '@/lib/db'
import { sales, saleItems, customers, items } from '@/lib/db/schema'
import { eq, and, ilike, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

export interface QBInvoice {
  Id: string
  DocNumber?: string
  TxnDate: string
  TotalAmt: number
  Balance: number
  CustomerRef: { value: string; name: string }
  Line: Array<{
    Id: string
    LineNum?: number
    Amount: number
    DetailType: string
    SalesItemLineDetail?: {
      ItemRef: { value: string; name: string }
      UnitPrice?: number
      Qty?: number
    }
  }>
}

/**
 * Maps a QuickBooks Invoice to our Sales/SaleItems.
 * 
 * NOTE: This mapper assumes Customers and Items have ALREADY been imported.
 * It performs "Resolution" by matching Names/Emails to find our internal IDs.
 */
export async function mapAndImportQBInvoice(
  qbInvoice: QBInvoice,
  tenantId: string
): Promise<{ action: 'created' | 'skipped'; id: string }> {
  
  // 1. Resolve Customer
  // QB Invoices link to CustomerRef.value (QB ID), but we don't have that stored.
  // We must match by Name. If QB has the email, even better.
  // For now, we match by Customer Name.
  const customerName = qbInvoice.CustomerRef.name
  
  let customerId = null

  // Try exact name match
  const existingCustomer = await db.query.customers.findFirst({
    where: and(
      eq(customers.tenantId, tenantId),
      eq(customers.name, customerName)
    ),
  })
  
  // Try partial match
  if (!existingCustomer) {
     const partial = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        ilike(customers.name, `%${customerName}%`)
      )
    })
    if (partial) customerId = partial.id
  } else {
    customerId = existingCustomer.id
  }

  if (!customerId) {
    // Orphan invoice? Skip or create with "Unknown Customer".
    // Let's skip for now to keep data clean.
    return { action: 'skipped', id: qbInvoice.Id }
  }

  // 2. Check if Invoice already exists (by DocNumber + Customer + Date)
  const qbDocNo = qbInvoice.DocNumber || `QB-${qbInvoice.Id}`
  
  // We don't have a direct QB ID field on Sales, so we look for a sale with this invoice number.
  // Risk: User might have duplicate invoice numbers.
  // Better heuristic: Check InvoiceNo + Total + Customer.
  const existingSale = await db.query.sales.findFirst({
    where: and(
      eq(sales.tenantId, tenantId),
      eq(sales.customerId, customerId),
      eq(sales.invoiceNo, qbDocNo)
    ),
  })

  if (existingSale) {
    return { action: 'skipped', id: existingSale.id }
  }

  // 3. Map Lines
  const mappedLines = []
  
  for (const line of qbInvoice.Line) {
    if (line.DetailType === 'SalesItemLineDetail' && line.SalesItemLineDetail) {
      const itemName = line.SalesItemLineDetail.ItemRef.name
      const qty = line.SalesItemLineDetail.Qty || 1
      const unitPrice = line.SalesItemLineDetail.UnitPrice || 0
      
      // Resolve Item
      // Match by SKU or Name
      let itemId = null
      
      // Try Name Match
      const itemMatch = await db.query.items.findFirst({
        where: and(
          eq(items.tenantId, tenantId),
          eq(items.name, itemName)
        )
      })
      
      if (itemMatch) itemId = itemMatch.id

      mappedLines.push({
        itemId, // Can be null if item not found (Service item not imported?)
        itemName,
        quantity: String(qty),
        unitPrice: String(unitPrice),
        discount: '0',
        lineTotal: String(line.Amount), // Use QB's calculated amount
      })
    }
  }

  // 4. Insert Sale
  const saleTotal = qbInvoice.TotalAmt
  const isPaid = qbInvoice.Balance === 0 // Simplified logic
  const status = isPaid ? 'completed' : 'pending' // Rough guess

  try {
    const [newSale] = await db.insert(sales).values({
      tenantId,
      customerId,
      invoiceNo: qbDocNo,
      status,
      total: String(saleTotal),
      subtotal: String(saleTotal), // Tax breakdown not parsed here
      taxAmount: '0',
      discountAmount: '0',
      paidAmount: isPaid ? String(saleTotal) : '0',
      paymentMethod: isPaid ? 'credit' : null, // Guess
      createdAt: new Date(qbInvoice.TxnDate),
    }).returning()

    // 5. Insert Sale Items
    const itemsToInsert = mappedLines.map(line => ({
      saleId: newSale.id,
      tenantId,
      itemId: line.itemId,
      itemName: line.itemName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      discount: line.discount,
    }))

    if (itemsToInsert.length > 0) {
      await db.insert(saleItems).values(itemsToInsert)
    }

    return { action: 'created', id: newSale.id }

  } catch (err) {
    logError('migration/invoice-mapper', err as Error)
    return { action: 'skipped', id: qbInvoice.Id }
  }
}
