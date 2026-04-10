/**
 * EFRIS Integration Unit Tests
 * 
 * Tests for:
 * - EfrisClient class
 * - efris-mapper helper
 * - efris-invoice-builder helper
 * - efris-guards helpers
 * - efris-errors message mapper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import modules after mocking
import { EfrisClient, EFRIS_CONFIG } from '@/lib/integration/efris'
import { mapItemToEfrisProduct, matchEfrisProductToLocal, validateItemForEfris, getEfrisMappingStatus } from '@/lib/integration/efris-mapper'
import { buildInvoicePayload, buildCreditNotePayload, validateSaleForEfris } from '@/lib/integration/efris-invoice-builder'
import { mapEfrisErrorToUserMessage, isEfrisErrorRetryable } from '@/lib/integration/efris-errors'

// ==========================================
// EfrisClient Tests
// ==========================================

describe('EfrisClient', () => {
  const client = new EfrisClient('test-token', 'UG1234567890')

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should use test base URL by default', () => {
    expect(EFRIS_CONFIG.isProduction).toBe(false)
    expect(EFRIS_CONFIG.testBaseUrl).toBe('https://test-api.weafefrisapi.space')
  })

  it('should use production URL when env is production', () => {
    const originalEnv = process.env.EFRIS_ENVIRONMENT
    process.env.EFRIS_ENVIRONMENT = 'production'
    
    // Need to re-import to get updated config
    const { getEfrisBaseUrl } = require('@/lib/integration/efris')
    expect(getEfrisBaseUrl()).toBe('https://api.weafefrisapi.space')
    
    process.env.EFRIS_ENVIRONMENT = originalEnv
  })

  it('should make authenticated requests with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: { returnCode: '000', returnMessage: 'Success' }, data: {} }),
    })

    await client.syncProducts({ pageSize: '10' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('test-api.weafefrisapi.space'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('should throw error on failed request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ status: { returnCode: '400', returnMessage: 'Invalid request' } }),
    })

    await expect(client.syncProducts()).rejects.toThrow('Invalid request')
  })

  it('should register products with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: { returnCode: '000' }, data: { goodsCode: 'EFRIS001' } }),
    })

    const products = [{
      goodsName: 'Test Product',
      goodsType: '1',
      unit: 'PCS',
      unitPrice: 100,
      taxForm: '101',
      taxRule: 'STANDARD',
    }]

    const response = await client.registerProduct(products)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('register-product'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ products }),
      })
    )
    expect(response.data.goodsCode).toBe('EFRIS001')
  })
})

// ==========================================
// EFRIS Mapper Tests
// ==========================================

describe('efris-mapper', () => {
  const mockItem = {
    id: 'item-1',
    tenantId: 'tenant-1',
    name: 'Test Item',
    sku: 'SKU001',
    sellingPrice: '100.00',
    costPrice: '50.00',
    unit: 'pcs',
    trackStock: true,
    efrisItemCode: null,
    efrisTaxForm: null,
    efrisTaxRule: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('mapItemToEfrisProduct', () => {
    it('should map item with defaults', () => {
      const result = mapItemToEfrisProduct(mockItem as any, 'UGX')

      expect(result).toEqual({
        goodsCode: undefined,
        goodsName: 'Test Item',
        goodsType: '1',
        unit: 'PCS',
        unitPrice: 100,
        taxForm: '101',
        taxRule: 'STANDARD',
        currency: 'UGX',
        hasExemption: '2',
        hasZeroRate: '2',
      })
    })

    it('should map item with existing EFRIS codes', () => {
      const itemWithCodes = { ...mockItem, efrisItemCode: 'EFRIS123', efrisTaxForm: '102', efrisTaxRule: 'REDUCED' }
      const result = mapItemToEfrisProduct(itemWithCodes as any)

      expect(result.goodsCode).toBe('EFRIS123')
      expect(result.taxForm).toBe('102')
      expect(result.taxRule).toBe('REDUCED')
    })

    it('should map different units correctly', () => {
      const kgItem = { ...mockItem, unit: 'kg' }
      expect(mapItemToEfrisProduct(kgItem as any).unit).toBe('KG')

      const literItem = { ...mockItem, unit: 'l' }
      expect(mapItemToEfrisProduct(literItem as any).unit).toBe('L')
    })

    it('should detect services (trackStock=false)', () => {
      const serviceItem = { ...mockItem, trackStock: false }
      const result = mapItemToEfrisProduct(serviceItem as any)
      expect(result.goodsType).toBe('2')
    })
  })

  describe('matchEfrisProductToLocal', () => {
    const localItems = [
      { ...mockItem, name: 'Widget A', sku: 'WGT-001' },
      { ...mockItem, name: 'Widget B', sku: 'WGT-002' },
    ]

    it('should match by exact name', () => {
      const efrisProduct = { goodsCode: 'EFR001', goodsName: 'Widget A', goodsType: '1', unit: 'PCS', unitPrice: '100', taxForm: '101', taxRule: 'STANDARD' }
      const result = matchEfrisProductToLocal(efrisProduct, localItems as any)
      expect(result?.name).toBe('Widget A')
    })

    it('should match by SKU', () => {
      const efrisProduct = { goodsCode: 'WGT-002', goodsName: 'Unknown', goodsType: '1', unit: 'PCS', unitPrice: '100', taxForm: '101', taxRule: 'STANDARD' }
      const result = matchEfrisProductToLocal(efrisProduct, localItems as any)
      expect(result?.sku).toBe('WGT-002')
    })

    it('should match by partial name', () => {
      const efrisProduct = { goodsCode: 'EFR003', goodsName: 'Widget', goodsType: '1', unit: 'PCS', unitPrice: '100', taxForm: '101', taxRule: 'STANDARD' }
      const result = matchEfrisProductToLocal(efrisProduct, localItems as any)
      expect(result?.name).toBe('Widget A')
    })

    it('should return null if no match', () => {
      const efrisProduct = { goodsCode: 'EFR004', goodsName: 'Unknown Item', goodsType: '1', unit: 'PCS', unitPrice: '100', taxForm: '101', taxRule: 'STANDARD' }
      const result = matchEfrisProductToLocal(efrisProduct, localItems as any)
      expect(result).toBeNull()
    })
  })

  describe('validateItemForEfris', () => {
    it('should validate valid item', () => {
      const result = validateItemForEfris(mockItem as any)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject item without name', () => {
      const invalidItem = { ...mockItem, name: '' }
      const result = validateItemForEfris(invalidItem as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('name')
    })

    it('should reject item without price', () => {
      const invalidItem = { ...mockItem, sellingPrice: '0' }
      const result = validateItemForEfris(invalidItem as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('price')
    })

    it('should reject item already mapped', () => {
      const mappedItem = { ...mockItem, efrisItemCode: 'EFRIS001' }
      const result = validateItemForEfris(mappedItem as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('already')
    })
  })

  describe('getEfrisMappingStatus', () => {
    it('should return mapped status', () => {
      const mappedItem = { ...mockItem, efrisItemCode: 'EFR001' }
      const result = getEfrisMappingStatus(mappedItem as any)
      expect(result.status).toBe('mapped')
      expect(result.code).toBe('EFR001')
    })

    it('should return pending status', () => {
      const result = getEfrisMappingStatus(mockItem as any)
      expect(result.status).toBe('pending')
    })
  })
})

// ==========================================
// EFRIS Invoice Builder Tests
// ==========================================

describe('efris-invoice-builder', () => {
  const mockTenant = {
    id: 'tenant-1',
    name: 'Test Company',
    address: '123 Test St',
    currency: 'UGX',
    efrisEnabled: true,
    efrisTin: 'UG1234567890',
    efrisToken: 'token',
  }

  const mockCustomer = {
    id: 'customer-1',
    tenantId: 'tenant-1',
    name: 'Test Customer',
    tin: 'CUST123',
  }

  const mockSale = {
    id: 'sale-1',
    tenantId: 'tenant-1',
    saleNo: 'INV-001',
    status: 'completed',
    total: '1180.00',
    paymentMethod: 'cash',
    isReturn: false,
    createdAt: new Date('2024-01-15T10:30:00Z'),
  }

  const mockSaleItems = [
    {
      id: 'item-1',
      saleId: 'sale-1',
      itemId: 'prod-1',
      name: 'Product A',
      quantity: '2',
      unitPrice: '500.00',
      lineTotal: '1000.00',
      discount: '0',
      efrisItemCode: 'EFR001',
      efrisTaxForm: '101',
      efrisTaxRule: 'STANDARD',
    },
  ]

  describe('buildInvoicePayload', () => {
    it('should build B2B invoice for customer with TIN', () => {
      const payload = buildInvoicePayload(mockSale as any, mockSaleItems as any, mockTenant as any, mockCustomer as any)

      expect(payload.basicInformation.invoiceType).toBe(1) // B2B
      expect(payload.buyerDetails.buyerTin).toBe('CUST123')
      expect(payload.buyerDetails.buyerType).toBe('0') // Business
    })

    it('should build receipt for walk-in customer', () => {
      const payload = buildInvoicePayload(mockSale as any, mockSaleItems as any, mockTenant as any, null)

      expect(payload.basicInformation.invoiceType).toBe(2) // Receipt
      expect(payload.buyerDetails.buyerBusinessName).toBe('Walk-in Customer')
    })

    it('should map payment method correctly', () => {
      const saleWithCard = { ...mockSale, paymentMethod: 'card' }
      const payload = buildInvoicePayload(saleWithCard as any, mockSaleItems as any, mockTenant as any, null)
      expect(payload.basicInformation.paymentMode).toBe('102')
    })

    it('should calculate item totals correctly', () => {
      const payload = buildInvoicePayload(mockSale as any, mockSaleItems as any, mockTenant as any, null)
      
      expect(payload.itemsBought).toHaveLength(1)
      expect(payload.itemsBought[0].itemCode).toBe('EFR001')
      expect(payload.itemsBought[0].quantity).toBe(2)
      expect(payload.itemsBought[0].unitPrice).toBe(500)
      expect(payload.itemsBought[0].total).toBe(1000)
    })
  })

  describe('buildCreditNotePayload', () => {
    it('should build credit note with original invoice reference', () => {
      const returnSale = { ...mockSale, isReturn: true, returnAgainst: 'sale-0', notes: 'Customer return' }
      const payload = buildCreditNotePayload(returnSale as any, 'EFRIS-INV-001')

      expect(payload.oriInvoiceNo).toBe('EFRIS-INV-001')
      expect(payload.reasonCode).toBe('1') // Return
      expect(payload.reason).toBe('Customer return')
    })
  })

  describe('validateSaleForEfris', () => {
    it('should validate complete sale', () => {
      const result = validateSaleForEfris(mockSale as any, mockSaleItems as any, mockTenant as any)
      expect(result.isValid).toBe(true)
    })

    it('should reject if EFRIS not enabled', () => {
      const tenantWithoutEfris = { ...mockTenant, efrisEnabled: false }
      const result = validateSaleForEfris(mockSale as any, mockSaleItems as any, tenantWithoutEfris as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('not enabled')
    })

    it('should reject if already submitted', () => {
      const submittedSale = { ...mockSale, efrisStatus: 'success' }
      const result = validateSaleForEfris(submittedSale as any, mockSaleItems as any, mockTenant as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('already submitted')
    })

    it('should reject if items missing EFRIS codes', () => {
      const itemsWithoutCodes = mockSaleItems.map(item => ({ ...item, efrisItemCode: null }))
      const result = validateSaleForEfris(mockSale as any, itemsWithoutCodes as any, mockTenant as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('without EFRIS codes')
    })
  })
})

// ==========================================
// EFRIS Error Mapper Tests
// ==========================================

describe('efris-errors', () => {
  describe('mapEfrisErrorToUserMessage', () => {
    it('should map known error codes', () => {
      expect(mapEfrisErrorToUserMessage('INVALID_TOKEN')).toContain('token')
      expect(mapEfrisErrorToUserMessage('ITEM_NOT_FOUND')).toContain('register')
      expect(mapEfrisErrorToUserMessage('DUPLICATE_INVOICE')).toContain('already been submitted')
    })

    it('should match partial errors', () => {
      expect(mapEfrisErrorToUserMessage('Error: INVALID_TOKEN - expired')).toContain('token')
      expect(mapEfrisErrorToUserMessage('TIMEOUT: request took too long')).toContain('unreachable')
    })

    it('should return fallback for unknown errors', () => {
      const custom = 'Custom fallback'
      expect(mapEfrisErrorToUserMessage('UNKNOWN_ERROR', custom)).toBe(custom)
    })
  })

  describe('isEfrisErrorRetryable', () => {
    it('should identify retryable errors', () => {
      expect(isEfrisErrorRetryable('NETWORK_ERROR')).toBe(true)
      expect(isEfrisErrorRetryable('TIMEOUT: request timed out')).toBe(true)
      expect(isEfrisErrorRetryable('SERVICE_UNAVAILABLE')).toBe(true)
    })

    it('should identify non-retryable errors', () => {
      expect(isEfrisErrorRetryable('INVALID_TOKEN')).toBe(false)
      expect(isEfrisErrorRetryable('ITEM_NOT_FOUND')).toBe(false)
      expect(isEfrisErrorRetryable('DUPLICATE_INVOICE')).toBe(false)
    })
  })
})
