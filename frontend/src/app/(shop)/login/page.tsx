'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShop } from '@/components/providers';
import { Field } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';

const DEMO = [
  ['Customer', 'customer@shop.test', 'Customer@123'],
  ['Merchant', 'merchant@shop.test', 'Merchant@123'],
  ['Admin', 'admin@shop.test', 'Admin@123'],
];

const homeFor = (u: User) => (u.role === 'ADMIN' ? '/admin' : u.role === 'MERCHANT' ? '/merchant' : '/');

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { setUser, toast } = useShop();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: User }>('/auth/login', { body: { email, password } });
      const me = await api<{ user: User }>('/auth/me');
      setUser(me.user ?? user);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`);
      // Only allow same-site relative redirects.
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(user));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">One login for customers, sellers and admins.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          New here?{' '}
          <Link href="/register" className="font-semibold text-brand-700">
            Create an account
          </Link>{' '}
          ·{' '}
          <Link href="/sell" className="font-semibold text-brand-700">
            Sell with us
          </Link>
        </p>
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DEMO.map(([role, e, p]) => (
              <button
                key={role}
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setEmail(e);
                  setPassword(p);
                }}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
