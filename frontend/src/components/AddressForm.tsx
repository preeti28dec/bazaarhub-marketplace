'use client';

import { useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Address } from '@/lib/types';
import { Field } from './ui';

const empty = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export function AddressForm({ onSaved, onCancel }: { onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setErrors({});
        try {
          const { address } = await api<{ address: Address }>('/account/addresses', { body: { ...form, line2: form.line2 || undefined } });
          setForm(empty);
          onSaved(address);
        } catch (err) {
          if (err instanceof ApiError && err.details) setErrors(err.details);
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Full name" error={errors.name?.[0]}>
        <input className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
      </Field>
      <Field label="Mobile number" error={errors.phone?.[0]}>
        <input className="input" value={form.phone} onChange={set('phone')} required inputMode="tel" maxLength={10} autoComplete="tel-national" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address (house no, building, street)" error={errors.line1?.[0]}>
          <input className="input" value={form.line1} onChange={set('line1')} required autoComplete="address-line1" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Locality / landmark (optional)">
          <input className="input" value={form.line2} onChange={set('line2')} autoComplete="address-line2" />
        </Field>
      </div>
      <Field label="City" error={errors.city?.[0]}>
        <input className="input" value={form.city} onChange={set('city')} required autoComplete="address-level2" />
      </Field>
      <Field label="State" error={errors.state?.[0]}>
        <input className="input" value={form.state} onChange={set('state')} required autoComplete="address-level1" />
      </Field>
      <Field label="Pincode" error={errors.pincode?.[0]}>
        <input className="input" value={form.pincode} onChange={set('pincode')} required inputMode="numeric" maxLength={6} autoComplete="postal-code" />
      </Field>
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>
          Save address
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
