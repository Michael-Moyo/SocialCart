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
} from '../../types';
import { BaseConnector } from '../../base-connector';
import { WooCommerceProductsClient } from './products';
import { WooCommerceOrdersClient } from './orders';
import { WooCommerceCustomersClient } from './customers';
import { WooCommerceWebhooksClient } from './webhooks';

interface WooCommerceCredentials {
  baseUrl: string;           // e.g. "https://my-store.com"
  consumerKey: string;       // ck_xxx
  consumerSecret: string;    // cs_xxx
  webhookSecret?: string;
}

export class WooCommerceConnector extends BaseConnector {
  private readonly wcBaseUrl: string;

  readonly products: WooCommerceProductsClient;
  readonly orders: WooCommerceOrdersClient;
  readonly customers: WooCommerceCustomersClient;
  readonly webhooks: WooCommerceWebhooksClient;

  constructor(config: ConnectorConfig) {
    super(config);

    const creds = config.credentials as unknown as WooCommerceCredentials;
    if (!creds.baseUrl || !creds.consumerKey || !creds.consumerSecret) {
      throw new ConnectorError(
        'WooCommerce connector requires baseUrl, consumerKey and consumerSecret',
        'INVALID_CONFIG',
        undefined,
        undefined,
        'woocommerce'
      );
    }

    this.wcBaseUrl = creds.baseUrl.replace(/\/$/, '');

    // WooCommerce uses HTTP Basic auth with consumer key/secret
    this.http.defaults.auth = {
      username: creds.consumerKey,
      password: creds.consumerSecret,
    };

    this.products = new WooCommerceProductsClient(this.http, this.wcBaseUrl);
    this.orders = new WooCommerceOrdersClient(this.http, this.wcBaseUrl);
    this.customers = new WooCommerceCustomersClient(this.http, this.wcBaseUrl);
    this.webhooks = new WooCommerceWebhooksClient(config.webhookSecret ?? creds.webhookSecret ?? '');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.get<unknown>(`${this.wcBaseUrl}/wp-json/wc/v3`);
      return true;
    } catch {
      return false;
    }
  }

  async getProducts(options?: GetProductsOptions): Promise<UnifiedProduct[]> {
    return this.products.listProducts(options);
  }

  async getProduct(id: string): Promise<UnifiedProduct> {
    return this.products.getProduct(id);
  }

  async createOrder(order: CreateOrderInput): Promise<UnifiedOrder> {
    return this.orders.createOrder(order);
  }

  async getOrder(id: string): Promise<UnifiedOrder> {
    return this.orders.getOrder(id);
  }

  async updateOrderStatus(id: string, status: string): Promise<UnifiedOrder> {
    return this.orders.updateOrderStatus(id, status);
  }

  async getCustomer(id: string): Promise<UnifiedCustomer> {
    return this.customers.getCustomer(id);
  }

  async findCustomerByPhone(phone: string): Promise<UnifiedCustomer | null> {
    return this.customers.findByPhone(phone);
  }

  async createCustomer(customer: CreateCustomerInput): Promise<UnifiedCustomer> {
    return this.customers.createCustomer(customer);
  }

  async checkInventory(productId: string, variantId?: string): Promise<UnifiedInventory> {
    const product = await this.getProduct(productId);
    if (variantId) {
      const variant = product.variants.find((v) => v.id === variantId);
      return {
        productId,
        variantId,
        sku: variant?.sku ?? '',
        quantity: variant?.inventory ?? 0,
        available: variant?.inventory ?? 0,
      };
    }
    return {
      productId,
      sku: product.sku,
      quantity: product.inventory,
      available: product.inventory,
    };
  }

  verifyWebhook(payload: Buffer, signature: string): boolean {
    return this.webhooks.verifyWebhook(payload, signature);
  }

  async handleWebhook(event: string, payload: unknown): Promise<void> {
    return this.webhooks.handleWebhook(event, payload);
  }
}
