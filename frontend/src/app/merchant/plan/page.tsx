'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Check, Clock } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useShop } from '@/components/providers';
import { ErrorBlock, LoadingBlock, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, money, pct } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Category, Plan } from '@/lib/types';

type Me = {
  subscription: { id: string; endsAt: string; plan: Plan } | null;
  pendingSubscription: { id: string; plan: Plan; createdAt: string } | null;
  categoryAccess: { id: string; status: string; categoryId: string; category: Category }[];
  categories: Category[];
  plans: Plan[];
};

export default function MerchantPlan() {
  const { toast } = useShop();
  const { data, loading, error, reload } = useApi<Me>('/merchant/me');
  const [busy, setBusy] = useState(false);

  async function choosePlan(p: Plan) {
    setBusy(true);
    try {
      await api('/merchant/subscription', { body: { planId: p.id } });
      toast(p.price === 0 ? `${p.name} activated` : `${p.name} requested — complete payment for admin verification`);
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function requestCategory(c: Category) {
    try {
      await api('/merchant/category-requests', { body: { categoryId: c.id } });
      toast(`Access to ${c.name} requested`);
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  const current = data.subscription?.plan;
  const accessByCat = new Map(data.categoryAccess.map((a) => [a.categoryId, a.status]));
  const roots = data.categories.filter((c) => !c.parentId);
  const allAccess = current?.maxCategories === 0;

  return (
    <div>
      <PageHeader title="Plan & categories" subtitle="Your plan decides how many categories and products you can list" />

      {data.pendingSubscription && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <b>{data.pendingSubscription.plan.name}</b> ({money(data.pendingSubscription.plan.price)}) is awaiting payment verification. Pay via the
            details shared by our team; an admin activates the plan once payment is confirmed. Online plan payments will work automatically once Razorpay is configured.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {data.plans.map((p) => {
          const isCurrent = current?.id === p.id;
          return (
            <div key={p.id} className={clsx('card flex flex-col p-6', isCurrent && 'ring-2 ring-brand-600')}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{p.name}</p>
                {isCurrent && <StatusBadge status="ACTIVE" label="Current" />}
              </div>
              <p className="mt-2 text-3xl font-extrabold">
                {p.price === 0 ? 'Free' : money(p.price)} <span className="text-sm font-medium text-slate-500">/ {p.durationDays} days</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 text-emerald-600" /> {p.maxCategories === 0 ? 'All eligible categories' : `${p.maxCategories} categor${p.maxCategories === 1 ? 'y' : 'ies'}`}
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 text-emerald-600" /> {p.productLimit === 0 ? 'Unlimited products' : `${p.productLimit} products`}
                </li>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="h-4 w-4 text-emerald-600" /> {f.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <p className="mt-5 text-xs text-slate-500">Renews on {date(data.subscription!.endsAt)}</p>
              ) : (
                <button className="btn-secondary mt-5" disabled={busy || data.pendingSubscription?.plan.id === p.id} onClick={() => choosePlan(p)}>
                  {data.pendingSubscription?.plan.id === p.id ? 'Awaiting payment' : 'Switch to this plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">Category access</h2>
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Commission</th>
                <th>Access</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {roots.map((c) => {
                const status = accessByCat.get(c.id);
                const viaPlan = !status && allAccess && !c.requiresApproval;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <CategoryIcon name={c.icon} className="h-4 w-4 text-brand-600" />
                        <span className="font-medium">{c.name}</span>
                        {c.requiresApproval && <span className="text-xs text-amber-600">Licence required</span>}
                      </div>
                    </td>
                    <td>{pct(c.commissionBps)}</td>
                    <td>{status ? <StatusBadge status={status} /> : viaPlan ? <StatusBadge status="APPROVED" label="Included in plan" /> : <span className="text-xs text-slate-400">No access</span>}</td>
                    <td className="text-right">
                      {(!status || status === 'REJECTED') && !viaPlan && (
                        <button className="btn-secondary btn-sm" onClick={() => requestCategory(c)}>
                          Request access
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
