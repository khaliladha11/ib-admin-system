// Tren permintaan IB dan waktu respons petugas (langkah 6.2). Fungsi murni.
//   Waktu respons = tanggal IB dicatat − waktu permintaan diajukan, untuk permintaan IB yang
//   sudah dipenuhi IB (event IB dengan serviceRequestId = id permintaan).
import { DAY_MS } from '../domain/constants';
import { effectiveEvents } from '../domain/timeline';
import type { RecordedEvent } from './fertility';

/** Zona waktu laporan (WIB = UTC+7) untuk menentukan bulan. */
export const REPORT_UTC_OFFSET_MINUTES = 7 * 60;

/** "YYYY-MM" pada zona waktu laporan. */
export function monthKey(ms: number, offsetMinutes = REPORT_UTC_OFFSET_MINUTES): string {
  return new Date(ms + offsetMinutes * 60_000).toISOString().slice(0, 7);
}

/** Daftar bulan "YYYY-MM" dari bulan `from` sampai bulan `to` (inklusif). */
export function monthsBetween(from: number, to: number, offsetMinutes = REPORT_UTC_OFFSET_MINUTES) {
  const months: string[] = [];
  const end = monthKey(to, offsetMinutes);
  let [y, m] = monthKey(from, offsetMinutes).split('-').map(Number) as [number, number];
  for (let guard = 0; guard < 600; guard++) {
    const key = `${String(y)}-${String(m).padStart(2, '0')}`;
    months.push(key);
    if (key >= end) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export interface RequestLike {
  id: string;
  type: 'IB' | 'PKB';
  status: string;
  createdAt: number;
  deletedAt?: number | null;
}

/** Jumlah permintaan IB per bulan (bulan tanpa permintaan tetap ada dengan 0). */
export function requestTrend(
  requests: readonly RequestLike[],
  from: number,
  to: number,
  offsetMinutes = REPORT_UTC_OFFSET_MINUTES,
): { month: string; requests: number; rejected: number }[] {
  const rows = new Map(
    monthsBetween(from, to - 1, offsetMinutes).map((m) => [
      m,
      { month: m, requests: 0, rejected: 0 },
    ]),
  );
  for (const r of requests) {
    if (r.type !== 'IB' || r.deletedAt != null || r.createdAt < from || r.createdAt >= to) continue;
    const row = rows.get(monthKey(r.createdAt, offsetMinutes));
    if (!row) continue;
    row.requests += 1;
    if (r.status === 'rejected') row.rejected += 1;
  }
  return [...rows.values()];
}

export interface ResponseRecord {
  requestId: string;
  inseminatorId: string;
  /** Hari dari permintaan diajukan sampai IB. */
  days: number;
}

/** Waktu respons untuk permintaan IB (diajukan dalam [from, to)) yang sudah dipenuhi IB. */
export function responseTimes(
  requests: readonly RequestLike[],
  events: readonly (RecordedEvent & { serviceRequestId: string | null })[],
  from: number,
  to: number,
): ResponseRecord[] {
  const ibByRequest = new Map<string, RecordedEvent>();
  for (const e of effectiveEvents(events)) {
    if (e.type !== 'IB' || !e.serviceRequestId || ibByRequest.has(e.serviceRequestId)) continue;
    ibByRequest.set(e.serviceRequestId, e);
  }
  return requests.flatMap((r) => {
    if (r.type !== 'IB' || r.deletedAt != null || r.createdAt < from || r.createdAt >= to)
      return [];
    const ib = ibByRequest.get(r.id);
    if (!ib) return [];
    return [
      {
        requestId: r.id,
        inseminatorId: ib.recordedBy,
        days: Math.max(0, (ib.occurredAt - r.createdAt) / DAY_MS),
      },
    ];
  });
}

export interface ResponseStats {
  count: number;
  meanDays: number | null;
  medianDays: number | null;
}

export function responseStats(records: readonly ResponseRecord[]): ResponseStats {
  if (records.length === 0) return { count: 0, meanDays: null, medianDays: null };
  const days = records.map((r) => r.days).sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  const median =
    days.length % 2 === 1 ? (days[mid] ?? 0) : ((days[mid - 1] ?? 0) + (days[mid] ?? 0)) / 2;
  return {
    count: days.length,
    meanDays: days.reduce((a, b) => a + b, 0) / days.length,
    medianDays: median,
  };
}
