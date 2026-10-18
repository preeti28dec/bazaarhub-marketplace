'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, IndianRupee, Lock, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import { OrdersBar, RevenueChart } from '@/components/dashboard/Charts';
import { ErrorBlock, LoadingBlock, PageHeader, Rating, StatCard } from '@/components/ui';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';

type Dashboard = {
  days: number;
  advanced: boolean;
  plan: string | null;
  totals: { sales: number; earnings: number; orders: number; unitsSold: number; pendingOrders: number; products: Record<string, number> };
  series: { date: string; revenue: number; orders: number }[];
  lowStock: { id: string; name: string; stock: number }[];
  recentReviews: { id: string; rating: number; comment: string; createdAt: string; user: { name: string }; product: { name: string } }[];
};

const RANGES = [7, 30, 90];

export default function MerchantOverview() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useApi<Dashboard>(`/merchant/dashboard?days=${days}`);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.totals;

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={data.plan ? `${data.plan} plan · last ${data.days} days` : 'No active plan'}
        actions={
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {RANGES.map((r) => {
              const locked = !data.advanced && r > 7;
              return (
                <button
                  key={r}
                  onClick={() => !locked && setDays(r)}
                  title={locked ? 'Upgrade to Growth for longer ranges' : undefined}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${data.days === r ? 'bg-brand-600 text-white' : locked ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {locked && <Lock className="h-3 w-3" />} {r}D
                </button>
              );
            })}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross sales" value={money(t.sales)} icon={TrendingUp} hint={`${t.unitsSold} units sold`} />
        <StatCard label="Your earnings" value={money(t.earnings)} icon={IndianRupee} tone="emerald" hint="After platform commission" />
        <StatCard label="Orders" value={t.orders} icon={ShoppingBag} tone="sky" hint={`${t.pendingOrders} awaiting confirmation`} />
        <StatCard
          label="Live products"
          value={t.products.APPROVED ?? 0}
          icon={Package}
          tone="amber"
          hint={`${t.products.PENDING ?? 0} pending review · ${t.products.REJECTED ?? 0} rejected`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="font-semibold text-slate-900">Sales</h2>
          <RevenueChart data={data.series} dataKey="revenue" />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Orders per day</h2>
          <OrdersBar data={data.series} />
          {!data.advanced && (
            <p className="mt-3 rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
              Basic analytics shows the last 7 days.{' '}
              <Link href="/merchant/plan" className="font-semibold underline">
                Upgrade
              </Link>{' '}
              for 90-day trends and reports.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock alerts
          </h2>
          {data.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">All products are well stocked.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="line-clamp-1">{p.name}</span>
                  <span className={`font-semibold ${p.stock === 0 ? 'text-rose-600' : 'text-amber-600'}`}>{p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/merchant/products" className="mt-3 inline-block text-sm font-semibold text-brand-700">
            Manage inventory →
          </Link>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Recent reviews</h2>
          {data.recentReviews.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.recentReviews.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Rating value={r.rating} />
                    <span className="font-medium">{r.user.name}</span>
                    <span className="text-xs text-slate-400">on {r.product.name} · {date(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
