import crypto from 'crypto';
import {
  ConnectorConfig,
  ConnectorError,
  CreateCustomerInput,
  CreateOrderInput,
  GetProductsOptions,
  UnifiedCustomer,
  UnifiedInventory,
  UnifiedOrder,
  UnifiedProduct,
  UnifiedVariant,
  ProductImage,
  OrderLineItem,
} from '../../types';
import { BaseConnector } from '../../base-connector';
import { OdooClient, OdooCredentials } from './client';

// ─── Odoo Raw Types ───────────────────────────────────────────────────────────

interface OdooProduct {
  id: number;
  name: string;
  description_sale: string | false;
  default_code: string | false;
  list_price: number;
  standard_price: number;
  qty_available: number;
  virtual_available: number;
  type: string;
  categ_id: [number, string] | false;
  image_1920: string | false;
  active: boolean;
  sale_ok: boolean;
  product_variant_ids: number[];
  currency_id: [number, string];
  write_date: string;
  create_date: string;
}

interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false;
  country_id: [number, string] | false;
  zip: string | false;
}

interface OdooSaleOrder {
  id: number;
  name: string;
  state: string;
  partner_id: [number, string];
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency_id: [number, string];
  date_order: string;
  write_date: string;
  order_line: number[];
}

interface OdooOrderLine {
  id: number;
  product_id: [number, string];
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapOdooProduct(p: OdooProduct): UnifiedProduct {
  const images: ProductImage[] = p.image_1920
    ? [{ url: `data:image/png;base64,${p.image_1920}` }]
    : [];

  const status: 'active' | 'inactive' | 'draft' =
    p.active && p.sale_ok ? 'active' : 'inactive';

  return {
    id: String(p.id),
    externalId: String(p.id),
    platform: 'odoo',
    sku: p.default_code || String(p.id),
    name: p.name,
    description: p.description_sale || '',
    price: p.list_price,
    currency: p.currency_id ? p.currency_id[1] : 'USD',
    inventory: Math.max(0, p.qty_available),
    images,
    variants: [],
    categories: p.categ_id ? [p.categ_id[1]] : [],
    status,
    createdAt: new Date(p.create_date),
    updatedAt: new Date(p.write_date),
  };
}

function mapOdooPartner(p: OdooPartner): UnifiedCustomer {
  const phone = p.mobile || p.phone || '';
  return {
    id: String(p.id),
    externalId: String(p.id),
    platform: 'odoo',
    phone,
    email: p.email || undefined,
    firstName: p.name.split(' ')[0] ?? p.name,
    lastName: p.name.split(' ').slice(1).join(' '),
    name: p.name,
    tags: [],
    totalOrders: 0,
    totalSpent: 0,
    currency: 'USD',
    defaultAddress: p.street
      ? {
          firstName: p.name.split(' ')[0] ?? '',
          lastName: p.name.split(' ').slice(1).join(' '),
          address1: p.street,
          address2: p.street2 || undefined,
          city: p.city || '',
          state: p.state_id ? p.state_id[1] : '',
          zip: p.zip || '',
          country: p.country_id ? p.country_id[1] : '',
        }
      : undefined,
    createdAt: new Date(),
  };
}

// ─── Odoo Connector ───────────────────────────────────────────────────────────

export class OdooConnector extends BaseConnector {
  private readonly client: OdooClient;

