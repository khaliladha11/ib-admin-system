import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';

/** Folder apps/server, patokan path relatif di DATABASE_URL. */
export const SERVER_ROOT = path.resolve(import.meta.dirname, '../..');

/** Path file SQLite dari env DATABASE_URL (bawaan: data/ib.sqlite di apps/server). */
export function resolveDatabasePath(url = process.env.DATABASE_URL ?? 'data/ib.sqlite'): string {
  if (url === ':memory:') return url;
  return path.resolve(SERVER_ROOT, url.replace(/^file:/, ''));
}

export function createDb(file = resolveDatabasePath()) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema, casing: 'snake_case' });
  return { sqlite, db };
}

export type Db = ReturnType<typeof createDb>['db'];

/** Jumlah baris (sinkron). `db.$count()` mengembalikan builder async, jadi tidak dipakai. */
export function countRows(db: Db, table: SQLiteTable): number {
  return db.select({ n: count() }).from(table).get()?.n ?? 0;
}
