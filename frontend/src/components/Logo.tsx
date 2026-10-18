import { useId } from 'react';
import clsx from 'clsx';

/** Brand mark: shopping bag with a storefront awning stripe. */
export function LogoMark({ className }: { className?: string }) {
  // Unique per instance: a gradient defined inside a display:none copy (e.g. the hidden desktop sidebar) would not render.
  const gradientId = `bh-g-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 40 40" className={clsx('h-9 w-9 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
      {/* bag handle */}
      <path d="M15 15v-2.5a5 5 0 0 1 10 0V15" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      {/* bag body */}
      <path d="M10.5 15h19l-1.6 14.2a2.5 2.5 0 0 1-2.5 2.3H14.6a2.5 2.5 0 0 1-2.5-2.3z" fill="#fff" />
      {/* awning stripes */}
      <path d="M13.4 20.5h13.2" stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="26" r="1.8" fill="#4f46e5" />
    </svg>
  );
}

export function Logo({ dark = false, subtitle, compact = false }: { dark?: boolean; subtitle?: string; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={clsx(compact && 'hidden sm:block')}>
        <span className={clsx('block text-lg font-extrabold leading-none tracking-tight', dark ? 'text-white' : 'text-slate-900')}>
          Bazaar<span className={dark ? 'text-accent-400' : 'text-brand-600'}>Hub</span>
        </span>
        {subtitle && <span className="mt-0.5 block text-xs text-slate-400">{subtitle}</span>}
      </span>
    </span>
  );
}
