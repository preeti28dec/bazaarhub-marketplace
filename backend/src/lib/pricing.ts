import { prisma } from './prisma';
import { HttpError } from './http';

export const FREE_SHIPPING_MIN = 49_900; // ₹499
export const SHIPPING_FEE = 4_000; // ₹40

export type Line = { price: number; quantity: number };

export async function computeQuote(lines: Line[], couponCode?: string) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  let discount = 0;
  let appliedCoupon: string | null = null;

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      throw new HttpError(400, 'This coupon is invalid or has expired');
    }
    if (subtotal < coupon.minOrder) {
      throw new HttpError(400, `Add items worth ₹${(coupon.minOrder / 100).toFixed(0)} or more to use ${coupon.code}`);
    }
    discount = coupon.type === 'PERCENT' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);
    appliedCoupon = coupon.code;
  }

  const afterDiscount = subtotal - discount;
  const shippingFee = subtotal === 0 || afterDiscount >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
  return { subtotal, discount, shippingFee, total: afterDiscount + shippingFee, coupon: appliedCoupon };
}

/** Commission is always resolved on the server: merchant override, else category rate. */
export function splitCommission(lineTotal: number, bps: number) {
  const commission = Math.round((lineTotal * bps) / 10_000);
  return { commission, merchantEarning: lineTotal - commission };
}
