import type { InferSelectModel } from 'drizzle-orm'
import type { sales, saleItems, tenants, customers } from '@/lib/db/schema'
import type { EfrisInvoiceRequest } from '@/lib/integration/efris'

type Sale = InferSelectModel<typeof sales>
type SaleItem = InferSelectModel<typeof saleItems>
type Tenant = InferSelectModel<typeof tenants>
type Customer = InferSelectModel<typeof customers>

/**
 * Payment mode codes for EFRIS
 */
export const EFRIS_PAYMENT_MODES = {
  cash: '101',
  card: '102',
  mobile_money: '103',
  cheque: '104',
  credit: '105',
  bank_transfer: '106',
} as const

/**
 * Maps a sale to EFRIS invoice/receipt format
 * 
 * @param sale - The sale record
 * @param items - Sale line items
 * @param tenant - Tenant record
 * @param customer - Optional customer record
 * @param isReturn - Whether this is a return/credit note
 * @returns EfrisInvoiceRequest ready for EFRIS API
 */
export function buildInvoicePayload(
  sale: Sale,
  items: SaleItem[],
  tenant: Tenant,
  customer: Customer | null,
  isReturn: boolean = false
): EfrisInvoiceRequest {
  // Determine invoice type: 1=Invoice (B2B), 2=Receipt (POS/walk-in)
  const invoiceType = customer && customer.tin ? 1 : 2

  // Determine payment mode
  const paymentMethod = (sale.paymentMethod || 'cash').toLowerCase()
  const paymentMode = EFRIS_PAYMENT_MODES[paymentMethod as keyof typeof EFRIS_PAYMENT_MODES] || '101'

  // Build seller details
  const sellerDetails = {
    placeOfBusiness: tenant.address || tenant.name,
    referenceNo: sale.saleNo,
    issuedDate: formatEFRisDate(sale.createdAt),
    branchId: undefined, // Future: support multiple branches
  }

  // Build basic information
  const basicInformation = {
    operator: sale.cashierName || 'System',
    currency: tenant.currency || 'UGX',
    invoiceType,
    invoiceKind: 1, // 1=Sales, 2=Purchase
    paymentMode,
    invoiceIndustryCode: '101', // General
    isPreview: '0',
    isRefund: isReturn ? '1' : '0',
  }

  // Build buyer details
  const buyerDetails = customer ? {
    buyerTin: customer.tin || undefined,
    buyerBusinessName: customer.name || 'Walk-in Customer',
    buyerLegalName: customer.name || undefined,
    buyerType: customer.tin ? '0' : '1', // 0=Business, 1=Individual
    buyerAddress: customer.address || undefined,
    buyerEmail: customer.email || undefined,
    buyerMobilePhone: customer.phone || undefined,
    buyerLinePhone: undefined,
    buyerNinBrn: undefined,
    buyerPassportNum: undefined,
  } : {
    buyerBusinessName: 'Walk-in Customer',
    buyerType: '1', // Individual
  }

  // Build items list
  const itemsBought = items.map((item, index) => {
    const quantity = parseFloat(item.quantity || '1')
    const unitPrice = parseFloat(item.unitPrice || '0')
    const total = parseFloat(item.lineTotal || '0')
    const discount = parseFloat(item.discount || '0')
    const netAmount = total - discount

    return {
      itemCode: item.efrisItemCode || `ITEM_${index + 1}`,
      quantity,
      unitPrice,
      total,
      taxForm: item.efrisTaxForm || '101',
      taxRule: item.efrisTaxRule || 'STANDARD',
      netAmount,
      discountFlag: discount > 0 ? 1 : 2,
      deemedFlag: 2, // Not deemed
      discountTotal: discount.toFixed(2),
      exciseFlag: '2', // No excise duty by default
    }
  })

  return {
    sellerDetails,
    basicInformation,
    buyerDetails,
    itemsBought,
  }
}

/**
 * Maps a return sale to EFRIS credit note format
 * 
 * @param returnSale - The return sale record
 * @param originalInvoiceNo - Original EFRIS invoice number
 * @returns Credit note parameters for EFRIS API
 */
export function buildCreditNotePayload(
  returnSale: Sale,
  originalInvoiceNo: string
): {
  oriInvoiceNo: string
  reasonCode: string
  reason: string
  invoiceApplyCategoryCode: string
  remarks?: string
  sellersReferenceNo?: string
} {
  return {
    oriInvoiceNo: originalInvoiceNo,
    reasonCode: '1', // 1=Return, 2=Cancellation, 3=Discount
    reason: returnSale.notes || 'Goods returned',
    invoiceApplyCategoryCode: '1', // 1=Normal, 2=Special
    remarks: `Return sale ${returnSale.saleNo}`,
    sellersReferenceNo: returnSale.saleNo,
  }
}

/**
 * Formats a Date to EFRIS required format: DD/MM/YYYY HH:mm:ss
 */
function formatEFRisDate(date: Date): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Validates that a sale is ready for EFRIS submission
 * 
 * @param sale - The sale record
 * @param items - Sale line items
 * @param tenant - Tenant record
 * @returns Object with isValid flag and optional error message
 */
export function validateSaleForEfris(
  sale: Sale,
  items: SaleItem[],
  tenant: Tenant
): { isValid: boolean; error?: string } {
  // Check tenant eligibility
  if (!tenant.efrisEnabled) {
    return { isValid: false, error: 'EFRIS is not enabled for this tenant' }
  }

  if (!tenant.efrisTin || !tenant.efrisToken) {
    return { isValid: false, error: 'EFRIS is not fully configured (missing TIN or token)' }
  }

  // Check if already submitted
  if (sale.efrisStatus === 'success') {
    return { isValid: false, error: 'Sale already submitted to EFRIS' }
  }

  // Check sale status
  if (sale.status !== 'completed') {
    return { isValid: false, error: 'Sale must be completed to submit to EFRIS' }
  }

  // Check items have EFRIS codes
  const itemsWithoutCodes = items.filter(item => !item.efrisItemCode)
  if (itemsWithoutCodes.length > 0) {
    const itemNames = itemsWithoutCodes.map(i => i.name || 'Unknown').join(', ')
    return { isValid: false, error: `Items without EFRIS codes: ${itemNames}` }
  }

  // Check total is valid
  const total = parseFloat(sale.total || '0')
  if (total <= 0) {
    return { isValid: false, error: 'Sale total must be greater than zero' }
  }

  return { isValid: true }
}
