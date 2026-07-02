import {
  FlowEngine,
  FlowContext,
  CartItem,
  mainMenuFlow,
  browseFlow,
  cartFlow,
  checkoutFlow,
  orderStatusFlow,
  cartRecoveryFlow,
} from '@socialcart/flow-engine';
import { WhatsAppClient } from '@socialcart/whatsapp';
import prisma from '../lib/prisma';
import { notificationService } from './notification.service';
import { cartRecoveryService } from './cart-recovery.service';
import { pushToTenant } from '../routes/sse';
import type { NotificationType } from '@prisma/client';

function buildEngine(): FlowEngine {
  const engine = new FlowEngine();
  engine.register(mainMenuFlow);
  engine.register(browseFlow);
  engine.register(cartFlow);
  engine.register(checkoutFlow);
  engine.register(orderStatusFlow);
  engine.register(cartRecoveryFlow);
  return engine;
}

export const engine = buildEngine();

export async function getWhatsAppClient(tenantId: string): Promise<WhatsAppClient> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappPhoneNumberId: true, settings: true },
  });
  const s = (tenant?.settings ?? {}) as Record<string, unknown>;
  let accessToken = process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';
  if (s['waAccessTokenEnc']) {
    try {
      const { decrypt } = await import('../lib/encryption');
      accessToken = decrypt(s['waAccessTokenEnc'] as string);
    } catch {}
  }
  return new WhatsAppClient({
    accessToken,
    phoneNumberId: tenant?.whatsappPhoneNumberId ?? process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
  });
}

function emptyContext(
  tenantId: string,
  phone: string,
  conversationId: string,
  customerId?: string,
  customerName?: string
): FlowContext {
  return {
    tenantId,
    phone,
    conversationId,
    customerId,
    customerName,
    currentFlow: null,
    currentStep: null,
    cart: [],
    data: {},
  };
}

const LOW_STOCK_THRESHOLD = 5;

async function handleCreateOrderAction(
  tenantId: string,
  conversationId: string,
  customerId: string,
  action: Extract<import('@socialcart/flow-engine').FlowAction, { type: 'create_order' }>
): Promise<void> {
  try {
    const total = action.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const currency = action.currency ?? action.items.find((i) => i.currency)?.currency ?? 'NGN';

    const order = await prisma.order.create({
      data: {
        tenantId,
        customerId,
        source: null,
        status: 'pending',
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        subtotal: total,
        tax: 0,
        shipping: 0,
        discount: 0,
        total,
        currency,
        items: action.items,
        shippingAddress: action.shippingAddress ?? null,
        notes: action.notes ?? null,
      },
    });

    // SSE push so dashboard shows new order
    pushToTenant(tenantId, 'order:created', { orderId: order.id, total, currency: 'NGN' });

    // Mark any previously-abandoned carts for this customer as recovered
    void cartRecoveryService.markRecovered(tenantId, customerId);

    // Decrement inventory for each item and check for low stock
    for (const item of action.items) {
      const product = await prisma.product.findFirst({
        where: { tenantId, sku: item.sku },
        select: { id: true, inventory: true, name: true },
      });
      if (!product) continue;

      const newInventory = Math.max(0, product.inventory - item.quantity);
      await prisma.product.update({ where: { id: product.id }, data: { inventory: newInventory } });

      if (product.inventory > LOW_STOCK_THRESHOLD && newInventory <= LOW_STOCK_THRESHOLD) {
        void notificationService.dispatch({
          tenantId,
          type: 'LOW_STOCK' as NotificationType,
          title: 'Low Stock Alert',
          body: `${product.name} is low on stock — only ${newInventory} left`,
          data: { productId: product.id, productName: product.name, inventory: newInventory },
          channels: ['IN_APP', 'PUSH'],
        });
      }
    }

    // Award loyalty points (1 point per NGN 100 spent)
    const pointsToAward = Math.floor(total / 100);
    if (pointsToAward > 0) {
      try {
        const existing = await prisma.loyaltyAccount.findFirst({ where: { customerId, tenantId } });
        const newPoints = (existing?.points ?? 0) + pointsToAward;
        const newTier = newPoints >= 5000 ? 'PLATINUM' : newPoints >= 2000 ? 'GOLD' : newPoints >= 500 ? 'SILVER' : 'BRONZE';
        const historyEntry = {
          date: new Date().toISOString(),
          type: 'award',
          points: pointsToAward,
          reason: `Order ${order.id.slice(0, 8).toUpperCase()} via WhatsApp`,
          balance: newPoints,
        };
        const history = [...((existing?.history as unknown[]) ?? []), historyEntry];
        if (existing) {
          const updated = await prisma.loyaltyAccount.update({
            where: { id: existing.id },
            data: { points: newPoints, tier: newTier as never, history },
          });
          if (updated.tier !== existing.tier) {
            void notificationService.notifyLoyaltyTierUp(tenantId, undefined, (await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } }))?.name ?? 'Customer', updated.tier);
          }
        } else {
          await prisma.loyaltyAccount.create({
            data: { customerId, tenantId, points: newPoints, tier: newTier as never, history },
          });
        }
      } catch (loyaltyErr) {
        console.error('[loyalty award]', loyaltyErr);
      }
    }

    // Notify owner of new WhatsApp order
    void notificationService.notifyNewOrder(tenantId, order.id.slice(0, 8).toUpperCase(), `NGN ${total.toFixed(2)}`);
  } catch (err) {
    console.error('[createOrder action]', err);
  }
}

