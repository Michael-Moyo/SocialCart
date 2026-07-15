import axios from 'axios';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { decrypt } from '../lib/encryption';
import { notificationService } from './notification.service';
import { whatsappClient } from '../lib/whatsapp-client';

export type PaymentProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'MANUAL';

interface CreatePaymentLinkOptions {
  tenantId: string;
  customerId: string;
  customerPhone: string;
  customerEmail?: string;
  customerName: string;
  amount: number;        // in major currency units (e.g. 5000 NGN)
  currency?: string;
  description: string;
  metadata?: Record<string, unknown>;
  provider?: PaymentProvider;
}

interface PaymentLinkResult {
  url: string;
  reference: string;
  provider: PaymentProvider;
}

// ─── Paystack ─────────────────────────────────────────────────────────────────

async function createPaystackLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
  const key = process.env['PAYSTACK_SECRET_KEY'];
  if (!key) throw new Error('PAYSTACK_SECRET_KEY not configured');

  const reference = `SC_${opts.tenantId.slice(0, 8)}_${Date.now()}`;
  const amountKobo = Math.round(opts.amount * 100); // Paystack uses kobo

  const res = await axios.post<{
    status: boolean;
    data: { authorization_url: string; reference: string };
  }>(
    'https://api.paystack.co/transaction/initialize',
    {
      email: opts.customerEmail ?? `${opts.customerPhone.replace(/\D/g, '')}@whatsapp.socialcart.app`,
      amount: amountKobo,
      currency: opts.currency ?? 'NGN',
      reference,
      callback_url: `${process.env['API_BASE_URL'] ?? 'http://localhost:3001'}/api/v1/payments/paystack/callback`,
      metadata: {
        custom_fields: [
          { display_name: 'Customer', variable_name: 'customer', value: opts.customerName },
          { display_name: 'Phone', variable_name: 'phone', value: opts.customerPhone },
        ],
        tenantId: opts.tenantId,
        customerId: opts.customerId,
        ...opts.metadata,
      },
    },
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
  );

  return {
    url: res.data.data.authorization_url,
    reference: res.data.data.reference,
    provider: 'PAYSTACK',
  };
}

// ─── Flutterwave ──────────────────────────────────────────────────────────────

async function createFlutterwaveLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
  const key = process.env['FLUTTERWAVE_SECRET_KEY'];
  if (!key) throw new Error('FLUTTERWAVE_SECRET_KEY not configured');

  const txRef = `SC_${opts.tenantId.slice(0, 8)}_${Date.now()}`;

  const res = await axios.post<{
    status: string;
    data: { link: string };
  }>(
    'https://api.flutterwave.com/v3/payments',
    {
      tx_ref: txRef,
      amount: opts.amount,
      currency: opts.currency ?? 'NGN',
      redirect_url: `${process.env['API_BASE_URL'] ?? 'http://localhost:3001'}/api/v1/payments/flutterwave/callback`,
      customer: {
        email: opts.customerEmail ?? `${opts.customerPhone.replace(/\D/g, '')}@whatsapp.socialcart.app`,
        phonenumber: opts.customerPhone,
        name: opts.customerName,
      },
      customizations: {
        title: opts.description,
        logo: process.env['STORE_LOGO_URL'] ?? '',
      },
      meta: {
        tenantId: opts.tenantId,
        customerId: opts.customerId,
        ...opts.metadata,
      },
    },
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
  );

  return {
    url: res.data.data.link,
    reference: txRef,
    provider: 'FLUTTERWAVE',
  };
}

// ─── Payment Service ──────────────────────────────────────────────────────────

class PaymentService {
  /** Resolve Paystack secret key for tenant (DB setting takes priority over env) */
  private async getPaystackKey(tenantId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const s = (tenant?.settings ?? {}) as Record<string, unknown>;
    if (s['paystackSecretKeyEnc']) {
      try { return decrypt(s['paystackSecretKeyEnc'] as string); } catch {}
    }
    return process.env['PAYSTACK_SECRET_KEY'] ?? null;
  }

