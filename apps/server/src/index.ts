import { serve } from '@hono/node-server';

import { createApp } from './app';
import { loadConfig } from './config';
import { bootstrapDatabase } from './db/bootstrap';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { registerWebApp } from './http/web-app';
import { startBackupScheduler } from './ops/backup';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const config = loadConfig();
const { db, sqlite } = createDb();
runMigrations(db);

const created = await bootstrapDatabase(db);
if (created === 'admin') console.log(`Akun admin pertama dibuat: ${process.env.ADMIN_EMAIL ?? ''}`);
if (created === 'demo') console.log('Data contoh fiktif diisi (DEMO_DATA=1).');

const app = createApp({ db });
// Pos IB: build web disajikan dari server yang sama (WEB_DIST, mis. di image Docker).
if (process.env.WEB_DIST) registerWebApp(app, process.env.WEB_DIST);
// Cadangan harian SQLite (BACKUP_DIR, simpan BACKUP_KEEP terakhir). Matikan: BACKUP_DISABLED=1.
if (process.env.BACKUP_DISABLED !== '1') {
  startBackupScheduler(sqlite, config.backupDir, config.backupKeep);
}

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`Server berjalan di http://localhost:${String(info.port)}`);
  console.log(`Dokumentasi API: http://localhost:${String(info.port)}/api/docs`);
  if (config.publicUrl) console.log(`Buka dari HP: ${config.publicUrl}`);
});
