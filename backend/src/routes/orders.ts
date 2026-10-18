import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { computeQuote, splitCommission } from '../lib/pricing';
import { markOrderPaid, orderNumber, restoreStock, syncOrderStatus } from '../lib/orders';
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId, verifyPaymentSignature } from '../lib/razorpay';
import { requireRole } from '../middleware/auth';

export const ordersRouter = Router();
ordersRouter.use(requireRole('CUSTOMER'));

const orderInclude = { items: { include: { merchant: { select: { businessName: true } } } } } as const;

ordersRouter.get(
  '/payment-options',
  ah(async (_req, res) => {
    res.json({ cod: true, razorpay: razorpayConfigured() });
  }),
);

ordersRouter.post(
  '/checkout',
  ah(async (req, res) => {
    const body = z
      .object({
        addressId: z.string().min(1, 'Choose a delivery address'),
        paymentMethod: z.enum(['COD', 'RAZORPAY']),
        couponCode: z.string().trim().max(30).optional(),
      })
      .parse(req.body);
    const userId = req.user!.id;

    if (body.paymentMethod === 'RAZORPAY' && !razorpayConfigured()) {
      throw new HttpError(503, 'Online payment is not configured yet. Please choose Cash on Delivery.');
    }
    const address = await prisma.address.findFirst({ where: { id: body.addressId, userId } });
    if (!address) throw new HttpError(400, 'Choose a valid delivery address');

    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cartItem.findMany({
        where: { userId },
        include: { product: { include: { category: true, merchant: true } } },
      });
      if (cart.length === 0) throw new HttpError(400, 'Your cart is empty');

      // Prices, stock and commissions all come from the database, never from the client.
      for (const { product: p, quantity } of cart) {
        if (p.status !== 'APPROVED' || p.merchant.status !== 'APPROVED' || !p.category.active) {
          throw new HttpError(409, `"${p.name}" is no longer available. Remove it from your cart.`);
        }
        // Conditional decrement: fails atomically instead of overselling under concurrent checkouts.
        const r = await tx.product.updateMany({
          where: { id: p.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity }, soldCount: { increment: quantity } },
        });
        if (r.count === 0) throw new HttpError(409, `Not enough stock for "${p.name}"`);
      }

      const quote = await computeQuote(
        cart.map((c) => ({ price: c.product.price, quantity: c.quantity })),
        body.couponCode || undefined,
      );
      const itemStatus = body.paymentMethod === 'COD' ? 'PLACED' : 'PENDING_PAYMENT';

      const created = await tx.order.create({
        data: {
          number: orderNumber(),
          userId,
          address: {
            name: address.name,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
          },
          subtotal: quote.subtotal,
          discount: quote.discount,
          shippingFee: quote.shippingFee,
          total: quote.total,
          couponCode: quote.coupon,
          paymentMethod: body.paymentMethod,
          status: itemStatus,
          items: {
            create: cart.map(({ product: p, quantity }) => {
              const commissionBps = p.merchant.commissionBps ?? p.category.commissionBps;
              return {
                productId: p.id,
                merchantId: p.merchantId,
                name: p.name,
                image: p.images[0] ?? null,
                price: p.price,
                quantity,
                commissionBps,
                ...splitCommission(p.price * quantity, commissionBps),
                status: itemStatus,
              };
            }),
          },
        },
        include: orderInclude,
      });
      await tx.cartItem.deleteMany({ where: { userId } });
      return created;
    });

    if (body.paymentMethod === 'RAZORPAY') {
      const rz = await createRazorpayOrder(order.total, order.number);
      await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: rz.id } });
      return res.status(201).json({
        order,
        razorpay: { keyId: razorpayKeyId(), orderId: rz.id, amount: order.total, currency: 'INR' },
      });
    }
    res.status(201).json({ order });
  }),
);

ordersRouter.post(
  '/:id/verify-payment',
  ah(async (req, res) => {
    const body = z
      .object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() })
      .parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!order || order.razorpayOrderId !== body.razorpay_order_id) throw new HttpError(404, 'Order not found');
    if (!verifyPaymentSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      throw new HttpError(400, 'Payment signature verification failed');
    }
    await markOrderPaid(body.razorpay_order_id, body.razorpay_payment_id);
    res.json({ ok: true });
  }),
);

ordersRouter.get(
  '/',
  ah(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
      take: 50,
    });
    res.json({ orders });
  }),
);

ordersRouter.get(
  '/:id',
  ah(async (req, res) => {
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: orderInclude });
    if (!order) throw new HttpError(404, 'Order not found');
    res.json({ order });
  }),
);

ordersRouter.post(
  '/:id/cancel',
  ah(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { items: true } });
      if (!order) throw new HttpError(404, 'Order not found');
      const cancellable = order.items.filter((i) => ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED'].includes(i.status));
      if (cancellable.length === 0 || order.items.some((i) => ['SHIPPED', 'DELIVERED'].includes(i.status))) {
        throw new HttpError(409, 'This order can no longer be cancelled');
      }
      await restoreStock(tx, cancellable);
      await tx.orderItem.updateMany({ where: { id: { in: cancellable.map((i) => i.id) } }, data: { status: 'CANCELLED' } });
      await syncOrderStatus(tx, order.id);
      // Paid online orders need a refund through the gateway; admin processes it from the orders screen.
    });
    res.json({ ok: true });
  }),
);

ordersRouter.post(
  '/:id/return',
  ah(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body);
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { items: true } });
      if (!order) throw new HttpError(404, 'Order not found');
      const delivered = order.items.filter((i) => i.status === 'DELIVERED');
      if (delivered.length === 0) throw new HttpError(409, 'Only delivered items can be returned');
      await tx.orderItem.updateMany({ where: { id: { in: delivered.map((i) => i.id) } }, data: { status: 'RETURN_REQUESTED' } });
      await syncOrderStatus(tx, order.id);
      await tx.auditLog.create({
        data: { actorId: req.user!.id, action: 'order.return_requested', entity: 'Order', entityId: order.id, meta: { reason } },
      });
    });
    res.json({ ok: true });
  }),
);
