// Penyaring daftar ternak: cari nama/kode QR/eartag, dan filter status reproduksi.
import type { ReproStatusKind } from '@ib/shared';

import type { AnimalView } from '@/data';
import { normalizeSearch } from '@/lib/format';

export type StatusFilter = ReproStatusKind | 'semua';

export function matchesQuery(animal: AnimalView, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return [animal.name ?? '', animal.farmerName ?? '', ...animal.tagCodes].some((text) =>
    normalizeSearch(text).includes(q),
  );
}

export function filterAnimals(list: AnimalView[], query: string, status: StatusFilter) {
  return list.filter(
    (a) => (status === 'semua' || a.status.kind === status) && matchesQuery(a, query),
  );
}

/** Jumlah ternak per status (untuk label filter), setelah pencarian. */
export function countByStatus(list: AnimalView[], query: string) {
  const counts = new Map<StatusFilter, number>([['semua', 0]]);
  for (const a of list) {
    if (!matchesQuery(a, query)) continue;
    counts.set('semua', (counts.get('semua') ?? 0) + 1);
    counts.set(a.status.kind, (counts.get(a.status.kind) ?? 0) + 1);
  }
  return counts;
}