export const conversationService = {
  async handleIncoming(
    tenantId: string,
    phone: string,
    message: string,
    waMessageId?: string
  ): Promise<{ id: string; assignedMemberId: string | null } | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    });
    const tenantSettings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const disabledFlows = (tenantSettings['disabledFlows'] as string[] | undefined) ?? [];
    const storeName = tenant?.name ?? 'SocialCart';
    const storeCurrency = (tenantSettings['currency'] as string | undefined) ?? 'NGN';

    let customer = await prisma.customer.findFirst({
      where: { tenantId, phone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { tenantId, phone, name: phone },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, waNumber: phone, status: { not: 'RESOLVED' } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          waNumber: phone,
          customerId: customer.id,
          status: 'OPEN',
          context: {},
        },
      });
    }

    const storedContext = conversation.context as Partial<FlowContext> | null;

    const ctx: FlowContext = {
      ...emptyContext(tenantId, phone, conversation.id, customer.id, customer.name ?? undefined),
      ...(storedContext ?? {}),
      tenantId,
      phone,
      conversationId: conversation.id,
      customerId: customer.id,
      customerName: customer.name ?? undefined,
      data: {
        ...(storedContext?.data ?? {}),
        disabledFlows,
        storeName,
        storeCurrency,
        // Bank transfer details from tenant settings
        bankName: (tenantSettings['bankName'] as string | undefined) ?? '',
        accountNumber: (tenantSettings['accountNumber'] as string | undefined) ?? '',
        accountName: (tenantSettings['accountName'] as string | undefined) ?? '',
        // Injected data-access callbacks — not persisted to DB
        fetchProducts: async (query: string, tid: string) => {
          const where = {
            tenantId: tid,
            status: 'active' as const,
            inventory: { gt: 0 },
            ...(query && query !== 'browse_all'
              ? {
                  OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { description: { contains: query, mode: 'insensitive' as const } },
                    { categories: { has: query } },
                  ],
                }
              : {}),
          };
          const products = await prisma.product.findMany({
            where,
            take: 10,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, sku: true, price: true, currency: true, inventory: true, description: true, images: true, categories: true },
          });
          return products.map((p) => ({
            productId: p.id,
            sku: p.sku,
            name: p.name,
            price: Number(p.price),
            currency: p.currency,
            inventory: p.inventory,
            description: p.description ?? undefined,
            imageUrl: ((p.images as Array<{ url: string }> | null)?.[0]?.url) ?? undefined,
            categories: p.categories as string[] | undefined,
          }));
        },
        fetchOrders: async (query: string, tid: string, customerPhone: string) => {
          const customerRecord = await prisma.customer.findFirst({ where: { tenantId: tid, phone: customerPhone } });
          if (!customerRecord) return [];

          const isOrderRef = /^[A-Z0-9]{6,12}$/i.test(query.trim());
          const orders = await prisma.order.findMany({
            where: {
              tenantId: tid,
              customerId: customerRecord.id,
              ...(query && isOrderRef
                ? {
                    OR: [
                      { externalId: { contains: query, mode: 'insensitive' as const } },
                      { id: { startsWith: query.toLowerCase() } },
                    ],
                  }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true, externalId: true, status: true, paymentStatus: true,
              fulfillmentStatus: true, total: true, currency: true,
              createdAt: true, shippingAddress: true, items: true,
            },
          });
          return orders.map((o) => ({
            ...o,
            total: String(o.total),
            shippingAddress: o.shippingAddress as Record<string, unknown> | null,
            items: (o.items as Array<{ name: string; qty?: number; quantity?: number; price: number }>) ?? [],
            createdAt: o.createdAt.toISOString(),
          }));
        },
      },
    };

    const { actions, newCtx } = await engine.process(message, ctx);

    const client = await getWhatsAppClient(tenantId);

    for (const action of actions) {
      if (action.type === 'send_text') {
        await client.sendTextMessage(phone, action.text);
      } else if (action.type === 'send_list') {
        await client.sendInteractiveList(
          phone,
          action.header,
          action.body,
          action.footer,
          action.button,
          action.sections
        );
      } else if (action.type === 'send_buttons') {
        await client.sendInteractiveButtons(
          phone,
          action.body,
          action.buttons,
          action.header,
          action.footer
        );
      } else if (action.type === 'create_order') {
        void handleCreateOrderAction(tenantId, conversation.id, customer.id, action);
      } else if (action.type === 'request_human_agent') {
        // Flag conversation as needing human attention
        void (async () => {
          try {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { status: 'OPEN' }, // keep open, team can see unread state
            });
            void notificationService.dispatch({
              tenantId,
              type: 'AGENT_REQUEST' as import('@prisma/client').NotificationType,
              title: 'Agent requested',
              body: `${customer.name ?? phone} is asking for a human agent`,
              data: { conversationId: conversation.id, phone, customerId: customer.id },
              channels: ['IN_APP', 'PUSH'],
            });
            pushToTenant(tenantId, 'conversation:agent_request', { conversationId: conversation.id, phone, customerName: customer.name });
          } catch (e) {
            console.error('[agent request]', e);
          }
        })();
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { context: newCtx as object },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        type: 'text',
        content: { text: message },
        waMessageId: waMessageId ?? null,
        sentAt: new Date(),
        status: 'DELIVERED',
      },
    });

    return { id: conversation.id, assignedMemberId: conversation.assignedMemberId };
  },

  async triggerCartRecovery(
    tenantId: string,
    customerId: string,
    phone: string,
    cartItems: CartItem[]
  ): Promise<void> {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, waNumber: phone, status: { not: 'RESOLVED' } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          waNumber: phone,
          customerId,
          status: 'OPEN',
          context: {},
        },
      });
    }

    const ctx: FlowContext = {
      ...emptyContext(tenantId, phone, conversation.id, customerId, customer?.name ?? undefined),
      cart: cartItems,
    };

    const { actions, newCtx } = await engine.startFlow('cart-recovery', ctx);

    const client = await getWhatsAppClient(tenantId);

    for (const action of actions) {
      if (action.type === 'send_text') {
        await client.sendTextMessage(phone, action.text);
      } else if (action.type === 'send_list') {
        await client.sendInteractiveList(
          phone,
          action.header,
          action.body,
          action.footer,
          action.button,
          action.sections
        );
      } else if (action.type === 'send_buttons') {
        await client.sendInteractiveButtons(
          phone,
          action.body,
          action.buttons,
          action.header,
          action.footer
        );
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { context: newCtx as object },
    });
  },
};


