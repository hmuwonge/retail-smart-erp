'use client'

import Link from 'next/link'
import { ChevronRight, Home, ArrowLeft } from 'lucide-react'
import { useCompany } from '@/components/providers/CompanyContextProvider'
import { EfrisProductSync } from '@/components/inventory/EfrisProductSync'

export default function EfrisProductsPage() {
  const { tenantSlug } = useCompany()

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <Link href={`/c/${tenantSlug}`} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <Home size={14} />
        </Link>
        <ChevronRight size={14} />
        <Link href={`/c/${tenantSlug}/items`} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          Inventory
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 dark:text-white font-medium">EFRIS Products</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/c/${tenantSlug}/items`}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Back to Inventory"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EFRIS Product Mapping</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Sync and register products with Uganda Revenue Authority EFRIS system
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* EFRIS Product Sync Component */}
      <EfrisProductSync />
    </div>
  )
}
