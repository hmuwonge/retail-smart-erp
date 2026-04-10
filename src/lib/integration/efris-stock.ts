import { db } from '@/lib/db'
import { items, tenants, purchaseItems, purchaseReceipts } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getEfrisClient } from '@/lib/integration/efris'
import { logToFile } from '@/lib/logging/file-logger'
import { logError } from '@/lib/ai/error-logger'

/**
 * EFRIS Stock Adjustment Types
 */
export const EFRIS_STOCK_TYPES = {
  // Stock In Types
  stock_in: '101',      // Normal stock in (purchase)
  stock_return: '102',  // Customer return
  stock_adjustment_in: '103',  // Adjustment in

  // Stock Adjustment Types (for decrease)
  damage: '101',        // Damaged goods
  expiry: '102',        // Expired goods
  personal_use: '103',  // Personal use
  sample: '104',        // Samples given away
  theft: '105',         // Theft/loss
  adjustment_out: '106', // Adjustment out
} as const

/**
 * Format date for EFRIS API (DD/MM/YYYY)
 */
function formatEFRisDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Sync stock increase when goods are purchased/received from suppliers
 * 
 * @param purchaseReceiptId - The purchase receipt ID
 * @param tenantId - The tenant ID
 * @returns Result of the stock sync operation
 */
export async function syncStockOnPurchase(
  purchaseReceiptId: string,
  tenantId: string
): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    // Fetch tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant?.efrisEnabled || !tenant?.efrisTin || !tenant?.efrisToken) {
      return { success: false, message: 'EFRIS not configured for this tenant' }
    }

    // Fetch purchase receipt with items
    const receipt = await db.query.purchaseReceipts.findFirst({
      where: eq(purchaseReceipts.id, purchaseReceiptId),
    })

    if (!receipt) {
      return { success: false, message: 'Purchase receipt not found', error: 'NOT_FOUND' }
    }

    // Fetch receipt items
    const receiptItems = await db.query.purchaseItems.findMany({
      where: eq(purchaseItems.receiptId, purchaseReceiptId),
    })

    if (receiptItems.length === 0) {
      return { success: true, message: 'No items to sync' }
    }

    // Build stock items for EFRIS
    const stockInItems = await Promise.all(
      receiptItems.map(async (item) => {
        // Fetch item to get EFRIS code
        const localItem = await db.query.items.findFirst({
          where: eq(items.id, item.itemId),
        })

        if (!localItem?.efrisItemCode) {
          return null // Skip items not registered with EFRIS
        }

        return {
          itemCode: localItem.efrisItemCode,
          quantity: parseFloat(item.quantity || '0'),
          unitPrice: parseFloat(item.unitPrice || '0'),
          batchNo: item.batchNumber || null,
          expiryDate: item.expiryDate ? formatEFRisDate(new Date(item.expiryDate)) : null,
        }
      })
    )

    const validItems = stockInItems.filter(Boolean)

    if (validItems.length === 0) {
      return { success: true, message: 'No EFRIS-registered items in this receipt' }
    }

    // Get EFRIS client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, message: 'Failed to initialize EFRIS client' }
    }

    // Submit stock increase
    await client.increaseStock({
      stockInDate: formatEFRisDate(new Date()),
      stockInType: EFRIS_STOCK_TYPES.stock_in,
      stockInItem: validItems,
      supplierName: receipt.supplierName || undefined,
      supplierTin: undefined,
      remarks: `Purchase receipt ${receipt.receiptNo || receipt.id}`,
    })

    logToFile('INFO', 'EFRIS_STOCK', `Stock increased for purchase receipt ${purchaseReceiptId}`, {
      tenantId,
      receiptId: purchaseReceiptId,
      itemCount: validItems.length,
    })

    return {
      success: true,
      message: `Stock synced for ${validItems.length} items`,
    }
  } catch (error: any) {
    logError('efris-stock/syncStockOnPurchase', error)
    return {
      success: false,
      message: 'Failed to sync stock on purchase',
      error: error.message,
    }
  }
}

/**
 * Sync stock decrease for stock adjustments (damage, expiry, etc.)
 * 
 * @param adjustmentId - The stock adjustment ID
 * @param tenantId - The tenant ID
 * @param reason - Reason for adjustment (damage, expiry, personal_use, etc.)
 * @param items - Array of { itemCode, quantity }
 * @returns Result of the stock sync operation
 */
export async function syncStockOnAdjustment(
  tenantId: string,
  reason: 'damage' | 'expiry' | 'personal_use' | 'sample' | 'theft' | 'other',
  items: Array<{ itemCode: string; quantity: number }>,
  remarks?: string
): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    // Fetch tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant?.efrisEnabled || !tenant?.efrisTin || !tenant?.efrisToken) {
      return { success: false, message: 'EFRIS not configured for this tenant' }
    }

    // Map reason to EFRIS adjustment type
    const adjustTypeMap: Record<string, string> = {
      damage: EFRIS_STOCK_TYPES.damage,
      expiry: EFRIS_STOCK_TYPES.expiry,
      personal_use: EFRIS_STOCK_TYPES.personal_use,
      sample: EFRIS_STOCK_TYPES.sample,
      theft: EFRIS_STOCK_TYPES.theft,
      other: EFRIS_STOCK_TYPES.adjustment_out,
    }

    const adjustType = adjustTypeMap[reason] || EFRIS_STOCK_TYPES.adjustment_out

    // Get EFRIS client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, message: 'Failed to initialize EFRIS client' }
    }

    // Submit stock decrease
    await client.decreaseStock({
      adjustType,
      stockInItem: items,
      remarks: remarks || `Stock adjustment: ${reason}`,
    })

    logToFile('INFO', 'EFRIS_STOCK', `Stock decreased for adjustment (${reason})`, {
      tenantId,
      reason,
      itemCount: items.length,
    })

    return {
      success: true,
      message: `Stock decreased for ${items.length} items`,
    }
  } catch (error: any) {
    logError('efris-stock/syncStockOnAdjustment', error)
    return {
      success: false,
      message: 'Failed to sync stock on adjustment',
      error: error.message,
    }
  }
}

