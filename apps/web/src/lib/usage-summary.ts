// Ringkasan dan ekspor catatan pemakaian (fungsi murni, langkah 5.1).
import type { UsageRow } from '@/data/db';

export interface FormStats {
  name: string;
  done: number;
  cancelled: number;
  /** Median lama mengisi form yang tersimpan (ms), atau null bila belum ada. */
  medianMs: number | null;
  meanMs: number | null;
}

export interface UsageSummary {
  total: number;
  firstAt: number | null;
  lastAt: number | null;
  activeDays: number;
  /** Jumlah event tersimpan per jenis (BH, IB, …). */
  eventsByType: Record<string, number>;
  forms: FormStats[];
  /** Berapa kali layar dibuka. */
  screens: Record<string, number>;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

export function summarizeUsage(rows: readonly UsageRow[]): UsageSummary {
  const eventsByType: Record<string, number> = {};
  const screens: Record<string, number> = {};
  const forms = new Map<string, { done: number; cancelled: number; durations: number[] }>();
  const form = (name: string) => {
    let f = forms.get(name);
    if (!f) {
      f = { done: 0, cancelled: 0, durations: [] };
      forms.set(name, f);
    }
    return f;
  };
  for (const row of rows) {
    if (row.kind === 'screen') screens[row.name] = (screens[row.name] ?? 0) + 1;
    if (row.kind === 'form_done') {
      const f = form(row.name);
      f.done += 1;
      if (typeof row.durationMs === 'number') f.durations.push(row.durationMs);
      if (row.eventType) eventsByType[row.eventType] = (eventsByType[row.eventType] ?? 0) + 1;
    }
    if (row.kind === 'form_cancel') form(row.name).cancelled += 1;
  }
  const ats = rows.map((r) => r.at);
  return {
    total: rows.length,
    firstAt: ats.length > 0 ? Math.min(...ats) : null,
    lastAt: ats.length > 0 ? Math.max(...ats) : null,
    activeDays: new Set(rows.map((r) => r.day)).size,
    eventsByType,
    forms: [...forms.entries()]
      .map(([name, f]) => ({
        name,
        done: f.done,
        cancelled: f.cancelled,
        medianMs: median(f.durations),
        meanMs:
          f.durations.length > 0
            ? Math.round(f.durations.reduce((a, b) => a + b, 0) / f.durations.length)
            : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    screens,
  };
}

const CSV_COLUMNS = ['kind', 'name', 'eventType', 'durationMs', 'at', 'day'] as const;

/** CSV satu baris per catatan (waktu ISO UTC). Tanpa data pribadi: lihat data/usage.ts. */
export function usageCsv(rows: readonly UsageRow[]): string {
  const cell = (v: string | number | null | undefined) => {
    const text = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [
    CSV_COLUMNS.join(','),
    ...rows.map((r) =>
      CSV_COLUMNS.map((c) => cell(c === 'at' ? new Date(r.at).toISOString() : r[c])).join(','),
    ),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Nama file ekspor: tanggal dan jam unduh saja. Sengaja tanpa id perangkat (id itu juga ada di
 * data yang tersinkron, sehingga bisa dipakai menebak pemakainya).
 */
export function usageFileName(now: number, ext: 'csv' | 'json'): string {
  const stamp = new Date(now).toISOString().slice(0, 19).replaceAll(':', '').replace('T', '-');
  return `ib-ternak-pemakaian-${stamp}.${ext}`;
}
