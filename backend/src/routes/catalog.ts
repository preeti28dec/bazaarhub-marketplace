import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { requireRole } from '../middleware/auth';

export const catalogRouter = Router();

export const productCardSelect = {
  id: true,
  name: true,
  price: true,
  mrp: true,
  images: true,
  rating: true,
  ratingCount: true,
  stock: true,
  featured: true,
  merchant: { select: { id: true, businessName: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

/** Only approved products of approved merchants in active categories are publicly visible. */
const visible: Prisma.ProductWhereInput = {
  status: 'APPROVED',
  merchant: { status: 'APPROVED' },
  category: { active: true },
};

catalogRouter.get(
  '/categories',
  ah(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { active: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: { where: { status: 'APPROVED' } } } },
      },
    });
    res.json({ categories });
  }),
);

catalogRouter.get(
  '/plans',
  ah(async (_req, res) => {
    const plans = await prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ plans });
  }),
);

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(80).optional(),
  merchant: z.string().max(40).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  featured: z.enum(['true']).optional(),
  inStock: z.enum(['true']).optional(),
  sort: z.enum(['popular', 'newest', 'price_asc', 'price_desc', 'rating']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const orderBy: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  popular: { soldCount: 'desc' },
  newest: { createdAt: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  rating: { rating: 'desc' },
};

catalogRouter.get(
  '/products',
  ah(async (req, res) => {
    const f = listSchema.parse(req.query);
    const where: Prisma.ProductWhereInput = {
      ...visible,
      ...(f.category && { category: { active: true, OR: [{ slug: f.category }, { parent: { slug: f.category } }] } }),
      ...(f.merchant && { merchantId: f.merchant }),
      ...(f.featured && { featured: true }),
      ...(f.inStock && { stock: { gt: 0 } }),
      ...(f.rating && { rating: { gte: f.rating } }),
      ...((f.minPrice !== undefined || f.maxPrice !== undefined) && {
        price: {
          ...(f.minPrice !== undefined && { gte: Math.round(f.minPrice * 100) }),
          ...(f.maxPrice !== undefined && { lte: Math.round(f.maxPrice * 100) }),
        },
      }),
      ...(f.q && {
        OR: [
          { name: { contains: f.q, mode: 'insensitive' } },
          { description: { contains: f.q, mode: 'insensitive' } },
          { category: { name: { contains: f.q, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [orderBy[f.sort], { id: 'asc' }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
        select: productCardSelect,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ items, total, page: f.page, pages: Math.max(1, Math.ceil(total / f.limit)) });
  }),
);

catalogRouter.get(
  '/products/:id',
  ah(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, ...visible },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        merchant: {
          select: { id: true, businessName: true, description: true, logoUrl: true, city: true, state: true, deliveryDays: true, createdAt: true },
        },
        reviews: { orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true } } } },
      },
    });
    if (!product) throw new HttpError(404, 'Product not found');
    const related = await prisma.product.findMany({
      where: { ...visible, categoryId: product.categoryId, id: { not: product.id } },
      orderBy: { soldCount: 'desc' },
      take: 4,
      select: productCardSelect,
    });
    const days = product.merchant.deliveryDays;
    res.json({ product, related, delivery: { minDays: Math.max(1, days - 1), maxDays: days + 2 } });
  }),
);

catalogRouter.post(
  '/products/:id/reviews',
  requireRole('CUSTOMER'),
  ah(async (req, res) => {
    const body = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(3).max(1000) }).parse(req.body);
    const productId = req.params.id;
    const purchased = await prisma.orderItem.findFirst({
      where: { productId, status: 'DELIVERED', order: { userId: req.user!.id } },
    });
    if (!purchased) throw new HttpError(403, 'You can review products after they are delivered to you');
    await prisma.review.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      create: { userId: req.user!.id, productId, ...body },
      update: body,
    });
    const agg = await prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true });
    await prisma.product.update({
      where: { id: productId },
      data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
    });
    res.status(201).json({ ok: true });
  }),
);
