'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import { discountPct, money } from '@/lib/format';
import type { Cart, ProductCard as Product } from '@/lib/types';
import { useShop } from './providers';
import { ProductImage } from './ProductImage';
import { Rating } from './ui';

export function useAddToCart() {
  const { user, setCartCount, toast } = useShop();
  const router = useRouter();
  return async (productId: string, quantity = 1) => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
    if (user.role !== 'CUSTOMER') return toast('Sign in with a customer account to shop', 'error');
    try {
      const cart = await api<Cart>('/cart', { body: { productId, quantity } });
      setCartCount(cart.count);
      toast('Added to cart');
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
}

export function ProductCard({ product, wishlisted = false }: { product: Product; wishlisted?: boolean }) {
  const addToCart = useAddToCart();
  const { user, toast } = useShop();
  const router = useRouter();
  const [liked, setLiked] = useState(wishlisted);
  const [busy, setBusy] = useState(false);
  const off = discountPct(product.price, product.mrp);
  const outOfStock = product.stock <= 0;

  async function toggleWishlist() {
    if (!user) return router.push('/login');
    if (user.role !== 'CUSTOMER') return toast('Wishlist is available for customer accounts', 'error');
    try {
      const r = await api<{ wishlisted: boolean }>(`/account/wishlist/${product.id}`, { method: 'POST' });
      setLiked(r.wishlisted);
      toast(r.wishlisted ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <Link href={`/products/${product.id}`} className="block aspect-square overflow-hidden bg-slate-100">
          <ProductImage src={product.images[0]} alt={product.name} className="h-full w-full transition duration-300 group-hover:scale-105" />
        </Link>
        {off > 0 && <span className="absolute left-3 top-3 rounded-lg bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{off}% OFF</span>}
        <button
          onClick={toggleWishlist}
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur transition hover:bg-white"
        >
          <Heart className={clsx('h-4 w-4', liked ? 'fill-rose-500 text-rose-500' : 'text-slate-600')} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-slate-500">{product.merchant.businessName}</p>
        <Link href={`/products/${product.id}`} className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:text-brand-700">
          {product.name}
        </Link>
        <div className="mt-2">{product.ratingCount > 0 && <Rating value={product.rating} count={product.ratingCount} />}</div>
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">{money(product.price)}</span>
            {off > 0 && <span className="text-xs text-slate-400 line-through">{money(product.mrp)}</span>}
          </div>
          <button
            disabled={outOfStock || busy}
            onClick={async () => {
              setBusy(true);
              await addToCart(product.id);
              setBusy(false);
            }}
            className="btn-primary mt-3 w-full"
          >
            <ShoppingCart className="h-4 w-4" />
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
