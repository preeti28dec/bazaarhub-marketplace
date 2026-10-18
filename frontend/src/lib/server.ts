import 'server-only';
import { cookies } from 'next/headers';
import type { User } from './types';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

/** Server-component fetch to the backend, forwarding the user's session cookie. */
export async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND}/api${path}`, { headers: { cookie: cookies().toString() }, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const data = await serverFetch<{ user: User | null }>('/auth/me');
  return data?.user ?? null;
}
