import clsx from 'clsx';
import { Loader2, PackageOpen, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { titleCase } from '@/lib/format';

const statusTone: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PLACED: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  CONFIRMED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  SHIPPED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  RETURN_REQUESTED: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  SUSPENDED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        statusTone[status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      )}
    >
      {label ?? titleCase(status)}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  text,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-600">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'brand',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  tone?: 'brand' | 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={clsx('rounded-xl p-2', tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  return (
    <span className={clsx('inline-flex items-center gap-1', size === 'md' ? 'text-sm' : 'text-xs')}>
      <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-1.5 py-0.5 font-semibold text-white">
        {value.toFixed(1)} <Star className="h-3 w-3 fill-current" />
      </span>
      {count !== undefined && <span className="text-slate-500">({count})</span>}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: string }) {
  return (
    <div className={clsx('flex justify-between', bold ? 'text-base font-bold text-slate-900' : 'text-slate-600', tone)}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-4 text-sm">
      <span className="text-slate-500">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
