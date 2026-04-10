import { db } from '@/lib/db'
import { platform_connections } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logError } from '@/lib/ai/error-logger'

const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

interface QBTokenResponse {
  x_refresh_token_expires_in: string
  refresh_token: string
  access_token: string
  token_type: string
  expires_in: number
}

export interface QBEntity {
  Id: string
  SyncToken: string
  MetaData: {
    CreateTime: string
    LastUpdatedTime: string
  }
  Active: boolean
}

export interface QBCustomer extends QBEntity {
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  MobilePhone?: { FreeFormNumber: string }
  BillAddr?: {
    Line1: string
    City: string
    Country: string
    CountrySubDivisionCode: string
    PostalCode: string
  }
  Balance: number
  CurrencyRef?: { value: string }
  Notes?: string
}

export interface QBItem extends QBEntity {
  Name: string
  Description?: string
  QtyOnHand?: number
  UnitPrice?: number
  PurchaseCost?: number
  Type?: string // Service, Inventory, NonInventory
  IncomeAccountRef?: { value: string; name: string }
  ExpenseAccountRef?: { value: string; name: string }
  AssetAccountRef?: { value: string; name: string }
  Sku?: string
  TrackQtyOnHand?: boolean
}

export class QuickBooksProvider {
  private realmId: string
  private accessToken: string
  private refreshToken: string
  private clientId: string
  private clientSecret: string

  constructor(
    realmId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.realmId = realmId
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID || ''
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || ''
  }

  /**
   * Get the Authorization URL for OAuth2
   */
  static getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.QUICKBOOKS_CLIENT_ID || '',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/migration/callback/quickbooks`,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    })

    return `${QB_AUTH_URL}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCode(code: string, realmId: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }> {
    const auth = Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')

    const response = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/migration/callback/quickbooks`,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`QuickBooks token exchange failed: ${error}`)
    }

    const data: QBTokenResponse = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }

  /**
   * Execute a query against the QuickBooks API with pagination
   */
  private async query<T extends QBEntity>(query: string): Promise<T[]> {
    let startPosition = 1
    const maxResults = 1000
    let allResults: T[] = []

    while (true) {
      const paginatedQuery = `${query} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
      
      const response = await fetch(`${QB_API_BASE}/${this.realmId}/query?query=${encodeURIComponent(paginatedQuery)}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`QuickBooks API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const entityKey = Object.keys(data.QueryResponse || {}).find(k => k !== 'startPosition' && k !== 'maxResults')
      
      if (!entityKey || !data.QueryResponse[entityKey]) break
      
      const items = data.QueryResponse[entityKey] as T[]
      allResults = [...allResults, ...items]

      if (data.QueryResponse.maxReturned < maxResults) break
      startPosition += maxResults
    }

    return allResults
  }

  /**
   * Fetch all customers from QuickBooks
   */
  async fetchCustomers(): Promise<QBCustomer[]> {
    return this.query<QBCustomer>('SELECT * FROM Customer WHERE Active = true')
  }

  /**
   * Fetch all items/products from QuickBooks
   */
  async fetchItems(): Promise<QBItem[]> {
    return this.query<QBItem>('SELECT * FROM Item WHERE Active = true')
  }

  /**
   * Fetch all vendors (suppliers) from QuickBooks
   */
  async fetchVendors(): Promise<any[]> {
    return this.query<any>('SELECT * FROM Vendor WHERE Active = true')
  }

  /**
   * Fetch all accounts (Chart of Accounts)
   */
  async fetchAccounts(): Promise<any[]> {
    return this.query<any>('SELECT * FROM Account WHERE Active = true')
  }

  /**
   * Refresh the access token if expired
   */
  async refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    const response = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`QuickBooks token refresh failed: ${error}`)
    }

    const data: QBTokenResponse = await response.json()

    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }
}
