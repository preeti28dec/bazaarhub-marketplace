'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, SearchX } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, ErrorBlock, LoadingBlock, Pagination } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Category, Paged, ProductCard as Product } from '@/lib/types';

const SORTS = [
  ['popular', 'Popularity'],
  ['newest', 'Newest first'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Customer rating'],
];

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Listing />
    </Suspense>
  );
}

function Listing() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const cats = useApi<{ categories: Category[] }>('/categories');
  const list = useApi<Paged<{ items: Product[] }>>(`/products?${new URLSearchParams({ limit: '12', ...Object.fromEntries(params) })}`);
  const [minPrice, setMin] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMax] = useState(params.get('maxPrice') ?? '');

  useEffect(() => {
    setMin(params.get('minPrice') ?? '');
    setMax(params.get('maxPrice') ?? '');
  }, [params]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    router.push(`${pathname}?${next}`);
  }

  const category = params.get('category');
  const activeCat = cats.data?.categories.find((c) => c.slug === category);
  const q = params.get('q');

  const filters = (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Category</p>
        <div className="space-y-1">
          <FilterOption active={!category} onClick={() => update({ category: null })}>
            All categories
          </FilterOption>
          {cats.data?.categories.map((c) => (
            <div key={c.id}>
              <FilterOption active={category === c.slug} onClick={() => update({ category: c.slug })}>
                {c.name}
              </FilterOption>
              {(category === c.slug || c.children?.some((s) => s.slug === category)) &&
                c.children?.map((s) => (
                  <FilterOption key={s.id} active={category === s.slug} onClick={() => update({ category: s.slug })} indent>
                    {s.name}
                  </FilterOption>
                ))}
            </div>
          ))}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ minPrice: minPrice || null, maxPrice: maxPrice || null });
        }}
      >
        <p className="mb-2 text-sm font-semibold text-slate-900">Price range (₹)</p>
        <div className="flex items-center gap-2">
          <input className="input py-2" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label="Minimum price" />
          <span className="text-slate-400">–</span>
          <input className="input py-2" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label="Maximum price" />
        </div>
        <button className="btn-secondary btn-sm mt-2 w-full">Apply</button>
      </form>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Customer rating</p>
        {['4', '3'].map((r) => (
          <FilterOption key={r} active={params.get('rating') === r} onClick={() => update({ rating: params.get('rating') === r ? null : r })}>
            {r}★ & above
          </FilterOption>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={params.get('inStock') === 'true'} onChange={(e) => update({ inStock: e.target.checked ? 'true' : null })} />
        In stock only
      </label>
      <button className="text-sm font-semibold text-brand-700" onClick={() => router.push(pathname)}>
        Clear all filters
      </button>
    </div>
  );

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{q ? `Results for “${q}”` : activeCat?.name ?? 'All products'}</h1>
          {list.data && <p className="text-sm text-slate-500">{list.data.total} products</p>}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary lg:hidden" onClick={() => setFiltersOpen((o) => !o)}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
          <select className="input w-auto py-2" value={params.get('sort') ?? 'popular'} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className={`${filtersOpen ? 'block' : 'hidden'} card h-fit p-5 lg:block`}>{filters}</aside>
        <div>
          {list.loading && !list.data ? (
            <LoadingBlock label="Finding products…" />
          ) : list.error ? (
            <ErrorBlock message={list.error} onRetry={list.reload} />
          ) : list.data?.items.length === 0 ? (
            <div className="card">
              <EmptyState icon={SearchX} title="No products found" text="Try a different search or remove some filters." />
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${list.loading ? 'opacity-60' : ''}`}>
                {list.data?.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <Pagination page={list.data?.page ?? 1} pages={list.data?.pages ?? 1} onChange={(p) => update({ page: String(p) })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterOption({ active, onClick, children, indent }: { active: boolean; onClick: () => void; children: React.ReactNode; indent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${indent ? 'pl-6' : ''} ${active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  );
}
