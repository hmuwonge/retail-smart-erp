import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { items, tenants } from '@/lib/db/schema'
import { eq, and, or, ilike, isNull, desc, sql } from 'drizzle-orm'
import { authWithCompany } from '@/lib/auth'
import { logError } from '@/lib/ai/error-logger'
import { requireEfrisFeature, getEfrisClientOrError } from '@/lib/integration/efris-guards'
import {
  mapItemToEfrisProduct,
  matchEfrisProductToLocal,
  validateItemForEfris,
  getEfrisMappingStatus,
  type EfrisSyncedProduct,
} from '@/lib/integration/efris-mapper'

/**
 * GET /api/efris/products - List items with/without EFRIS codes
 * 
 * Query params:
 * - status: 'all' | 'mapped' | 'pending' | 'error'
 * - search: string (search by name or SKU)
 * - page: number (default: 1)
 * - pageSize: number (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Build conditions
    const conditions = [eq(items.tenantId, tenantId)]

    // Filter by status
    if (status === 'mapped') {
      conditions.push(sql`${items.efrisItemCode} IS NOT NULL`)
    } else if (status === 'pending') {
      conditions.push(sql`${items.efrisItemCode} IS NULL`)
    } else if (status === 'error') {
      // Items with validation errors (no name or no price)
      conditions.push(
        or(
          sql`${items.name} IS NULL OR ${items.name} = ''`,
          sql`${items.sellingPrice} <= 0`
        )!
      )
    }

    // Search filter
    if (search) {
      conditions.push(
        or(
          ilike(items.name, `%${search}%`),
          ilike(items.sku || '', `%${search}%`)
        )!
      )
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(...conditions))

    // Get items with pagination
    const itemsList = await db.query.items.findMany({
      where: and(...conditions),
      orderBy: [desc(items.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

    // Enrich with EFRIS status
    const itemsWithStatus = itemsList.map(item => ({
      ...item,
      efrisStatus: getEfrisMappingStatus(item),
    }))

    return NextResponse.json({
      data: itemsWithStatus,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    })
  } catch (error) {
    logError('api/efris/products GET', error)
    return NextResponse.json({ error: 'Failed to fetch EFRIS products' }, { status: 500 })
  }
}

/**
 * POST /api/efris/products/sync - Fetch products from EFRIS and match to local items
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    // Get EFRIS client
    const clientResult = await getEfrisClientOrError(tenantId)
    if (clientResult instanceof NextResponse) return clientResult
    if (!clientResult) {
      return NextResponse.json({ error: 'EFRIS client not initialized' }, { status: 500 })
    }

    const { client, tenant } = clientResult

    // Fetch all local items
    const localItems = await db.query.items.findMany({
      where: eq(items.tenantId, tenantId),
    })

    // Sync products from EFRIS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const efrisResponse = await client.syncProducts({ pageSize: '1000', pageNo: '1' }) as any

    const efrisProducts: EfrisSyncedProduct[] = efrisResponse?.data?.goodsDetails || efrisResponse?.data?.products || []

    // Match EFRIS products to local items
    const matched: Array<{
      itemId: string
      itemName: string
      efrisGoodsCode: string
      matched: boolean
    }> = []

    for (const efrisProduct of efrisProducts) {
      const localItem = matchEfrisProductToLocal(efrisProduct, localItems)

      if (localItem) {
        // Update local item with EFRIS code if not already set
        if (!localItem.efrisItemCode) {
          await db.update(items)
            .set({
              efrisItemCode: efrisProduct.goodsCode,
              efrisTaxForm: efrisProduct.taxForm,
              efrisTaxRule: efrisProduct.taxRule,
              updatedAt: new Date(),
            })
            .where(eq(items.id, localItem.id))
        }

        matched.push({
          itemId: localItem.id,
          itemName: localItem.name,
          efrisGoodsCode: efrisProduct.goodsCode,
          matched: true,
        })
      } else {
        matched.push({
          itemId: 'unknown',
          itemName: efrisProduct.goodsName,
          efrisGoodsCode: efrisProduct.goodsCode,
          matched: false,
        })
      }
    }

    const matchCount = matched.filter(m => m.matched).length

    return NextResponse.json({
      success: true,
      synced: efrisProducts.length,
      matched: matchCount,
      unmatched: efrisProducts.length - matchCount,
      details: matched,
    })
  } catch (error) {
    logError('api/efris/products/sync POST', error)
    return NextResponse.json({ error: 'Failed to sync products from EFRIS' }, { status: 500 })
  }
}

/**
 * POST /api/efris/products/register - Register a single item to EFRIS
 * 
 * Body: { itemId: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    // Get EFRIS client
    const clientResult = await getEfrisClientOrError(tenantId)
    if (clientResult instanceof NextResponse) return clientResult
    if (!clientResult) {
      return NextResponse.json({ error: 'EFRIS client not initialized' }, { status: 500 })
    }

    const { client } = clientResult
    const body = await request.json()
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Fetch item
    const item = await db.query.items.findFirst({
      where: and(eq(items.id, itemId), eq(items.tenantId, tenantId)),
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Validate item
    const validation = validateItemForEfris(item)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Map to EFRIS format
    const efrisProduct = mapItemToEfrisProduct(item, tenant.currency || 'UGX')

    // Register with EFRIS
    const response = await client.registerProduct([efrisProduct])

    // Extract goods code from response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodsCode = (response as any)?.data?.goodsCode || (response as any)?.data?.goodsDetails?.[0]?.goodsCode

    if (!goodsCode) {
      return NextResponse.json({
        error: 'EFRIS registration succeeded but no goods code was returned',
        response,
      }, { status: 500 })
    }

    // Update item with EFRIS code
    await db.update(items)
      .set({
        efrisItemCode: goodsCode,
        efrisTaxForm: efrisProduct.taxForm,
        efrisTaxRule: efrisProduct.taxRule,
        updatedAt: new Date(),
      })
      .where(eq(items.id, item.id))

    return NextResponse.json({
      success: true,
      itemId: item.id,
      itemName: item.name,
      efrisGoodsCode: goodsCode,
      message: 'Item registered with EFRIS successfully',
    })
  } catch (error) {
    logError('api/efris/products/register PUT', error)
    return NextResponse.json({ error: 'Failed to register item with EFRIS' }, { status: 500 })
  }
}

/**
 * POST /api/efris/products/bulk-register - Bulk register all unmapped items
 * 
 * Body (optional): { batchSize?: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await authWithCompany()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = session.user.tenantId

    // Check EFRIS feature eligibility
    const featureError = await requireEfrisFeature(tenantId)
    if (featureError) return featureError

    // Get EFRIS client
    const clientResult = await getEfrisClientOrError(tenantId)
    if (clientResult instanceof NextResponse) return clientResult
    if (!clientResult) {
      return NextResponse.json({ error: 'EFRIS client not initialized' }, { status: 500 })
    }

    const { client, tenant } = clientResult
    const body = await request.json().catch(() => ({}))
    const batchSize = body.batchSize || 50

    // Fetch items without EFRIS codes
    const unmappedItems = await db.query.items.findMany({
      where: and(
        eq(items.tenantId, tenantId),
        isNull(items.efrisItemCode)
      ),
      limit: batchSize,
    })

    if (unmappedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unmapped items to register',
        registered: 0,
        failed: 0,
      })
    }

    // Validate all items
    const validItems = unmappedItems.filter(item => validateItemForEfris(item).isValid)
    const invalidItems = unmappedItems.filter(item => !validateItemForEfris(item).isValid)

    if (validItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid items to register',
        invalidItems: invalidItems.map(item => ({
          id: item.id,
          name: item.name,
          error: validateItemForEfris(item).error,
        })),
      }, { status: 400 })
    }

    // Map to EFRIS format
    const efrisProducts = validItems.map(item =>
      mapItemToEfrisProduct(item, tenant.currency || 'UGX')
    )

    // Register with EFRIS
    const response = await client.registerProduct(efrisProducts)

    // Extract goods codes from response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodsDetails = (response as any)?.data?.goodsDetails || []

    let registered = 0
    let failed = 0
    const results: Array<{ itemId: string; itemName: string; success: boolean; error?: string; goodsCode?: string }> = []

    // Update items with EFRIS codes
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i]
      const goodsCode = goodsDetails[i]?.goodsCode

      if (goodsCode) {
        await db.update(items)
          .set({
            efrisItemCode: goodsCode,
            efrisTaxForm: efrisProducts[i].taxForm,
            efrisTaxRule: efrisProducts[i].taxRule,
            updatedAt: new Date(),
          })
          .where(eq(items.id, item.id))

        results.push({
          itemId: item.id,
          itemName: item.name,
          success: true,
          goodsCode,
        })
        registered++
      } else {
        results.push({
          itemId: item.id,
          itemName: item.name,
          success: false,
          error: 'No goods code returned from EFRIS',
        })
        failed++
      }
    }

    // Add invalid items to results
    for (const item of invalidItems) {
      results.push({
        itemId: item.id,
        itemName: item.name,
        success: false,
        error: validateItemForEfris(item).error,
      })
      failed++
    }

    return NextResponse.json({
      success: registered > 0,
      registered,
      failed,
      total: unmappedItems.length,
      results,
    })
  } catch (error) {
    logError('api/efris/products/bulk-register DELETE', error)
    return NextResponse.json({ error: 'Failed to bulk register items with EFRIS' }, { status: 500 })
  }
}
