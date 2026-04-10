import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sales, tenants } from '@/lib/db/schema'
import { eq, and, lt, desc, isNull, sql } from 'drizzle-orm'
import { validateAdminSession, adminAudit } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'
import { getEfrisClient } from '@/lib/integration/efris'

const MAX_RETRIES = 5

// POST /api/sys-control/efris/retry-failed - Trigger retry batch for failed EFRIS submissions
export async function POST(request: NextRequest) {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId, batchSize = 50, since } = body

    // Build query for failed submissions
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

    // Fetch failed sales with tenant info
    const failedSales = await db.query.sales.findMany({
      where: and(...conditions),
      with: {
        tenant: true,
        items: true,
      },
      limit: batchSize,
      orderBy: [desc(sales.createdAt)],
    })

    let succeeded = 0
    let stillFailed = 0
    const results: Array<{ saleId: string; status: 'success' | 'failed'; error?: string }> = []

    for (const sale of failedSales) {
      try {
        // Check if tenant still has EFRIS enabled
        if (!sale.tenant.efrisEnabled || !sale.tenant.efrisTin || !sale.tenant.efrisToken) {
          results.push({
            saleId: sale.id,
            status: 'failed',
            error: 'EFRIS no longer enabled for tenant',
          })
          stillFailed++
          continue
        }

        // Increment retry count
        await db.update(sales)
          .set({
            efrisRetryCount: sale.efrisRetryCount + 1,
            efrisLastRetryAt: new Date(),
          })
          .where(eq(sales.id, sale.id))

        // TODO: Implement actual retry logic here
        // For now, just mark as pending for next retry
        results.push({
          saleId: sale.id,
          status: 'failed',
          error: 'Retry logic not yet implemented - marked for next attempt',
        })
        stillFailed++
      } catch (error: any) {
        logError('efris/retry-failed', error)
        results.push({
          saleId: sale.id,
          status: 'failed',
          error: error.message,
        })
        stillFailed++
      }
    }

    // Audit log
    await adminAudit.create(
      session.superAdminId,
      'efris_retry_failed',
      tenantId || 'all',
      {
        total: failedSales.length,
        succeeded,
        stillFailed,
      }
    )

    return NextResponse.json({
      retried: failedSales.length,
      succeeded,
      stillFailed,
      results,
    })
  } catch (error) {
    logError('api/sys-control/efris/retry-failed', error)
    return NextResponse.json({ error: 'Failed to retry failed submissions' }, { status: 500 })
  }
}
