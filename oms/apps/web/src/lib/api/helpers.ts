/**
 * API Helper Functions
 * Utility functions for handling API responses and data transformations
 */

/**
 * Parse decimal values from API responses
 * Backend returns Decimal fields as strings to preserve precision
 * This function safely converts them to numbers for frontend calculations
 *
 * @param value - String, number, null, or undefined value from API
 * @returns Parsed number value (0 if null/undefined/invalid)
 *
 * @example
 * const subtotal = parseDecimal(order.subtotal);
 * const tax = parseDecimal(order.taxAmount);
 * const total = subtotal + tax; // Correct arithmetic
 */
export const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Format a number as currency (INR)
 * @param value - Number or string value to format
 * @param currency - Currency code (default: INR)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: string | number | null | undefined,
  currency: string = 'INR'
): string => {
  const num = parseDecimal(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format a number with commas (Indian number system)
 * @param value - Number or string value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export const formatNumber = (
  value: string | number | null | undefined,
  decimals: number = 2
): string => {
  const num = parseDecimal(value);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Calculate percentage
 * @param value - The value
 * @param total - The total
 * @returns Percentage as a number (0-100)
 */
export const calculatePercentage = (
  value: string | number | null | undefined,
  total: string | number | null | undefined
): number => {
  const numValue = parseDecimal(value);
  const numTotal = parseDecimal(total);
  if (numTotal === 0) return 0;
  return (numValue / numTotal) * 100;
};

/**
 * Safely sum an array of decimal values
 * @param values - Array of string/number values
 * @returns Sum as a number
 */
export const sumDecimals = (values: (string | number | null | undefined)[]): number => {
  return values.reduce((sum, val) => sum + parseDecimal(val), 0);
};

/**
 * Calculate order totals from items
 * @param items - Array of order items with unitPrice, quantity, taxAmount, discount
 * @returns Object with subtotal, taxTotal, discountTotal, grandTotal
 */
export const calculateOrderTotals = (
  items: Array<{
    unitPrice?: string | number | null;
    quantity?: number;
    taxAmount?: string | number | null;
    discount?: string | number | null;
  }>
): {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
} => {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const price = parseDecimal(item.unitPrice);
    const qty = item.quantity || 0;
    const tax = parseDecimal(item.taxAmount);
    const discount = parseDecimal(item.discount);

    subtotal += price * qty;
    taxTotal += tax;
    discountTotal += discount;
  }

  const grandTotal = subtotal + taxTotal - discountTotal;

  return {
    subtotal,
    taxTotal,
    discountTotal,
    grandTotal,
  };
};
