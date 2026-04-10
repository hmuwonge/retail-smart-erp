'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, AlertCircle, RefreshCw, ChevronRight, Package, Users, Truck, ArrowRight } from 'lucide-react'
import { toast } from '@/components/ui/toast'

interface ConnectionStatus {
  quickbooks: { connected: boolean; companyName?: string }
  freshbooks: { connected: boolean }
  zoho: { connected: boolean }
  xero: { connected: boolean }
}

interface EntityCounts {
  [key: string]: number
}

interface MigrationStats {
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
}

interface MigrationWizardProps {
  tenantSlug: string
}

export function MigrationWizard({ tenantSlug }: MigrationWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // State
  const [step, setStep] = useState<'loading' | 'select' | 'preview' | 'migrating' | 'results'>('loading')
  const [connections, setConnections] = useState<ConnectionStatus | null>(null)
  const [counts, setCounts] = useState<EntityCounts>({})
  const [selectedEntities, setSelectedEntities] = useState<string[]>([])
  const [migrating, setMigrating] = useState(false)
  const [results, setResults] = useState<Record<string, MigrationStats> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Detect Platform
  const connectedPlatform = searchParams.get('connected') // e.g., 'quickbooks'
  const platformName = connectedPlatform === 'quickbooks' ? 'QuickBooks Online' : 
                       connectedPlatform === 'freshbooks' ? 'FreshBooks' : 
                       connectedPlatform === 'zoho' ? 'Zoho Books' : 'Unknown'
  
  const platformKey = connectedPlatform || 'quickbooks' // Default for MVP

  // 1. Fetch Connection Status & Counts on Mount
  useEffect(() => {
    const init = async () => {
      try {
        // A. Check Status
        const statusRes = await fetch('/api/migration/connection/status')
        if (!statusRes.ok) throw new Error('Failed to fetch status')
        const statusData = await statusRes.json()
        setConnections(statusData)

        // B. If connected, fetch Preview Counts
        if (connectedPlatform && statusData[connectedPlatform]?.connected) {
          setStep('select') // Move to selection step
          fetchPreview()
        } else {
          setError('Connection not found. Please reconnect.')
        }
      } catch (err: any) {
        setError(err.message)
        setStep('select') // Fallback to show error
      }
    }
    init()
  }, [connectedPlatform])

  // Fetch Data Counts from Provider
  const fetchPreview = async () => {
    try {
      // We need the connection ID. For now, we'll fetch status again to get ID or 
      // the Preview endpoint will look up the active connection for the user.
      // Let's assume Preview endpoint finds the active connection or we pass it.
      // *Correction*: The Preview API I wrote requires `connectionId` in body.
      // So I need to get the connection ID from the Status endpoint.
      // Let's update the Status endpoint response to include ID if possible, or just fetch it here.
      
      // For MVP: I'll assume the Preview API can work without ID if only one connection exists,
      // OR I need to fetch connections list.
      // Let's create a helper to get the ID.
      
      const statusRes = await fetch('/api/migration/connection/status')
      const statusData = await statusRes.json()
      // Note: My status route didn't return ID. I'll add that or fetch specifically.
      // Actually, let's just fetch the ID via a dedicated simple call or update status.
      // I'll update the status route to return ID in the next step if needed.
      // FOR NOW: I will mock the connection ID fetch or assume the user passes it.
      // Better: I'll fetch the connection details.
      
      // Let's implement a quick fetch for connection ID
      const connectionsRes = await fetch(`/api/migration/connections?platform=${platformKey}`)
      const connectionsData = await connectionsRes.json()
      const connectionId = connectionsData.id

      if (!connectionId) throw new Error('No active connection found')

      const res = await fetch('/api/migration/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      if (!res.ok) throw new Error('Failed to fetch preview')
      const data = await res.json()
      setCounts(data.counts)
      
      // Auto-select entities that have data
      const available = Object.entries(data.counts)
        .filter(([_, count]) => (count as number) > 0)
        .map(([key]) => key)
      setSelectedEntities(available)

    } catch (err: any) {
      console.error(err)
      toast.error('Could not load preview data')
    }
  }

  // Start Migration
  const handleStartMigration = async () => {
    setMigrating(true)
    setStep('migrating')
    setError(null)

    try {
      // Get Connection ID again
      const connectionsRes = await fetch(`/api/migration/connections?platform=${platformKey}`)
      const connectionsData = await connectionsRes.json()
      const connectionId = connectionsData.id

      const res = await fetch('/api/migration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, entities: selectedEntities }),
      })

      const data = await res.json()

      if (data.success) {
        setResults(data.stats)
        setStep('results')
        toast.success('Migration completed!')
      } else {
        setError(data.message)
        setStep('results') // Show partial results
      }
    } catch (err: any) {
      setError(err.message)
      setStep('select')
    } finally {
      setMigrating(false)
    }
  }

  // Render Helpers
  const EntityIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'customers': return <Users size={20} />
      case 'vendors': return <Truck size={20} />
      case 'items': return <Package size={20} />
      default: return <Package size={20} />
    }
  }

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Connecting to {platformName}...</p>
      </div>
    )
  }

  if (error && step === 'select') {
    return (
      <div className="text-center py-8 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
        <h3 className="text-lg font-bold text-red-700 dark:text-red-300">Connection Error</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        <button 
          onClick={() => router.push('/settings/migration')}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
          <CheckCircle size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connected to {platformName}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Select the data you want to import.</p>
        </div>
      </div>

      {/* Step 1: Select Entities & Preview */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">Available Data</h3>
              <button 
                onClick={fetchPreview}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            
            <div className="space-y-2">
              {Object.entries(counts).map(([key, count]) => (
                <label 
                  key={key} 
                  className={`flex items-center justify-between p-3 rounded cursor-pointer transition-colors ${
                    selectedEntities.includes(key) 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 border' 
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 border hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={selectedEntities.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEntities([...selectedEntities, key])
                        else setSelectedEntities(selectedEntities.filter(x => x !== key))
                      }}
                      disabled={(count as number) === 0}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 capitalize">
                      <EntityIcon type={key} />
                      <span>{key}</span>
                    </div>
                  </div>
                  <span className="font-mono text-sm text-gray-500">{count} records</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleStartMigration}
              disabled={selectedEntities.length === 0 || migrating}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {migrating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Start Migration
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Migrating */}
      {step === 'migrating' && (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded border">
          <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Migrating Data...</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Please do not close this tab. Importing {selectedEntities.join(', ')}...
          </p>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 'results' && results && (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded p-6 border border-green-200 dark:border-green-800 text-center">
            <CheckCircle size={48} className="mx-auto text-green-600 mb-2" />
            <h3 className="text-xl font-bold text-green-800 dark:text-green-300">Migration Completed</h3>
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              Your data has been successfully imported.
            </p>
            <button
              onClick={() => router.push(`/c/${tenantSlug}/dashboard`)}
              className="mt-4 px-6 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-sm font-medium flex items-center gap-2 mx-auto"
            >
              Go to Dashboard <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(results).map(([entity, stats]) => (
              <div key={entity} className="bg-white dark:bg-gray-800 p-4 rounded border">
                <h4 className="font-bold capitalize text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <EntityIcon type={entity} /> {entity}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Found</span>
                    <span className="font-mono">{stats.total}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>New Created</span>
                    <span className="font-mono">+{stats.created}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Updated</span>
                    <span className="font-mono">{stats.updated}</span>
                  </div>
                  <div className="flex justify-between text-yellow-600">
                    <span>Skipped (Duplicates)</span>
                    <span className="font-mono">{stats.skipped}</span>
                  </div>
                  {stats.errors > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Errors</span>
                      <span className="font-mono">{stats.errors}</span>
                    </div>
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
