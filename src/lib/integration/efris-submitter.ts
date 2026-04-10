import { db } from '@/lib/db'
import { sales, saleItems, tenants, customers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { EfrisClient, getEfrisClient } from '@/lib/integration/efris'
import { buildInvoicePayload, buildCreditNotePayload, validateSaleForEfris } from '@/lib/integration/efris-invoice-builder'
import { logToFile } from '@/lib/logging/file-logger'
import { logError } from '@/lib/ai/error-logger'

/**
 * Submits a sale to EFRIS
 * 
 * @param saleId - The sale ID to submit
 * @param tenantId - The tenant ID
 * @returns Result of the submission
 */
export async function submitSaleToEfris(saleId: string, tenantId: string): Promise<{
  success: boolean
  efrisInvoiceNo?: string
  efrisAntifakeCode?: string
  efrisQrCode?: string
  error?: string
}> {
  try {
    // Fetch sale with items and tenant
    const sale = await db.query.sales.findFirst({
      where: and(eq(sales.id, saleId), eq(sales.tenantId, tenantId)),
      with: {
        items: true,
      },
    })

    if (!sale) {
      return { success: false, error: 'Sale not found' }
    }

    // Fetch tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant) {
      return { success: false, error: 'Tenant not found' }
    }

    // Check if EFRIS is enabled
    if (!tenant.efrisEnabled || !tenant.efrisTin || !tenant.efrisToken) {
      return { success: false, error: 'EFRIS not configured for this tenant' }
    }

    // Check idempotency
    if (sale.efrisStatus === 'success') {
      logToFile('INFO', 'EFRIS_SUBMIT', 'Sale already submitted to EFRIS, skipping', {
        saleId,
        tenantId,
        efrisInvoiceNo: sale.efrisInvoiceNo,
      })
      return {
        success: true,
        efrisInvoiceNo: sale.efrisInvoiceNo || undefined,
        efrisAntifakeCode: sale.efrisAntifakeCode || undefined,
        efrisQrCode: sale.efrisQrCode || undefined,
      }
    }

    // Validate sale
    const validation = validateSaleForEfris(sale, sale.items, tenant)
    if (!validation.isValid) {
      // Mark as failed
      await db.update(sales)
        .set({
          efrisStatus: 'failed',
          efrisError: validation.error,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleId))

      return { success: false, error: validation.error }
    }

    // Fetch customer if present
    let customer = null
    if (sale.customerId) {
      customer = await db.query.customers.findFirst({
        where: eq(customers.id, sale.customerId),
      })
    }

    // Get EFRIS client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, error: 'Failed to initialize EFRIS client' }
    }

    // Build invoice payload
    const isReturn = sale.isReturn || false
    const payload = buildInvoicePayload(sale, sale.items, tenant, customer, isReturn)

    logToFile('INFO', 'EFRIS_SUBMIT', 'Submitting sale to EFRIS', {
      saleId,
      tenantId,
      tin: tenant.efrisTin,
      isReturn,
      invoiceType: payload.basicInformation.invoiceType,
      itemCount: payload.itemsBought.length,
    })

    let response
    try {
      // Submit to EFRIS (invoice for B2B, receipt for POS/walk-in)
      if (payload.basicInformation.invoiceType === 1) {
        response = await client.generateInvoice(payload)
      } else {
        response = await client.generateReceipt(payload)
      }
    } catch (efrisError: any) {
      // Mark as failed
      await db.update(sales)
        .set({
          efrisStatus: 'failed',
          efrisError: efrisError.message || 'EFRIS API error',
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleId))

      logToFile('ERROR', 'EFRIS_SUBMIT', 'EFRIS API error', {
        saleId,
        tenantId,
        error: efrisError.message,
      })

      return { success: false, error: efrisError.message || 'EFRIS API error' }
    }

    // Extract EFRIS data from response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData = response as any
    const efrisInvoiceNo = responseData?.data?.basicInformation?.invoiceNo
    const efrisAntifakeCode = responseData?.data?.basicInformation?.antifakeCode
    const efrisQrCode = responseData?.data?.summary?.qrCode

    if (!efrisInvoiceNo) {
      // Mark as failed
      await db.update(sales)
        .set({
          efrisStatus: 'failed',
          efrisError: 'No invoice number returned from EFRIS',
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleId))

      return { success: false, error: 'No invoice number returned from EFRIS' }
    }

    // Update sale with EFRIS data
    await db.update(sales)
      .set({
        efrisInvoiceNo,
        efrisAntifakeCode,
        efrisQrCode,
        efrisStatus: 'success',
        efrisSubmittedAt: new Date(),
        efrisError: null,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))

    logToFile('INFO', 'EFRIS_SUBMIT', 'Sale submitted to EFRIS successfully', {
      saleId,
      tenantId,
      efrisInvoiceNo,
      efrisAntifakeCode: efrisAntifakeCode ? '***' : null,
    })

    // TODO: Broadcast change to update UI in real-time
    // await logAndBroadcast(tenantId, 'sale', 'efris_submitted', saleId)

    return {
      success: true,
      efrisInvoiceNo,
      efrisAntifakeCode,
      efrisQrCode,
    }
  } catch (error: any) {
    logError('efris-submitter/submitSaleToEfris', error)

    // Mark as failed
    await db.update(sales)
      .set({
        efrisStatus: 'failed',
        efrisError: error.message || 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))

    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Submits a return sale to EFRIS as a credit note
 * 
 * @param saleId - The return sale ID
 * @param originalInvoiceNo - Original EFRIS invoice number being returned
 * @param tenantId - The tenant ID
 * @returns Result of the submission
 */
export async function submitReturnToEfris(
  saleId: string,
  originalInvoiceNo: string,
  tenantId: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Fetch return sale
    const sale = await db.query.sales.findFirst({
      where: and(eq(sales.id, saleId), eq(sales.tenantId, tenantId)),
    })

    if (!sale) {
      return { success: false, error: 'Return sale not found' }
    }

    // Fetch tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant || !tenant.efrisEnabled || !tenant.efrisTin || !tenant.efrisToken) {
      return { success: false, error: 'EFRIS not configured for this tenant' }
    }

    // Check idempotency
    if (sale.efrisStatus === 'success') {
      return { success: true }
    }

    // Get EFRIS client
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return { success: false, error: 'Failed to initialize EFRIS client' }
    }

    // Build credit note payload
    const creditNotePayload = buildCreditNotePayload(sale, originalInvoiceNo)

    logToFile('INFO', 'EFRIS_RETURN', 'Submitting return to EFRIS', {
      saleId,
      tenantId,
      originalInvoiceNo,
    })

    let response
    try {
      response = await client.applyCreditNote(creditNotePayload)
    } catch (efrisError: any) {
      await db.update(sales)
        .set({
          efrisStatus: 'failed',
          efrisError: efrisError.message || 'EFRIS API error',
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleId))

      logToFile('ERROR', 'EFRIS_RETURN', 'EFRIS API error', {
        saleId,
        tenantId,
        error: efrisError.message,
      })

      return { success: false, error: efrisError.message || 'EFRIS API error' }
    }

    // Update sale with success status
    await db.update(sales)
      .set({
        efrisStatus: 'success',
        efrisSubmittedAt: new Date(),
        efrisError: null,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))

    logToFile('INFO', 'EFRIS_RETURN', 'Return submitted to EFRIS successfully', {
      saleId,
      tenantId,
      originalInvoiceNo,
    })

    return { success: true }
  } catch (error: any) {
    logError('efris-submitter/submitReturnToEfris', error)

    await db.update(sales)
      .set({
        efrisStatus: 'failed',
        efrisError: error.message || 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))

    return { success: false, error: error.message || 'Unknown error' }
  }
}
