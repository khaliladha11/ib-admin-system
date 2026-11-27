// Pos IB (langkah 4.3): ONLINE-ONLY, langsung ke server pos (alamat, cadangan, impor).
// Ekspor diunduh lewat tautan biasa (/api/system/export.json|zip) dengan cookie sesi.
import type { DataLayer } from './context';

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: number;
}

export interface SystemInfo {
  publicUrl: string | null;
  certUrl: string | null;
  addresses: string[];
  backups: BackupInfo[];
  backupKeep: number;
}

export type ImportCounts = Record<string, { added: number; skipped: number }>;

export const EXPORT_JSON_URL = '/api/system/export.json';
export const EXPORT_CSV_URL = '/api/system/export.zip';

export function loadSystemInfo(layer: DataLayer) {
  return layer.api.request<SystemInfo>('GET', '/api/system/info');
}

export function backupNow(layer: DataLayer) {
  return layer.api.request<BackupInfo>('POST', '/api/system/backup');
}

export async function importData(layer: DataLayer, file: unknown) {
  const result = await layer.api.request<{ backup: string; counts: ImportCounts }>(
    'POST',
    '/api/system/import',
    file,
  );
  await layer.sync.pullChanges().catch(() => undefined);
  return result;
}

/** Alamat untuk HP: PUBLIC_URL, atau https://<IP pertama yang terdeteksi>. */
export function appUrlOf(info: SystemInfo): string | null {
  if (info.publicUrl) return info.publicUrl;
  const [ip] = info.addresses;
  return ip ? `https://${ip}` : null;
}

/** Alamat unduh sertifikat: CERT_URL, atau http://<host alamat aplikasi>/sertifikat. */
export function certUrlOf(info: SystemInfo): string | null {
  if (info.certUrl) return info.certUrl;
  const app = appUrlOf(info);
  return app ? `http://${new URL(app).host}/sertifikat` : null;
}
