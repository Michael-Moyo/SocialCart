import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { generateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(1),
});

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, phone, email, password } = req.body as z.infer<typeof registerSchema>;

    const existing = await prisma.tenant.findUnique({ where: { phone } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Phone number already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const tenant = await prisma.tenant.create({
      data: { name, phone, email, passwordHash },
      select: { id: true, name: true, phone: true, email: true, plan: true, createdAt: true },
    });

    const token = generateToken(tenant.id);
    res.status(201).json({ success: true, data: { tenant, token } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { phone, password } = req.body as z.infer<typeof loginSchema>;

    const tenant = await prisma.tenant.findUnique({ where: { phone } });
    if (!tenant) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, tenant.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    if (!tenant.isActive) {
      res.status(403).json({ success: false, error: 'Account is disabled' });
      return;
    }

    const token = generateToken(tenant.id);
    const { passwordHash: _, ...tenantData } = tenant;
    res.json({ success: true, data: { tenant: tenantData, token } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', async (req, res, next) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { id: true, name: true, phone: true, email: true, plan: true, createdAt: true },
    });
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

export default router;
