// Sinkronisasi HP ↔ server (langkah 4.2, docs/SYNC.md):
//   push: POST /api/sync/push dengan ≤ 50 entri outbox (FIFO), idempoten per id entri;
//   pull: GET /api/sync/pull halaman demi halaman (cursor + sidik jari cakupan).
//
// Hasil per entri dari server:
//   applied / merged  → selesai; baris lokal diganti versi server
//   needs_review      → event ditolak karena urutan riwayat: tetap disimpan, "Perlu dicek"
//   rejected          → tidak diterima; pesan disimpan, antrean lanjut
//   tanpa hasil (gangguan server di tengah batch) → dicoba lagi dengan backoff
// Seluruh request: 401 → berhenti, perlu masuk lagi; jaringan/5xx → berhenti + backoff.
import {
  animalSchema,
  animalTagSchema,
  assignmentSchema,
  eventSchema,
  farmerSchema,
  qrCodeSchema,
  serviceRequestSchema,
  syncReviewSchema,
  MAX_PUSH_CHANGES,
  type SyncChangeResult,
} from '@ib/shared';

import {
  INITIAL_SYNC_STATE,
  MIRROR_TABLES,
  type IbDb,
  type MirrorRows,
  type MirrorTable,
  type SyncState,
} from '../db';
import {
  clearBackoff,
  markDone,
  markNeedsReview,
  markRejected,
  markRetry,
  pendingEntries,
  pendingRowIds,
  type OutboxEntry,
} from '../outbox';
import { ApiRequestError, NetworkError, type ApiClient } from './api';

export type SyncStop = 'offline' | 'unauthenticated' | 'backoff' | null;

export interface PushResult {
  sent: number;
  rejected: number;
  stopped: SyncStop;
}

export interface SyncResult extends PushResult {
  /** Jumlah baris dari server yang disimpan, atau null bila pull tidak berjalan. */
  pulled: number | null;
}

export interface PullResponse {
  rows: { [T in keyof MirrorRows]?: MirrorRows[T][] };
  cursor: string | null;
  hasMore: boolean;
  scope: string;
  reset: boolean;
}

interface PushResponse {
  results: SyncChangeResult[];
}

/** Ukuran halaman pull. */
export const PULL_PAGE_SIZE = 500;
/** Tabel yang isinya bergantung cakupan: dibersihkan setelah pull diulang dari awal. */
const SCOPED_TABLES = [
  'farmers',
  'animals',
  'animalTags',
  'events',
  'serviceRequests',
  'assignments',
  'semenStock',
  'users',
  'auditLogs',
  'syncReviews',
] as const satisfies readonly MirrorTable[];

export interface SyncEngineOptions {
  api: ApiClient;
  now?: () => number;
  /** Jeda sinkron berkala saat aplikasi terbuka. */
  intervalMs?: number;
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;

type ServerRows = { [T in MirrorTable]?: MirrorRows[T][] };

const parseOne = <T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  v: unknown,
) => {
  const r = schema.safeParse(v);
  return r.success && r.data !== undefined ? [r.data] : [];
};

/** Baris server dari respons tulis, dibersihkan dari kolom tambahan (status, qrCode, …). */
function serverRows(entry: OutboxEntry, body: unknown): ServerRows {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (entry.kind) {
    case 'farmer.create':
    case 'farmer.update':
      return { farmers: parseOne(farmerSchema, b) };
    case 'animal.create':
    case 'animal.update':
      return { animals: parseOne(animalSchema, b) };
    case 'event.create':
      return { events: parseOne(eventSchema, b.event) };
    case 'qrCode.reserve':
      return { qrCodes: parseOne(qrCodeSchema, b) };
    case 'tag.attach':
    case 'tag.remove':
      return { animalTags: parseOne(animalTagSchema, b) };
    case 'syncReview.discard':
      return { syncReviews: parseOne(syncReviewSchema, b) };
    case 'serviceRequest.create':
    case 'serviceRequest.accept':
    case 'serviceRequest.assign':
    case 'serviceRequest.reassign':
    case 'serviceRequest.reject':
      return {
        serviceRequests: parseOne(serviceRequestSchema, b.request),
        assignments: (Array.isArray(b.assignments) ? b.assignments : []).flatMap((a: unknown) =>
          parseOne(assignmentSchema, a),
        ),
      };
  }
}

