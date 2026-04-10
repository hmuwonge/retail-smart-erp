import { db } from '@/lib/db'
import { customers } from '@/lib/db/schema'
import { eq, and, ilike } from 'drizzle-orm'
import type { QBCustomer } from '@/lib/migration/providers/quickbooks-provider'

export interface MappedCustomer {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  tin?: string
  customerType: 'individual' | 'business'
  openingBalance?: number
}

/**
 * Maps a QuickBooks Customer to our Customer schema.
 * Handles duplicate detection and updates if existing.
 */
export async function mapAndImportQBCustomer(
  qbCustomer: QBCustomer,
  tenantId: string
): Promise<{ action: 'created' | 'updated' | 'skipped'; id: string }> {
  // 1. Transform Data
  const name = qbCustomer.DisplayName || 'Unknown Customer'
  const email = qbCustomer.PrimaryEmailAddr?.Address
  const phone = qbCustomer.PrimaryPhone?.FreeFormNumber || qbCustomer.MobilePhone?.FreeFormNumber
  const address = qbCustomer.BillAddr?.Line1
  const city = qbCustomer.BillAddr?.City
  const country = qbCustomer.BillAddr?.Country
  
  // Determine if business or individual based on name structure or lack of email
  // (Simple heuristic: if it has an email and looks like a person, individual. Else business)
  // A better way is checking QB's `CompanyName` vs `GivenName` but we just have DisplayName here.
  // For now, default to business.
  const customerType: 'individual' | 'business' = 'business' 

  const mappedData: MappedCustomer = {
    name,
    email,
    phone,
    address: [address, city].filter(Boolean).join(', '),
    country,
    customerType,
    openingBalance: qbCustomer.Balance || 0,
  }

  // 2. Check for Existing (Duplicate Detection)
  // Match by Email first, then Name
  let existingCustomer = null

  if (email) {
    existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, email)
      ),
    })
  }

  // If no email match, check name match (less precise but better than nothing)
  if (!existingCustomer) {
    existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        ilike(customers.name, name)
      ),
    })
  }

  // 3. Insert or Update
  if (existingCustomer) {
    // Update existing record with new data if it's more complete
    // (We won't overwrite non-null values with nulls)
    const updatePayload: any = {}
    if (!existingCustomer.phone && phone) updatePayload.phone = phone
    if (!existingCustomer.address && mappedData.address) updatePayload.address = mappedData.address
    if (!existingCustomer.country && country) updatePayload.country = country
    
    // Only update if there are changes
    if (Object.keys(updatePayload).length > 0) {
      await db.update(customers)
        .set({ ...updatePayload, updatedAt: new Date() })
        .where(eq(customers.id, existingCustomer.id))
      return { action: 'updated', id: existingCustomer.id }
    }
    
    return { action: 'skipped', id: existingCustomer.id }
  } else {
    // Create new
    const [newCustomer] = await db.insert(customers).values({
      tenantId,
      name,
      email: email || null,
      phone: phone || null,
      address: mappedData.address || null,
      country: country || null,
      customerType,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning()

    return { action: 'created', id: newCustomer.id }
  }
}
