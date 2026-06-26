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
import { ShopifyProductsClient } from './products';
import { ShopifyOrdersClient } from './orders';
import { ShopifyCustomersClient } from './customers';
import { ShopifyWebhooksClient } from './webhooks';

interface ShopifyCredentials {
  shopDomain: string;   // e.g. "my-store.myshopify.com"
  accessToken: string;  // shpat_xxx
  apiVersion?: string;  // default: 2024-01
  webhookSecret?: string;
}

export class ShopifyConnector extends BaseConnector {
  private readonly shopDomain: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;

  readonly products: ShopifyProductsClient;
  readonly orders: ShopifyOrdersClient;
  readonly customers: ShopifyCustomersClient;
  readonly webhooks: ShopifyWebhooksClient;

  constructor(config: ConnectorConfig) {
    super(config);

    const creds = config.credentials as unknown as ShopifyCredentials;
    if (!creds.shopDomain || !creds.accessToken) {
      throw new ConnectorError(
        'Shopify connector requires shopDomain and accessToken',
        'INVALID_CONFIG',
        undefined,
        undefined,
        'shopify'
      );
    }

    this.shopDomain = creds.shopDomain;
    this.apiVersion = creds.apiVersion ?? '2024-01';
    this.baseUrl = `https://${this.shopDomain}`;

    // Set auth header on the shared http instance
    this.http.defaults.headers.common['X-Shopify-Access-Token'] = creds.accessToken;

    this.products = new ShopifyProductsClient(this.http, this.baseUrl, this.apiVersion);
    this.orders = new ShopifyOrdersClient(this.http, this.baseUrl, this.apiVersion);
    this.customers = new ShopifyCustomersClient(this.http, this.baseUrl, this.apiVersion);
    this.webhooks = new ShopifyWebhooksClient(
      this.http,
      this.baseUrl,
      this.apiVersion,
      config.webhookSecret ?? creds.webhookSecret ?? ''
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.get<{ shop: { id: number } }>(
        `${this.baseUrl}/admin/api/${this.apiVersion}/shop.json`
      );
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
      const variant = product.variants.find((v) => v.id === variantId || v.externalId === variantId);
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
