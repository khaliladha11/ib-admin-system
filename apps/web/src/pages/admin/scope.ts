// Wilayah admin di perangkat: lokasi admin + turunannya (aturan yang sama dengan server).
import type { Location } from '@ib/shared';

import { childrenMap, descendantsOf, useLocations, useSession } from '@/data';

export function scopeLocations(locations: Location[], rootId: string | null) {
  if (!rootId) return [];
  const ids = descendantsOf(childrenMap(locations), rootId);
  return locations
    .filter((l) => ids.has(l.id) && l.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

const LEVEL = { agency: 'Dinas', group: 'Kelompok', village: 'Desa' } as const;
export const locationLabel = (l: Pick<Location, 'name' | 'level'>) =>
  l.name.startsWith('Desa') || l.level !== 'village' ? l.name : `${LEVEL[l.level]} ${l.name}`;

export function useAdminScope() {
  const session = useSession();
  const locations = useLocations();
  if (!session || !locations) return undefined;
  const inScope = scopeLocations(locations, session.user.locationId);
  return {
    session,
    locations,
    inScope,
    villages: inScope.filter((l) => l.level === 'village'),
    root: locations.find((l) => l.id === session.user.locationId) ?? null,
    nameOf: (id: string | null) => locations.find((l) => l.id === id)?.name ?? null,
  };
}
