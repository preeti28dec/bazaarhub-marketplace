import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;

/** Overall order status is derived from its (multi-vendor) items. */
export function deriveOrderStatus(statuses: OrderStatus[]): OrderStatus {
  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return 'CANCELLED';
  const every = (...allowed: OrderStatus[]) => active.every((s) => allowed.includes(s));
  if (every('RETURNED')) return 'RETURNED';
  if (active.some((s) => s === 'RETURN_REQUESTED')) return 'RETURN_REQUESTED';
  if (every('DELIVERED', 'RETURNED')) return 'DELIVERED';
  if (every('SHIPPED', 'DELIVERED')) return 'SHIPPED';
  if (every('CONFIRMED', 'SHIPPED', 'DELIVERED')) return 'CONFIRMED';
  if (every('PENDING_PAYMENT')) return 'PENDING_PAYMENT';
  return 'PLACED';
}

export async function syncOrderStatus(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const status = deriveOrderStatus(order.items.map((i) => i.status));
  const data: Prisma.OrderUpdateInput = { status };
  // Cash on delivery is collected when everything is delivered.
  if (order.paymentMethod === 'COD' && status === 'DELIVERED') data.paymentStatus = 'PAID';
  await tx.order.update({ where: { id: orderId }, data });
}

export async function restoreStock(tx: Tx, items: { productId: string; quantity: number }[]) {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity }, soldCount: { decrement: item.quantity } },
    });
  }
}

/** Idempotent: called from both the checkout verify endpoint and the signed webhook. */
export async function markOrderPaid(razorpayOrderId: string, paymentId: string, amount?: number) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { razorpayOrderId } });
    if (!order || order.paymentStatus === 'PAID') return order;
    if (amount !== undefined && amount !== order.total) throw new Error(`Amount mismatch for ${order.number}`);
    await tx.orderItem.updateMany({ where: { orderId: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'PLACED' } });
    return tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID', razorpayPaymentId: paymentId, status: 'PLACED' },
    });
  });
}

export const orderNumber = () =>
  'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
