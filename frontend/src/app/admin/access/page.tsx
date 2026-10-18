'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

type Req = { id: string; status: string; note: string | null; createdAt: string; category: { name: string }; merchant: { businessName: string; status: string } };

export default function AccessRequests() {
  const { toast } = useShop();
  const [status, setStatus] = useState('PENDING');
  const { data, loading, error, reload } = useApi<{ requests: Req[] }>(`/admin/category-requests?status=${status}`);

  async function decide(r: Req, next: 'APPROVED' | 'REJECTED') {
    try {
      await api(`/admin/category-requests/${r.id}`, { method: 'PATCH', body: { status: next } });
      toast(`${r.merchant.businessName}: ${r.category.name} ${next.toLowerCase()}`);
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Category access" subtitle="Merchants can only list in categories approved here (or covered by their plan)" />
      <div className="mb-4 flex gap-1">
        {['PENDING', 'APPROVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {s[0] + s.slice(1).toLowerCase()}
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
        ) : !data?.requests.length ? (
          <EmptyState icon={KeyRound} title="Nothing here" text="No category access requests in this state." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Requested</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="font-medium">{r.merchant.businessName}</p>
                      {r.merchant.status !== 'APPROVED' && <p className="text-xs text-amber-600">Merchant {r.merchant.status.toLowerCase()}</p>}
                    </td>
                    <td>{r.category.name}</td>
                    <td className="whitespace-nowrap">{date(r.createdAt)}</td>
                    <td className="text-xs text-slate-600">{r.note ?? '—'}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status !== 'APPROVED' && (
                          <button className="btn-primary btn-sm" onClick={() => decide(r, 'APPROVED')}>
                            Approve
                          </button>
                        )}
                        {r.status !== 'REJECTED' && (
                          <button className="btn-secondary btn-sm text-rose-600" onClick={() => decide(r, 'REJECTED')}>
                            {r.status === 'APPROVED' ? 'Revoke' : 'Reject'}
                          </button>
                        )}
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
