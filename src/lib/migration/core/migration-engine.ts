import { db } from '@/lib/db'
import { migrations, migration_entity_progress, platform_connections } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { QuickBooksProvider } from '@/lib/migration/providers/quickbooks-provider'
import { FreshBooksProvider } from '@/lib/migration/providers/freshbooks-provider'
import { mapAndImportQBCustomer } from '@/lib/migration/mappers/customer-mapper'
import { mapAndImportQBItem } from '@/lib/migration/mappers/item-mapper'
import { mapAndImportQBInvoice } from '@/lib/migration/mappers/invoice-mapper'
import { logError } from '@/lib/ai/error-logger'

export interface MigrationResult {
  success: boolean
  entities: Record<string, { total: number; created: number; updated: number; skipped: number; errors: number }>
}

export class MigrationEngine {
  /**
   * Starts a migration job for a specific connection.
   */
  static async run(connectionId: string, tenantId: string, entities: string[]): Promise<MigrationResult> {
    const connection = await db.query.platform_connections.findFirst({
      where: eq(platform_connections.id, connectionId),
    })

    if (!connection || connection.tenantId !== tenantId) {
      throw new Error('Connection not found or unauthorized')
    }

    if (connection.status !== 'connected' || !connection.accessToken || !connection.refreshToken) {
      throw new Error('Connection is invalid or disconnected')
    }

    // Initialize Migration Record
    const [migrationJob] = await db.insert(migrations)
      .values({
        tenantId,
        connectionId,
        sourcePlatform: connection.platform,
        status: 'running',
        entities,
        startedAt: new Date(),
      })
      .returning()

    const result: MigrationResult = { success: true, entities: {} }

    try {
      // Select Provider based on Platform
      let provider: any

      if (connection.platform === 'quickbooks') {
        if (!connection.realmId) throw new Error('Missing Realm ID for QuickBooks')
        provider = new QuickBooksProvider(
          connection.realmId,
          connection.accessToken,
          connection.refreshToken
        )
      } else if (connection.platform === 'freshbooks') {
        if (!connection.accountId) throw new Error('Missing Account ID for FreshBooks')
        provider = new FreshBooksProvider(
          connection.accountId,
          connection.accessToken,
          connection.refreshToken
        )
      } else {
        // TODO: Add Zoho/Xero providers here
        throw new Error(`Unsupported platform: ${connection.platform}`)
      }

      // Process Entities
      for (const entity of entities) {
        await this.processEntity(migrationJob.id, provider, entity, tenantId, connection.platform, result)
      }

      await db.update(migrations)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(migrations.id, migrationJob.id))

      return result
    } catch (error: any) {
      logError('migration-engine/run', error)
      await db.update(migrations)
        .set({ status: 'failed', errorMessage: error.message })
        .where(eq(migrations.id, migrationJob.id))

      result.success = false
      return result
    }
  }

  private static async processEntity(
    migrationId: string,
    provider: any,
    entity: string,
    tenantId: string,
    platform: string,
    result: MigrationResult
  ) {
    const [progress] = await db.insert(migration_entity_progress)
      .values({ migrationId, entityType: entity, status: 'fetching' })
      .returning()

    const stats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

    try {
      let rawData: any[] = []

      // Fetch Data (Polymorphic based on provider methods)
      if (entity === 'customers' || entity === 'contacts') {
        // Normalize naming: Zoho/FB might use 'contacts', QB uses 'customers'
        rawData = provider.fetchCustomers ? await provider.fetchCustomers() : await provider.fetchContacts()
      } else if (entity === 'items') {
        rawData = await provider.fetchItems()
      } else if (entity === 'vendors') {
        rawData = provider.fetchVendors ? await provider.fetchVendors() : [] // Some platforms don't have vendors
      } else if (entity === 'invoices') {
        rawData = await provider.fetchInvoices()
      }

      stats.total = rawData.length
      await db.update(migration_entity_progress)
        .set({ status: 'importing', totalCount: stats.total, startedAt: new Date() })
        .where(eq(migration_entity_progress.id, progress.id))

      // Import Data
      for (const record of rawData) {
        try {
          // Route to correct Mapper based on Entity + Platform
          const action = await this.mapRecord(platform, entity, record, tenantId)
          if (action === 'created') stats.created++
          else if (action === 'updated') stats.updated++
          else stats.skipped++
        } catch (err: any) {
          logError(`migration-engine/import/${entity}`, err)
          stats.errors++
        }
      }

      await db.update(migration_entity_progress)
        .set({ status: 'completed', importedCount: stats.created + stats.updated, skippedCount: stats.skipped, failedCount: stats.errors, completedAt: new Date() })
        .where(eq(migration_entity_progress.id, progress.id))

      result.entities[entity] = stats
    } catch (error: any) {
      logError(`migration-engine/processEntity/${entity}`, error)
      stats.errors = stats.total
      await db.update(migration_entity_progress)
        .set({ status: 'failed', error_log: { message: error.message }, failedCount: stats.total, completedAt: new Date() })
        .where(eq(migration_entity_progress.id, progress.id))

      result.entities[entity] = stats
    }
  }

  private static async mapRecord(platform: string, entity: string, record: any, tenantId: string): Promise<string> {
    // Route to Mappers
    if (platform === 'quickbooks') {
      if (entity === 'customers') {
        const res = await mapAndImportQBCustomer(record, tenantId)
        return res.action
      }
      if (entity === 'items') {
        const res = await mapAndImportQBItem(record, tenantId)
        return res.action
      }
      if (entity === 'invoices') {
        const res = await mapAndImportQBInvoice(record, tenantId)
        return res.action
      }
    } else {
      // Generic Mappers for FreshBooks, Zoho, Xero
      const { mapAndImportGenericContact, mapAndImportGenericItem, mapAndImportGenericInvoice } = await import('@/lib/migration/mappers/generic-mapper')

      if (entity === 'customers' || entity === 'contacts') {
        const res = await mapAndImportGenericContact(record, tenantId, platform)
        return res.action
      }
      if (entity === 'items') {
        const res = await mapAndImportGenericItem(record, tenantId, platform)
        return res.action
      }
      if (entity === 'invoices') {
        const res = await mapAndImportGenericInvoice(record, tenantId, platform)
        return res.action
      }
    }

    return 'skipped'
  }
}
