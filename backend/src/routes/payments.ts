import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { markOrderPaid } from '../lib/orders';
import { verifyWebhookSignature } from '../lib/razorpay';

export const paymentsRouter = Router();

/**
 * Razorpay webhook. Mounted with express.raw() so the HMAC is computed over the exact bytes received.
 * Configure in Razorpay dashboard → Webhooks → https://<your-domain>/api/payments/webhook
 */
paymentsRouter.post(
  '/webhook',
  ah(async (req, res) => {
    const signature = req.header('x-razorpay-signature');
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw) || !signature || !verifyWebhookSignature(raw, signature)) {
      throw new HttpError(400, 'Invalid webhook signature');
    }
    const event = JSON.parse(raw.toString('utf8'));
    const payment = event?.payload?.payment?.entity;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && payment?.order_id) {
      await markOrderPaid(payment.order_id, payment.id, payment.amount);
    } else if (event.event === 'payment.failed' && payment?.order_id) {
      await prisma.order.updateMany({
        where: { razorpayOrderId: payment.order_id, paymentStatus: 'PENDING' },
        data: { paymentStatus: 'FAILED' },
      });
    }
    res.json({ ok: true });
  }),
);
