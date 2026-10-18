import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, RotateCcw, ShieldCheck, Store, Truck } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { Rating } from '@/components/ui';
import { serverFetch } from '@/lib/server';
import { date, discountPct, money } from '@/lib/format';
import type { ProductCard as Card, ProductDetail } from '@/lib/types';
import { Gallery, PurchaseBox, ReviewForm } from './client';

type Data = { product: ProductDetail; related: Card[]; delivery: { minDays: number; maxDays: number } };

export default async function ProductPage({ params }: { params: { id: string } }) {
  const data = await serverFetch<Data>(`/products/${params.id}`);
  if (!data) notFound();
  const { product: p, related, delivery } = data;
  const off = discountPct(p.price, p.mrp);
  const eta = (d: number) => new Date(Date.now() + d * 86_400_000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="container-page py-6">
      <nav className="mb-4 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>{' '}
        /{' '}
        <Link href={`/products?category=${p.category.slug}`} className="hover:text-brand-700">
          {p.category.name}
        </Link>{' '}
        / <span className="text-slate-700">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <Gallery images={p.images} name={p.name} />

        <div>
          <Link href={`/products?merchant=${p.merchant.id}`} className="text-sm font-semibold text-brand-700">
            {p.merchant.businessName}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{p.name}</h1>
          {p.ratingCount > 0 && (
            <div className="mt-3">
              <Rating value={p.rating} count={p.ratingCount} size="md" />
            </div>
          )}
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-900">{money(p.price)}</span>
            {off > 0 && (
              <>
                <span className="text-lg text-slate-400 line-through">{money(p.mrp)}</span>
                <span className="text-lg font-semibold text-emerald-600">{off}% off</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">Inclusive of all taxes</p>

          <p className={`mt-4 text-sm font-semibold ${p.stock === 0 ? 'text-rose-600' : p.stock <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {p.stock === 0 ? 'Out of stock' : p.stock <= 5 ? `Hurry, only ${p.stock} left!` : 'In stock'}
          </p>

          <PurchaseBox productId={p.id} stock={p.stock} />

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                Delivery by <b>{eta(delivery.minDays)}</b> – {eta(delivery.maxDays)}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> 7-day easy returns
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Secure payments
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.description}</p>
          </section>

          {p.specs && Object.keys(p.specs).length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900">Specifications</h2>
              <dl className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
                {Object.entries(p.specs).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-3 gap-4 px-4 py-2.5">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="col-span-2 font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="card mt-6 flex items-start gap-4 p-5">
            <span className="rounded-xl bg-brand-50 p-3 text-brand-600">
              <Store className="h-6 w-6" />
            </span>
            <div className="text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                {p.merchant.businessName} <BadgeCheck className="h-4 w-4 text-brand-600" />
              </p>
              <p className="text-slate-500">
                {p.merchant.city}, {p.merchant.state} · Selling since {date(p.merchant.createdAt)}
              </p>
              {p.merchant.description && <p className="mt-2 text-slate-600">{p.merchant.description}</p>}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Ratings & reviews</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {p.reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
            {p.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <Rating value={r.rating} />
                  <span className="text-sm font-semibold text-slate-800">{r.user.name}</span>
                  <span className="text-xs text-slate-400">· {date(r.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{r.comment}</p>
              </div>
            ))}
          </div>
          <ReviewForm productId={p.id} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-bold text-slate-900">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
