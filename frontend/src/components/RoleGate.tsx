'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { Role } from '@/lib/types';
import { useShop } from './providers';
import { EmptyState } from './ui';

/** UX-only guard for customer pages; the backend enforces the same rule on every API call. */
export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useShop();
  if (!user) {
    return (
      <div className="container-page py-10">
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Please sign in"
            text="You need to be signed in to view this page."
            action={
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
            }
          />
        </div>
      </div>
    );
  }
  if (user.role !== role) {
    return (
      <div className="container-page py-10">
        <div className="card">
          <EmptyState icon={Lock} title="Not available for this account" text={`This page is only for ${role.toLowerCase()} accounts.`} />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
