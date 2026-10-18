import Link from 'next/link';
import { ArrowRight, BadgePercent, Store, Zap } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { CategoryIcon } from '@/components/CategoryIcon';
import { serverFetch } from '@/lib/server';
import type { Category, ProductCard as Product } from '@/lib/types';

type List = { items: Product[] };

const tileColors = [
  'bg-emerald-50 text-emerald-700',
  'bg-rose-50 text-rose-700',
  'bg-sky-50 text-sky-700',
  'bg-fuchsia-50 text-fuchsia-700',
  'bg-amber-50 text-amber-700',
  'bg-teal-50 text-teal-700',
  'bg-indigo-50 text-indigo-700',
  'bg-orange-50 text-orange-700',
  'bg-yellow-50 text-yellow-700',
  'bg-slate-100 text-slate-700',
  'bg-violet-50 text-violet-700',
];

export default async function HomePage() {
  const [cats, featured, popular, newest, ids] = await Promise.all([
    serverFetch<{ categories: Category[] }>('/categories'),
    serverFetch<List>('/products?featured=true&limit=8'),
    serverFetch<List>('/products?sort=popular&limit=8'),
    serverFetch<List>('/products?sort=newest&limit=4'),
    serverFetch<{ ids: string[] }>('/account/wishlist'),
  ]);
  const wish = new Set(ids?.ids ?? []);
  const backendDown = !cats;

  return (
    <div>
      {/* Hero */}
      <section className="container-page pt-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-8 text-white sm:p-10 lg:col-span-2">
            <div className="relative z-10 max-w-md">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Zap className="h-3.5 w-3.5" /> Festive Sale · Up to 60% off
              </span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Everything you need, from sellers you trust.</h1>
              <p className="mt-3 text-sm text-brand-100 sm:text-base">Groceries to gadgets, fashion to furniture — delivered fast with secure payments and easy returns.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/products" className="btn bg-white text-brand-700 hover:bg-brand-50">
                  Shop now <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/products?sort=price_asc" className="btn border border-white/30 text-white hover:bg-white/10">
                  View deals
                </Link>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&q=80&auto=format&fit=crop"
              alt=""
              className="absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-40 [mask-image:linear-gradient(to_left,black,transparent)] sm:block"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/products?category=food-grocery" className="group relative overflow-hidden rounded-3xl bg-emerald-600 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">Daily essentials</p>
              <p className="mt-1 text-xl font-bold">Fresh groceries in 30 mins*</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                Order now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
            <Link href="/products?category=electronics" className="group relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gadget fest</p>
              <p className="mt-1 text-xl font-bold">Top electronics from ₹999</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {backendDown && (
        <div className="container-page mt-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Could not reach the API. Start the stack with <code className="font-mono">docker compose up</code> and refresh.
          </div>
        </div>
      )}

      {/* Categories */}
      <section className="container-page mt-12">
        <SectionTitle title="Shop by category" href="/products" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">
          {(cats?.categories ?? []).map((c, i) => (
            <Link key={c.id} href={`/products?category=${c.slug}`} className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center">
              <span className={`flex h-16 w-16 items-center justify-center rounded-2xl transition group-hover:scale-105 ${tileColors[i % tileColors.length]}`}>
                <CategoryIcon name={c.icon} className="h-7 w-7" />
              </span>
              <span className="text-xs font-medium leading-tight text-slate-700">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <ProductSection title="Featured products" subtitle="Hand-picked by our team" href="/products?featured=true" items={featured?.items} wish={wish} />

      {/* Offers strip */}
      <section className="container-page mt-12 grid gap-4 md:grid-cols-3">
        <Offer tone="bg-rose-50 text-rose-900" title="WELCOME10" text="10% off your first order (up to ₹200)" />
        <Offer tone="bg-amber-50 text-amber-900" title="FLAT150" text="₹150 off on orders above ₹999" />
        <Link href="/sell" className="flex items-center gap-4 rounded-2xl bg-brand-50 p-5 text-brand-900 hover:bg-brand-100">
          <Store className="h-8 w-8 shrink-0" />
          <div>
            <p className="font-bold">Sell on BazaarHub</p>
            <p className="text-sm text-brand-700">Reach crores of customers. Start in minutes →</p>
          </div>
        </Link>
      </section>

      <ProductSection title="Best sellers" subtitle="Most loved by customers this month" href="/products?sort=popular" items={popular?.items} wish={wish} />
      <ProductSection title="New arrivals" subtitle="Fresh on the shelves" href="/products?sort=newest" items={newest?.items} wish={wish} />
    </div>
  );
}

function SectionTitle({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <Link href={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800">
        View all →
      </Link>
    </div>
  );
}

function ProductSection({ title, subtitle, href, items, wish }: { title: string; subtitle: string; href: string; items?: Product[]; wish: Set<string> }) {
  if (!items?.length) return null;
  return (
    <section className="container-page mt-12">
      <SectionTitle title={title} subtitle={subtitle} href={href} />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} wishlisted={wish.has(p.id)} />
        ))}
      </div>
    </section>
  );
}

function Offer({ tone, title, text }: { tone: string; title: string; text: string }) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl p-5 ${tone}`}>
      <BadgePercent className="h-8 w-8 shrink-0" />
      <div>
        <p className="font-mono text-lg font-bold">{title}</p>
        <p className="text-sm opacity-80">{text}</p>
      </div>
    </div>
  );
}
