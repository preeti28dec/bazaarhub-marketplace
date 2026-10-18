import { Router } from 'express';
import type { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { restoreStock, syncOrderStatus } from '../lib/orders';
import { activeSubscription, assertCategoryAccess } from '../lib/subscription';
import { loadMerchant, requireApprovedMerchant, requireRole } from '../middleware/auth';

export const merchantRouter = Router();
merchantRouter.use(requireRole('MERCHANT'), loadMerchant);

const COUNTED: Prisma.OrderItemWhereInput = { status: { notIn: ['PENDING_PAYMENT', 'CANCELLED', 'RETURNED'] } };

merchantRouter.get(
  '/me',
  ah(async (req, res) => {
    const m = req.merchant!;
    const [subscription, pendingSubscription, categoryAccess, categories, plans, productCount] = await Promise.all([
      activeSubscription(m.id),
      prisma.subscription.findFirst({ where: { merchantId: m.id, status: 'PENDING_PAYMENT' }, include: { plan: true } }),
      prisma.merchantCategory.findMany({ where: { merchantId: m.id }, include: { category: true }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { active: true }, orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.product.count({ where: { merchantId: m.id, status: { not: 'ARCHIVED' } } }),
    ]);
    // Categories the merchant can list in right now (used to populate the product form).
    const granted = new Set(categoryAccess.filter((a) => a.status === 'APPROVED').map((a) => a.categoryId));
    const allAccess = subscription?.plan.maxCategories === 0;
    const byId = new Map(categories.map((c) => [c.id, c]));
    const listable = categories.filter((c) => {
      const root = c.parentId ? byId.get(c.parentId) : c;
      if (!root) return false;
      return granted.has(root.id) || (allAccess && !root.requiresApproval);
    });
    res.json({ merchant: m, subscription, pendingSubscription, categoryAccess, categories, listable, plans, productCount });
  }),
);

merchantRouter.get(
  '/dashboard',
  ah(async (req, res) => {
    const m = req.merchant!;
    const sub = await activeSubscription(m.id);
    const advanced = sub?.plan.features.includes('advanced_analytics') ?? false;
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), advanced ? 365 : 7);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [items, products, lowStock, pending, recentReviews] = await Promise.all([
      prisma.orderItem.findMany({
        where: { merchantId: m.id, ...COUNTED, order: { createdAt: { gte: since } } },
        select: { price: true, quantity: true, merchantEarning: true, orderId: true, order: { select: { createdAt: true } } },
      }),
      prisma.product.groupBy({ by: ['status'], where: { merchantId: m.id }, _count: true }),
      prisma.product.findMany({
        where: { merchantId: m.id, status: 'APPROVED', stock: { lte: 5 } },
        select: { id: true, name: true, stock: true },
        orderBy: { stock: 'asc' },
        take: 6,
      }),
      prisma.orderItem.count({ where: { merchantId: m.id, status: 'PLACED' } }),
      prisma.review.findMany({
        where: { product: { merchantId: m.id } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } }, product: { select: { name: true } } },
      }),
    ]);

    const series = new Map<string, { date: string; revenue: number; orders: Set<string> }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.set(key, { date: key, revenue: 0, orders: new Set() });
    }
    for (const it of items) {
      const point = series.get(it.order.createdAt.toISOString().slice(0, 10));
      if (!point) continue;
      point.revenue += it.price * it.quantity;
      point.orders.add(it.orderId);
    }

    res.json({
      days,
      advanced,
      plan: sub?.plan.name ?? null,
      totals: {
        sales: items.reduce((s, i) => s + i.price * i.quantity, 0),
        earnings: items.reduce((s, i) => s + i.merchantEarning, 0),
        orders: new Set(items.map((i) => i.orderId)).size,
        unitsSold: items.reduce((s, i) => s + i.quantity, 0),
        pendingOrders: pending,
        products: Object.fromEntries(products.map((p) => [p.status, p._count])),
      },
      series: [...series.values()].map((p) => ({ date: p.date, revenue: p.revenue, orders: p.orders.size })),
      lowStock,
      recentReviews,
    });
  }),
);

// ---------- Products ----------

const productSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(5000),
    categoryId: z.string().min(1, 'Choose a category'),
    price: z.number().int().positive().max(1_000_000_000), // paise
    mrp: z.number().int().positive().max(1_000_000_000),
    stock: z.number().int().min(0).max(100_000),
    images: z.array(z.string().trim().url('Enter a valid image URL')).min(1, 'Add at least one image').max(8),
    specs: z.record(z.string().trim().max(200)).optional(),
  })
  .refine((d) => d.mrp >= d.price, { message: 'MRP must be greater than or equal to selling price', path: ['mrp'] });

merchantRouter.get(
  '/products',
  ah(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const products = await prisma.product.findMany({
      where: {
        merchantId: req.merchant!.id,
        ...(status ? { status: status as never } : { status: { not: 'ARCHIVED' } }),
      },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ products });
  }),
);

merchantRouter.post(
  '/products',
  requireApprovedMerchant,
  ah(async (req, res) => {
    const body = productSchema.parse(req.body);
    const m = req.merchant!;
    await assertCategoryAccess(m.id, body.categoryId);
    const sub = await activeSubscription(m.id);
    if (!sub) throw new HttpError(403, 'You need an active subscription plan to list products');
    if (sub.plan.productLimit > 0) {
      const count = await prisma.product.count({ where: { merchantId: m.id, status: { not: 'ARCHIVED' } } });
      if (count >= sub.plan.productLimit) {
        throw new HttpError(403, `Your ${sub.plan.name} plan allows ${sub.plan.productLimit} products. Upgrade to add more.`);
      }
    }
    const product = await prisma.product.create({
      data: { ...body, specs: body.specs ?? undefined, merchantId: m.id, status: 'PENDING' },
    });
    res.status(201).json({ product });
  }),
);

merchantRouter.patch(
  '/products/:id',
  requireApprovedMerchant,
  ah(async (req, res) => {
    const m = req.merchant!;
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, merchantId: m.id } });
    if (!existing || existing.status === 'ARCHIVED') throw new HttpError(404, 'Product not found');
    const body = productSchema.parse(req.body);
    if (body.categoryId !== existing.categoryId) await assertCategoryAccess(m.id, body.categoryId);
    // Content changes go back for admin review; price/stock updates do not.
    const contentChanged =
      body.name !== existing.name ||
      body.description !== existing.description ||
      body.categoryId !== existing.categoryId ||
      body.images.join('|') !== existing.images.join('|');
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...body,
        specs: body.specs ?? undefined,
        ...((contentChanged || existing.status === 'REJECTED') && { status: 'PENDING', rejectionReason: null }),
      },
    });
    res.json({ product });
  }),
);

merchantRouter.delete(
  '/products/:id',
  ah(async (req, res) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, merchantId: req.merchant!.id } });
    if (!existing) throw new HttpError(404, 'Product not found');
    const ordered = await prisma.orderItem.count({ where: { productId: existing.id } });
    if (ordered > 0) {
      // Keep order history intact: archive instead of hard delete.
      await prisma.product.update({ where: { id: existing.id }, data: { status: 'ARCHIVED' } });
    } else {
      await prisma.product.delete({ where: { id: existing.id } });
    }
    res.json({ ok: true });
  }),
);

// ---------- Orders ----------

merchantRouter.get(
  '/orders',
  ah(async (req, res) => {
    const status = typeof req.query.status === 'string' && req.query.status ? (req.query.status as OrderStatus) : undefined;
    const items = await prisma.orderItem.findMany({
      where: { merchantId: req.merchant!.id, status: status ?? { not: 'PENDING_PAYMENT' } },
      include: {
        order: {
          select: { number: true, createdAt: true, paymentMethod: true, paymentStatus: true, address: true, user: { select: { name: true } } },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
      take: 200,
    });
    res.json({ items });
  }),
);

const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
};

merchantRouter.patch(
  '/orders/items/:itemId',
  requireApprovedMerchant,
  ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']) }).parse(req.body);
    await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({ where: { id: req.params.itemId, merchantId: req.merchant!.id } });
      if (!item) throw new HttpError(404, 'Order item not found');
      if (!transitions[item.status]?.includes(status)) {
        throw new HttpError(409, `Cannot change status from ${item.status} to ${status}`);
      }
      if (status === 'CANCELLED') await restoreStock(tx, [item]);
      await tx.orderItem.update({ where: { id: item.id }, data: { status } });
      await syncOrderStatus(tx, item.orderId);
    });
    res.json({ ok: true });
  }),
);

