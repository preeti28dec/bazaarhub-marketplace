import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError, paging } from '../lib/http';
import { audit } from '../lib/audit';
import { restoreStock, syncOrderStatus } from '../lib/orders';
import { requireRole } from '../middleware/auth';

export const adminRouter = Router();
adminRouter.use(requireRole('ADMIN'));

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// ---------- Dashboard ----------

adminRouter.get(
  '/dashboard',
  ah(async (_req, res) => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);
    const live: Prisma.OrderWhereInput = { status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } };

    const [customers, merchants, pendingMerchants, pendingProducts, pendingAccess, pendingSubs, orderAgg, commission, recent, orders, topMerchants] =
      await Promise.all([
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.merchant.count({ where: { status: 'APPROVED' } }),
        prisma.merchant.count({ where: { status: 'PENDING' } }),
        prisma.product.count({ where: { status: 'PENDING' } }),
        prisma.merchantCategory.count({ where: { status: 'PENDING', merchant: { status: 'APPROVED' } } }),
        prisma.subscription.count({ where: { status: 'PENDING_PAYMENT' } }),
        prisma.order.aggregate({ where: live, _sum: { total: true }, _count: true }),
        prisma.orderItem.aggregate({ where: { status: { notIn: ['CANCELLED', 'RETURNED', 'PENDING_PAYMENT'] } }, _sum: { commission: true } }),
        prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { user: { select: { name: true } } } }),
        prisma.order.findMany({ where: { ...live, createdAt: { gte: since } }, select: { total: true, createdAt: true } }),
        prisma.orderItem.groupBy({
          by: ['merchantId'],
          where: { status: { notIn: ['CANCELLED', 'RETURNED', 'PENDING_PAYMENT'] } },
          _sum: { merchantEarning: true, commission: true },
          orderBy: { _sum: { merchantEarning: 'desc' } },
          take: 5,
        }),
      ]);

    const series = new Map<string, { date: string; sales: number; orders: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.set(key, { date: key, sales: 0, orders: 0 });
    }
    for (const o of orders) {
      const p = series.get(o.createdAt.toISOString().slice(0, 10));
      if (p) {
        p.sales += o.total;
        p.orders += 1;
      }
    }
    const names = await prisma.merchant.findMany({
      where: { id: { in: topMerchants.map((t) => t.merchantId) } },
      select: { id: true, businessName: true },
    });
    const nameOf = new Map(names.map((n) => [n.id, n.businessName]));

    res.json({
      totals: {
        sales: orderAgg._sum.total ?? 0,
        orders: orderAgg._count,
        customers,
        merchants,
        platformRevenue: commission._sum.commission ?? 0,
      },
      pending: { merchants: pendingMerchants, products: pendingProducts, categoryAccess: pendingAccess, subscriptions: pendingSubs },
      series: [...series.values()],
      recent,
      topMerchants: topMerchants.map((t) => ({
        merchantId: t.merchantId,
        name: nameOf.get(t.merchantId) ?? '—',
        sales: (t._sum.merchantEarning ?? 0) + (t._sum.commission ?? 0),
        commission: t._sum.commission ?? 0,
      })),
    });
  }),
);

// ---------- Merchants ----------

adminRouter.get(
  '/merchants',
  ah(async (req, res) => {
    const status = str(req.query.status);
    const q = str(req.query.q);
    const merchants = await prisma.merchant.findMany({
      where: {
        ...(status && { status: status as never }),
        ...(q && { OR: [{ businessName: { contains: q, mode: 'insensitive' } }, { user: { email: { contains: q, mode: 'insensitive' } } }] }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        categoryAccess: { include: { category: { select: { name: true } } } },
        subscriptions: { where: { status: { in: ['ACTIVE', 'PENDING_PAYMENT'] } }, include: { plan: { select: { name: true } } } },
        _count: { select: { products: true } },
      },
    });
    res.json({ merchants });
  }),
);

adminRouter.patch(
  '/merchants/:id/status',
  ah(async (req, res) => {
    const body = z.object({ status: z.enum(['APPROVED', 'SUSPENDED', 'REJECTED']), reason: z.string().trim().max(500).optional() }).parse(req.body);
    const merchant = await prisma.$transaction(async (tx) => {
      const m = await tx.merchant.update({ where: { id: req.params.id }, data: { status: body.status, statusReason: body.reason ?? null } });
      // Approving a merchant also approves the categories they applied with.
      if (body.status === 'APPROVED') {
        await tx.merchantCategory.updateMany({ where: { merchantId: m.id, status: 'PENDING' }, data: { status: 'APPROVED' } });
      }
      return m;
    });
    await audit(req.user!.id, `merchant.${body.status.toLowerCase()}`, 'Merchant', merchant.id, { reason: body.reason ?? null });
    res.json({ merchant });
  }),
);

adminRouter.patch(
  '/merchants/:id/commission',
  ah(async (req, res) => {
    const { commissionBps } = z.object({ commissionBps: z.number().int().min(0).max(5000).nullable() }).parse(req.body);
    const merchant = await prisma.merchant.update({ where: { id: req.params.id }, data: { commissionBps } });
    await audit(req.user!.id, 'merchant.commission_set', 'Merchant', merchant.id, { commissionBps });
    res.json({ merchant });
  }),
);

adminRouter.get(
  '/category-requests',
  ah(async (req, res) => {
    const requests = await prisma.merchantCategory.findMany({
      where: { status: (str(req.query.status) as never) ?? 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { name: true } }, merchant: { select: { businessName: true, status: true } } },
    });
    res.json({ requests });
  }),
);

