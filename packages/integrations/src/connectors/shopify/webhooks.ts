import { AxiosInstance } from 'axios';
import { verifyWebhookHmac } from './auth';
import { mapShopifyOrder, ShopifyOrder } from './orders';
import { mapShopifyProduct } from './products';

export type WebhookTopic =
  | 'orders/create'
  | 'orders/updated'
  | 'orders/cancelled'
  | 'orders/fulfilled'
  | 'orders/paid'
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'inventory_levels/update'
  | 'customers/create'
  | 'customers/update';

export interface ShopifyWebhook {
  id: number;
  address: string;
  topic: WebhookTopic;
  format: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEventHandler {
  onOrderCreated?: (order: ReturnType<typeof mapShopifyOrder>) => Promise<void>;
  onOrderUpdated?: (order: ReturnType<typeof mapShopifyOrder>) => Promise<void>;
  onOrderCancelled?: (order: ReturnType<typeof mapShopifyOrder>) => Promise<void>;
  onProductUpdated?: (product: ReturnType<typeof mapShopifyProduct>) => Promise<void>;
  onProductDeleted?: (productId: string) => Promise<void>;
  onInventoryUpdated?: (data: { inventory_item_id: number; location_id: number; available: number }) => Promise<void>;
}

export class ShopifyWebhooksClient {
  private handlers: WebhookEventHandler = {};

  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string,
    private readonly apiVersion: string,
    private readonly webhookSecret: string
  ) {}

  setHandlers(handlers: WebhookEventHandler): void {
    this.handlers = handlers;
  }

  verifyWebhook(payload: Buffer, signature: string): boolean {
    return verifyWebhookHmac(payload, signature, this.webhookSecret);
  }

  async handleWebhook(topic: string, payload: unknown): Promise<void> {
    switch (topic as WebhookTopic) {
      case 'orders/create':
        if (this.handlers.onOrderCreated) {
          await this.handlers.onOrderCreated(mapShopifyOrder(payload as ShopifyOrder));
        }
        break;

      case 'orders/updated':
      case 'orders/paid':
      case 'orders/fulfilled':
        if (this.handlers.onOrderUpdated) {
          await this.handlers.onOrderUpdated(mapShopifyOrder(payload as ShopifyOrder));
        }
        break;

      case 'orders/cancelled':
        if (this.handlers.onOrderCancelled) {
          await this.handlers.onOrderCancelled(mapShopifyOrder(payload as ShopifyOrder));
        }
        break;

      case 'products/create':
      case 'products/update':
        if (this.handlers.onProductUpdated) {
          const p = payload as Parameters<typeof mapShopifyProduct>[0];
          await this.handlers.onProductUpdated(mapShopifyProduct(p));
        }
        break;

      case 'products/delete':
        if (this.handlers.onProductDeleted) {
          const data = payload as { id: number };
          await this.handlers.onProductDeleted(String(data.id));
        }
        break;

      case 'inventory_levels/update':
        if (this.handlers.onInventoryUpdated) {
          const data = payload as { inventory_item_id: number; location_id: number; available: number };
          await this.handlers.onInventoryUpdated(data);
        }
        break;

      default:
        // Unknown topic — ignore
        break;
    }
  }

  async registerWebhook(topic: WebhookTopic, callbackUrl: string): Promise<ShopifyWebhook> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/webhooks.json`;
    const response = await this.http.post<{ webhook: ShopifyWebhook }>(url, {
      webhook: { topic, address: callbackUrl, format: 'json' },
    });
    return response.data.webhook;
  }

  async listWebhooks(): Promise<ShopifyWebhook[]> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/webhooks.json`;
    const response = await this.http.get<{ webhooks: ShopifyWebhook[] }>(url);
    return response.data.webhooks;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/webhooks/${webhookId}.json`;
    await this.http.delete(url);
  }

  async registerAllWebhooks(callbackBaseUrl: string): Promise<ShopifyWebhook[]> {
    const topics: WebhookTopic[] = [
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'orders/fulfilled',
      'orders/paid',
      'products/create',
      'products/update',
      'products/delete',
      'inventory_levels/update',
      'customers/create',
      'customers/update',
    ];

    const results: ShopifyWebhook[] = [];
    for (const topic of topics) {
      const callbackUrl = `${callbackBaseUrl}/api/v1/webhooks/shopify?topic=${encodeURIComponent(topic)}`;
      try {
        const wh = await this.registerWebhook(topic, callbackUrl);
        results.push(wh);
      } catch {
        // Webhook may already exist — continue
      }
    }
    return results;
  }
}
