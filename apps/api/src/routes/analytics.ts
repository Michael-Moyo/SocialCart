import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/v1/analytics/overview?period=30d
router.get('/overview', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const days = Number(req.query['days'] ?? 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const prevSince = new Date(Date.now() - 2 * days * 24 * 60 * 60 * 1000);

    const [
      orders,
      prevOrders,
      conversations,
      prevConversations,
      customers,
      prevCustomers,
      paidLinks,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: since } },
        select: { total: true, status: true, createdAt: true, paymentStatus: true },
      }),
      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: prevSince, lt: since } },
        select: { total: true },
      }),
      prisma.conversation.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { tenantId, createdAt: { gte: prevSince, lt: since } } }),
      prisma.customer.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.customer.count({ where: { tenantId, createdAt: { gte: prevSince, lt: since } } }),
      prisma.paymentLink.findMany({
        where: { tenantId, status: 'PAID', paidAt: { gte: since } },
        select: { amount: true, currency: true },
      }),
    ]);

    const revenue = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + Number(o.total), 0);
    const prevRevenue = prevOrders.reduce((sum, o) => sum + Number(o.total), 0);

    const paymentRevenue = paidLinks.reduce((sum, p) => sum + Number(p.amount), 0);

    function pct(curr: number, prev: number) {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    }

    res.json({
      success: true,
      data: {
        revenue: { value: revenue + paymentRevenue, change: pct(revenue, prevRevenue) },
        orders: { value: orders.length, change: pct(orders.length, prevOrders.length) },
        conversations: { value: conversations, change: pct(conversations, prevConversations) },
        newCustomers: { value: customers, change: pct(customers, prevCustomers) },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/revenue-chart?days=30
router.get('/revenue-chart', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const days = Math.min(90, Number(req.query['days'] ?? 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: since }, paymentStatus: 'paid' },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const paymentLinks = await prisma.paymentLink.findMany({
      where: { tenantId, status: 'PAID', paidAt: { gte: since } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    // Build daily buckets
    const buckets: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86400000);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }

    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += Number(o.total);
    }
    for (const p of paymentLinks) {
      const key = (p.paidAt ?? new Date()).toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += Number(p.amount);
    }

    const chart = Object.entries(buckets).map(([date, revenue]) => ({ date, revenue }));
    res.json({ success: true, data: chart });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/conversion-funnel
router.get('/conversion-funnel', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [conversations, openConversations, carts, convertedCarts, paidOrders] = await Promise.all([
      prisma.conversation.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { tenantId, status: { in: ['OPEN', 'BOT'] }, createdAt: { gte: since } } }),
      prisma.cart.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.cart.count({ where: { tenantId, status: 'CONVERTED', createdAt: { gte: since } } }),
      prisma.order.count({ where: { tenantId, paymentStatus: 'paid', createdAt: { gte: since } } }),
    ]);

    res.json({
      success: true,
      data: [
        { stage: 'Conversations', count: conversations },
        { stage: 'Active chats', count: openConversations },
        { stage: 'Carts created', count: carts },
        { stage: 'Checkout started', count: convertedCarts },
        { stage: 'Paid', count: paidOrders },
      ],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/top-products?limit=10
router.get('/top-products', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const limit = Math.min(20, Number(req.query['limit'] ?? 10));
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: since }, paymentStatus: 'paid' },
      select: { items: true },
    });

    const productMap: Record<string, { name: string; revenue: number; units: number }> = {};
    for (const order of orders) {
      const items = order.items as Array<{ name?: string; sku?: string; quantity?: number; total?: number; price?: number }>;
      for (const item of items) {
        const key = item.sku ?? item.name ?? 'Unknown';
        if (!productMap[key]) productMap[key] = { name: item.name ?? key, revenue: 0, units: 0 };
        productMap[key]!.revenue += Number(item.total ?? (item.price ?? 0) * (item.quantity ?? 1));
        productMap[key]!.units += item.quantity ?? 1;
      }
    }

    const topProducts = Object.entries(productMap)
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    res.json({ success: true, data: topProducts });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/payment-stats
router.get('/payment-stats', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, paid, expired, pending] = await Promise.all([
      prisma.paymentLink.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.paymentLink.count({ where: { tenantId, status: 'PAID', createdAt: { gte: since } } }),
      prisma.paymentLink.count({ where: { tenantId, status: 'EXPIRED', createdAt: { gte: since } } }),
      prisma.paymentLink.count({ where: { tenantId, status: 'PENDING', createdAt: { gte: since } } }),
    ]);

    const paidLinks = await prisma.paymentLink.findMany({
      where: { tenantId, status: 'PAID', createdAt: { gte: since } },
      select: { amount: true, provider: true },
    });

    const byProvider: Record<string, number> = {};
    for (const l of paidLinks) {
      byProvider[l.provider] = (byProvider[l.provider] ?? 0) + Number(l.amount);
    }

    res.json({
      success: true,
      data: {
        total,
        paid,
        expired,
        pending,
        conversionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
        revenueByProvider: byProvider,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
