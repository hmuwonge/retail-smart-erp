import { logError } from '@/lib/ai/error-logger'

const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth'
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_API_BASE = 'https://www.zohoapis.com/books/v3'

export interface ZohoTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  api_domain: string
}

export class ZohoBooksProvider {
  private organizationId: string
  private accessToken: string
  private refreshToken: string
  private clientId: string
  private clientSecret: string

  constructor(
    organizationId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.organizationId = organizationId
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.clientId = process.env.ZOHO_CLIENT_ID || ''
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || ''
  }

  static getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.ZOHO_CLIENT_ID || '',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'ZohoBooks.fullaccess.all',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/migration/callback/zoho`,
      state,
    })
    return `${ZOHO_AUTH_URL}?${params.toString()}`
  }

  static async exchangeCode(code: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }> {
    const response = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.ZOHO_CLIENT_ID || '',
        client_secret: process.env.ZOHO_CLIENT_SECRET || '',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/migration/callback/zoho`,
        code,
      }),
    })

    if (!response.ok) throw new Error('Zoho token exchange failed')
    const data: ZohoTokenResponse = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }

  private async get<T>(endpoint: string): Promise<T> {
    const url = `${ZOHO_API_BASE}${endpoint}?organization_id=${this.organizationId}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Zoho-oauthtoken ${this.accessToken}` },
    })

    if (!response.ok) throw new Error(`Zoho API Error: ${response.statusText}`)
    const json: any = await response.json()
    return json
  }

  // --- Data Fetchers ---
  
  // Zoho calls them "Contacts" and distinguishes by `contact_type`
  async fetchCustomers(): Promise<any[]> {
    const res: any = await this.get('/contacts')
    return res.contacts || []
  }

  async fetchVendors(): Promise<any[]> {
    // Zoho uses the same endpoint but filter by type? Or distinct endpoint?
    // Zoho Books API allows filtering contacts by contact_type='vendor'
    const res: any = await this.get('/contacts?contact_type=vendor')
    return res.contacts || []
  }

  async fetchItems(): Promise<any[]> {
    const res: any = await this.get('/items')
    return res.items || []
  }

  async fetchInvoices(): Promise<any[]> {
    const res: any = await this.get('/invoices')
    return res.invoices || []
  }
}
