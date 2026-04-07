import { NextResponse } from 'next/server'
import { checkRedisHealth } from '@/lib/cache/redis'
import { getSharedPool } from '@/lib/db/pool'

/**
 * GET /api/health
 * Comprehensive health check for all infrastructure components
 */
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {} as Record<string, { status: string; message?: string; responseTime?: number }>,
  }

  // Check PostgreSQL
  const dbStart = Date.now()
  try {
    const pool = getSharedPool()
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    health.checks.postgresql = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    }
  } catch (error: any) {
    health.checks.postgresql = {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - dbStart,
    }
    health.status = 'degraded'
  }

  // Check Redis
  const redisStart = Date.now()
  try {
    const redisHealthy = await checkRedisHealth()
    health.checks.redis = {
      status: redisHealthy ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - redisStart,
    }
    if (!redisHealthy) {
      health.status = 'degraded'
    }
  } catch (error: any) {
    health.checks.redis = {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - redisStart,
    }
    health.status = 'degraded'
  }

  // Check environment
  health.checks.environment = {
    status: 'healthy',
    message: `NODE_ENV=${process.env.NODE_ENV || 'not set'}`,
  }

  // Return response
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}
