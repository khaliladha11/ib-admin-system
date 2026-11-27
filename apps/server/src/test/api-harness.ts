// Harness tes integrasi API: database SQLite in-memory berisi data contoh,
// jam yang bisa dimajukan, dan klien yang menyimpan cookie sesi per pengguna.
import { uuidv7 } from '@ib/shared';
import { eq } from 'drizzle-orm';

import { createApp } from '../app';
import type { ServerConfig } from '../config';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { semenStock, users } from '../db/schema';
import { buildSeedData, insertSeedData, SEED_PASSWORD, setSeedPasswords } from '../db/seed';

export const DAY = 86_400_000;
export const START = Date.UTC(2026, 10, 25, 3, 0, 0);

/** Akun contoh dari seed. */
export const ACCOUNTS = {
  agencyAdmin: 'admin.dinas@contoh.test',
  groupAdmin1: 'admin.ktt01@contoh.test', // KTT Sumber Rejeki
  groupAdmin2: 'admin.ktt02@contoh.test', // KTT Maju Bersama
  andi: '081200000201', // inseminator
  rina: '081200000202', // inseminator
  yusuf: '081200000203', // inseminator
  suparman: '081200000100', // peternak (KTT-01) dengan akun
  siti: '081200000103', // peternak (KTT-01) dengan akun
  agus: '081200000106', // peternak (KTT-02) dengan akun
} as const;
export type Account = keyof typeof ACCOUNTS;

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

export async function createHarness(config: Partial<ServerConfig> = {}) {
  const { db, sqlite } = createDb(':memory:');
  runMigrations(db);
  const seed = buildSeedData(START);
  insertSeedData(db, seed);
  await setSeedPasswords(db);

  let clock = START;
  const app = createApp({ db, now: () => clock, config: { cookieSecure: false, ...config } });

  async function request<T = any>(
    method: string,
    path: string,
    { body, cookie }: { body?: unknown; cookie?: string } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { 'x-device-id': 'tes' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      body: (text ? JSON.parse(text) : null) as T,
      headers: res.headers,
    };
  }

  const cookies = new Map<Account, string>();

  async function login(account: Account): Promise<string> {
    const cached = cookies.get(account);
    if (cached) return cached;
    const res = await request('POST', '/api/auth/login', {
      body: { identifier: ACCOUNTS[account], password: SEED_PASSWORD },
    });
    if (res.status !== 200) throw new Error(`Login ${account} gagal: ${JSON.stringify(res.body)}`);
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) throw new Error('Cookie sesi tidak ada');
    cookies.set(account, cookie);
    return cookie;
  }

  /** Klien yang sudah masuk sebagai `account`. */
  async function as(account: Account) {
    const cookie = await login(account);
    return {
      get: <T = any>(path: string) => request<T>('GET', path, { cookie }),
      post: <T = any>(path: string, body?: unknown) =>
        request<T>('POST', path, { body: body ?? {}, cookie }),
      patch: <T = any>(path: string, body: unknown) => request<T>('PATCH', path, { body, cookie }),
      del: <T = any>(path: string) => request<T>('DELETE', path, { cookie }),
    };
  }

  /**
   * Tarik semua halaman GET /api/sync/pull dan gabungkan barisnya per tabel.
   * `cursor`/`scope` untuk melanjutkan dari pull sebelumnya.
   */
  async function pullAll(
    account: Account,
    from: { cursor?: string | null; scope?: string } = {},
    limit = 500,
  ) {
    const client = await as(account);
    const rows: Record<string, any[]> = {};
    let cursor = from.cursor ?? null;
    let scope = from.scope;
    let pages = 0;
    let reset = false;
    for (;;) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (cursor) qs.set('cursor', cursor);
      if (scope) qs.set('scope', scope);
      const res = await client.get(`/api/sync/pull?${qs.toString()}`);
      if (res.status !== 200) throw new Error(`pull ${String(res.status)}`);
      pages += 1;
      reset ||= res.body.reset;
      for (const [table, list] of Object.entries(res.body.rows as Record<string, any[]>)) {
        rows[table] = [...(rows[table] ?? []), ...list];
      }
      cursor = res.body.cursor;
      scope = res.body.scope;
      if (!res.body.hasMore) break;
      if (pages > 200) throw new Error('pull tidak berhenti');
    }
    return { rows, cursor, scope, pages, reset };
  }

  function userId(account: Account) {
    const identifier = ACCOUNTS[account];
    const row = db
      .select()
      .from(users)
      .all()
      .find((u) => u.email === identifier || u.phone === identifier);
    if (!row) throw new Error(`Akun ${account} tidak ada`);
    return row.id;
  }

  function stockOf(account: Account) {
    const row = db
      .select()
      .from(semenStock)
      .where(eq(semenStock.holderId, userId(account)))
      .get();
    if (!row) throw new Error('Stok tidak ada');
    return row;
  }

  return {
    app,
    db,
    sqlite,
    seed,
    request,
    as,
    login,
    userId,
    pullAll,
    stockOf,
    now: () => clock,
    /** Majukan jam. Sesi berlaku 30 hari, jadi cookie lama dibuang dan login diulang. */
    advanceDays: (days: number) => {
      clock += days * DAY;
      cookies.clear();
    },
    newId: () => uuidv7(clock),
    close: () => {
      sqlite.close();
    },
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;
