import { NextRequest, NextResponse } from 'next/server'
import { authWithCompany } from '@/lib/auth'
import { QuickBooksProvider } from '@/lib/migration/providers/quickbooks-provider'
import { FreshBooksProvider } from '@/lib/migration/providers/freshbooks-provider'
import { ZohoBooksProvider } from '@/lib/migration/providers/zoho-books-provider'
import { XeroProvider } from '@/lib/migration/providers/xero-provider'
import { logError } from '@/lib/ai/error-logger'

/**
 * GET /api/migration/connect/[platform]
 *
 * Initiates the OAuth flow for the specified platform.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { platform } = await params
    const tenantId = session.user.tenantId
    const tenantSlug = session.user.tenantSlug

    // Generate state to verify the callback belongs to this tenant
    const state = Buffer.from(JSON.stringify({ tenantId, tenantSlug })).toString('base64')

    let authUrl: string | null = null

    switch (platform) {
      case 'quickbooks':
        authUrl = QuickBooksProvider.getAuthUrl(state)
        break

      case 'freshbooks':
        authUrl = FreshBooksProvider.getAuthUrl(state)
        break

      case 'zoho':
        authUrl = ZohoBooksProvider.getAuthUrl(state)
        break

      case 'xero':
        authUrl = XeroProvider.getAuthUrl(state)
        break

      default:
        return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
    }

    if (!authUrl) {
      return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 })
    }

    return NextResponse.redirect(authUrl)
  } catch (error) {
    logError('api/migration/connect', error)
    return NextResponse.json({ error: 'Failed to initiate connection' }, { status: 500 })
  }
}
