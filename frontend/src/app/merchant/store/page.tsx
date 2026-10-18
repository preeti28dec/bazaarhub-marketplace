'use client';

import { useEffect, useState } from 'react';
import { useShop } from '@/components/providers';
import { Field, LoadingBlock, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';

type Merchant = {
  businessName: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  businessHours: string | null;
  deliveryDays: number;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string | null;
  pan: string | null;
};

export default function StoreSettings() {
  const { toast } = useShop();
  const { data } = useApi<{ merchant: Merchant }>('/merchant/me');
  const [form, setForm] = useState({ description: '', logoUrl: '', bannerUrl: '', businessHours: '', deliveryDays: '4' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const m = data?.merchant;
    if (m) {
      setForm({
        description: m.description ?? '',
        logoUrl: m.logoUrl ?? '',
        bannerUrl: m.bannerUrl ?? '',
        businessHours: m.businessHours ?? '',
        deliveryDays: String(m.deliveryDays),
      });
    }
  }, [data]);

  if (!data) return <LoadingBlock />;
  const m = data.merchant;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Store settings" subtitle="How your store appears to customers" />
      <form
        className="card grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/merchant/store', { method: 'PATCH', body: { ...form, deliveryDays: Number(form.deliveryDays) } });
            toast('Store updated');
          } catch (err) {
            toast(errorMessage(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="sm:col-span-2">
          <Field label="About your store">
            <textarea className="input min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        <Field label="Logo URL">
          <input className="input" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://…" />
        </Field>
        <Field label="Banner URL">
          <input className="input" value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://…" />
        </Field>
        <Field label="Business hours">
          <input className="input" value={form.businessHours} onChange={(e) => setForm({ ...form, businessHours: e.target.value })} placeholder="Mon–Sat, 9 AM – 8 PM" />
        </Field>
        <Field label="Typical delivery time (days)">
          <input className="input" type="number" min={1} max={30} value={form.deliveryDays} onChange={(e) => setForm({ ...form, deliveryDays: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={busy}>
            Save settings
          </button>
        </div>
      </form>

      <div className="card mt-6 p-6 text-sm">
        <h2 className="font-semibold text-slate-900">Verified business details</h2>
        <p className="mt-1 text-slate-500">Contact support to change these — they are re-verified by the platform.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info k="Business name" v={m.businessName} />
          <Info k="Address" v={`${m.addressLine}, ${m.city}, ${m.state} – ${m.pincode}`} />
          <Info k="PAN" v={m.pan ?? '—'} />
          <Info k="GSTIN" v={m.gstin ?? '—'} />
        </dl>
      </div>
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
