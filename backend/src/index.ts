import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from './lib/http';
import { loadUser } from './middleware/auth';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { cartRouter } from './routes/cart';
import { accountRouter } from './routes/account';
import { ordersRouter } from './routes/orders';
import { paymentsRouter } from './routes/payments';
import { merchantRouter } from './routes/merchant';
import { adminRouter } from './routes/admin';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

// Webhook needs the raw body for signature verification, so it is registered before express.json().
app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
app.use('/api/account', accountRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/merchant', merchantRouter);
app.use('/api/admin', adminRouter);
app.use('/api', catalogRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message ?? 'Invalid input', details: err.flatten().fieldErrors });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'A record with these details already exists' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));
