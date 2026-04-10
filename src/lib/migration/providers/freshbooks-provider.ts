import { db   // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
} from '@/lib/db'
import { platform_connections   // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
} from '@/lib/db/schema'
import { eq   // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
} from 'drizzle-orm'
import { logError   // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
} from '@/lib/ai/error-logger'

const FB_API_BASE = 'https://api.freshbooks.com'
const FB_AUTH_URL = 'https://auth.freshbooks.com/service/auth/oauth/authorize'
const FB_TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token'

interface FBTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

export interface FBCustomer {
  id: number
  first_name: string
  last_name: string
  organization: string
  email: string
  phone_numbers: Array<{ phone_number: string   // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}>
  street: string
  city: string
  province: string
  country: string
  code: string
  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

export class FreshBooksProvider {
  private accountId: string
  private accessToken: string
  private refreshToken: string
  private clientId: string
  private clientSecret: string

  constructor(
    accountId: string,
    accessToken: string,
    refreshToken: string
  ) {
    this.accountId = accountId
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.clientId = process.env.FRESHBOOKS_CLIENT_ID || ''
    this.clientSecret = process.env.FRESHBOOKS_CLIENT_SECRET || ''
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  static getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.FRESHBOOKS_CLIENT_ID || '',
      response_type: 'code',
      redirect_uri: `${process.env.NEXTAUTH_URL  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}/api/migration/callback/freshbooks`,
      state,
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
})
    return `${FB_AUTH_URL  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}?${params.toString()  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  static async exchangeCode(code: string, accountId: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}> {
    const response = await fetch(FB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'   // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
},
      body: JSON.stringify({
        client_id: process.env.FRESHBOOKS_CLIENT_ID,
        client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}/api/migration/callback/freshbooks`,
        // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}),
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
})

    if (!response.ok) throw new Error('FreshBooks token exchange failed')
    const data: FBTokenResponse = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  private async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${FB_API_BASE  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}${endpoint  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}?businessid=${this.accountId  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`,
        'Content-Type': 'application/json',
        'Api-Version': 'alpha',
        // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
},
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
})

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`FreshBooks API Error: ${err  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`)
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

    return response.json()
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  // --- Data Fetchers ---

  async fetchCustomers(): Promise<FBCustomer[]> {
    // FB API paginates. We fetch page by page.
    let page = 1
    let allCustomers: FBCustomer[] = []

    while (true) {
      const res: any = await this.get(`/accounting/clients/clients?page=${page  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`)
      const customers = res.response?.result?.clients || []
      allCustomers = [...allCustomers, ...customers]

      if (customers.length < 30) break // FB default page size is 30
      page++
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
    return allCustomers
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  async fetchItems(): Promise<any[]> {
    let page = 1
    let allItems: any[] = []

    while (true) {
      const res: any = await this.get(`/accounting/items/items?page=${page  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`)
      const items = res.response?.result?.items || []
      allItems = [...allItems, ...items]
      
      if (items.length < 30) break
      page++
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
    return allItems
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  async fetchVendors(): Promise<any[]> {
    let page = 1
    let allVendors: any[] = []

    while (true) {
      const res: any = await this.get(`/accounting/vendors/vendors?page=${page  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`)
      const vendors = res.response?.result?.vendors || []
      allVendors = [...allVendors, ...vendors]
      
      if (vendors.length < 30) break
      page++
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
    return allVendors
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}

  async fetchInvoices(): Promise<any[]> {
    let page = 1
    let allInvoices: any[] = []

    while (true) {
      const res: any = await this.get(`/accounting/invoices/invoices?page=${page  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}`)
      const invoices = res.response?.result?.invoices || []
      allInvoices = [...allInvoices, ...invoices]
      
      if (invoices.length < 30) break
      page++
      // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
    return allInvoices
    // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
  // ... existing code ...

  // Helper to get Account ID after auth
  static async fetchAccountId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.freshbooks.com/auth/api/v1/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const data: any = await response.json()
    // FB returns user data. We need to find the account ID.
    // Usually it's in `response.data` or similar.
    // *Note*: FreshBooks API structure can be tricky. 
    // Often the `businessid` is known by the user or returned in the root of the token response if configured.
    // For this MVP, we assume the user might have multiple accounts. 
    // We'll try to fetch the first account from `https://api.freshbooks.com/auth/api/v1/accounts`.
    
    const accRes = await fetch('https://api.freshbooks.com/auth/api/v1/accounts', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const accData: any = await accRes.json()
    if (accData.response && accData.response.result && accData.response.result.memberships) {
       return accData.response.result.memberships[0].business_id
    }
    throw new Error('Could not determine FreshBooks Account ID')
  }
}
