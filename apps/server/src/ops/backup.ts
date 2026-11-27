// Cadangan harian file SQLite (langkah 4.3). Memakai API backup SQLite (aman saat server
// berjalan), menyimpan `backupKeep` file terbaru di folder cadangan.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

export const BACKUP_PREFIX = 'ib-ternak-';
const BACKUP_PATTERN = /^ib-ternak-\d{4}-\d{2}-\d{2}-\d{6}\.sqlite$/;
export const DAY_MS = 86_400_000;

export interface BackupFile {
  name: string;
  path: string;
  size: number;
  /** Waktu cadangan dibuat (dari nama file, UTC ms). */
  createdAt: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Nama file cadangan dari waktu (UTC): ib-ternak-2026-11-27-020000.sqlite */
export function backupName(time: number): string {
  const d = new Date(time);
  return `${BACKUP_PREFIX}${String(d.getUTCFullYear())}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}.sqlite`;
}

export function parseBackupTime(name: string): number | null {
  const m = /^ib-ternak-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.sqlite$/.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, s ?? 0);
}

/** Cadangan yang ada, terbaru dulu. */
export function listBackups(dir: string): BackupFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => BACKUP_PATTERN.test(name))
    .map((name) => {
      const full = path.join(dir, name);
      return { name, path: full, size: statSync(full).size, createdAt: parseBackupTime(name) ?? 0 };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Hapus cadangan lama, sisakan `keep` file terbaru. Mengembalikan nama yang dihapus. */
export function pruneBackups(dir: string, keep: number): string[] {
  const old = listBackups(dir).slice(keep);
  for (const file of old) rmSync(file.path, { force: true });
  return old.map((f) => f.name);
}

/** Buat satu cadangan sekarang (aman saat server berjalan), lalu rapikan yang lama. */
export async function createBackup(
  sqlite: Database.Database,
  dir: string,
  now: number,
  keep: number,
): Promise<BackupFile> {
  mkdirSync(dir, { recursive: true });
  let time = now;
  while (existsSync(path.join(dir, backupName(time)))) time += 1000;
  const target = path.join(dir, backupName(time));
  await sqlite.backup(target);
  pruneBackups(dir, keep);
  return {
    name: path.basename(target),
    path: target,
    size: statSync(target).size,
    createdAt: time,
  };
}

/** Perlu cadangan baru? (belum ada, atau yang terbaru sudah ≥ 24 jam). */
export function backupDue(dir: string, now: number): boolean {
  const [latest] = listBackups(dir);
  return !latest || now - latest.createdAt >= DAY_MS;
}

/**
 * Cadangan otomatis: dicek saat server menyala lalu setiap jam; dibuat bila yang terbaru
 * sudah 24 jam. Mengembalikan fungsi untuk berhenti.
 */
export function startBackupScheduler(
  sqlite: Database.Database,
  dir: string,
  keep: number,
  now: () => number = () => Date.now(),
  checkEveryMs = 60 * 60_000,
): () => void {
  let running = false;
  const tick = () => {
    if (running || !backupDue(dir, now())) return;
    running = true;
    createBackup(sqlite, dir, now(), keep)
      .then((b) => {
        console.log(`Cadangan dibuat: ${b.name}`);
      })
      .catch((err: unknown) => {
        console.error('Cadangan gagal', err);
      })
      .finally(() => {
        running = false;
      });
  };
  tick();
  const timer = setInterval(tick, checkEveryMs);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}

/**
 * Pulihkan database dari file cadangan. Server HARUS mati. File database saat ini disalin dulu
 * ke cadangan "sebelum-pulih" agar pemulihan bisa dibatalkan.
 */
export function restoreBackup(backupFile: string, dbFile: string, now: number): string | null {
  if (!existsSync(backupFile)) throw new Error(`File cadangan tidak ada: ${backupFile}`);
  let safety: string | null = null;
  if (existsSync(dbFile)) {
    safety = `${dbFile}.sebelum-pulih-${backupName(now).slice(BACKUP_PREFIX.length)}`;
    copyFileSync(dbFile, safety);
  }
  for (const suffix of ['-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true });
  copyFileSync(backupFile, dbFile);
  return safety;
}
