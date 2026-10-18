'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Heart, LayoutDashboard, LogOut, MapPin, Menu, Package, Search, ShoppingCart, Store, User as UserIcon, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { useShop } from '../providers';
import { CategoryIcon } from '../CategoryIcon';
import { Logo } from '../Logo';

const CITIES = ['Delhi NCR', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur'];

export function Header({ categories }: { categories: Category[] }) {
  const { user, setUser, cartCount, toast } = useShop();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [city, setCity] = useState('Delhi NCR');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('city');
      if (saved) setCity(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function changeCity(value: string) {
    setCity(value);
    try {
      localStorage.setItem('city', value);
    } catch {}
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setMenuOpen(false);
    toast('Signed out');
    router.push('/');
    router.refresh();
  }

  const dashboard = user?.role === 'ADMIN' ? '/admin' : user?.role === 'MERCHANT' ? '/merchant' : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="hidden bg-slate-900 text-xs text-slate-300 sm:block">
        <div className="container-page flex h-8 items-center justify-between">
          <span>Free delivery on orders above ₹499 · Easy 7-day returns</span>
          <Link href="/sell" className="font-medium text-white hover:text-accent-400">
            Become a seller →
          </Link>
        </div>
      </div>

      <div className="container-page flex h-16 items-center gap-3 lg:gap-6">
        <button className="btn-ghost -ml-2 p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="shrink-0" aria-label="BazaarHub home">
          <Logo compact />
        </Link>

        <label className="hidden items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm hover:bg-slate-50 md:flex">
          <MapPin className="h-4 w-4 text-brand-600" />
          <span className="sr-only">Delivery location</span>
          <select value={city} onChange={(e) => changeCity(e.target.value)} className="cursor-pointer bg-transparent font-medium text-slate-700 focus:outline-none">
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <form
          className="relative hidden flex-1 sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for products, brands and more"
            className="input rounded-full bg-slate-50 pl-10"
            aria-label="Search products"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1">
          <Link href="/wishlist" className="btn-ghost p-2.5" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
          </Link>
          <Link href="/cart" className="btn-ghost relative p-2.5" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          {user ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((o) => !o)} className="btn-ghost gap-1.5 px-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {user.name[0]?.toUpperCase()}
                </span>
                <span className="hidden max-w-[7rem] truncate md:block">{user.name.split(' ')[0]}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  {dashboard && (
                    <MenuLink href={dashboard} icon={LayoutDashboard} onClick={() => setMenuOpen(false)}>
                      {user.role === 'ADMIN' ? 'Admin dashboard' : 'Seller dashboard'}
                    </MenuLink>
                  )}
                  {user.role === 'CUSTOMER' && (
                    <>
                      <MenuLink href="/orders" icon={Package} onClick={() => setMenuOpen(false)}>
                        My orders
                      </MenuLink>
                      <MenuLink href="/account" icon={UserIcon} onClick={() => setMenuOpen(false)}>
                        Profile & addresses
                      </MenuLink>
                    </>
                  )}
                  <button onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link href="/login" className="btn-ghost">
                Login
              </Link>
              <Link href="/register" className="btn-primary hidden sm:inline-flex">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>

      <form
        className="container-page pb-3 sm:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/products?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="input rounded-full bg-slate-50 pl-10" aria-label="Search products" />
        </div>
      </form>

      <div className="hidden border-t border-slate-100 lg:block">
        <div className="container-page flex no-scrollbar h-11 items-center gap-1 overflow-x-auto text-sm">
          <Link href="/products" className="whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-100">
            All
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/products?category=${c.slug}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-80 max-w-[85%] overflow-y-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold">Shop by category</span>
              <button onClick={() => setMobileOpen(false)} className="btn-ghost p-2" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-brand-600" />
              <select value={city} onChange={(e) => changeCity(e.target.value)} className="flex-1 bg-transparent focus:outline-none" aria-label="Delivery location">
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50"
              >
                <CategoryIcon name={c.icon} className="h-4 w-4 text-brand-600" />
                {c.name}
              </Link>
            ))}
            <Link href="/sell" onClick={() => setMobileOpen(false)} className="btn-secondary mt-4 w-full">
              <Store className="h-4 w-4" /> Become a seller
            </Link>
          </aside>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, icon: Icon, children, onClick }: { href: string; icon: typeof Package; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
      <Icon className="h-4 w-4 text-slate-400" /> {children}
    </Link>
  );
}