/**
 * Sync stock increase when items are returned from customers
 * 
 * @param returnSaleId - The return sale ID
 * @param tenantId - The tenant ID
 * @returns Result of the stock sync operation
 */
export async function syncStockOnReturn(
  returnSaleId: string,
  tenantId: string
): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    // Fetch tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant?.efrisEnabled || !tenant?.efrisTin || !tenant?.efrisToken) {
      return { success: false, message: 'EFRIS not configured for this tenant' }
    }

    // Fetch return sale with items
    const returnSale = await db.query.sales.findFirst({
      where: eq(sales.id, returnSaleId),
      with: {
        items: true,
      },
    })

    if (!returnSale) {
      return { success: false, message: 'Return sale not found', error: 'NOT_FOUND' }
    }

    // Build stock items for EFRIS
    const stockInItems = await Promise.all(
      returnSale.items.map(async (item) => {
        // Fetch item to get EFRIS code
        const localItem = await db.query.items.findFirst({
          where: eq(items.id, item.itemId),
        })

        if (!localItem?.efrisItemCode) {
          return null // Skip items not registered with EFRIS
        }

        return {
          itemCode: localItem.efrisItemCode,
          quantity: Math.abs(parseFloat(item.quantity || '0')), // Returns have negative quantities
          unitPrice: parseFloat(item.unitPrice || '0'),
          batchNo: null,
          expiryDate: null,
        }
      })
    )

    const validItems = stockInItems.filter(Boolean)

    if (validItems.length === 0) {
      return { success: true, message: 'No EFRIS-registered items in this return' }
    }

    // Get EFRIS client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, message: 'Failed to initialize EFRIS client' }
    }

    // Submit stock increase (customer return)
    await client.increaseStock({
      stockInDate: formatEFRisDate(new Date()),
      stockInType: EFRIS_STOCK_TYPES.stock_return,
      stockInItem: validItems,
      remarks: `Customer return ${returnSale.saleNo}`,
    })

    logToFile('INFO', 'EFRIS_STOCK', `Stock increased for return sale ${returnSaleId}`, {
      tenantId,
      returnSaleId,
      itemCount: validItems.length,
    })

    return {
      success: true,
      message: `Stock synced for ${validItems.length} returned items`,
    }
  } catch (error: any) {
    logError('efris-stock/syncStockOnReturn', error)
    return {
      success: false,
      message: 'Failed to sync stock on return',
      error: error.message,
    }
  }
}

/**
 * Manual stock sync with EFRIS (for bulk reconciliation)
 * 
 * @param tenantId - The tenant ID
 * @param items - Array of { itemCode, quantity, action: 'increase' | 'decrease' }
 * @param reason - Reason for the sync
 * @returns Result of the stock sync operation
 */
export async function manualStockSync(
  tenantId: string,
  items: Array<{ itemCode: string; quantity: number; action: 'increase' | 'decrease' }>,
  reason: string
): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    // Fetch tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant?.efrisEnabled || !tenant?.efrisTin || !tenant?.efrisToken) {
      return { success: false, message: 'EFRIS not configured for this tenant' }
    }

    const increaseItems = items.filter(i => i.action === 'increase')
    const decreaseItems = items.filter(i => i.action === 'decrease')

    // Get EFRIS client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, message: 'Failed to initialize EFRIS client' }
    }

    let successCount = 0

    // Process increases
    if (increaseItems.length > 0) {
      await client.increaseStock({
        stockInDate: formatEFRisDate(new Date()),
        stockInType: EFRIS_STOCK_TYPES.stock_adjustment_in,
        stockInItem: increaseItems.map(i => ({
          itemCode: i.itemCode,
          quantity: i.quantity,
          unitPrice: 0,
        })),
        remarks: `Manual sync: ${reason}`,
      })
      successCount += increaseItems.length
    }

    // Process decreases
    if (decreaseItems.length > 0) {
      await client.decreaseStock({
        adjustType: EFRIS_STOCK_TYPES.adjustment_out,
        stockInItem: decreaseItems.map(i => ({
          itemCode: i.itemCode,
          quantity: i.quantity,
        })),
        remarks: `Manual sync: ${reason}`,
      })
      successCount += decreaseItems.length
    }

    logToFile('INFO', 'EFRIS_STOCK', `Manual stock sync completed`, {
      tenantId,
      reason,
      itemCount: successCount,
    })

    return {
      success: true,
      message: `Stock synced for ${successCount} items`,
    }
  } catch (error: any) {
    logError('efris-stock/manualStockSync', error)
    return {
      success: false,
      message: 'Failed to perform manual stock sync',
      error: error.message,
    }
  }
}
