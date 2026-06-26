import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { integrationService } from '../services/integration.service';
import { PlatformType } from '@socialcart/integrations';

const router = Router();

const registerSchema = z.object({
  type: z.enum(['shopify', 'woocommerce', 'odoo', 'erpnext', 'retailman']),
  credentials: z.record(z.string()),
  webhookSecret: z.string().optional(),
  syncInterval: z.number().int().min(5).max(1440).optional(),
});

// POST /api/v1/integrations
router.post('/', validate(registerSchema), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = req.body as z.infer<typeof registerSchema>;

    const integration = await integrationService.register({
      tenantId,
      type: body.type as PlatformType,
      credentials: body.credentials,
      webhookSecret: body.webhookSecret,
      syncInterval: body.syncInterval,
    });

    res.status(201).json({ success: true, data: integration });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/integrations
router.get('/', async (req, res, next) => {
  try {
    const integrations = await integrationService.listForTenant(req.tenantId!);
    res.json({ success: true, data: integrations });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/integrations/:integrationId
router.delete('/:integrationId', async (req, res, next) => {
  try {
    await integrationService.remove(req.tenantId!, req.params['integrationId']!);
    res.json({ success: true, message: 'Integration removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/integrations/:integrationId/sync
router.post('/:integrationId/sync', async (req, res, next) => {
  try {
    // Determine platform from integration record
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const integration = await prisma.integration.findFirst({
      where: { id: req.params['integrationId']!, tenantId: req.tenantId! },
    });
    await prisma.$disconnect();

    if (!integration) {
      res.status(404).json({ success: false, error: 'Integration not found' });
      return;
    }

    const results = await integrationService.triggerSync(req.tenantId!, integration.type as PlatformType);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/integrations/sync-all
router.post('/sync-all', async (req, res, next) => {
  try {
    const results = await integrationService.triggerSync(req.tenantId!);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

export default router;
