import crypto from 'crypto';
import type { Merchant, Role } from '@prisma/client';
import type { RequestHandler, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ah, HttpError } from '../lib/http';

export type SessionUser = { id: string; name: string; email: string; role: Role; phone: string | null };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      merchant?: Merchant;
    }
  }
}

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 7;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession(res: Response, token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Resolves the session cookie (if any) into req.user. Never trusts role info from the client. */
export const loadUser: RequestHandler = ah(async (req, _res, next) => {
  const token: string | undefined = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const session = await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
    if (session && session.expiresAt > new Date() && session.user.active) {
      const { id, name, email, role, phone } = session.user;
      req.user = { id, name, email, role, phone };
    }
  }
  next();
});

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in'));
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this resource'));
    next();
  };

export const loadMerchant: RequestHandler = ah(async (req, _res, next) => {
  const merchant = await prisma.merchant.findUnique({ where: { userId: req.user!.id } });
  if (!merchant) throw new HttpError(403, 'Merchant profile not found');
  req.merchant = merchant;
  next();
});

export const requireApprovedMerchant: RequestHandler = (req, _res, next) => {
  if (req.merchant?.status !== 'APPROVED') {
    return next(new HttpError(403, 'Your merchant account is not approved yet'));
  }
  next();
};
