export type PlatformType = 'shopify' | 'woocommerce' | 'odoo' | 'erpnext' | 'retailman';

// ─── Canonical Unified Types ──────────────────────────────────────────────────

export interface UnifiedVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  inventory: number;
  attributes: Record<string, string>;
  externalId: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
  position?: number;
}

export interface UnifiedProduct {
  id: string;
  externalId: string;
  platform: PlatformType;
  sku: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  inventory: number;
  images: ProductImage[];
  variants: UnifiedVariant[];
  categories: string[];
  tags?: string[];
  status: 'active' | 'inactive' | 'draft';
  weight?: number;
  weightUnit?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderLineItem {
  id: string;
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  discount?: number;
  tax?: number;
  image?: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  countryCode?: string;
  phone?: string;
}

export interface UnifiedCustomer {
  id: string;
  externalId: string;
  platform: PlatformType;
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  name: string;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  currency: string;
  defaultAddress?: Address;
  acceptsMarketing?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded' | 'failed';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled';

export interface UnifiedOrder {
  id: string;
  externalId: string;
  orderNumber?: string;
  platform: PlatformType;
  customer: UnifiedCustomer;
  lineItems: OrderLineItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  tags?: string[];
  trackingNumber?: string;
  trackingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UnifiedInventory {
  productId: string;
  variantId?: string;
  sku: string;
  quantity: number;
  warehouseId?: string;
  warehouseName?: string;
  reserved?: number;
  available?: number;
  updatedAt?: Date;
}

// ─── Sync Types ───────────────────────────────────────────────────────────────

export interface SyncError {
  externalId: string;
  error: string;
  data?: unknown;
}

export interface SyncResult {
  success: boolean;
  entity: string;
  created: number;
  updated: number;
  failed: number;
  errors: SyncError[];
  startedAt: Date;
  completedAt: Date;
  duration: number;
}

// ─── Connector Config ─────────────────────────────────────────────────────────

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

export interface ConnectorConfig {
  type: PlatformType;
  credentials: Record<string, string>;
  webhookSecret?: string;
  syncInterval?: number; // minutes
  rateLimit?: RateLimitConfig;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  customer: {
    phone: string;
    email?: string;
    name: string;
    externalId?: string;
  };
  lineItems: {
    productId: string;
    variantId?: string;
    sku?: string;
    name?: string;
    quantity: number;
    price: number;
  }[];
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  tags?: string[];
  currency?: string;
}

export interface CreateCustomerInput {
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  tags?: string[];
  address?: Address;
  acceptsMarketing?: boolean;
}

export interface GetProductsOptions {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive' | 'all';
  category?: string;
  search?: string;
  sinceId?: string;
  updatedAfter?: Date;
  ids?: string[];
}

// ─── Connector Error ──────────────────────────────────────────────────────────

export class ConnectorError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly originalError?: unknown;
  public readonly platform?: PlatformType;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    originalError?: unknown,
    platform?: PlatformType
  ) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.platform = platform;
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConnectorError.prototype);
  }
}
