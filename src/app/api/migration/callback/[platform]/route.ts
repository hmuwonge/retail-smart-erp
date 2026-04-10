import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platform_connections } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { QuickBooksProvider } from '@/lib/migration/providers/quickbooks-provider'
import { FreshBooksProvider } from '@/lib/migration/providers/freshbooks-provider'
import { ZohoBooksProvider } from '@/lib/migration/providers/zoho-books-provider'
import { XeroProvider } from '@/lib/migration/providers/xero-provider'
import { logError } from '@/lib/ai/error-logger'

/**
 * GET /api/migration/callback/[platform]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      const description = searchParams.get('error_description') || 'OAuth error'
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/c/*/settings/migration?error=${encodeURIComponent(description)}`)
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    let tenantId: string
    let tenantSlug: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      tenantId = decoded.tenantId
      tenantSlug = decoded.tenantSlug
    } catch {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
    }

    const redirectUrl = `${process.env.NEXTAUTH_URL}/c/${tenantSlug}/settings/migration`
    let tokens: any
    let platformId: string | null = null
    let companyName: string | null = 'Connected Company'

    // Exchange Code & Fetch Platform ID
    switch (platform) {
      case 'quickbooks': {
        const realmId = searchParams.get('realmId')
        if (!realmId) return NextResponse.redirect(`${redirectUrl}?error=Missing+realmId`)
        tokens = await QuickBooksProvider.exchangeCode(code, realmId)
        platformId = realmId
        break
      }

      case 'freshbooks': {
        tokens = await FreshBooksProvider.exchangeCode(code, '') 
        platformId = await FreshBooksProvider.fetchAccountId(tokens.accessToken)
        break
      }

      case 'zoho': {
        tokens = await ZohoBooksProvider.exchangeCode(code)
        const zohoRes = await fetch('https://www.zohoapis.com/books/v3/organizations', {
           headers: { 'Authorization': `Zoho-oauthtoken ${tokens.accessToken}` }
        })
        const zohoData = await zohoRes.json()
        if (zohoData.organizations && zohoData.organizations.length > 0) {
          platformId = zohoData.organizations[0].organization_id
          companyName = zohoData.organizations[0].name
        } else {
          return NextResponse.redirect(`${redirectUrl}?error=No+Zoho+Organization+found`)
        }
        break
      }

      case 'xero': {
        tokens = await XeroProvider.exchangeCode(code)
        const xeroRes = await fetch('https://api.xero.com/connections', {
          headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
        })
        const xeroData = await xeroRes.json()
        if (xeroData.length > 0) {
          platformId = xeroData[0].tenantId
          companyName = xeroData[0].tenantName
        } else {
          return NextResponse.redirect(`${redirectUrl}?error=No+Xero+Tenant+found`)
        }
        break
      }

      default:
        return NextResponse.redirect(`${redirectUrl}?error=Unsupported+platform`)
    }

    // Upsert Connection
    await db.insert(platform_connections)
      .values({
        tenantId,
        platform,
        status: 'connected',
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000),
        realmId: platform === 'quickbooks' ? platformId : null,
        accountId: platform === 'freshbooks' ? platformId : null,
        organizationId: platform === 'zoho' ? platformId : null,
        tenantXeroId: platform === 'xero' ? platformId : null,
        companyName: companyName || 'Connected Company',
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [platform_connections.tenantId, platform_connections.platform],
        set: {
          status: 'connected',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000),
          realmId: platform === 'quickbooks' ? platformId : null,
          accountId: platform === 'freshbooks' ? platformId : null,
          organizationId: platform === 'zoho' ? platformId : null,
          tenantXeroId: platform === 'xero' ? platformId : null,
          companyName: companyName || 'Connected Company',
          connectedAt: new Date(),
        },
      })

    return NextResponse.redirect(`${redirectUrl}?connected=${platform}`)

  } catch (error: any) {
    logError('api/migration/callback', error)
    return NextResponse.json({ error: 'Connection failed' }, { status: 500 })
  }
}