// ---------- Earnings ----------

merchantRouter.get(
  '/earnings',
  ah(async (req, res) => {
    const merchantId = req.merchant!.id;
    const sum = (where: Prisma.OrderItemWhereInput) =>
      prisma.orderItem.aggregate({ where: { merchantId, ...where }, _sum: { merchantEarning: true, commission: true } });
    const [settled, pending, transactions] = await Promise.all([
      sum({ status: 'DELIVERED' }),
      sum({ status: { in: ['PLACED', 'CONFIRMED', 'SHIPPED'] } }),
      prisma.orderItem.findMany({
        where: { merchantId, ...COUNTED },
        include: { order: { select: { number: true, createdAt: true, paymentMethod: true } } },
        orderBy: { order: { createdAt: 'desc' } },
        take: 50,
      }),
    ]);
    res.json({
      settled: settled._sum.merchantEarning ?? 0,
      pending: pending._sum.merchantEarning ?? 0,
      commissionPaid: (settled._sum.commission ?? 0) + (pending._sum.commission ?? 0),
      transactions,
    });
  }),
);

// ---------- Category access & subscription ----------

merchantRouter.post(
  '/category-requests',
  ah(async (req, res) => {
    const { categoryId, note } = z.object({ categoryId: z.string(), note: z.string().trim().max(300).optional() }).parse(req.body);
    const m = req.merchant!;
    const category = await prisma.category.findFirst({ where: { id: categoryId, active: true, parentId: null } });
    if (!category) throw new HttpError(400, 'Category not available');

    const existing = await prisma.merchantCategory.findUnique({ where: { merchantId_categoryId: { merchantId: m.id, categoryId } } });
    if (existing && existing.status !== 'REJECTED') throw new HttpError(409, `Access is already ${existing.status.toLowerCase()}`);

    const sub = await activeSubscription(m.id);
    const limit = sub?.plan.maxCategories ?? 1;
    if (limit > 0) {
      const used = await prisma.merchantCategory.count({ where: { merchantId: m.id, status: { in: ['APPROVED', 'PENDING'] } } });
      if (used >= limit) {
        throw new HttpError(403, `Your plan allows ${limit} categor${limit === 1 ? 'y' : 'ies'}. Upgrade your plan to sell in more.`);
      }
    }
    const access = await prisma.merchantCategory.upsert({
      where: { merchantId_categoryId: { merchantId: m.id, categoryId } },
      create: { merchantId: m.id, categoryId, note, status: 'PENDING' },
      update: { status: 'PENDING', note },
    });
    res.status(201).json({ access });
  }),
);

merchantRouter.post(
  '/subscription',
  ah(async (req, res) => {
    const { planId } = z.object({ planId: z.string() }).parse(req.body);
    const m = req.merchant!;
    const plan = await prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) throw new HttpError(400, 'Plan not available');
    await prisma.subscription.updateMany({ where: { merchantId: m.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });

    if (plan.price === 0) {
      const now = new Date();
      await prisma.subscription.updateMany({ where: { merchantId: m.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
      const subscription = await prisma.subscription.create({
        data: { merchantId: m.id, planId, amount: 0, status: 'ACTIVE', startsAt: now, endsAt: new Date(now.getTime() + plan.durationDays * 86_400_000) },
      });
      return res.status(201).json({ subscription });
    }
    // Paid plan: stays PENDING_PAYMENT until an admin verifies the payment (or a gateway webhook confirms it).
    const subscription = await prisma.subscription.create({ data: { merchantId: m.id, planId, amount: plan.price } });
    res.status(201).json({ subscription });
  }),
);

merchantRouter.patch(
  '/store',
  ah(async (req, res) => {
    const optionalUrl = z.string().trim().url().optional().or(z.literal(''));
    const body = z
      .object({
        description: z.string().trim().max(1000).optional(),
        logoUrl: optionalUrl,
        bannerUrl: optionalUrl,
        businessHours: z.string().trim().max(120).optional(),
        deliveryDays: z.number().int().min(1).max(30),
      })
      .parse(req.body);
    const merchant = await prisma.merchant.update({
      where: { id: req.merchant!.id },
      data: { ...body, logoUrl: body.logoUrl || null, bannerUrl: body.bannerUrl || null },
    });
    res.json({ merchant });
  }),
);
