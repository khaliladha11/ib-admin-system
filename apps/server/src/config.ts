import path from 'node:path';

import { SERVER_ROOT } from './db/client';

/** Konfigurasi server dari environment variable (lihat .env.example di root). */
export interface ServerConfig {
  /** Cookie hanya dikirim lewat HTTPS. Bawaan: true bila NODE_ENV=production. */
  cookieSecure: boolean;
  /** Lama sesi login, dalam hari. */
  sessionTtlDays: number;
  /** Alamat aplikasi untuk HP di jaringan pos, mis. https://192.168.1.10 (env PUBLIC_URL). */
  publicUrl: string | null;
  /** Alamat unduh sertifikat root untuk HP (env CERT_URL), mis. http://192.168.1.10/sertifikat. */
  certUrl: string | null;
  /** Folder cadangan harian SQLite (env BACKUP_DIR, bawaan apps/server/backups). */
  backupDir: string;
  /** Jumlah cadangan yang disimpan (env BACKUP_KEEP, bawaan 14). */
  backupKeep: number;
}

/** Teks env yang kosong dianggap tidak diisi. */
export function nonEmpty(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    publicUrl: nonEmpty(env.PUBLIC_URL),
    certUrl: nonEmpty(env.CERT_URL),
    backupDir: path.resolve(SERVER_ROOT, env.BACKUP_DIR ?? 'backups'),
    backupKeep: Math.max(1, Number(env.BACKUP_KEEP ?? 14)),
  };
}
