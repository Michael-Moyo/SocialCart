import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';
import { validate } from '../middleware/validate';

const router = Router();

function tenantId(req: Request): string {
  return (req as Request & { tenantId?: string }).tenantId ?? '';
}

// GET /api/v1/settings — full tenant profile + settings
router.get('/', async (req: Request, res: Response) => {
  const id = tenantId(req);
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      plan: true,
      isActive: true,
      whatsappBusinessId: true,
      whatsappPhoneNumberId: true,
      settings: true,
      createdAt: true,
    },
  });

  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  // Decrypt whatsapp access token from settings if stored
  const raw = (tenant.settings ?? {}) as Record<string, unknown>;
  const settings = { ...raw };
  if (typeof settings['waAccessTokenEnc'] === 'string') {
    try {
      settings['whatsappAccessToken'] = decrypt(settings['waAccessTokenEnc'] as string);
    } catch {
      settings['whatsappAccessToken'] = '';
    }
    delete settings['waAccessTokenEnc'];
  }

  res.json({ success: true, data: { ...tenant, settings } });
});

// PATCH /api/v1/settings/profile
const profileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
});

router.patch('/profile', validate(profileSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const data = req.body as z.infer<typeof profileSchema>;

  const updated = await prisma.tenant.update({
    where: { id },
    data,
    select: { id: true, name: true, phone: true, email: true, plan: true },
  });

  res.json({ success: true, data: updated });
});

// PATCH /api/v1/settings/password
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.patch('/password', validate(passwordSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const { currentPassword, newPassword } = req.body as z.infer<typeof passwordSchema>;

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, tenant.passwordHash);
  if (!valid) {
    res.status(400).json({ success: false, error: 'Current password is incorrect' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.tenant.update({ where: { id }, data: { passwordHash } });

  res.json({ success: true, message: 'Password updated' });
});

// PATCH /api/v1/settings/whatsapp
const whatsappSchema = z.object({
  whatsappBusinessId: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
});

router.patch('/whatsapp', validate(whatsappSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const { whatsappAccessToken, webhookVerifyToken, ...rest } = req.body as z.infer<typeof whatsappSchema>;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const existing = (tenant?.settings ?? {}) as Record<string, unknown>;

  const settingsUpdate: Record<string, unknown> = { ...existing };
  if (webhookVerifyToken !== undefined) settingsUpdate['webhookVerifyToken'] = webhookVerifyToken;
  if (whatsappAccessToken !== undefined && whatsappAccessToken !== '') {
    settingsUpdate['waAccessTokenEnc'] = encrypt(whatsappAccessToken);
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      ...rest,
      settings: settingsUpdate,
    },
    select: {
      id: true,
      whatsappBusinessId: true,
      whatsappPhoneNumberId: true,
      settings: true,
    },
  });

  res.json({ success: true, data: updated });
});

// PATCH /api/v1/settings/bot
const botSchema = z.object({
  botEnabled: z.boolean().optional(),
  greetingMessage: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  workingHoursEnabled: z.boolean().optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  offlineMessage: z.string().optional(),
});

router.patch('/bot', validate(botSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const updates = req.body as z.infer<typeof botSchema>;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const existing = (tenant?.settings ?? {}) as Record<string, unknown>;

  const settingsUpdate = { ...existing, ...updates };

  const updated = await prisma.tenant.update({
    where: { id },
    data: { settings: settingsUpdate },
    select: { id: true, settings: true },
  });

  res.json({ success: true, data: updated });
});

export default router;
