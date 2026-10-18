'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { BarChart3, Check, FileCheck2, IndianRupee, Store, Users } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useShop } from '@/components/providers';
import { Field, LoadingBlock } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { api, ApiError, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Category, Plan, User } from '@/lib/types';

const FEATURE_LABEL: Record<string, string> = {
  basic_analytics: 'Sales analytics (7 days)',
  advanced_analytics: 'Advanced analytics & reports',
  promotions: 'Promotional tools',
  priority_support: 'Priority support',
};

const empty = {
  name: '',
  email: '',
  phone: '',
  password: '',
  businessName: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  pan: '',
};

export default function SellPage() {
  const router = useRouter();
  const { user, setUser, toast } = useShop();
  const plans = useApi<{ plans: Plan[] }>('/plans');
  const cats = useApi<{ categories: Category[] }>('/categories');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [planId, setPlanId] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const plan = plans.data?.plans.find((p) => p.id === planId);
  const maxCats = plan?.maxCategories ?? 0;

  function toggleCat(id: string) {
    setCategoryIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (maxCats > 0 && ids.length >= maxCats) {
        toast(`${plan?.name} plan allows ${maxCats} categor${maxCats === 1 ? 'y' : 'ies'}`, 'error');
        return ids;
      }
      return [...ids, id];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api<{ user: User }>('/auth/register-merchant', { body: { ...form, planId, categoryIds } });
      const me = await api<{ user: User }>('/auth/me');
      setUser(me.user);
      toast('Application submitted! We will review it shortly.');
      router.push('/merchant');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="container-page py-12 text-center">
        <p className="text-slate-600">You are signed in as {user.email}. Sign out first to register a new seller account.</p>
        {user.role === 'MERCHANT' && (
          <Link href="/merchant" className="btn-primary mt-4">
            Go to seller dashboard
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-slate-900 to-brand-900 py-12 text-white">
        <div className="container-page grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Sell to millions of customers on BazaarHub</h1>
            <p className="mt-3 text-slate-300">Register your business, pick the categories you want to sell in, and start listing products in minutes.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              [Users, '10 Cr+ customers'],
              [IndianRupee, 'Payouts every 7 days'],
              [BarChart3, 'Powerful analytics'],
              [FileCheck2, 'Simple verification'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Users;
              return (
                <div key={text as string} className="flex items-center gap-2 rounded-xl bg-white/10 p-3">
                  <I className="h-5 w-5 text-accent-400" /> {text as string}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="container-page py-8">
        <ol className="mb-6 flex gap-2 text-sm">
          {['Choose plan', 'Categories', 'Business details'].map((s, i) => (
            <li key={s} className={clsx('flex-1 rounded-xl px-3 py-2 text-center font-medium', i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {step === 0 &&
          (plans.loading ? (
            <LoadingBlock />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.data?.plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPlanId(p.id);
                    setCategoryIds((ids) => (p.maxCategories > 0 ? ids.slice(0, p.maxCategories) : ids));
                  }}
                  className={clsx('card p-6 text-left transition', planId === p.id ? 'ring-2 ring-brand-600' : 'hover:shadow-lg')}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{p.name}</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">
                    {p.price === 0 ? 'Free' : money(p.price)}
                    <span className="text-sm font-medium text-slate-500"> / {p.durationDays} days</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <Li>{p.maxCategories === 0 ? 'All eligible categories' : `${p.maxCategories} categor${p.maxCategories === 1 ? 'y' : 'ies'}`}</Li>
                    <Li>{p.productLimit === 0 ? 'Unlimited products' : `Up to ${p.productLimit} products`}</Li>
                    {p.features.map((f) => (
                      <Li key={f}>{FEATURE_LABEL[f] ?? f}</Li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          ))}

        {step === 1 && (
          <div className="card p-6">
            <p className="text-sm text-slate-600">
              {maxCats === 0
                ? 'Your plan covers all eligible categories. Select the ones you want to start with — restricted categories (like medicines) need admin approval.'
                : `Select up to ${maxCats} categor${maxCats === 1 ? 'y' : 'ies'}.`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cats.data?.categories.map((c) => {
                const on = categoryIds.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleCat(c.id)} className={clsx('flex items-center gap-3 rounded-xl border p-3 text-left text-sm', on ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200')}>
                    <CategoryIcon name={c.icon} className="h-5 w-5 shrink-0 text-brand-600" />
                    <span className="flex-1">
                      {c.name}
                      {c.requiresApproval && <span className="block text-xs text-amber-600">Needs licence check</span>}
                    </span>
                    {on && <Check className="h-4 w-4 text-brand-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={submit} className="card grid gap-4 p-6 sm:grid-cols-2">
            <h2 className="font-semibold text-slate-900 sm:col-span-2">Owner details</h2>
            <F label="Owner name" k="name" values={form} set={set} errors={errors} autoComplete="name" />
            <F label="Mobile number" k="phone" values={form} set={set} errors={errors} inputMode="tel" maxLength={10} />
            <F label="Email" k="email" values={form} set={set} errors={errors} type="email" autoComplete="email" />
            <F label="Password" k="password" values={form} set={set} errors={errors} type="password" minLength={8} autoComplete="new-password" />
            <h2 className="mt-2 font-semibold text-slate-900 sm:col-span-2">Business details</h2>
            <F label="Business / store name" k="businessName" values={form} set={set} errors={errors} />
            <F label="PAN" k="pan" values={form} set={set} errors={errors} maxLength={10} />
            <div className="sm:col-span-2">
              <F label="Business address" k="addressLine" values={form} set={set} errors={errors} />
            </div>
            <F label="City" k="city" values={form} set={set} errors={errors} />
            <F label="State" k="state" values={form} set={set} errors={errors} />
            <F label="Pincode" k="pincode" values={form} set={set} errors={errors} inputMode="numeric" maxLength={6} />
            <F label="GSTIN (optional)" k="gstin" values={form} set={set} errors={errors} required={false} maxLength={15} />
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 sm:col-span-2">
              <b>Document upload & OTP verification</b> need cloud storage (S3) and an SMS/email provider. Until those are configured, an admin verifies your PAN/GSTIN manually before approval.
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <button className="btn-primary w-full py-3 sm:w-auto" disabled={busy}>
                <Store className="h-4 w-4" /> {busy ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 flex justify-between">
          <button className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < 2 && (
            <button className="btn-primary" disabled={(step === 0 && !planId) || (step === 1 && categoryIds.length === 0)} onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {children}
    </li>
  );
}

function F({
  label,
  k,
  values,
  set,
  errors,
  required = true,
  type,
  ...rest
}: {
  label: string;
  k: keyof typeof empty;
  values: typeof empty;
  set: (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: Record<string, string[]>;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={errors[k]?.[0]}>
      {type === 'password' ? (
        <PasswordInput value={values[k]} onChange={set(k)} required={required} {...rest} />
      ) : (
        <input className="input" type={type} value={values[k]} onChange={set(k)} required={required} {...rest} />
      )}
    </Field>
  );
}
