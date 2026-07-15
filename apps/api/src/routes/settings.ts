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
  logoUrl: z.string().url().optional().nullable(),
  tagline: z.string().max(120).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.patch('/profile', validate(profileSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const { name, email, ...brandingFields } = req.body as z.infer<typeof profileSchema>;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const currentSettings = (tenant?.settings ?? {}) as Record<string, unknown>;

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      settings: { ...currentSettings, ...brandingFields },
    },
    select: { id: true, name: true, phone: true, email: true, plan: true, settings: true },
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

// PATCH /api/v1/settings/payments
const paymentsSchema = z.object({
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'MANUAL']).optional(),
  paystackSecretKey: z.string().optional(),
  paystackPublicKey: z.string().optional(),
  flutterwaveSecretKey: z.string().optional(),
  flutterwavePublicKey: z.string().optional(),
  flutterwaveWebhookHash: z.string().optional(),
  currency: z.string().length(3).optional(),
});

router.patch('/payments', validate(paymentsSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const { paystackSecretKey, flutterwaveSecretKey, ...rest } = req.body as z.infer<typeof paymentsSchema>;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const existing = (tenant?.settings ?? {}) as Record<string, unknown>;

  const settingsUpdate: Record<string, unknown> = { ...existing, ...rest };
  if (paystackSecretKey) settingsUpdate['paystackSecretKeyEnc'] = encrypt(paystackSecretKey);
  if (flutterwaveSecretKey) settingsUpdate['flutterwaveSecretKeyEnc'] = encrypt(flutterwaveSecretKey);

  await prisma.tenant.update({ where: { id }, data: { settings: settingsUpdate } });

  res.json({ success: true, message: 'Payment settings saved' });
});

// PATCH /api/v1/settings/banking — bank transfer details shown to WhatsApp customers
const bankingSchema = z.object({
  bankName: z.string().min(1).optional(),
  accountNumber: z.string().min(6).optional(),
  accountName: z.string().min(1).optional(),
});

router.patch('/banking', validate(bankingSchema), async (req: Request, res: Response) => {
  const id = tenantId(req);
  const updates = req.body as z.infer<typeof bankingSchema>;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const existing = (tenant?.settings ?? {}) as Record<string, unknown>;

  const settingsUpdate = { ...existing, ...updates };
  await prisma.tenant.update({ where: { id }, data: { settings: settingsUpdate } });

  res.json({ success: true, message: 'Banking details saved' });
});

// GET /api/v1/settings/onboarding — returns which setup steps are complete
router.get('/onboarding', async (req: Request, res: Response) => {
  const id = tenantId(req);

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      whatsappPhoneNumberId: true,
      settings: true,
      _count: { select: { integrations: true, products: true, teamMembers: true } },
    },
  });

  if (!tenant) { res.status(404).json({ success: false, error: 'Not found' }); return; }

  const s = (tenant.settings ?? {}) as Record<string, unknown>;

  const steps = {
    profile: Boolean(tenant.name && tenant.email),
    whatsapp: Boolean(tenant.whatsappPhoneNumberId && s['waAccessTokenEnc']),
    integration: tenant._count.integrations > 0,
    products: tenant._count.products > 0,
    payments: Boolean(s['paystackSecretKeyEnc'] || s['flutterwaveSecretKeyEnc'] || s['provider'] === 'MANUAL'),
    team: tenant._count.teamMembers > 0,
  };

  const completed = Object.values(steps).filter(Boolean).length;
  const total = Object.keys(steps).length;

  res.json({ success: true, data: { steps, completed, total, pct: Math.round((completed / total) * 100) } });
});

// GET /api/v1/settings/flows — list available bot flows and their enabled state
router.get('/flows', async (req: Request, res: Response) => {
  const id = tenantId(req);
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const s = (tenant?.settings ?? {}) as Record<string, unknown>;
  const disabledFlows = (s['disabledFlows'] as string[] | undefined) ?? [];

  const flows = [
    {
      id: 'main-menu',
      name: 'Main Menu',
      description: 'Entry point shown to customers who say "Hi", "Hello", or trigger the menu.',
      category: 'core',
      canDisable: false,
    },
    {
      id: 'browse',
      name: 'Product Browse',
      description: 'Lets customers browse your product catalog by category and view item details.',
      category: 'commerce',
      canDisable: true,
    },
    {
      id: 'cart',
      name: 'Cart & Checkout',
      description: 'Add items to cart, view cart summary, and proceed to checkout.',
      category: 'commerce',
      canDisable: false,
    },
    {
      id: 'checkout',
      name: 'Order Placement',
      description: 'Collects shipping details and places the order through your connected platform.',
      category: 'commerce',
      canDisable: false,
    },
    {
      id: 'order-status',
      name: 'Order Status',
      description: 'Lets customers check the status of their recent orders by phone number.',
      category: 'support',
      canDisable: true,
    },
    {
      id: 'cart-recovery',
      name: 'Cart Recovery',
      description: 'Re-engages customers who added items but did not complete checkout.',
      category: 'automation',
      canDisable: true,
    },
  ];

  const result = flows.map((f) => ({ ...f, enabled: !disabledFlows.includes(f.id) }));
  res.json({ success: true, data: result });
});

// PATCH /api/v1/settings/flows/:flowId — toggle a flow on/off
router.patch('/flows/:flowId', async (req: Request, res: Response) => {
  const id = tenantId(req);
  const { flowId } = req.params as { flowId: string };
  const { enabled } = req.body as { enabled: boolean };

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const s = (tenant?.settings ?? {}) as Record<string, unknown>;
  let disabledFlows = (s['disabledFlows'] as string[] | undefined) ?? [];

  if (enabled) {
    disabledFlows = disabledFlows.filter((f) => f !== flowId);
  } else {
    if (!disabledFlows.includes(flowId)) disabledFlows.push(flowId);
  }

  await prisma.tenant.update({ where: { id }, data: { settings: { ...s, disabledFlows } } });
  res.json({ success: true, data: { flowId, enabled } });
});

// PATCH /api/v1/settings/onboarding/complete — mark onboarding dismissed
router.patch('/onboarding/complete', async (req: Request, res: Response) => {
  const id = tenantId(req);
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { settings: true } });
  const existing = (tenant?.settings ?? {}) as Record<string, unknown>;
  await prisma.tenant.update({ where: { id }, data: { settings: { ...existing, onboardingComplete: true } } });
  res.json({ success: true });
});

export default router;
