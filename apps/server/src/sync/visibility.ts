// Cakupan data pengguna untuk pull (docs/SYNC.md §4): id yang terlihat dan sidik jarinya.
// Aturan sama dengan sinkron 2.0: wilayah pengguna + permintaan yang ditugaskan ke petugas.
import { scopeKey } from '@ib/shared';
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';

import { farmerScopeCondition, isAdmin, type Scope } from '../auth/scope';
import type { Db } from '../db/client';
import { animals, assignments, farmers, serviceRequests, users } from '../db/schema';
import { visibleUsers } from '../routes/users';

export const inIds = (column: Parameters<typeof inArray>[0], ids: Iterable<string>) => {
  const list = [...ids];
  return list.length > 0 ? inArray(column, list) : eq(column, '');
};

export interface Visibility {
  farmerIds: Set<string>;
  animalIds: Set<string>;
  requestIds: Set<string>;
  stockHolders: string[];
  userIds: Set<string>;
  /** Sidik jari cakupan: berubah → pull diulang dari awal. */
  key: string;
}

export function visibilityOf(db: Db, scope: Scope): Visibility {
  const myRequestIds =
    scope.user.role === 'inseminator'
      ? db
          .select({ id: assignments.serviceRequestId })
          .from(assignments)
          .where(and(eq(assignments.inseminatorId, scope.user.id), isNull(assignments.deletedAt)))
          .all()
          .map((r) => r.id)
      : [];
  const assigned =
    myRequestIds.length > 0
      ? db
          .select({ animalId: serviceRequests.animalId, farmerId: serviceRequests.farmerId })
          .from(serviceRequests)
          .where(inArray(serviceRequests.id, myRequestIds))
          .all()
      : [];
  const scopedFarmerIds = db
    .select({ id: farmers.id })
    .from(farmers)
    .where(farmerScopeCondition(scope))
    .all()
    .map((r) => r.id);
  const assignedAnimalIds = assigned.map((a) => a.animalId);
  const farmerIds = new Set([...scopedFarmerIds, ...assigned.map((a) => a.farmerId)]);
  const animalVisible: SQL | undefined = or(
    inIds(animals.farmerId, scopedFarmerIds),
    inIds(animals.id, assignedAnimalIds),
  );
  const animalIds = new Set(
    db
      .select({ id: animals.id })
      .from(animals)
      .where(animalVisible)
      .all()
      .map((r) => r.id),
  );
  const requestIds = new Set(
    db
      .select({ id: serviceRequests.id })
      .from(serviceRequests)
      .where(
        or(
          inIds(serviceRequests.farmerId, scopedFarmerIds),
          inIds(serviceRequests.id, myRequestIds),
        ),
      )
      .all()
      .map((r) => r.id),
  );

  // Stok straw: petugas melihat miliknya; admin melihat stok petugas di wilayahnya.
  let stockHolders: string[] = [];
  if (scope.user.role === 'inseminator') stockHolders = [scope.user.id];
  else if (isAdmin(scope.user))
    stockHolders = db
      .select({ id: users.id, locationId: users.locationId })
      .from(users)
      .where(eq(users.role, 'inseminator'))
      .all()
      .filter((u) => u.locationId !== null && scope.locationIds.has(u.locationId))
      .map((u) => u.id);

  // Pengguna: admin melihat wilayahnya; lainnya hanya dirinya + petugas/admin di penugasannya.
  const assignmentPeople = db
    .select({ ins: assignments.inseminatorId, by: assignments.assignedBy })
    .from(assignments)
    .where(inIds(assignments.serviceRequestId, requestIds))
    .all()
    .flatMap((a) => [a.ins, a.by]);
  const userIds = isAdmin(scope.user)
    ? new Set(visibleUsers(db, scope).map((u) => u.id))
    : new Set([scope.user.id, ...assignmentPeople]);

  // Sidik jari: hal yang membuat baris LAMA menjadi terlihat. Baris baru (ternak, event,
  // permintaan) terbawa cursor biasa, jadi tidak dimasukkan agar pull tidak sering diulang.
  const key = scopeKey([
    `role:${scope.user.role}`,
    ...[...scope.locationIds].map((id) => `l:${id}`),
    ...[...farmerIds].map((id) => `f:${id}`),
    ...assignedAnimalIds.map((id) => `a:${id}`),
    ...myRequestIds.map((id) => `r:${id}`),
    ...stockHolders.map((id) => `s:${id}`),
  ]);

  return { farmerIds, animalIds, requestIds, stockHolders, userIds, key };
}
