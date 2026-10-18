'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Minus, Plus, ShoppingCart, Star, Zap } from 'lucide-react';
import { useAddToCart } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { useShop } from '@/components/providers';
import { api, errorMessage } from '@/lib/api';

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className="lg:sticky lg:top-36 lg:self-start">
      <div className="card aspect-square overflow-hidden">
        <ProductImage src={images[active]} alt={name} className="h-full w-full" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              className={clsx('h-16 w-16 overflow-hidden rounded-xl border-2', i === active ? 'border-brand-600' : 'border-transparent')}
              aria-label={`Show image ${i + 1}`}
            >
              <ProductImage src={src} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PurchaseBox({ productId, stock }: { productId: string; stock: number }) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const addToCart = useAddToCart();
  const router = useRouter();
  const max = Math.min(10, stock);

  async function add(buyNow: boolean) {
    setBusy(true);
    const ok = await addToCart(productId, qty);
    setBusy(false);
    if (ok && buyNow) router.push('/cart');
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-xl border border-slate-200">
        <button className="p-3 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} aria-label="Decrease quantity">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center font-semibold" aria-live="polite">
          {qty}
        </span>
        <button className="p-3 disabled:opacity-40" disabled={qty >= max} onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button className="btn-secondary flex-1 py-3" disabled={stock === 0 || busy} onClick={() => add(false)}>
        <ShoppingCart className="h-4 w-4" /> Add to cart
      </button>
      <button className="btn-primary flex-1 py-3" disabled={stock === 0 || busy} onClick={() => add(true)}>
        <Zap className="h-4 w-4" /> Buy now
      </button>
    </div>
  );
}

export function ReviewForm({ productId }: { productId: string }) {
  const { user, toast } = useShop();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (user?.role !== 'CUSTOMER') {
    return <div className="card h-fit p-5 text-sm text-slate-500">Bought this product? Sign in as a customer to write a review.</div>;
  }

  return (
    <form
      className="card h-fit space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(`/products/${productId}/reviews`, { body: { rating, comment } });
          toast('Thanks for your review!');
          setComment('');
          router.refresh();
        } catch (err) {
          toast(errorMessage(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-semibold text-slate-900">Write a review</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star`} aria-checked={rating === n} role="radio">
            <Star className={clsx('h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
          </button>
        ))}
      </div>
      <textarea className="input min-h-24" placeholder="What did you like or dislike?" value={comment} onChange={(e) => setComment(e.target.value)} required minLength={3} />
      <button className="btn-primary w-full" disabled={busy}>
        Submit review
      </button>
      <p className="text-xs text-slate-400">Only verified buyers with a delivered order can review.</p>
    </form>
  );
}
