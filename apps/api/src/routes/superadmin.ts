import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { superAdminMiddleware, generateSuperAdminToken, generateToken } from '../middleware/auth';

const router = Router();

// POST /api/v1/superadmin/login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const admin = await prisma.superAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = generateSuperAdminToken(admin.id);
  res.json({ success: true, data: { token, admin: { id: admin.id, name: admin.name, email: admin.email } } });
});

// POST /api/v1/superadmin/setup — one-time seed (disabled after first admin exists)
router.post('/setup', async (req: Request, res: Response) => {
  const count = await prisma.superAdmin.count();
  if (count > 0) {
    res.status(403).json({ success: false, error: 'Setup already complete' });
    return;
  }

  const { name, email, password } = req.body as { name: string; email: string; password: string };
  if (!name || !email || !password) {
    res.status(400).json({ success: false, error: 'name, email and password are required' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.superAdmin.create({ data: { name, email, passwordHash } });
  const token = generateSuperAdminToken(admin.id);
  res.status(201).json({ success: true, data: { token, admin: { id: admin.id, name: admin.name, email: admin.email } } });
});

// ── All routes below require super-admin auth ─────────────────────────────────
router.use(superAdminMiddleware);

// GET /api/v1/superadmin/stats — platform-wide overview
router.get('/stats', async (_req: Request, res: Response) => {
  const [totalTenants, activeTenants, totalCustomers, totalOrders, totalConversations, planBreakdown] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.order.count(),
      prisma.conversation.count(),
      prisma.tenant.groupBy({ by: ['plan'], _count: { plan: true } }),
    ]);

  const plans = Object.fromEntries(planBreakdown.map((p) => [p.plan, p._count.plan]));

  res.json({
    success: true,
    data: { totalTenants, activeTenants, totalCustomers, totalOrders, totalConversations, plans },
  });
});

// GET /api/v1/superadmin/tenants
router.get('/tenants', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const search = (req.query['search'] as string) ?? '';
  const plan = req.query['plan'] as string | undefined;

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(plan && plan !== 'all' ? { plan: plan as never } : {}),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        id: true, name: true, phone: true, email: true, plan: true, isActive: true,
        createdAt: true, updatedAt: true,
        _count: { select: { customers: true, orders: true, conversations: true, teamMembers: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  res.json({ success: true, data: tenants, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

// GET /api/v1/superadmin/tenants/:id
router.get('/tenants/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true, name: true, phone: true, email: true, plan: true, isActive: true,
      whatsappBusinessId: true, whatsappPhoneNumberId: true, createdAt: true,
      _count: { select: { customers: true, orders: true, conversations: true, teamMembers: true, integrations: true } },
    },
  });

  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  res.json({ success: true, data: tenant });
});

// PATCH /api/v1/superadmin/tenants/:id — update plan, activate/deactivate
const updateTenantSchema = z.object({
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
  isActive: z.boolean().optional(),
});

router.patch('/tenants/:id', validate(updateTenantSchema), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const data = req.body as z.infer<typeof updateTenantSchema>;

  const updated = await prisma.tenant.update({
    where: { id },
    data,
    select: { id: true, name: true, plan: true, isActive: true },
  });

  res.json({ success: true, data: updated });
});

// POST /api/v1/superadmin/tenants/:id/impersonate — get a short-lived tenant token
router.post('/tenants/:id/impersonate', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  const token = generateToken(id);
  res.json({ success: true, data: { token, tenant: { id: tenant.id, name: tenant.name } } });
});

export default router;
