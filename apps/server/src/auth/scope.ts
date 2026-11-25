// Cakupan akses per peran (lihat docs/PLAN.md §3):
// - farmer:       hanya data peternak miliknya sendiri (farmers.user_id = user.id)
// - inseminator:  wilayahnya (lokasi + turunannya) dan tugas yang ditugaskan kepadanya
// - group_admin:  kelompoknya (lokasi kelompok + desa di bawahnya)
// - agency_admin: dinasnya (seluruh lokasi di bawah dinas)
// Data di luar cakupan diperlakukan sebagai "tidak ditemukan" (404) agar tidak bocor.
import type { UserRole } from '@ib/shared';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';

import type { Db } from '../db/client';
import { farmers, locations } from '../db/schema';
import { forbidden } from '../http/errors';
import type { AuthUser } from './session';

export interface Scope {
  user: AuthUser;
  /** Lokasi yang bisa diakses (kosong untuk peternak). */
  locationIds: Set<string>;
  /** Id peternak milik pengguna ber-peran farmer. */
  farmerId: string | null;
  /** Peta induk → anak lokasi, untuk memeriksa cakupan wilayah. */
  children: Map<string, string[]>;
}

export const ADMIN_ROLES: readonly UserRole[] = ['agency_admin', 'group_admin'];
export const STAFF_ROLES: readonly UserRole[] = ['agency_admin', 'group_admin', 'inseminator'];

export const isAdmin = (user: AuthUser) => ADMIN_ROLES.includes(user.role);

export function requireRole(user: AuthUser, roles: readonly UserRole[], message?: string) {
  if (!roles.includes(user.role)) throw forbidden(message);
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

export function loadScope(db: Db, user: AuthUser): Scope {
  const rows = db
    .select({ id: locations.id, parentId: locations.parentId })
    .from(locations)
    .where(isNull(locations.deletedAt))
    .all();
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
  }

  if (user.role === 'farmer') {
    const farmer = db
      .select({ id: farmers.id })
      .from(farmers)
      .where(and(eq(farmers.userId, user.id), isNull(farmers.deletedAt)))
      .get();
    return { user, locationIds: new Set(), farmerId: farmer?.id ?? null, children };
  }

  const locationIds = user.locationId
    ? descendantsOf(children, user.locationId)
    : new Set<string>();
  return { user, locationIds, farmerId: null, children };
}

/** Apakah peternak (berdasarkan id & lokasinya) berada dalam cakupan pengguna. */
export function canAccessFarmer(scope: Scope, farmer: { id: string; locationId: string }) {
  return scope.user.role === 'farmer'
    ? farmer.id === scope.farmerId
    : scope.locationIds.has(farmer.locationId);
}

/** Kondisi SQL untuk membatasi tabel farmers sesuai cakupan. */
export function farmerScopeCondition(scope: Scope): SQL | undefined {
  if (scope.user.role === 'farmer') {
    return scope.farmerId ? eq(farmers.id, scope.farmerId) : eq(farmers.id, '');
  }
  return inArray(farmers.locationId, [...scope.locationIds]);
}

/** Apakah wilayah inseminator (lokasinya + turunan) mencakup lokasi tertentu. */
export function coversLocation(
  scope: Pick<Scope, 'children'>,
  rootId: string | null,
  locationId: string,
) {
  return rootId !== null && descendantsOf(scope.children, rootId).has(locationId);
}
