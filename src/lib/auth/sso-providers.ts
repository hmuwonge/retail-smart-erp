import NextAuth, { type NextAuthConfig } from 'next-auth'
import AzureAD from 'next-auth/providers/azure-ad'
import Okta from 'next-auth/providers/okta'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { getDb } from '@/lib/db'
import { accounts, accountTenants, tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

/**
 * SSO/OIDC Provider Configuration
 * 
 * Supports:
 * - Azure AD (Enterprise)
 * - Okta (Enterprise)
 * - Google Workspace (Enterprise)
 * - Credentials (default email/password)
 */

const providers: NextAuthConfig['providers'] = []

// Add Azure AD if enabled
if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) {
  providers.push(
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
        }
      },
    })
  )
  console.log('[SSO] Azure AD provider enabled')
}

// Add Okta if enabled
if (process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET && process.env.OKTA_ISSUER) {
  providers.push(
    Okta({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
    })
  )
  console.log('[SSO] Okta provider enabled')
}

// Add Google if enabled
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
  console.log('[SSO] Google provider enabled')
}

// Always add Credentials provider (for email/password login)
providers.push(
  Credentials({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const db = getDb()

      // Find account by email
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.email, credentials.email as string),
      })

      if (!account || !account.passwordHash) {
        return null
      }

      // Verify password
      const isValid = await bcrypt.compare(
        credentials.password as string,
        account.passwordHash
      )

      if (!isValid) {
        return null
      }

      return {
        id: account.id,
        email: account.email,
        name: account.name,
        image: account.image,
      }
    },
  })
)

/**
 * NextAuth Configuration
 */
export const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (account && user) {
        token.accountId = user.id
        token.email = user.email

        // Fetch tenant memberships
        const db = getDb()
        const memberships = await db.query.accountTenants.findMany({
          where: eq(accountTenants.accountId, user.id),
          with: {
            tenant: true,
          },
        })

        token.tenants = memberships.map((m) => ({
          tenantId: m.tenantId,
          slug: m.tenant.slug,
          role: m.role,
          isOwner: m.isOwner,
        }))
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).accountId = token.accountId
        ;(session.user as any).tenants = token.tenants
      }

      return session
    },

    async signIn({ user, account, profile }) {
      // SSO-specific logic
      if (account?.provider !== 'credentials') {
        // Check if user exists, create if not
        const db = getDb()
        const existingAccount = await db.query.accounts.findFirst({
          where: eq(accounts.email, user.email!),
        })

        if (!existingAccount) {
          // Create new account from SSO profile
          const [newAccount] = await db
            .insert(accounts)
            .values({
              email: user.email!,
              name: user.name || profile?.name || '',
              image: user.image || (profile as any)?.picture || null,
              emailVerified: new Date(),
            })
            .returning()

          user.id = newAccount.id
        } else {
          user.id = existingAccount.id
        }
      }

      return true
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== 'production',
}

/**
 * NextAuth Handlers
 */
const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

export { handlers, auth, signIn, signOut }
