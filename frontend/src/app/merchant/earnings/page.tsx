'use client';

import { Clock, IndianRupee, Percent, Wallet } from 'lucide-react';
import { ErrorBlock, LoadingBlock, PageHeader, StatCard, StatusBadge } from '@/components/ui';
import { date, money, pct } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { OrderStatus } from '@/lib/types';

type Earnings = {
  settled: number;
  pending: number;
  commissionPaid: number;
  transactions: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    commissionBps: number;
    commission: number;
    merchantEarning: number;
    status: OrderStatus;
    order: { number: string; createdAt: string; paymentMethod: string };
  }[];
};

export default function MerchantEarnings() {
  const { data, loading, error, reload } = useApi<Earnings>('/merchant/earnings');
  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Earnings" subtitle="Commission is calculated on the server at the moment an order is placed" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Settled earnings" value={money(data.settled)} icon={Wallet} tone="emerald" hint="From delivered orders" />
        <StatCard label="Pending" value={money(data.pending)} icon={Clock} tone="amber" hint="Orders not yet delivered" />
        <StatCard label="Commission paid" value={money(data.commissionPaid)} icon={Percent} hint="Platform fee" />
      </div>

      <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
        <b>Payouts:</b> automated bank payouts (e.g. RazorpayX / Cashfree Payouts) need payout API credentials. Until then, settled earnings are paid out manually by the platform team.
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <IndianRupee className="h-4 w-4 text-brand-600" />
          <h2 className="font-semibold text-slate-900">Transaction history</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Item</th>
                <th>Sale</th>
                <th>Commission</th>
                <th>Net earning</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{date(t.order.createdAt)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{t.order.number}</td>
                  <td>
                    <span className="line-clamp-1 min-w-[160px]">
                      {t.name} × {t.quantity}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{money(t.price * t.quantity)}</td>
                  <td className="whitespace-nowrap text-rose-600">
                    − {money(t.commission)} <span className="text-xs text-slate-400">({pct(t.commissionBps)})</span>
                  </td>
                  <td className="whitespace-nowrap font-semibold text-emerald-700">{money(t.merchantEarning)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
