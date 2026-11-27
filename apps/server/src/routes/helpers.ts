import {
  clampChangeTime,
  deriveReproStatus,
  mergeFieldVersions,
  uuidv7,
  type DomainEvent,
} from '@ib/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Context } from 'hono';

import { canAccessFarmer, loadScope, type Scope } from '../auth/scope';
import { requireUser } from '../auth/session';
import type { Db } from '../db/client';
import {
  animals,
  animalTags,
  auditLogs,
  events,
  farmers,
  fieldVersions,
  qrCodes,
} from '../db/schema';
import { alreadyExists, notFound } from '../http/errors';
import type { AppEnv } from '../http/env';
import { toStatusDto } from '../http/schemas';

export type AppContext = Context<AppEnv>;

/** Pengguna + cakupan aksesnya untuk request ini. */
export function scopeOf(c: AppContext): Scope {
  return loadScope(c.var.db, requireUser(c));
}

/** Kolom umum untuk baris baru. `id` boleh dikirim klien (UUID dari HP saat offline). */
export function newRow(c: AppContext, id?: string) {
  const time = c.var.now();
  return {
    id: id ?? uuidv7(time),
    createdAt: time,
    updatedAt: time,
    deletedAt: null,
    deviceId: c.var.deviceId,
  };
}

/** Pastikan id baru belum dipakai (409 ALREADY_EXISTS: kiriman ulang dari outbox). */
export function assertNewId(exists: boolean) {
  if (exists) throw alreadyExists();
}

export function loadFarmer(c: AppContext, scope: Scope, id: string) {
  const farmer = c.var.db
    .select()
    .from(farmers)
    .where(and(eq(farmers.id, id), isNull(farmers.deletedAt)))
    .get();
  if (!farmer || !canAccessFarmer(scope, farmer)) throw notFound('Peternak');
  return farmer;
}

export function loadAnimal(c: AppContext, scope: Scope, id: string) {
  const row = c.var.db
    .select({ animal: animals, farmer: farmers })
    .from(animals)
    .innerJoin(farmers, eq(farmers.id, animals.farmerId))
    .where(and(eq(animals.id, id), isNull(animals.deletedAt)))
    .get();
  if (!row || !canAccessFarmer(scope, row.farmer)) throw notFound('Ternak');
  return row;
}

/** Baris event dari database dipakai sebagai DomainEvent (payload sudah divalidasi saat disimpan). */
export const toDomainEvent = (row: typeof events.$inferSelect) => row as unknown as DomainEvent;

export function eventsOfAnimals(db: Db, animalIds: string[]) {
  if (animalIds.length === 0) return new Map<string, (typeof events.$inferSelect)[]>();
  const rows = db
    .select()
    .from(events)
    .where(and(inArray(events.animalId, animalIds), isNull(events.deletedAt)))
    .orderBy(asc(events.occurredAt))
    .all();
  const map = new Map<string, (typeof events.$inferSelect)[]>();
  for (const row of rows) map.set(row.animalId, [...(map.get(row.animalId) ?? []), row]);
  return map;
}

export function activeQrCodes(db: Db, animalIds: string[]) {
  if (animalIds.length === 0) return new Map<string, string>();
  const rows = db
    .select({ animalId: animalTags.animalId, code: animalTags.code })
    .from(animalTags)
    .where(
      and(
        inArray(animalTags.animalId, animalIds),
        eq(animalTags.type, 'qr'),
        isNull(animalTags.removedAt),
        isNull(animalTags.deletedAt),
      ),
    )
    .all();
  return new Map(rows.map((r) => [r.animalId, r.code]));
}

/** Ternak + status reproduksi terhitung + kode QR aktif. */
export function withStatus(c: AppContext, rows: (typeof animals.$inferSelect)[]) {
  const ids = rows.map((a) => a.id);
  const eventMap = eventsOfAnimals(c.var.db, ids);
  const qr = activeQrCodes(c.var.db, ids);
  const today = c.var.now();
  return rows.map((animal) => ({
    ...animal,
    status: toStatusDto(
      deriveReproStatus((eventMap.get(animal.id) ?? []).map(toDomainEvent), today).status,
    ),
    qrCode: qr.get(animal.id) ?? null,
  }));
}

/** Catat perubahan ke audit_logs. */
export function audit(
  c: AppContext,
  db: Pick<Db, 'insert'>,
  entry: {
    tableName: string;
    rowId: string;
    action: 'insert' | 'update' | 'delete' | 'conflict';
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  },
) {
  db.insert(auditLogs)
    .values({ ...newRow(c), actorId: c.var.user?.id ?? null, ...entry })
    .run();
}

