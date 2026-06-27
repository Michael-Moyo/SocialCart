import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/v1/conversations
router.get('/', async (req: Request, res: Response) => {
  const tenantId = (req as Request & { tenantId?: string }).tenantId ?? '';
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const skip = (page - 1) * limit;

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { tenantId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where: { tenantId } }),
  ]);

  res.json({
    success: true,
    data: conversations,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /api/v1/conversations/:id
router.get('/:id', async (req: Request, res: Response) => {
  const tenantId = (req as Request & { tenantId?: string }).tenantId ?? '';
  const { id } = req.params as { id: string };

  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      messages: { orderBy: { sentAt: 'asc' } },
    },
  });

  if (!conversation) {
    res.status(404).json({ success: false, error: 'Conversation not found' });
    return;
  }

  res.json({ success: true, data: conversation });
});

// POST /api/v1/conversations/:id/assign
router.post('/:id/assign', async (req: Request, res: Response) => {
  const tenantId = (req as Request & { tenantId?: string }).tenantId ?? '';
  const { id } = req.params as { id: string };
  const { agentId } = req.body as { agentId?: string };

  if (!agentId) {
    res.status(400).json({ success: false, error: 'agentId is required' });
    return;
  }

  const conversation = await prisma.conversation.findFirst({ where: { id, tenantId } });
  if (!conversation) {
    res.status(404).json({ success: false, error: 'Conversation not found' });
    return;
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { assignedTo: agentId, status: 'OPEN' },
  });

  res.json({ success: true, data: updated });
});

// POST /api/v1/conversations/:id/resolve
router.post('/:id/resolve', async (req: Request, res: Response) => {
  const tenantId = (req as Request & { tenantId?: string }).tenantId ?? '';
  const { id } = req.params as { id: string };

  const conversation = await prisma.conversation.findFirst({ where: { id, tenantId } });
  if (!conversation) {
    res.status(404).json({ success: false, error: 'Conversation not found' });
    return;
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });

  res.json({ success: true, data: updated });
});

export default router;
