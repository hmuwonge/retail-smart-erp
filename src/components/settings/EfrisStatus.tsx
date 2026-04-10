'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldCheck, AlertCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { SectionCard } from '@/components/ui/section-card'

interface EfrisStatus {
  efrisEnabled: boolean
  efrisConfigured: boolean
  efrisTinMasked: string | null
  efrisStatus: 'enabled' | 'disabled' | 'not_configured' | 'not_available'
  planEligible: boolean
}

export function EfrisStatus() {
  const [data, setData] = useState<EfrisStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEfrisStatus() {
      try {
        const res = await fetch('/api/settings/efris')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (error) {
        console.error('Failed to fetch EFRIS status:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEfrisStatus()
  }, [])

  if (loading) {
    return (
      <SectionCard title="EFRIS Integration" icon={<Shield size={16} />}>
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          Loading EFRIS status...
        </div>
      </SectionCard>
    )
  }

  if (!data) {
    return null
  }

  // Not eligible for EFRIS (not on enterprise plan)
  if (!data.planEligible) {
    return (
      <SectionCard title="EFRIS Integration" icon={<Shield size={16} />}>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300">EFRIS Not Available</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  EFRIS (Uganda Revenue Authority integration) is available exclusively on the Enterprise plan.
                </p>
                <Link
                  href="/account/upgrade"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                >
                  Upgrade to Enterprise
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    )
  }

  // Eligible but not configured
  if (!data.efrisConfigured && !data.efrisEnabled) {
    return (
      <SectionCard title="EFRIS Integration" icon={<Shield size={16} />}>
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-900 dark:text-yellow-300">EFRIS Not Configured</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  Your account is eligible for EFRIS integration, but it has not been configured yet.
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
                  <strong>Contact your system administrator</strong> to enable EFRIS and configure your TIN and API token.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    )
  }

  // Configured but disabled
  if (data.efrisConfigured && !data.efrisEnabled) {
    return (
      <SectionCard title="EFRIS Integration" icon={<Shield size={16} />}>
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-orange-900 dark:text-orange-300">EFRIS Disabled</h4>
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                  EFRIS has been configured but is currently disabled for your account.
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-2">
                  <strong>Contact your system administrator</strong> to enable EFRIS integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    )
  }

  // Enabled and configured
  if (data.efrisEnabled && data.efrisConfigured) {
    return (
      <SectionCard title="EFRIS Integration" icon={<ShieldCheck size={16} />}>
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-green-900 dark:text-green-300">EFRIS Enabled</h4>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  EFRIS integration is active and configured for your account.
                </p>
                {data.efrisTinMasked && (
                  <p className="text-sm text-green-700 dark:text-green-400 mt-2">
                    <strong>TIN:</strong> <span className="font-mono">{data.efrisTinMasked}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/c/[slug]/inventory"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Register Products →
            </Link>
            <Link
              href="/c/[slug]/reports/efris"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              View EFRIS Reports →
            </Link>
          </div>
        </div>
      </SectionCard>
    )
  }

  return null
}
