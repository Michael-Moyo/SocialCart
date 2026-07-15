import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';

const router = Router();

// GET /api/v1/notifications?unread=true&limit=20
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const memberId = req.teamMemberId ?? null;
    const unreadOnly = req.query['unread'] === 'true';
    const limit = Math.min(Number(req.query['limit'] ?? 30), 100);

    const notifications = await prisma.notification.findMany({
      where: {
        tenantId,
        // Show owner-level + member-specific notifications
        OR: [{ memberId: null }, ...(memberId ? [{ memberId }] : [])],
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        tenantId,
        OR: [{ memberId: null }, ...(memberId ? [{ memberId }] : [])],
        read: false,
      },
    });

    res.json({ success: true, data: notifications, meta: { unreadCount } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params['id'], tenantId: req.tenantId! },
      data: { read: true },
    });
    res.json({ success: true, data: { updated: notification.count } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/read-all
router.post('/read-all', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const memberId = req.teamMemberId ?? null;
    const result = await prisma.notification.updateMany({
      where: {
        tenantId,
        OR: [{ memberId: null }, ...(memberId ? [{ memberId }] : [])],
        read: false,
      },
      data: { read: true },
    });
    res.json({ success: true, data: { updated: result.count } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params['id'], tenantId: req.tenantId! },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Web Push subscription management ────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  userAgent: z.string().optional(),
});

// POST /api/v1/notifications/push/subscribe
router.post('/push/subscribe', validate(subscribeSchema), async (req, res, next) => {
  try {
    const { endpoint, keys, userAgent } = req.body as z.infer<typeof subscribeSchema>;
    const tenantId = req.tenantId!;
    const memberId = req.teamMemberId ?? null;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { tenantId, memberId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      update: { tenantId, memberId, p256dh: keys.p256dh, auth: keys.auth },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notifications/push/unsubscribe
router.delete('/push/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body as { endpoint: string };
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, tenantId: req.tenantId! } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/push/vapid-key
router.get('/push/vapid-key', (_req, res) => {
  res.json({ success: true, data: { publicKey: process.env['VAPID_PUBLIC_KEY'] ?? '' } });
});

export default router;
