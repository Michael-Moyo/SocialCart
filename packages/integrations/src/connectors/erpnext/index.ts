import crypto from 'crypto';
import {
  ConnectorConfig,
  ConnectorError,
  CreateCustomerInput,
  CreateOrderInput,
  GetProductsOptions,
  OrderLineItem,
  UnifiedCustomer,
  UnifiedInventory,
  UnifiedOrder,
  UnifiedProduct,
  ProductImage,
} from '../../types';
import { BaseConnector } from '../../base-connector';
import { ERPNextClient, ERPNextCredentials } from './client';

// ─── ERPNext Raw Types ────────────────────────────────────────────────────────

interface ERPNextItem {
  name: string;
  item_code: string;
  item_name: string;
  description: string;
  item_group: string;
  standard_rate: number;
  valuation_rate: number;
  opening_stock: number;
  actual_qty: number;
  image: string | null;
  disabled: number;
  is_sales_item: number;
  creation: string;
  modified: string;
}

interface ERPNextCustomer {
  name: string;
  customer_name: string;
  customer_type: string;
  email_id: string;
  mobile_no: string;
  phone: string;
  customer_group: string;
  territory: string;
  creation: string;
  modified: string;
}

interface ERPNextSalesOrderItem {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  uom: string;
}

interface ERPNextSalesOrder {
  name: string;
  status: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string;
  currency: string;
  net_total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  discount_amount: number;
  items: ERPNextSalesOrderItem[];
  creation: string;
  modified: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapERPNextItem(item: ERPNextItem): UnifiedProduct {
  const images: ProductImage[] = item.image ? [{ url: item.image }] : [];
  return {
    id: item.name,
    externalId: item.name,
    platform: 'erpnext',
    sku: item.item_code,
    name: item.item_name,
    description: item.description || '',
    price: item.standard_rate,
    currency: 'USD',
    inventory: Math.max(0, item.actual_qty),
    images,
    variants: [],
    categories: item.item_group ? [item.item_group] : [],
    status: item.disabled ? 'inactive' : 'active',
    createdAt: new Date(item.creation),
    updatedAt: new Date(item.modified),
  };
}

function mapERPNextCustomer(c: ERPNextCustomer): UnifiedCustomer {
  return {
    id: c.name,
    externalId: c.name,
    platform: 'erpnext',
    phone: c.mobile_no || c.phone || '',
    email: c.email_id || undefined,
    firstName: c.customer_name.split(' ')[0] ?? c.customer_name,
    lastName: c.customer_name.split(' ').slice(1).join(' '),
    name: c.customer_name,
    tags: [],
    totalOrders: 0,
    totalSpent: 0,
    currency: 'USD',
    createdAt: new Date(c.creation),
    updatedAt: new Date(c.modified),
  };
}

function mapERPNextOrder(o: ERPNextSalesOrder, customer: UnifiedCustomer): UnifiedOrder {
  const lineItems: OrderLineItem[] = (o.items || []).map((li) => ({
    id: li.name,
    productId: li.item_code,
    sku: li.item_code,
    name: li.item_name,
    quantity: li.qty,
    price: li.rate,
    total: li.amount,
  }));

  const statusMap: Record<string, 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled'> = {
    Draft: 'pending',
    'To Deliver and Bill': 'confirmed',
    'To Bill': 'processing',
    'To Deliver': 'processing',
    Completed: 'delivered',
    Cancelled: 'cancelled',
    Closed: 'delivered',
  };

  return {
    id: o.name,
    externalId: o.name,
    orderNumber: o.name,
    platform: 'erpnext',
    customer,
    lineItems,
    subtotal: o.net_total,
    tax: o.total_taxes_and_charges,
    shipping: 0,
    discount: o.discount_amount,
    total: o.grand_total,
    currency: o.currency,
    status: statusMap[o.status] ?? 'pending',
    paymentStatus: o.status === 'Completed' ? 'paid' : 'pending',
    fulfillmentStatus: o.status === 'Completed' ? 'fulfilled' : 'unfulfilled',
    createdAt: new Date(o.creation),
    updatedAt: new Date(o.modified),
  };
}

// ─── ERPNext Connector ────────────────────────────────────────────────────────

export class ERPNextConnector extends BaseConnector {
  private readonly client: ERPNextClient;

