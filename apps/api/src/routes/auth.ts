import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { generateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { whatsappClient } from '../lib/whatsapp-client';

const router = Router();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── WhatsApp OTP flow ────────────────────────────────────────────────────────

const requestOtpSchema = z.object({
  phone: z.string().min(7),
  name: z.string().min(2).optional(), // required only on first registration
});

// POST /api/v1/auth/otp/request
router.post('/otp/request', validate(requestOtpSchema), async (req, res, next) => {
  try {
    const { phone, name } = req.body as z.infer<typeof requestOtpSchema>;

    const existing = await prisma.tenant.findUnique({ where: { phone } });

    // New tenant: require name
    if (!existing && !name) {
      res.status(400).json({ success: false, error: 'name is required for new accounts' });
      return;
    }

    // Invalidate any previous unused OTPs for this phone
    await prisma.otpCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    const otp = generateOtp();
    const hash = await bcrypt.hash(otp, 10);
    await prisma.otpCode.create({
      data: { phone, code: hash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    // Send via WhatsApp
    const sent = await whatsappClient.sendOtp(phone, otp);
    if (!sent) {
      // In dev/test fall through — still return success so FE can proceed
      console.warn(`[OTP] WhatsApp send failed for ${phone} — code: ${otp}`);
    }

    res.json({
      success: true,
      data: {
        isNew: !existing,
        message: 'OTP sent to your WhatsApp number',
      },
    });
  } catch (err) {
    next(err);
  }
});

const verifyOtpSchema = z.object({
  phone: z.string().min(7),
  code: z.string().length(6),
  name: z.string().min(2).optional(),
});

// POST /api/v1/auth/otp/verify
router.post('/otp/verify', validate(verifyOtpSchema), async (req, res, next) => {
  try {
    const { phone, code, name } = req.body as z.infer<typeof verifyOtpSchema>;

    const otpRecord = await prisma.otpCode.findFirst({
      where: { phone, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      res.status(401).json({ success: false, error: 'OTP expired or not found. Request a new code.' });
      return;
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
      res.status(429).json({ success: false, error: 'Too many attempts. Request a new code.' });
      return;
    }

    const valid = await bcrypt.compare(code, otpRecord.code);
    if (!valid) {
      await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } });
      res.status(401).json({ success: false, error: 'Invalid OTP' });
      return;
    }

    // Mark used
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });

    // Upsert tenant
    let tenant = await prisma.tenant.findUnique({ where: { phone } });
    if (!tenant) {
      if (!name) {
        res.status(400).json({ success: false, error: 'name is required for new accounts' });
        return;
      }
      tenant = await prisma.tenant.create({ data: { name, phone } });
    }

    if (!tenant.isActive) {
      res.status(403).json({ success: false, error: 'Account is disabled' });
      return;
    }

    const token = generateToken(tenant.id);
    const { passwordHash: _, ...tenantData } = tenant;
    res.json({ success: true, data: { tenant: tenantData, token, isNew: !tenant.createdAt } });
  } catch (err) {
    next(err);
  }
});

// ─── Legacy password login (for backwards compat / fallback) ─────────────────

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { phone, password } = req.body as z.infer<typeof loginSchema>;
    const tenant = await prisma.tenant.findUnique({ where: { phone } });

    if (!tenant || !tenant.passwordHash) {
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

// ─── Register (legacy — also migrated to OTP verify) ─────────────────────────

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, phone, email, password } = req.body as z.infer<typeof registerSchema>;
    const existing = await prisma.tenant.findUnique({ where: { phone } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Phone number already registered' });
      return;
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const tenant = await prisma.tenant.create({
      data: { name, phone, email, ...(passwordHash && { passwordHash }) },
      select: { id: true, name: true, phone: true, email: true, plan: true, createdAt: true },
    });

    const token = generateToken(tenant.id);
    res.status(201).json({ success: true, data: { tenant, token } });
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
