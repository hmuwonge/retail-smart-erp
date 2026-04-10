import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { db } from '@/lib/db'
import { sales, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { submitSaleToEfris } from '@/lib/integration/efris-submitter'
import { logError } from '@/lib/ai/error-logger'

/**
 * POST /api/sales/[id]/efris/resubmit - Manually retry a failed EFRIS submission
 * 
 * Resets the EFRIS status to 'pending' and attempts to resubmit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId
    const { id: saleId } = await params

    // Fetch sale to verify ownership
    const sale = await db.query.sales.findFirst({
      where: and(eq(sales.id, saleId), eq(sales.tenantId, tenantId)),
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Check if tenant has EFRIS enabled
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant?.efrisEnabled || !tenant?.efrisTin || !tenant?.efrisToken) {
      return NextResponse.json({
        error: 'EFRIS is not configured for this tenant. Contact your system administrator.',
      }, { status: 403 })
    }

    // Check if sale is eligible for resubmission
    if (sale.efrisStatus === 'success') {
      return NextResponse.json({
        error: 'This sale has already been successfully submitted to EFRIS.',
        alreadySubmitted: true,
        efrisInvoiceNo: sale.efrisInvoiceNo,
      }, { status: 400 })
    }

    // Reset status to pending and attempt resubmission
    await db.update(sales)
      .set({
        efrisStatus: 'pending',
        efrisError: null,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))

    // Submit to EFRIS
    const result = await submitSaleToEfris(saleId, tenantId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Sale successfully submitted to EFRIS',
        efrisInvoiceNo: result.efrisInvoiceNo,
        efrisAntifakeCode: result.efrisAntifakeCode,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to submit to EFRIS',
      }, { status: 500 })
    }
  } catch (error) {
    logError('api/sales/[id]/efris/resubmit', error)
    return NextResponse.json({ error: 'Failed to resubmit sale to EFRIS' }, { status: 500 })
  }
}
