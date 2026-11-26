// Pohon lokasi (dinas → kelompok → desa) untuk memeriksa cakupan di perangkat,
// dengan aturan yang sama seperti server (auth/scope.ts).
import type { Location } from '@ib/shared';

export function childrenMap(locations: readonly Pick<Location, 'id' | 'parentId'>[]) {
  const children = new Map<string, string[]>();
  for (const l of locations) {
    if (l.parentId) children.set(l.parentId, [...(children.get(l.parentId) ?? []), l.id]);
  }
  return children;
}

/** Lokasi `rootId` beserta semua turunannya. */
export function descendantsOf(children: Map<string, string[]>, rootId: string): Set<string> {
  const result = new Set<string>();
  const stack = [rootId];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

/** Apakah wilayah kerja `rootId` (mis. lokasi petugas) mencakup `locationId`. */
export function covers(
  locations: readonly Pick<Location, 'id' | 'parentId'>[],
  rootId: string | null,
  locationId: string,
) {
  return rootId !== null && descendantsOf(childrenMap(locations), rootId).has(locationId);
}
