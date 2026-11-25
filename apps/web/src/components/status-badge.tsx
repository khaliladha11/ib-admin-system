import type { ReproStatus, ReproStatusKind } from '@ib/shared';

import { cn } from '@/lib/utils';

import { STATUS_META, statusDetail } from './status-meta';

export interface StatusBadgeProps {
  status: ReproStatus | { kind: ReproStatusKind };
  /** Tampilkan keterangan (IB ke-berapa, umur kebuntingan). Default: ya. */
  showDetail?: boolean;
  className?: string;
}

/** Badge status reproduksi: ikon + teks + garis, terbaca tanpa membedakan warna. */
export function StatusBadge({ status, showDetail = true, className }: StatusBadgeProps) {
  const meta = STATUS_META[status.kind];
  const Icon = meta.icon;
  const detail = showDetail && 'event' in status ? statusDetail(status) : null;
  return (
    <span
      data-status={status.kind}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md border-(length:--bw) px-2.5 py-1 text-base leading-tight font-semibold',
        meta.badgeClass,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2.5} />
      <span>
        {meta.label}
        {detail && <span className="font-normal">, {detail}</span>}
      </span>
    </span>
  );
}
