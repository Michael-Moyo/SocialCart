/**
 * Public endpoints — no auth required.
 * Used by the customer-facing PWA to load store info before any session exists.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/v1/public/stores/:tenantId — minimal store info for the PWA header
router.get('/stores/:tenantId', async (req: Request, res: Response) => {
  const { tenantId } = req.params as { tenantId: string };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      isActive: true,
      settings: true,
    },
  });

  if (!tenant || !tenant.isActive) {
    res.status(404).json({ success: false, error: 'Store not found' });
    return;
  }

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;

  res.json({
    success: true,
    data: {
      id: tenant.id,
      name: tenant.name,
      logoUrl: (settings['logoUrl'] as string | undefined) ?? null,
      tagline: (settings['tagline'] as string | undefined) ?? null,
      primaryColor: (settings['primaryColor'] as string | undefined) ?? '#25D366',
    },
  });
});

export default router;
