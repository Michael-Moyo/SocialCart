import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { generateMemberToken, requireRole } from '../middleware/auth';
import type { TeamRole } from '@prisma/client';

const router = Router();

function tid(req: Request): string {
  return (req as Request & { tenantId?: string }).tenantId ?? '';
}

// GET /api/v1/team — list all members with hierarchy
router.get('/', async (req: Request, res: Response) => {
  const tenantId = tid(req);

  const members = await prisma.teamMember.findMany({
    where: { tenantId },
    include: {
      manager: { select: { id: true, name: true, role: true } },
      reports: { select: { id: true, name: true, role: true, isActive: true } },
      _count: { select: { assignedConversations: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  res.json({ success: true, data: members });
});

// GET /api/v1/team/hierarchy — tree structure
router.get('/hierarchy', async (req: Request, res: Response) => {
  const tenantId = tid(req);

  const members = await prisma.teamMember.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true, name: true, email: true, phone: true, role: true, managerId: true,
      _count: { select: { assignedConversations: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  // Build tree: top-level = no managerId
  type Node = typeof members[0] & { children: Node[] };
  const map = new Map<string, Node>();
  members.forEach((m) => map.set(m.id, { ...m, children: [] }));

  const roots: Node[] = [];
  map.forEach((node) => {
    if (!node.managerId) {
      roots.push(node);
    } else {
      map.get(node.managerId)?.children.push(node);
    }
  });

  res.json({ success: true, data: roots });
});

// GET /api/v1/team/:id/performance — individual sales stats
router.get('/:id/performance', async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };

  const member = await prisma.teamMember.findFirst({ where: { id, tenantId } });
  if (!member) {
    res.status(404).json({ success: false, error: 'Team member not found' });
    return;
  }

  const [assignedTotal, resolvedTotal, openTotal, conversationsThisMonth] = await Promise.all([
    prisma.conversation.count({ where: { tenantId, assignedMemberId: id } }),
    prisma.conversation.count({ where: { tenantId, assignedMemberId: id, status: 'RESOLVED' } }),
    prisma.conversation.count({ where: { tenantId, assignedMemberId: id, status: 'OPEN' } }),
    prisma.conversation.count({
      where: {
        tenantId,
        assignedMemberId: id,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  // If sales rep, also grab orders linked through their conversations
  const recentConversations = await prisma.conversation.findMany({
    where: { tenantId, assignedMemberId: id },
    include: { customer: { select: { id: true, name: true, phone: true, totalOrders: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  res.json({
    success: true,
    data: {
      member,
      stats: {
        assignedTotal,
        resolvedTotal,
        openTotal,
        resolutionRate: assignedTotal > 0 ? Math.round((resolvedTotal / assignedTotal) * 100) : 0,
        conversationsThisMonth,
      },
      recentConversations,
    },
  });
});

// POST /api/v1/team — invite (create) team member
const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['MANAGER', 'AGENT', 'SALES_REP']),
  managerId: z.string().uuid().optional(),
  password: z.string().min(8),
});

router.post('/', requireRole('OWNER', 'MANAGER'), validate(inviteSchema), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const data = req.body as z.infer<typeof inviteSchema>;

  if (!data.email && !data.phone) {
    res.status(400).json({ success: false, error: 'Email or phone is required' });
    return;
  }

  if (data.email) {
    const existing = await prisma.teamMember.findUnique({ where: { tenantId_email: { tenantId, email: data.email } } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already in use' });
      return;
    }
  }

  // Managers can only create members under themselves
  const requestingMember = req.teamMember;
  let managerId = data.managerId;
  if (requestingMember?.role === 'MANAGER') {
    managerId = requestingMember.id;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const member = await prisma.teamMember.create({
    data: {
      tenantId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role as TeamRole,
      managerId: managerId ?? null,
      passwordHash,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, managerId: true, isActive: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: member });
});

// POST /api/v1/team/login — team member login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid().optional(),
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password, tenantId } = req.body as z.infer<typeof loginSchema>;

  // If tenantId supplied look up precisely; otherwise find by email across tenants
  const member = tenantId
    ? await prisma.teamMember.findUnique({ where: { tenantId_email: { tenantId, email } } })
    : await prisma.teamMember.findFirst({ where: { email } });
  if (!member) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid || !member.isActive) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = generateMemberToken(member.tenantId, member.id, member.role as TeamRole);
  const { passwordHash: _, ...memberData } = member;
  res.json({ success: true, data: { token, member: memberData } });
});

// PATCH /api/v1/team/:id
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['MANAGER', 'AGENT', 'SALES_REP']).optional(),
  managerId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.patch('/:id', requireRole('OWNER', 'MANAGER'), validate(updateSchema), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };
  const data = req.body as z.infer<typeof updateSchema>;

  const existing = await prisma.teamMember.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Team member not found' });
    return;
  }

  const updated = await prisma.teamMember.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, phone: true, role: true, managerId: true, isActive: true },
  });

  res.json({ success: true, data: updated });
});

// DELETE /api/v1/team/:id
router.delete('/:id', requireRole('OWNER'), async (req: Request, res: Response) => {
  const tenantId = tid(req);
  const { id } = req.params as { id: string };

  const existing = await prisma.teamMember.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Team member not found' });
    return;
  }

  // Soft-delete: deactivate and unassign conversations
  await prisma.teamMember.update({ where: { id }, data: { isActive: false } });
  await prisma.conversation.updateMany({ where: { tenantId, assignedMemberId: id }, data: { assignedMemberId: null } });

  res.json({ success: true });
});

export default router;
