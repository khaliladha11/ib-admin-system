import { useNavigate } from '@tanstack/react-router';
import { PawPrint, Search, SearchX, X } from 'lucide-react';
import { useState } from 'react';

import { AnimalCard } from '@/components/animal-card';
import { EmptyState } from '@/components/empty-state';
import { nextStepLabel } from '@/components/schedule-text';
import { STATUS_META } from '@/components/status-meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnimals, useDataLayer } from '@/data';
import { cn } from '@/lib/utils';

import { countByStatus, filterAnimals, type StatusFilter } from './animal-filter';

const FILTERS: StatusFilter[] = [
  'semua',
  'birahi',
  'sudah_IB_menunggu_PKB',
  'bunting',
  'kosong',
  'sudah_lahir',
  'keguguran',
  'keluar',
];

export function AnimalsPage() {
  const { now } = useDataLayer();
  const today = now();
  const animals = useAnimals({ includeExited: true });
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('semua');

  if (!animals) return null;
  if (animals.length === 0) {
    return (
      <EmptyState icon={PawPrint} title="Belum ada ternak di HP ini">
        Data ternak muncul setelah tersinkron dengan server. Pastikan ada sinyal, lalu sentuh status
        sinkron di kanan atas.
      </EmptyState>
    );
  }
  const counts = countByStatus(animals, query);
  // "Keluar" disembunyikan dari "Semua" agar daftar berisi ternak yang masih ada.
  const shown = filterAnimals(animals, query, status).filter(
    (a) => status === 'keluar' || a.status.kind !== 'keluar',
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Cari ternak"
          placeholder="Cari nama, kode QR, eartag, peternak"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          className="pl-10"
        />
        {query && (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => {
              setQuery('');
            }}
            className="absolute top-0 right-0 flex size-12 items-center justify-center"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Filter status reproduksi"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {FILTERS.map((f) => {
          const active = f === status;
          const count =
            f === 'semua'
              ? (counts.get('semua') ?? 0) - (counts.get('keluar') ?? 0)
              : (counts.get(f) ?? 0);
          const label = f === 'semua' ? 'Semua' : STATUS_META[f].label;
          const Icon = f === 'semua' ? null : STATUS_META[f].icon;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setStatus(f);
              }}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-(length:--bw) px-3.5 font-semibold whitespace-nowrap',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground',
              )}
            >
              {Icon && <Icon aria-hidden="true" className="size-4" />}
              {label}
              <span className={cn('tabular-nums', active ? '' : 'text-muted-foreground')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground" aria-live="polite">
        {shown.length} ternak
      </p>

      {shown.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Tidak ada yang cocok"
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setStatus('semua');
              }}
            >
              Tampilkan semua ternak
            </Button>
          }
        >
          Coba kata lain, misalnya sebagian kode QR atau nama peternak.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((animal) => (
            <li key={animal.id}>
              <AnimalCard
                animal={animal}
                nextLabel={nextStepLabel(animal, today)}
                onOpen={() => {
                  void navigate({ to: '/ternak/$animalId', params: { animalId: animal.id } });
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
