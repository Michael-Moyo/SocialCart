import prisma from '../lib/prisma';
import { getWhatsAppClient } from './conversation.service';
import { notificationService } from './notification.service';

interface TargetSegment {
  tier?: string;       // BRONZE | SILVER | GOLD | PLATINUM — loyalty filter
  minOrders?: number;  // customers with >= N orders
  maxOrders?: number;  // customers with <= N orders
  tags?: string[];     // customer tag filter (any match)
}

interface Recipient { phone: string; name: string }

async function resolveAudience(tenantId: string, segment: TargetSegment): Promise<Recipient[]> {
  const where: Record<string, unknown> = { tenantId };

  if (segment.tier) {
    where['loyaltyAccount'] = { is: { tier: segment.tier } };
  }

  if (segment.minOrders !== undefined || segment.maxOrders !== undefined) {
    where['orders'] = {
      ...(segment.minOrders !== undefined ? { some: {} } : {}),
    };
  }

  const customers = await prisma.customer.findMany({
    where: where as Parameters<typeof prisma.customer.findMany>[0]['where'],
    select: { phone: true, name: true, _count: { select: { orders: true } } },
  });

  return customers
    .filter((c) => {
      if (segment.minOrders !== undefined && c._count.orders < segment.minOrders) return false;
      if (segment.maxOrders !== undefined && c._count.orders > segment.maxOrders) return false;
      return true;
    })
    .map((c) => ({ phone: c.phone, name: c.name ?? c.phone }));
}

function personalise(template: string, recipient: Recipient): string {
  return template.replace(/\{\{name\}\}/gi, recipient.name.split(' ')[0] ?? recipient.name);
}

export async function dispatchCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== 'RUNNING') return;

  const client = await getWhatsAppClient(campaign.tenantId);
  const segment = (campaign.targetSegment ?? {}) as TargetSegment;
  const phones = await resolveAudience(campaign.tenantId, segment);

  let sent = 0;
  const errors: string[] = [];

  for (const recipient of phones) {
    try {
      const message = personalise(campaign.message, recipient);
      if (campaign.mediaUrl) {
        await client.sendMediaMessage(recipient.phone, 'image', campaign.mediaUrl, message);
      } else {
        await client.sendTextMessage(recipient.phone, message);
      }
      sent++;
    } catch (err) {
      errors.push(`${recipient.phone}: ${String(err)}`);
    }
    // Throttle to avoid WhatsApp rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'COMPLETED',
      stats: { sent, delivered: sent, read: 0, replied: 0, errors: errors.length },
    },
  });

  await notificationService.notifyCampaignComplete(campaign.tenantId, campaign.name, sent);
}

export async function runScheduledCampaigns(): Promise<void> {
  const due = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
  });

  await Promise.allSettled(
    due.map(async ({ id }) => {
      await prisma.campaign.update({ where: { id }, data: { status: 'RUNNING', sentAt: new Date() } });
      await dispatchCampaign(id);
    })
  );
}
