import { Pool } from 'pg'

/**
 * Dual connection pool setup for read/write splitting
 * - Write pool: Primary database (all writes, some reads)
 * - Read pool: Read replicas (reporting, dashboard, analytics)
 */

interface PoolConfig {
  writeUrl: string
  readUrls?: string[]
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

let writePool: Pool | null = null
let readPools: Pool[] = []
let currentReadPoolIndex = 0

/**
 * Initialize both write and read connection pools
 */
export function initDualPools(config: PoolConfig): void {
  // Write pool (primary database)
  if (!writePool) {
    writePool = new Pool({
      connectionString: config.writeUrl,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
    })

    writePool.on('error', (err) => {
      console.error('[DB] Write pool error:', err.message)
    })
  }

  // Read pools (replicas)
  if (config.readUrls && config.readUrls.length > 0) {
    readPools = config.readUrls.map((readUrl, index) => {
      const pool = new Pool({
        connectionString: readUrl,
        max: Math.ceil((config.max || 20) / config.readUrls!.length),
        idleTimeoutMillis: config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
      })

      pool.on('error', (err) => {
        console.error(`[DB] Read pool ${index} error:`, err.message)
      })

      return pool
    })

    console.log(`[DB] Initialized ${readPools.length} read pool(s)`)
  }
}

/**
 * Get write pool connection (for INSERT, UPDATE, DELETE, transactions)
 */
export function getWritePool(): Pool {
  if (!writePool) {
    throw new Error('Write pool not initialized. Call initDualPools() first.')
  }
  return writePool
}

/**
 * Get read pool connection (for SELECT queries)
 * Uses round-robin load balancing across read replicas
 */
export function getReadPool(): Pool {
  if (readPools.length === 0) {
    // Fallback to write pool if no read replicas configured
    return getWritePool()
  }

  // Round-robin selection
  const pool = readPools[currentReadPoolIndex % readPools.length]
  currentReadPoolIndex = (currentReadPoolIndex + 1) % readPools.length
  return pool
}

/**
 * Execute a read query with automatic replica selection
 */
export async function executeReadQuery<T>(
  query: string,
  params?: any[]
): Promise<T> {
  const pool = getReadPool()
  const client = await pool.connect()

  try {
    const result = await client.query(query, params)
    return result.rows as T
  } finally {
    client.release()
  }
}

/**
 * Execute a write query on primary database
 */
export async function executeWriteQuery<T>(
  query: string,
  params?: any[]
): Promise<T> {
  const pool = getWritePool()
  const client = await pool.connect()

  try {
    const result = await client.query(query, params)
    return result.rows as T
  } finally {
    client.release()
  }
}

/**
 * Execute a transaction on primary database
 */
export async function executeTransaction<T>(
  fn: (client: any) => Promise<T>
): Promise<T> {
  const pool = getWritePool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Close all pools (graceful shutdown)
 */
export async function closeAllPools(): Promise<void> {
  if (writePool) {
    await writePool.end()
    writePool = null
  }

  for (const pool of readPools) {
    await pool.end()
  }
  readPools = []
}

/**
 * Check health of all pools
 */
export async function checkPoolHealth(): Promise<{
  write: 'healthy' | 'unhealthy'
  reads: Array<{ index: number; status: 'healthy' | 'unhealthy' }>
}> {
  const health = {
    write: 'healthy' as const,
    reads: [] as Array<{ index: number; status: 'healthy' | 'unhealthy' }>,
  }

  // Check write pool
  try {
    const client = await writePool!.connect()
    await client.query('SELECT 1')
    client.release()
  } catch {
    health.write = 'unhealthy'
  }

  // Check read pools
  for (let i = 0; i < readPools.length; i++) {
    try {
      const client = await readPools[i].connect()
      await client.query('SELECT 1')
      client.release()
      health.reads.push({ index: i, status: 'healthy' })
    } catch {
      health.reads.push({ index: i, status: 'unhealthy' })
    }
  }

  return health
}
