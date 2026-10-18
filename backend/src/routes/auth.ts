import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';
import { createSession, destroySession, SESSION_COOKIE } from '../middleware/auth';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const publicUser = { id: true, name: true, email: true, role: true, phone: true } as const;
const email = z.string().trim().toLowerCase().email('Enter a valid email');
const password = z.string().min(8, 'Password must be at least 8 characters').max(100);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const name = z.string().trim().min(2, 'Name is too short').max(80);

async function assertEmailFree(value: string) {
  if (await prisma.user.findUnique({ where: { email: value } })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
}

authRouter.post(
  '/register',
  limiter,
  ah(async (req, res) => {
    const body = z.object({ name, email, password, phone: phone.optional() }).parse(req.body);
    await assertEmailFree(body.email);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: 'CUSTOMER', // role is never taken from the request body
        passwordHash: await bcrypt.hash(body.password, 12),
      },
      select: publicUser,
    });
    await createSession(res, user.id);
    res.status(201).json({ user });
  }),
);

const merchantSchema = z.object({
  name,
  email,
  password,
  phone,
  businessName: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN'),
  planId: z.string().min(1, 'Choose a plan'),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category').max(20),
});

authRouter.post(
  '/register-merchant',
  limiter,
  ah(async (req, res) => {
    const body = merchantSchema.parse(req.body);
    await assertEmailFree(body.email);

    const plan = await prisma.plan.findFirst({ where: { id: body.planId, active: true } });
    if (!plan) throw new HttpError(400, 'Selected plan is not available');
    const categoryIds = [...new Set(body.categoryIds)];
    if (plan.maxCategories > 0 && categoryIds.length > plan.maxCategories) {
      throw new HttpError(400, `${plan.name} allows up to ${plan.maxCategories} categor${plan.maxCategories === 1 ? 'y' : 'ies'}`);
    }
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds }, active: true, parentId: null } });
    if (categories.length !== categoryIds.length) throw new HttpError(400, 'One or more categories are invalid');

    const now = new Date();
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: 'MERCHANT',
        passwordHash: await bcrypt.hash(body.password, 12),
        merchant: {
          create: {
            businessName: body.businessName,
            phone: body.phone,
            addressLine: body.addressLine,
            city: body.city,
            state: body.state,
            pincode: body.pincode,
            gstin: body.gstin || null,
            pan: body.pan,
            status: 'PENDING',
            categoryAccess: { create: categoryIds.map((categoryId) => ({ categoryId, status: 'PENDING' as const })) },
            subscriptions: {
              create: {
                planId: plan.id,
                amount: plan.price,
                // Free plans activate immediately; paid plans wait for verified payment.
                status: plan.price === 0 ? 'ACTIVE' : 'PENDING_PAYMENT',
                startsAt: plan.price === 0 ? now : null,
                endsAt: plan.price === 0 ? new Date(now.getTime() + plan.durationDays * 86_400_000) : null,
              },
            },
          },
        },
      },
      select: publicUser,
    });
    await createSession(res, user.id);
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  limiter,
  ah(async (req, res) => {
    const body = z.object({ email, password: z.string().min(1).max(100) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same message either way so emails can't be enumerated.
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    if (!user.active) throw new HttpError(403, 'This account has been deactivated. Contact support.');
    await createSession(res, user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } });
  }),
);

authRouter.post(
  '/logout',
  ah(async (req, res) => {
    await destroySession(res, req.cookies?.[SESSION_COOKIE]);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  ah(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const merchant =
      req.user.role === 'MERCHANT'
        ? await prisma.merchant.findUnique({
            where: { userId: req.user.id },
            select: { id: true, businessName: true, status: true },
          })
        : null;
    res.json({ user: { ...req.user, merchant } });
  }),
);
