import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { accounts, accountTenants, tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * SCIM 2.0 Provisioning API
 * 
 * Used by Azure AD, Okta, and other identity providers for automatic user provisioning/deprovisioning.
 * 
 * Endpoints:
 * - GET    /api/scim/v2/Users          - List users
 * - GET    /api/scim/v2/Users/{id}     - Get user
 * - POST   /api/scim/v2/Users          - Create user
 * - PUT    /api/scim/v2/Users/{id}     - Replace user
 * - PATCH  /api/scim/v2/Users/{id}     - Update user
 * - DELETE /api/scim/v2/Users/{id}     - Deactivate user
 */

const SCIM_CONTENT_TYPE = 'application/scim+json'
const SCIM_BASE_URL = '/api/scim/v2'

/**
 * Validate SCIM Bearer token
 */
async function validateSCIMToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.split(' ')[1]
  const expectedToken = process.env.SCIM_BEARER_TOKEN

  if (!expectedToken) {
    console.error('[SCIM] SCIM_BEARER_TOKEN not configured')
    return false
  }

  return token === expectedToken
}

/**
 * GET /api/scim/v2/Users
 * List or search users
 */
export async function GET(request: NextRequest) {
  if (!(await validateSCIMToken(request))) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter')
  const startIndex = parseInt(searchParams.get('startIndex') || '1', 10)
  const count = parseInt(searchParams.get('count') || '20', 10)

  const db = getDb()

  // Build query based on filter
  let query = db.query.accounts.findMany()

  if (filter) {
    // Parse SCIM filter (e.g., userName eq "user@example.com")
    const match = filter.match(/userName\s+eq\s+"([^"]+)"/i)
    if (match) {
      query = db.query.accounts.findMany({
        where: eq(accounts.email, match[1]),
      })
    }
  }

  const allUsers = await query

  // Pagination
  const totalResults = allUsers.length
  const paginatedUsers = allUsers.slice(startIndex - 1, startIndex - 1 + count)

  return NextResponse.json(
    {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: count,
      Resources: paginatedUsers.map(userToSCIMResource),
    },
    {
      headers: { 'Content-Type': SCIM_CONTENT_TYPE },
    }
  )
}

/**
 * POST /api/scim/v2/Users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  if (!(await validateSCIMToken(request))) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  try {
    const body = await request.json()
    const db = getDb()

    // Extract user data from SCIM payload
    const email = body.userName || body.emails?.[0]?.value
    const name = body.name?.formatted || body.displayName
    const active = body.active !== false

    if (!email) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: 400,
          detail: 'userName (email) is required',
        },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.email, email),
    })

    if (existing) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: 409,
          detail: 'User already exists',
        },
        { status: 409 }
      )
    }

    // Create user
    const [newUser] = await db
      .insert(accounts)
      .values({
        email,
        name: name || email.split('@')[0],
        active,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    // Assign to default tenant if specified
    const defaultTenantSlug = process.env.SCIM_DEFAULT_TENANT_SLUG
    if (defaultTenantSlug) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, defaultTenantSlug),
      })

      if (tenant) {
        await db.insert(accountTenants).values({
          accountId: newUser.id,
          tenantId: tenant.id,
          role: 'member',
          isOwner: false,
        })
      }
    }

    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        ...userToSCIMResource(newUser),
      },
      {
        status: 201,
        headers: {
          'Content-Type': SCIM_CONTENT_TYPE,
          Location: `${SCIM_BASE_URL}/Users/${newUser.id}`,
        },
      }
    )
  } catch (error: any) {
    console.error('[SCIM] Error creating user:', error)
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: 500,
        detail: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/scim/v2/Users/{id}
 * Get a specific user
 */
export async function GET_USER_BY_ID(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await validateSCIMToken(request))) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  const db = getDb()
  const user = await db.query.accounts.findFirst({
    where: eq(accounts.id, params.id),
  })

  if (!user) {
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: 404,
        detail: 'User not found',
      },
      { status: 404 }
    )
  }

  return NextResponse.json(
    {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      ...userToSCIMResource(user),
    },
    {
      headers: { 'Content-Type': SCIM_CONTENT_TYPE },
    }
  )
}

/**
 * PATCH /api/scim/v2/Users/{id}
 * Update user attributes
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await validateSCIMToken(request))) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  try {
    const body = await request.json()
    const db = getDb()

    // Extract updates from SCIM Operations
    const updates: Record<string, any> = {}

    if (body.Operations) {
      for (const op of body.Operations) {
        if (op.op === 'replace' && op.path) {
          if (op.path === 'name.formatted' || op.path === 'displayName') {
            updates.name = op.value
          } else if (op.path === 'active') {
            updates.active = op.value
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: 400,
          detail: 'No valid operations',
        },
        { status: 400 }
      )
    }

    updates.updatedAt = new Date()

    const [updatedUser] = await db
      .update(accounts)
      .set(updates)
      .where(eq(accounts.id, params.id))
      .returning()

    if (!updatedUser) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: 404,
          detail: 'User not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        ...userToSCIMResource(updatedUser),
      },
      {
        headers: { 'Content-Type': SCIM_CONTENT_TYPE },
      }
    )
  } catch (error: any) {
    console.error('[SCIM] Error updating user:', error)
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: 500,
        detail: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scim/v2/Users/{id}
 * Deactivate (soft delete) a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await validateSCIMToken(request))) {
    return NextResponse.json({ status: 401 }, { status: 401 })
  }

  const db = getDb()

  // Deactivate user (don't hard delete to preserve audit trail)
  const [deactivatedUser] = await db
    .update(accounts)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, params.id))
    .returning()

  if (!deactivatedUser) {
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: 404,
        detail: 'User not found',
      },
      { status: 404 }
    )
  }

  return new NextResponse(null, { status: 204 })
}

/**
 * Convert database user to SCIM resource format
 */
function userToSCIMResource(user: any) {
  return {
    id: user.id,
    externalId: user.externalId || null,
    userName: user.email,
    name: {
      formatted: user.name,
      familyName: user.name?.split(' ').slice(-1)[0] || null,
      givenName: user.name?.split(' ')[0] || null,
    },
    displayName: user.name,
    emails: [
      {
        value: user.email,
        type: 'work',
        primary: true,
      },
    ],
    active: user.active !== false,
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      lastModified: user.updatedAt,
      location: `${SCIM_BASE_URL}/Users/${user.id}`,
    },
  }
}
