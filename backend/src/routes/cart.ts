import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { computeQuote } from '../lib/pricing';
import { requireRole } from '../middleware/auth';

export const cartRouter = Router();
cartRouter.use(requireRole('CUSTOMER'));

const MAX_PER_ITEM = 10;

async function loadCart(userId: string) {
  return prisma.cartItem.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          mrp: true,
          images: true,
          stock: true,
          status: true,
          merchant: { select: { businessName: true, status: true } },
        },
      },
    },
  });
}

async function cartResponse(userId: string, couponCode?: string) {
  const items = await loadCart(userId);
  const available = items.filter((i) => i.product.status === 'APPROVED' && i.product.merchant.status === 'APPROVED');
  const quote = await computeQuote(
    available.map((i) => ({ price: i.product.price, quantity: i.quantity })),
    couponCode,
  );
  return { items, quote, count: items.reduce((n, i) => n + i.quantity, 0) };
}

cartRouter.get(
  '/',
  ah(async (req, res) => {
    res.json(await cartResponse(req.user!.id));
  }),
);

cartRouter.post(
  '/quote',
  ah(async (req, res) => {
    const { couponCode } = z.object({ couponCode: z.string().trim().max(30).optional() }).parse(req.body);
    res.json(await cartResponse(req.user!.id, couponCode || undefined));
  }),
);

cartRouter.post(
  '/',
  ah(async (req, res) => {
    const body = z.object({ productId: z.string(), quantity: z.number().int().min(1).max(MAX_PER_ITEM).default(1) }).parse(req.body);
    const product = await prisma.product.findFirst({
      where: { id: body.productId, status: 'APPROVED', merchant: { status: 'APPROVED' } },
    });
    if (!product) throw new HttpError(404, 'Product not available');
    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId: product.id } },
    });
    const quantity = Math.min((existing?.quantity ?? 0) + body.quantity, MAX_PER_ITEM, product.stock);
    if (quantity < 1) throw new HttpError(409, 'This product is out of stock');
    await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId: product.id } },
      create: { userId: req.user!.id, productId: product.id, quantity },
      update: { quantity },
    });
    res.json(await cartResponse(req.user!.id));
  }),
);

cartRouter.patch(
  '/:productId',
  ah(async (req, res) => {
    const { quantity } = z.object({ quantity: z.number().int().min(0).max(MAX_PER_ITEM) }).parse(req.body);
    const where = { userId_productId: { userId: req.user!.id, productId: req.params.productId } };
    if (quantity === 0) {
      await prisma.cartItem.deleteMany({ where: { userId: req.user!.id, productId: req.params.productId } });
    } else {
      const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
      if (!product) throw new HttpError(404, 'Product not found');
      if (quantity > product.stock) throw new HttpError(409, `Only ${product.stock} in stock`);
      await prisma.cartItem.update({ where, data: { quantity } });
    }
    res.json(await cartResponse(req.user!.id));
  }),
);

cartRouter.delete(
  '/:productId',
  ah(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { userId: req.user!.id, productId: req.params.productId } });
    res.json(await cartResponse(req.user!.id));
  }),
);
