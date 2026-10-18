'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, Search, ShoppingBag } from 'lucide-react';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Order, Paged } from '@/lib/types';

const STATUSES = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'PENDING_PAYMENT'];

export default function AdminOrders() {
  const { toast } = useShop();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, error, reload } = useApi<Paged<{ orders: Order[] }>>(`/admin/orders?${new URLSearchParams({ status, q: query, page: String(page) })}`);

  async function handleReturn(o: Order, approve: boolean) {
    try {
      await api(`/admin/orders/${o.id}/return`, { body: { approve } });
      toast(approve ? 'Return approved — stock restored' : 'Return rejected');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Orders & returns" subtitle="Every order across all merchants" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(q);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Order number or customer name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        </form>
        <select
          className="input sm:w-56"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="card overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : !data?.orders.length ? (
          <EmptyState icon={ShoppingBag} title="No orders found" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Commission</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <Fragment key={o.id}>
                      <tr>
                        <td className="w-8">
                          <button onClick={() => setOpen(open === o.id ? null : o.id)} aria-label="Toggle items" className="btn-ghost p-1">
                            <ChevronDown className={`h-4 w-4 transition ${open === o.id ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                        <td className="whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold">{o.number}</p>
                          <p className="text-xs text-slate-500">{dateTime(o.createdAt)}</p>
                        </td>
                        <td>
                          <p>{o.user?.name}</p>
                          <p className="text-xs text-slate-500">{o.user?.email}</p>
                        </td>
                        <td className="whitespace-nowrap font-semibold">{money(o.total)}</td>
                        <td className="whitespace-nowrap text-emerald-700">{money(o.items.reduce((s, i) => s + i.commission, 0))}</td>
                        <td className="whitespace-nowrap text-xs">
                          {o.paymentMethod} · <StatusBadge status={o.paymentStatus} />
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="text-right">
                          {o.status === 'RETURN_REQUESTED' && (
                            <div className="flex justify-end gap-1">
                              <button className="btn-primary btn-sm" onClick={() => handleReturn(o, true)}>
                                Approve return
                              </button>
                              <button className="btn-secondary btn-sm" onClick={() => handleReturn(o, false)}>
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {open === o.id && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50">
                            <ul className="space-y-1 text-sm">
                              {o.items.map((i) => (
                                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className="font-medium">
                                    {i.name} × {i.quantity}
                                  </span>
                                  <span className="text-slate-500">{i.merchant.businessName}</span>
                                  <span>{money(i.price * i.quantity)}</span>
                                  <span className="text-xs text-slate-500">
                                    fee {money(i.commission)} · merchant {money(i.merchantEarning)}
                                  </span>
                                  <StatusBadge status={i.status} />
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs text-slate-500">
                              Ship to: {o.address.name}, {o.address.line1}, {o.address.city} – {o.address.pincode}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4">
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
