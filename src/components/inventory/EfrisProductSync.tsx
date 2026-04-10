'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Upload, Package, Search, Filter, ExternalLink,
} from 'lucide-react'
import { toast } from '@/components/ui/toast'

interface EfrisItem {
  id: string
  name: string
  sku: string | null
  sellingPrice: string
  efrisItemCode: string | null
  efrisTaxForm: string | null
  efrisTaxRule: string | null
  efrisStatus: {
    status: 'mapped' | 'pending' | 'error'
    label: string
    code?: string
    error?: string
    taxForm?: string
    taxRule?: string
  }
}

interface PaginationData {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function EfrisProductSync() {
  const [items, setItems] = useState<EfrisItem[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)
  const [bulkRegistering, setBulkRegistering] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'mapped' | 'pending' | 'error'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      params.set('page', pagination.page.toString())
      params.set('pageSize', pagination.pageSize.toString())
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/efris/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.data || [])
        setPagination(data.pagination)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to fetch EFRIS products')
      }
    } catch (error) {
      console.error('Failed to fetch EFRIS products:', error)
      toast.error('Failed to fetch EFRIS products')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, pagination.page, pagination.pageSize, debouncedSearch])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 on search
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const syncFromEfris = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/efris/products/sync', {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(`Synced ${data.synced} products, matched ${data.matched}`)
        fetchItems()
      } else {
        toast.error(data.error || 'Failed to sync from EFRIS')
      }
    } catch (error) {
      console.error('Failed to sync from EFRIS:', error)
      toast.error('Failed to sync from EFRIS')
    } finally {
      setSyncing(false)
    }
  }

  const registerItem = async (itemId: string) => {
    setRegistering(itemId)
    try {
      const res = await fetch('/api/efris/products/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(`Registered "${data.itemName}" with EFRIS`)
        fetchItems()
      } else {
        toast.error(data.error || 'Failed to register item')
      }
    } catch (error) {
      console.error('Failed to register item:', error)
      toast.error('Failed to register item')
    } finally {
      setRegistering(null)
    }
  }

  const bulkRegister = async () => {
    setBulkRegistering(true)
    try {
      const res = await fetch('/api/efris/products/bulk-register', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 50 }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(`Registered ${data.registered} items, ${data.failed} failed`)
        fetchItems()
      } else {
        toast.error(data.error || 'Failed to bulk register items')
      }
    } catch (error) {
      console.error('Failed to bulk register items:', error)
      toast.error('Failed to bulk register items')
    } finally {
      setBulkRegistering(false)
    }
  }

  const getStatusBadge = (status: EfrisItem['efrisStatus']) => {
    switch (status.status) {
      case 'mapped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Mapped
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full" title={status.error}>
            <XCircle className="w-3 h-3" />
            Error
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Not Mapped
          </span>
        )
    }
  }

  // Count items by status
  const stats = {
    mapped: items.filter(i => i.efrisStatus.status === 'mapped').length,
    pending: items.filter(i => i.efrisStatus.status === 'pending').length,
    error: items.filter(i => i.efrisStatus.status === 'error').length,
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">EFRIS Product Mapping</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sync and register products with Uganda Revenue Authority EFRIS system
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncFromEfris}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync from EFRIS
          </button>
          <button
            onClick={bulkRegister}
            disabled={bulkRegistering || stats.pending === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {bulkRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Bulk Register All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Mapped</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.mapped}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.pending}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400">Errors</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.error}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter)
              setPagination(prev => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="mapped">Mapped</option>
            <option value="pending">Not Mapped</option>
            <option value="error">Errors</option>
          </select>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No items found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Item
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      SKU
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Price
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      EFRIS Code
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{item.sku || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {parseFloat(item.sellingPrice).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.efrisItemCode ? (
                          <span className="text-sm text-green-600 dark:text-green-400 font-mono">
                            {item.efrisItemCode}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(item.efrisStatus)}
                      </td>
                      <td className="px-6 py-4">
                        {item.efrisStatus.status === 'pending' && (
                          <button
                            onClick={() => registerItem(item.id)}
                            disabled={registering === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {registering === item.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-3 h-3" />
                                Register
                              </>
                            )}
                          </button>
                        )}
                        {item.efrisStatus.status === 'error' && (
                          <span className="text-xs text-red-500" title={item.efrisStatus.error}>
                            {item.efrisStatus.error}
                          </span>
                        )}
                        {item.efrisStatus.status === 'mapped' && (
                          <a
                            href="#"
                            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={(e) => {
                              e.preventDefault()
                              // Future: Show EFRIS product details
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            View in EFRIS
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total} items
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
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
