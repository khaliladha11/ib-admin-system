import { deriveReproStatus, uuidv7, type DomainEvent } from '@ib/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Context } from 'hono';

import { canAccessFarmer, loadScope, type Scope } from '../auth/scope';
import { requireUser } from '../auth/session';
import type { Db } from '../db/client';
import { animals, animalTags, auditLogs, events, farmers, qrCodes } from '../db/schema';
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
    action: 'insert' | 'update' | 'delete';
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
