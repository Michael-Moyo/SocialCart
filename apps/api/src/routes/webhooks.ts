import { Router, Request, Response } from 'express';
import { integrationManager, PlatformType } from '@socialcart/integrations';
import { parseWebhookPayload } from '@socialcart/whatsapp';
import prisma from '../lib/prisma';

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

      // Log to DB
      await prisma.message.create({
        data: {
          conversationId: 'system',
          direction: 'INBOUND',
          type: 'webhook',
          content: { platform, topic, payload: req.body },
        },
      }).catch(() => null); // non-critical
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

  // Find conversation by phone number
  const conversation = await prisma.conversation.findFirst({
    where: { waNumber: event.from },
    include: { customer: true },
  });

  if (event.type.startsWith('message.')) {
    // Save inbound message
    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          type: event.message?.type ?? 'text',
          content: event.message ?? {},
          waMessageId: event.messageId,
          sentAt: event.timestamp,
          status: 'DELIVERED',
        },
      });
    }
  } else if (event.type.startsWith('status.')) {
    // Update message delivery status
    if (event.messageId) {
      const status = event.type.split('.')[1]?.toUpperCase() as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
      await prisma.message.updateMany({
        where: { waMessageId: event.messageId },
        data: {
          status,
          ...(status === 'DELIVERED' && { deliveredAt: event.timestamp }),
          ...(status === 'READ' && { readAt: event.timestamp }),
        },
      });
    }
  }
}

export default router;
