'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { Check, CheckCircle2, Package } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { RoleGate } from '@/components/RoleGate';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Order, OrderStatus } from '@/lib/types';

const STEPS: OrderStatus[] = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

export default function OrdersPage() {
  return (
    <RoleGate role="CUSTOMER">
      <Suspense fallback={<LoadingBlock />}>
        <Orders />
      </Suspense>
    </RoleGate>
  );
}

function Orders() {
  const placed = useSearchParams().get('placed');
  const { toast } = useShop();
  const { data, loading, error, reload } = useApi<{ orders: Order[] }>('/orders');
  const [returning, setReturning] = useState<Order | null>(null);
  const [reason, setReason] = useState('');

  async function cancel(o: Order) {
    if (!window.confirm(`Cancel order ${o.number}?`)) return;
    try {
      await api(`/orders/${o.id}/cancel`, { method: 'POST' });
      toast('Order cancelled');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function requestReturn() {
    if (!returning) return;
    try {
      await api(`/orders/${returning.id}/return`, { body: { reason } });
      toast('Return requested. We will contact you shortly.');
      setReturning(null);
      setReason('');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">My orders</h1>
      {placed && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> Order <b>{placed}</b> confirmed. You&apos;ll get updates here as sellers process it.
        </div>
      )}
      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data?.orders.length ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title="No orders yet"
            text="When you place an order it will show up here."
            action={
              <Link href="/products" className="btn-primary">
                Browse products
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {data.orders.map((o) => {
            const step = STEPS.indexOf(o.status);
            const canCancel = ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED'].includes(o.status);
            return (
              <div key={o.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    <span>
                      <span className="text-slate-500">Order</span> <b className="font-mono">{o.number}</b>
                    </span>
                    <span className="text-slate-500">{dateTime(o.createdAt)}</span>
                    <span>
                      <span className="text-slate-500">Total</span> <b>{money(o.total)}</b>
                    </span>
                    <span className="text-slate-500">
                      {o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online'} · <StatusBadge status={o.paymentStatus} />
                    </span>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                {step >= 0 && (
                  <ol className="flex items-center gap-2 px-5 pt-4" aria-label="Order progress">
                    {STEPS.map((s, i) => (
                      <li key={s} className="flex flex-1 items-center gap-2">
                        <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs', i <= step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500')}>
                          {i <= step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className={clsx('hidden text-xs font-medium sm:block', i <= step ? 'text-slate-900' : 'text-slate-400')}>{s[0] + s.slice(1).toLowerCase()}</span>
                        {i < STEPS.length - 1 && <span className={clsx('h-0.5 flex-1 rounded', i < step ? 'bg-brand-600' : 'bg-slate-200')} />}
                      </li>
                    ))}
                  </ol>
                )}

                <ul className="divide-y divide-slate-100 px-5">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-4 py-4">
                      <Link href={`/products/${it.productId}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <ProductImage src={it.image} alt={it.name} className="h-full w-full" />
                      </Link>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="line-clamp-1 font-semibold text-slate-900">{it.name}</p>
                        <p className="text-slate-500">
                          Qty {it.quantity} · {money(it.price)} · {it.merchant.businessName}
                        </p>
                      </div>
                      <StatusBadge status={it.status} />
                    </li>
                  ))}
                </ul>

                {(canCancel || o.status === 'DELIVERED') && (
                  <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
                    {canCancel && (
                      <button className="btn-secondary btn-sm text-rose-600" onClick={() => cancel(o)}>
                        Cancel order
                      </button>
                    )}
                    {o.status === 'DELIVERED' && (
                      <button className="btn-secondary btn-sm" onClick={() => setReturning(o)}>
                        Request return
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!returning} title={`Return order ${returning?.number ?? ''}`} onClose={() => setReturning(null)}>
        <label className="label" htmlFor="reason">
          Why are you returning this order?
        </label>
        <textarea id="reason" className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Size doesn't fit, item damaged…" />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setReturning(null)}>
            Close
          </button>
          <button className="btn-primary" disabled={reason.trim().length < 5} onClick={requestReturn}>
            Submit request
          </button>
        </div>
      </Modal>
    </div>
  );
}
