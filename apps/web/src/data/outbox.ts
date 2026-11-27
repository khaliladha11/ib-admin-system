// Outbox: antrean perubahan lokal yang belum diterima server, dikirim berurutan (FIFO).
// Entri yang diterima server dihapus; entri yang ditolak disimpan dengan pesannya agar terlihat.
import { uuidv7 } from '@ib/shared';

import type { IbDb, MirrorTable } from './db';

export type OutboxKind =
  | 'farmer.create'
  | 'farmer.update'
  | 'animal.create'
  | 'animal.update'
  | 'event.create'
  | 'serviceRequest.create'
  | 'serviceRequest.accept'
  | 'serviceRequest.assign'
  | 'serviceRequest.reassign'
  | 'serviceRequest.reject'
  | 'qrCode.reserve'
  | 'tag.attach'
  | 'tag.remove'
  | 'syncReview.discard'
  | 'feedback.create';

export interface OutboxEntry {
  /** Nomor urut otomatis (urutan kirim). */
  seq?: number;
  id: string;
  createdAt: number;
  kind: OutboxKind;
  method: 'POST' | 'PATCH';
  path: string;
  body: unknown;
  /** Baris utama yang diubah entri ini. */
  table: MirrorTable;
  rowId: string;
  /**
   * Baris lokal sementara yang dibuang setelah server menerima, karena server membuat
   * barisnya sendiri dengan id lain (mis. tag QR saat ternak didaftarkan). Pull mengisi versi server.
   */
  provisional: { table: MirrorTable; id: string }[];
  /** Baris lain yang ikut diubah secara lokal (mis. anak sapi dari LH); tidak ditimpa pull selama pending. */
  relatedRowIds: string[];
  /**
   * pending = menunggu dikirim; rejected = tidak diterima server (alasan di lastError);
   * needs_review = event ditolak karena urutan riwayat, tersimpan di server, perlu dicek.
   */
  status: 'pending' | 'rejected' | 'needs_review';
  /** Kode error server untuk rejected/needs_review (mis. INVALID_EVENT). */
  code?: string | null;
  attempts: number;
  lastError: string | null;
  /** Jangan dikirim sebelum waktu ini (backoff setelah gagal jaringan). */
  nextAttemptAt: number;
}

export type NewOutboxEntry = Pick<
  OutboxEntry,
  'kind' | 'method' | 'path' | 'body' | 'table' | 'rowId'
> &
  Partial<Pick<OutboxEntry, 'provisional' | 'relatedRowIds'>>;

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

/** Jeda sebelum percobaan ke-(attempts + 1): 5 dtk, 10 dtk, 20 dtk, … maksimal 5 menit. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);
}

/** Tambah entri. Panggil di dalam transaksi yang sama dengan penulisan barisnya. */
export async function enqueue(db: IbDb, entry: NewOutboxEntry, now: number): Promise<OutboxEntry> {
  const row: OutboxEntry = {
    id: uuidv7(now),
    createdAt: now,
    provisional: [],
    relatedRowIds: [],
    ...entry,
    status: 'pending',
    attempts: 0,
    lastError: null,
    nextAttemptAt: now,
  };
  await db.outbox.add(row);
  return row;
}

/** Entri yang menunggu kiriman, urut FIFO. */
export function pendingEntries(db: IbDb): Promise<OutboxEntry[]> {
  return db.outbox.where('status').equals('pending').sortBy('seq');
}

export function rejectedEntries(db: IbDb): Promise<OutboxEntry[]> {
  return db.outbox.where('status').equals('rejected').sortBy('seq');
}

/** Id ternak dari perubahan (alamat /api/animals/{id}/…, atau baris ternak itu sendiri). */
export function animalIdOf(entry: Pick<OutboxEntry, 'kind' | 'path' | 'rowId'>): string | null {
  const match = /^\/api\/animals\/([0-9a-f-]{36})/.exec(entry.path);
  if (match?.[1]) return match[1];
  return entry.kind === 'animal.create' ? entry.rowId : null;
}

export function reviewEntries(db: IbDb): Promise<OutboxEntry[]> {
  return db.outbox.where('status').equals('needs_review').sortBy('seq');
}

/**
 * Id baris yang masih punya perubahan lokal (menunggu dikirim atau perlu dicek): tidak boleh
 * ditimpa atau dihapus pull.
 */
export async function pendingRowIds(db: IbDb): Promise<Set<string>> {
  const entries = await db.outbox.where('status').anyOf('pending', 'needs_review').toArray();
  return new Set(entries.flatMap((e) => [e.rowId, ...e.relatedRowIds]));
}

export async function markDone(db: IbDb, entry: OutboxEntry): Promise<void> {
  if (entry.seq !== undefined) await db.outbox.delete(entry.seq);
}

export async function markRejected(
  db: IbDb,
  entry: OutboxEntry,
  message: string,
  code: string | null = null,
): Promise<void> {
  if (entry.seq === undefined) return;
  await db.outbox.update(entry.seq, {
    status: 'rejected',
    attempts: entry.attempts + 1,
    lastError: message,
    code,
  });
}

/** Event ditolak karena urutan riwayat: tetap disimpan, tampil "Perlu dicek". */
export async function markNeedsReview(
  db: IbDb,
  entry: OutboxEntry,
  message: string,
  code: string | null,
): Promise<void> {
  if (entry.seq === undefined) return;
  await db.outbox.update(entry.seq, {
    status: 'needs_review',
    attempts: entry.attempts + 1,
    lastError: message,
    code,
  });
}

/**
 * Lewati jeda backoff: kirim sekarang. Dipakai saat sinyal kembali (event `online`) atau saat
 * pengguna menekan "Kirim sekarang", agar catatan tidak menunggu sampai 5 menit.
 */
export async function clearBackoff(db: IbDb, now: number): Promise<void> {
  await db.outbox
    .where('status')
    .equals('pending')
    .and((e) => e.nextAttemptAt > now)
    .modify({ nextAttemptAt: now });
}

export async function markRetry(
  db: IbDb,
  entry: OutboxEntry,
  message: string,
  now: number,
): Promise<void> {
  if (entry.seq === undefined) return;
  const attempts = entry.attempts + 1;
  await db.outbox.update(entry.seq, {
    attempts,
    lastError: message,
    nextAttemptAt: now + backoffMs(attempts),
  });
}

/** Buang entri yang ditolak (setelah pengguna melihat pesannya). */
export async function dismissRejected(db: IbDb, id: string): Promise<void> {
  await db.outbox.where('id').equals(id).delete();
}
