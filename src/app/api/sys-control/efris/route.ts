import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants, subscriptions, pricingTiers } from '@/lib/db/schema'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { validateAdminSession, adminAudit } from '@/lib/admin'
import { logError } from '@/lib/ai/error-logger'
import { getEfrisClient } from '@/lib/integration/efris'

// GET /api/sys-control/efris/tenants - List all tenants with EFRIS eligibility and status
export async function GET(request: NextRequest) {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'UG'
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'enabled', 'disabled', 'not_configured'

    // Build base query - get all tenants with subscription info
    const conditions = []

    if (country) {
      conditions.push(eq(tenants.country, country))
    }

    if (search) {
      conditions.push(
        or(
          ilike(tenants.name, `%${search}%`),
          ilike(tenants.slug, `%${search}%`)
        )!
      )
    }

    const allTenants = await db.query.tenants.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        subscription: {
          with: {
            tier: true,
          },
        },
      },
      orderBy: [desc(tenants.createdAt)],
    })

    // Filter and enrich with EFRIS status
    const tenantsWithEfrisStatus = allTenants.map((tenant) => {
      const isEnterprise = tenant.subscription?.tier?.name === 'enterprise' || tenant.plan === 'premium'
      const efrisEnabled = tenant.efrisEnabled === true
      const efrisConfigured = !!(tenant.efrisTin && tenant.efrisToken)

      let efrisStatus: 'enabled' | 'configured' | 'not_configured' | 'connection_error' = 'not_configured'
      if (efrisEnabled && efris_configured) {
        efrisStatus = 'enabled'
      } else if (efris_configured) {
        efrisStatus = 'configured'
      }

      // Filter by status if provided
      if (status) {
        if (status === 'enabled' && efrisStatus !== 'enabled') return null
        if (status === 'disabled' && efrisStatus !== 'not_configured') return null
        if (status === 'not_configured' && (efrisStatus !== 'not_configured' && efrisStatus !== 'configured')) return null
      }

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        country: tenant.country,
        currency: tenant.currency,
        plan: tenant.plan,
        isEnterprise,
        subscriptionStatus: tenant.subscription?.status || 'none',
        efrisEnabled,
        efrisConfigured,
        efrisStatus,
        efrisTin: tenant.efrisTin || null,
        efrisTinMasked: tenant.efrisTin ? `${tenant.efrisTin.slice(0, 2)}******${tenant.efrisTin.slice(-3)}` : null,
        createdAt: tenant.createdAt,
      }
    }).filter(Boolean)

    return NextResponse.json({
      tenants: tenantsWithEfrisStatus,
      total: tenantsWithEfrisStatus.length,
    })
  } catch (error) {
    logError('api/sys-control/efris/tenants', error)
    return NextResponse.json({ error: 'Failed to fetch EFRIS tenants' }, { status: 500 })
  }
}

// GET /api/sys-control/efris/:tenantId - Get specific tenant's EFRIS config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = await params

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

    const isEnterprise = tenant.subscription?.tier?.name === 'enterprise' || tenant.plan === 'premium'
    const efris_configured = !!(tenant.efrisTin && tenant.efrisToken)

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      country: tenant.country,
      isEnterprise,
      efrisEnabled: tenant.efrisEnabled,
      efrisConfigured,
      efrisTin: tenant.efrisTin || null,
      efrisToken: tenant.efrisToken || null,
    })
  } catch (error) {
    logError('api/sys-control/efris/:tenantId', error)
    return NextResponse.json({ error: 'Failed to fetch tenant EFRIS config' }, { status: 500 })
  }
}

// PUT /api/sys-control/efris/:tenantId - Update tenant EFRIS config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = await params
    const body = await request.json()
    const { efrisEnabled, efrisTin, efrisToken } = body

    // Validate input
    if (typeof efrisEnabled !== 'boolean') {
      return NextResponse.json({ error: 'efrisEnabled must be a boolean' }, { status: 400 })
    }

    // Validate TIN format if provided
    if (efrisTin && !/^UG\d{10}$/.test(efrisTin)) {
      return NextResponse.json({
        error: 'Invalid TIN format. Must be UG followed by 10 digits.',
      }, { status: 400 })
    }

    // Fetch tenant to check eligibility
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

    // Check if tenant is eligible for EFRIS (enterprise tier only)
    const isEnterprise = tenant.subscription?.tier?.name === 'enterprise' || tenant.plan === 'premium'
    if (!isEnterprise) {
      return NextResponse.json({
        error: 'EFRIS is only available on the Enterprise plan.',
      }, { status: 403 })
    }

    // If enabling EFRIS, require TIN and token
    if (efrisEnabled && (!efrisTin || !efrisToken)) {
      return NextResponse.json({
        error: 'TIN and API Token are required to enable EFRIS.',
      }, { status: 400 })
    }

    // Update tenant
    const [updatedTenant] = await db.update(tenants)
      .set({
        efrisEnabled,
        efrisTin: efrisTin || null,
        efrisToken: efrisToken || null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning()

    // Audit log
    await adminAudit.create(
      session.superAdminId,
      'efris_config',
      tenantId,
      { efrisEnabled, efrisTin: efrisTin ? '***' : null }
    )

    return NextResponse.json({
      id: updatedTenant.id,
      efrisEnabled: updatedTenant.efrisEnabled,
      efrisTin: updatedTenant.efrisTin,
      message: 'EFRIS configuration updated successfully',
    })
  } catch (error) {
    logError('api/sys-control/efris/:tenantId PUT', error)
    return NextResponse.json({ error: 'Failed to update EFRIS config' }, { status: 500 })
  }
}

// POST /api/sys-control/efris/:tenantId/test - Test EFRIS connection for a tenant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await validateAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = await params

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    if (!tenant.efrisTin || !tenant.efrisToken) {
      return NextResponse.json({
        error: 'EFRIS TIN and Token are required to test connection.',
      }, { status: 400 })
    }

    // Try to initialize EFRIS client and make a test request
    try {
      const client = await getEfrisClient(tenantId)
      if (!client) {
        return NextResponse.json({
          error: 'Failed to initialize EFRIS client. Check TIN and Token.',
        }, { status: 500 })
      }

      // Test by syncing products (lightweight operation)
      await client.syncProducts({ pageSize: '1', pageNo: '1' })

      // Audit log
      await adminAudit.create(
        session.superAdminId,
        'efris_test_connection',
        tenantId,
        { success: true }
      )

      return NextResponse.json({
        success: true,
        message: 'EFRIS connection successful',
        tin: tenant.efrisTin,
      })
    } catch (efrisError: any) {
      return NextResponse.json({
        success: false,
        error: efrisError.message || 'Connection test failed',
        tin: tenant.efrisTin,
      }, { status: 500 })
    }
  } catch (error) {
    logError('api/sys-control/efris/:tenantId POST', error)
    return NextResponse.json({ error: 'Failed to test EFRIS connection' }, { status: 500 })
  }
}
