'use client'

import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight, Database, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import Image from 'next/image'

interface MigrationStep {
  step: number
  title: string
  status: 'completed' | 'in-progress' | 'pending'
  details: string
}

interface MigratedItem {
  entity: string
  source: string
  count: string
  status: 'migrated' | 'migrating' | 'pending' | 'error'
  errors?: number
}

const steps: MigrationStep[] = [
  { step: 1, title: 'Select Source', status: 'completed', details: 'QuickBooks Online' },
  { step: 2, title: 'Connect & Authenticate', status: 'completed', details: 'Connected as admin@mycompany.com' },
  { step: 3, title: 'Map Data Fields', status: 'completed', details: '12 fields mapped' },
  { step: 4, title: 'Import Data', status: 'in-progress', details: 'Importing...' },
  { step: 5, title: 'Validate & Review', status: 'pending', details: 'Not started' },
]

const entities: MigratedItem[] = [
  { entity: 'Customers', source: 'QuickBooks', count: '1,247', status: 'migrated' },
  { entity: 'Products/Services', source: 'QuickBooks', count: '856', status: 'migrated' },
  { entity: 'Invoices', source: 'QuickBooks', count: '3,421', status: 'migrating' },
  { entity: 'Vendors', source: 'QuickBooks', count: '189', status: 'migrated' },
  { entity: 'Chart of Accounts', source: 'QuickBooks', count: '47', status: 'migrated' },
  { entity: 'Purchase Orders', source: 'QuickBooks', count: '523', status: 'pending' },
  { entity: 'Employees', source: 'QuickBooks', count: '64', status: 'error' },
]

function StepIndicator({ step, isLast }: { step: MigrationStep; isLast: boolean }) {
  const statusConfig = {
    completed: { circle: 'bg-emerald-500', text: 'text-emerald-600', icon: <CheckCircle className="w-3 h-3 text-white" /> },
    'in-progress': { circle: 'bg-blue-500 animate-pulse', text: 'text-blue-600', icon: <ArrowRight className="w-3 h-3 text-white" /> },
    pending: { circle: 'bg-gray-300', text: 'text-gray-400', icon: <span className="text-white text-[8px] font-bold">{step.step}</span> },
  }

  const { circle, text, icon } = statusConfig[step.status]

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full ${circle} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[9px] font-semibold ${text} truncate`}>{step.title}</div>
        <div className="text-gray-400 text-[8px] truncate">{step.details}</div>
      </div>
      {!isLast && <div className="w-4 h-px bg-gray-200 flex-shrink-0" />}
    </div>
  )
}

function EntityRow({ entity }: { entity: MigratedItem }) {
  const statusConfig = {
    migrated: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Migrated', icon: <CheckCircle className="w-3 h-3" /> },
    migrating: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Migrating...', icon: <Upload className="w-3 h-3" /> },
    pending: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Pending', icon: null },
    error: { bg: 'bg-red-100', text: 'text-red-700', label: '2 errors', icon: <AlertCircle className="w-3 h-3" /> },
  }

  const { bg, text, label, icon } = statusConfig[entity.status]

  return (
    <motion.div
      className="grid grid-cols-[2fr_1fr_0.8fr_1.2fr] gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50/60 items-center"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + entity.step * 0.06, duration: 0.35 }}
    >
      <div className="font-medium text-gray-900 text-[10px]">{entity.entity}</div>
      <div className="text-gray-500 text-[10px]">{entity.source}</div>
      <div className="font-semibold text-gray-800 text-[10px]">{entity.count}</div>
      <div>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold text-[9px] ${bg} ${text}`}>
          {icon}
          {label}
        </span>
      </div>
    </motion.div>
  )
}

export function MockMigration() {
  const totalProgress = 72

  return (
    <div className="bg-gray-50 p-3 min-h-[300px] text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-sky-600 text-white px-2.5 py-1 rounded-md">
            <Database className="w-3 h-3" />
            <span className="font-bold text-[11px]">Data Migration</span>
          </div>
          <span className="text-gray-500 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-medium">
            Wizard
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-white text-gray-600 px-2 py-1.5 rounded-md border border-gray-200 font-medium flex items-center gap-1 text-[10px]">
            <FileSpreadsheet className="w-3 h-3" />
            Import CSV/Excel
          </div>
        </div>
      </div>

      {/* Migration Wizard Steps */}
      <div className="bg-white rounded border border-gray-200 p-3 mb-2.5 shadow-sm">
        <div className="text-[11px] font-bold text-gray-900 mb-2">Migration Progress</div>
        <div className="flex items-center gap-1 mb-2">
          {steps.map((step, i) => (
            <StepIndicator key={step.step} step={step} isLast={i === steps.length - 1} />
          ))}
        </div>
        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <div className="text-gray-500 text-[9px] mt-1 text-right">{totalProgress}% complete</div>
      </div>

      {/* Source Platform */}
      <div className="bg-white rounded border border-gray-200 p-2.5 mb-2.5 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-md p-1 border border-gray-200 flex items-center justify-center flex-shrink-0">
          <Image src="/logos/quickbooks.png" alt="QuickBooks" width={32} height={32} className="object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-gray-900">QuickBooks Online</div>
          <div className="text-gray-500 text-[9px] truncate">Connected • 6 of 7 entities processed</div>
        </div>
        <div className="text-emerald-600 text-[10px] font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Authenticated
        </div>
      </div>

      {/* Entity Migration Table */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_0.8fr_1.2fr] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-gray-500 uppercase tracking-wider text-[9px]">
          <div>Entity</div>
          <div>Source</div>
          <div>Count</div>
          <div>Status</div>
        </div>

        {/* Table rows */}
        {entities.map((entity, i) => (
          <EntityRow key={entity.entity} entity={entity} />
        ))}
      </div>
    </div>
  )
}
