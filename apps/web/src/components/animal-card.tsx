import { CloudUpload } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AnimalView } from '@/data';
import { cn } from '@/lib/utils';

import { CycleTrack } from './cycle-track';
import { StatusBadge } from './status-badge';

export interface AnimalCardProps {
  animal: AnimalView;
  /** Kalimat jadwal berikutnya, mis. "PKB 12 Januari 2027". */
  nextLabel?: string;
  /** Bila diisi, seluruh kartu bisa disentuh. */
  onOpen?: () => void;
  actions?: ReactNode;
  className?: string;
}

const SEX_LABEL = { F: 'Betina', M: 'Jantan' } as const;

/** Kartu ternak: siapa sapinya, milik siapa, dan sedang di tahap mana siklusnya. */
export function AnimalCard({ animal, nextLabel, onOpen, actions, className }: AnimalCardProps) {
  const name = animal.name ?? 'Tanpa nama';
  const facts = [SEX_LABEL[animal.sex], animal.breed, animal.farmerName].filter(Boolean).join(', ');
  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{name}</h3>
          <p className="text-muted-foreground">
            {animal.qrCode && (
              <span className="mr-2 font-semibold tracking-wide text-foreground">
                {animal.qrCode}
              </span>
            )}
            {facts}
          </p>
        </div>
        <StatusBadge status={animal.status} />
      </div>
      {animal.sex === 'F' && <CycleTrack kind={animal.status.kind} />}
      {(nextLabel ?? animal.unsynced) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {nextLabel && <p className="font-semibold">{nextLabel}</p>}
          {animal.unsynced && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-info">
              <CloudUpload aria-hidden="true" className="size-4" />
              Belum terkirim
            </span>
          )}
        </div>
      )}
    </>
  );
  return (
    <article
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border-(length:--bw) bg-card p-4 text-card-foreground',
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-col gap-3 text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
          aria-label={`Buka ${name}`}
        >
          {body}
        </button>
      ) : (
        body
      )}
      {actions && <div className="relative flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
