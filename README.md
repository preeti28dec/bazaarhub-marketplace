# BazaarHub — Multi-vendor E-commerce Marketplace

A full-stack marketplace where **customers** shop, **merchants** sell in the categories they're authorised for, and **admins** run the platform.

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts, lucide icons |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM, Zod validation |
| Database | PostgreSQL 16 |
| Auth | Session cookies (httpOnly), bcrypt, role-based access (ADMIN / MERCHANT / CUSTOMER) |
| Payments | Cash on Delivery + Razorpay (UPI / cards / net banking) when keys are set |
| DevOps | Docker Compose (db + backend + frontend); Vercel-ready |

📹 **Demo video:** [`docs/BazaarHub-demo.mp4`](docs/BazaarHub-demo.mp4) (English narration, ~5 min)

---

## Table of contents
1. [Quick start with Docker (recommended)](#1-quick-start-with-docker-recommended)
2. [Demo accounts](#2-demo-accounts)
3. [Run without Docker (local development)](#3-run-without-docker-local-development)
4. [Environment variables](#4-environment-variables)
5. [Project structure](#5-project-structure)
6. [Features](#6-features)
7. [Security & business rules](#7-security--business-rules)
8. [Deploy to Vercel](#8-deploy-to-vercel)
9. [Enable online payments (Razorpay)](#9-enable-online-payments-razorpay)
10. [Troubleshooting](#10-troubleshooting)
11. [What still needs setup before production](#11-what-still-needs-setup-before-production)

---

## 1. Quick start with Docker (recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) or Docker Engine + Compose v2 (Linux)
- [Git](https://git-scm.com/downloads)
- ~2 GB free disk space, ~1 GB free RAM

### Steps
```bash
# 1. Clone
git clone https://github.com/preeti28dec/bazaarhub-marketplace.git
cd bazaarhub-marketplace

# 2. (Optional) create your env file — defaults work out of the box
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 3. Build and start everything (first run takes 3–6 minutes)
docker compose up -d --build

# 4. Check all three containers are running
docker compose ps
```

Open **http://localhost:3000** 🎉

| Service | URL |
|---|---|
| Website | http://localhost:3000 |
| API | http://localhost:4000/api/health |
| PostgreSQL | `localhost:5434` — user `market`, password `market_dev_pw`, db `marketplace` |

On first start the backend automatically creates the tables and loads demo data (categories, plans, merchants, ~20 products, past orders for charts).

### Everyday commands
```bash
docker compose logs -f backend      # follow API logs
docker compose stop                 # stop (keeps data)
docker compose start                # start again
docker compose up -d --build        # rebuild after code changes
docker compose down -v              # stop AND wipe the database (fresh demo data next start)
```

---

## 2. Demo accounts

The login page also has one-click **Customer / Merchant / Admin** buttons.

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@shop.test` | `Admin@123` | Full platform control |
| Merchant | `merchant@shop.test` | `Merchant@123` | UrbanKart — Growth plan (electronics, fashion, jewellery) |
| Merchant | `fresh@shop.test` | `Merchant@123` | FreshBasket — Basic plan (grocery) |
| Merchant | `glow@shop.test` | `Merchant@123` | GlowUp — Premium (all eligible categories + healthcare) |
| Merchant | `pending@shop.test` | `Merchant@123` | Awaiting admin approval |
| Customer | `customer@shop.test` | `Customer@123` | Has a saved address |

Coupons: `WELCOME10` (10% off up to ₹200, min ₹499), `FLAT150` (₹150 off, min ₹999).

> ⚠️ These are demo credentials. Change `ADMIN_PASSWORD` and set `SEED_DEMO=false` for any real deployment.

---

## 3. Run without Docker (local development)

Hot-reload for both apps. You still need a PostgreSQL database — easiest is to run only the DB container.

### Prerequisites
- Node.js **20+** and npm
- PostgreSQL 14+ (or Docker for just the database)

### Steps
```bash
# 1. Database only
docker compose up -d db          # Postgres on localhost:5434

# 2. Backend  (terminal 1)
cd backend
cp .env.example .env             # DATABASE_URL already points to localhost:5434
npm install                      # also runs `prisma generate`
npx prisma db push               # create tables
npm run db:seed                  # admin + demo data
npm run dev                      # API on http://localhost:4000

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev                      # site on http://localhost:3000
```

The frontend talks to the backend through its own `/api/*` proxy, using `BACKEND_URL` (default `http://localhost:4000`), so no CORS setup is needed.

### Useful scripts
| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | Start API with auto-reload |
| backend | `npm run build && npm start` | Production build/run |
| backend | `npm run typecheck` | TypeScript check |
| backend | `npx prisma studio` | Browse the database in a GUI |
| frontend | `npm run dev` | Start Next.js with hot reload |
| frontend | `npm run build && npm start` | Production build/run |
| frontend | `npm run typecheck` | TypeScript check |

---

## 4. Environment variables

### Root `.env` (read by `docker compose`)
| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `market_dev_pw` | Database password |
| `DB_PORT` | `5434` | Host port for Postgres |
| `SEED_DEMO` | `true` | Load demo data on first start |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@shop.test` / `Admin@123` | First admin account |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `PROXY_SECRET` | *(empty)* | Shared secret between frontend proxy and API (used for per-user rate limiting) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | *(empty)* | Online payments (optional) |

### `backend/.env` (only for running without Docker)
`DATABASE_URL`, `PORT`, plus the same variables as above.

### Frontend
| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:4000` | Where the `/api` proxy forwards requests |
| `PROXY_SECRET` | *(empty)* | Must match the backend value |

---

## 5. Project structure

```
bazaarhub-marketplace/
├── docker-compose.yml           # db + backend + frontend
├── .env.example
├── docs/                        # demo video
├── backend/                     # Express API
│   ├── Dockerfile
│   ├── vercel.json              # Vercel serverless config
│   ├── api/index.ts             # Vercel entry point
│   ├── prisma/schema.prisma     # all database models
│   └── src/
│       ├── app.ts               # Express app (routes, error handler)
│       ├── index.ts             # long-running server (Docker / local)
│       ├── seed.ts              # idempotent seed
│       ├── middleware/auth.ts   # sessions + role guards
│       ├── lib/                 # pricing, commission, orders, subscriptions, razorpay, audit
│       └── routes/              # auth, catalog, cart, account, orders, payments, merchant, admin
└── frontend/                    # Next.js app
    ├── Dockerfile
    └── src/
        ├── app/
        │   ├── (shop)/          # customer pages: home, products, cart, checkout, orders, login, sell…
        │   ├── merchant/        # seller dashboard (server-side role guard)
        │   ├── admin/           # admin console (server-side role guard)
        │   └── api/[...path]/   # proxy → backend
        ├── components/          # UI kit, header, product card, dashboard shell, charts, logo
        └── lib/                 # API client, types, formatters, hooks
```

---

## 6. Features

**Customer:** home page (banners, 11 categories, featured / best sellers / new arrivals) · search, filters, sorting, pagination · product page (gallery, specs, stock, delivery estimate, reviews) · cart · coupons · checkout with saved addresses · order tracking, cancel, return requests · wishlist · profile.

**Merchant:** 3-step registration (plan → categories → business details) · dashboard (sales, earnings, orders, charts, low-stock alerts, reviews) · product CRUD with specs and images · order handling (accept → ship → deliver) · earnings, commission and transaction history · plan upgrade and category access requests · store settings · help.

**Admin:** dashboard (GMV, platform revenue, charts, pending tasks) · approve / reject / suspend merchants, custom commission · category access requests · plans (price, duration, limits, features) and payment verification · product approval and featured products · categories and sub-categories with commission rates · orders and returns · customers · coupons · audit log.

**Responsive:** mobile-first layouts; hamburger menus on the storefront and dashboards; tables scroll horizontally on small screens.

---

## 7. Security & business rules

All enforced in the **backend**, not just the UI:

- **Sessions:** random token in an httpOnly, SameSite=Lax cookie; only its SHA-256 hash is stored. Passwords hashed with bcrypt. Login/registration rate-limited.
- **RBAC:** `/api/admin/*` → ADMIN only, `/api/merchant/*` → MERCHANT only, cart/orders → CUSTOMER only. Merchant queries are always scoped to their own store. Changing the URL in the browser doesn't help — pages also redirect on the server.
- **Prices, discounts, commission and totals** are recalculated from the database at checkout. Values sent by the browser are ignored.
- **No overselling:** stock is decremented with a conditional update inside the checkout transaction. Cancellations and returns restore stock.
- **Category permissions:** merchants can only list in categories they have an approved grant for, or (on "all categories" plans) in categories that don't require explicit approval. Plan limits are checked on every request.
- **Subscriptions:** paid plans stay pending until an admin verifies the payment.
- **Payments:** Razorpay signature verification and an HMAC-verified webhook.
- **Audit log** for important admin actions.

---

## 8. Deploy to Vercel

Vercel runs the frontend and backend as **two separate projects** from this repo. The database must be hosted elsewhere — a free [Neon](https://neon.tech) Postgres works well (Vercel → Storage → Neon).

1. **Create a database** — in Vercel: *Storage → Create Database → Neon*, or at neon.tech. Copy the connection string (`postgresql://…?sslmode=require`).
2. **Load the schema and demo data** from your machine:
   ```bash
   cd backend
   DATABASE_URL="<neon-url>" SEED_DEMO=true npx prisma db push
   DATABASE_URL="<neon-url>" SEED_DEMO=true npm run db:seed
   ```
3. **Backend project** — *Add New → Project →* import the repo, **Root Directory = `backend`**, Framework = *Other*. Environment variables:
   `DATABASE_URL`, `COOKIE_SECURE=true`, `PROXY_SECRET=<random string>`, optional Razorpay keys. Deploy, then check `https://<backend>.vercel.app/api/health`.
4. **Frontend project** — import the repo again, **Root Directory = `frontend`**, Framework = *Next.js*. Environment variables:
   `BACKEND_URL=https://<backend>.vercel.app`, `PROXY_SECRET=<same string>`. Deploy.
5. Open the frontend URL and sign in with a demo account.

With the Vercel CLI instead: `npx vercel login`, then `npx vercel --prod` inside `backend/` and inside `frontend/`, adding the same env vars with `npx vercel env add`.

---

## 9. Enable online payments (Razorpay)

1. Create a Razorpay account and get **test** keys (Dashboard → Settings → API Keys).
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env` (or the Vercel backend project).
3. Add a webhook (Dashboard → Webhooks) pointing to `https://<your-api>/api/payments/webhook` with events `payment.captured`, `order.paid` and `payment.failed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Restart: `docker compose up -d`. The "UPI / Cards / Net banking" option becomes active at checkout.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `port is already allocated` (5434 / 3000 / 4000) | Another app uses that port. Change `DB_PORT` in `.env`, or edit the `ports:` mapping in `docker-compose.yml`. |
| Home page says "Could not reach the API" | Backend is still starting or crashed: `docker compose ps` and `docker compose logs backend`. |
| `failed to connect to the docker API` | Start Docker Desktop and wait until it says "Engine running". |
| Code changes don't show up | Docker images are built once: run `docker compose up -d --build`. For live reload use section 3. |
| Want fresh demo data | `docker compose down -v && docker compose up -d` |
| Signed in but the page says "Please sign in" | Cookie blocked: on HTTP keep `COOKIE_SECURE=false`; on HTTPS set it to `true`. |
| Product images missing | Demo images load from Unsplash and need internet; a placeholder is shown otherwise. |

---

## 11. What still needs setup before production

| Feature | Status |
|---|---|
| Online payments | Code ready — needs Razorpay keys (section 9). |
| Image & KYC document upload | Needs S3-compatible storage. Products currently take image URLs. |
| Email / SMS OTP verification & notifications | Needs an email/SMS provider. |
| Automated merchant payouts | Earnings are tracked; payouts need a payouts API (RazorpayX / Cashfree). |
| Refunds for online payments | Status is recorded; money movement needs the gateway refund API. |
| Product variants (size / colour) | Not built yet. |
| Database migrations | Uses `prisma db push`. Before production run `prisma migrate dev` and switch to `prisma migrate deploy`. |
| HTTPS | Put a reverse proxy (Caddy / Nginx) in front and set `COOKIE_SECURE=true`, or deploy to Vercel. |

---

Made by [@preeti28dec](https://github.com/preeti28dec).
