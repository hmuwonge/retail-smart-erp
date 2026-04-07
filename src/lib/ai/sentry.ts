import * as Sentry from '@sentry/nextjs'

/**
 * Initialize Sentry error tracking (Sentry v8 SDK)
 * Call once during app startup
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN

  // Only initialize if DSN is provided
  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not set. Error tracking disabled.')
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.1, // Sample 10% of transactions by default
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    debug: process.env.NODE_ENV !== 'production',

    // Integrations are auto-configured in v8
    // Filter out noisy third-party errors
    beforeSend(event, hint) {
      // Ignore errors from browser extensions
      const exception = hint.originalException as any
      if (exception?.message?.includes('chrome-extension://')) {
        return null
      }
      return event
    },

    // Ignore certain errors that don't need tracking
    ignoreErrors: [
      // Browser extension errors
      'top.GLOBALS',
      'Original error: Script error for "app"',
      // Network errors (too noisy)
      'Network Error',
      'Failed to fetch',
      'Load failed',
      // Random plugins/extensions
      'atomicFindClose',
      'fb_instream_flow_redirect',
      // Other
      'Non-Error promise rejection captured with keys: code',
    ],

    // Set user context from NextAuth
    initialScope: {
      tags: {
        'app.version': process.env.APP_VERSION || 'unknown',
      },
    },
  })

  console.log('[Sentry] Initialized successfully')
}

/**
 * Manually capture an error with additional context
 */
export function captureError(
  error: Error | string | unknown,
  context?: Record<string, any>
): string | undefined {
  if (!process.env.SENTRY_DSN) return undefined

  return Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture a message event (warning, info, etc.)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): string | undefined {
  if (!process.env.SENTRY_DSN) return undefined

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(userId: string, email?: string): void {
  if (!process.env.SENTRY_DSN) return

  Sentry.setUser({
    id: userId,
    email,
  })
}

/**
 * Set tenant context for error tracking
 */
export function setSentryTenant(tenantId: string, tenantSlug?: string): void {
  if (!process.env.SENTRY_DSN) return

  Sentry.setTags({
    'tenant.id': tenantId,
    'tenant.slug': tenantSlug,
  })
}

/**
 * Clear Sentry user context (on logout)
 */
export function clearSentryUser(): void {
  if (!process.env.SENTRY_DSN) return

  Sentry.setUser(null)
  Sentry.setTags({})
}
