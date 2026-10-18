'use client';

import Link from 'next/link';
import { IndianRupee, Landmark, ShoppingBag, Store, Users } from 'lucide-react';
import { OrdersBar, RevenueChart } from '@/components/dashboard/Charts';
import { ErrorBlock, LoadingBlock, PageHeader, StatCard, StatusBadge } from '@/components/ui';
import { dateTime, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Order } from '@/lib/types';

type Dashboard = {
  totals: { sales: number; orders: number; customers: number; merchants: number; platformRevenue: number };
  pending: { merchants: number; products: number; categoryAccess: number; subscriptions: number };
  series: { date: string; sales: number; orders: number }[];
  recent: Order[];
  topMerchants: { merchantId: string; name: string; sales: number; commission: number }[];
};

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi<Dashboard>('/admin/dashboard');
  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;
  const { totals: t, pending: p } = data;

  const tasks = [
    { n: p.merchants, label: 'merchant applications', href: '/admin/merchants?status=PENDING' },
    { n: p.products, label: 'product listings to review', href: '/admin/products?status=PENDING' },
    { n: p.categoryAccess, label: 'category access requests', href: '/admin/access' },
    { n: p.subscriptions, label: 'plan payments to verify', href: '/admin/plans' },
  ].filter((x) => x.n > 0);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Marketplace performance at a glance" />

      {tasks.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tasks.map((x) => (
            <Link key={x.href} href={x.href} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100">
              <b>{x.n}</b> {x.label} →
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total sales (GMV)" value={money(t.sales)} icon={IndianRupee} />
        <StatCard label="Platform revenue" value={money(t.platformRevenue)} icon={Landmark} tone="emerald" hint="Commission earned" />
        <StatCard label="Orders" value={t.orders} icon={ShoppingBag} tone="sky" />
        <StatCard label="Customers" value={t.customers} icon={Users} tone="amber" />
        <StatCard label="Active merchants" value={t.merchants} icon={Store} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="font-semibold text-slate-900">Sales · last 30 days</h2>
          <RevenueChart data={data.series} dataKey="sales" />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Orders · last 30 days</h2>
          <OrdersBar data={data.series} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-brand-700">
              View all
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <p className="font-mono text-xs font-semibold">{o.number}</p>
                      <p className="text-xs text-slate-500">{dateTime(o.createdAt)}</p>
                    </td>
                    <td>{o.user?.name}</td>
                    <td className="font-semibold">{money(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Top merchants</h2>
          <ul className="mt-4 space-y-3">
            {data.topMerchants.map((m, i) => (
              <li key={m.merchantId} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>
                <span className="flex-1 font-medium">{m.name}</span>
                <span className="text-right">
                  <span className="block font-semibold">{money(m.sales)}</span>
                  <span className="block text-xs text-emerald-600">{money(m.commission)} fee</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
