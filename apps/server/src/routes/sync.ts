// Sinkronisasi HP ↔ server (langkah 4.2, docs/SYNC.md):
//   POST /api/sync/push   — batch perubahan dari outbox, idempoten per id perubahan
//   GET  /api/sync/pull   — baris berubah dalam cakupan, berhalaman (cursor + sidik jari cakupan)
//   POST /api/sync/reviews/{id}/discard — buang event "perlu dicek"
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import {
  animalSchema,
  auditLogSchema,
  compareCursor,
  decodeCursor,
  encodeCursor,
  locationSchema,
  publicUserSchema,
  qrCodeSchema,
  semenStockSchema,
  syncChangeResultSchema,
  syncChangeSchema,
  syncReviewSchema,
  type SyncChange,
  type SyncChangeKind,
  type SyncChangeResult,
  type SyncCursor,
  type SyncReview,
} from '@ib/shared';
import { and, eq, gt, gte, isNull, or, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { isAdmin } from '../auth/scope';
import { toAuthUser } from '../auth/session';
import {
  animals,
  animalTags,
  assignments,
  auditLogs,
  events,
  farmers,
  feedback,
  isikhnasReports,
  locations,
  qrCodes,
  semenStock,
  serviceRequests,
  syncChanges,
  users,
} from '../db/schema';
import { ApiError, conflict, errorResponses, forbidden, notFound } from '../http/errors';
import type { AppEnv } from '../http/env';
import {
  assignmentDtoSchema,
  eventDtoSchema,
  farmerDtoSchema,
  idParamSchema,
  jsonBody,
  jsonContent,
  serviceRequestDtoSchema,
  tagDtoSchema,
} from '../http/schemas';
import { inIds, visibilityOf } from '../sync/visibility';
import { feedbackDtoSchema } from './feedback';
import { isikhnasReportDtoSchema } from './isikhnas';
import {
  audit,
  CHANGE_AT_HEADER,
  MERGED_HEADER,
  newRow,
  scopeOf,
  SYNC_HEADER,
  type AppContext,
} from './helpers';

const tags = ['Sinkronisasi'];
const security = [{ cookieAuth: [] }];

// --- Push ----------------------------------------------------------------------

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ANIMAL_PATH = new RegExp(`^/api/animals/(${UUID})/`);

/** Daftar putih: setiap jenis perubahan hanya boleh memanggil route ini. */
const ROUTES: Record<SyncChangeKind, { method: 'POST' | 'PATCH'; path: RegExp }> = {
  'farmer.create': { method: 'POST', path: /^\/api\/farmers$/ },
  'farmer.update': { method: 'PATCH', path: new RegExp(`^/api/farmers/${UUID}$`) },
  'animal.create': { method: 'POST', path: /^\/api\/animals$/ },
  'animal.update': { method: 'PATCH', path: new RegExp(`^/api/animals/${UUID}$`) },
  'event.create': { method: 'POST', path: new RegExp(`^/api/animals/${UUID}/events$`) },
  'serviceRequest.create': { method: 'POST', path: /^\/api\/service-requests$/ },
  'serviceRequest.accept': {
    method: 'POST',
    path: new RegExp(`^/api/service-requests/${UUID}/accept$`),
  },
  'serviceRequest.assign': {
    method: 'POST',
    path: new RegExp(`^/api/service-requests/${UUID}/assign$`),
  },
  'serviceRequest.reassign': {
    method: 'POST',
    path: new RegExp(`^/api/service-requests/${UUID}/reassign$`),
  },
  'serviceRequest.reject': {
    method: 'POST',
    path: new RegExp(`^/api/service-requests/${UUID}/reject$`),
  },
  'qrCode.reserve': { method: 'POST', path: /^\/api\/qr-codes$/ },
  'tag.attach': { method: 'POST', path: new RegExp(`^/api/animals/${UUID}/tags$`) },
  'tag.remove': { method: 'POST', path: new RegExp(`^/api/tags/${UUID}/remove$`) },
  'syncReview.discard': {
    method: 'POST',
    path: new RegExp(`^/api/sync/reviews/${UUID}/discard$`),
  },
  'feedback.create': { method: 'POST', path: /^\/api\/feedback$/ },
  'isikhnasReport.create': { method: 'POST', path: /^\/api\/isikhnas-reports$/ },
};

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/** Jalankan satu perubahan lewat route REST yang sama (otorisasi + validasi tidak diduplikasi). */
async function dispatch(app: OpenAPIHono<AppEnv>, c: AppContext, change: SyncChange) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    [SYNC_HEADER]: '1',
    [CHANGE_AT_HEADER]: String(change.at),
    'x-device-id': c.var.deviceId,
  };
  const cookie = c.req.header('cookie');
  if (cookie) headers.cookie = cookie;
  const res = await app.request(
    change.path,
    { method: change.method, headers, body: JSON.stringify(change.body ?? {}) },
    // Lingkungan (Node) diteruskan apa adanya untuk route yang membutuhkannya.
    c.env,
  );
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, merged: res.headers.get(MERGED_HEADER) === '1' };
}

