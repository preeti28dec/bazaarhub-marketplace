'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShop } from '@/components/providers';
import { Field } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, toast } = useShop();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const { user } = await api<{ user: User }>('/auth/register', { body: { ...form, phone: form.phone || undefined } });
      setUser(user);
      toast('Account created — happy shopping!');
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Shop from thousands of trusted sellers.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Full name" error={errors.name?.[0]}>
            <input className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
          </Field>
          <Field label="Email" error={errors.email?.[0]}>
            <input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          </Field>
          <Field label="Mobile number (optional)" error={errors.phone?.[0]}>
            <input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" maxLength={10} autoComplete="tel-national" />
          </Field>
          <Field label="Password" error={errors.password?.[0]} hint="At least 8 characters">
            <PasswordInput value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          </Field>
          {error && !Object.keys(errors).length && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
