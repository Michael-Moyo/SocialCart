// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORMS = ['shopify', 'woocommerce', 'odoo', 'erpnext', 'retailman'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'partial', 'refunded', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = ['unfulfilled', 'partial', 'fulfilled'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const PLAN_TIERS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const LOYALTY_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

export const CART_STATUSES = ['ACTIVE', 'CONVERTED', 'ABANDONED', 'RECOVERED'] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export const CONVERSATION_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'BOT'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CAMPAIGN_TYPES = ['BROADCAST', 'DRIP', 'ABANDONED_CART', 'LOYALTY', 'REORDER'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format (e.g. +2348012345678)
 * Strips spaces, dashes, parentheses. Prepends + if missing.
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  const stripped = phone.replace(/[^\d+]/g, '');
  if (stripped.startsWith('+')) return stripped;
  // If starts with 00, replace with +
  if (stripped.startsWith('00')) return `+${stripped.slice(2)}`;
  // If starts with 0, assume local Nigerian number (234)
  if (stripped.startsWith('0')) return `+234${stripped.slice(1)}`;
  return `+${stripped}`;
}

/**
 * Format a number as currency string
 */
export function formatCurrency(amount: number, currency = 'NGN', locale = 'en-NG'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Paginate an array
 */
export function paginate<T>(items: T[], page: number, limit: number): { data: T[]; total: number; page: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return { data: items.slice(offset, offset + limit), total, page, totalPages };
}

/**
 * Sleep for ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk an array into smaller arrays of size `size`
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) && targetVal && typeof targetVal === 'object') {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>) as T[typeof key];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[typeof key];
    }
  }
  return result;
}

/**
 * Generate a random alphanumeric string
 */
export function generateId(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Truncate text to maxLength with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Build pagination response envelope
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// ─── Common API Response Types ────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function errorResponse(error: string, message?: string): ApiResponse {
  return { success: false, error, message };
}
