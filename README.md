# BazaarHub — Multi-vendor marketplace

Next.js 14 (frontend) · Node.js + Express + Prisma (API) · PostgreSQL · Docker Compose

```
marketplace/
├── docker-compose.yml        db + backend + frontend
├── backend/                  Express API (TypeScript)
│   ├── prisma/schema.prisma  all data models
│   └── src/
│       ├── index.ts          app, error handler
│       ├── middleware/auth.ts  sessions + role guards
│       ├── lib/              pricing, commission, orders, subscriptions, razorpay, audit
│       ├── routes/           auth, catalog, cart, account, orders, payments, merchant, admin
│       └── seed.ts           idempotent demo data
└── frontend/                 Next.js App Router (TypeScript, Tailwind, Recharts)
    └── src/app/
        ├── (shop)/           customer storefront
        ├── merchant/         seller dashboard (server-side role guard)
        ├── admin/            admin console (server-side role guard)
        └── api/[...path]/    proxy → backend (keeps session cookie first-party)
```

## Run

```bash
cp .env.example .env        # optional
docker compose up -d --build
```

| Service  | URL                          |
|----------|------------------------------|
| Website  | http://localhost:3000        |
| API      | http://localhost:4000/api    |
| Postgres | localhost:5434 (market / market_dev_pw) |

Demo accounts (password in brackets):

| Role     | Email                | Password      |
|----------|----------------------|---------------|
| Admin    | admin@shop.test      | Admin@123     |
| Merchant | merchant@shop.test   | Merchant@123  (Growth plan: electronics, fashion, jewellery) |
| Merchant | fresh@shop.test      | Merchant@123  (Basic plan: grocery) |
| Merchant | glow@shop.test       | Merchant@123  (Premium: all eligible + healthcare grant) |
| Merchant | pending@shop.test    | Merchant@123  (awaiting approval) |
| Customer | customer@shop.test   | Customer@123  |

Reset all data: `docker compose down -v && docker compose up -d`

Local dev without Docker for the apps: start only `docker compose up -d db`, then
`cd backend && cp .env.example .env && npm i && npx prisma db push && npm run db:seed && npm run dev`
and `cd frontend && npm i && npm run dev`.

## Security & business rules (enforced in the backend)

- **Sessions**: random token in an httpOnly, SameSite=Lax cookie; only its SHA-256 is stored. Passwords hashed with bcrypt. Login/register rate-limited.
- **RBAC**: every `/api/merchant/*` route requires role MERCHANT, `/api/admin/*` requires ADMIN, cart/orders require CUSTOMER. Merchant queries are always scoped to their own `merchantId`. Next.js layouts also redirect on the server, but the API never relies on that.
- **Prices / commission / totals** are read from the DB at checkout; anything the client sends is ignored. Commission = merchant override ?? category rate, frozen on each order item.
- **Inventory**: conditional `UPDATE … WHERE stock >= qty` inside the checkout transaction — concurrent orders cannot oversell. Cancellations/returns restore stock.
- **Category access**: a merchant can list only in categories with an APPROVED grant, or — on an "all categories" plan — in categories not flagged `requiresApproval`. Plan limits (categories, products) are checked on every request.
- **Subscriptions**: paid plans stay `PENDING_PAYMENT` until an admin verifies payment (reference stored in the audit log).
- **Payments**: Razorpay order creation, checkout signature verification and an HMAC-verified webhook (`POST /api/payments/webhook`, raw body).
- **Audit log** for merchant/product/category/plan/coupon/subscription/user admin actions.

## Needs credentials / setup before production

| Feature | Status |
|---|---|
| UPI / cards / net banking | Code ready. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Without them only COD is offered. |
| Image & KYC document upload | Needs S3-compatible storage (presigned uploads). Today products take image URLs. |
| Email / phone OTP verification, notifications | Needs an email/SMS provider. Flags `emailVerified` / `phoneVerified` exist on `User`. |
| Merchant payouts | Earnings are tracked; automated bank payouts need a payouts API (RazorpayX / Cashfree). |
| Refunds for paid online orders | Status is recorded; the money movement needs the gateway refund API. |
| Product variants (size/colour) | Not built yet. |
| DB migrations | Uses `prisma db push` on boot. Before production, run `prisma migrate dev` and switch the Dockerfile to `prisma migrate deploy`. |
| HTTPS | Put a reverse proxy (Caddy/Nginx) in front and set `COOKIE_SECURE=true`. |
