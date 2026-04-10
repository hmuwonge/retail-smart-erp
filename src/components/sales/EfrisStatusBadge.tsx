'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/toast'

interface EfrisStatusBadgeProps {
  saleId: string
  efrisStatus: string | null
  efrisInvoiceNo?: string | null
  efrisAntifakeCode?: string | null
  efrisQrCode?: string | null
  efrisError?: string | null
  onResubmitSuccess?: () => void
}

export function EfrisStatusBadge({
  saleId,
  efrisStatus,
  efrisInvoiceNo,
  efrisAntifakeCode,
  efrisQrCode,
  efrisError,
  onResubmitSuccess,
}: EfrisStatusBadgeProps) {
  const [resubmitting, setResubmitting] = useState(false)

  const handleResubmit = async () => {
    if (!confirm('Resubmit this sale to EFRIS?')) return

    setResubmitting(true)
    try {
      const res = await fetch(`/api/sales/${saleId}/efris/resubmit`, {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        toast.success('Sale submitted to EFRIS successfully')
        onResubmitSuccess?.()
      } else {
        toast.error(data.error || 'Failed to resubmit to EFRIS')
      }
    } catch (error) {
      console.error('Failed to resubmit:', error)
      toast.error('Failed to resubmit to EFRIS')
    } finally {
      setResubmitting(false)
    }
  }

  // Not submitted yet
  if (!efrisStatus || efrisStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
        <AlertCircle className="w-3 h-3" />
        Pending
      </span>
    )
  }

  // Successfully submitted
  if (efrisStatus === 'success') {
    return (
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
          <CheckCircle className="w-3 h-3" />
          EFRIS Submitted
        </span>
        {efrisInvoiceNo && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <p><span className="font-medium">Invoice:</span> <span className="font-mono">{efrisInvoiceNo}</span></p>
            {efrisAntifakeCode && (
              <p><span className="font-medium">Anti-fake:</span> <span className="font-mono text-[10px] break-all">{efrisAntifakeCode}</span></p>
            )}
          </div>
        )}
        {efrisQrCode && (
          <div className="mt-2 p-2 bg-white rounded border">
            <p className="text-[10px] text-gray-400 mb-1">QR Code Data:</p>
            <p className="font-mono text-[8px] break-all text-gray-600">{efrisQrCode}</p>
          </div>
        )}
      </div>
    )
  }

  // Failed submission
  if (efrisStatus === 'failed') {
    return (
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          <XCircle className="w-3 h-3" />
          EFRIS Failed
        </span>
        {efrisError && (
          <p className="text-xs text-red-600 dark:text-red-400" title={efrisError}>
            {efrisError.length > 50 ? `${efrisError.slice(0, 50)}...` : efrisError}
          </p>
        )}
        <button
          onClick={handleResubmit}
          disabled={resubmitting}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resubmitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Resubmit
        </button>
      </div>
    )
  }

  return null
}
