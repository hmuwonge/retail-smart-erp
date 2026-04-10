/**
 * EFRIS Error Message Mapper
 * 
 * Maps EFRIS API error codes to user-friendly messages
 */

export const EFRIS_ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'INVALID_TOKEN': 'EFRIS token expired or invalid. Contact your system administrator.',
  'TOKEN_EXPIRED': 'EFRIS token expired or invalid. Contact your system administrator.',
  'UNAUTHORIZED': 'EFRIS authentication failed. Check your API token configuration.',
  
  // TIN errors
  'INVALID_TIN': 'EFRIS TIN not found. Please verify the TIN with your system administrator.',
  'TIN_NOT_FOUND': 'EFRIS TIN not found. Please verify the TIN with your system administrator.',
  
  // Product errors
  'ITEM_NOT_FOUND': 'One or more items are not registered with EFRIS. Please register them in Inventory.',
  'PRODUCT_NOT_FOUND': 'One or more items are not registered with EFRIS. Please register them in Inventory.',
  'DUPLICATE_PRODUCT': 'This product is already registered with EFRIS.',
  
  // Invoice errors
  'DUPLICATE_INVOICE': 'This invoice has already been submitted to EFRIS. No action needed.',
  'INVALID_INVOICE': 'Invalid invoice data. Please check the sale details and try again.',
  'MISSING_REQUIRED_FIELD': 'Missing required field for EFRIS submission. Please check company settings.',
  
  // Network errors
  'NETWORK_ERROR': 'EFRIS service is currently unreachable. The submission will be retried automatically.',
  'TIMEOUT': 'EFRIS request timed out. The submission will be retried automatically.',
  'SERVICE_UNAVAILABLE': 'EFRIS service is temporarily unavailable. The submission will be retried automatically.',
  
  // Stock errors
  'STOCK_ERROR': 'Failed to sync stock with EFRIS. Please verify item codes and try again.',
  'INVALID_STOCK': 'Invalid stock data. Please check item quantities and try again.',
  
  // General errors
  'INTERNAL_ERROR': 'An internal EFRIS error occurred. Please try again later.',
  'VALIDATION_ERROR': 'EFRIS validation failed. Please check the sale details.',
}

/**
 * Maps an EFRIS error message to a user-friendly message
 * 
 * @param efrisError - The raw error message from EFRIS API
 * @param fallback - Fallback message if no mapping is found
 * @returns User-friendly error message
 */
export function mapEfrisErrorToUserMessage(
  efrisError: string,
  fallback: string = 'EFRIS submission failed. Please try again later or contact support.'
): string {
  // Try exact match first
  if (EFRIS_ERROR_MESSAGES[efrisError]) {
    return EFRIS_ERROR_MESSAGES[efrisError]
  }

  // Try partial match (error message contains the key)
  const upperError = efrisError.toUpperCase()
  for (const [key, message] of Object.entries(EFRIS_ERROR_MESSAGES)) {
    if (upperError.includes(key)) {
      return message
    }
  }

  // Return fallback
  return fallback
}

/**
 * Determines if an EFRIS error is retryable
 * 
 * @param efrisError - The raw error message from EFRIS API
 * @returns True if the error is likely temporary and should be retried
 */
export function isEfrisErrorRetryable(efrisError: string): boolean {
  const retryableErrors = [
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]

  const upperError = efrisError.toUpperCase()
  return retryableErrors.some(error => upperError.includes(error))
}
