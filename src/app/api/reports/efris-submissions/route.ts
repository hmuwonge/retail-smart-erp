import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { db } from '@/lib/db'
import { sales } from '@/lib/db/schema'
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm'
import { requireEfrisFeature } from '@/lib/integration/efris-guards'
import { logError } from '@/lib/ai/error-logger'

/**
 * GET /api/reports/efris-submissions - List all EFRIS submissions with filters
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - status: 'success' | 'failed' | 'pending'
 * - page: number (default: 1)
 * - pageSize: number (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Build conditions
    const conditions = [
      eq(sales.tenantId, tenantId),
      sql`${sales.efrisStatus} IS NOT NULL`,
    ]

    // Filter by date range
    if (startDate) {
      conditions.push(gte(sales.createdAt, new Date(startDate)))
    }
    if (endDate) {
      conditions.push(lte(sales.createdAt, new Date(endDate)))
    }

    // Filter by status
    if (status && ['success', 'failed', 'pending'].includes(status)) {
      conditions.push(eq(sales.efrisStatus, status))
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .where(and(...conditions))

    // Get submissions with pagination
    const submissions = await db.query.sales.findMany({
      where: and(...conditions),
      orderBy: [desc(sales.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      columns: {
        id: true,
        saleNo: true,
        total: true,
        status: true,
        isReturn: true,
        returnAgainst: true,
        createdAt: true,
        efrisStatus: true,
        efrisInvoiceNo: true,
        efrisAntifakeCode: true,
        efrisQrCode: true,
        efrisError: true,
        efrisSubmittedAt: true,
        efrisRetryCount: true,
        efrisLastRetryAt: true,
      },
    })

    // Get summary stats
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        success: sql<number>`count(*) filter (where ${sales.efrisStatus} = 'success')`,
        failed: sql<number>`count(*) filter (where ${sales.efrisStatus} = 'failed')`,
        pending: sql<number>`count(*) filter (where ${sales.efrisStatus} = 'pending')`,
      })
      .from(sales)
      .where(and(
        eq(sales.tenantId, tenantId),
        sql`${sales.efrisStatus} IS NOT NULL`,
        startDate ? gte(sales.createdAt, new Date(startDate)) : undefined,
        endDate ? lte(sales.createdAt, new Date(endDate)) : undefined,
      ).filter(Boolean))

    return NextResponse.json({
      data: submissions,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
      stats: stats[0],
    })
  } catch (error) {
    logError('api/reports/efris-submissions GET', error)
    return NextResponse.json({ error: 'Failed to fetch EFRIS submissions' }, { status: 500 })
  }
}
