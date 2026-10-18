'use client';

import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date } from '@/lib/format';
import { useApi } from '@/lib/hooks';

type Customer = { id: string; name: string; email: string; phone: string | null; active: boolean; createdAt: string; _count: { orders: number } };

export default function AdminCustomers() {
  const { toast } = useShop();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useApi<{ customers: Customer[] }>(`/admin/customers?q=${encodeURIComponent(query)}`);

  async function toggle(c: Customer) {
    try {
      await api(`/admin/users/${c.id}/active`, { method: 'PATCH', body: { active: !c.active } });
      toast(c.active ? `${c.name} deactivated and signed out` : `${c.name} reactivated`);
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Customers" />
      <form
        className="relative mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      </form>
      <div className="card overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : !data?.customers.length ? (
          <EmptyState icon={Users} title="No customers found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td>{c._count.orders}</td>
                    <td className="whitespace-nowrap">{date(c.createdAt)}</td>
                    <td>
                      <StatusBadge status={c.active ? 'ACTIVE' : 'SUSPENDED'} label={c.active ? 'Active' : 'Deactivated'} />
                    </td>
                    <td className="text-right">
                      <button className={`btn-secondary btn-sm ${c.active ? 'text-rose-600' : ''}`} onClick={() => toggle(c)}>
                        {c.active ? 'Deactivate' : 'Reactivate'}
                      </button>
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
