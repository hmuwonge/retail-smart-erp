import { db } from '@/lib/db'
import { items, warehouseStock, warehouses } from '@/lib/db/schema'
import { eq, and, ilike, isNull } from 'drizzle-orm'
import type { QBItem } from '@/lib/migration/providers/quickbooks-provider'

export interface MappedItem {
  name: string
  sku?: string
  description?: string
  sellingPrice: number
  costPrice?: number
  trackStock: boolean
  currentStock?: number
  unit?: string
}

/**
 * Maps a QuickBooks Item/Product/Service to our Items schema.
 */
export async function mapAndImportQBItem(
  qbItem: QBItem,
  tenantId: string
): Promise<{ action: 'created' | 'updated' | 'skipped'; id: string }> {
  // 1. Transform Data
  const name = qbItem.Name || 'Unknown Item'
  const sku = qbItem.Sku
  const sellingPrice = qbItem.UnitPrice || 0
  const costPrice = qbItem.PurchaseCost
  const description = qbItem.Description

  // Determine if we track stock
  const trackStock = qbItem.Type === 'Inventory' && qbItem.TrackQtyOnHand !== false

  const currentStock = trackStock ? (qbItem.QtyOnHand || 0) : undefined

  const mappedData: MappedItem = {
    name,
    sku,
    sellingPrice,
    costPrice,
    description,
    trackStock,
    currentStock,
    unit: 'pcs',
  }

  // 2. Check for Existing (Duplicate Detection)
  let existingItem = null

  if (sku) {
    existingItem = await db.query.items.findFirst({
      where: and(
        eq(items.tenantId, tenantId),
        eq(items.sku, sku)
      ),
    })
  }

  if (!existingItem) {
    existingItem = await db.query.items.findFirst({
      where: and(
        eq(items.tenantId, tenantId),
        ilike(items.name, name),
        isNull(items.sku)
      ),
    })
  }

  // 3. Insert or Update
  if (existingItem) {
    return { action: 'skipped', id: existingItem.id }
  } else {
    // Create new
    const [newItem] = await db.insert(items).values({
      tenantId,
      name,
      sku: sku || null,
      description: description || null,
      sellingPrice: String(sellingPrice),
      costPrice: costPrice ? String(costPrice) : '0',
      trackStock: trackStock,
      unit: 'pcs',
      isActive: qbItem.Active !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning()

    // Optional: Migrate Stock Quantity
    if (trackStock && currentStock !== undefined && currentStock > 0) {
      try {
        // Get Default Warehouse
        const defaultWh = await db.query.warehouses.findFirst({
          where: and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true))
        })

        if (defaultWh) {
          await db.insert(warehouseStock).values({
            warehouseId: defaultWh.id,
            itemId: newItem.id,
            currentStock: String(currentStock),
            minStock: '0',
            updatedAt: new Date(),
          })
        }
      } catch (err) {
        console.error('Failed to migrate stock for item:', name, err)
      }
    }
    
    return { action: 'created', id: newItem.id }
  }
}
