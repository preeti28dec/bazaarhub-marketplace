'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useShop } from '@/components/providers';
import { ErrorBlock, Field, LoadingBlock, Modal, PageHeader, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { pct } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Category } from '@/lib/types';

export default function AdminCategories() {
  const { toast } = useShop();
  const { data, loading, error, reload } = useApi<{ categories: Category[] }>('/admin/categories');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const all = data?.categories ?? [];
  const roots = all.filter((c) => !c.parentId);

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Commission rates and licence requirements are set per category"
        actions={
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New category
          </button>
        }
      />
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Commission</th>
                <th>Products</th>
                <th>Sellers</th>
                <th>Rules</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roots.flatMap((c) => [c, ...all.filter((s) => s.parentId === c.id)]).map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className={`flex items-center gap-3 ${c.parentId ? 'pl-8' : ''}`}>
                      {!c.parentId && <CategoryIcon name={c.icon} className="h-4 w-4 text-brand-600" />}
                      <span className={c.parentId ? 'text-slate-600' : 'font-semibold'}>{c.name}</span>
                      <span className="font-mono text-xs text-slate-400">{c.slug}</span>
                    </div>
                  </td>
                  <td>{pct(c.commissionBps)}</td>
                  <td>{c._count?.products ?? 0}</td>
                  <td>{c.parentId ? '—' : c._count?.merchantAccess ?? 0}</td>
                  <td className="text-xs">{c.requiresApproval ? <span className="text-amber-700">Explicit approval</span> : '—'}</td>
                  <td>
                    <StatusBadge status={c.active ? 'ACTIVE' : 'CANCELLED'} label={c.active ? 'Active' : 'Inactive'} />
                  </td>
                  <td className="text-right">
                    <button className="btn-ghost p-2" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={editing !== null} title={editing === 'new' ? 'New category' : 'Edit category'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <CategoryForm
            category={editing === 'new' ? null : editing}
            roots={roots}
            onSaved={() => {
              setEditing(null);
              reload();
              toast('Category saved');
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CategoryForm({ category, roots, onSaved }: { category: Category | null; roots: Category[]; onSaved: () => void }) {
  const [f, setF] = useState({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    icon: category?.icon ?? '',
    commission: String((category?.commissionBps ?? 1000) / 100),
    requiresApproval: category?.requiresApproval ?? false,
    active: category?.active ?? true,
    sortOrder: String(category?.sortOrder ?? 0),
    parentId: category?.parentId ?? '',
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
            name: f.name,
            slug: f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            icon: f.icon || undefined,
            commissionBps: Math.round(Number(f.commission) * 100),
            requiresApproval: f.requiresApproval,
            active: f.active,
            sortOrder: Number(f.sortOrder),
            parentId: f.parentId || null,
          };
          await api(category ? `/admin/categories/${category.id}` : '/admin/categories', { method: category ? 'PATCH' : 'POST', body });
          onSaved();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Field label="Name">
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </Field>
      <Field label="Slug" hint="Leave empty to generate">
        <input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
      </Field>
      <Field label="Parent category">
        <select className="input" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
          <option value="">None (top level)</option>
          {roots
            .filter((r) => r.id !== category?.id)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Commission %">
        <input className="input" inputMode="decimal" value={f.commission} onChange={(e) => setF({ ...f, commission: e.target.value })} required />
      </Field>
      <Field label="Icon name" hint="lucide icon, e.g. Shirt">
        <input className="input" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} />
      </Field>
      <Field label="Sort order">
        <input className="input" type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.requiresApproval} onChange={(e) => setF({ ...f, requiresApproval: e.target.checked })} />
        Requires explicit admin approval (even for “all categories” plans)
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        Active (inactive categories hide all their products)
      </label>
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button className="btn-primary">Save category</button>
      </div>
    </form>
  );
}
