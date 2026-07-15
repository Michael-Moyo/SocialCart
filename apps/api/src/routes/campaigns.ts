import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { dispatchCampaign } from '../services/campaign.service';

const router = Router();

function tid(req: Request): string {
  return (req as Request & { tenantId?: string }).tenantId ?? '';
}

// GET /api/v1/campaigns
router.get('/', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const status = req.query['status'] as string | undefined;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId, ...(status && status !== 'all' ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.campaign.count({
      where: { tenantId, ...(status && status !== 'all' ? { status: status as never } : {}) },
    }),
  ]);

  res.json({ success: true, data: campaigns, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

// GET /api/v1/campaigns/:id
router.get('/:id', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };

  const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }

  res.json({ success: true, data: campaign });
});

// POST /api/v1/campaigns
const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['BROADCAST', 'DRIP', 'ABANDONED_CART', 'LOYALTY', 'REORDER']),
  message: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  templateName: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  targetSegment: z.record(z.unknown()).optional(),
});

router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const data = req.body as z.infer<typeof createSchema>;

  const campaign = await prisma.campaign.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type,
      message: data.message,
      mediaUrl: data.mediaUrl,
      templateName: data.templateName,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      targetSegment: data.targetSegment ?? {},
      status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    },
  });

  res.status(201).json({ success: true, data: campaign });
});

// PATCH /api/v1/campaigns/:id
const updateSchema = createSchema.partial();

router.patch('/:id', validate(updateSchema), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };
  const data = req.body as z.infer<typeof updateSchema>;

  const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }

  if (['RUNNING', 'COMPLETED'].includes(existing.status)) {
    res.status(400).json({ success: false, error: `Cannot edit a ${existing.status.toLowerCase()} campaign` });
    return;
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      ...data,
      ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
    },
  });

  res.json({ success: true, data: updated });
});

// POST /api/v1/campaigns/:id/launch
router.post('/:id/launch', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };

  const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }

  if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
    res.status(400).json({ success: false, error: `Cannot launch a ${campaign.status.toLowerCase()} campaign` });
    return;
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: 'RUNNING', sentAt: new Date() },
  });

  // Fire and forget — dispatch runs async, campaign status updates on completion
  void dispatchCampaign(id);

  res.json({ success: true, data: updated });
});

// POST /api/v1/campaigns/:id/pause
router.post('/:id/pause', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };

  const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!campaign || campaign.status !== 'RUNNING') {
    res.status(400).json({ success: false, error: 'Campaign is not running' });
    return;
  }

  const updated = await prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } });
  res.json({ success: true, data: updated });
});

// DELETE /api/v1/campaigns/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };

  const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }

  if (campaign.status === 'RUNNING') {
    res.status(400).json({ success: false, error: 'Pause the campaign before deleting' });
    return;
  }

  await prisma.campaign.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
