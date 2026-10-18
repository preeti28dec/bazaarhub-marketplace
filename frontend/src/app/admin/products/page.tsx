'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, Search, Star } from 'lucide-react';
import { ProductImage } from '@/components/ProductImage';
import { useShop } from '@/components/providers';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, PageHeader, Pagination, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Paged, ProductStatus } from '@/lib/types';

type P = {
  id: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  stock: number;
  images: string[];
  status: ProductStatus;
  featured: boolean;
  createdAt: string;
  merchant: { businessName: string };
  category: { name: string };
};

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AdminProducts />
    </Suspense>
  );
}

function AdminProducts() {
  const { toast } = useShop();
  const [status, setStatus] = useState(useSearchParams().get('status') ?? '');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<Paged<{ products: P[] }>>(`/admin/products?${new URLSearchParams({ status, q: query, page: String(page) })}`);
  const [rejecting, setRejecting] = useState<P | null>(null);
  const [reason, setReason] = useState('');

  async function decide(p: P, next: 'APPROVED' | 'REJECTED', why?: string) {
    try {
      await api(`/admin/products/${p.id}/status`, { method: 'PATCH', body: { status: next, reason: why } });
      toast(`${p.name} ${next.toLowerCase()}`);
      setRejecting(null);
      setReason('');
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function toggleFeatured(p: P) {
    try {
      await api(`/admin/products/${p.id}/featured`, { method: 'PATCH', body: { featured: !p.featured } });
      reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div>
      <PageHeader title="Products" subtitle="Review listings before they go live, and choose featured products" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(q);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </form>
        <select
          className="input sm:w-48"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : !data?.products.length ? (
          <EmptyState icon={Package} title="No products" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Merchant</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex min-w-[240px] items-center gap-3">
                          <ProductImage src={p.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-lg" />
                          <div>
                            {p.status === 'APPROVED' ? (
                              <Link href={`/products/${p.id}`} className="line-clamp-1 font-medium hover:text-brand-700">
                                {p.name}
                              </Link>
                            ) : (
                              <p className="line-clamp-1 font-medium">{p.name}</p>
                            )}
                            <p className="text-xs text-slate-500">
                              {p.category.name} · {date(p.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{p.merchant.businessName}</td>
                      <td className="whitespace-nowrap">{money(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        <button onClick={() => toggleFeatured(p)} disabled={p.status !== 'APPROVED'} aria-label="Toggle featured" className="disabled:opacity-30">
                          <Star className={`h-5 w-5 ${p.featured ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        </button>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.status !== 'APPROVED' && p.status !== 'ARCHIVED' && (
                            <button className="btn-primary btn-sm" onClick={() => decide(p, 'APPROVED')}>
                              Approve
                            </button>
                          )}
                          {p.status !== 'REJECTED' && p.status !== 'ARCHIVED' && (
                            <button className="btn-secondary btn-sm text-rose-600" onClick={() => setRejecting(p)}>
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4">
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!rejecting} title={`Reject “${rejecting?.name ?? ''}”`} onClose={() => setRejecting(null)}>
        <p className="mb-3 line-clamp-4 text-sm text-slate-600">{rejecting?.description}</p>
        <label className="label" htmlFor="reject-reason">
          Reason (shown to the merchant)
        </label>
        <textarea id="reject-reason" className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Images are blurry; please upload clear product photos." />
        <div className="mt-4 flex justify-end">
          <button className="btn-danger" disabled={reason.trim().length < 3} onClick={() => rejecting && decide(rejecting, 'REJECTED', reason)}>
            Reject listing
          </button>
        </div>
      </Modal>
    </div>
  );
}