adminRouter.patch(
  '/category-requests/:id',
  ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body);
    const access = await prisma.merchantCategory.update({ where: { id: req.params.id }, data: { status } });
    await audit(req.user!.id, `category_access.${status.toLowerCase()}`, 'MerchantCategory', access.id, {
      merchantId: access.merchantId,
      categoryId: access.categoryId,
    });
    res.json({ access });
  }),
);

// ---------- Subscriptions & plans ----------

adminRouter.get(
  '/subscriptions',
  ah(async (req, res) => {
    const subscriptions = await prisma.subscription.findMany({
      where: { ...(str(req.query.status) && { status: str(req.query.status) as never }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { plan: { select: { name: true } }, merchant: { select: { businessName: true } } },
    });
    res.json({ subscriptions });
  }),
);

adminRouter.post(
  '/subscriptions/:id/activate',
  ah(async (req, res) => {
    const { paymentRef } = z.object({ paymentRef: z.string().trim().min(3, 'Enter the payment reference / UTR').max(100) }).parse(req.body);
    const sub = await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findUnique({ where: { id: req.params.id }, include: { plan: true } });
      if (!s || s.status !== 'PENDING_PAYMENT') throw new HttpError(409, 'Subscription is not awaiting payment');
      await tx.subscription.updateMany({ where: { merchantId: s.merchantId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
      const now = new Date();
      return tx.subscription.update({
        where: { id: s.id },
        data: { status: 'ACTIVE', paymentRef, startsAt: now, endsAt: new Date(now.getTime() + s.plan.durationDays * 86_400_000) },
      });
    });
    await audit(req.user!.id, 'subscription.activated', 'Subscription', sub.id, { paymentRef });
    res.json({ subscription: sub });
  }),
);

adminRouter.post(
  '/subscriptions/:id/reject',
  ah(async (req, res) => {
    const sub = await prisma.subscription.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
    await audit(req.user!.id, 'subscription.rejected', 'Subscription', sub.id);
    res.json({ subscription: sub });
  }),
);

const planSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300),
  price: z.number().int().min(0), // paise
  durationDays: z.number().int().min(1).max(3650),
  productLimit: z.number().int().min(0),
  maxCategories: z.number().int().min(0),
  features: z.array(z.string().trim().min(1).max(60)).max(20),
  active: z.boolean(),
  sortOrder: z.number().int().default(0),
});

adminRouter.get(
  '/plans',
  ah(async (_req, res) => {
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } },
    });
    res.json({ plans });
  }),
);

adminRouter.post(
  '/plans',
  ah(async (req, res) => {
    const plan = await prisma.plan.create({ data: planSchema.parse(req.body) });
    await audit(req.user!.id, 'plan.created', 'Plan', plan.id, { name: plan.name });
    res.status(201).json({ plan });
  }),
);

adminRouter.patch(
  '/plans/:id',
  ah(async (req, res) => {
    const data = planSchema.parse(req.body);
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
    await audit(req.user!.id, 'plan.updated', 'Plan', plan.id, data);
    res.json({ plan });
  }),
);

// ---------- Categories ----------

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug can contain lowercase letters, numbers and dashes'),
  icon: z.string().trim().max(40).optional(),
  imageUrl: z.string().trim().url().optional().or(z.literal('')),
  commissionBps: z.number().int().min(0).max(5000),
  requiresApproval: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  parentId: z.string().nullable().optional(),
});

adminRouter.get(
  '/categories',
  ah(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }],
      include: { _count: { select: { products: true, merchantAccess: { where: { status: 'APPROVED' } } } } },
    });
    res.json({ categories });
  }),
);

adminRouter.post(
  '/categories',
  ah(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: { ...body, imageUrl: body.imageUrl || null } });
    await audit(req.user!.id, 'category.created', 'Category', category.id, { name: category.name });
    res.status(201).json({ category });
  }),
);

adminRouter.patch(
  '/categories/:id',
  ah(async (req, res) => {
    const body = categorySchema.parse(req.body);
    if (body.parentId === req.params.id) throw new HttpError(400, 'A category cannot be its own parent');
    const category = await prisma.category.update({ where: { id: req.params.id }, data: { ...body, imageUrl: body.imageUrl || null } });
    await audit(req.user!.id, 'category.updated', 'Category', category.id, body);
    res.json({ category });
  }),
);

