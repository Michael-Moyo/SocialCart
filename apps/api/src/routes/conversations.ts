import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

async function sendWhatsAppText(to: string, text: string) {
  const token = process.env['WHATSAPP_ACCESS_TOKEN'];
  const phoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  if (!token || !phoneId) return null;
  const res = await axios.post(
    `${GRAPH_URL}/${phoneId}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return (res.data as { messages?: Array<{ id: string }> })?.messages?.[0]?.id ?? null;
}

const router = Router();

// GET /api/v1/conversations
router.get('/', async (req: Request, res: Response) => {
  const tenantId = (req as Request & { tenantId?: string }).tenantId ?? '';
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const skip = (page - 1) * limit;

  const memberId = (req as Request & { teamMemberId?: string }).teamMemberId;
  const assignedToMe = req.query['assignedToMe'] === 'true';
  const status = req.query['status'] as string | undefined;

  const where = {
    tenantId,
    ...(assignedToMe && memberId ? { assignedMemberId: memberId } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where }),
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

// POST /api/v1/conversations/:id/reply  (agent sends a manual WhatsApp message)
router.post('/:id/reply', async (req: Request, res: Response) => {
  const tenantId = (req as Request & { tenantId?: string }).tenantId ?? '';
  const { id } = req.params as { id: string };
  const { text } = req.body as { text?: string };

  if (!text?.trim()) {
    res.status(400).json({ success: false, error: 'text is required' });
    return;
  }

  const conversation = await prisma.conversation.findFirst({ where: { id, tenantId } });
  if (!conversation) {
    res.status(404).json({ success: false, error: 'Conversation not found' });
    return;
  }

  // Send via WhatsApp Cloud API
  let waMessageId: string | null = null;
  try {
    waMessageId = await sendWhatsAppText(conversation.waNumber, text.trim());
  } catch {
    // Continue — still save the message even if WA delivery fails in dev
  }

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      direction: 'OUTBOUND',
      type: 'text',
      content: { text: text.trim() },
      waMessageId,
      status: waMessageId ? 'SENT' : 'PENDING',
      sentAt: new Date(),
    },
  });

  // Flip conversation to OPEN (human took over from bot)
  await prisma.conversation.update({
    where: { id },
    data: { status: 'OPEN', updatedAt: new Date() },
  });

  res.json({ success: true, data: message });
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
