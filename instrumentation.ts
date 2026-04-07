/**
 * Next.js OpenTelemetry Instrumentation Registration
 * 
 * This file is automatically loaded by Next.js when OTEL_ENABLED=true.
 * It registers the OpenTelemetry SDK before any application code runs.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry
 */

import { registerOTel } from '@vercel/otel'

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    registerOTel({
      serviceName: 'retail-smart-erp',
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime has limited OpenTelemetry support
    console.log('[OpenTelemetry] Edge runtime detected - skipping full instrumentation')
  }
}
