import Redis from 'ioredis'

// Singleton Redis client instance
let redisClient: Redis | null = null

/**
 * Get or create Redis client instance
 * Uses lazy initialization to avoid connection issues during build
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL

    if (!redisUrl) {
      // Return a mock client in dev if Redis isn't configured
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Redis] REDIS_URL not set. Caching disabled.')
        redisClient = createMockRedis()
        return redisClient
      }
      throw new Error('REDIS_URL environment variable is required in production')
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null // Stop retrying after 3 attempts
        return Math.min(times * 50, 2000) // Exponential backoff
      },
      // Connection pool settings
      connectTimeout: 5000,
      commandTimeout: 3000,
      // Keep connection alive
      keepAlive: 30000,
      // Lazy connect to avoid blocking startup
      lazyConnect: true,
    })

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully')
    })

    redisClient.on('ready', () => {
      console.log('[Redis] Client ready')
    })
  }

  return redisClient
}

/**
 * Create a mock Redis client for development when Redis isn't available
 */
function createMockRedis(): Redis {
  const mockHandlers: Record<string, (...args: any[]) => any> = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    exists: async () => 0,
    expire: async () => false,
    ttl: async () => -1,
    incr: async () => 1,
    decr: async () => 0,
    hget: async () => null,
    hset: async () => 0,
    hdel: async () => 0,
    hgetall: async () => ({}),
    mget: async () => [],
    zadd: async () => 0,
    zrange: async () => [],
    zrem: async () => 0,
    publish: async () => 0,
    subscribe: async () => {},
    quit: async () => 'OK',
  }

  return new Proxy({} as Redis, {
    get: (_, prop: string) => {
      if (mockHandlers[prop]) {
        return mockHandlers[prop]
      }
      // Return a no-op function for any other method
      return async () => null
    },
  })
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

/**
 * Check Redis connectivity
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient()
    const result = await client.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
