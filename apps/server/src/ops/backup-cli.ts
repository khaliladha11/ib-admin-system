// Perintah cadangan (server sebaiknya mati saat memulihkan):
//   pnpm db:backup             buat cadangan sekarang
//   pnpm db:backup daftar      daftar cadangan
//   pnpm db:restore <file>     pulihkan dari cadangan (nama file di folder cadangan, atau path)
//   pnpm db:demo-reset         ganti semua data dengan data contoh baru (hanya DEMO_MODE=1)
import { existsSync } from 'node:fs';
import path from 'node:path';

import { loadConfig } from '../config';
import { createDb, resolveDatabasePath } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createBackup, listBackups, restoreBackup } from './backup';
import { resetDemoData } from './demo';

const config = loadConfig();
const [command = 'cadangkan', arg] = process.argv.slice(2);
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

if (command === 'cadangkan') {
  const { sqlite } = createDb();
  const file = await createBackup(sqlite, config.backupDir, Date.now(), config.backupKeep);
  sqlite.close();
  console.log(`Cadangan dibuat: ${file.path} (${kb(file.size)})`);
} else if (command === 'daftar') {
  const files = listBackups(config.backupDir);
  if (files.length === 0) console.log(`Belum ada cadangan di ${config.backupDir}`);
  for (const f of files) console.log(`${f.name}  ${kb(f.size)}`);
} else if (command === 'pulihkan') {
  if (!arg) {
    console.error('Tulis nama file cadangan. Lihat daftarnya: pnpm db:backup daftar');
    process.exit(1);
  }
  const file = existsSync(arg) ? arg : path.join(config.backupDir, arg);
  const dbFile = resolveDatabasePath();
  const safety = restoreBackup(file, dbFile, Date.now());
  console.log(`Database dipulihkan dari ${file}.`);
  if (safety) console.log(`Database sebelumnya disimpan di ${safety}.`);
  console.log('Nyalakan lagi server.');
} else if (command === 'reset-demo') {
  if (!config.demoMode) {
    console.error('Reset data demo hanya untuk server latihan. Jalankan dengan DEMO_MODE=1.');
    process.exit(1);
  }
  const { db, sqlite } = createDb();
  runMigrations(db);
  const now = Date.now();
  const file = await createBackup(sqlite, config.backupDir, now, config.backupKeep);
  await resetDemoData(db, now, true);
  sqlite.close();
  console.log(`Data demo direset (cadangan sebelumnya: ${file.name}). Semua HP perlu masuk lagi.`);
} else {
  console.error(
    `Perintah tidak dikenal: ${command} (cadangkan | daftar | pulihkan <file> | reset-demo)`,
  );
  process.exit(1);
}
