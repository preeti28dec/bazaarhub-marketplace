import crypto from 'crypto';
import { HttpError } from './http';

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export const razorpayConfigured = () => Boolean(KEY_ID && KEY_SECRET);
export const razorpayKeyId = () => KEY_ID;

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function createRazorpayOrder(amount: number, receipt: string): Promise<{ id: string }> {
  if (!razorpayConfigured()) throw new HttpError(503, 'Online payments are not configured');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'),
    },
    body: JSON.stringify({ amount, currency: 'INR', receipt }),
  });
  if (!res.ok) throw new HttpError(502, 'Could not start payment with Razorpay');
  return (await res.json()) as { id: string };
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  if (!KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook_secret). */
export function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
