import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';

const router = Router();

function tid(req: Request): string {
  return (req as Request & { tenantId?: string }).tenantId ?? '';
}

const TIER_THRESHOLDS = { BRONZE: 0, SILVER: 500, GOLD: 2000, PLATINUM: 5000 };

function computeTier(points: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (points >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (points >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (points >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

// GET /api/v1/loyalty — list accounts with customer info
router.get('/', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const tier = req.query['tier'] as string | undefined;

  const [accounts, total] = await Promise.all([
    prisma.loyaltyAccount.findMany({
      where: { tenantId, ...(tier && tier !== 'all' ? { tier: tier as never } : {}) },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, totalOrders: true, totalSpent: true } },
      },
      orderBy: { points: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.loyaltyAccount.count({
      where: { tenantId, ...(tier && tier !== 'all' ? { tier: tier as never } : {}) },
    }),
  ]);

  res.json({ success: true, data: accounts, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

// GET /api/v1/loyalty/stats
router.get('/stats', async (req: Request, res: Response) => {
  const tenantId = tid(req);

  const [total, tiers] = await Promise.all([
    prisma.loyaltyAccount.count({ where: { tenantId } }),
    prisma.loyaltyAccount.groupBy({
      by: ['tier'],
      where: { tenantId },
      _count: { tier: true },
      _sum: { points: true },
    }),
  ]);

  const tierMap = Object.fromEntries(
    tiers.map((t) => [t.tier, { count: t._count.tier, totalPoints: t._sum.points ?? 0 }])
  );

  res.json({
    success: true,
    data: {
      totalMembers: total,
      tiers: {
        BRONZE: tierMap['BRONZE'] ?? { count: 0, totalPoints: 0 },
        SILVER: tierMap['SILVER'] ?? { count: 0, totalPoints: 0 },
        GOLD: tierMap['GOLD'] ?? { count: 0, totalPoints: 0 },
        PLATINUM: tierMap['PLATINUM'] ?? { count: 0, totalPoints: 0 },
      },
      thresholds: TIER_THRESHOLDS,
    },
  });
});

// GET /api/v1/loyalty/:customerId
router.get('/:customerId', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { customerId } = req.params as { customerId: string };

  const account = await prisma.loyaltyAccount.findFirst({
    where: { customerId, tenantId },
    include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
  });

  if (!account) {
    res.status(404).json({ success: false, error: 'Loyalty account not found' });
    return;
  }

  const nextTier = computeTier(account.points + 1);
  const threshold = TIER_THRESHOLDS[nextTier] ?? 0;
  const pointsToNext = Math.max(0, threshold - account.points);

  res.json({ success: true, data: { ...account, pointsToNextTier: pointsToNext, nextTier } });
});

// POST /api/v1/loyalty/:customerId/award
const awardSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(1),
});

router.post('/:customerId/award', validate(awardSchema), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { customerId } = req.params as { customerId: string };
  const { points, reason } = req.body as z.infer<typeof awardSchema>;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }

  const existing = await prisma.loyaltyAccount.findFirst({ where: { customerId, tenantId } });

  const newPoints = (existing?.points ?? 0) + points;
  const newTier = computeTier(newPoints);

  const historyEntry = { date: new Date().toISOString(), type: 'award', points, reason, balance: newPoints };
  const history = [...((existing?.history as unknown[]) ?? []), historyEntry];

  const account = existing
    ? await prisma.loyaltyAccount.update({
        where: { id: existing.id },
        data: { points: newPoints, tier: newTier, history },
      })
    : await prisma.loyaltyAccount.create({
        data: { customerId, tenantId, points: newPoints, tier: newTier, history },
      });

  res.json({ success: true, data: account });
});

// POST /api/v1/loyalty/:customerId/redeem
const redeemSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(1),
});

router.post('/:customerId/redeem', validate(redeemSchema), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { customerId } = req.params as { customerId: string };
  const { points, reason } = req.body as z.infer<typeof redeemSchema>;

  const account = await prisma.loyaltyAccount.findFirst({ where: { customerId, tenantId } });
  if (!account) {
    res.status(404).json({ success: false, error: 'Loyalty account not found' });
    return;
  }

  if (account.points < points) {
    res.status(400).json({ success: false, error: `Insufficient points (balance: ${account.points})` });
    return;
  }

  const newPoints = account.points - points;
  const newTier = computeTier(newPoints);

  const historyEntry = { date: new Date().toISOString(), type: 'redeem', points: -points, reason, balance: newPoints };
  const history = [...((account.history as unknown[]) ?? []), historyEntry];

  const updated = await prisma.loyaltyAccount.update({
    where: { id: account.id },
    data: { points: newPoints, tier: newTier, history },
  });

  res.json({ success: true, data: updated });
});

export default router;
