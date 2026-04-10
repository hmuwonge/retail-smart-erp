import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { db } from '@/lib/db'
import { platform_connections } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

/**
 * GET /api/migration/connection/status
 * 
 * Returns the connection status for all platforms for the current tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    const connections = await db.query.platform_connections.findMany({
      where: eq(platform_connections.tenantId, tenantId),
    })

    // Map to a simpler structure for the UI
    const statusMap: Record<string, { connected: boolean; companyName?: string; connectedAt?: string }> = {
      quickbooks: { connected: false },
      freshbooks: { connected: false },
      zoho: { connected: false },
      xero: { connected: false },
    }

    for (const conn of connections) {
      const isExpired = conn.token_expires_at && new Date() > new Date(conn.token_expires_at)
      statusMap[conn.platform] = {
        connected: conn.status === 'connected' && !isExpired,
        companyName: conn.company_name || undefined,
        connectedAt: conn.connected_at?.toISOString(),
      }
    }

    return NextResponse.json(statusMap)
  } catch (error) {
    logError('api/migration/connection/status', error)
    return NextResponse.json({ error: 'Failed to fetch connection status' }, { status: 500 })
  }
}
