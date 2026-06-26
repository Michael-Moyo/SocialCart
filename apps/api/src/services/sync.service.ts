import { IntegrationType } from '@prisma/client';
import { integrationManager, PlatformType, UnifiedProduct, UnifiedOrder, UnifiedCustomer } from '@socialcart/integrations';
import prisma from '../lib/prisma';

export const syncService = {
  async syncProducts(tenantId: string, platform: PlatformType): Promise<{ created: number; updated: number; failed: number }> {
    const connector = integrationManager.getConnector(tenantId, platform);
    const products = await connector.getProducts({ status: 'all', limit: 250 });

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const existing = await prisma.product.findUnique({
          where: {
            tenantId_source_externalId: {
              tenantId,
              source: platform as IntegrationType,
              externalId: product.externalId,
            },
          },
        });

        const data = {
          tenantId,
          externalId: product.externalId,
          source: platform as IntegrationType,
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice ?? null,
          currency: product.currency,
          inventory: product.inventory,
          images: product.images,
          variants: product.variants,
          categories: product.categories,
          tags: product.tags ?? [],
          status: product.status as 'active' | 'inactive' | 'draft',
          syncedAt: new Date(),
        };

        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.product.create({ data });
          created++;
        }
      } catch {
        failed++;
      }
    }

    return { created, updated, failed };
  },

  async syncOrders(tenantId: string, platform: PlatformType): Promise<{ created: number; updated: number; failed: number }> {
    const connector = integrationManager.getConnector(tenantId, platform);

    // Access platform-specific order list
    let orders: UnifiedOrder[] = [];
    if (platform === 'shopify') {
      const shopifyConnector = connector as import('@socialcart/integrations').ShopifyConnector;
      orders = await shopifyConnector.orders.listOrders({ limit: 100 });
    } else if (platform === 'woocommerce') {
      const wcConnector = connector as import('@socialcart/integrations').WooCommerceConnector;
      orders = await wcConnector.orders.listOrders({ limit: 100 });
    }
    // Odoo/ERPNext/RetailMan would need similar cast patterns

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        // Ensure customer exists
        const customer = await prisma.customer.upsert({
          where: { tenantId_phone: { tenantId, phone: order.customer.phone || 'unknown' } },
          create: {
            tenantId,
            phone: order.customer.phone || 'unknown',
            name: order.customer.name,
            firstName: order.customer.firstName,
            lastName: order.customer.lastName,
            email: order.customer.email,
            externalId: order.customer.externalId,
            platform: platform as IntegrationType,
          },
          update: {
            name: order.customer.name,
            email: order.customer.email,
          },
        });

        const existing = order.externalId
          ? await prisma.order.findFirst({ where: { tenantId, externalId: order.externalId } })
          : null;

        const orderData = {
          tenantId,
          externalId: order.externalId,
          customerId: customer.id,
          source: platform as IntegrationType,
          status: order.status as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded',
          paymentStatus: order.paymentStatus as 'pending' | 'paid' | 'partial' | 'refunded' | 'failed',
          fulfillmentStatus: order.fulfillmentStatus as 'unfulfilled' | 'partial' | 'fulfilled',
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          discount: order.discount,
          total: order.total,
          currency: order.currency,
          items: order.lineItems,
          shippingAddress: order.shippingAddress ?? null,
          notes: order.notes,
        };

        if (existing) {
          await prisma.order.update({ where: { id: existing.id }, data: orderData });
          updated++;
        } else {
          await prisma.order.create({ data: orderData });
          created++;
        }
      } catch {
        failed++;
      }
    }

    return { created, updated, failed };
  },

  async syncCustomers(tenantId: string, platform: PlatformType): Promise<{ created: number; updated: number; failed: number }> {
    const connector = integrationManager.getConnector(tenantId, platform);
    let customers: UnifiedCustomer[] = [];

    if (platform === 'shopify') {
      const shopifyConnector = connector as import('@socialcart/integrations').ShopifyConnector;
      customers = await shopifyConnector.customers.listCustomers({ limit: 250 });
    } else if (platform === 'woocommerce') {
      // WooCommerce doesn't expose a list method in our client yet; skip
    }

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const customer of customers) {
      if (!customer.phone) continue;
      try {
        await prisma.customer.upsert({
          where: { tenantId_phone: { tenantId, phone: customer.phone } },
          create: {
            tenantId,
            phone: customer.phone,
            name: customer.name,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            tags: customer.tags,
            totalOrders: customer.totalOrders,
            totalSpent: customer.totalSpent,
            externalId: customer.externalId,
            platform: platform as IntegrationType,
            defaultAddress: customer.defaultAddress ?? null,
          },
          update: {
            name: customer.name,
            email: customer.email,
            totalOrders: customer.totalOrders,
            totalSpent: customer.totalSpent,
            tags: customer.tags,
          },
        }).then(() => created++);
      } catch {
        failed++;
      }
    }

    return { created, updated, failed };
  },
};
