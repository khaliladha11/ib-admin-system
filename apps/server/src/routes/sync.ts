// Pull sinkronisasi sederhana (langkah 2.0): baris yang berubah sejak `since`, dalam cakupan pengguna.
// Baris ber-deleted_at ikut dikirim agar klien bisa menghapusnya. Versi lengkap (konflik,
// cakupan yang berubah, paging) dikerjakan di Fase 4.
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  animalSchema,
  auditLogSchema,
  locationSchema,
  publicUserSchema,
  semenStockSchema,
} from '@ib/shared';
import { and, eq, gte, inArray, isNull, or, type SQL } from 'drizzle-orm';

import { farmerScopeCondition, isAdmin } from '../auth/scope';
import {
  animals,
  animalTags,
  assignments,
  auditLogs,
  events,
  farmers,
  locations,
  semenStock,
  serviceRequests,
  users,
} from '../db/schema';
import { errorResponses } from '../http/errors';
import type { AppEnv } from '../http/env';
import {
  assignmentDtoSchema,
  eventDtoSchema,
  farmerDtoSchema,
  jsonContent,
  serviceRequestDtoSchema,
  tagDtoSchema,
} from '../http/schemas';
import { toAuthUser } from '../auth/session';
import { scopeOf } from './helpers';
import { visibleUsers } from './users';

/** Mundurkan cursor sedikit agar baris yang ditulis pada milidetik yang sama tidak terlewat. */
export const SYNC_CURSOR_MARGIN_MS = 1_000;

const changesSchema = z
  .object({
    /** Kirim sebagai `since` pada pull berikutnya. */
    serverTime: z.int(),
    locations: z.array(z.object(locationSchema.shape)),
    farmers: z.array(farmerDtoSchema),
    animals: z.array(z.object(animalSchema.shape)),
    animalTags: z.array(tagDtoSchema),
    events: z.array(eventDtoSchema),
    serviceRequests: z.array(serviceRequestDtoSchema),
    assignments: z.array(assignmentDtoSchema),
    semenStock: z.array(z.object(semenStockSchema.shape)),
    /** Tanpa hash password. Email hanya untuk admin. */
    users: z.array(z.object(publicUserSchema.shape)),
    /** Log aksi permintaan layanan (hanya untuk admin). */
    auditLogs: z.array(z.object(auditLogSchema.shape)),
  })
  .openapi('SyncChanges');

const inIds = (column: Parameters<typeof inArray>[0], ids: Iterable<string>) => {
  const list = [...ids];
  return list.length > 0 ? inArray(column, list) : eq(column, '');
};

export function registerSyncRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/sync/changes',
      tags: ['Sinkronisasi'],
      security: [{ cookieAuth: [] }],
      summary: 'Perubahan sejak `since` (ms) untuk data dalam cakupan pengguna',
      description:
        'Termasuk baris yang dihapus (deletedAt terisi). Inseminator juga menerima permintaan yang ' +
        'ditugaskan kepadanya beserta ternak dan event ternak itu. Status reproduksi tidak dikirim: ' +
        'klien menghitungnya sendiri dari event.',
      request: {
        query: z.object({ since: z.coerce.number().int().min(0).default(0) }),
      },
      responses: {
        200: jsonContent(changesSchema, 'Perubahan'),
        401: errorResponses[401],
      },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { since } = c.req.valid('query');
      const { db } = c.var;
      const serverTime = Math.max(0, c.var.now() - SYNC_CURSOR_MARGIN_MS);
      const changed = (column: Parameters<typeof gte>[0]) => gte(column, since);

      // --- Himpunan id dalam cakupan (tanpa melihat `since`) ---------------------
      const myRequestIds =
        scope.user.role === 'inseminator'
          ? db
              .select({ id: assignments.serviceRequestId })
              .from(assignments)
              .where(
                and(eq(assignments.inseminatorId, scope.user.id), isNull(assignments.deletedAt)),
              )
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
      const farmerIds = new Set([...scopedFarmerIds, ...assigned.map((a) => a.farmerId)]);
      const animalVisible: SQL | undefined = or(
        inIds(animals.farmerId, scopedFarmerIds),
        inIds(
          animals.id,
          assigned.map((a) => a.animalId),
        ),
      );
      const animalIds = db
        .select({ id: animals.id })
        .from(animals)
        .where(animalVisible)
        .all()
        .map((r) => r.id);
      const requestVisible = or(
        inIds(serviceRequests.farmerId, scopedFarmerIds),
        inIds(serviceRequests.id, myRequestIds),
      );
      const requestIds = db
        .select({ id: serviceRequests.id })
        .from(serviceRequests)
        .where(requestVisible)
        .all()
        .map((r) => r.id);

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
      const changedUsers = db
        .select()
        .from(users)
        .where(and(inIds(users.id, userIds), changed(users.updatedAt)))
        .all()
        .map((row) => {
          const u = toAuthUser(row);
          return isAdmin(scope.user) ? u : { ...u, email: null };
        });

      // --- Baris yang berubah sejak `since` ------------------------------------
      return c.json(
        {
          serverTime,
          locations: db.select().from(locations).where(changed(locations.updatedAt)).all(),
          farmers: db
            .select()
            .from(farmers)
            .where(and(inIds(farmers.id, farmerIds), changed(farmers.updatedAt)))
            .all(),
          animals: db
            .select()
            .from(animals)
            .where(and(inIds(animals.id, animalIds), changed(animals.updatedAt)))
            .all(),
          animalTags: db
            .select()
            .from(animalTags)
            .where(and(inIds(animalTags.animalId, animalIds), changed(animalTags.updatedAt)))
            .all(),
          events: db
            .select()
            .from(events)
            .where(and(inIds(events.animalId, animalIds), changed(events.updatedAt)))
            .all(),
          serviceRequests: db
            .select()
            .from(serviceRequests)
            .where(and(inIds(serviceRequests.id, requestIds), changed(serviceRequests.updatedAt)))
            .all(),
          assignments: db
            .select()
            .from(assignments)
            .where(
              and(inIds(assignments.serviceRequestId, requestIds), changed(assignments.updatedAt)),
            )
            .all(),
          semenStock: db
            .select()
            .from(semenStock)
            .where(and(inIds(semenStock.holderId, stockHolders), changed(semenStock.updatedAt)))
            .all(),
          users: changedUsers,
          auditLogs: isAdmin(scope.user)
            ? db
                .select()
                .from(auditLogs)
                .where(
                  and(
                    eq(auditLogs.tableName, 'service_requests'),
                    inIds(auditLogs.rowId, requestIds),
                    changed(auditLogs.updatedAt),
                  ),
                )
                .all()
            : [],
        },
        200,
      );
    },
  );
}
