'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, ShieldCheck, AlertCircle, TrendingUp, Loader2, ExternalLink } from 'lucide-react'
import { useCompany } from '@/components/providers/CompanyContextProvider'

interface EfrisDashboardStats {
  efrisEnabled: boolean
  todaySubmissions: number
  todaySuccess: number
  todayFailed: number
  todayPending: number
  successRate: number
  recentFailed: Array<{
    id: string
    saleNo: string
    error: string | null
  }>
}

export function EfrisStatusWidget() {
  const { tenantSlug } = useCompany()
  const [stats, setStats] = useState<EfrisDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch(`/api/reports/efris-submissions?startDate=${today}&endDate=${today}`)
        if (res.ok) {
          const data = await res.json()
          
          // Fetch failed submissions for display
          const failedRes = await fetch(`/api/reports/efris-submissions?status=failed&startDate=${today}&endDate=${today}&pageSize=5`)
          const failedData = failedRes.ok ? await failedRes.json() : { data: [] }

          setStats({
            efrisEnabled: true,
            todaySubmissions: data.stats?.total || 0,
            todaySuccess: data.stats?.success || 0,
            todayFailed: data.stats?.failed || 0,
            todayPending: data.stats?.pending || 0,
            successRate: data.stats?.total > 0 
              ? Math.round((data.stats.success / data.stats.total) * 100) 
              : 100,
            recentFailed: failedData.data?.map((s: any) => ({
              id: s.id,
              saleNo: s.saleNo,
              error: s.efrisError,
            })) || [],
          })
        }
      } catch (error) {
        console.error('Failed to fetch EFRIS dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">EFRIS Status</h3>
        </div>
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          Loading EFRIS stats...
        </div>
      </div>
    )
  }

  // Don't show if no stats or EFRIS not enabled
  if (!stats || !stats.efrisEnabled) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-green-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">EFRIS Today</h3>
        </div>
        <Link
          href={`/c/${tenantSlug}/reports/efris`}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          View Report
          <ExternalLink size={12} />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.todaySuccess}</p>
          <p className="text-xs text-green-600 dark:text-green-400">Success</p>
        </div>
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.todayFailed}</p>
          <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
        </div>
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.todayPending}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">Pending</p>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.successRate}%</p>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">Success Rate</p>
        </div>
      </div>

      {/* Recent Failures */}
      {stats.recentFailed.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent Failures:</p>
          <div className="space-y-1">
            {stats.recentFailed.map((sale) => (
              <div key={sale.id} className="flex items-start gap-2 text-xs">
                <AlertCircle size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono">{sale.saleNo}</span>
                  {sale.error && (
                    <p className="text-gray-500 dark:text-gray-400 truncate" title={sale.error}>
                      {sale.error.length > 40 ? `${sale.error.slice(0, 40)}...` : sale.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
