import type { ServiceRequestStatus } from '@ib/shared';

import { cn } from '@/lib/utils';

import { REQUEST_STATUS_META } from './request-status';

/** Status permintaan layanan: ikon + teks + garis. */
export function RequestStatusBadge({ status }: { status: ServiceRequestStatus }) {
  const meta = REQUEST_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md border-(length:--bw) px-2.5 py-1 font-semibold',
        meta.className,
      )}
    >
      <Icon aria-hidden="true" className="size-4.5" strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}
