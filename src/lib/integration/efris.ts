import { db } from '@/lib/db'
import { tenants, items, sales, saleItems } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logToFile } from '@/lib/logging/file-logger'

/**
 * EFRIS Integration Module for WEAF API
 * Documentation: https://weafefrisapi.space
 */

export const EFRIS_CONFIG = {
    testBaseUrl: process.env.EFRIS_TEST_BASE_URL || 'https://test-api.weafefrisapi.space',
    productionBaseUrl: process.env.EFRIS_PRODUCTION_BASE_URL || 'https://api.weafefrisapi.space',
    isProduction: process.env.EFRIS_ENVIRONMENT === 'production',
}

export function getEfrisBaseUrl() {
    return EFRIS_CONFIG.isProduction ? EFRIS_CONFIG.productionBaseUrl : EFRIS_CONFIG.testBaseUrl
}

export interface EfrisAuthResponse {
    status: {
        returnCode: string
        returnMessage: string
    }
    data: {
        token: string
        token_name: string
        expires_at: string
        expires_in_days: number
        user: {
            id: number
            name: string
            email: string
        }
        companies: Array<{
            id: number
            business_name: string
            tin: string
            environment: 'production' | 'test'
        }>
    }
}

export interface EfrisInvoiceRequest {
    sellerDetails: {
        placeOfBusiness: string
        referenceNo: string
        issuedDate: string // DD/MM/YYYY HH:mm:ss
        branchId?: string
    }
    basicInformation: {
        operator: string
        currency: string
        invoiceType: number // 1: Invoice, 2: Receipt
        invoiceKind: number // 1: Sales, 2: Purchase
        paymentMode: string // 101: Cash, 102: Card, etc.
        invoiceIndustryCode: string // 101: General
        isPreview?: string // '0' or '1'
        isRefund?: string // '0' or '1'
    }
    buyerDetails: {
        buyerTin?: string
        buyerBusinessName: string
        buyerLegalName?: string
        buyerType: string // 0: Business, 1: Individual
        buyerAddress?: string
        buyerEmail?: string
        buyerLinePhone?: string
        buyerMobilePhone?: string
        buyerNinBrn?: string
        buyerPassportNum?: string
    }
    itemsBought: Array<{
        itemCode: string
        quantity: number
        unitPrice: number
        total: number
        taxForm: string // '101'
        taxRule: string // 'STANDARD'
        netAmount: number
        discountFlag: number // 1: Yes, 2: No
        deemedFlag: number // 1: Yes, 2: No
        discountTotal: string
        exciseFlag: string // '1': Yes, '2': No
        exciseRate?: string
        exciseUnit?: string
        exciseTax?: string
        exciseCurrency?: string
    }>
}

export interface EfrisInvoiceResponse {
    status: {
        returnCode: string
        returnMessage: string
    }
    data: {
        basicInformation: {
            antifakeCode: string
            invoiceNo: string
            issuedDate: string
            operator: string
        }
        summary: {
            qrCode: string
            grossAmount: string
            netAmount: string
            taxAmount: string
        }
        sellerDetails: {
            businessName: string
            tin: string
            address: string
        }
        buyerDetails: {
            buyerBusinessName: string
            buyerTin: string
            buyerAddress: string
        }
        goodsDetails: Array<{
            item: string
            itemCode: string
            qty: string
            unitPrice: string
            total: string
            tax: string
        }>
    }
}

/**
 * EFRIS API Client
 */
export class EfrisClient {
    private baseUrl: string
    private token: string
    private tin: string

    constructor(token: string, tin: string) {
        this.baseUrl = getEfrisBaseUrl()
        this.token = token
        this.tin = tin
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint.replace('{{tin}}', this.tin)}`

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            ...options.headers,
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                const errorMessage = errorData?.status?.returnMessage || `EFRIS API error: ${response.statusText}`
                
                logToFile('ERROR', 'EFRIS_API', `Failure on endpoint: ${endpoint}`, {
                    status: response.status,
                    tin: this.tin,
                    error: errorMessage
                })
                
                throw new Error(errorMessage)
            }

            return response.json()
        } catch (error: any) {
            logToFile('ERROR', 'EFRIS_API', `Request Exception: ${endpoint}`, { message: error.message })
            throw error
        }
    }

    /**
     * Sync products from EFRIS
     */
    async syncProducts(params: { goodsCode?: string; goodsName?: string; pageSize?: string; pageNo?: string } = {}) {
        return this.request('/api/{{tin}}/sync-products', {
            method: 'POST',
            body: JSON.stringify(params),
        })
    }

    /**
     * Register a product with EFRIS
     */
    async registerProduct(products: any[]) {
        return this.request('/api/{{tin}}/register-product', {
            method: 'POST',
            body: JSON.stringify({ products }),
        })
    }

    /**
     * Generate a fiscal invoice
     */
    async generateInvoice(data: EfrisInvoiceRequest): Promise<EfrisInvoiceResponse> {
        return this.request('/api/{{tin}}/generate-fiscal-invoice', {
            method: 'POST',
            body: JSON.stringify({ data }),
        })
    }

    /**
     * Generate a fiscal receipt
     */
    async generateReceipt(data: EfrisInvoiceRequest): Promise<EfrisInvoiceResponse> {
        return this.request('/api/{{tin}}/generate-fiscal-receipt', {
            method: 'POST',
            body: JSON.stringify({ data }),
        })
    }

    /**
     * Increase stock
     */
    async increaseStock(params: {
        remarks?: string
        stockInDate: string
        stockInType: string
        stockInItem: any[]
        supplierName?: string
        supplierTin?: string
    }) {
        return this.request('/api/{{tin}}/increase-stock', {
            method: 'POST',
            body: JSON.stringify(params),
        })
    }

    /**
     * Decrease stock
     */
    async decreaseStock(params: {
        remarks?: string
        stockInItem: any[]
        adjustType: string
    }) {
        return this.request('/api/{{tin}}/decrease-stock', {
            method: 'POST',
            body: JSON.stringify(params),
        })
    }

    /**
     * Apply for credit note
     */
    async applyCreditNote(params: {
        oriInvoiceNo: string
        reasonCode: string
        reason: string
        invoiceApplyCategoryCode: string
        remarks?: string
        sellersReferenceNo?: string
    }) {
        return this.request('/api/{{tin}}/apply-for-creditnote', {
            method: 'POST',
            body: JSON.stringify({ generalInfo: params }),
        })
    }
}

/**
 * Initialize EFRIS client for a tenant
 */
export async function getEfrisClient(tenantId: string): Promise<EfrisClient | null> {
    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
    })

    if (!tenant || !tenant.efrisEnabled || !tenant.efrisTin || !tenant.efrisToken) {
        return null
    }

    return new EfrisClient(tenant.efrisToken, tenant.efrisTin)
}
