import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { db } from '@/lib/db'
import { platform_connections } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { QuickBooksProvider } from '@/lib/migration/providers/quickbooks-provider'
import { FreshBooksProvider } from '@/lib/migration/providers/freshbooks-provider'
import { ZohoBooksProvider } from '@/lib/migration/providers/zoho-books-provider'
import { XeroProvider } from '@/lib/migration/providers/xero-provider'
import { logError } from '@/lib/ai/error-logger'

/**
 * POST /api/migration/preview
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenantId = session.user.tenantId
    const { connectionId } = await request.json()

    // 1. Validate Connection
    const connection = await db.query.platform_connections.findFirst({
      where: and(
        eq(platform_connections.id, connectionId),
        eq(platform_connections.tenantId, tenantId)
      ),
    })

    if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    if (!connection.accessToken || (!connection.realmId && !connection.accountId && !connection.organizationId && !connection.tenantXeroId)) {
      return NextResponse.json({ error: 'Connection is not authenticated' }, { status: 400 })
    }

    // 2. Initialize Correct Provider
    let provider: any
    if (connection.platform === 'quickbooks' && connection.realmId) {
      provider = new QuickBooksProvider(connection.realmId, connection.accessToken, connection.refreshToken)
    } else if (connection.platform === 'freshbooks' && connection.accountId) {
      provider = new FreshBooksProvider(connection.accountId, connection.accessToken, connection.refreshToken)
    } else if (connection.platform === 'zoho' && connection.organizationId) {
      provider = new ZohoBooksProvider(connection.organizationId, connection.accessToken, connection.refreshToken)
    } else if (connection.platform === 'xero' && connection.tenantXeroId) {
      provider = new XeroProvider(connection.tenantXeroId, connection.accessToken, connection.refreshToken)
    } else {
      return NextResponse.json({ error: 'Provider not initialized (Missing IDs)' }, { status: 400 })
    }

    // 3. Fetch Data Counts
    const fetchCustomers = provider.fetchCustomers ? provider.fetchCustomers() : (provider.fetchContacts ? provider.fetchContacts() : Promise.resolve([]))
    const fetchVendors = provider.fetchVendors ? provider.fetchVendors() : Promise.resolve([])

    const [customers, items, vendors, invoices] = await Promise.allSettled([
      fetchCustomers,
      provider.fetchItems(),
      fetchVendors,
      provider.fetchInvoices(),
    ])

    const previewData: Record<string, number> = {}
    const errors: string[] = []

    if (customers.status === 'fulfilled') previewData.customers = customers.value.length
    else errors.push(`Customers: ${customers.reason}`)

    if (items.status === 'fulfilled') previewData.items = items.value.length
    else errors.push(`Items: ${items.reason}`)

    if (vendors.status === 'fulfilled') previewData.vendors = vendors.value.length
    
    if (invoices.status === 'fulfilled') previewData.invoices = invoices.value.length
    else errors.push(`Invoices: ${invoices.reason}`)

    if (errors.length > 0 && Object.values(previewData).every(c => c === 0)) {
       return NextResponse.json({ error: 'Failed to fetch data: ' + errors.join(', ') }, { status: 502 })
    }

    return NextResponse.json({ success: true, counts: previewData, warnings: errors.length > 0 ? errors : undefined })

  } catch (error: any) {
    logError('api/migration/preview', error)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
