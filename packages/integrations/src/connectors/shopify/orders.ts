import { AxiosInstance } from 'axios';
import {
  Address,
  CreateOrderInput,
  FulfillmentStatus,
  OrderLineItem,
  OrderStatus,
  PaymentStatus,
  UnifiedCustomer,
  UnifiedOrder,
} from '../../types';
import { mapShopifyCustomer } from './customers';

// ─── Shopify Raw Types ────────────────────────────────────────────────────────

interface ShopifyAddress {
  first_name: string;
  last_name: string;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  zip: string;
  country: string;
  country_code: string;
  phone: string | null;
}

interface ShopifyLineItem {
  id: number;
  product_id: number | null;
  variant_id: number | null;
  sku: string;
  title: string;
  name: string;
  quantity: number;
  price: string;
  total_discount: string;
  tax_lines: { price: string; rate: number; title: string }[];
}

interface ShopifyCustomerStub {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  tags: string;
  default_address: ShopifyAddress | null;
  created_at: string;
  updated_at: string;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  email: string | null;
  phone: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  total_shipping_price_set: { shop_money: { amount: string } };
  line_items: ShopifyLineItem[];
  customer: ShopifyCustomerStub | null;
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  note: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
}

interface ShopifyOrderResponse {
  order: ShopifyOrder;
}

// ─── Status Mappers ───────────────────────────────────────────────────────────

function mapFinancialStatus(status: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    pending: 'pending',
    authorized: 'pending',
    partially_paid: 'partial',
    paid: 'paid',
    partially_refunded: 'partial',
    refunded: 'refunded',
    voided: 'failed',
  };
  return map[status] ?? 'pending';
}

function mapFulfillmentStatus(status: string | null): FulfillmentStatus {
  if (!status) return 'unfulfilled';
  if (status === 'fulfilled') return 'fulfilled';
  if (status === 'partial') return 'partial';
  return 'unfulfilled';
}

function mapOrderStatus(financial: string, fulfillment: string | null): OrderStatus {
  if (financial === 'refunded' || financial === 'voided') return 'refunded';
  if (fulfillment === 'fulfilled') return 'delivered';
  if (fulfillment === 'partial') return 'shipped';
  if (financial === 'paid') return 'confirmed';
  return 'pending';
}

function mapAddress(a: ShopifyAddress | null): Address | undefined {
  if (!a) return undefined;
  return {
    firstName: a.first_name,
    lastName: a.last_name,
    company: a.company ?? undefined,
    address1: a.address1,
    address2: a.address2 ?? undefined,
    city: a.city,
    state: a.province,
    zip: a.zip,
    country: a.country,
    countryCode: a.country_code,
    phone: a.phone ?? undefined,
  };
}

// ─── Order Mapper ─────────────────────────────────────────────────────────────

export function mapShopifyOrder(o: ShopifyOrder): UnifiedOrder {
  const lineItems: OrderLineItem[] = o.line_items.map((li) => ({
    id: String(li.id),
    productId: li.product_id ? String(li.product_id) : '',
    variantId: li.variant_id ? String(li.variant_id) : undefined,
    sku: li.sku,
    name: li.name || li.title,
    quantity: li.quantity,
    price: parseFloat(li.price),
    total: parseFloat(li.price) * li.quantity - parseFloat(li.total_discount),
    discount: parseFloat(li.total_discount),
  }));

  const customer: UnifiedCustomer = o.customer
    ? mapShopifyCustomer(o.customer as Parameters<typeof mapShopifyCustomer>[0])
    : {
        id: '',
        externalId: '',
        platform: 'shopify',
        phone: o.phone ?? '',
        email: o.email ?? undefined,
        firstName: '',
        lastName: '',
        name: o.email ?? 'Unknown',
        tags: [],
        totalOrders: 0,
        totalSpent: 0,
        currency: o.currency,
        createdAt: new Date(),
      };

  const shippingCost =
    parseFloat(o.total_shipping_price_set.shop_money.amount);

  return {
    id: String(o.id),
    externalId: String(o.id),
    orderNumber: o.name,
    platform: 'shopify',
    customer,
    lineItems,
    subtotal: parseFloat(o.subtotal_price),
    tax: parseFloat(o.total_tax),
    shipping: shippingCost,
    discount: parseFloat(o.total_discounts),
    total: parseFloat(o.total_price),
    currency: o.currency,
    status: mapOrderStatus(o.financial_status, o.fulfillment_status),
    paymentStatus: mapFinancialStatus(o.financial_status),
    fulfillmentStatus: mapFulfillmentStatus(o.fulfillment_status),
    shippingAddress: mapAddress(o.shipping_address),
    billingAddress: mapAddress(o.billing_address),
    notes: o.note ?? undefined,
    tags: o.tags ? o.tags.split(', ').filter(Boolean) : [],
    createdAt: new Date(o.created_at),
    updatedAt: new Date(o.updated_at),
  };
}