  constructor(config: ConnectorConfig) {
    super(config);
    const creds = config.credentials as unknown as OdooCredentials;
    if (!creds.baseUrl || !creds.database || !creds.username || !creds.password) {
      throw new ConnectorError(
        'Odoo connector requires baseUrl, database, username, password',
        'INVALID_CONFIG',
        undefined,
        undefined,
        'odoo'
      );
    }
    this.client = new OdooClient(creds);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  async getProducts(options: GetProductsOptions = {}): Promise<UnifiedProduct[]> {
    const domain: unknown[][] = [['sale_ok', '=', true]];
    if (options.status === 'active') domain.push(['active', '=', true]);
    if (options.search) domain.push(['name', 'ilike', options.search]);

    const fields = [
      'id', 'name', 'description_sale', 'default_code', 'list_price', 'standard_price',
      'qty_available', 'virtual_available', 'type', 'categ_id', 'image_1920',
      'active', 'sale_ok', 'product_variant_ids', 'currency_id', 'write_date', 'create_date',
    ];

    const products = await this.client.searchRead<OdooProduct>(
      'product.template',
      domain,
      fields,
      { limit: options.limit ?? 100, offset: options.page ? (options.page - 1) * (options.limit ?? 100) : 0 }
    );

    return products.map(mapOdooProduct);
  }

  async getProduct(id: string): Promise<UnifiedProduct> {
    const products = await this.client.read<OdooProduct>('product.template', [parseInt(id, 10)], [
      'id', 'name', 'description_sale', 'default_code', 'list_price', 'qty_available',
      'categ_id', 'image_1920', 'active', 'sale_ok', 'currency_id', 'write_date', 'create_date',
    ]);
    if (!products[0]) throw new ConnectorError(`Product ${id} not found`, 'NOT_FOUND', 404, undefined, 'odoo');
    return mapOdooProduct(products[0]);
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    // Find or create partner
    let partnerId: number;
    const existingPartner = await this.findCustomerByPhone(input.customer.phone);
    if (existingPartner) {
      partnerId = parseInt(existingPartner.externalId, 10);
    } else {
      const [firstName, ...lastParts] = (input.customer.name || 'Customer').split(' ');
      partnerId = await this.client.create('res.partner', {
        name: input.customer.name,
        email: input.customer.email ?? false,
        mobile: input.customer.phone,
      });
    }

    // Build order lines
    const orderLines = input.lineItems.map((li) => [
      0, 0,
      {
        product_id: parseInt(li.productId, 10),
        product_uom_qty: li.quantity,
        price_unit: li.price,
      },
    ]);

    const orderId = await this.client.create('sale.order', {
      partner_id: partnerId,
      order_line: orderLines,
      note: input.notes ?? '',
    });

    return this.getOrder(String(orderId));
  }

  async getOrder(id: string): Promise<UnifiedOrder> {
    const orders = await this.client.read<OdooSaleOrder>('sale.order', [parseInt(id, 10)], [
      'id', 'name', 'state', 'partner_id', 'amount_untaxed', 'amount_tax',
      'amount_total', 'currency_id', 'date_order', 'write_date', 'order_line',
    ]);
    const o = orders[0];
    if (!o) throw new ConnectorError(`Order ${id} not found`, 'NOT_FOUND', 404, undefined, 'odoo');

    const lineIds = o.order_line;
    const lines = lineIds.length > 0
      ? await this.client.read<OdooOrderLine>('sale.order.line', lineIds, [
          'id', 'product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal',
        ])
      : [];

    const lineItems: OrderLineItem[] = lines.map((li) => ({
      id: String(li.id),
      productId: String(li.product_id[0]),
      sku: '',
      name: li.name,
      quantity: li.product_uom_qty,
      price: li.price_unit,
      total: li.price_subtotal,
    }));

    // Get partner
    const partners = await this.client.read<OdooPartner>('res.partner', [o.partner_id[0]], [
      'id', 'name', 'email', 'phone', 'mobile',
    ]);
    const partner = partners[0];
    const customer: UnifiedCustomer = partner ? mapOdooPartner(partner) : {
      id: String(o.partner_id[0]),
      externalId: String(o.partner_id[0]),
      platform: 'odoo',
      phone: '',
      firstName: o.partner_id[1].split(' ')[0] ?? '',
      lastName: o.partner_id[1].split(' ').slice(1).join(' '),
      name: o.partner_id[1],
      tags: [],
      totalOrders: 0,
      totalSpent: 0,
      currency: 'USD',
      createdAt: new Date(),
    };

    const statusMap: Record<string, 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled'> = {
      draft: 'pending',
      sent: 'pending',
      sale: 'confirmed',
      done: 'delivered',
      cancel: 'cancelled',
    };

    return {
      id: String(o.id),
      externalId: String(o.id),
      orderNumber: o.name,
      platform: 'odoo',
      customer,
      lineItems,
      subtotal: o.amount_untaxed,
      tax: o.amount_tax,
      shipping: 0,
      discount: 0,
      total: o.amount_total,
      currency: o.currency_id[1],
      status: statusMap[o.state] ?? 'pending',
      paymentStatus: o.state === 'done' ? 'paid' : 'pending',
      fulfillmentStatus: o.state === 'done' ? 'fulfilled' : 'unfulfilled',
      createdAt: new Date(o.date_order),
      updatedAt: new Date(o.write_date),
    };
  }

  async updateOrderStatus(id: string, status: string): Promise<UnifiedOrder> {
    if (status === 'confirmed') {
      await this.client.call('sale.order', 'action_confirm', [[parseInt(id, 10)]]);
    } else if (status === 'cancelled') {
      await this.client.call('sale.order', 'action_cancel', [[parseInt(id, 10)]]);
    }
    return this.getOrder(id);
  }

  async getCustomer(id: string): Promise<UnifiedCustomer> {
    const partners = await this.client.read<OdooPartner>('res.partner', [parseInt(id, 10)], [
      'id', 'name', 'email', 'phone', 'mobile', 'street', 'street2', 'city', 'state_id', 'country_id', 'zip',
    ]);
    if (!partners[0]) throw new ConnectorError(`Customer ${id} not found`, 'NOT_FOUND', 404, undefined, 'odoo');
    return mapOdooPartner(partners[0]);
  }

  async findCustomerByPhone(phone: string): Promise<UnifiedCustomer | null> {
    const normalizedPhone = phone.replace(/\s/g, '');
    const ids = await this.client.search('res.partner', [
      '|',
      ['mobile', '=', normalizedPhone],
      ['phone', '=', normalizedPhone],
    ]);
    if (!ids.length) return null;
    return this.getCustomer(String(ids[0]));
  }

  async createCustomer(input: CreateCustomerInput): Promise<UnifiedCustomer> {
    const id = await this.client.create('res.partner', {
      name: `${input.firstName} ${input.lastName}`.trim(),
      email: input.email ?? false,
      mobile: input.phone,
      street: input.address?.address1 ?? false,
      city: input.address?.city ?? false,
      zip: input.address?.zip ?? false,
    });
    return this.getCustomer(String(id));
  }

  async checkInventory(productId: string, variantId?: string): Promise<UnifiedInventory> {
    const model = variantId ? 'product.product' : 'product.template';
    const recordId = parseInt(variantId ?? productId, 10);
    const records = await this.client.read<{ id: number; default_code: string | false; qty_available: number }>(
      model,
      [recordId],
      ['id', 'default_code', 'qty_available']
    );
    const record = records[0];
    return {
      productId,
      variantId,
      sku: record?.default_code || String(recordId),
      quantity: record?.qty_available ?? 0,
      available: record?.qty_available ?? 0,
    };
  }

  verifyWebhook(_payload: Buffer, _signature: string): boolean {
    // Odoo doesn't have built-in webhook signing; implement custom if needed
    return true;
  }

  async handleWebhook(_event: string, _payload: unknown): Promise<void> {
    // Odoo pushes are typically handled via Odoo's action server or custom modules
  }
}
