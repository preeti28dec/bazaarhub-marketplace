'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Store } from 'lucide-react';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, Field, LoadingBlock, Modal, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, pct } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { MerchantStatus } from '@/lib/types';

type Merchant = {
  id: string;
  businessName: string;
  status: MerchantStatus;
  statusReason: string | null;
  city: string;
  state: string;
  addressLine: string;
  pincode: string;
  pan: string | null;
  gstin: string | null;
  commissionBps: number | null;
  createdAt: string;
  user: { name: string; email: string; phone: string | null };
  categoryAccess: { id: string; status: string; category: { name: string } }[];
  subscriptions: { status: string; plan: { name: string } }[];
  _count: { products: number };
};

export default function MerchantsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Merchants />
    </Suspense>
  );
}

function Merchants() {
  const { toast } = useShop();
  const [status, setStatus] = useState(useSearchParams().get('status') ?? '');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useApi<{ merchants: Merchant[] }>(`/admin/merchants?${new URLSearchParams({ status, q: query })}`);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [reason, setReason] = useState('');
  const [commission, setCommission] = useState('');

  async function setMerchantStatus(m: Merchant, next: MerchantStatus) {
    try {
      await api(`/admin/merchants/${m.id}/status`, { method: 'PATCH', body: { status: next, reason: reason || undefined } });
      toast(`${m.businessName} ${next.toLowerCase()}`);
      setSelected(null);
      setReason('');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function saveCommission(m: Merchant) {
    try {
      const bps = commission.trim() === '' ? null : Math.round(Number(commission) * 100);
      await api(`/admin/merchants/${m.id}/commission`, { method: 'PATCH', body: { commissionBps: bps } });
      toast('Commission updated');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Merchants" subtitle="Verify, approve, suspend and configure sellers" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search business or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search merchants" />
        </form>
        <select className="input sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'].map((s) => (
            <option key={s} value={s}>
              {s[0] + s.slice(1).toLowerCase()}
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
        ) : !data?.merchants.length ? (
          <EmptyState icon={Store} title="No merchants found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Categories</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.merchants.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <p className="font-semibold">{m.businessName}</p>
                      <p className="text-xs text-slate-500">
                        {m.city}, {m.state} · joined {date(m.createdAt)}
                      </p>
                    </td>
                    <td>
                      <p>{m.user.name}</p>
                      <p className="text-xs text-slate-500">{m.user.email}</p>
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {m.subscriptions.map((s) => (
                        <span key={s.plan.name + s.status} className="mr-1">
                          {s.plan.name} {s.status === 'PENDING_PAYMENT' && <span className="text-xs text-amber-600">(unpaid)</span>}
                        </span>
                      ))}
                    </td>
                    <td className="max-w-[220px] text-xs text-slate-600">{m.categoryAccess.map((a) => a.category.name + (a.status !== 'APPROVED' ? ` (${a.status.toLowerCase()})` : '')).join(', ') || '—'}</td>
                    <td>{m._count.products}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="text-right">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setSelected(m);
                          setCommission(m.commissionBps === null ? '' : String(m.commissionBps / 100));
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selected} title={selected?.businessName ?? ''} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <Info k="Owner" v={`${selected.user.name} · ${selected.user.phone ?? '—'}`} />
              <Info k="Email" v={selected.user.email} />
              <Info k="PAN" v={selected.pan ?? '—'} />
              <Info k="GSTIN" v={selected.gstin ?? '—'} />
              <div className="col-span-2">
                <Info k="Address" v={`${selected.addressLine}, ${selected.city}, ${selected.state} – ${selected.pincode}`} />
              </div>
            </dl>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Verify PAN/GSTIN against government records before approving. Uploaded KYC documents will appear here once S3 storage is configured.
            </div>
            <div className="flex items-end gap-2">
              <Field label="Custom commission %" hint={selected.commissionBps === null ? 'Using category rates' : `Currently ${pct(selected.commissionBps)}`}>
                <input className="input" inputMode="decimal" placeholder="Category default" value={commission} onChange={(e) => setCommission(e.target.value)} />
              </Field>
              <button className="btn-secondary mb-[22px]" onClick={() => saveCommission(selected)}>
                Save
              </button>
            </div>
            <Field label="Reason / note (shown to merchant)">
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              {selected.status !== 'APPROVED' && (
                <button className="btn-primary" onClick={() => setMerchantStatus(selected, 'APPROVED')}>
                  Approve
                </button>
              )}
              {selected.status === 'PENDING' && (
                <button className="btn-secondary text-rose-600" onClick={() => setMerchantStatus(selected, 'REJECTED')}>
                  Reject
                </button>
              )}
              {selected.status === 'APPROVED' && (
                <button className="btn-danger" onClick={() => setMerchantStatus(selected, 'SUSPENDED')}>
                  Suspend
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}
