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

function actionsToReply(actions: FlowAction[]): { text: string; buttons?: Array<{ id: string; title: string }>; listRows?: Array<{ id: string; title: string; description?: string }> } | null {
  let text = '';
  let buttons: Array<{ id: string; title: string }> | undefined;
  let listRows: Array<{ id: string; title: string; description?: string }> | undefined;

  for (const action of actions) {
    if (action.type === 'send_text') {
      text = action.text;
    } else if (action.type === 'send_buttons') {
      text = action.body;
      buttons = action.buttons;
    } else if (action.type === 'send_list') {
      text = action.body;
      listRows = action.sections.flatMap((s) => s.rows);
    }
  }

  if (!text) return null;
  return { text, ...(buttons ? { buttons } : {}), ...(listRows ? { listRows } : {}) };
}

const messageSchema = z.object({
  tenantId: z.string().min(1),
  phone: z.string().min(7),
  message: z.string().min(1),
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

    const reply = actionsToReply(actions);

    // Save bot reply
    if (reply) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          type: reply.buttons ? 'interactive' : 'text',
          content: { text: reply.text, buttons: reply.buttons, listRows: reply.listRows },
          sentAt: new Date(),
          status: 'SENT',
        },
      });
    }

    res.json({ success: true, reply });
  } catch (err) {
    console.error('[Simulator]', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
