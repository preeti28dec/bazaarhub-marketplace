'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useShop } from '@/components/providers';
import { ErrorBlock, Field, LoadingBlock, Modal, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  active: boolean;
  expiresAt: string | null;
};

export default function AdminCoupons() {
  const { toast } = useShop();
  const { data, loading, error, reload } = useApi<{ coupons: Coupon[] }>('/admin/coupons');
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ code: '', description: '', type: 'PERCENT', value: '', minOrder: '0', maxDiscount: '', expiresAt: '' });
  const [formError, setFormError] = useState<string | null>(null);

  async function toggle(c: Coupon) {
    try {
      await api(`/admin/coupons/${c.id}`, { method: 'PATCH', body: { active: !c.active } });
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api('/admin/coupons', {
        body: {
          code: f.code,
          description: f.description || undefined,
          type: f.type,
          value: f.type === 'PERCENT' ? Number(f.value) : Math.round(Number(f.value) * 100),
          minOrder: Math.round(Number(f.minOrder || 0) * 100),
          maxDiscount: f.maxDiscount ? Math.round(Number(f.maxDiscount) * 100) : null,
          expiresAt: f.expiresAt || null,
        },
      });
      toast(`Coupon ${f.code.toUpperCase()} created`);
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Coupons & offers"
        subtitle="Coupons are validated and applied on the server at checkout"
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New coupon
          </button>
        }
      />
      <div className="card overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min order</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.coupons.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-mono font-semibold">{c.code}</p>
                      <p className="text-xs text-slate-500">{c.description}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      {c.type === 'PERCENT' ? `${c.value}%` : money(c.value)}
                      {c.maxDiscount && <span className="text-xs text-slate-500"> (max {money(c.maxDiscount)})</span>}
                    </td>
                    <td>{money(c.minOrder)}</td>
                    <td>{c.expiresAt ? date(c.expiresAt) : 'Never'}</td>
                    <td>
                      <StatusBadge status={c.active ? 'ACTIVE' : 'CANCELLED'} label={c.active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="text-right">
                      <button className="btn-secondary btn-sm" onClick={() => toggle(c)}>
                        {c.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={creating} title="New coupon" onClose={() => setCreating(false)}>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label="Code">
            <input className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
          </Field>
          <Field label="Type">
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="PERCENT">Percentage</option>
              <option value="FLAT">Flat amount</option>
            </select>
          </Field>
          <Field label={f.type === 'PERCENT' ? 'Discount %' : 'Discount (₹)'}>
            <input className="input" inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required />
          </Field>
          <Field label="Minimum order (₹)">
            <input className="input" inputMode="decimal" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} />
          </Field>
          <Field label="Max discount (₹, optional)">
            <input className="input" inputMode="decimal" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} />
          </Field>
          <Field label="Expires on (optional)">
            <input className="input" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
          </div>
          {formError && <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p>}
          <div className="sm:col-span-2">
            <button className="btn-primary">Create coupon</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
