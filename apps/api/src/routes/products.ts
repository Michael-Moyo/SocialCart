import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import { buildPaginatedResponse } from '@socialcart/shared';

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
