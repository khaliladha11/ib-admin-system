import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Apa yang bisa dilakukan sekarang. */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Tampilan saat belum ada data: menjelaskan langkah berikutnya, bukan sekadar "kosong". */
export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-start gap-3 rounded-xl border-(length:--bw) border-dashed border-line-strong bg-card p-6',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-10 text-primary" strokeWidth={2} />
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <div className="max-w-prose text-muted-foreground">{children}</div>}
      {action}
    </section>
  );
}
