'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type { Cart, User } from '@/lib/types';

type Toast = { id: number; kind: 'success' | 'error'; message: string };

type ShopContext = {
  user: User | null;
  setUser: (u: User | null) => void;
  cartCount: number;
  refreshCart: () => Promise<void>;
  setCartCount: (n: number) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
};

const Ctx = createContext<ShopContext | null>(null);

export function useShop() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShop must be used inside <Providers>');
  return ctx;
}

export function Providers({ initialUser, children }: { initialUser: User | null; children: React.ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const [cartCount, setCartCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refreshCart = useCallback(async () => {
    if (user?.role !== 'CUSTOMER') return setCartCount(0);
    try {
      const cart = await api<Cart>('/cart');
      setCartCount(cart.count);
    } catch {
      setCartCount(0);
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ user, setUser, cartCount, refreshCart, setCartCount, toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
          >
            {t.kind === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
