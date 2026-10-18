import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { requireAuth, requireRole } from '../middleware/auth';
import { productCardSelect } from './catalog';

export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.patch(
  '/profile',
  ah(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number').optional().or(z.literal('')),
      })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: body.name, phone: body.phone || null },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    res.json({ user });
  }),
);

const addressSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  isDefault: z.boolean().optional(),
});

accountRouter.get(
  '/addresses',
  ah(async (req, res) => {
    const addresses = await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { isDefault: 'desc' } });
    res.json({ addresses });
  }),
);

accountRouter.post(
  '/addresses',
  ah(async (req, res) => {
    const body = addressSchema.parse(req.body);
    const count = await prisma.address.count({ where: { userId: req.user!.id } });
    if (count >= 10) throw new HttpError(400, 'You can save up to 10 addresses');
    const isDefault = body.isDefault || count === 0;
    const address = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
      return tx.address.create({ data: { ...body, isDefault, userId: req.user!.id } });
    });
    res.status(201).json({ address });
  }),
);

accountRouter.delete(
  '/addresses/:id',
  ah(async (req, res) => {
    await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ ok: true });
  }),
);

accountRouter.get(
  '/wishlist',
  requireRole('CUSTOMER'),
  ah(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: productCardSelect } },
    });
    res.json({ items: items.map((i) => i.product), ids: items.map((i) => i.productId) });
  }),
);

accountRouter.post(
  '/wishlist/:productId',
  requireRole('CUSTOMER'),
  ah(async (req, res) => {
    const key = { userId: req.user!.id, productId: req.params.productId };
    const existing = await prisma.wishlistItem.findUnique({ where: { userId_productId: key } });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      return res.json({ wishlisted: false });
    }
    const product = await prisma.product.findFirst({ where: { id: key.productId, status: 'APPROVED' } });
    if (!product) throw new HttpError(404, 'Product not found');
    await prisma.wishlistItem.create({ data: key });
    res.json({ wishlisted: true });
  }),
);