  constructor(config: ConnectorConfig) {
    super(config);
    const creds = config.credentials as unknown as ERPNextCredentials;
    if (!creds.baseUrl || !creds.apiKey || !creds.apiSecret) {
      throw new ConnectorError(
        'ERPNext connector requires baseUrl, apiKey, apiSecret',
        'INVALID_CONFIG',
        undefined,
        undefined,
        'erpnext'
      );
    }
    this.client = new ERPNextClient(creds);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.callMethod<unknown>('frappe.auth.get_logged_user');
      return true;
    } catch {
      return false;
    }
  }

  async getProducts(options: GetProductsOptions = {}): Promise<UnifiedProduct[]> {
    const filters: unknown[][] = [['is_sales_item', '=', 1]];
    if (options.status === 'active') filters.push(['disabled', '=', 0]);
    if (options.search) filters.push(['item_name', 'like', `%${options.search}%`]);

    const items = await this.client.getList<ERPNextItem>('Item', {
      fields: ['name', 'item_code', 'item_name', 'description', 'item_group', 'standard_rate',
        'actual_qty', 'image', 'disabled', 'is_sales_item', 'creation', 'modified'],
      filters,
      limit: options.limit ?? 100,
      limit_start: options.page ? (options.page - 1) * (options.limit ?? 100) : 0,
    });

    return items.map(mapERPNextItem);
  }

  async getProduct(id: string): Promise<UnifiedProduct> {
    const item = await this.client.getDoc<ERPNextItem>('Item', id);
    return mapERPNextItem(item);
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    // Find or create customer
    let customerName: string;
    const existing = await this.findCustomerByPhone(input.customer.phone);
    if (existing) {
      customerName = existing.externalId;
    } else {
      const [firstName, ...lastParts] = (input.customer.name || 'Customer').split(' ');
      const newCustomer = await this.client.createDoc<ERPNextCustomer>('Customer', {
        customer_name: input.customer.name,
        customer_type: 'Individual',
        mobile_no: input.customer.phone,
        email_id: input.customer.email ?? '',
      });
      customerName = newCustomer.name;
    }

    const items = input.lineItems.map((li) => ({
      item_code: li.productId,
      qty: li.quantity,
      rate: li.price,
      delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }));

    const order = await this.client.createDoc<ERPNextSalesOrder>('Sales Order', {
      customer: customerName,
      transaction_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items,
      notes: input.notes ?? '',
    });

    const customer = existing ?? {
      id: customerName,
      externalId: customerName,
      platform: 'erpnext' as const,
      phone: input.customer.phone,
      email: input.customer.email,
      firstName: (input.customer.name || 'Customer').split(' ')[0] ?? '',
      lastName: (input.customer.name || '').split(' ').slice(1).join(' '),
      name: input.customer.name,
      tags: [],
      totalOrders: 0,
      totalSpent: 0,
      currency: 'USD',
      createdAt: new Date(),
    };

    return mapERPNextOrder(order, customer);
  }

  async getOrder(id: string): Promise<UnifiedOrder> {
    const order = await this.client.getDoc<ERPNextSalesOrder>('Sales Order', id);
    const customer = await this.findCustomerByExternalId(order.customer);
    return mapERPNextOrder(order, customer ?? {
      id: order.customer,
      externalId: order.customer,
      platform: 'erpnext',
      phone: '',
      firstName: order.customer_name.split(' ')[0] ?? '',
      lastName: order.customer_name.split(' ').slice(1).join(' '),
      name: order.customer_name,
      tags: [],
      totalOrders: 0,
      totalSpent: 0,
      currency: 'USD',
      createdAt: new Date(),
    });
  }

  async updateOrderStatus(id: string, status: string): Promise<UnifiedOrder> {
    if (status === 'cancelled') {
      await this.client.callMethod('frappe.client.cancel', { doctype: 'Sales Order', name: id });
    } else if (status === 'confirmed') {
      await this.client.callMethod('frappe.client.submit', { doctype: 'Sales Order', name: id });
    }
    return this.getOrder(id);
  }

  async getCustomer(id: string): Promise<UnifiedCustomer> {
    const customer = await this.client.getDoc<ERPNextCustomer>('Customer', id);
    return mapERPNextCustomer(customer);
  }

  private async findCustomerByExternalId(name: string): Promise<UnifiedCustomer | null> {
    try {
      return await this.getCustomer(name);
    } catch {
      return null;
    }
  }

  async findCustomerByPhone(phone: string): Promise<UnifiedCustomer | null> {
    const normalizedPhone = phone.replace(/\s/g, '');
    const customers = await this.client.getList<ERPNextCustomer>('Customer', {
      fields: ['name', 'customer_name', 'email_id', 'mobile_no', 'phone', 'customer_type',
        'customer_group', 'territory', 'creation', 'modified'],
      filters: [['mobile_no', '=', normalizedPhone]],
      limit: 1,
    });

    if (!customers.length) {
      const byPhone = await this.client.getList<ERPNextCustomer>('Customer', {
        fields: ['name', 'customer_name', 'email_id', 'mobile_no', 'phone', 'customer_type',
          'customer_group', 'territory', 'creation', 'modified'],
        filters: [['phone', '=', normalizedPhone]],
        limit: 1,
      });
      return byPhone[0] ? mapERPNextCustomer(byPhone[0]) : null;
    }

    return mapERPNextCustomer(customers[0]!);
  }

  async createCustomer(input: CreateCustomerInput): Promise<UnifiedCustomer> {
    const customer = await this.client.createDoc<ERPNextCustomer>('Customer', {
      customer_name: `${input.firstName} ${input.lastName}`.trim(),
      customer_type: 'Individual',
      mobile_no: input.phone,
      email_id: input.email ?? '',
    });
    return mapERPNextCustomer(customer);
  }

  async checkInventory(productId: string, _variantId?: string): Promise<UnifiedInventory> {
    const entries = await this.client.getList<{ item_code: string; actual_qty: number; warehouse: string }>('Bin', {
      fields: ['item_code', 'actual_qty', 'warehouse'],
      filters: [['item_code', '=', productId]],
    });

    const totalQty = entries.reduce((sum, e) => sum + e.actual_qty, 0);
    return {
      productId,
      sku: productId,
      quantity: Math.max(0, totalQty),
      available: Math.max(0, totalQty),
      warehouseName: entries[0]?.warehouse,
    };
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
    // ERPNext webhook handling via custom scripts
  }
}
