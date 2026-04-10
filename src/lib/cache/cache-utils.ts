import { getRedisClient } from './redis'
import type Redis from 'ioredis'

/**
 * Cache utilities for common caching patterns
 */

/** Default cache TTL in seconds */
const DEFAULT_TTL = 300 // 5 minutes
const HOUR_IN_SECONDS = 3600
const DAY_IN_SECONDS = 86400

/**
 * Get a cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient()
    const value = await client.get(key)
    return value ? JSON.parse(value) : null
  } catch (error) {
    console.error(`[Cache] Error getting key "${key}":`, error)
    return null
  }
}

/**
 * Set a cached value with TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const client = getRedisClient()
    const serialized = JSON.stringify(value)
    await client.setex(key, ttl, serialized)
  } catch (error) {
    console.error(`[Cache] Error setting key "${key}":`, error)
  }
}

/**
 * Delete a cached value
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const client = getRedisClient()
    await client.del(key)
  } catch (error) {
    console.error(`[Cache] Error deleting key "${key}":`, error)
  }
}

/**
 * Delete multiple cached values matching a pattern
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient()
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch (error) {
    console.error(`[Cache] Error deleting pattern "${pattern}":`, error)
  }
}

/**
 * Get or set a cached value, computing if not present
 */
export async function cacheGetOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) {
    return cached
  }

  const value = await compute()
  await cacheSet(key, value, ttl)
  return value
}

/**
 * Increment a counter
 */
export async function cacheIncr(key: string, ttl: number = DAY_IN_SECONDS): Promise<number> {
  try {
    const client = getRedisClient()
    const multi = client.multi()
    multi.incr(key)
    multi.expire(key, ttl)
    const results = await multi.exec()
    return results[0][1] as number
  } catch (error) {
    console.error(`[Cache] Error incrementing "${key}":`, error)
    return 0
  }
}

/**
 * Check if a key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const client = getRedisClient()
    const result = await client.exists(key)
    return result === 1
  } catch {
    return false
  }
}

/**
 * Get remaining TTL for a key
 */
export async function cacheTTL(key: string): Promise<number> {
  try {
    const client = getRedisClient()
    return await client.ttl(key)
  } catch {
    return -1
  }
}

/**
 * Cache helpers for tenant-specific data
 */
export const tenantCache = {
  key: (tenantId: string, resource: string, id?: string) =>
    `tenant:${tenantId}:${resource}${id ? `:${id}` : ''}`,

  get: <T>(tenantId: string, resource: string, id?: string) =>
    cacheGet<T>(tenantCache.key(tenantId, resource, id)),

  set: <T>(tenantId: string, resource: string, value: T, id?: string, ttl?: number) =>
    cacheSet(tenantCache.key(tenantId, resource, id), value, ttl),

  del: (tenantId: string, resource: string, id?: string) =>
    cacheDel(tenantCache.key(tenantId, resource, id)),

  delPattern: (tenantId: string, resource: string) =>
    cacheDelPattern(`tenant:${tenantId}:${resource}*`),
}

/**
 * Cache helpers for user-specific data
 */
export const userCache = {
  key: (userId: string, resource: string, id?: string) =>
    `user:${userId}:${resource}${id ? `:${id}` : ''}`,

  get: <T>(userId: string, resource: string, id?: string) =>
    cacheGet<T>(userCache.key(userId, resource, id)),

  set: <T>(userId: string, resource: string, value: T, id?: string, ttl?: number) =>
    cacheSet(userCache.key(userId, resource, id), value, ttl),

  del: (userId: string, resource: string, id?: string) =>
    cacheDel(userCache.key(userId, resource, id)),
}

/**
 * Rate limiting counter helpers
 */
export const rateLimitCache = {
  key: (identifier: string, action: string, window: string) =>
    `ratelimit:${identifier}:${action}:${window}`,

  check: async (
    identifier: string,
    action: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> => {
    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds)
    const key = rateLimitCache.key(identifier, action, windowStart.toString())

    try {
      const client = getRedisClient()
      const multi = client.multi()
      multi.incr(key)
      multi.expire(key, windowSeconds)
      const results = await multi.exec()
      const count = results[0][1] as number

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: (windowStart + 1) * windowSeconds * 1000,
      }
    } catch (error) {
      console.error(`[RateLimit] Error checking "${key}":`, error)
      // Fail open - allow request but log error
      return { allowed: true, remaining: 0, resetAt: Date.now() + windowSeconds * 1000 }
    }
  },
}
