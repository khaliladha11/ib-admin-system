// Linimasa riwayat event seekor ternak, terbaru di atas.
import { CloudUpload, TriangleAlert } from 'lucide-react';

import type { TimelineEvent } from '@/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

import { describeEventDetail, EVENT_META } from './event-text';

export function EventTimeline({
  events,
  anomalies,
}: {
  events: TimelineEvent[];
  anomalies: string[];
}) {
  const ordered = [...events].sort((a, b) => b.occurredAt - a.occurredAt || (a.id < b.id ? 1 : -1));
  const odd = new Set(anomalies);
  return (
    <ol className="relative flex flex-col">
      {ordered.map((event, i) => {
        const meta = EVENT_META[event.type];
        const Icon = meta.icon;
        const last = i === ordered.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-4">
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-10 bottom-0 left-[19px] w-0.5 bg-line"
              />
            )}
            <span
              className={cn(
                'z-0 flex size-10 shrink-0 items-center justify-center rounded-full border-(length:--bw) bg-card',
                event.voided
                  ? 'border-line text-muted-foreground'
                  : 'border-line-strong text-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={2.25} />
            </span>
            <div
              className={cn('flex min-w-0 flex-1 flex-col pt-1.5', event.voided && 'opacity-70')}
            >
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className={cn('font-bold', event.voided && 'line-through')}>
                  {meta.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(event.occurredAt)}
                </span>
              </p>
              <p className={cn(event.voided && 'line-through')}>{describeEventDetail(event)}</p>
              {event.payload.notes && (
                <p className="text-muted-foreground">“{event.payload.notes}”</p>
              )}
              <div className="flex flex-wrap gap-x-3 text-sm font-semibold">
                {event.voided && (
                  <span className="text-muted-foreground">Dibatalkan oleh koreksi</span>
                )}
                {event.voidsEventId && (
                  <span className="text-info">Koreksi catatan sebelumnya</span>
                )}
                {odd.has(event.id) && (
                  <span className="inline-flex items-center gap-1 text-alarm">
                    <TriangleAlert aria-hidden="true" className="size-4" />
                    Urutan tidak biasa, perlu dicek
                  </span>
                )}
                {event.unsynced && (
                  <span className="inline-flex items-center gap-1 text-info">
                    <CloudUpload aria-hidden="true" className="size-4" />
                    Belum terkirim
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
