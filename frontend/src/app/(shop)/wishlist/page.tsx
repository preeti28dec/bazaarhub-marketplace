'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { RoleGate } from '@/components/RoleGate';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { ProductCard as Product } from '@/lib/types';

export default function WishlistPage() {
  return (
    <RoleGate role="CUSTOMER">
      <Wishlist />
    </RoleGate>
  );
}

function Wishlist() {
  const { data, loading, error, reload } = useApi<{ items: Product[] }>('/account/wishlist');
  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">My wishlist</h1>
      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            text="Tap the heart on any product to save it for later."
            action={
              <Link href="/products" className="btn-primary">
                Discover products
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {data.items.map((p) => (
            <ProductCard key={p.id} product={p} wishlisted />
          ))}
        </div>
      )}
    </div>
  );
}