// ─── Shopify Orders Client ────────────────────────────────────────────────────

export class ShopifyOrdersClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string,
    private readonly apiVersion: string
  ) {}

  async listOrders(options: { limit?: number; status?: string; sinceId?: string } = {}): Promise<UnifiedOrder[]> {
    const params: Record<string, string | number> = {
      limit: options.limit ?? 250,
      status: options.status ?? 'any',
    };
    if (options.sinceId) params['since_id'] = options.sinceId;

    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/orders.json`;
    const response = await this.http.get<ShopifyOrdersResponse>(url, { params });
    return response.data.orders.map(mapShopifyOrder);
  }

  async getOrder(id: string): Promise<UnifiedOrder> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/orders/${id}.json`;
    const response = await this.http.get<ShopifyOrderResponse>(url);
    return mapShopifyOrder(response.data.order);
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    const lineItems = input.lineItems.map((li) => ({
      variant_id: li.variantId ?? li.productId,
      quantity: li.quantity,
      price: String(li.price),
    }));

    const [firstName, ...lastParts] = (input.customer.name || 'Customer').split(' ');
    const lastName = lastParts.join(' ') || '';

    const body: Record<string, unknown> = {
      order: {
        line_items: lineItems,
        customer: input.customer.externalId
          ? { id: input.customer.externalId }
          : {
              first_name: firstName,
              last_name: lastName,
              email: input.customer.email,
              phone: input.customer.phone,
            },
        note: input.notes,
        tags: input.tags?.join(', '),
        financial_status: 'pending',
        send_receipt: false,
        send_fulfillment_receipt: false,
      },
    };

    if (input.shippingAddress) {
      (body['order'] as Record<string, unknown>)['shipping_address'] = {
        first_name: input.shippingAddress.firstName,
        last_name: input.shippingAddress.lastName,
        address1: input.shippingAddress.address1,
        address2: input.shippingAddress.address2,
        city: input.shippingAddress.city,
        province: input.shippingAddress.state,
        zip: input.shippingAddress.zip,
        country: input.shippingAddress.country,
        phone: input.shippingAddress.phone,
      };
    }

    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/orders.json`;
    const response = await this.http.post<ShopifyOrderResponse>(url, body);
    return mapShopifyOrder(response.data.order);
  }

  async updateOrderStatus(id: string, status: string): Promise<UnifiedOrder> {
    // Shopify doesn't have a direct status field; we handle cancel vs fulfillment
    if (status === 'cancelled') {
      const url = `${this.baseUrl}/admin/api/${this.apiVersion}/orders/${id}/cancel.json`;
      const response = await this.http.post<ShopifyOrderResponse>(url, {});
      return mapShopifyOrder(response.data.order);
    }

    if (status === 'fulfilled' || status === 'shipped') {
      // Create a fulfillment for all line items
      const order = await this.getOrder(id);
      const fulfillmentUrl = `${this.baseUrl}/admin/api/${this.apiVersion}/orders/${id}/fulfillments.json`;
      await this.http.post(fulfillmentUrl, {
        fulfillment: {
          location_id: null,
          tracking_number: null,
          notify_customer: true,
        },
      });
      return { ...order, status: 'shipped', fulfillmentStatus: 'fulfilled' };
    }

    return this.getOrder(id);
  }
}