function classify(
  change: SyncChange,
  res: { status: number; body: unknown; merged: boolean },
): Omit<SyncChangeResult, 'id'> | 'retry' | 'unauthenticated' {
  const err = (res.body as ErrorBody | null)?.error;
  if (res.status >= 200 && res.status < 300) {
    return { result: res.merged ? 'merged' : 'applied', code: null, message: null, body: res.body };
  }
  if (res.status === 409 && err?.code === 'ALREADY_EXISTS') {
    return { result: 'applied', code: 'ALREADY_EXISTS', message: null, body: null };
  }
  if (res.status === 401) return 'unauthenticated';
  if (res.status >= 500) return 'retry';
  const code = err?.code ?? `HTTP_${String(res.status)}`;
  const message = err?.message ?? 'Perubahan ditolak server.';
  if (change.kind === 'event.create' && res.status === 422 && code === 'INVALID_EVENT') {
    return { result: 'needs_review', code, message, body: null };
  }
  return { result: 'rejected', code, message, body: null };
}

const pushRequestSchema = z
  .object({ changes: z.array(z.object(syncChangeSchema.shape)).min(1).max(50) })
  .openapi('SyncPush');
const pushResponseSchema = z
  .object({ results: z.array(z.object(syncChangeResultSchema.shape)) })
  .openapi('SyncPushResult');

// --- Pull ----------------------------------------------------------------------

const reviewDtoSchema = z.object(syncReviewSchema.shape).openapi('SyncReview');

const pullRowsSchema = z.object({
  locations: z.array(z.object(locationSchema.shape)),
  farmers: z.array(farmerDtoSchema),
  animals: z.array(z.object(animalSchema.shape)),
  animalTags: z.array(tagDtoSchema),
  qrCodes: z.array(z.object(qrCodeSchema.shape)),
  events: z.array(eventDtoSchema),
  serviceRequests: z.array(serviceRequestDtoSchema),
  assignments: z.array(assignmentDtoSchema),
  semenStock: z.array(z.object(semenStockSchema.shape)),
  users: z.array(z.object(publicUserSchema.shape)),
  auditLogs: z.array(z.object(auditLogSchema.shape)),
  syncReviews: z.array(reviewDtoSchema),
  feedback: z.array(feedbackDtoSchema),
  isikhnasReports: z.array(isikhnasReportDtoSchema),
});
type PullRows = z.infer<typeof pullRowsSchema>;
type PullTable = keyof PullRows;

const pullResponseSchema = z
  .object({
    rows: pullRowsSchema,
    /** Simpan dan kirim lagi sebagai `cursor` untuk halaman berikutnya. */
    cursor: z.string().nullable(),
    hasMore: z.boolean(),
    /** Sidik jari cakupan; kirim lagi sebagai `scope`. */
    scope: z.string(),
    /** true: cakupan berubah, pull diulang dari awal. Hapus baris lama yang tidak terlihat lagi. */
    reset: z.boolean(),
  })
  .openapi('SyncPull');

/** Urutan tabel di cursor. JANGAN diubah urutannya (cursor tersimpan di HP). */
const PULL_TABLES: readonly PullTable[] = [
  'locations',
  'farmers',
  'animals',
  'animalTags',
  'qrCodes',
  'events',
  'serviceRequests',
  'assignments',
  'semenStock',
  'users',
  'auditLogs',
  'syncReviews',
  'feedback',
  'isikhnasReports',
];

const DEFAULT_PULL_LIMIT = 500;
const MAX_PULL_LIMIT = 1000;

/** Baris sesudah cursor untuk tabel ke-`index` (urutan (updated_at, tabel, id)). */
function afterCursor(
  index: number,
  cursor: SyncCursor | null,
  updatedAt: SQLiteColumn,
  id: SQLiteColumn,
): SQL | undefined {
  if (!cursor) return undefined;
  if (index > cursor.tb) return gte(updatedAt, cursor.t);
  if (index < cursor.tb) return gt(updatedAt, cursor.t);
  return or(gt(updatedAt, cursor.t), and(eq(updatedAt, cursor.t), gt(id, cursor.id)));
}

