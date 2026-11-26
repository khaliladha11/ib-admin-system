// Sinkronisasi sederhana (langkah 2.0; versi lengkap di Fase 4):
//   push: kirim outbox berurutan (FIFO) lewat endpoint REST biasa;
//   pull: GET /api/sync/changes?since=cursor lalu upsert ke tabel cermin.
//
// Hasil kiriman per entri:
//   2xx                      → selesai; baris lokal diganti versi server
//   409 ALREADY_EXISTS       → sudah pernah diterima (kiriman ulang) → selesai
//   4xx lain (400/403/404/409/422) → ditolak; pesan disimpan, antrean lanjut
//   401                      → berhenti; pengguna perlu masuk lagi
//   jaringan putus atau 5xx  → berhenti; dicoba lagi dengan backoff
import {
  animalSchema,
  assignmentSchema,
  eventSchema,
  farmerSchema,
  serviceRequestSchema,
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
  markDone,
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

export type ChangesResponse = { serverTime: number } & {
  [T in keyof MirrorRows]: MirrorRows[T][];
};

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

const isAlreadyExists = (err: ApiRequestError) =>
  err.status === 409 && err.code === 'ALREADY_EXISTS';

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
      const [entry] = await pendingEntries(db);
      if (!entry) return result;
      if (entry.nextAttemptAt > now()) return { ...result, stopped: 'backoff' };
      try {
        const body = await api.request(entry.method, entry.path, entry.body);
        await accept(entry, body);
        result.sent += 1;
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          await updateState({ needsLogin: true, lastError: err.message });
          return { ...result, stopped: 'unauthenticated' };
        }
        if (err instanceof ApiRequestError && isAlreadyExists(err)) {
          await accept(entry, undefined);
          result.sent += 1;
          continue;
        }
        if (err instanceof ApiRequestError && err.status < 500) {
          await markRejected(db, entry, err.message);
          result.rejected += 1;
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        await markRetry(db, entry, message, now());
        await updateState({ lastError: message });
        if (err instanceof NetworkError || err instanceof ApiRequestError) {
          return { ...result, stopped: 'offline' };
        }
        throw err;
      }
    }
  }

  async function pullChanges(): Promise<number> {
    const state = (await db.getMeta('sync')) ?? INITIAL_SYNC_STATE;
    const changes = await api.request<ChangesResponse>(
      'GET',
      `/api/sync/changes?since=${String(state.cursor)}`,
    );
    let applied = 0;
    await db.transaction(
      'rw',
      [...MIRROR_TABLES.map((t) => db.mirror(t)), db.outbox, db.meta],
      async () => {
        // Baris yang masih punya perubahan lokal belum terkirim tidak ditimpa.
        const pending = await pendingRowIds(db);
        for (const table of MIRROR_TABLES) {
          const rows = ((changes[table] as { id: string }[] | undefined) ?? []).filter(
            (r) => !pending.has(r.id),
          );
          if (rows.length === 0) continue;
          await db.mirror(table).bulkPut(rows as never[]);
          applied += rows.length;
        }
        await db.setMeta('sync', {
          ...state,
          cursor: changes.serverTime,
          lastSyncAt: now(),
          lastError: null,
          needsLogin: false,
        });
      },
    );
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
  function syncNow(): Promise<SyncResult> {
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
    const kick = () => {
      syncNow().catch((err: unknown) => {
        console.error('Sinkron gagal', err);
      });
    };
    kick();
    window.addEventListener('online', kick);
    const timer = window.setInterval(kick, intervalMs);
    return () => {
      window.removeEventListener('online', kick);
      window.clearInterval(timer);
    };
  }

  return { pushOutbox, pullChanges, syncNow, start };
}