  private async getFlutterwaveKey(tenantId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const s = (tenant?.settings ?? {}) as Record<string, unknown>;
    if (s['flutterwaveSecretKeyEnc']) {
      try { return decrypt(s['flutterwaveSecretKeyEnc'] as string); } catch {}
    }
    return process.env['FLUTTERWAVE_SECRET_KEY'] ?? null;
  }

  /** Detect which provider is configured for a tenant */
  private async detectProvider(tenantId: string): Promise<PaymentProvider> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const s = (tenant?.settings ?? {}) as Record<string, unknown>;
    if (s['provider']) return s['provider'] as PaymentProvider;
    if (s['paystackSecretKeyEnc'] || process.env['PAYSTACK_SECRET_KEY']) return 'PAYSTACK';
    if (s['flutterwaveSecretKeyEnc'] || process.env['FLUTTERWAVE_SECRET_KEY']) return 'FLUTTERWAVE';
    return 'MANUAL';
  }

  async createLink(opts: CreatePaymentLinkOptions): Promise<{
    url: string;
    reference: string;
    paymentLinkId: string;
  }> {
    const provider = opts.provider ?? await this.detectProvider(opts.tenantId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    let result: PaymentLinkResult;

    if (provider === 'PAYSTACK') {
      result = await createPaystackLink(opts);
    } else if (provider === 'FLUTTERWAVE') {
      result = await createFlutterwaveLink(opts);
    } else {
      // MANUAL — return a placeholder link (tenant collects payment offline)
      result = {
        url: `${process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3000'}/pay/manual`,
        reference: `MANUAL_${Date.now()}`,
        provider: 'MANUAL',
      };
    }

    const link = await prisma.paymentLink.create({
      data: {
        tenantId: opts.tenantId,
        customerId: opts.customerId,
        provider,
        externalRef: result.reference,
        amount: opts.amount,
        currency: opts.currency ?? 'NGN',
        url: result.url,
        status: 'PENDING',
        metadata: opts.metadata ?? {},
        expiresAt,
      },
    });

    return { url: result.url, reference: result.reference, paymentLinkId: link.id };
  }

  /** Called by webhook handlers when payment is confirmed */
  async handlePaymentSuccess(externalRef: string, paidAmountMinorUnits?: number): Promise<void> {
    const link = await prisma.paymentLink.findFirst({
      where: { externalRef, status: 'PENDING' },
      include: { customer: true, tenant: true },
    });

    if (!link) return;

    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // If linked to an order, mark it paid
    if (link.orderId) {
      await prisma.order.update({
        where: { id: link.orderId },
        data: { paymentStatus: 'paid', status: 'confirmed' },
      });
    }

    // Send confirmation to customer via WhatsApp
    const currencySymbol = link.currency === 'NGN' ? '₦' : link.currency === 'KES' ? 'KSh' : link.currency === 'ZAR' ? 'R' : '$';
    await whatsappClient.sendNotification(
      link.customer.phone,
      `✅ *Payment Confirmed!*\n\nThank you ${link.customer.name}! We've received your payment of *${currencySymbol}${Number(link.amount).toLocaleString()}*.\n\nYour order is being processed and you'll receive an update shortly. 🛍️`
    );

    // Notify tenant
    await notificationService.notifyNewOrder(
      link.tenantId,
      link.externalRef ?? link.id,
      `${currencySymbol}${Number(link.amount).toLocaleString()}`
    );
  }

  /** Verify Paystack webhook signature */
  verifyPaystackSignature(payload: Buffer, signature: string): boolean {
    const key = process.env['PAYSTACK_SECRET_KEY'] ?? '';
    const hash = crypto.createHmac('sha512', key).update(payload).digest('hex');
    return hash === signature;
  }

  /** Verify Flutterwave webhook signature */
  verifyFlutterwaveSignature(signature: string): boolean {
    const hash = process.env['FLUTTERWAVE_WEBHOOK_HASH'] ?? '';
    return hash !== '' && signature === hash;
  }
}

export const paymentService = new PaymentService();
