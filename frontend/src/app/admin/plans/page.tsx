'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useShop } from '@/components/providers';
import { ErrorBlock, Field, LoadingBlock, Modal, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Plan } from '@/lib/types';

type Sub = { id: string; status: string; amount: number; createdAt: string; paymentRef: string | null; plan: { name: string }; merchant: { businessName: string } };

const FEATURES = ['basic_analytics', 'advanced_analytics', 'promotions', 'priority_support'];

export default function PlansPage() {
  const { toast } = useShop();
  const plans = useApi<{ plans: Plan[] }>('/admin/plans');
  const subs = useApi<{ subscriptions: Sub[] }>('/admin/subscriptions?status=PENDING_PAYMENT');
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [activating, setActivating] = useState<Sub | null>(null);
  const [ref, setRef] = useState('');

  async function activate() {
    if (!activating) return;
    try {
      await api(`/admin/subscriptions/${activating.id}/activate`, { body: { paymentRef: ref } });
      toast(`${activating.merchant.businessName} is now on ${activating.plan.name}`);
      setActivating(null);
      setRef('');
      subs.reload();
      plans.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function reject(s: Sub) {
    try {
      await api(`/admin/subscriptions/${s.id}/reject`, { method: 'POST' });
      subs.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Plans & subscriptions"
        subtitle="Prices, limits and category access are fully configurable"
        actions={
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New plan
          </button>
        }
      />

      {plans.loading && !plans.data ? (
        <LoadingBlock />
      ) : plans.error ? (
        <ErrorBlock message={plans.error} onRetry={plans.reload} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data?.plans.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <div className="flex items-center gap-2">
                  {!p.active && <StatusBadge status="CANCELLED" label="Inactive" />}
                  <button className="btn-ghost p-1.5" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-2xl font-bold">
                {money(p.price)} <span className="text-sm font-normal text-slate-500">/ {p.durationDays}d</span>
              </p>
              <dl className="mt-3 space-y-1 text-sm text-slate-600">
                <div>Categories: {p.maxCategories === 0 ? 'All eligible' : p.maxCategories}</div>
                <div>Products: {p.productLimit === 0 ? 'Unlimited' : p.productLimit}</div>
                <div>Features: {p.features.join(', ') || '—'}</div>
                <div className="pt-1 font-medium text-slate-900">{p._count?.subscriptions ?? 0} active merchants</div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">Payments awaiting verification</h2>
      <div className="card overflow-hidden">
        {subs.data?.subscriptions.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No pending plan payments.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Requested</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subs.data?.subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.merchant.businessName}</td>
                    <td>{s.plan.name}</td>
                    <td>{money(s.amount)}</td>
                    <td>{date(s.createdAt)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-primary btn-sm" onClick={() => setActivating(s)}>
                          Verify & activate
                        </button>
                        <button className="btn-secondary btn-sm text-rose-600" onClick={() => reject(s)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!activating} title="Verify payment" onClose={() => setActivating(null)}>
        <p className="mb-4 text-sm text-slate-600">
          Confirm you have received <b>{activating && money(activating.amount)}</b> from <b>{activating?.merchant.businessName}</b>. The reference is stored in the audit log.
        </p>
        <Field label="Payment reference / UTR">
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={ref.trim().length < 3} onClick={activate}>
            Activate plan
          </button>
        </div>
      </Modal>

      <Modal open={editing !== null} title={editing === 'new' ? 'New plan' : `Edit ${editing?.name ?? ''}`} onClose={() => setEditing(null)}>
        {editing !== null && (
          <PlanForm
            plan={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              plans.reload();
              toast('Plan saved');
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function PlanForm({ plan, onSaved }: { plan: Plan | null; onSaved: () => void }) {
  const [f, setF] = useState({
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    price: plan ? String(plan.price / 100) : '',
    durationDays: String(plan?.durationDays ?? 30),
    productLimit: String(plan?.productLimit ?? 25),
    maxCategories: String(plan?.maxCategories ?? 1),
    features: plan?.features ?? ['basic_analytics'],
    active: plan?.active ?? true,
    sortOrder: String(plan?.sortOrder ?? 0),
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          const body = {
            ...f,
            price: Math.round(Number(f.price) * 100),
            durationDays: Number(f.durationDays),
            productLimit: Number(f.productLimit),
            maxCategories: Number(f.maxCategories),
            sortOrder: Number(f.sortOrder),
          };
          await api(plan ? `/admin/plans/${plan.id}` : '/admin/plans', { method: plan ? 'PATCH' : 'POST', body });
          onSaved();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Field label="Name">
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </Field>
      <Field label="Price (₹)">
        <input className="input" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
      <Field label="Duration (days)">
        <input className="input" type="number" min={1} value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: e.target.value })} />
      </Field>
      <Field label="Sort order">
        <input className="input" type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
      </Field>
      <Field label="Product limit" hint="0 = unlimited">
        <input className="input" type="number" min={0} value={f.productLimit} onChange={(e) => setF({ ...f, productLimit: e.target.value })} />
      </Field>
      <Field label="Max categories" hint="0 = all eligible categories">
        <input className="input" type="number" min={0} value={f.maxCategories} onChange={(e) => setF({ ...f, maxCategories: e.target.value })} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="label">Features</legend>
        <div className="flex flex-wrap gap-3">
          {FEATURES.map((x) => (
            <label key={x} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={f.features.includes(x)}
                onChange={(e) => setF({ ...f, features: e.target.checked ? [...f.features, x] : f.features.filter((y) => y !== x) })}
              />
              {x.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        Available for new subscriptions
      </label>
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button className="btn-primary">Save plan</button>
      </div>
    </form>
  );
}
