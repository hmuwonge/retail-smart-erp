import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { EfrisClient, getEfrisClient } from '@/lib/integration/efris'
import { logError } from '@/lib/ai/error-logger'

/**
 * Check if tenant has EFRIS feature available (enterprise tier only)
 * 
 * @param tenantId - The tenant ID to check
 * @returns NextResponse with error if not eligible, or null if eligible
 */
export async function requireEfrisFeature(tenantId: string): Promise<NextResponse | null> {
  try {
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
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      )
    }

    // Check if tenant is on enterprise tier
    const isEnterprise = tenant.subscription?.tier?.name === 'enterprise' || tenant.plan === 'premium'

    if (!isEnterprise) {
      return NextResponse.json(
        { error: 'EFRIS is only available on the Enterprise plan. Please upgrade your subscription.' },
        { status: 403 }
      )
    }

    return null // Eligible
  } catch (error) {
    logError('efris-guards/requireEfrisFeature', error)
    return NextResponse.json(
      { error: 'Failed to verify EFRIS eligibility' },
      { status: 500 }
    )
  }
}

/**
 * Check if EFRIS is enabled and configured for tenant
 * 
 * @param tenantId - The tenant ID to check
 * @returns NextResponse with error if not configured, or tenant object if configured
 */
export async function requireEfrisConfigured(tenantId: string): Promise<NextResponse | { tenant: typeof tenants.$inferSelect } | null> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      )
    }

    if (!tenant.efrisEnabled) {
      return NextResponse.json(
        { error: 'EFRIS is not enabled for this tenant. Contact your system administrator.' },
        { status: 403 }
      )
    }

    if (!tenant.efrisTin || !tenant.efrisToken) {
      return NextResponse.json(
        { error: 'EFRIS is not fully configured (missing TIN or token). Contact your system administrator.' },
        { status: 403 }
      )
    }

    return { tenant }
  } catch (error) {
    logError('efris-guards/requireEfrisConfigured', error)
    return NextResponse.json(
      { error: 'Failed to verify EFRIS configuration' },
      { status: 500 }
    )
  }
}

/**
 * Get EFRIS client or return error if not configured
 * 
 * @param tenantId - The tenant ID
 * @returns NextResponse with error or object with initialized client
 */
export async function getEfrisClientOrError(tenantId: string): Promise<NextResponse | { client: EfrisClient; tenant: typeof tenants.$inferSelect } | null> {
  const result = await requireEfrisConfigured(tenantId)
  
  if (result instanceof NextResponse) {
    return result
  }

  if (!result) {
    return NextResponse.json(
      { error: 'EFRIS configuration not found' },
      { status: 500 }
    )
  }

  try {
    const client = await getEfrisClient(tenantId)
    if (!client) {
      return NextResponse.json(
        { error: 'Failed to initialize EFRIS client' },
        { status: 500 }
      )
    }
    return { client, tenant: result.tenant }
  } catch (error) {
    logError('efris-guards/getEfrisClientOrError', error)
    return NextResponse.json(
      { error: 'Failed to initialize EFRIS client' },
      { status: 500 }
    )
  }
}

/**
 * Check if all items have EFRIS codes assigned
 * 
 * @param items - Array of items to check
 * @returns NextResponse with error if any item is missing EFRIS code, or null if all have codes
 */
export function requireItemsHaveEfrisCodes(items: Array<{ id: string; name: string; efrisItemCode?: string | null }>): NextResponse | null {
  const missingCodes = items.filter(item => !item.efrisItemCode)

  if (missingCodes.length > 0) {
    const itemNames = missingCodes.map(item => item.name).join(', ')
    return NextResponse.json(
      {
        error: `The following items do not have EFRIS codes assigned: ${itemNames}. Please register them with EFRIS first.`,
        missingItems: missingCodes.map(item => ({ id: item.id, name: item.name })),
      },
      { status: 400 }
    )
  }

  return null // All items have codes
}
