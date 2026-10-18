'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2, Package } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, Field, LoadingBlock, Modal, PageHeader, StatusBadge } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Category, ProductStatus } from '@/lib/types';

type MerchantProduct = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  category: { name: string };
  price: number;
  mrp: number;
  stock: number;
  images: string[];
  specs: Record<string, string> | null;
  status: ProductStatus;
  rejectionReason: string | null;
};

type Me = {
  merchant: { status: string };
  listable: Category[];
  subscription: { plan: { name: string; productLimit: number } } | null;
  productCount: number;
};

const TABS: [string, string][] = [
  ['', 'All'],
  ['APPROVED', 'Live'],
  ['PENDING', 'In review'],
  ['REJECTED', 'Rejected'],
];

export default function MerchantProducts() {
  const [tab, setTab] = useState('');
  const { toast } = useShop();
  const me = useApi<Me>('/merchant/me');
  const list = useApi<{ products: MerchantProduct[] }>(`/merchant/products${tab ? `?status=${tab}` : ''}`);
  const [editing, setEditing] = useState<MerchantProduct | 'new' | null>(null);

  async function remove(p: MerchantProduct) {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await api(`/merchant/products/${p.id}`, { method: 'DELETE' });
      toast('Product removed');
      list.reload();
      me.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  const sub = me.data?.subscription;
  const approved = me.data?.merchant.status === 'APPROVED';
  const limit = sub?.plan.productLimit ?? 0;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={sub ? `${me.data?.productCount} of ${limit === 0 ? 'unlimited' : limit} listings used on ${sub.plan.name}` : 'Activate a plan to start listing'}
        actions={
          <button className="btn-primary" disabled={!approved || !sub} onClick={() => setEditing('new')} title={!approved ? 'Available after approval' : undefined}>
            <Plus className="h-4 w-4" /> Add product
          </button>
        }
      />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {list.loading && !list.data ? (
          <LoadingBlock />
        ) : list.error ? (
          <div className="p-5">
            <ErrorBlock message={list.error} onRetry={list.reload} />
          </div>
        ) : !list.data?.products.length ? (
          <EmptyState icon={Package} title="No products here" text="Add your first product — it goes live after a quick admin review." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <ProductImage src={p.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-lg" />
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium text-slate-900">{p.name}</p>
                          {p.status === 'REJECTED' && p.rejectionReason && <p className="line-clamp-1 text-xs text-rose-600">{p.rejectionReason}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{p.category.name}</td>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold">{money(p.price)}</span> <span className="text-xs text-slate-400 line-through">{money(p.mrp)}</span>
                    </td>
                    <td className={p.stock <= 5 ? 'font-semibold text-amber-600' : ''}>{p.stock}</td>
                    <td>
                      <StatusBadge status={p.status} label={p.status === 'APPROVED' ? 'Live' : p.status === 'PENDING' ? 'In review' : undefined} />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost p-2" onClick={() => setEditing(p)} disabled={!approved} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost p-2 text-rose-600" onClick={() => remove(p)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
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

      <Modal open={editing !== null} wide title={editing === 'new' ? 'Add product' : 'Edit product'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <ProductForm
            product={editing === 'new' ? null : editing}
            categories={me.data?.listable ?? []}
            onSaved={() => {
              setEditing(null);
              list.reload();
              me.reload();
              toast(editing === 'new' ? 'Product submitted for review' : 'Product updated');
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ProductForm({ product, categories, onSaved }: { product: MerchantProduct | null; categories: Category[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    price: product ? String(product.price / 100) : '',
    mrp: product ? String(product.mrp / 100) : '',
    stock: product ? String(product.stock) : '',
    images: product?.images.length ? product.images : [''],
    specs: Object.entries(product?.specs ?? {}).map(([k, v]) => ({ k, v })),
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const body = {
      name: form.name,
      description: form.description,
      categoryId: form.categoryId,
      price: Math.round(Number(form.price) * 100),
      mrp: Math.round(Number(form.mrp) * 100),
      stock: Number(form.stock),
      images: form.images.map((s) => s.trim()).filter(Boolean),
      specs: Object.fromEntries(form.specs.filter((s) => s.k.trim() && s.v.trim()).map((s) => [s.k.trim(), s.v.trim()])),
    };
    try {
      await api(product ? `/merchant/products/${product.id}` : '/merchant/products', { method: product ? 'PATCH' : 'POST', body });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (categories.length === 0) {
    return <p className="text-sm text-slate-600">You don&apos;t have access to any category yet. Request access from “Plan & categories”.</p>;
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Product name" error={errors.name?.[0]}>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Category" error={errors.categoryId?.[0]} hint="Only categories you're authorised for are listed">
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Select category</option>
            {roots.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (general)</option>
                {childrenOf(c.id).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Selling price (₹)" error={errors.price?.[0]}>
        <input className="input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
      </Field>
      <Field label="MRP (₹)" error={errors.mrp?.[0]}>
        <input className="input" inputMode="decimal" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} required />
      </Field>
      <Field label="Stock quantity" error={errors.stock?.[0]}>
        <input className="input" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description" error={errors.description?.[0]}>
          <textarea className="input min-h-28" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <span className="label">Image URLs (up to 8)</span>
        <div className="space-y-2">
          {form.images.map((src, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                placeholder="https://…"
                value={src}
                onChange={(e) => setForm({ ...form, images: form.images.map((s, j) => (j === i ? e.target.value : s)) })}
                aria-label={`Image ${i + 1} URL`}
              />
              {form.images.length > 1 && (
                <button type="button" className="btn-ghost p-2" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} aria-label="Remove image">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {form.images.length < 8 && (
          <button type="button" className="btn-ghost btn-sm mt-2 text-brand-700" onClick={() => setForm({ ...form, images: [...form.images, ''] })}>
            <Plus className="h-3.5 w-3.5" /> Add image
          </button>
        )}
        <p className="mt-1 text-xs text-slate-500">Direct file upload needs S3-compatible storage to be configured — paste hosted image URLs for now.</p>
        {errors.images?.[0] && <p className="mt-1 text-xs text-rose-600">{errors.images[0]}</p>}
      </div>
      <div className="sm:col-span-2">
        <span className="label">Specifications</span>
        <div className="space-y-2">
          {form.specs.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="e.g. Material" value={s.k} onChange={(e) => setForm({ ...form, specs: form.specs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)) })} aria-label="Specification name" />
              <input className="input" placeholder="e.g. Cotton" value={s.v} onChange={(e) => setForm({ ...form, specs: form.specs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)) })} aria-label="Specification value" />
              <button type="button" className="btn-ghost p-2" onClick={() => setForm({ ...form, specs: form.specs.filter((_, j) => j !== i) })} aria-label="Remove specification">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost btn-sm mt-2 text-brand-700" onClick={() => setForm({ ...form, specs: [...form.specs, { k: '', v: '' }] })}>
          <Plus className="h-3.5 w-3.5" /> Add specification
        </button>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{error}</p>}
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p className="text-xs text-slate-500">Changes to name, description, images or category are re-reviewed by an admin.</p>
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : product ? 'Save changes' : 'Submit for review'}
        </button>
      </div>
    </form>
  );
}
