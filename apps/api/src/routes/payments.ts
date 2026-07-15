import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { paymentService } from '../services/payment.service';

const router = Router();

// ─── Authenticated routes ─────────────────────────────────────────────────────

const createLinkSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('NGN'),
  description: z.string().min(1),
  orderId: z.string().uuid().optional(),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'MANUAL']).optional(),
});

// POST /api/v1/payments/links — create a payment link and (optionally) send via WhatsApp
router.post('/links', authMiddleware, validate(createLinkSchema), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { customerId, amount, currency, description, orderId, provider } = req.body as z.infer<typeof createLinkSchema>;

    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const { url, reference, paymentLinkId } = await paymentService.createLink({
      tenantId,
      customerId,
      customerPhone: customer.phone,
      customerEmail: customer.email ?? undefined,
      customerName: customer.name,
      amount,
      currency,
      description,
      metadata: orderId ? { orderId } : undefined,
      provider,
    });

    // Link to order if provided
    if (orderId) {
      await prisma.paymentLink.update({ where: { id: paymentLinkId }, data: { orderId } });
    }

    res.json({ success: true, data: { id: paymentLinkId, url, reference } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/payments/links — list payment links
router.get('/links', authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const status = req.query['status'] as string | undefined;
    const page = Math.max(1, Number(req.query['page'] ?? 1));
    const limit = Math.min(50, Number(req.query['limit'] ?? 20));

    const links = await prisma.paymentLink.findMany({
      where: { tenantId, ...(status ? { status: status as never } : {}) },
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.paymentLink.count({ where: { tenantId } });

    res.json({ success: true, data: links, meta: { total, page, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/payments/config — which provider is active
router.get('/config', authMiddleware, async (req, res) => {
  const hasPaystack = Boolean(process.env['PAYSTACK_SECRET_KEY']);
  const hasFlutterwave = Boolean(process.env['FLUTTERWAVE_SECRET_KEY']);
  res.json({
    success: true,
    data: {
      activeProvider: hasPaystack ? 'PAYSTACK' : hasFlutterwave ? 'FLUTTERWAVE' : 'MANUAL',
      paystack: hasPaystack,
      flutterwave: hasFlutterwave,
    },
  });
});

// ─── Public webhook receivers ─────────────────────────────────────────────────

// POST /api/v1/payments/paystack/webhook
router.post('/paystack/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'] as string ?? '';
  const rawBody: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

  if (!paymentService.verifyPaystackSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  res.status(200).json({ received: true }); // respond immediately

  const event = req.body as { event: string; data: { reference: string; amount: number; status: string } };
  if (event.event === 'charge.success' && event.data.status === 'success') {
    await paymentService.handlePaymentSuccess(event.data.reference, event.data.amount).catch(console.error);
  }
});

// GET /api/v1/payments/paystack/callback — browser redirect after payment
router.get('/paystack/callback', async (req, res, next) => {
  try {
    const reference = req.query['reference'] as string;
    if (reference) {
      // Verify with Paystack API directly
      const axios = (await import('axios')).default;
      const verify = await axios.get<{ data: { status: string } }>(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${process.env['PAYSTACK_SECRET_KEY']}` } }
      );
      if (verify.data.data.status === 'success') {
        await paymentService.handlePaymentSuccess(reference);
      }
    }
    const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3000';
    res.redirect(`${webUrl}/payment/success?ref=${reference ?? ''}`);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/payments/flutterwave/webhook
router.post('/flutterwave/webhook', async (req, res) => {
  const signature = req.headers['verif-hash'] as string ?? '';
  if (!paymentService.verifyFlutterwaveSignature(signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  res.status(200).json({ received: true });

  const event = req.body as { event: string; data: { tx_ref: string; amount: number; status: string } };
  if (event.event === 'charge.completed' && event.data.status === 'successful') {
    await paymentService.handlePaymentSuccess(event.data.tx_ref, event.data.amount).catch(console.error);
  }
});

// GET /api/v1/payments/flutterwave/callback
router.get('/flutterwave/callback', async (req, res, next) => {
  try {
    const txRef = req.query['tx_ref'] as string;
    const status = req.query['status'] as string;
    if (txRef && status === 'successful') {
      await paymentService.handlePaymentSuccess(txRef);
    }
    const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3000';
    res.redirect(`${webUrl}/payment/${status === 'successful' ? 'success' : 'failed'}?ref=${txRef ?? ''}`);
  } catch (err) {
    next(err);
  }
});

export default router;
