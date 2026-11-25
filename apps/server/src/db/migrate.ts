import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDb, SERVER_ROOT, type Db } from './client';

export const MIGRATIONS_FOLDER = path.join(SERVER_ROOT, 'drizzle');

export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

// Dijalankan langsung: `pnpm db:migrate`
if (import.meta.filename === process.argv[1]) {
  const { db, sqlite } = createDb();
  runMigrations(db);
  console.log(`Migrasi selesai: ${sqlite.name}`);
  sqlite.close();
}