function toReview(row: typeof syncChanges.$inferSelect): SyncReview {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deviceId: row.deviceId,
    userId: row.userId,
    kind: row.kind,
    rowId: row.rowId,
    animalId: row.animalId,
    code: row.code,
    message: row.message,
    payload: row.payload ?? {},
    resolvedAt: row.resolvedAt,
    resolution: row.resolution,
  };
}

export function registerSyncRoutes(app: OpenAPIHono<AppEnv>) {
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/sync/push',
      tags,
      security,
      summary: 'Kirim batch perubahan dari outbox HP (idempoten per id perubahan)',
      description:
        'Setiap perubahan dijalankan berurutan lewat route REST yang sama (daftar putih kind → path). ' +
        'Hasil: applied, merged (sebagian kolom profil kalah oleh versi lebih baru), needs_review ' +
        '(event ditolak karena urutan riwayat; disimpan dan tampil "perlu dicek"), rejected. ' +
        'Gangguan server menghentikan pemrosesan: perubahan sisanya tidak punya hasil dan dicoba lagi.',
      request: jsonBody(pushRequestSchema),
      responses: { 200: jsonContent(pushResponseSchema, 'Hasil per perubahan'), ...errorResponses },
    }),
    async (c) => {
      const scope = scopeOf(c);
      const { db } = c.var;
      const results: SyncChangeResult[] = [];
      for (const change of c.req.valid('json').changes) {
        const known = db.select().from(syncChanges).where(eq(syncChanges.id, change.id)).get();
        if (known) {
          if (known.userId !== scope.user.id) {
            results.push({
              id: change.id,
              result: 'rejected',
              code: 'CONFLICT',
              message: 'Id perubahan sudah dipakai.',
              body: null,
            });
          } else {
            results.push({
              id: change.id,
              result: known.result,
              code: known.code,
              message: known.message,
              body: null,
            });
          }
          continue;
        }

        const route = ROUTES[change.kind];
        let outcome: ReturnType<typeof classify>;
        if (change.method !== route.method || !route.path.test(change.path)) {
          outcome = {
            result: 'rejected',
            code: 'FORBIDDEN',
            message: 'Jenis perubahan tidak cocok dengan alamatnya.',
            body: null,
          };
        } else {
          outcome = classify(change, await dispatch(app, c, change));
        }
        if (outcome === 'unauthenticated') {
          throw new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
        }
        if (outcome === 'retry') break; // gangguan server: sisanya dicoba lagi nanti

        const animalId = ANIMAL_PATH.exec(change.path)?.[1] ?? null;
        const keep = outcome.result === 'needs_review' || outcome.result === 'rejected';
        const time = c.var.now();
        db.transaction((tx) => {
          tx.insert(syncChanges)
            .values({
              ...newRow(c, change.id),
              userId: scope.user.id,
              kind: change.kind,
              rowId: change.rowId ?? null,
              animalId,
              result: outcome.result,
              code: outcome.code,
              message: outcome.message,
              payload: keep
                ? {
                    method: change.method,
                    path: change.path,
                    body: change.body ?? null,
                    at: change.at,
                  }
                : null,
              resolvedAt: null,
              resolution: null,
            })
            .run();
          // Event yang dulu perlu dicek kini diterima (kirim ulang): tandai selesai.
          if (change.kind === 'event.create' && outcome.result === 'applied' && change.rowId) {
            tx.update(syncChanges)
              .set({ resolvedAt: time, resolution: 'resent', updatedAt: time })
              .where(
                and(
                  eq(syncChanges.rowId, change.rowId),
                  eq(syncChanges.result, 'needs_review'),
                  isNull(syncChanges.resolvedAt),
                ),
              )
              .run();
          }
        });
        results.push({ id: change.id, ...outcome });
      }
      return c.json({ results }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/sync/pull',
      tags,
      security,
      summary: 'Baris berubah dalam cakupan pengguna, berhalaman',
      description:
        'Urut (updated_at, tabel, id). Kirim `cursor` dari respons sebelumnya untuk halaman ' +
        'berikutnya, dan `scope` terakhir: bila cakupan berubah, pull diulang dari awal (`reset`). ' +
        'Baris terhapus (deletedAt terisi) ikut dikirim. Status reproduksi dihitung di klien.',
      request: {
        query: z.object({
          cursor: z.string().max(120).optional(),
          scope: z.string().max(60).optional(),
          limit: z.coerce.number().int().min(1).max(MAX_PULL_LIMIT).default(DEFAULT_PULL_LIMIT),
        }),
      },
      responses: { 200: jsonContent(pullResponseSchema, 'Perubahan'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { db } = c.var;
      const query = c.req.valid('query');
      const vis = visibilityOf(db, scope);
      const reset = query.scope !== undefined && query.scope !== vis.key;
      let cursor: SyncCursor | null;
      try {
        cursor = reset ? null : decodeCursor(query.cursor);
      } catch {
        cursor = null;
      }
      const limit = query.limit;
      const admin = isAdmin(scope.user);
      const take = limit + 1;

      const fetchers: Record<PullTable, (i: number) => { updatedAt: number; id: string }[]> = {
        locations: (i) =>
          db
            .select()
            .from(locations)
            .where(afterCursor(i, cursor, locations.updatedAt, locations.id))
            .orderBy(locations.updatedAt, locations.id)
            .limit(take)
            .all(),
        farmers: (i) =>
          db
            .select()
            .from(farmers)
            .where(
              and(
                inIds(farmers.id, vis.farmerIds),
                afterCursor(i, cursor, farmers.updatedAt, farmers.id),
              ),
            )
            .orderBy(farmers.updatedAt, farmers.id)
            .limit(take)
            .all(),
        animals: (i) =>
          db
            .select()
            .from(animals)
            .where(
              and(
                inIds(animals.id, vis.animalIds),
                afterCursor(i, cursor, animals.updatedAt, animals.id),
              ),
            )
            .orderBy(animals.updatedAt, animals.id)
            .limit(take)
            .all(),
        animalTags: (i) =>
          db
            .select()
            .from(animalTags)
            .where(
              and(
                inIds(animalTags.animalId, vis.animalIds),
                afterCursor(i, cursor, animalTags.updatedAt, animalTags.id),
              ),
            )
            .orderBy(animalTags.updatedAt, animalTags.id)
            .limit(take)
            .all(),
        qrCodes: (i) =>
          db
            .select()
            .from(qrCodes)
            .where(
              and(
                eq(qrCodes.issuedBy, scope.user.id),
                afterCursor(i, cursor, qrCodes.updatedAt, qrCodes.id),
              ),
            )
            .orderBy(qrCodes.updatedAt, qrCodes.id)
            .limit(take)
            .all(),
        events: (i) =>
          db
            .select()
            .from(events)
            .where(
              and(
                inIds(events.animalId, vis.animalIds),
                afterCursor(i, cursor, events.updatedAt, events.id),
              ),
            )
            .orderBy(events.updatedAt, events.id)
            .limit(take)
            .all(),
        serviceRequests: (i) =>
          db
            .select()
            .from(serviceRequests)
            .where(
              and(
                inIds(serviceRequests.id, vis.requestIds),
                afterCursor(i, cursor, serviceRequests.updatedAt, serviceRequests.id),
              ),
            )
            .orderBy(serviceRequests.updatedAt, serviceRequests.id)
            .limit(take)
            .all(),
        assignments: (i) =>
          db
            .select()
            .from(assignments)
            .where(
              and(
                inIds(assignments.serviceRequestId, vis.requestIds),
                afterCursor(i, cursor, assignments.updatedAt, assignments.id),
              ),
            )
            .orderBy(assignments.updatedAt, assignments.id)
            .limit(take)
            .all(),
        semenStock: (i) =>
          db
            .select()
            .from(semenStock)
            .where(
              and(
                inIds(semenStock.holderId, vis.stockHolders),
                afterCursor(i, cursor, semenStock.updatedAt, semenStock.id),
              ),
            )
            .orderBy(semenStock.updatedAt, semenStock.id)
            .limit(take)
            .all(),
        users: (i) =>
          db
            .select()
            .from(users)
            .where(
              and(inIds(users.id, vis.userIds), afterCursor(i, cursor, users.updatedAt, users.id)),
            )
            .orderBy(users.updatedAt, users.id)
            .limit(take)
            .all()
            .map((row) => {
              const u = toAuthUser(row);
              return admin ? u : { ...u, email: null };
            }),
        auditLogs: (i) =>
          admin
            ? db
                .select()
                .from(auditLogs)
                .where(
                  and(
                    eq(auditLogs.tableName, 'service_requests'),
                    inIds(auditLogs.rowId, vis.requestIds),
                    afterCursor(i, cursor, auditLogs.updatedAt, auditLogs.id),
                  ),
                )
                .orderBy(auditLogs.updatedAt, auditLogs.id)
                .limit(take)
                .all()
            : [],
        syncReviews: (i) =>
          db
            .select()
            .from(syncChanges)
            .where(
              and(
                eq(syncChanges.result, 'needs_review'),
                admin
                  ? or(
                      eq(syncChanges.userId, scope.user.id),
                      inIds(syncChanges.animalId, vis.animalIds),
                    )
                  : eq(syncChanges.userId, scope.user.id),
                afterCursor(i, cursor, syncChanges.updatedAt, syncChanges.id),
              ),
            )
            .orderBy(syncChanges.updatedAt, syncChanges.id)
            .limit(take)
            .all()
            .map(toReview),
        // Masukan: pengirim melihat miliknya; admin melihat masukan pengguna di wilayahnya.
        feedback: (i) =>
          db
            .select()
            .from(feedback)
            .where(
              and(
                admin ? inIds(feedback.userId, vis.userIds) : eq(feedback.userId, scope.user.id),
                afterCursor(i, cursor, feedback.updatedAt, feedback.id),
              ),
            )
            .orderBy(feedback.updatedAt, feedback.id)
            .limit(take)
            .all(),
        isikhnasReports: (i) =>
          db
            .select()
            .from(isikhnasReports)
            .where(
              and(
                inIds(isikhnasReports.animalId, vis.animalIds),
                afterCursor(i, cursor, isikhnasReports.updatedAt, isikhnasReports.id),
              ),
            )
            .orderBy(isikhnasReports.updatedAt, isikhnasReports.id)
            .limit(take)
            .all(),
      };

      const candidates = PULL_TABLES.flatMap((table, i) =>
        fetchers[table](i).map((row) => ({
          table,
          row,
          key: { t: row.updatedAt, tb: i, id: row.id } satisfies SyncCursor,
        })),
      ).sort((a, b) => compareCursor(a.key, b.key));
      const page = candidates.slice(0, limit);
      const rows = Object.fromEntries(PULL_TABLES.map((t) => [t, [] as unknown[]])) as Record<
        PullTable,
        unknown[]
      >;
      for (const item of page) rows[item.table].push(item.row);
      const last = page.at(-1);
      return c.json(
        {
          rows: rows as PullRows,
          cursor: last ? encodeCursor(last.key) : cursor ? encodeCursor(cursor) : null,
          hasMore: candidates.length > limit,
          scope: vis.key,
          reset,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/sync/reviews/{id}/discard',
      tags,
      security,
      summary: 'Buang event "perlu dicek" (pencatatnya, atau admin di wilayahnya)',
      description: 'Tidak menghapus: catatan tetap tersimpan dengan resolution = discarded.',
      request: {
        params: idParamSchema,
        ...jsonBody(z.object({ reason: z.string().trim().max(300).optional() })),
      },
      responses: { 200: jsonContent(reviewDtoSchema, 'Dibuang'), ...errorResponses },
    }),
    (c) => {
      const scope = scopeOf(c);
      const { db } = c.var;
      const row = db
        .select()
        .from(syncChanges)
        .where(
          and(eq(syncChanges.id, c.req.valid('param').id), eq(syncChanges.result, 'needs_review')),
        )
        .get();
      if (!row) throw notFound('Catatan');
      const own = row.userId === scope.user.id;
      if (!own) {
        if (!isAdmin(scope.user)) throw notFound('Catatan');
        if (!row.animalId || !visibilityOf(db, scope).animalIds.has(row.animalId))
          throw notFound('Catatan');
      }
      if (row.resolution === 'discarded') return c.json(toReview(row), 200);
      if (row.resolution === 'resent') throw conflict('Catatan ini sudah diterima server.');
      if (!own && !isAdmin(scope.user)) throw forbidden();
      const time = c.var.now();
      const updated = {
        ...row,
        resolvedAt: time,
        resolution: 'discarded' as const,
        updatedAt: time,
      };
      db.transaction((tx) => {
        tx.update(syncChanges)
          .set({ resolvedAt: time, resolution: 'discarded', updatedAt: time })
          .where(eq(syncChanges.id, row.id))
          .run();
        audit(c, tx, {
          tableName: 'sync_changes',
          rowId: row.id,
          action: 'delete',
          before: { kind: row.kind, rowId: row.rowId, message: row.message },
          after: { reason: c.req.valid('json').reason ?? null },
        });
      });
      return c.json(toReview(updated), 200);
    },
  );
}
