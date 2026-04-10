'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Building2, CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
  Save, RefreshCw, Filter, Search, Shield, ShieldCheck,
} from 'lucide-react'

interface EfrisTenant {
  id: string
  name: string
  slug: string
  country: string
  currency: string
  plan: string
  isEnterprise: boolean
  subscriptionStatus: string
  efrisEnabled: boolean
  efrisConfigured: boolean
  efrisStatus: 'enabled' | 'configured' | 'not_configured' | 'connection_error'
  efrisTin: string | null
  efrisTinMasked: string | null
  createdAt: string
}

export default function EfrisManagementPage() {
  const [tenants, setTenants] = useState<EfrisTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'not_configured'>('all')
  const [countryFilter, setCountryFilter] = useState('UG')
  const [testing, setTesting] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingTenant, setEditingTenant] = useState<EfrisTenant | null>(null)
  const [editForm, setEditForm] = useState({ efrisEnabled: false, efrisTin: '', efrisToken: '' })
  const [showToken, setShowToken] = useState(false)
  const [bulkSelecting, setBulkSelecting] = useState(false)
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set())

  const fetchTenants = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (countryFilter) params.set('country', countryFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/sys-control/efris/tenants?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
      }
    } catch (error) {
      console.error('Failed to fetch EFRIS tenants:', error)
    } finally {
      setLoading(false)
    }
  }, [countryFilter, debouncedSearch, statusFilter])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const testConnection = async (tenantId: string) => {
    setTesting(tenantId)
    try {
      const res = await fetch(`/api/sys-control/efris/${tenantId}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        alert(`✓ ${data.message}`)
        fetchTenants()
      } else {
        alert(`✗ ${data.error || 'Connection test failed'}`)
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      alert('Failed to test connection')
    } finally {
      setTesting(null)
    }
  }

  const openEditModal = (tenant: EfrisTenant) => {
    setEditingTenant(tenant)
    setEditForm({
      efrisEnabled: tenant.efrisEnabled,
      efrisTin: tenant.efrisTin || '',
      efrisToken: '',
    })
    setShowToken(false)
  }

  const saveConfig = async () => {
    if (!editingTenant) return
    setSaving(editingTenant.id)

    // Validate TIN format
    if (editForm.efrisTin && !/^UG\d{10}$/.test(editForm.efrisTin)) {
      alert('Invalid TIN format. Must be UG followed by 10 digits.')
      return
    }

    // Validate required fields when enabling
    if (editForm.efrisEnabled && (!editForm.efrisTin || !editForm.efrisToken)) {
      alert('TIN and API Token are required to enable EFRIS.')
      return
    }

    try {
      const res = await fetch(`/api/sys-control/efris/${editingTenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()

      if (res.ok) {
        alert('✓ EFRIS configuration saved successfully')
        setEditingTenant(null)
        fetchTenants()
      } else {
        alert(`✗ ${data.error || 'Failed to save configuration'}`)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(null)
    }
  }

  const toggleBulkSelect = (tenantId: string) => {
    const newSelected = new Set(selectedTenants)
    if (newSelected.has(tenantId)) {
      newSelected.delete(tenantId)
    } else {
      newSelected.add(tenantId)
    }
    setSelectedTenants(newSelected)
  }

  const bulkEnable = async () => {
    if (selectedTenants.size === 0) return
    if (!confirm(`Enable EFRIS for ${selectedTenants.size} selected tenant(s)?`)) return

    const results = { succeeded: 0, failed: 0 }
    for (const tenantId of selectedTenants) {
      try {
        const res = await fetch(`/api/sys-control/efris/${tenantId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ efrisEnabled: true }),
        })
        if (res.ok) results.succeeded++
        else results.failed++
      } catch {
        results.failed++
      }
    }

    alert(`Bulk enable complete: ${results.succeeded} succeeded, ${results.failed} failed`)
    setSelectedTenants(new Set())
    setBulkSelecting(false)
    fetchTenants()
  }

  const bulkDisable = async () => {
    if (selectedTenants.size === 0) return
    if (!confirm(`Disable EFRIS for ${selectedTenants.size} selected tenant(s)?`)) return

    const results = { succeeded: 0, failed: 0 }
    for (const tenantId of selectedTenants) {
      try {
        const res = await fetch(`/api/sys-control/efris/${tenantId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ efrisEnabled: false }),
        })
        if (res.ok) results.succeeded++
        else results.failed++
      } catch {
        results.failed++
      }
    }

    alert(`Bulk disable complete: ${results.succeeded} succeeded, ${results.failed} failed`)
    setSelectedTenants(new Set())
    setBulkSelecting(false)
    fetchTenants()
  }

  const getStatusBadge = (status: string, isEnabled: boolean) => {
    if (!isEnabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
          <XCircle className="w-3 h-3" />
          Disabled
        </span>
      )
    }

    switch (status) {
      case 'enabled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            Enabled
          </span>
        )
      case 'configured':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            <Shield className="w-3 h-3" />
            Configured
          </span>
        )
      case 'connection_error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Connection Error
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Not Configured
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EFRIS Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configure Uganda Revenue Authority EFRIS integration for eligible tenants
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-md p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tenant name or slug..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'enabled' | 'disabled' | 'not_configured')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="not_configured">Not Configured</option>
            </select>
          </div>

          <div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            >
              <option value="UG">Uganda Only</option>
              <option value="">All Countries</option>
            </select>
          </div>

          <button
            onClick={fetchTenants}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setBulkSelecting(!bulkSelecting)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            bulkSelecting
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {bulkSelecting ? 'Cancel Selection' : 'Select Multiple'}
        </button>

        {bulkSelecting && selectedTenants.size > 0 && (
          <>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTenants.size} selected
            </span>
            <button
              onClick={bulkEnable}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
            >
              Enable Selected
            </button>
            <button
              onClick={bulkDisable}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
            >
              Disable Selected
            </button>
          </>
        )}
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No eligible tenants found
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {bulkSelecting && (
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3 w-12">
                    Select
                  </th>
                )}
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                  Tenant
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                  Country
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                  Plan
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                  TIN
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
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {bulkSelecting && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTenants.has(tenant.id)}
                        onChange={() => toggleBulkSelect(tenant.id)}
                        className="w-4 h-4"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{tenant.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 dark:text-gray-400">{tenant.country}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                      tenant.isEnterprise
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {tenant.plan === 'premium' ? 'Enterprise' : tenant.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                      {tenant.efrisTinMasked || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(tenant.efrisStatus, tenant.efrisEnabled)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(tenant)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                      >
                        Configure
                      </button>
                      {tenant.efrisConfigured && (
                        <button
                          onClick={() => testConnection(tenant.id)}
                          disabled={testing === tenant.id}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50"
                          title="Test Connection"
                        >
                          {testing === tenant.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingTenant && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingTenant(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-md p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                Configure EFRIS
              </h3>
              <button
                onClick={() => setEditingTenant(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Configure EFRIS integration for <strong>{editingTenant.name}</strong>.
              </p>
              {!editingTenant.isEnterprise && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠️ This tenant is not on the Enterprise plan. EFRIS can only be enabled for Enterprise tenants.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Enable EFRIS</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Turn on EFRIS integration for this tenant
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.efrisEnabled}
                    onChange={(e) => setEditForm({ ...editForm, efrisEnabled: e.target.checked })}
                    className="sr-only peer"
                    disabled={!editingTenant.isEnterprise}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  EFRIS TIN
                </label>
                <input
                  type="text"
                  value={editForm.efrisTin}
                  onChange={(e) => setEditForm({ ...editForm, efrisTin: e.target.value })}
                  placeholder="UG1234567890"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Format: UG followed by 10 digits
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={editForm.efrisToken}
                    onChange={(e) => setEditForm({ ...editForm, efrisToken: e.target.value })}
                    placeholder="Enter API token"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveConfig}
                disabled={saving === editingTenant.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50 font-medium"
              >
                {saving === editingTenant.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Configuration
              </button>
              <button
                onClick={() => setEditingTenant(null)}
                className="px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
