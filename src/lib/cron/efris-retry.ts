/**
 * EFRIS Auto-Retry Cron Job
 * 
 * Runs every 15 minutes to retry failed EFRIS submissions.
 * Only runs if EFRIS_AUTO_RETRY environment variable is set to 'true'.
 * 
 * Usage:
 * - Import and call from your cron scheduler
 * - Or use with node-cron / similar library
 */

import { retryFailedSubmissions, getRetryStats } from '@/lib/integration/efris-retry-queue'
import { logToFile } from '@/lib/logging/file-logger'
import { logError } from '@/lib/ai/error-logger'

const BATCH_SIZE = 50
const CRON_ENABLED = process.env.EFRIS_AUTO_RETRY === 'true'

/**
 * Execute the EFRIS retry cron job
 * 
 * @returns Summary of the retry operation or null if cron is disabled
 */
export async function runEfrisRetryCron(): Promise<{
  success: boolean
  message: string
  stats?: any
  results?: any
} | null> {
  if (!CRON_ENABLED) {
    return null
  }

  try {
    logToFile('INFO', 'EFRIS_CRON', 'Starting EFRIS retry cron job')

    // Get stats before retry
    const beforeStats = await getRetryStats()

    // Execute retry
    const results = await retryFailedSubmissions(BATCH_SIZE)

    // Get stats after retry
    const afterStats = await getRetryStats()

    const summary = {
      success: true,
      message: `EFRIS retry cron completed. Processed ${results.total} submissions: ${results.succeeded} succeeded, ${results.stillFailed} still failed, ${results.skipped} skipped`,
      beforeStats,
      afterStats,
      results: {
        total: results.total,
        succeeded: results.succeeded,
        stillFailed: results.stillFailed,
        skipped: results.skipped,
      },
    }

    logToFile('INFO', 'EFRIS_CRON_COMPLETE', summary.message, summary.results)

    return summary
  } catch (error) {
    logError('efris-cron/runEfrisRetryCron', error)
    return {
      success: false,
      message: `EFRIS retry cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get current retry queue stats (for monitoring endpoints)
 */
export async function getEfrisRetryQueueStats() {
  return getRetryStats()
}
