import { items } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'

type Item = InferSelectModel<typeof items>

/**
 * EFRIS Product Registration Format
 * Matches the format expected by WEAF EFRIS API
 */
export interface EfrisProductRegistration {
  goodsCode?: string          // EFRIS-assigned product code (for existing products)
  goodsName: string           // Product name
  goodsType: string           // '1' for goods, '2' for services
  unit: string                // Unit of measurement (e.g., 'PCS', 'KG', 'L')
  unitPrice: number           // Selling price
  taxForm: string             // Tax form code (e.g., '101' for standard VAT)
  taxRule: string             // Tax rule (e.g., 'STANDARD')
  currency?: string           // Currency code (e.g., 'UGX')
  hasExemption?: string       // '1' if exempt, '2' if not (default: '2')
  hasZeroRate?: string        // '1' if zero-rated, '2' if not (default: '2')
}

/**
 * EFRIS Product from Sync Response
 */
export interface EfrisSyncedProduct {
  goodsCode: string
  goodsName: string
  goodsType: string
  unit: string
  unitPrice: string
  taxForm: string
  taxRule: string
}

/**
 * Maps a local item to EFRIS product registration format
 * 
 * @param item - The local item record
 * @param currency - Currency code (default: 'UGX')
 * @returns EfrisProductRegistration object ready for EFRIS API
 */
export function mapItemToEfrisProduct(item: Item, currency: string = 'UGX'): EfrisProductRegistration {
  // Determine goods type based on item characteristics
  const goodsType = item.trackStock !== false ? '1' : '2' // 1=goods, 2=services

  // Map unit to EFRIS standard units
  const unitMap: Record<string, string> = {
    'pcs': 'PCS',
    'kg': 'KG',
    'g': 'G',
    'l': 'L',
    'ml': 'ML',
    'm': 'M',
    'cm': 'CM',
    'box': 'BOX',
    'pack': 'PACK',
    'set': 'SET',
    'dozen': 'DOZ',
  }

  const unit = unitMap[item.unit?.toLowerCase() || 'pcs'] || 'PCS'

  // Determine tax form and rule
  // Default to '101' (standard VAT form) and 'STANDARD' rule
  const taxForm = item.efrisTaxForm || '101'
  const taxRule = item.efrisTaxRule || 'STANDARD'

  // Parse selling price
  const unitPrice = parseFloat(item.sellingPrice) || 0

  return {
    goodsCode: item.efrisItemCode || undefined,
    goodsName: item.name,
    goodsType,
    unit,
    unitPrice,
    taxForm,
    taxRule,
    currency,
    hasExemption: '2', // Not exempt by default
    hasZeroRate: '2',  // Not zero-rated by default
  }
}

/**
 * Matches an EFRIS product to a local item by name or SKU
 * 
 * @param efrisProduct - Product from EFRIS sync response
 * @param localItems - Array of local items to match against
 * @returns Matched item or null
 */
export function matchEfrisProductToLocal(
  efrisProduct: EfrisSyncedProduct,
  localItems: Item[]
): Item | null {
  // Try exact name match first
  const exactMatch = localItems.find(
    item => item.name.toLowerCase() === efrisProduct.goodsName.toLowerCase()
  )
  if (exactMatch) return exactMatch

  // Try SKU match if goodsCode matches SKU
  const skuMatch = localItems.find(
    item => item.sku?.toLowerCase() === efrisProduct.goodsCode.toLowerCase()
  )
  if (skuMatch) return skuMatch

  // Try partial name match (contains)
  const partialMatch = localItems.find(
    item => item.name.toLowerCase().includes(efrisProduct.goodsName.toLowerCase()) ||
            efrisProduct.goodsName.toLowerCase().includes(item.name.toLowerCase())
  )
  if (partialMatch) return partialMatch

  return null
}

/**
 * Validates if an item is ready for EFRIS registration
 * 
 * @param item - The item to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateItemForEfris(item: Item): { isValid: boolean; error?: string } {
  if (!item.name || item.name.trim().length === 0) {
    return { isValid: false, error: 'Item name is required' }
  }

  if (!item.sellingPrice || parseFloat(item.sellingPrice) <= 0) {
    return { isValid: false, error: 'Item must have a valid selling price' }
  }

  if (item.efrisItemCode) {
    return { isValid: false, error: 'Item already has an EFRIS code assigned' }
  }

  return { isValid: true }
}

/**
 * Extracts EFRIS mapping status for an item
 * 
 * @param item - The item to check
 * @returns Status object for UI display
 */
export function getEfrisMappingStatus(item: Item) {
  if (item.efrisItemCode) {
    return {
      status: 'mapped' as const,
      label: 'Mapped',
      code: item.efrisItemCode,
      taxForm: item.efrisTaxForm || '101',
      taxRule: item.efrisTaxRule || 'STANDARD',
    }
  }

  // Check if item is valid for mapping
  const validation = validateItemForEfris(item)
  if (!validation.isValid) {
    return {
      status: 'error' as const,
      label: 'Invalid',
      error: validation.error,
    }
  }

  return {
    status: 'pending' as const,
    label: 'Not Mapped',
  }
}