export function createSyncEngine(
  db: IbDb,
  { api, now = () => Date.now(), intervalMs = 60_000 }: SyncEngineOptions,
) {
  async function updateState(patch: Partial<SyncState>) {
    const current = (await db.getMeta('sync')) ?? INITIAL_SYNC_STATE;
    await db.setMeta('sync', { ...current, ...patch });
  }

  /** Entri diterima server: hapus dari outbox, buang baris sementara, simpan versi server. */
  async function accept(entry: OutboxEntry, body: unknown) {
    const rows = body === undefined ? {} : serverRows(entry, body);
    const touched = Object.keys(rows) as MirrorTable[];
    const tables = [...new Set([...entry.provisional.map((p) => p.table), ...touched])];
    await db.transaction('rw', [db.outbox, ...tables.map((t) => db.mirror(t))], async () => {
      await markDone(db, entry);
      for (const p of entry.provisional) await db.mirror(p.table).delete(p.id);
      for (const table of touched) {
        const list = rows[table] ?? [];
        if (list.length > 0) await db.mirror(table).bulkPut(list);
      }
    });
  }

  async function pushOutbox(): Promise<PushResult> {
    const result: PushResult = { sent: 0, rejected: 0, stopped: null };
    for (;;) {
      const batch = (await pendingEntries(db)).slice(0, MAX_PUSH_CHANGES);
      const [head] = batch;
      if (!head) return result;
      if (head.nextAttemptAt > now()) return { ...result, stopped: 'backoff' };

      let response: PushResponse;
      try {
        response = await api.request<PushResponse>('POST', '/api/sync/push', {
          changes: batch.map((e) => ({
            id: e.id,
            kind: e.kind,
            method: e.method,
            path: e.path,
            body: e.body,
            rowId: e.rowId,
            at: e.createdAt,
          })),
        });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          await updateState({ needsLogin: true, lastError: err.message });
          return { ...result, stopped: 'unauthenticated' };
        }
        const message = err instanceof Error ? err.message : String(err);
        await markRetry(db, head, message, now());
        await updateState({ lastError: message });
        if (err instanceof NetworkError || err instanceof ApiRequestError) {
          return { ...result, stopped: 'offline' };
        }
        throw err;
      }

      const byId = new Map(response.results.map((r) => [r.id, r]));
      for (const entry of batch) {
        const r = byId.get(entry.id);
        if (!r) {
          // Server berhenti di tengah batch (gangguan): sisanya dicoba lagi nanti.
          await markRetry(db, entry, 'Server sedang terganggu.', now());
          await updateState({ lastError: 'Server sedang terganggu.' });
          return { ...result, stopped: 'offline' };
        }
        if (r.result === 'applied' || r.result === 'merged') {
          await accept(entry, r.body ?? undefined);
          result.sent += 1;
        } else if (r.result === 'needs_review') {
          // Event disembunyikan dari riwayat (tidak dihitung di status/jadwal); isinya tetap
          // di outbox dan di server sampai dikirim ulang atau dibuang.
          await db.transaction('rw', db.outbox, db.events, async () => {
            await markNeedsReview(
              db,
              entry,
              r.message ?? 'Urutan riwayat tidak masuk akal.',
              r.code,
            );
            if (entry.table === 'events') {
              await db.events.update(entry.rowId, { deletedAt: now() });
            }
          });
          result.rejected += 1;
        } else {
          await markRejected(db, entry, r.message ?? 'Tidak diterima server.', r.code);
          result.rejected += 1;
        }
      }
    }
  }

  /** Simpan satu halaman pull; baris dengan perubahan lokal (pending/perlu dicek) dilewati. */
  async function applyPage(page: PullResponse, seen: Map<MirrorTable, Set<string>> | null) {
    let applied = 0;
    await db.transaction(
      'rw',
      [...MIRROR_TABLES.map((t) => db.mirror(t)), db.outbox, db.meta],
      async () => {
        const pending = await pendingRowIds(db);
        for (const table of MIRROR_TABLES) {
          const all = (page.rows[table] ?? []) as { id: string }[];
          if (seen) {
            const set = seen.get(table) ?? new Set<string>();
            for (const r of all) set.add(r.id);
            seen.set(table, set);
          }
          const rows = all.filter((r) => !pending.has(r.id));
          if (rows.length === 0) continue;
          await db.mirror(table).bulkPut(rows as never[]);
          applied += rows.length;
        }
        const state = (await db.getMeta('sync')) ?? INITIAL_SYNC_STATE;
        await db.setMeta('sync', {
          ...state,
          cursor: page.cursor,
          scope: page.scope,
          lastSyncAt: page.hasMore ? state.lastSyncAt : now(),
          lastError: null,
          needsLogin: false,
        });
      },
    );
    return applied;
  }

  /** Setelah pull diulang dari awal: hapus baris yang tidak lagi terlihat (cakupan berubah). */
  async function dropUnseen(seen: Map<MirrorTable, Set<string>>) {
    await db.transaction('rw', [...SCOPED_TABLES.map((t) => db.mirror(t)), db.outbox], async () => {
      const pending = await pendingRowIds(db);
      for (const table of SCOPED_TABLES) {
        const keep = seen.get(table) ?? new Set<string>();
        const ids = await db.mirror(table).toCollection().primaryKeys();
        const gone = ids.filter((id) => !keep.has(id) && !pending.has(id));
        if (gone.length > 0) await db.mirror(table).bulkDelete(gone);
      }
    });
  }

  async function pullChanges(): Promise<number> {
    let applied = 0;
    let seen: Map<MirrorTable, Set<string>> | null = null;
    for (let pages = 0; pages < 1000; pages += 1) {
      const state = (await db.getMeta('sync')) ?? INITIAL_SYNC_STATE;
      const qs = new URLSearchParams({ limit: String(PULL_PAGE_SIZE) });
      if (state.cursor) qs.set('cursor', state.cursor);
      if (state.scope) qs.set('scope', state.scope);
      const page = await api.request<PullResponse>('GET', `/api/sync/pull?${qs.toString()}`);
      if (page.reset) seen = new Map();
      applied += await applyPage(page, seen);
      if (!page.hasMore) break;
    }
    if (seen) await dropUnseen(seen);
    return applied;
  }

  let running: Promise<SyncResult> | null = null;
  let queued = false;

  async function runOnce(): Promise<SyncResult> {
    const push = await pushOutbox();
    if (push.stopped === 'offline' || push.stopped === 'unauthenticated') {
      return { ...push, pulled: null };
    }
    try {
      return { ...push, pulled: await pullChanges() };
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await updateState({ needsLogin: true, lastError: err.message });
        return { ...push, stopped: 'unauthenticated', pulled: null };
      }
      if (err instanceof NetworkError || err instanceof ApiRequestError) {
        await updateState({ lastError: err.message });
        return { ...push, stopped: 'offline', pulled: null };
      }
      throw err;
    }
  }

  /** Push lalu pull. Panggilan saat sinkron sedang berjalan digabung menjadi satu putaran lagi. */
  function syncNow(options: { force?: boolean } = {}): Promise<SyncResult> {
    // force: sinyal baru kembali atau pengguna meminta kirim sekarang → abaikan jeda backoff.
    if (options.force) return clearBackoff(db, now()).then(() => syncNow());
    if (running) {
      queued = true;
      return running;
    }
    running = (async () => {
      try {
        let result = await runOnce();
        while (queued) {
          queued = false;
          result = await runOnce();
        }
        return result;
      } finally {
        running = null;
      }
    })();
    return running;
  }

  /** Jalankan sinkron di latar belakang: sekarang, saat online kembali, dan berkala. */
  function start(): () => void {
    const kick = (force = false) => {
      syncNow({ force }).catch((err: unknown) => {
        console.error('Sinkron gagal', err);
      });
    };
    const onOnline = () => {
      kick(true);
    };
    kick();
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(kick, intervalMs);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }

  return { pushOutbox, pullChanges, syncNow, start };
}