// ---------- Products ----------

adminRouter.get(
  '/products',
  ah(async (req, res) => {
    const { skip, limit, page } = paging(req.query);
    const where: Prisma.ProductWhereInput = {
      ...(str(req.query.status) && { status: str(req.query.status) as never }),
      ...(str(req.query.q) && { name: { contains: str(req.query.q), mode: 'insensitive' } }),
    };
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { merchant: { select: { businessName: true } }, category: { select: { name: true } } },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

adminRouter.patch(
  '/products/:id/status',
  ah(async (req, res) => {
    const body = z.object({ status: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().max(500).optional() }).parse(req.body);
    if (body.status === 'REJECTED' && !body.reason) throw new HttpError(400, 'Give a reason so the merchant can fix the listing');
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: body.status, rejectionReason: body.status === 'REJECTED' ? body.reason : null },
    });
    await audit(req.user!.id, `product.${body.status.toLowerCase()}`, 'Product', product.id, { reason: body.reason ?? null });
    res.json({ product });
  }),
);

adminRouter.patch(
  '/products/:id/featured',
  ah(async (req, res) => {
    const { featured } = z.object({ featured: z.boolean() }).parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { featured } });
    await audit(req.user!.id, featured ? 'product.featured' : 'product.unfeatured', 'Product', product.id);
    res.json({ product });
  }),
);

// ---------- Orders & returns ----------

adminRouter.get(
  '/orders',
  ah(async (req, res) => {
    const { skip, limit, page } = paging(req.query);
    const q = str(req.query.q);
    const where: Prisma.OrderWhereInput = {
      ...(str(req.query.status) && { status: str(req.query.status) as never }),
      ...(q && { OR: [{ number: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }] }),
    };
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } }, items: { include: { merchant: { select: { businessName: true } } } } },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

adminRouter.post(
  '/orders/:id/return',
  ah(async (req, res) => {
    const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!order) throw new HttpError(404, 'Order not found');
      const requested = order.items.filter((i) => i.status === 'RETURN_REQUESTED');
      if (requested.length === 0) throw new HttpError(409, 'No return requested on this order');
      if (approve) await restoreStock(tx, requested);
      await tx.orderItem.updateMany({
        where: { id: { in: requested.map((i) => i.id) } },
        data: { status: approve ? 'RETURNED' : 'DELIVERED' },
      });
      await syncOrderStatus(tx, order.id);
      if (approve && order.paymentStatus === 'PAID') {
        // Records the refund; the actual money movement happens via the gateway / bank transfer.
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED' } });
      }
    });
    await audit(req.user!.id, approve ? 'order.return_approved' : 'order.return_rejected', 'Order', req.params.id);
    res.json({ ok: true });
  }),
);

// ---------- Customers ----------

adminRouter.get(
  '/customers',
  ah(async (req, res) => {
    const q = str(req.query.q);
    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, name: true, email: true, phone: true, active: true, createdAt: true, _count: { select: { orders: true } } },
    });
    res.json({ customers });
  }),
);

adminRouter.patch(
  '/users/:id/active',
  ah(async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    if (req.params.id === req.user!.id) throw new HttpError(400, 'You cannot deactivate your own account');
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { active }, select: { id: true, active: true } });
    if (!active) await prisma.session.deleteMany({ where: { userId: user.id } });
    await audit(req.user!.id, active ? 'user.activated' : 'user.deactivated', 'User', user.id);
    res.json({ user });
  }),
);

// ---------- Coupons ----------

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Use 3–20 letters/numbers'),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['PERCENT', 'FLAT']),
  value: z.number().int().positive(),
  minOrder: z.number().int().min(0).default(0),
  maxDiscount: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
  expiresAt: z.coerce.date().nullable().optional(),
});

adminRouter.get(
  '/coupons',
  ah(async (_req, res) => {
    res.json({ coupons: await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }) });
  }),
);

adminRouter.post(
  '/coupons',
  ah(async (req, res) => {
    const body = couponSchema.parse(req.body);
    if (body.type === 'PERCENT' && body.value > 90) throw new HttpError(400, 'Percentage discount cannot exceed 90%');
    const coupon = await prisma.coupon.create({ data: body });
    await audit(req.user!.id, 'coupon.created', 'Coupon', coupon.id, { code: coupon.code });
    res.status(201).json({ coupon });
  }),
);

adminRouter.patch(
  '/coupons/:id',
  ah(async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: { active } });
    await audit(req.user!.id, active ? 'coupon.activated' : 'coupon.deactivated', 'Coupon', coupon.id);
    res.json({ coupon });
  }),
);

// ---------- Audit log ----------

adminRouter.get(
  '/audit-logs',
  ah(async (req, res) => {
    const { skip, limit, page } = paging(req.query, 50);
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, include: { actor: { select: { name: true, role: true } } } }),
      prisma.auditLog.count(),
    ]);
    res.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);
