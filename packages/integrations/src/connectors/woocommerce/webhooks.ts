import crypto from 'crypto';
import { mapWCOrder, WCOrder } from './orders';
import { mapWCProduct, WCProduct } from './products';
import { mapWCCustomer, WCCustomer } from './customers';

export interface WCWebhookHandlers {
  onOrderCreated?: (order: ReturnType<typeof mapWCOrder>) => Promise<void>;
  onOrderUpdated?: (order: ReturnType<typeof mapWCOrder>) => Promise<void>;
  onOrderDeleted?: (orderId: string) => Promise<void>;
  onProductCreated?: (product: ReturnType<typeof mapWCProduct>) => Promise<void>;
  onProductUpdated?: (product: ReturnType<typeof mapWCProduct>) => Promise<void>;
  onProductDeleted?: (productId: string) => Promise<void>;
  onCustomerCreated?: (customer: ReturnType<typeof mapWCCustomer>) => Promise<void>;
  onCustomerUpdated?: (customer: ReturnType<typeof mapWCCustomer>) => Promise<void>;
}

export class WooCommerceWebhooksClient {
  private handlers: WCWebhookHandlers = {};

  constructor(private readonly webhookSecret: string) {}

  setHandlers(handlers: WCWebhookHandlers): void {
    this.handlers = handlers;
  }

  /**
   * WooCommerce uses HMAC-SHA256 with base64 encoding of the raw body
   * Header: X-WC-Webhook-Signature
   */
  verifyWebhook(payload: Buffer, signature: string): boolean {
    const digest = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');
    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async handleWebhook(topic: string, payload: unknown): Promise<void> {
    // WC webhook topics: resource.event e.g. "order.created", "product.updated"
    const [resource, event] = topic.split('.');

    switch (`${resource}.${event}`) {
      case 'order.created':
        if (this.handlers.onOrderCreated) {
          await this.handlers.onOrderCreated(mapWCOrder(payload as WCOrder));
        }
        break;

      case 'order.updated':
        if (this.handlers.onOrderUpdated) {
          await this.handlers.onOrderUpdated(mapWCOrder(payload as WCOrder));
        }
        break;

      case 'order.deleted':
        if (this.handlers.onOrderDeleted) {
          const data = payload as { id: number };
          await this.handlers.onOrderDeleted(String(data.id));
        }
        break;

      case 'product.created':
        if (this.handlers.onProductCreated) {
          await this.handlers.onProductCreated(mapWCProduct(payload as WCProduct));
        }
        break;

      case 'product.updated':
        if (this.handlers.onProductUpdated) {
          await this.handlers.onProductUpdated(mapWCProduct(payload as WCProduct));
        }
        break;

      case 'product.deleted':
        if (this.handlers.onProductDeleted) {
          const data = payload as { id: number };
          await this.handlers.onProductDeleted(String(data.id));
        }
        break;

      case 'customer.created':
        if (this.handlers.onCustomerCreated) {
          await this.handlers.onCustomerCreated(mapWCCustomer(payload as WCCustomer));
        }
        break;

      case 'customer.updated':
        if (this.handlers.onCustomerUpdated) {
          await this.handlers.onCustomerUpdated(mapWCCustomer(payload as WCCustomer));
        }
        break;

      default:
        break;
    }
  }
}
