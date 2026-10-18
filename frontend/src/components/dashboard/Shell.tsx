'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import {
  BadgeCheck,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useShop } from '../providers';
import { Logo, LogoMark } from '../Logo';

const Icons = {
  BadgeCheck, FolderTree, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Menu, Package,
  ScrollText, Settings, ShoppingBag, Store, TicketPercent, Users, Wallet,
};

export type NavItem = { href: string; label: string; icon: keyof typeof Icons };

export function Shell({ nav, title, banner, children }: { nav: NavItem[]; title: string; banner?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useShop();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    router.push('/login');
    router.refresh();
  }

  const isActive = (href: string) => (href === nav[0].href ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link href="/" className="block px-5 py-5" aria-label="BazaarHub home">
        <Logo dark subtitle={title} />
      </Link>
      <ul className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const Icon = Icons[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive(item.href) ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-white/10 p-3">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
          <Icons.Store className="h-4 w-4" /> View storefront
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
          <Icons.LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64 bg-slate-900" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <button className="btn-ghost -ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
          <Icons.Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="BazaarHub home">
          <LogoMark className="h-8 w-8" />
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">{user?.merchant?.businessName ?? user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{user?.name[0]?.toUpperCase()}</span>
        </div>
      </header>
      {banner}
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
