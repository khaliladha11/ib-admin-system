// Panel: bagian berjudul di atas permukaan kartu. Dipakai bersama di semua halaman
// agar jarak, sudut, dan ukuran judul seragam.
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PanelProps {
  title?: ReactNode;
  /** Tautan/tombol di kanan judul. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** id judul, untuk aria-labelledby. */
  titleId?: string;
}

export function Panel({ title, action, children, className, titleId }: PanelProps) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn('surface flex flex-col gap-3 p-4 sm:p-5', className)}
    >
      {(title ?? action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
