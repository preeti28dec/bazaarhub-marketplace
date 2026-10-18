'use client';

import { useState } from 'react';
import { Bell, LifeBuoy, MapPin, Plus, Trash2, User as UserIcon } from 'lucide-react';
import { AddressForm } from '@/components/AddressForm';
import { RoleGate } from '@/components/RoleGate';
import { useShop } from '@/components/providers';
import { Field, LoadingBlock } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import type { Address, User } from '@/lib/types';

export default function AccountPage() {
  return (
    <RoleGate role="CUSTOMER">
      <Account />
    </RoleGate>
  );
}

function Account() {
  const { user, setUser, toast } = useShop();
  const addresses = useApi<{ addresses: Address[] }>('/account/addresses');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [adding, setAdding] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ user: User }>('/account/profile', { method: 'PATCH', body: { name, phone } });
      setUser({ ...user!, ...r.user });
      toast('Profile updated');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function remove(id: string) {
    await api(`/account/addresses/${id}`, { method: 'DELETE' });
    addresses.reload();
  }

  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <UserIcon className="h-4 w-4 text-brand-600" /> Profile
          </h2>
          <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Mobile number">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} inputMode="tel" />
            </Field>
            <Field label="Email" hint="Email cannot be changed">
              <input className="input bg-slate-50" value={user?.email} disabled />
            </Field>
            <div className="flex items-end">
              <button className="btn-primary">Save changes</button>
            </div>
          </form>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-brand-600" /> Saved addresses
            </h2>
            {!adding && (
              <button className="btn-secondary btn-sm" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>
          {adding && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
              <AddressForm
                onSaved={() => {
                  setAdding(false);
                  addresses.reload();
                }}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
          {addresses.loading && !addresses.data ? (
            <LoadingBlock />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {addresses.data?.addresses.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {a.name} {a.isDefault && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">Default</span>}
                    </p>
                    <button className="text-rose-600" onClick={() => remove(a.id)} aria-label="Delete address">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}
                  </p>
                  <p className="text-slate-500">{a.phone}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Bell className="h-4 w-4 text-brand-600" /> Notifications
          </h3>
          <p className="mt-2 text-sm text-slate-500">Order updates appear on your Orders page. Email/SMS alerts need a mail/SMS provider to be configured.</p>
        </div>
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="h-4 w-4 text-brand-600" /> Help & support
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Write to <a className="font-medium text-brand-700" href="mailto:support@bazaarhub.test">support@bazaarhub.test</a> or call 1800-000-0000 (9 AM–9 PM).
          </p>
        </div>
      </aside>
    </div>
  );
}
