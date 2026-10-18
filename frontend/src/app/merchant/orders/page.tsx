'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { OrderStatus } from '@/lib/types';

type Item = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  merchantEarning: number;
  status: OrderStatus;
  order: {
    number: string;
    createdAt: string;
    paymentMethod: string;
    paymentStatus: string;
    address: { name: string; city: string; pincode: string };
    user: { name: string };
  };
};

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; danger?: boolean }[]>> = {
  PLACED: [
    { to: 'CONFIRMED', label: 'Accept' },
    { to: 'CANCELLED', label: 'Reject', danger: true },
  ],
  CONFIRMED: [
    { to: 'SHIPPED', label: 'Mark shipped' },
    { to: 'CANCELLED', label: 'Cancel', danger: true },
  ],
  SHIPPED: [{ to: 'DELIVERED', label: 'Mark delivered' }],
};

const FILTERS: [string, string][] = [
  ['', 'All'],
  ['PLACED', 'New'],
  ['CONFIRMED', 'To ship'],
  ['SHIPPED', 'Shipped'],
  ['DELIVERED', 'Delivered'],
  ['CANCELLED', 'Cancelled'],
  ['RETURN_REQUESTED', 'Returns'],
];

export default function MerchantOrders() {
  const [filter, setFilter] = useState('');
  const { toast } = useShop();
  const { data, loading, error, reload } = useApi<{ items: Item[] }>(`/merchant/orders${filter ? `?status=${filter}` : ''}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function move(item: Item, to: OrderStatus) {
    setBusy(item.id);
    try {
      await api(`/merchant/orders/items/${item.id}`, { method: 'PATCH', body: { status: to } });
      toast(`Order ${item.order.number} → ${to.toLowerCase()}`);
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle="Accept, ship and deliver orders for your products" />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${filter === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : !data?.items.length ? (
          <EmptyState icon={ShoppingBag} title="No orders" text="Orders for your products will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Item</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className={busy === it.id ? 'opacity-50' : ''}>
                    <td className="whitespace-nowrap">
                      <p className="font-mono text-xs font-semibold">{it.order.number}</p>
                      <p className="text-xs text-slate-500">{dateTime(it.order.createdAt)}</p>
                    </td>
                    <td>
                      <p className="line-clamp-1 min-w-[160px] font-medium">{it.name}</p>
                      <p className="text-xs text-slate-500">Qty {it.quantity}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <p>{it.order.user.name}</p>
                      <p className="text-xs text-slate-500">
                        {it.order.address.city} – {it.order.address.pincode}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <p className="font-semibold">{money(it.price * it.quantity)}</p>
                      <p className="text-xs text-emerald-600">You earn {money(it.merchantEarning)}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {it.order.paymentMethod === 'COD' ? 'COD' : 'Online'} · <StatusBadge status={it.order.paymentStatus} />
                    </td>
                    <td>
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {NEXT[it.status]?.map((a) => (
                          <button key={a.to} disabled={!!busy} onClick={() => move(it, a.to)} className={`btn-sm ${a.danger ? 'btn-secondary text-rose-600' : 'btn-primary'}`}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
