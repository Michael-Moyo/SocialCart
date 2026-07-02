import { Router, Request, Response } from 'express';
import { integrationManager, PlatformType } from '@socialcart/integrations';
import { parseWebhookPayload, extractMessageText, extractInteractiveReplyId } from '@socialcart/whatsapp';
import prisma from '../lib/prisma';
import { conversationService } from '../services/conversation.service';
import { notificationService } from '../services/notification.service';
import { pushToTenant } from './sse';

const router = Router();

// POST /api/v1/webhooks/:tenantId/:platform
// Receives inbound webhook events from ERP/eCommerce platforms
router.post('/:tenantId/:platform', async (req: Request, res: Response) => {
  const { tenantId, platform } = req.params as { tenantId: string; platform: string };

  try {
    const rawBody: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    // Get signature from header (differs per platform)
    const signature =
      (req.headers['x-shopify-hmac-sha256'] as string) ??
      (req.headers['x-wc-webhook-signature'] as string) ??
      (req.headers['x-hub-signature-256'] as string) ??
      '';

    // Verify webhook signature if connector is registered
    if (integrationManager.hasConnector(tenantId, platform as PlatformType)) {
      const connector = integrationManager.getConnector(tenantId, platform as PlatformType);
      const valid = connector.verifyWebhook(rawBody, signature);
      if (!valid) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }

      // Determine event topic
      const topic =
        (req.headers['x-shopify-topic'] as string) ??
        (req.headers['x-wc-webhook-topic'] as string) ??
        (req.query['topic'] as string) ??
        'unknown';

      await connector.handleWebhook(topic, req.body);
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Webhook:${platform}]`, err);
    res.json({ received: true }); // Always 200 to prevent retries on auth errors
  }
});

// GET /api/v1/whatsapp/webhook — challenge verification
router.get('/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN']) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
});

// POST /api/v1/whatsapp/webhook — receive WhatsApp messages/statuses
router.post('/whatsapp/webhook', async (req: Request, res: Response) => {
  // Always respond 200 immediately to WhatsApp
  res.status(200).json({ status: 'ok' });

  try {
    const payload = req.body;
    const events = parseWebhookPayload(payload);

    for (const event of events) {
      // Process event asynchronously
      processWhatsAppEvent(event).catch((err) => {
        console.error('[WhatsApp webhook]', err);
      });
    }
  } catch (err) {
    console.error('[WhatsApp webhook parse error]', err);
  }
});

async function processWhatsAppEvent(event: ReturnType<typeof parseWebhookPayload>[number]): Promise<void> {
  if (!event.from) return;

  if (event.type.startsWith('message.')) {
    const messageText =
      extractInteractiveReplyId(event.message) ??
      extractMessageText(event.message) ??
      '';

    // Look up tenant by the WhatsApp phone number ID from webhook metadata
    const phoneNumberId = (event as { phoneNumberId?: string }).phoneNumberId
      ?? process.env['WHATSAPP_PHONE_NUMBER_ID'];
    let tenantId: string | null = null;
    if (phoneNumberId) {
      const tenant = await prisma.tenant.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
        select: { id: true },
      });
      tenantId = tenant?.id ?? null;
    }
    if (!tenantId) tenantId = process.env['DEFAULT_TENANT_ID'] ?? null;
    if (!tenantId) {
      console.warn('[webhook] No tenant found for phoneNumberId:', phoneNumberId);
      res.sendStatus(200);
      return;
    }

    const conversation = await conversationService.handleIncoming(
      tenantId,
      event.from,
      messageText,
      event.messageId
    );

    // Push real-time SSE event so dashboard updates instantly (no polling needed)
    if (conversation) {
      pushToTenant(tenantId, 'conversation:message', {
        conversationId: conversation.id,
        direction: 'INBOUND',
        text: messageText,
      });
    }

    // Notify assigned agent (or all agents) about the new inbound message
    if (conversation && messageText) {
      const customer = await prisma.customer.findFirst({ where: { phone: event.from, tenantId }, select: { name: true } });
      const customerName = customer?.name ?? event.from;

      if (conversation.assignedMemberId) {
        // Notify the specific assigned agent
        await notificationService.notifyNewMessage(tenantId, conversation.assignedMemberId, customerName, conversation.id, messageText);
      } else {
        // Notify owner + managers (no specific assignment yet)
        await notificationService.notifyNewConversation(tenantId, customerName, conversation.id);
      }
    }
  } else if (event.type.startsWith('status.')) {
    if (event.messageId) {
      const status = event.type.split('.')[1]?.toUpperCase() as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
      const updated = await prisma.message.findFirst({
        where: { waMessageId: event.messageId },
        select: { id: true, conversationId: true },
      });

      await prisma.message.updateMany({
        where: { waMessageId: event.messageId },
        data: {
          status,
          ...(status === 'DELIVERED' && { deliveredAt: event.timestamp }),
          ...(status === 'READ' && { readAt: event.timestamp }),
        },
      });

      // Push read receipt to SSE so dashboard ticks update without polling
      if (updated) {
        const msg = await prisma.message.findFirst({
          where: { id: updated.id },
          select: { conversationId: true },
        });
        if (msg) {
          const conv = await prisma.conversation.findUnique({
            where: { id: msg.conversationId },
            select: { tenantId: true },
          });
          if (conv) {
            pushToTenant(conv.tenantId, 'message:status', {
              messageId: event.messageId,
              conversationId: msg.conversationId,
              status,
            });
          }
        }
      }
    }
  }
}

export default router;
