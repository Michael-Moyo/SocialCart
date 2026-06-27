import { EventEmitter } from 'events';
import webpush from 'web-push';
import prisma from '../lib/prisma';
import { getWhatsAppClient } from './conversation.service';
import type { NotificationType } from '@prisma/client';

// Configure VAPID once at startup
if (process.env['VAPID_PUBLIC_KEY'] && process.env['VAPID_PRIVATE_KEY']) {
  webpush.setVapidDetails(
    `mailto:${process.env['VAPID_CONTACT_EMAIL'] ?? 'admin@socialcart.app'}`,
    process.env['VAPID_PUBLIC_KEY'],
    process.env['VAPID_PRIVATE_KEY']
  );
}

export interface NotificationPayload {
  tenantId: string;
  memberId?: string;        // null = owner
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: ('IN_APP' | 'WHATSAPP' | 'PUSH')[];
}

// WhatsApp message templates per notification type
const WA_TEMPLATES: Partial<Record<NotificationType, (p: NotificationPayload) => string>> = {
  NEW_ORDER: (p) => `🛒 *New Order* — ${p.body}`,
  NEW_CONVERSATION: (p) => `💬 *New Conversation* — ${p.body}`,
  CART_ABANDONED: (p) => `⚠️ *Abandoned Cart* — ${p.body}`,
  CAMPAIGN_COMPLETE: (p) => `📢 *Campaign Complete* — ${p.body}`,
  LOYALTY_TIER_UP: (p) => `🎉 *Loyalty Upgrade* — ${p.body}`,
};

class NotificationService extends EventEmitter {
  async dispatch(payload: NotificationPayload): Promise<void> {
    const channels = payload.channels ?? ['IN_APP', 'PUSH'];

    // 1. Persist in-app notification
    if (channels.includes('IN_APP')) {
      await prisma.notification.create({
        data: {
          tenantId: payload.tenantId,
          memberId: payload.memberId ?? null,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          channels: channels,
        },
      });
    }

    // 2. Web Push
    if (channels.includes('PUSH')) {
      await this.sendPush(payload);
    }

    // 3. WhatsApp self-notification (owner only, for high-priority events)
    if (channels.includes('WHATSAPP') && !payload.memberId) {
      await this.sendWhatsApp(payload);
    }

    this.emit('dispatched', payload);
  }

  private async sendPush(payload: NotificationPayload) {
    const subs = await prisma.pushSubscription.findMany({
      where: {
        tenantId: payload.tenantId,
        ...(payload.memberId ? { memberId: payload.memberId } : {}),
      },
    });

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      type: payload.type,
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
        } catch (err: unknown) {
          // Subscription expired — clean up
          if ((err as { statusCode?: number }).statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      })
    );
  }

  private async sendWhatsApp(payload: NotificationPayload) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { phone: true },
    });
    if (!tenant) return;

    const template = WA_TEMPLATES[payload.type];
    const message = template ? template(payload) : `*${payload.title}*\n${payload.body}`;
    const client = await getWhatsAppClient(payload.tenantId);
    await client.sendTextMessage(tenant.phone, message);
  }

  // ─── Convenience emitters (called from other services) ────────────────────

  async notifyNewOrder(tenantId: string, orderRef: string, amount: string) {
    await this.dispatch({
      tenantId,
      type: 'NEW_ORDER',
      title: 'New Order',
      body: `Order ${orderRef} for ${amount} has been placed`,
      data: { orderRef, amount },
      channels: ['IN_APP', 'PUSH', 'WHATSAPP'],
    });
  }

  async notifyNewConversation(tenantId: string, customerName: string, conversationId: string) {
    await this.dispatch({
      tenantId,
      type: 'NEW_CONVERSATION',
      title: `💬 ${customerName}`,
      body: 'Started a new conversation',
      data: { conversationId, customerName },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async notifyNewMessage(tenantId: string, memberId: string, customerName: string, conversationId: string, text: string) {
    await this.dispatch({
      tenantId,
      memberId,
      type: 'NEW_CONVERSATION',
      title: customerName,
      body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      data: { conversationId, customerName },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async notifyConversationAssigned(tenantId: string, memberId: string, conversationId: string, customerName: string) {
    await this.dispatch({
      tenantId,
      memberId,
      type: 'CONVERSATION_ASSIGNED',
      title: 'Conversation Assigned',
      body: `You've been assigned a conversation with ${customerName}`,
      data: { conversationId, customerName },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async notifyCartAbandoned(tenantId: string, customerName: string, cartValue: string) {
    await this.dispatch({
      tenantId,
      type: 'CART_ABANDONED',
      title: 'Abandoned Cart Detected',
      body: `${customerName} left items worth ${cartValue} in their cart`,
      data: { customerName, cartValue },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async notifyCampaignComplete(tenantId: string, campaignName: string, sent: number) {
    await this.dispatch({
      tenantId,
      type: 'CAMPAIGN_COMPLETE',
      title: 'Campaign Complete',
      body: `"${campaignName}" finished sending to ${sent} recipients`,
      data: { campaignName, sent },
      channels: ['IN_APP', 'PUSH', 'WHATSAPP'],
    });
  }

  async notifyLoyaltyTierUp(tenantId: string, memberId: string | undefined, customerName: string, tier: string) {
    await this.dispatch({
      tenantId,
      memberId,
      type: 'LOYALTY_TIER_UP',
      title: 'Loyalty Tier Upgrade',
      body: `${customerName} reached ${tier} tier`,
      data: { customerName, tier },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async notifyLowStock(tenantId: string, productName: string, inventory: number) {
    await this.dispatch({
      tenantId,
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      body: `${productName} is low on stock — only ${inventory} left`,
      data: { productName, inventory },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async notifyTeamInvite(tenantId: string, memberId: string, inviterName: string) {
    await this.dispatch({
      tenantId,
      memberId,
      type: 'TEAM_INVITE',
      title: 'Team Invitation',
      body: `${inviterName} invited you to join the team`,
      data: { inviterName },
      channels: ['IN_APP', 'PUSH'],
    });
  }
}

export const notificationService = new NotificationService();
