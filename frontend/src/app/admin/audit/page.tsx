'use client';

import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Pagination } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Paged } from '@/lib/types';

type Log = { id: string; action: string; entity: string; entityId: string; meta: unknown; createdAt: string; actor: { name: string; role: string } | null };

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<Paged<{ logs: Log[] }>>(`/admin/audit-logs?page=${page}`);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every important admin action is recorded here" />
      <div className="card overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : !data?.logs.length ? (
          <EmptyState icon={ScrollText} title="No activity yet" text="Approvals, plan changes and settings updates will show up here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap">{dateTime(l.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        {l.actor?.name ?? 'System'} <span className="text-xs text-slate-400">{l.actor?.role.toLowerCase()}</span>
                      </td>
                      <td className="font-mono text-xs">{l.action}</td>
                      <td className="whitespace-nowrap text-xs">
                        {l.entity} <span className="text-slate-400">{l.entityId.slice(-8)}</span>
                      </td>
                      <td className="max-w-xs truncate font-mono text-xs text-slate-500">{l.meta ? JSON.stringify(l.meta) : '—'}</td>
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
    </div>
  );
}
