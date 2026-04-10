import { db } from '@/lib/db'
import { sales, tenants } from '@/lib/db/schema'
import { eq, and, lt, isNull, or, desc, sql } from 'drizzle-orm'
import { submitSaleToEfris } from '@/lib/integration/efris-submitter'
import { logToFile } from '@/lib/logging/file-logger'
import { logError } from '@/lib/ai/error-logger'

const MAX_RETRIES = 5

/**
 * Get failed EFRIS submissions that are eligible for retry
 * 
 * @param tenantId - Optional tenant filter
 * @param since - Optional date filter (only return sales created after this date)
 * @param limit - Maximum number of records to return
 * @returns Array of failed sales ready for retry
 */
export async function getFailedSubmissions(
  tenantId?: string,
  since?: string,
  limit: number = 50
) {
  const conditions = [
    eq(sales.efrisStatus, 'failed'),
    lt(sales.efrisRetryCount, MAX_RETRIES),
  ]

  if (tenantId) {
    conditions.push(eq(sales.tenantId, tenantId))
  }

  if (since) {
    conditions.push(sql`${sales.createdAt} >= ${new Date(since)}`)
  }

  // Also include sales that have never been retried (efrisRetryCount = 0 or null)
  conditions.push(
    or(
      lt(sales.efrisRetryCount, MAX_RETRIES),
      isNull(sales.efrisRetryCount)
    )!
  )

  const failedSales = await db.query.sales.findMany({
    where: and(...conditions),
    with: {
      tenant: true,
      items: true,
    },
    limit,
    orderBy: [desc(sales.createdAt)],
  })

  return failedSales
}

/**
 * Calculate retry delay using exponential backoff
 * 
 * Formula: delay = 2^retryCount * 60 seconds
 * - Retry 0: 1 minute
 * - Retry 1: 2 minutes
 * - Retry 2: 4 minutes
 * - Retry 3: 8 minutes
 * - Retry 4: 16 minutes
 * 
 * @param retryCount - Current retry count
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(retryCount: number): number {
  const baseDelayMs = 60 * 1000 // 1 minute
  return Math.pow(2, retryCount) * baseDelayMs
}

/**
 * Check if a failed sale is ready for retry based on exponential backoff
 * 
 * @param sale - The sale record to check
 * @returns True if enough time has passed since last retry
 */
export function isReadyForRetry(sale: typeof sales.$inferSelect): boolean {
  const retryCount = sale.efrisRetryCount || 0
  
  // Never tried before - ready immediately
  if (retryCount === 0 || !sale.efrisLastRetryAt) {
    return true
  }

  const delayMs = calculateRetryDelay(retryCount)
  const nextRetryAt = new Date(sale.efrisLastRetryAt.getTime() + delayMs)
  
  return new Date() >= nextRetryAt
}

/**
 * Retry all failed EFRIS submissions that are ready for retry
 * 
 * @param batchSize - Maximum number of submissions to process in one batch
 * @param tenantId - Optional tenant filter
 * @returns Summary of retry operation
 */
