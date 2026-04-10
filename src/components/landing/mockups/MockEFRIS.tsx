'use client'

import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Clock, FileText, ArrowUpRight, Shield } from 'lucide-react'

interface EfrisInvoice {
  id: string
  customer: string
  amount: string
  status: 'submitted' | 'pending' | 'failed'
  time: string
  efdSerial: string
  fiscalCode: string
}

interface StatCard {
  label: string
  value: string
  color: string
  bgColor: string
  icon: React.ReactNode
}

const stats: StatCard[] = [
  {
    label: 'Today\'s Invoices',
    value: '247',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  {
    label: 'Successfully Submitted',
    value: '242',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  {
    label: 'Pending',
    value: '3',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  {
    label: 'Failed',
    value: '2',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
]

const invoices: EfrisInvoice[] = [
  {
    id: 'INV-2026-0847',
    customer: 'Kampala Retail Store Ltd',
    amount: 'Ush 2,450,000',
    status: 'submitted',
    time: '2 min ago',
    efdSerial: 'EFD-98234',
    fiscalCode: 'FC-847291038472',
  },
  {
    id: 'INV-2026-0846',
    customer: 'Nakumatt Supermarket',
    amount: 'Ush 8,750,000',
    status: 'submitted',
    time: '8 min ago',
    efdSerial: 'EFD-98233',
    fiscalCode: 'FC-847291038471',
  },
  {
    id: 'INV-2026-0845',
    customer: 'John Mukasa',
    amount: 'Ush 385,000',
    status: 'submitted',
    time: '15 min ago',
    efdSerial: 'EFD-98232',
    fiscalCode: 'FC-847291038470',
  },
  {
    id: 'INV-2026-0844',
    customer: 'Acme Distributors (Pty)',
    amount: 'Ush 12,300,000',
    status: 'pending',
    time: '22 min ago',
    efdSerial: 'EFD-98231',
    fiscalCode: 'Pending...',
  },
  {
    id: 'INV-2026-0843',
    customer: 'Sarah Namugga',
    amount: 'Ush 567,000',
    status: 'submitted',
    time: '31 min ago',
    efdSerial: 'EFD-98230',
    fiscalCode: 'FC-847291038468',
  },
  {
    id: 'INV-2026-0842',
    customer: 'Quality Pharmaceuticals',
    amount: 'Ush 4,890,000',
    status: 'failed',
    time: '38 min ago',
    efdSerial: 'EFD-98229',
    fiscalCode: 'Error: Invalid TIN',
  },
]

function StatusBadge({ status }: { status: EfrisInvoice['status'] }) {
  const config = {
    submitted: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      label: 'Submitted',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    pending: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Pending',
      icon: <Clock className="w-3 h-3" />,
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Failed',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  }

  const { bg, text, label, icon } = config[status]

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold text-[9px] ${bg} ${text}`}>
      {icon}
      {label}
    </span>
  )
}

export function MockEFRIS() {
  return (
    <div className="bg-gray-50 p-3 min-h-[300px] text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-2.5 py-1 rounded-md">
            <Shield className="w-3 h-3" />
            <span className="font-bold text-[11px]">URA EFRIS</span>
          </div>
          <span className="text-gray-500 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-medium">
            Connected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-white text-emerald-600 px-2 py-1.5 rounded-md border border-gray-200 font-medium flex items-center gap-1 text-[10px]">
            <ArrowUpRight className="w-3 h-3" />
            Submit All Pending
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-2.5">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="bg-white rounded border border-gray-200 px-2.5 py-2 shadow-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 font-medium text-[9px]">{stat.label}</span>
              <div className={`${stat.bgColor} ${stat.color} p-1 rounded`}>
                {stat.icon}
              </div>
            </div>
            <div className={`font-bold text-[14px] leading-tight ${stat.color}`}>
              {stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[1.3fr_1.8fr_1.2fr_1fr_1.2fr_1.5fr] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-gray-500 uppercase tracking-wider text-[9px]">
          <div>Invoice No</div>
          <div>Customer</div>
          <div>Amount</div>
          <div>Status</div>
          <div>EFD Serial</div>
          <div>Fiscal Code</div>
        </div>

        {/* Table rows */}
        {invoices.map((inv, i) => (
          <motion.div
            key={inv.id}
            className="grid grid-cols-[1.3fr_1.8fr_1.2fr_1fr_1.2fr_1.5fr] gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50/60 items-center"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
          >
            <div className="font-mono text-gray-900 text-[10px] font-medium">{inv.id}</div>
            <div className="text-gray-700 truncate text-[10px]">{inv.customer}</div>
            <div className="font-semibold text-gray-800 text-[10px]">{inv.amount}</div>
            <div>
              <StatusBadge status={inv.status} />
            </div>
            <div className="font-mono text-gray-500 text-[10px]">{inv.efdSerial}</div>
            <div className={`font-mono text-[10px] ${inv.status === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
              {inv.fiscalCode}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
