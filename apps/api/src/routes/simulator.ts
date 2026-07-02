/**
 * Simulator endpoint — processes a customer message through the flow engine
 * and returns the bot's reply synchronously. Used by the PWA store demo UI.
 *
 * POST /api/v1/simulator/message
 *   { tenantId, phone, message }
 *   → { success: true, reply: { text, buttons?, listRows? } }
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import type { FlowContext, FlowAction } from '@socialcart/flow-engine';
import { engine } from '../services/conversation.service';

const router = Router();

function emptyCtx(tenantId: string, phone: string, conversationId: string): FlowContext {
  return {
    tenantId, phone, conversationId,
    currentFlow: null, currentStep: null,
    cart: [], data: {},
  };
}

type ReplyMessage = {
  text: string;
  buttons?: Array<{ id: string; title: string }>;
  listRows?: Array<{ id: string; title: string; description?: string }>;
};

function actionsToReplies(actions: FlowAction[]): ReplyMessage[] {
  const replies: ReplyMessage[] = [];

  for (const action of actions) {
    if (action.type === 'send_text') {
      replies.push({ text: action.text });
    } else if (action.type === 'send_buttons') {
      replies.push({ text: action.body, buttons: action.buttons });
    } else if (action.type === 'send_list') {
      replies.push({ text: action.body, listRows: action.sections.flatMap((s) => s.rows) });
    }
  }

  return replies;
}

const messageSchema = z.object({
  tenantId: z.string().min(1),
  phone: z.string().min(7),
  message: z.string().min(1),
});

router.get('/history', async (req: Request, res: Response) => {
  const { tenantId, phone } = req.query as { tenantId?: string; phone?: string };
  if (!tenantId || !phone) { res.json({ success: true, messages: [] }); return; }
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { tenantId, waNumber: phone, status: { not: 'RESOLVED' } },
    });
    if (!conversation) { res.json({ success: true, messages: [] }); return; }
    const msgs = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, direction: true, type: true, content: true, sentAt: true, createdAt: true },
    });
    res.json({ success: true, messages: msgs });
  } catch {
    res.json({ success: true, messages: [] });
  }
});

router.post('/message', validate(messageSchema), async (req: Request, res: Response) => {
  try {
    const { tenantId, phone, message } = req.body as z.infer<typeof messageSchema>;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Store not found' });
      return;
    }

    // Upsert customer
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      create: { tenantId, phone, name: 'Web Visitor' },
      update: {},
    });

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, waNumber: phone, status: { not: 'RESOLVED' } },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { tenantId, waNumber: phone, customerId: customer.id, status: 'OPEN', context: {} },
      });
    }

    const storedCtx = (conversation.context ?? {}) as Partial<FlowContext>;
    const ctx: FlowContext = {
      ...emptyCtx(tenantId, phone, conversation.id),
      ...storedCtx,
      tenantId, phone, conversationId: conversation.id,
      customerId: customer.id,
      customerName: customer.name ?? undefined,
      data: {
        ...(storedCtx.data ?? {}),
        fetchProducts: async (query: string, tid: string) => {
          const where = {
            tenantId: tid,
            status: 'active' as const,
            inventory: { gt: 0 },
            ...(query && query !== 'browse_all'
              ? { OR: [
                  { name: { contains: query, mode: 'insensitive' as const } },
                  { description: { contains: query, mode: 'insensitive' as const } },
                ] }
              : {}),
          };
          const products = await prisma.product.findMany({
            where, take: 10, orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, sku: true, price: true, currency: true, inventory: true, description: true, images: true },
          });
          return products.map((p) => ({
            productId: p.id, sku: p.sku, name: p.name,
            price: Number(p.price), currency: p.currency, inventory: p.inventory,
            description: p.description ?? undefined,
            imageUrl: ((p.images as Array<{ url: string }> | null)?.[0]?.url) ?? undefined,
          }));
        },
        fetchOrders: async (query: string, tid: string, customerPhone: string) => {
          const c = await prisma.customer.findFirst({ where: { tenantId: tid, phone: customerPhone } });
          if (!c) return [];
          const orders = await prisma.order.findMany({
            where: { tenantId: tid, customerId: c.id },
            orderBy: { createdAt: 'desc' }, take: 5,
            select: { id: true, externalId: true, status: true, paymentStatus: true, fulfillmentStatus: true, total: true, currency: true, createdAt: true, shippingAddress: true, items: true },
          });
          return orders.map((o) => ({
            ...o, total: String(o.total),
            shippingAddress: o.shippingAddress as Record<string, unknown> | null,
            items: (o.items as Array<{ name: string; price: number }>) ?? [],
            createdAt: o.createdAt.toISOString(),
          }));
        },
      },
    };

    const { actions, newCtx } = await engine.process(message, ctx);

    // Persist updated context
    await prisma.conversation.update({ where: { id: conversation.id }, data: { context: newCtx as object } });

    // Save inbound message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        type: 'text',
        content: { text: message },
        sentAt: new Date(),
        status: 'DELIVERED',
      },
    });

    // Handle side-effect actions that don't produce messages
    for (const action of actions) {
      if (action.type === 'create_order') {
        // Fire-and-forget; errors are logged inside
        const { cartRecoveryService } = await import('../services/cart-recovery.service');
        const { notificationService } = await import('../services/notification.service');
        const { pushToTenant } = await import('../routes/sse');
        void (async () => {
          try {
            const total = action.items.reduce((s, i) => s + i.price * i.quantity, 0);
            const order = await prisma.order.create({
              data: {
                tenantId,
                customerId: customer.id,
                source: null,
                status: 'pending',
                paymentStatus: 'pending',
                fulfillmentStatus: 'unfulfilled',
                subtotal: total,
                tax: 0, shipping: 0, discount: 0, total,
                currency: 'NGN',
                items: action.items,
                shippingAddress: action.shippingAddress ?? null,
                notes: action.notes ?? null,
              },
            });
            pushToTenant(tenantId, 'order:created', { orderId: order.id, total, currency: 'NGN' });
            void cartRecoveryService.markRecovered(tenantId, customer.id);
            void notificationService.notifyNewOrder(tenantId, order.id.slice(0, 8).toUpperCase(), `NGN ${total.toFixed(2)}`);
          } catch (err) {
            console.error('[simulator create_order]', err);
          }
        })();
      }
    }

    const replies = actionsToReplies(actions);

    // Save each bot reply message
    for (const reply of replies) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          type: reply.buttons ? 'interactive' : reply.listRows ? 'interactive' : 'text',
          content: { text: reply.text, buttons: reply.buttons, listRows: reply.listRows },
          sentAt: new Date(),
          status: 'SENT',
        },
      });
    }

    res.json({ success: true, replies });
  } catch (err) {
    console.error('[Simulator]', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
