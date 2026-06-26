import crypto from 'crypto';
import {
  ConnectorConfig,
  ConnectorError,
  CreateCustomerInput,
  CreateOrderInput,
  GetProductsOptions,
  OrderLineItem,
  ProductImage,
  UnifiedCustomer,
  UnifiedInventory,
  UnifiedOrder,
  UnifiedProduct,
} from '../../types';
import { BaseConnector } from '../../base-connector';

// ─── RetailMan Config ─────────────────────────────────────────────────────────

interface RetailManCredentials {
  baseUrl: string;
  apiKey: string;
  /** Optional: customize endpoint paths if the install uses non-standard routes */
  endpoints?: {
    products?: string;
    orders?: string;
    customers?: string;
    inventory?: string;
  };
}

// ─── Raw RetailMan Types (generic REST ERP) ───────────────────────────────────

interface RMProduct {
  id: string | number;
  code: string;
  name: string;
  description?: string;
  price: number | string;
  compare_price?: number | string;
  stock_quantity?: number;
  quantity?: number;
  image_url?: string;
  images?: { url: string; alt?: string }[];
  category?: string;
  categories?: string[];
  status?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RMCustomer {
  id: string | number;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  total_orders?: number;
  total_spent?: number;
  created_at?: string;
}

interface RMOrderLine {
  id?: string | number;
  product_id: string | number;
  sku?: string;
  name?: string;
  quantity: number;
  unit_price: number | string;
  total?: number | string;
}

interface RMOrder {
  id: string | number;
  order_number?: string;
  status?: string;
  payment_status?: string;
  customer_id?: string | number;
  customer?: RMCustomer;
  lines?: RMOrderLine[];
  items?: RMOrderLine[];
  sub_total?: number | string;
  subtotal?: number | string;
  tax_total?: number | string;
  tax?: number | string;
  shipping_total?: number | string;
  shipping?: number | string;
  discount_total?: number | string;
  discount?: number | string;
  total: number | string;
  currency?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toNum(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

function mapRMProduct(p: RMProduct): UnifiedProduct {
  const images: ProductImage[] = p.image_url
    ? [{ url: p.image_url }]
    : (p.images ?? []).map((img) => ({ url: img.url, alt: img.alt }));

  const inventory = p.stock_quantity ?? p.quantity ?? 0;
  const categories = p.categories ?? (p.category ? [p.category] : []);

  let status: 'active' | 'inactive' | 'draft' = 'active';
  if (p.status === 'inactive' || p.active === false) status = 'inactive';
  else if (p.status === 'draft') status = 'draft';

  return {
    id: String(p.id),
    externalId: String(p.id),
    platform: 'retailman',
    sku: p.code || String(p.id),
    name: p.name,
    description: p.description ?? '',
    price: toNum(p.price),
    compareAtPrice: p.compare_price ? toNum(p.compare_price) : undefined,
    currency: 'USD',
    inventory,
    images,
    variants: [],
    categories,
    status,
    createdAt: p.created_at ? new Date(p.created_at) : new Date(),
    updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
  };
}

function mapRMCustomer(c: RMCustomer): UnifiedCustomer {
  const name = c.name ?? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
  const phone = c.phone ?? c.mobile ?? '';
  return {
    id: String(c.id),
    externalId: String(c.id),
    platform: 'retailman',
    phone,
    email: c.email,
    firstName: c.first_name ?? name.split(' ')[0] ?? '',
    lastName: c.last_name ?? name.split(' ').slice(1).join(' '),
    name,
    tags: [],
    totalOrders: c.total_orders ?? 0,
    totalSpent: c.total_spent ?? 0,
    currency: 'USD',
    defaultAddress: c.address
      ? {
          firstName: c.first_name ?? '',
          lastName: c.last_name ?? '',
          address1: c.address.line1 ?? '',
          address2: c.address.line2,
          city: c.address.city ?? '',
          state: c.address.state ?? '',
          zip: c.address.postal_code ?? '',
          country: c.address.country ?? '',
          phone,
        }
      : undefined,
    createdAt: c.created_at ? new Date(c.created_at) : new Date(),
  };
}

function mapRMOrder(o: RMOrder): UnifiedOrder {
  const lineItems: OrderLineItem[] = (o.lines ?? o.items ?? []).map((li, i) => ({
    id: String(li.id ?? i),
    productId: String(li.product_id),
    sku: li.sku ?? '',
    name: li.name ?? String(li.product_id),
    quantity: li.quantity,
    price: toNum(li.unit_price),
    total: toNum(li.total) || toNum(li.unit_price) * li.quantity,
  }));

  const customer: UnifiedCustomer = o.customer
    ? mapRMCustomer(o.customer)
    : {
        id: String(o.customer_id ?? ''),
        externalId: String(o.customer_id ?? ''),
        platform: 'retailman',
        phone: '',
        firstName: '',
        lastName: '',
        name: 'Unknown Customer',
        tags: [],
        totalOrders: 0,
        totalSpent: 0,
        currency: 'USD',
        createdAt: new Date(),
      };

  return {
    id: String(o.id),
    externalId: String(o.id),
    orderNumber: o.order_number,
    platform: 'retailman',
    customer,
    lineItems,
    subtotal: toNum(o.sub_total ?? o.subtotal),
    tax: toNum(o.tax_total ?? o.tax),
    shipping: toNum(o.shipping_total ?? o.shipping),
    discount: toNum(o.discount_total ?? o.discount),
    total: toNum(o.total),
    currency: o.currency ?? 'USD',
    status: (o.status as UnifiedOrder['status']) ?? 'pending',
    paymentStatus: (o.payment_status as UnifiedOrder['paymentStatus']) ?? 'pending',
    fulfillmentStatus: 'unfulfilled',
    notes: o.notes,
    createdAt: o.created_at ? new Date(o.created_at) : new Date(),
    updatedAt: o.updated_at ? new Date(o.updated_at) : new Date(),
  };
}

// ─── RetailMan Connector ──────────────────────────────────────────────────────

export class RetailManConnector extends BaseConnector {
  private readonly rmBaseUrl: string;
  private readonly endpoints: Required<NonNullable<RetailManCredentials['endpoints']>>;

  constructor(config: ConnectorConfig) {
    super(config);
    const creds = config.credentials as unknown as RetailManCredentials;
    if (!creds.baseUrl || !creds.apiKey) {
      throw new ConnectorError(
        'RetailMan connector requires baseUrl and apiKey',
        'INVALID_CONFIG',
        undefined,
        undefined,
        'retailman'
      );
    }

    this.rmBaseUrl = creds.baseUrl.replace(/\/$/, '');
    this.http.defaults.headers.common['X-API-Key'] = creds.apiKey;
    this.http.defaults.headers.common['Authorization'] = `Bearer ${creds.apiKey}`;

    this.endpoints = {
      products: creds.endpoints?.products ?? '/api/products',
      orders: creds.endpoints?.orders ?? '/api/orders',
      customers: creds.endpoints?.customers ?? '/api/customers',
      inventory: creds.endpoints?.inventory ?? '/api/inventory',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.get<unknown>(`${this.rmBaseUrl}/api/health`);
      return true;
    } catch {
      // Try products endpoint as fallback
      try {
        await this.get<unknown>(`${this.rmBaseUrl}${this.endpoints.products}?limit=1`);
        return true;
      } catch {
        return false;
      }
    }
  }

  async getProducts(options: GetProductsOptions = {}): Promise<UnifiedProduct[]> {
    const params: Record<string, string | number> = {
      page: options.page ?? 1,
      limit: options.limit ?? 100,
    };
    if (options.status && options.status !== 'all') params['status'] = options.status;
    if (options.search) params['q'] = options.search;
    if (options.updatedAfter) params['updated_after'] = options.updatedAfter.toISOString();

    const response = await this.get<{ data: RMProduct[] } | RMProduct[]>(
      `${this.rmBaseUrl}${this.endpoints.products}`,
      { params }
    );

    const products = Array.isArray(response) ? response : response.data;
    return products.map(mapRMProduct);
  }

  async getProduct(id: string): Promise<UnifiedProduct> {
    const response = await this.get<{ data: RMProduct } | RMProduct>(
      `${this.rmBaseUrl}${this.endpoints.products}/${id}`
    );
    const product = 'data' in response ? response.data : response;
    return mapRMProduct(product);
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    const body = {
      customer: {
        name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email,
      },
      lines: input.lineItems.map((li) => ({
        product_id: li.productId,
        quantity: li.quantity,
        unit_price: li.price,
      })),
      shipping_address: input.shippingAddress,
      notes: input.notes,
    };

    const response = await this.post<{ data: RMOrder } | RMOrder>(
      `${this.rmBaseUrl}${this.endpoints.orders}`,
      body
    );
    const order = 'data' in response ? response.data : response;
    return mapRMOrder(order);
  }

  async getOrder(id: string): Promise<UnifiedOrder> {
    const response = await this.get<{ data: RMOrder } | RMOrder>(
      `${this.rmBaseUrl}${this.endpoints.orders}/${id}`
    );
    const order = 'data' in response ? response.data : response;
    return mapRMOrder(order);
  }

  async updateOrderStatus(id: string, status: string): Promise<UnifiedOrder> {
    const response = await this.patch<{ data: RMOrder } | RMOrder>(
      `${this.rmBaseUrl}${this.endpoints.orders}/${id}`,
      { status }
    );
    const order = 'data' in response ? response.data : response;
    return mapRMOrder(order);
  }

  async getCustomer(id: string): Promise<UnifiedCustomer> {
    const response = await this.get<{ data: RMCustomer } | RMCustomer>(
      `${this.rmBaseUrl}${this.endpoints.customers}/${id}`
    );
    const customer = 'data' in response ? response.data : response;
    return mapRMCustomer(customer);
  }

  async findCustomerByPhone(phone: string): Promise<UnifiedCustomer | null> {
    const response = await this.get<{ data: RMCustomer[] } | RMCustomer[]>(
      `${this.rmBaseUrl}${this.endpoints.customers}`,
      { params: { phone, limit: 5 } }
    );
    const customers = Array.isArray(response) ? response : response.data;
    if (!customers.length) return null;

    const normalizedPhone = phone.replace(/\D/g, '');
    const exact = customers.find((c) => {
      const cPhone = (c.phone ?? c.mobile ?? '').replace(/\D/g, '');
      return cPhone === normalizedPhone;
    });
    return exact ? mapRMCustomer(exact) : mapRMCustomer(customers[0]!);
  }

  async createCustomer(input: CreateCustomerInput): Promise<UnifiedCustomer> {
    const body = {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      address: input.address
        ? {
            line1: input.address.address1,
            line2: input.address.address2,
            city: input.address.city,
            state: input.address.state,
            postal_code: input.address.zip,
            country: input.address.country,
          }
        : undefined,
    };

    const response = await this.post<{ data: RMCustomer } | RMCustomer>(
      `${this.rmBaseUrl}${this.endpoints.customers}`,
      body
    );
    const customer = 'data' in response ? response.data : response;
    return mapRMCustomer(customer);
  }

  async checkInventory(productId: string, _variantId?: string): Promise<UnifiedInventory> {
    try {
      const response = await this.get<{ quantity: number; available: number; sku: string } | { data: { quantity: number; available: number; sku: string } }>(
        `${this.rmBaseUrl}${this.endpoints.inventory}/${productId}`
      );
      const data = 'data' in response ? response.data : response;
      return {
        productId,
        sku: data.sku ?? productId,
        quantity: data.quantity ?? 0,
        available: data.available ?? data.quantity ?? 0,
      };
    } catch {
      // Fallback: get from product
      const product = await this.getProduct(productId);
      return {
        productId,
        sku: product.sku,
        quantity: product.inventory,
        available: product.inventory,
      };
    }
  }

  verifyWebhook(payload: Buffer, signature: string): boolean {
    const secret = this.config.webhookSecret ?? '';
    if (!secret) return true;
    const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async handleWebhook(_event: string, _payload: unknown): Promise<void> {
    // RetailMan webhook handling — customize per deployment
  }
}
