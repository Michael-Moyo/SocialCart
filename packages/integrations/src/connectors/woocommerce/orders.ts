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
import { mapWCCustomer } from './customers';

interface WCOrderLineItem {
  id: number;
  product_id: number;
  variation_id: number;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  total: string;
  subtotal: string;
}

interface WCBillingShipping {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface WCOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  shipping_total: string;
  discount_total: string;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_created: string;
  date_modified: string;
  billing: WCBillingShipping & { email: string; phone: string };
  shipping: WCBillingShipping;
  line_items: WCOrderLineItem[];
  customer_id: number;
  customer_note: string;
  meta_data: { key: string; value: unknown }[];
}

function mapWCOrderStatus(status: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    pending: 'pending',
    processing: 'processing',
    'on-hold': 'pending',
    completed: 'delivered',
    cancelled: 'cancelled',
    refunded: 'refunded',
    failed: 'cancelled',
    checkout_draft: 'pending',
  };
  return map[status] ?? 'pending';
}

function mapWCPaymentStatus(status: string, paymentMethod: string): PaymentStatus {
  if (status === 'refunded') return 'refunded';
  if (status === 'cancelled' || status === 'failed') return 'failed';
  if (status === 'completed' || status === 'processing') return 'paid';
  if (paymentMethod === 'cod') return 'pending';
  return 'pending';
}

function mapWCFulfillmentStatus(status: string): FulfillmentStatus {
  if (status === 'completed') return 'fulfilled';
  if (status === 'processing') return 'partial';
  return 'unfulfilled';
}

function mapWCAddress(a: WCBillingShipping): Address {
  return {
    firstName: a.first_name,
    lastName: a.last_name,
    company: a.company || undefined,
    address1: a.address_1,
    address2: a.address_2 || undefined,
    city: a.city,
    state: a.state,
    zip: a.postcode,
    country: a.country,
    phone: (a as { phone?: string }).phone || undefined,
  };
}

export function mapWCOrder(o: WCOrder): UnifiedOrder {
  const lineItems: OrderLineItem[] = o.line_items.map((li) => ({
    id: String(li.id),
    productId: String(li.product_id),
    variantId: li.variation_id ? String(li.variation_id) : undefined,
    sku: li.sku,
    name: li.name,
    quantity: li.quantity,
    price: li.price,
    total: parseFloat(li.total),
  }));

  const customer: UnifiedCustomer = {
    id: String(o.customer_id || ''),
    externalId: String(o.customer_id || ''),
    platform: 'woocommerce',
    phone: o.billing.phone,
    email: o.billing.email,
    firstName: o.billing.first_name,
    lastName: o.billing.last_name,
    name: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
    tags: [],
    totalOrders: 0,
    totalSpent: 0,
    currency: o.currency,
    createdAt: new Date(o.date_created),
  };

  return {
    id: String(o.id),
    externalId: String(o.id),
    orderNumber: o.number,
    platform: 'woocommerce',
    customer,
    lineItems,
    subtotal: parseFloat(o.subtotal || '0'),
    tax: parseFloat(o.total_tax),
    shipping: parseFloat(o.shipping_total),
    discount: parseFloat(o.discount_total),
    total: parseFloat(o.total),
    currency: o.currency,
    status: mapWCOrderStatus(o.status),
    paymentStatus: mapWCPaymentStatus(o.status, o.payment_method),
    fulfillmentStatus: mapWCFulfillmentStatus(o.status),
    shippingAddress: mapWCAddress(o.shipping),
    billingAddress: mapWCAddress(o.billing),
    notes: o.customer_note || undefined,
    createdAt: new Date(o.date_created),
    updatedAt: new Date(o.date_modified),
  };
}

export class WooCommerceOrdersClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string
  ) {}

  async listOrders(options: { limit?: number; status?: string; page?: number } = {}): Promise<UnifiedOrder[]> {
    const params: Record<string, string | number> = {
      per_page: options.limit ?? 100,
      page: options.page ?? 1,
    };
    if (options.status) params['status'] = options.status;

    const response = await this.http.get<WCOrder[]>(`${this.baseUrl}/wp-json/wc/v3/orders`, { params });
    return response.data.map(mapWCOrder);
  }

  async getOrder(id: string): Promise<UnifiedOrder> {
    const response = await this.http.get<WCOrder>(`${this.baseUrl}/wp-json/wc/v3/orders/${id}`);
    return mapWCOrder(response.data);
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    const [firstName, ...lastParts] = (input.customer.name || 'Customer').split(' ');
    const lastName = lastParts.join(' ');

    const billing = input.shippingAddress
      ? {
          first_name: input.shippingAddress.firstName,
          last_name: input.shippingAddress.lastName,
          address_1: input.shippingAddress.address1,
          address_2: input.shippingAddress.address2 ?? '',
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          postcode: input.shippingAddress.zip,
          country: input.shippingAddress.country,
          email: input.customer.email ?? '',
          phone: input.customer.phone,
        }
      : {
          first_name: firstName ?? '',
          last_name: lastName,
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          postcode: '',
          country: '',
          email: input.customer.email ?? '',
          phone: input.customer.phone,
        };

    const lineItems = input.lineItems.map((li) => ({
      product_id: parseInt(li.productId, 10),
      variation_id: li.variantId ? parseInt(li.variantId, 10) : undefined,
      quantity: li.quantity,
    }));

    const body = {
      payment_method: 'cod',
      payment_method_title: 'WhatsApp Order',
      set_paid: false,
      billing,
      shipping: billing,
      line_items: lineItems,
      customer_note: input.notes ?? '',
    };

    const response = await this.http.post<WCOrder>(`${this.baseUrl}/wp-json/wc/v3/orders`, body);
    return mapWCOrder(response.data);
  }

  async updateOrderStatus(id: string, status: string): Promise<UnifiedOrder> {
    // Map unified status to WC status
    const statusMap: Record<string, string> = {
      pending: 'pending',
      confirmed: 'processing',
      processing: 'processing',
      shipped: 'processing',
      delivered: 'completed',
      cancelled: 'cancelled',
      refunded: 'refunded',
    };
    const wcStatus = statusMap[status] ?? status;
    const response = await this.http.put<WCOrder>(`${this.baseUrl}/wp-json/wc/v3/orders/${id}`, {
      status: wcStatus,
    });
    return mapWCOrder(response.data);
  }
}
