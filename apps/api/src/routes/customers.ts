import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import { buildPaginatedResponse, normalizePhone } from '@socialcart/shared';

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

const createSchema = z.object({
  phone: z.string().min(7),
  name: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/v1/customers
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, search } = req.query as z.infer<typeof listQuerySchema>;
    const tenantId = req.tenantId!;

    const where = {
      tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(customers, total, page, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params['id']!, tenantId: req.tenantId! },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, status: true, total: true, items: true, createdAt: true },
        },
        loyaltyAccount: true,
      },
    });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/phone/:phone
router.get('/phone/:phone', async (req, res, next) => {
  try {
    const phone = normalizePhone(decodeURIComponent(req.params['phone']!));
    const customer = await prisma.customer.findFirst({
      where: { tenantId: req.tenantId!, phone },
      include: { loyaltyAccount: true },
    });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/customers/:id
const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

router.patch('/:id', validate(updateCustomerSchema), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof updateCustomerSchema>;

    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.tags !== undefined && { tags: body.tags }),
      },
    });

    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers
router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createSchema>;
    const tenantId = req.tenantId!;
    const phone = normalizePhone(body.phone);

    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      create: {
        tenantId,
        phone,
        name: body.name,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        tags: body.tags ?? [],
      },
      update: {
        name: body.name,
        email: body.email,
        tags: body.tags ?? [],
      },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

export default router;
