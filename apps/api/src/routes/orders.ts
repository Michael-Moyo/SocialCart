import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import { buildPaginatedResponse } from '@socialcart/shared';
import { integrationManager } from '@socialcart/integrations';

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  customerId: z.string().uuid().optional(),
  source: z.enum(['shopify', 'woocommerce', 'odoo', 'erpnext', 'retailman']).optional(),
});

const createOrderSchema = z.object({
  platform: z.enum(['shopify', 'woocommerce', 'odoo', 'erpnext', 'retailman']),
  customer: z.object({
    phone: z.string().min(7),
    email: z.string().email().optional(),
    name: z.string().min(1),
  }),
  lineItems: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
  })).min(1),
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
});

// GET /api/v1/orders
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, status, customerId, source } = req.query as z.infer<typeof listQuerySchema>;
    const tenantId = req.tenantId!;

    const where = {
      tenantId,
      ...(status && { status: status as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' }),
      ...(customerId && { customerId }),
      ...(source && { source: source as 'shopify' | 'woocommerce' | 'odoo' | 'erpnext' | 'retailman' }),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
      }),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(orders, total, page, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params['id']!, tenantId: req.tenantId! },
      include: { customer: true },
    });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders
router.post('/', validate(createOrderSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createOrderSchema>;
    const tenantId = req.tenantId!;

    const connector = integrationManager.getConnector(tenantId, body.platform);
    const externalOrder = await connector.createOrder({
      customer: body.customer,
      lineItems: body.lineItems,
      shippingAddress: body.shippingAddress,
      notes: body.notes,
    });

    // Upsert customer
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId, phone: body.customer.phone } },
      create: {
        tenantId,
        phone: body.customer.phone,
        name: body.customer.name,
        email: body.customer.email,
      },
      update: { name: body.customer.name, email: body.customer.email },
    });

    // Save order
    const order = await prisma.order.create({
      data: {
        tenantId,
        externalId: externalOrder.externalId,
        customerId: customer.id,
        source: body.platform as 'shopify' | 'woocommerce' | 'odoo' | 'erpnext' | 'retailman',
        status: externalOrder.status as 'pending',
        paymentStatus: externalOrder.paymentStatus as 'pending',
        fulfillmentStatus: externalOrder.fulfillmentStatus as 'unfulfilled',
        subtotal: externalOrder.subtotal,
        tax: externalOrder.tax,
        shipping: externalOrder.shipping,
        discount: externalOrder.discount,
        total: externalOrder.total,
        currency: externalOrder.currency,
        items: externalOrder.lineItems,
        shippingAddress: externalOrder.shippingAddress ?? null,
        notes: externalOrder.notes,
      },
    });

    res.status(201).json({ success: true, data: { order, externalOrder } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/orders/:id — update status, tracking, notes
const updateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
  paymentStatus: z.enum(['unpaid', 'paid', 'refunded']).optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
});

router.patch('/:id', validate(updateOrderSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const data = req.body as z.infer<typeof updateOrderSchema>;

    const order = await prisma.order.findFirst({ where: { id, tenantId } });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.paymentStatus && { paymentStatus: data.paymentStatus }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.trackingNumber !== undefined && {
          shippingAddress: {
            ...(order.shippingAddress as Record<string, unknown> ?? {}),
            trackingNumber: data.trackingNumber,
          },
        }),
      },
      include: { customer: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
