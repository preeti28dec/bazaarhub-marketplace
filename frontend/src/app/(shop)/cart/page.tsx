'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { RoleGate } from '@/components/RoleGate';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, Row } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Cart } from '@/lib/types';

export default function CartPage() {
  return (
    <RoleGate role="CUSTOMER">
      <CartView />
    </RoleGate>
  );
}

function CartView() {
  const { setCartCount, toast } = useShop();
  const { data: cart, setData, loading, error, reload } = useApi<Cart>('/cart');
  const [busy, setBusy] = useState<string | null>(null);

  async function setQty(productId: string, quantity: number) {
    setBusy(productId);
    try {
      const next = await api<Cart>(`/cart/${productId}`, { method: 'PATCH', body: { quantity } });
      setData(next);
      setCartCount(next.count);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (loading && !cart) return <LoadingBlock />;
  if (error) return <div className="container-page py-8"><ErrorBlock message={error} onRetry={reload} /></div>;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-10">
        <div className="card">
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            text="Looks like you haven't added anything yet."
            action={
              <Link href="/products" className="btn-primary">
                Start shopping
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const unavailable = cart.items.some((i) => i.product.status !== 'APPROVED' || i.product.merchant.status !== 'APPROVED' || i.product.stock < i.quantity);

  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Shopping cart ({cart.count})</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card divide-y divide-slate-100">
          {cart.items.map(({ product: p, quantity }) => {
            const blocked = p.status !== 'APPROVED' || p.merchant.status !== 'APPROVED';
            return (
              <div key={p.id} className={`flex gap-4 p-4 ${busy === p.id ? 'opacity-60' : ''}`}>
                <Link href={`/products/${p.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <ProductImage src={p.images[0]} alt={p.name} className="h-full w-full" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/products/${p.id}`} className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">Sold by {p.merchant.businessName}</p>
                  {blocked && <p className="mt-1 text-xs font-medium text-rose-600">No longer available — please remove</p>}
                  {!blocked && p.stock < quantity && <p className="mt-1 text-xs font-medium text-rose-600">Only {p.stock} left in stock</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <button className="p-2 disabled:opacity-40" disabled={quantity <= 1 || !!busy} onClick={() => setQty(p.id, quantity - 1)} aria-label="Decrease">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{quantity}</span>
                      <button className="p-2 disabled:opacity-40" disabled={quantity >= Math.min(10, p.stock) || !!busy} onClick={() => setQty(p.id, quantity + 1)} aria-label="Increase">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">{money(p.price * quantity)}</span>
                      <button className="btn-ghost p-2 text-rose-600" onClick={() => setQty(p.id, 0)} aria-label="Remove item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card h-fit p-5">
          <h2 className="font-semibold text-slate-900">Price details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={money(cart.quote.subtotal)} />
            <Row label="Delivery" value={cart.quote.shippingFee === 0 ? 'FREE' : money(cart.quote.shippingFee)} />
            <div className="border-t border-slate-100 pt-2">
              <Row label="Total" value={money(cart.quote.total)} bold />
            </div>
          </dl>
          {cart.quote.shippingFee > 0 && <p className="mt-3 text-xs text-slate-500">Add items worth {money(49_900 - cart.quote.subtotal)} more for free delivery.</p>}
          <Link href="/checkout" className={`btn-primary mt-5 w-full py-3 ${unavailable ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={unavailable}>
            Proceed to checkout
          </Link>
          <p className="mt-2 text-center text-xs text-slate-400">Apply coupons on the next step</p>
        </div>
      </div>
    </div>
  );
}
