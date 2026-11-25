// Lintasan siklus: lima tahap Birahi → IB → PKB → Bunting → Lahir.
// Tahap sekarang terisi penuh, tahap yang sudah lewat bergaris, tahap berikutnya kosong.
import type { ReproStatusKind } from '@ib/shared';

import { cn } from '@/lib/utils';

import { CYCLE_STAGES, cycleTrackLabel, stageOf } from './cycle';
import { STATUS_META } from './status-meta';

export function CycleTrack({ kind, className }: { kind: ReproStatusKind; className?: string }) {
  const current = stageOf(kind);
  const meta = STATUS_META[kind];
  const broken = kind === 'keguguran';
  return (
    <div role="img" aria-label={cycleTrackLabel(kind)} className={cn('w-full', className)}>
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {CYCLE_STAGES.map((stage, i) => {
          const state = i < current ? 'past' : i === current ? 'now' : 'next';
          return (
            <div key={stage} className="flex flex-col gap-1">
              <div
                data-stage-state={state}
                className={cn(
                  'h-2.5 rounded-sm border-(length:--bw)',
                  state === 'next' && 'border-line-strong bg-transparent',
                  state === 'past' &&
                    'border-transparent bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_3px,transparent_3px_6px)]',
                  state === 'now' && !broken && cn('border-transparent', meta.fillClass),
                  state === 'now' &&
                    broken &&
                    'border-transparent bg-[repeating-linear-gradient(90deg,var(--st-keguguran-line)_0_8px,transparent_8px_11px)]',
                )}
              />
              <span
                className={cn(
                  'truncate text-sm',
                  state === 'now' ? cn('font-bold', meta.textClass) : 'text-muted-foreground',
                )}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
