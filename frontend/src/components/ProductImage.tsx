'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ImageOff } from 'lucide-react';

/** Plain <img> with a graceful fallback (remote demo images can disappear). */
export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={clsx('flex items-center justify-center bg-slate-100 text-slate-400', className)}>
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={clsx('object-cover', className)} />;
}
