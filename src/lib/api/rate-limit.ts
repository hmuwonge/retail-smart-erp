import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimitCache } from '@/lib/cache/cache-utils'

/**
 * Rate limiting configuration per endpoint type
 */
const RATE_LIMITS = {
  // Authentication endpoints (strict)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  },
  // API endpoints (moderate)
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // POS transactions (high throughput)
  pos: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  },
  // File uploads (restrictive)
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
  },
  // AI endpoints (expensive operations)
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
}

/**
 * Determine rate limit category based on request path
 */
function getCategory(request: NextRequest): keyof typeof RATE_LIMITS {
  const { pathname } = request.nextUrl

  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/register')) {
    return 'auth'
  }
  if (pathname.includes('/pos')) {
    return 'pos'
  }
  if (pathname.includes('/upload') || pathname.includes('/files')) {
    return 'upload'
  }
  if (pathname.includes('/ai')) {
    return 'ai'
  }
  return 'api'
}

/**
 * Extract client identifier (IP address or API key)
 */
function getClientIdentifier(request: NextRequest): string {
  // Try multiple headers for accurate IP behind proxies
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')

  // Use first IP from forwarded-for if present
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback to socket IP
  return 'unknown'
}

/**
 * Rate limiting middleware
 * Checks Redis-backed counters and rejects requests exceeding limits
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip rate limiting if not configured
  if (process.env.DISABLE_RATE_LIMITING === 'true') {
    return null
  }

  // Skip for health checks and static assets
  const { pathname } = request.nextUrl
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg')
  ) {
    return null
  }

  const category = getCategory(request)
  const config = RATE_LIMITS[category]
  const clientId = getClientIdentifier(request)
  const windowStart = Math.floor(Date.now() / config.windowMs)

  const result = await rateLimitCache.check(
    clientId,
    category,
    config.maxRequests,
    Math.floor(config.windowMs / 1000)
  )

  // Create response headers with rate limit info
  const headers = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
    'X-RateLimit-Window': `${config.windowMs / 1000}s`,
  }

  if (!result.allowed) {
    // Rate limit exceeded - return 429
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again after ${new Date(result.resetAt).toISOString()}`,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  // Store rate limit info in request headers for downstream use
  request.headers.set('x-ratelimit-remaining', result.remaining.toString())
  request.headers.set('x-ratelimit-category', category)

  return null // Continue to next middleware
}

/**
 * Get current rate limit status for a client (for API endpoint usage)
 */
export async function getRateLimitStatus(
  clientId: string,
  category: keyof typeof RATE_LIMITS
) {
  const config = RATE_LIMITS[category]
  const windowStart = Math.floor(Date.now() / config.windowMs)
  const key = `ratelimit:${clientId}:${category}:${windowStart}`

  try {
    const { cacheGet, cacheTTL } = await import('@/lib/cache/cache-utils')
    const current = (await cacheGet<number>(key)) || 0
    const ttl = await cacheTTL(key)

    return {
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - current),
      current,
      resetIn: ttl > 0 ? ttl * 1000 : config.windowMs,
      windowMs: config.windowMs,
    }
  } catch {
    return null
  }
}

/**
 * API route handler to expose rate limit status to clients
 */
export async function rateLimitStatusHandler(request: NextRequest) {
  const category = (request.nextUrl.searchParams.get('category') as keyof typeof RATE_LIMITS) || 'api'
  const clientId = getClientIdentifier(request)

  const status = await getRateLimitStatus(clientId, category)

  if (!status) {
    return NextResponse.json(
      { error: 'Rate limit status unavailable' },
      { status: 500 }
    )
  }

  return NextResponse.json(status)
}
