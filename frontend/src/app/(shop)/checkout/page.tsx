'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Banknote, CreditCard, MapPin, Plus, Tag } from 'lucide-react';
import { AddressForm } from '@/components/AddressForm';
import { RoleGate } from '@/components/RoleGate';
import { useShop } from '@/components/providers';
import { ErrorBlock, LoadingBlock, Row } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Address, Cart, Order } from '@/lib/types';

type CheckoutResponse = { order: Order; razorpay?: { keyId: string; orderId: string; amount: number; currency: string } };

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutPage() {
  return (
    <RoleGate role="CUSTOMER">
      <Checkout />
    </RoleGate>
  );
}

function Checkout() {
  const router = useRouter();
  const { user, toast, setCartCount } = useShop();
  const addresses = useApi<{ addresses: Address[] }>('/account/addresses');
  const options = useApi<{ cod: boolean; razorpay: boolean }>('/orders/payment-options');
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [addressId, setAddressId] = useState('');
  const [adding, setAdding] = useState(false);
  const [method, setMethod] = useState<'COD' | 'RAZORPAY'>('COD');
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    api<Cart>('/cart').then(setCart).catch((e) => setCartError(errorMessage(e)));
  }, []);

  useEffect(() => {
    const list = addresses.data?.addresses;
    if (list?.length && !addressId) setAddressId((list.find((a) => a.isDefault) ?? list[0]).id);
    if (list && list.length === 0) setAdding(true);
  }, [addresses.data, addressId]);

  async function applyCoupon(code: string) {
    try {
      const next = await api<Cart>('/cart/quote', { body: { couponCode: code || undefined } });
      setCart(next);
      setCouponMsg(code ? { ok: true, text: `${next.quote.coupon} applied — you save ${money(next.quote.discount)}` } : null);
    } catch (e) {
      setCouponMsg({ ok: false, text: errorMessage(e) });
    }
  }

  async function placeOrder() {
    if (!addressId) return toast('Choose a delivery address', 'error');
    setPlacing(true);
    try {
      const res = await api<CheckoutResponse>('/orders/checkout', {
        body: { addressId, paymentMethod: method, couponCode: cart?.quote.coupon ?? undefined },
      });
      setCartCount(0);
      if (res.razorpay) return openRazorpay(res);
      toast('Order placed successfully!');
      router.push(`/orders?placed=${res.order.number}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
      setPlacing(false);
    }
  }

  async function openRazorpay({ order, razorpay }: CheckoutResponse) {
    if (!razorpay) return;
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not load Razorpay'));
        document.body.appendChild(s);
      });
    }
    const rzp = new window.Razorpay!({
      key: razorpay.keyId,
      amount: razorpay.amount,
      currency: razorpay.currency,
      order_id: razorpay.orderId,
      name: 'BazaarHub',
      description: `Order ${order.number}`,
      prefill: { name: user?.name, email: user?.email },
      handler: async (r: Record<string, string>) => {
        try {
          await api(`/orders/${order.id}/verify-payment`, { body: r });
          toast('Payment successful!');
        } catch (e) {
          toast(errorMessage(e), 'error');
        }
        router.push(`/orders?placed=${order.number}`);
      },
      modal: { ondismiss: () => router.push('/orders') },
    });
    rzp.open();
  }

  if (cartError) return <div className="container-page py-8"><ErrorBlock message={cartError} /></div>;
  if (!cart || addresses.loading) return <LoadingBlock />;
  if (cart.items.length === 0) {
    router.replace('/cart');
    return null;
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-brand-600" /> Delivery address
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {addresses.data?.addresses.map((a) => (
                <label key={a.id} className={clsx('cursor-pointer rounded-xl border p-4 text-sm', addressId === a.id ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600' : 'border-slate-200')}>
                  <input type="radio" name="address" className="sr-only" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <p className="font-semibold text-slate-900">
                    {a.name} <span className="font-normal text-slate-500">· {a.phone}</span>
                  </p>
                  <p className="mt-1 text-slate-600">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}
                  </p>
                </label>
              ))}
            </div>
            {adding ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
                <AddressForm
                  onSaved={(a) => {
                    setAdding(false);
                    setAddressId(a.id);
                    addresses.reload();
                  }}
                  onCancel={addresses.data?.addresses.length ? () => setAdding(false) : undefined}
                />
              </div>
            ) : (
              <button className="btn-ghost mt-3 text-brand-700" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add new address
              </button>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-slate-900">Payment method</h2>
            <div className="mt-4 space-y-3">
              <PayOption active={method === 'COD'} onSelect={() => setMethod('COD')} icon={Banknote} title="Cash on Delivery" text="Pay with cash or UPI when your order arrives" />
              <PayOption
                active={method === 'RAZORPAY'}
                onSelect={() => options.data?.razorpay && setMethod('RAZORPAY')}
                disabled={!options.data?.razorpay}
                icon={CreditCard}
                title="UPI / Cards / Net banking"
                text={options.data?.razorpay ? 'Secure payment via Razorpay' : 'Requires Razorpay API keys — not configured in this environment'}
              />
            </div>
          </section>
        </div>

        <aside className="card h-fit p-5">
          <h2 className="font-semibold text-slate-900">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {cart.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="line-clamp-1 text-slate-600">
                  {i.product.name} × {i.quantity}
                </span>
                <span className="shrink-0 font-medium">{money(i.product.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyCoupon(coupon.trim());
            }}
          >
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 uppercase" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} aria-label="Coupon code" />
            </div>
            <button className="btn-secondary">Apply</button>
          </form>
          {couponMsg && <p className={`mt-2 text-xs font-medium ${couponMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{couponMsg.text}</p>}
          <p className="mt-1 text-xs text-slate-400">Try WELCOME10 or FLAT150</p>
          <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <Row label="Subtotal" value={money(cart.quote.subtotal)} />
            {cart.quote.discount > 0 && <Row label={`Coupon (${cart.quote.coupon})`} value={`− ${money(cart.quote.discount)}`} tone="!text-emerald-600" />}
            <Row label="Delivery" value={cart.quote.shippingFee === 0 ? 'FREE' : money(cart.quote.shippingFee)} />
            <div className="border-t border-slate-100 pt-2">
              <Row label="Total payable" value={money(cart.quote.total)} bold />
            </div>
          </dl>
          <button className="btn-primary mt-5 w-full py-3" onClick={placeOrder} disabled={placing || !addressId}>
            {placing ? 'Placing order…' : method === 'COD' ? 'Place order' : `Pay ${money(cart.quote.total)}`}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">Final prices and stock are re-checked on our server.</p>
        </aside>
      </div>
    </div>
  );
}

function PayOption({ active, onSelect, disabled, icon: Icon, title, text }: { active: boolean; onSelect: () => void; disabled?: boolean; icon: typeof Banknote; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={clsx(
        'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <span className="rounded-lg bg-white p-2 shadow-sm">
        <Icon className="h-5 w-5 text-brand-600" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}
