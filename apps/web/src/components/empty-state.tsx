import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Meadow } from './illustrations/meadow';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Apa yang bisa dilakukan sekarang. */
  children?: ReactNode;
  action?: ReactNode;
  /** Ilustrasi padang di atas (untuk halaman yang kosong seluruhnya). */
  art?: 'meadow';
  className?: string;
}

/** Tampilan saat belum ada data: menjelaskan langkah berikutnya, bukan sekadar "kosong". */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  art,
  className,
}: EmptyStateProps) {
  return (
    <section className={cn('surface flex flex-col overflow-hidden', className)}>
      {art === 'meadow' && (
        <Meadow className="h-36 bg-gradient-to-b from-sky-wash via-paper to-paper" />
      )}
      <div className={cn('flex flex-col items-start gap-3 p-6', art && 'pt-3')}>
        {!art && <Icon aria-hidden="true" className="size-10 text-primary" strokeWidth={2} />}
        <h2 className="display text-2xl">{title}</h2>
        {children && <div className="max-w-prose text-muted-foreground">{children}</div>}
        {action}
      </div>
    </section>
  );
}
