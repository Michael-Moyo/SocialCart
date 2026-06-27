import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import { buildPaginatedResponse } from '@socialcart/shared';
import { notificationService } from '../services/notification.service';

const LOW_STOCK_THRESHOLD = 5;

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  category: z.string().optional(),
  source: z.enum(['shopify', 'woocommerce', 'odoo', 'erpnext', 'retailman']).optional(),
});

// GET /api/v1/products
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, search, status, category, source } = req.query as z.infer<typeof listQuerySchema>;
    const tenantId = req.tenantId!;

    const where = {
      tenantId,
      ...(status && { status: status as 'active' | 'inactive' | 'draft' }),
      ...(source && { source: source as 'shopify' | 'woocommerce' | 'odoo' | 'erpnext' | 'retailman' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(category && { categories: { has: category } }),
    };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    res.json({ success: true, ...buildPaginatedResponse(products, total, page, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params['id']!, tenantId: req.tenantId! },
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products — create a manual product
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  currency: z.string().length(3).default('NGN'),
  inventory: z.number().int().min(0).default(0),
  categories: z.array(z.string()).optional(),
  images: z.array(z.object({ url: z.string().url(), alt: z.string().optional() })).optional(),
  status: z.enum(['active', 'inactive', 'draft']).default('active'),
});

router.post('/', validate(createProductSchema), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = req.body as z.infer<typeof createProductSchema>;
    const product = await prisma.product.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description ?? '',
        sku: body.sku ?? `MANUAL-${Date.now()}`,
        price: body.price,
        compareAtPrice: body.compareAtPrice,
        currency: body.currency,
        inventory: body.inventory,
        categories: body.categories ?? [],
        images: body.images ?? [],
        status: body.status,
        source: null,
      },
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/products/:id
const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  compareAtPrice: z.number().positive().nullable().optional(),
  inventory: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  categories: z.array(z.string()).optional(),
});

router.patch('/:id', validate(updateProductSchema), async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const body = req.body as z.infer<typeof updateProductSchema>;
    const existing = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.compareAtPrice !== undefined && { compareAtPrice: body.compareAtPrice }),
        ...(body.inventory !== undefined && { inventory: body.inventory }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.categories !== undefined && { categories: body.categories }),
      },
    });

    // Fire low-stock alert when inventory transitions into danger zone
    if (
      body.inventory !== undefined &&
      existing.inventory > LOW_STOCK_THRESHOLD &&
      body.inventory <= LOW_STOCK_THRESHOLD
    ) {
      void notificationService.notifyLowStock(tenantId, product.name, body.inventory);
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const existing = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products/sync
router.post('/sync', async (req, res, next) => {
  try {
    const { syncService } = await import('../services/sync.service');
    const { source } = req.body as { source?: string };

    if (!source) {
      res.status(400).json({ success: false, error: 'source platform is required' });
      return;
    }

    const result = await syncService.syncProducts(
      req.tenantId!,
      source as 'shopify' | 'woocommerce' | 'odoo' | 'erpnext' | 'retailman'
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