/** Hanya field yang berubah, untuk audit log. */
export function changedFields<T extends Record<string, unknown>>(before: T, patch: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && before[key] !== value) {
      b[key] = before[key];
      a[key] = value;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Kode QR sudah ada di daftar kode atau pernah dipasang sebagai tag. */
export function qrCodeTaken(db: Db | Tx, code: string) {
  return (
    !!db.select({ id: qrCodes.id }).from(qrCodes).where(eq(qrCodes.code, code)).get() ||
    !!db
      .select({ id: animalTags.id })
      .from(animalTags)
      .where(and(eq(animalTags.type, 'qr'), eq(animalTags.code, code)))
      .get()
  );
}

/**
 * Tag QR yang dipasang harus ada di daftar kode. Label dari perangkat lain sudah terdaftar
 * (kirimannya lebih dulu di outbox); kode yang diketik dari label lama didaftarkan di sini.
 */
export function registerQrCode(c: AppContext, tx: Tx, code: string) {
  if (tx.select({ id: qrCodes.id }).from(qrCodes).where(eq(qrCodes.code, code)).get()) return;
  tx.insert(qrCodes)
    .values({ ...newRow(c), code, issuedBy: requireUser(c).id })
    .run();
}

/** Header dari POST /api/sync/push: waktu perubahan dibuat di HP. */
export const CHANGE_AT_HEADER = 'x-ib-change-at';
/** Header dari POST /api/sync/push: permintaan ini bagian dari sinkron. */
export const SYNC_HEADER = 'x-ib-sync';
/** Header respons: sebagian kolom kalah oleh versi lebih baru (hasil push `merged`). */
export const MERGED_HEADER = 'x-ib-merged';

/** Waktu perubahan: dari HP lewat push (dipotong agar tidak di masa depan), selain itu sekarang. */
export function changeTimeOf(c: AppContext): number {
  const raw = c.req.header(CHANGE_AT_HEADER);
  return clampChangeTime(raw ? Number(raw) : undefined, c.var.now());
}

type ProfileTable = typeof farmers | typeof animals;

/**
 * Ubah profil peternak/ternak dengan aturan konflik per kolom (docs/SYNC.md §5): kolom yang
 * diubah lebih baru di HP lain tidak ditimpa; nilai yang kalah dicatat di audit_logs
 * (`conflict`), nilai lama yang ditimpa dicatat sebagai `update`. Satu transaksi.
 */
export function updateProfile<Row extends { id: string; updatedAt: number }>(
  c: AppContext,
  table: ProfileTable,
  tableName: 'farmers' | 'animals',
  row: Row,
  patch: Record<string, unknown>,
): { row: Row; merged: boolean } {
  const { db } = c.var;
  const at = changeTimeOf(c);
  const times = Object.fromEntries(
    db
      .select({ field: fieldVersions.field, changedAt: fieldVersions.changedAt })
      .from(fieldVersions)
      .where(and(eq(fieldVersions.tableName, tableName), eq(fieldVersions.rowId, row.id)))
      .all()
      .map((r) => [r.field, r.changedAt]),
  );
  // Kolom yang belum pernah tercatat waktunya: kiriman selalu dipakai (patokan 0).
  const merge = mergeFieldVersions(row, times, patch, at, 0);
  const lostAny = Object.keys(merge.lost).length > 0;
  const applyAny = Object.keys(merge.apply).length > 0;
  const updated = applyAny
    ? { ...row, ...merge.apply, updatedAt: c.var.now(), deviceId: c.var.deviceId }
    : row;
  db.transaction((tx) => {
    if (applyAny) {
      tx.update(table).set(updated).where(eq(table.id, row.id)).run();
      audit(c, tx, {
        tableName,
        rowId: row.id,
        action: 'update',
        before: merge.previous,
        after: merge.apply,
      });
    }
    for (const [field, changedAt] of Object.entries(merge.times)) {
      if (times[field] === changedAt) continue;
      tx.insert(fieldVersions)
        .values({ tableName, rowId: row.id, field, changedAt })
        .onConflictDoUpdate({
          target: [fieldVersions.tableName, fieldVersions.rowId, fieldVersions.field],
          set: { changedAt },
        })
        .run();
    }
    if (lostAny) {
      audit(c, tx, {
        tableName,
        rowId: row.id,
        action: 'conflict',
        before: { ...merge.lost, changedAt: at },
        after: merge.kept,
      });
    }
  });
  if (lostAny) c.header(MERGED_HEADER, '1');
  return { row: updated, merged: lostAny };
}
