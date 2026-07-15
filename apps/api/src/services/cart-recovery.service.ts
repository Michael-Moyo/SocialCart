import prisma from '../lib/prisma';
import { conversationService } from './conversation.service';
import type { CartItem } from '@socialcart/flow-engine';

const ABANDON_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export const cartRecoveryService = {
  /**
   * Run once per scheduled interval (e.g. every 15 minutes).
   * Finds carts that went ACTIVE → idle for 30+ minutes and triggers the
   * cart-recovery WhatsApp flow for each one, then marks them ABANDONED.
   */
  async runRecoveryCycle(): Promise<{ processed: number; errors: number }> {
    const cutoff = new Date(Date.now() - ABANDON_THRESHOLD_MS);

    const abandonedCarts = await prisma.cart.findMany({
      where: {
        status: 'ACTIVE',
        updatedAt: { lt: cutoff },
        items: { not: '[]' },
      },
      include: {
        customer: { select: { id: true, phone: true, name: true, tenantId: true } },
      },
      take: 100,
    });

    let processed = 0;
    let errors = 0;

    for (const cart of abandonedCarts) {
      try {
        const items = cart.items as CartItem[];
        if (!items.length) continue;

        await conversationService.triggerCartRecovery(
          cart.tenantId,
          cart.customerId,
          cart.customer.phone,
          items
        );

        await prisma.cart.update({
          where: { id: cart.id },
          data: { status: 'ABANDONED', abandonedAt: new Date() },
        });

        processed++;
      } catch (err) {
        console.error(`[CartRecovery] Failed for cart ${cart.id}:`, err);
        errors++;
      }
    }

    console.info(`[CartRecovery] Cycle complete — processed: ${processed}, errors: ${errors}`);
    return { processed, errors };
  },

  /**
   * Mark previously-abandoned carts as RECOVERED when a matching order arrives.
   * Call this from the order-creation webhook handler.
   */
  async markRecovered(tenantId: string, customerId: string): Promise<void> {
    await prisma.cart.updateMany({
      where: { tenantId, customerId, status: 'ABANDONED' },
      data: { status: 'RECOVERED', recoveredAt: new Date() },
    });
  },
};

/**
 * Lightweight cron scheduler — runs inside the API process.
 * For production use a proper queue (BullMQ, pg-boss, etc.).
 */
export function startCartRecoveryCron(intervalMs = 15 * 60 * 1000): NodeJS.Timeout {
  console.info('[CartRecovery] Cron started — interval:', intervalMs / 60000, 'min');
  return setInterval(() => {
    cartRecoveryService.runRecoveryCycle().catch((err) => {
      console.error('[CartRecovery] Cron error:', err);
    });
  }, intervalMs);
}
