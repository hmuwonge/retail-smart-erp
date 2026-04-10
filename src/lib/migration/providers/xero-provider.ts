import { logError } from '@/lib/ai/error-logger'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

export interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  id_token: string
}

export class XeroProvider {
  private tenantId: string
  private accessToken: string
  private refreshToken: string
  private clientId: string
  private clientSecret: string

  constructor(
    tenantId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.tenantId = tenantId
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.clientId = process.env.XERO_CLIENT_ID || ''
    this.clientSecret = process.env.XERO_CLIENT_SECRET || ''
  }

  static getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.XERO_CLIENT_ID || '',
      response_type: 'code',
      scope: 'openid profile email accounting.transactions accounting.contacts',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/migration/callback/xero`,
      state,
    })
    return `${XERO_AUTH_URL}?${params.toString()}`
  }

  static async exchangeCode(code: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    tenantId: string // Xero returns this in the token claims usually, or via connections endpoint
  }> {
    const auth = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')
    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/migration/callback/xero`,
      }),
    })

    if (!response.ok) throw new Error('Xero token exchange failed')
    const data: XeroTokenResponse = await response.json()

    // Xero requires fetching connections to get the tenant ID (Organization ID)
    // Usually done via GET /connections with the access token.
    // For this flow, we will do it in the callback route.
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tenantId: '', // Placeholder, filled in callback
    }
  }

  private async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${XERO_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'xero-tenant-id': this.tenantId,
      },
    })

    if (!response.ok) throw new Error(`Xero API Error: ${response.statusText}`)
    return response.json()
  }

  // --- Data Fetchers ---

  async fetchContacts(): Promise<any[]> {
    const res: any = await this.get('/Contacts')
    return res.Contacts || []
  }

  async fetchItems(): Promise<any[]> {
    const res: any = await this.get('/Items')
    return res.Items || []
  }

  async fetchInvoices(): Promise<any[]> {
    const res: any = await this.get('/Invoices')
    return res.Invoices || []
  }
}
