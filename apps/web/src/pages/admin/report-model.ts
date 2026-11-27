// Model halaman Laporan (langkah 6.2): periode, pengelompokan, dan isi file Excel.
// Rumus ada di @ib/shared (analytics); di sini hanya menyusun baris untuk tabel dan ekspor.
import {
  fertilityBy,
  fertilityStats,
  inPeriod,
  monthKey,
  requestTrend,
  responseStats,
  responseTimes,
  serviceRecords,
  type FertilityStats,
  type ResponseStats,
  type XlsxSheet,
} from '@ib/shared';

import type { ReportData } from '@/data';

export type PeriodPreset = '3' | '6' | '12' | 'tahun';

export interface Period {
  from: number;
  /** Eksklusif. */
  to: number;
  label: string;
}

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const WIB_MS = 7 * 3_600_000;

/** Awal bulan (00.00 WIB) untuk tahun/bulan (bulan 0–11, boleh di luar rentang). */
const monthStart = (year: number, month: number) => Date.UTC(year, month, 1) - WIB_MS;

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]?.slice(0, 3) ?? ''} ${String(y)}`;
}

/** Periode laporan sampai akhir bulan berjalan (WIB). */
export function periodFor(preset: PeriodPreset, now: number): Period {
  const [y, m] = monthKey(now).split('-').map(Number) as [number, number];
  const to = monthStart(y, m); // awal bulan depan (bulan m 1-based = indeks berikutnya)
  const from = preset === 'tahun' ? monthStart(y, 0) : monthStart(y, m - Number(preset));
  const first = monthKey(from);
  const last = monthKey(to - 1);
  return {
    from,
    to,
    label: first === last ? monthLabel(first) : `${monthLabel(first)} – ${monthLabel(last)}`,
  };
}

export interface ReportRow {
  key: string;
  label: string;
  stats: FertilityStats;
}

export interface Report {
  period: Period;
  total: FertilityStats;
  byInseminator: ReportRow[];
  byVillage: ReportRow[];
  byMonth: ReportRow[];
  trend: { month: string; label: string; requests: number; rejected: number }[];
  response: ResponseStats;
  responseByInseminator: { key: string; label: string; stats: ResponseStats }[];
}

export function buildReport(data: ReportData, period: Period): Report {
  const events = data.events.filter((e) => e.deletedAt === null);
  const records = inPeriod(serviceRecords(events), period.from, period.to);
  const userName = new Map(data.users.map((u) => [u.id, u.name]));
  const farmerOf = new Map(data.animals.map((a) => [a.id, a.farmerId]));
  const villageOf = new Map(data.farmers.map((f) => [f.id, f.locationId]));
  const locationName = new Map(data.locations.map((l) => [l.id, l.name]));
  const village = (animalId: string) => villageOf.get(farmerOf.get(animalId) ?? '') ?? null;

  const rows = (groups: { key: string; stats: FertilityStats }[], label: (k: string) => string) =>
    groups
      .map((g) => ({ ...g, label: label(g.key) }))
      .sort((a, b) => a.label.localeCompare(b.label));

  const responses = responseTimes(data.requests, events, period.from, period.to);
  const byIns = new Map<string, typeof responses>();
  for (const r of responses) byIns.set(r.inseminatorId, [...(byIns.get(r.inseminatorId) ?? []), r]);

  return {
    period,
    total: fertilityStats(records),
    byInseminator: rows(
      fertilityBy(records, (r) => r.inseminatorId),
      (k) => userName.get(k) ?? 'Petugas lain',
    ),
    byVillage: rows(
      fertilityBy(records, (r) => village(r.animalId) ?? 'tanpa-desa'),
      (k) => locationName.get(k) ?? 'Tanpa desa',
    ),
    byMonth: fertilityBy(records, (r) => monthKey(r.at)).map((g) => ({
      ...g,
      label: monthLabel(g.key),
    })),
    trend: requestTrend(data.requests, period.from, period.to).map((t) => ({
      ...t,
      label: monthLabel(t.month),
    })),
    response: responseStats(responses),
    responseByInseminator: [...byIns.entries()]
      .map(([key, list]) => ({
        key,
        label: userName.get(key) ?? 'Petugas lain',
        stats: responseStats(list),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** S/C dengan 2 desimal (koma), atau tanda – bila belum ada kebuntingan. */
export const formatSc = (sc: number | null) =>
  sc === null
    ? '–'
    : sc.toLocaleString('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const formatCr = (cr: number | null) =>
  cr === null ? '–' : `${cr.toLocaleString('id-ID', { maximumFractionDigits: 0 })}%`;
export const formatDays = (days: number | null) =>
  days === null ? '–' : `${days.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`;

const round = (n: number | null, digits: number) =>
  n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits;

const STAT_HEAD = [
  'Layanan IB',
  'Sudah ada hasil',
  'Bunting',
  'Belum ada hasil',
  'S/C',
  'IB pertama (ada hasil)',
  'IB pertama bunting',
  'CR (%)',
];
const statCells = (s: FertilityStats) => [
  s.services,
  s.known,
  s.conceptions,
  s.pending,
  round(s.sc, 2),
  s.firstKnown,
  s.firstConceived,
  round(s.cr, 1),
];

export const FORMULAS: { term: string; text: string }[] = [
  {
    term: 'Layanan IB',
    text: 'Satu IB. IB ulang pada birahi yang sama (selang ≤ 1 hari) dihitung satu layanan.',
  },
  {
    term: 'Bunting / tidak bunting',
    text: 'Bunting bila sesudah IB tercatat PKB bunting, lahir, atau keguguran. Tidak bunting bila PKB tidak bunting, birahi lagi, atau di-IB lagi. Selain itu "belum ada hasil" dan tidak dihitung.',
  },
  {
    term: 'S/C (service per conception)',
    text: 'Layanan yang sudah ada hasilnya ÷ jumlah kebuntingan. Makin kecil makin baik (ideal 1,0; baik bila < 2).',
  },
  {
    term: 'CR (conception rate)',
    text: 'IB pertama yang bunting ÷ IB pertama yang sudah ada hasilnya × 100%. IB pertama = layanan pertama sejak melahirkan/keguguran (atau sejak sapi tercatat).',
  },
  {
    term: 'Waktu respons',
    text: 'Dari permintaan IB diajukan peternak sampai IB dicatat petugas, untuk permintaan yang sudah dipenuhi.',
  },
  {
    term: 'Periode',
    text: 'Menurut tanggal IB (S/C, CR) atau tanggal permintaan (tren, waktu respons), waktu WIB.',
  },
];

/** Isi file Excel laporan: ringkasan + satu sheet per pengelompokan. */
export function reportSheets(report: Report, regionName: string): XlsxSheet[] {
  const group = (name: string, title: string, rows: ReportRow[]): XlsxSheet => ({
    name,
    rows: [[title, ...STAT_HEAD], ...rows.map((r) => [r.label, ...statCells(r.stats)])],
    widths: [24, 11, 14, 9, 14, 7, 20, 18, 8],
  });
  return [
    {
      name: 'Ringkasan',
      rows: [
        ['Laporan IB', regionName],
        ['Periode', report.period.label],
        ...STAT_HEAD.map((h, i) => [h, statCells(report.total)[i] ?? null]),
        ['Permintaan IB', report.trend.reduce((n, t) => n + t.requests, 0)],
        ['Waktu respons rata-rata (hari)', round(report.response.meanDays, 1)],
        ['Waktu respons median (hari)', round(report.response.medianDays, 1)],
        [],
        ['Rumus'],
        ...FORMULAS.map((f) => [f.term, f.text]),
      ],
      widths: [32, 90],
    },
    group('Per petugas', 'Petugas', report.byInseminator),
    group('Per desa', 'Desa', report.byVillage),
    group('Per bulan', 'Bulan IB', report.byMonth),
    {
      name: 'Permintaan',
      rows: [
        ['Bulan', 'Permintaan IB', 'Ditolak'],
        ...report.trend.map((t) => [t.label, t.requests, t.rejected]),
        [],
        ['Petugas', 'IB dari permintaan', 'Respons rata-rata (hari)', 'Respons median (hari)'],
        ...report.responseByInseminator.map((r) => [
          r.label,
          r.stats.count,
          round(r.stats.meanDays, 1),
          round(r.stats.medianDays, 1),
        ]),
      ],
      widths: [24, 18, 24, 22],
    },
  ];
}

export const reportFileName = (period: Period, now: number) =>
  `laporan-ib-${new Date(period.from + WIB_MS).toISOString().slice(0, 7)}-sd-${new Date(period.to - 1 + WIB_MS).toISOString().slice(0, 7)}-${new Date(now).toISOString().slice(0, 10)}.xlsx`;
