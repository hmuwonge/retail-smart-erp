/**
 * OpenTelemetry SDK Initialization
 * 
 * This file configures the OpenTelemetry SDK for production tracing and metrics.
 * It should be imported at the very top of server.ts before any other imports.
 * 
 * In production, the SDK sends traces to an OpenTelemetry Collector or
 * compatible backend (Jaeger, Zipkin, Datadog, New Relic, etc.)
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

let sdk: NodeSDK | null = null

/**
 * Initialize OpenTelemetry SDK
 * Call this ONCE at the very start of your application
 */
export function initOpenTelemetrySDK(): NodeSDK | null {
  // Skip if not enabled or already initialized
  if (process.env.OTEL_ENABLED !== 'true') {
    console.log('[OpenTelemetry] Disabled. Set OTEL_ENABLED=true to enable.')
    return null
  }

  if (sdk) {
    console.log('[OpenTelemetry] SDK already initialized.')
    return sdk
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'
  const serviceName = process.env.OTEL_SERVICE_NAME || 'retail-smart-erp'
  const serviceVersion = process.env.APP_VERSION || '1.0.0'

  console.log(`[OpenTelemetry] Initializing SDK (endpoint: ${endpoint})`)

  // Configure resource attributes
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  })

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  })

  // Configure metric exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
  })

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export metrics every 60s
  })

  // Initialize SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Enable auto-instrumentation for common libraries
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false }, // Too noisy
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  })

  // Start the SDK
  sdk.start()

  console.log('[OpenTelemetry] SDK started successfully')

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('[OpenTelemetry] Shutting down SDK...')
    await sdk?.shutdown()
    console.log('[OpenTelemetry] SDK shut down complete')
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return sdk
}

/**
 * Get the SDK instance (for manual control if needed)
 */
export function getSDK(): NodeSDK | null {
  return sdk
}
