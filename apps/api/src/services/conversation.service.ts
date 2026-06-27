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

export const conversationService = {
  async handleIncoming(
    tenantId: string,
    phone: string,
    message: string,
    waMessageId?: string
  ): Promise<{ id: string; assignedMemberId: string | null } | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const tenantSettings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const disabledFlows = (tenantSettings['disabledFlows'] as string[] | undefined) ?? [];

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


