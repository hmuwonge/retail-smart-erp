'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Home, ArrowLeft, Sparkles } from 'lucide-react'
import { useCompany } from '@/components/providers/CompanyContextProvider'
import { MigrationConnectionModal } from '@/components/migration/MigrationConnectionModal'
import { MigrationWizard } from '@/components/migration/MigrationWizard'

interface Platform {
  id: string
  name: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  supported: string[]
  complexity: 'Easy' | 'Medium' | 'Advanced'
}

const PLATFORMS: Platform[] = [
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Migrate customers, items, invoices, payments, and chart of accounts directly from QuickBooks.',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: '📘',
    supported: ['Customers', 'Items', 'Invoices', 'Payments', 'Suppliers', 'Chart of Accounts'],
    complexity: 'Advanced',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Import clients, items, invoices, and expenses from your FreshBooks account.',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: '🟢',
    supported: ['Clients', 'Items', 'Invoices', 'Expenses'],
    complexity: 'Medium',
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Transfer contacts, items, invoices, bills, and chart of accounts from Zoho Books.',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: '🔵',
    supported: ['Contacts', 'Items', 'Invoices', 'Bills', 'Chart of Accounts'],
    complexity: 'Medium',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Migrate contacts, items, invoices, and accounts from Xero accounting.',
    color: 'text-blue-800 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-300 dark:border-blue-700',
    icon: '🟣',
    supported: ['Contacts', 'Items', 'Invoices', 'Accounts'],
    complexity: 'Medium',
  },
  {
    id: 'csv',
    name: 'CSV / Excel File',
    description: 'Import data from CSV or Excel files. Download our templates to get started.',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    icon: '📄',
    supported: ['All Entity Types'],
    complexity: 'Easy',
  },
]

export default function MigrationPage() {
  const { tenantSlug } = useCompany()
  const searchParams = useSearchParams()
  const connected = searchParams.get('connected')

  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [showModal, setShowModal] = useState(false)

  const handlePlatformClick = (platform: Platform) => {
    setSelectedPlatform(platform)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <Link href={`/c/${tenantSlug}`} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <Home size={14} />
        </Link>
        <ChevronRight size={14} />
        <Link href={`/c/${tenantSlug}/settings`} className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          Settings
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 dark:text-white font-medium">Switch / Migrate</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {connected && (
              <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded">
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {connected ? 'Migration Wizard' : 'Switch to Our Platform'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {connected
                  ? `Connected! Let's get your data from ${connected === 'quickbooks' ? 'QuickBooks' : connected}.`
                  : 'Migrate your data from another accounting or ERP system. We handle the heavy lifting.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conditionally Render Wizard or Platform Cards */}
      {connected ? (
        <MigrationWizard tenantSlug={tenantSlug} />
      ) : (
        <>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <Sparkles size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-300">Seamless Migration</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              Connect your existing accounting software and we'll automatically fetch and map your data. 
              No manual exports, no CSV uploads — just authenticate and migrate.
            </p>
          </div>
        </div>
      </div>

      {/* Platform Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Choose Your Current Platform</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handlePlatformClick(platform)}
              className={`text-left p-5 rounded-lg border-2 ${platform.borderColor} ${platform.bgColor} hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{platform.icon}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${platform.bgColor} ${platform.color} border ${platform.borderColor}`}>
                  {platform.complexity}
                </span>
              </div>

              {/* Name */}
              <h3 className={`text-lg font-bold ${platform.color} mb-2 group-hover:underline`}>
                {platform.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {platform.description}
              </p>

              {/* Supported Data */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Supported Data
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {platform.supported.slice(0, 4).map((item) => (
                    <span
                      key={item}
                      className="text-xs px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300"
                    >
                      {item}
                    </span>
                  ))}
                  {platform.supported.length > 4 && (
                    <span className="text-xs px-2 py-0.5 text-gray-500 dark:text-gray-400">
                      +{platform.supported.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* CTA */}
              <div className={`mt-4 pt-3 border-t ${platform.borderColor} flex items-center justify-between`}>
                <span className={`text-sm font-medium ${platform.color}`}>
                  Start Migration
                </span>
                <ChevronRight size={16} className={`${platform.color} group-hover:translate-x-1 transition-transform`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2 font-bold">
              1
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Choose Platform</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select the software you're migrating from</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2 font-bold">
              2
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Connect Account</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Securely authenticate with your existing provider</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2 font-bold">
              3
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Select Data</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose what to migrate (customers, items, etc.)</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-2 font-bold">
              4
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Migrate</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Watch your data import in real-time</p>
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      {selectedPlatform && (
        <MigrationConnectionModal
          platform={selectedPlatform}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          tenantSlug={tenantSlug}
        />
      )}
        </>
      )}
    </div>
  )
}