export async function retryFailedSubmissions(
  batchSize: number = 50,
  tenantId?: string
): Promise<{
  total: number
  succeeded: number
  stillFailed: number
  skipped: number
  results: Array<{
    saleId: string
    tenantId: string
    status: 'success' | 'failed' | 'skipped'
    error?: string
  }>
}> {
  try {
    // Get failed submissions
    const failedSales = await getFailedSubmissions(tenantId, undefined, batchSize)

    if (failedSales.length === 0) {
      return {
        total: 0,
        succeeded: 0,
        stillFailed: 0,
        skipped: 0,
        results: [],
      }
    }

    let succeeded = 0
    let stillFailed = 0
    let skipped = 0
    const results: Array<{
      saleId: string
      tenantId: string
      status: 'success' | 'failed' | 'skipped'
      error?: string
    }> = []

    for (const sale of failedSales) {
      try {
        // Check if this sale is ready for retry (exponential backoff)
        if (!isReadyForRetry(sale)) {
          skipped++
          results.push({
            saleId: sale.id,
            tenantId: sale.tenantId,
            status: 'skipped',
            error: 'Not yet ready for retry (exponential backoff)',
          })
          continue
        }

        // Check if tenant still has EFRIS enabled
        const tenant = sale.tenant
        if (!tenant.efrisEnabled || !tenant.efrisTin || !tenant.efrisToken) {
          results.push({
            saleId: sale.id,
            tenantId: sale.tenantId,
            status: 'skipped',
            error: 'EFRIS no longer enabled for tenant',
          })
          skipped++
          continue
        }

        // Increment retry count and timestamp
        const newRetryCount = (sale.efrisRetryCount || 0) + 1
        await db.update(sales)
          .set({
            efrisRetryCount: newRetryCount,
            efrisLastRetryAt: new Date(),
            // Reset status to pending so submitter knows to try again
            efrisStatus: 'pending',
            efrisError: null,
            updatedAt: new Date(),
          })
          .where(eq(sales.id, sale.id))

        logToFile('INFO', 'EFRIS_RETRY', `Retrying sale ${sale.id} (attempt ${newRetryCount}/${MAX_RETRIES})`, {
          saleId: sale.id,
          tenantId: sale.tenantId,
          tin: tenant.efrisTin,
        })

        // Submit to EFRIS
        const result = await submitSaleToEfris(sale.id, sale.tenantId)

        if (result.success) {
          succeeded++
          results.push({
            saleId: sale.id,
            tenantId: sale.tenantId,
            status: 'success',
          })

          logToFile('INFO', 'EFRIS_RETRY_SUCCESS', `Sale ${sale.id} successfully submitted on retry ${newRetryCount}`, {
            saleId: sale.id,
            tenantId: sale.tenantId,
            efrisInvoiceNo: result.efrisInvoiceNo,
          })
        } else {
          stillFailed++
          results.push({
            saleId: sale.id,
            tenantId: sale.tenantId,
            status: 'failed',
            error: result.error,
          })

          logToFile('ERROR', 'EFRIS_RETRY_FAILED', `Sale ${sale.id} still failed on retry ${newRetryCount}`, {
            saleId: sale.id,
            tenantId: sale.tenantId,
            error: result.error,
          })
        }
      } catch (error: any) {
        logError('efris-retry-queue/retryFailedSubmissions', error)
        stillFailed++
        results.push({
          saleId: sale.id,
          tenantId: sale.tenantId,
          status: 'failed',
          error: error.message || 'Unknown error',
        })
      }
    }

    return {
      total: failedSales.length,
      succeeded,
      stillFailed,
      skipped,
      results,
    }
  } catch (error: any) {
    logError('efris-retry-queue/retryFailedSubmissions', error)
    throw error
  }
}

/**
 * Get retry statistics for monitoring
 * 
 * @param tenantId - Optional tenant filter
 * @returns Statistics about EFRIS retry queue
 */
export async function getRetryStats(tenantId?: string) {
  const conditions = [
    eq(sales.efrisStatus, 'failed'),
    lt(sales.efrisRetryCount, MAX_RETRIES),
  ]

  if (tenantId) {
    conditions.push(eq(sales.tenantId, tenantId))
  }

  const failedSales = await db.query.sales.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      tenantId: true,
      efrisRetryCount: true,
      efrisLastRetryAt: true,
      createdAt: true,
    },
  })

  const stats = {
    total: failedSales.length,
    readyForRetry: failedSales.filter(s => isReadyForRetry(s)).length,
    waitingForBackoff: failedSales.filter(s => !isReadyForRetry(s)).length,
    byRetryCount: {} as Record<number, number>,
  }

  // Group by retry count
  for (const sale of failedSales) {
    const count = sale.efrisRetryCount || 0
    stats.byRetryCount[count] = (stats.byRetryCount[count] || 0) + 1
  }

  return stats
}
