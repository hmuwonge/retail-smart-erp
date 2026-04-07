import { PactV3, MatchersV3 } from '@pact-foundation/pact'
import { port } from './config'

const { like, eachLike, string, integer, boolean } = MatchersV3

/**
 * Pact provider for Retail Smart ERP API
 * Tests that the backend API matches the contracts expected by the frontend
 */
export const provider = new PactV3({
  consumer: 'RetailSmartERP-Web',
  provider: 'RetailSmartERP-API',
  port,
  log: './pact/logs/provider.log',
  dir: './pact/pacts',
  logLevel: 'warn',
})

/**
 * Contract: Get Items List
 */
export const itemsContract = {
  'a request for items list': {
    uponReceiving: 'a GET request to /api/items',
    withRequest: {
      method: 'GET',
      path: '/api/items',
      headers: {
        'Content-Type': 'application/json',
      },
      query: {
        tenantId: string('test-tenant-123'),
        page: string('1'),
        limit: string('20'),
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        success: boolean(true),
        data: eachLike({
          id: string('item-uuid-123'),
          name: string('Test Item'),
          sku: string('SKU-001'),
          categoryId: string('cat-uuid'),
          costPrice: integer(1000),
          sellingPrice: integer(1500),
          stock: integer(50),
          isActive: boolean(true),
        }),
        pagination: {
          page: integer(1),
          limit: integer(20),
          total: integer(100),
          totalPages: integer(5),
        },
      },
    },
  },
}

/**
 * Contract: Create Sale
 */
export const salesContract = {
  'a request to create a sale': {
    uponReceiving: 'a POST request to /api/sales',
    withRequest: {
      method: 'POST',
      path: '/api/sales',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        tenantId: string('test-tenant-123'),
        customerId: string('customer-uuid'),
        items: eachLike({
          itemId: string('item-uuid'),
          quantity: integer(2),
          unitPrice: integer(1500),
          discount: integer(0),
          tax: integer(150),
        }),
        payments: eachLike({
          method: string('cash'),
          amount: integer(3000),
        }),
      },
    },
    willRespondWith: {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        success: boolean(true),
        data: {
          id: string('sale-uuid-123'),
          invoiceNumber: string('INV-2024-001'),
          status: string('completed'),
          totalAmount: integer(3300),
          paidAmount: integer(3000),
          balanceAmount: integer(300),
          createdAt: string('2024-01-01T00:00:00.000Z'),
        },
      },
    },
  },
}

/**
 * Contract: Get Dashboard Stats
 */
export const dashboardContract = {
  'a request for dashboard statistics': {
    uponReceiving: 'a GET request to /api/dashboard/stats',
    withRequest: {
      method: 'GET',
      path: '/api/dashboard/stats',
      headers: {
        'Content-Type': 'application/json',
      },
      query: {
        tenantId: string('test-tenant-123'),
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        success: boolean(true),
        data: {
          todaySales: integer(15000),
          todayTransactions: integer(45),
          monthSales: integer(450000),
          totalCustomers: integer(250),
          totalItems: integer(500),
          lowStockItems: integer(12),
        },
      },
    },
  },
}

/**
 * Contract: Authenticate User
 */
export const authContract = {
  'a request to authenticate user': {
    uponReceiving: 'a POST request to /api/auth/login',
    withRequest: {
      method: 'POST',
      path: '/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        email: string('user@example.com'),
        password: string('securepassword'),
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        success: boolean(true),
        data: {
          user: {
            id: string('user-uuid'),
            email: string('user@example.com'),
            name: string('John Doe'),
            role: string('admin'),
          },
          accessToken: string('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'),
          refreshToken: string('dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...'),
        },
      },
    },
  },
}
