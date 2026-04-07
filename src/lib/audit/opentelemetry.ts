import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import type { Tracer, Span, SpanOptions } from '@opentelemetry/api'

/**
 * OpenTelemetry instrumentation utilities
 * Provides tracing for database queries, API calls, and business operations
 */

const TRACER_NAME = 'retail-smart-erp'
const TRACER_VERSION = '1.0.0'

let tracer: Tracer | null = null

/**
 * Get or create tracer instance
 */
export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION)
  }
  return tracer
}

/**
 * Create a traced span with automatic error handling
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: Partial<SpanOptions> = {}
): Promise<T> {
  const tracerInstance = getTracer()

  return tracerInstance.startActiveSpan(name, options, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      })
      span.recordException(err)
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Create a synchronous traced span
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options: Partial<SpanOptions> = {}
): T {
  const tracerInstance = getTracer()

  return tracerInstance.startActiveSpan(name, options, (span) => {
    try {
      const result = fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      })
      span.recordException(err)
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Database query tracing helper
 */
export async function traceDbQuery<T>(
  query: string,
  executeQuery: () => Promise<T>,
  params?: Record<string, any>
): Promise<T> {
  return withSpan(
    `db.query`,
    async (span) => {
      span.setAttribute('db.system', 'postgresql')
      span.setAttribute('db.statement', query)
      span.setAttribute('db.operation', extractDbOperation(query))

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          span.setAttribute(`db.params.${key}`, String(value))
        })
      }

      return executeQuery()
    },
    { kind: SpanKind.CLIENT }
  )
}

/**
 * API route tracing helper
 */
export async function traceApiCall<T>(
  method: string,
  path: string,
  handler: () => Promise<T>,
  tenantId?: string
): Promise<T> {
  return withSpan(
    `http.${method.toLowerCase()} ${path}`,
    async (span) => {
      span.setAttribute('http.method', method)
      span.setAttribute('http.route', path)
      span.setAttribute('http.flavor', '1.1')

      if (tenantId) {
        span.setAttribute('tenant.id', tenantId)
      }

      return handler()
    },
    { kind: SpanKind.SERVER }
  )
}

/**
 * Cache operation tracing helper
 */
export async function traceCacheOperation<T>(
  operation: string,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`cache.${operation}`, async (span) => {
    span.setAttribute('cache.operation', operation)
    span.setAttribute('cache.key', key)
    return fn()
  })
}

/**
 * Business logic tracing
 */
export async function traceBusinessLogic<T>(
  operation: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return withSpan(
    `business.${operation}`,
    async (span) => {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value)
        })
      }
      return fn(span)
    },
    { kind: SpanKind.INTERNAL }
  )
}

/**
 * Extract database operation type from SQL query
 */
function extractDbOperation(query: string): string {
  const trimmed = query.trim().toUpperCase()
  if (trimmed.startsWith('SELECT')) return 'SELECT'
  if (trimmed.startsWith('INSERT')) return 'INSERT'
  if (trimmed.startsWith('UPDATE')) return 'UPDATE'
  if (trimmed.startsWith('DELETE')) return 'DELETE'
  if (trimmed.startsWith('CREATE')) return 'CREATE'
  if (trimmed.startsWith('ALTER')) return 'ALTER'
  return 'UNKNOWN'
}

/**
 * Add event to current span (if active)
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>): void {
  const currentSpan = trace.getActiveSpan()
  if (currentSpan) {
    currentSpan.addEvent(name, attributes)
  }
}

/**
 * Set attribute on current active span
 */
export function setSpanAttribute(
  key: string,
  value: string | number | boolean
): void {
  const currentSpan = trace.getActiveSpan()
  if (currentSpan) {
    currentSpan.setAttribute(key, value)
  }
}

/**
 * Initialize OpenTelemetry SDK (call once at startup)
 * Note: In production, SDK is initialized via instrumentation.ts
 */
export function initOpenTelemetry(): void {
  if (process.env.OTEL_ENABLED !== 'true') {
    console.log('[OpenTelemetry] Disabled. Set OTEL_ENABLED=true to enable.')
    return
  }

  console.log('[OpenTelemetry] Initialized successfully')
}
