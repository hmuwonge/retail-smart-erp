import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { db, withTenant } from '@/lib/db'
import { tenants, subscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

// GET /api/settings/efris - Get current tenant's EFRIS status (read-only)
export async function GET(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Execute with RLS tenant context
    return await withTenant(tenantId, async (db) => {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        with: {
          subscription: {
            with: {
              tier: true,
            },
          },
        },
      })

      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }

      // Check if tenant is on enterprise tier
      const isEnterprise = tenant.subscription?.tier?.name === 'enterprise' || tenant.plan === 'premium'
      const efrisEnabled = tenant.efrisEnabled === true
      const efrisConfigured = !!(tenant.efrisTin && tenant.efrisToken)

      // Determine status
      let efrisStatus: 'enabled' | 'disabled' | 'not_configured' | 'not_available' = 'not_available'
      if (!isEnterprise) {
        efrisStatus = 'not_available'
      } else if (efrisEnabled && efris_configured) {
        efrisStatus = 'enabled'
      } else if (efrisConfigured) {
        efrisStatus = 'disabled'
      } else {
        efrisStatus = 'not_configured'
      }

      // Mask TIN for privacy
      const efrisTinMasked = tenant.efrisTin
        ? `${tenant.efrisTin.slice(0, 2)}******${tenant.efrisTin.slice(-3)}`
        : null

      return NextResponse.json({
        efrisEnabled,
        efrisConfigured,
        efrisTinMasked,
        efrisStatus,
        planEligible: isEnterprise,
      })
    })
  } catch (error) {
    logError('api/settings/efris', error)
    return NextResponse.json({ error: 'Failed to fetch EFRIS status' }, { status: 500 })
  }
}
