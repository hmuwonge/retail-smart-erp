'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight, Home, Download, Filter, Search, RefreshCw, Loader2 } from 'lucide-react'
import { useCompany } from '@/components/providers/CompanyContextProvider'
import { EfrisStatusBadge } from '@/components/sales/EfrisStatusBadge'

interface EfrisSubmission {
  id: string
  saleNo: string
  total: string
  status: string
  isReturn: boolean
  returnAgainst: string | null
  createdAt: string
  efrisStatus: string
  efrisInvoiceNo: string | null
  efrisAntifakeCode: string | null
  efrisQrCode: string | null
  efrisError: string | null
  efrisSubmittedAt: string | null
  efrisRetryCount: number
  efrisLastRetryAt: string | null
}

interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface StatsData {
  total: number
  success: number
  failed: number
  pending: number
}

export default function EfrisReportPage() {
  const { tenantSlug } = useCompany()
  const [submissions, setSubmissions] = useState<EfrisSubmission[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  })
  const [stats, setStats] = useState<StatsData>({ total: 0, success: 0, failed: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })
  const [search, setSearch] = useState('')

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('pageSize', pagination.pageSize.toString())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateRange.start) params.set('startDate', dateRange.start)
      if (dateRange.end) params.set('endDate', dateRange.end)

      const res = await fetch(`/api/reports/efris-submissions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSubmissions(data.data || [])
        setPagination(data.pagination)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch EFRIS submissions:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, statusFilter, dateRange])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const exportToCSV = () => {
    const headers = ['Sale No', 'Date', 'Status', 'EFRIS Status', 'EFRIS Invoice', 'Total', 'Error']
    const rows = submissions.map(s => [
      s.saleNo,
      new Date(s.createdAt).toLocaleDateString(),
      s.isReturn ? 'Return' : 'Sale',
      s.efrisStatus,
      s.efrisInvoiceNo || '-',
      parseFloat(s.total).toFixed(2),
      s.efrisError || '-',
    ])

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `efris-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleResubmitSuccess = () => {
    fetchSubmissions()
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <Link href={`/c/${tenantSlug}`} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <Home size={14} />
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 dark:text-white font-medium">EFRIS Submissions</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EFRIS Submissions Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track and manage EFRIS invoice submissions
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400">Success</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.success}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">Failed</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.failed}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">From:</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }))
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">To:</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }))
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by sale number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
          </div>
          <button
            onClick={fetchSubmissions}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No EFRIS submissions found
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Sale No
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Type
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Total
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    EFRIS Status
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    EFRIS Invoice
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm">{sub.saleNo}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {sub.isReturn ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                          Return
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          Sale
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      {parseFloat(sub.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <EfrisStatusBadge
                        saleId={sub.id}
                        efrisStatus={sub.efrisStatus}
                        efrisInvoiceNo={sub.efrisInvoiceNo}
                        efrisAntifakeCode={sub.efrisAntifakeCode}
                        efrisQrCode={sub.efrisQrCode}
                        efrisError={sub.efrisError}
                        onResubmitSuccess={handleResubmitSuccess}
                      />
                    </td>
                    <td className="px-6 py-4">
                      {sub.efrisInvoiceNo ? (
                        <span className="font-mono text-sm text-green-600 dark:text-green-400">
                          {sub.efrisInvoiceNo}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/c/${tenantSlug}/sales/${sub.id}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View Sale
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50 dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total} submissions
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
