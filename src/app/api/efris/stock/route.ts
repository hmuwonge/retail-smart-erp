import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { logError } from '@/lib/ai/error-logger'
import { requireEfrisFeature, requireEfrisConfigured } from '@/lib/integration/efris-guards'
import { syncStockOnPurchase, syncStockOnAdjustment, syncStockOnReturn, manualStockSync } from '@/lib/integration/efris-stock'

/**
 * POST /api/efris/stock/sync - Manual stock sync with EFRIS
 * 
 * Body:
 * {
 *   type: 'purchase' | 'adjustment' | 'return' | 'manual',
 *   referenceId?: string,  // For purchase/return
 *   reason?: string,       // For adjustment/manual
 *   items?: Array<{ itemCode: string; quantity: number; action: 'increase' | 'decrease' }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    // Check EFRIS configuration
    const configResult = await requireEfrisConfigured(tenantId)
    if (configResult instanceof NextResponse) return configResult

    const body = await request.json()
    const { type, referenceId, reason, items } = body

    if (!type) {
      return NextResponse.json({ error: 'Sync type is required' }, { status: 400 })
    }

    let result

    switch (type) {
      case 'purchase':
        if (!referenceId) {
          return NextResponse.json({ error: 'referenceId is required for purchase sync' }, { status: 400 })
        }
        result = await syncStockOnPurchase(referenceId, tenantId)
        break

      case 'adjustment':
        if (!reason || !items) {
          return NextResponse.json({ error: 'reason and items are required for adjustment sync' }, { status: 400 })
        }
        result = await syncStockOnAdjustment(
          tenantId,
          reason as any,
          items,
          `Manual adjustment: ${reason}`
        )
        break

      case 'return':
        if (!referenceId) {
          return NextResponse.json({ error: 'referenceId is required for return sync' }, { status: 400 })
        }
        result = await syncStockOnReturn(referenceId, tenantId)
        break

      case 'manual':
        if (!items) {
          return NextResponse.json({ error: 'items are required for manual sync' }, { status: 400 })
        }
        result = await manualStockSync(
          tenantId,
          items,
          reason || 'Manual sync'
        )
        break

      default:
        return NextResponse.json({
          error: 'Invalid sync type. Must be: purchase, adjustment, return, or manual',
        }, { status: 400 })
    }

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 500 })
    }
  } catch (error) {
    logError('api/efris/stock/sync POST', error)
    return NextResponse.json({ error: 'Failed to sync stock with EFRIS' }, { status: 500 })
  }
}

/**
 * GET /api/efris/stock/status - View stock sync status
 * 
 * Query params:
 * - tenantId (optional, defaults to current tenant)
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

    return NextResponse.json({
      efrisEnabled: true,
      message: 'EFRIS stock sync is available',
      supportedOperations: [
        'purchase',    // Sync stock on purchase receipt
        'adjustment',  // Sync stock adjustments (damage, expiry, etc.)
        'return',      // Sync stock on customer returns
        'manual',      // Manual stock reconciliation
      ],
      adjustmentReasons: [
        'damage',
        'expiry',
        'personal_use',
        'sample',
        'theft',
        'other',
      ],
    })
  } catch (error) {
    logError('api/efris/stock/status GET', error)
    return NextResponse.json({ error: 'Failed to fetch EFRIS stock status' }, { status: 500 })
  }
}
