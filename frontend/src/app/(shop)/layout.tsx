import { Suspense } from 'react';
import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { serverFetch } from '@/lib/server';
import type { Category } from '@/lib/types';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const data = await serverFetch<{ categories: Category[] }>('/categories');
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense>
        <Header categories={data?.categories ?? []} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
