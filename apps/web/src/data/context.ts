import { createContext } from 'react';

import { IbDb } from './db';
import { createRepo, ensureDeviceId, type Repo } from './repo';
import { createApiClient, type ApiClient } from './sync/api';
import { createSyncEngine, type SyncEngine } from './sync/engine';

export interface DataLayer {
  db: IbDb;
  repo: Repo;
  api: ApiClient;
  sync: SyncEngine;
  /** Waktu "hari ini" untuk status dan jadwal. Diganti di tes. */
  now: () => number;
}

export interface DataLayerOptions {
  dbName?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  /** Picu sinkron setelah setiap penulisan (default true; dimatikan di tes). */
  syncOnWrite?: boolean;
}

/** Rakit lapisan data: Dexie + repo (tulis) + sync engine. Setiap tulis memicu sinkron. */
export function createDataLayer({
  dbName,
  baseUrl,
  fetch,
  now = () => Date.now(),
  syncOnWrite = true,
}: DataLayerOptions = {}): DataLayer {
  const db = new IbDb(dbName);
  const api = createApiClient({ baseUrl, fetch, deviceId: () => ensureDeviceId(db) });
  const sync = createSyncEngine(db, { api, now });
  const repo = createRepo(db, {
    now,
    onChange: () => {
      if (!syncOnWrite) return;
      sync.syncNow().catch((err: unknown) => {
        console.error('Sinkron gagal', err);
      });
    },
  });
  return { db, repo, api, sync, now };
}

export const DataContext = createContext<DataLayer | null>(null);
