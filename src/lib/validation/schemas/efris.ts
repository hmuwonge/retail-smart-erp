import { z } from 'zod'

/**
 * EFRIS TIN validation schema
 * Format: UG followed by 10 digits (e.g., UG1234567890)
 */
export const efrisTinSchema = z.string()
  .regex(/^UG\d{10}$/, 'TIN must be in format: UG followed by 10 digits')
  .or(z.string().length(0))
  .nullable()
  .optional()
