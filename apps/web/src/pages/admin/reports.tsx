// Laporan (langkah 6.2): S/C dan CR per petugas, desa, bulan; tren permintaan IB; waktu respons.
// Dihitung di HP dari data lokal (juga offline) dengan rumus @ib/shared. Ekspor Excel (.xlsx,
// dibuat di HP) dan cetak A4 → "Simpan sebagai PDF".
import { buildXlsx, XLSX_MIME } from '@ib/shared';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { ListSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { useDataLayer, useLocations, useReportData, useSession } from '@/data';
import { downloadBytes } from '@/lib/download';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import {
  buildReport,
  formatCr,
  formatDays,
  formatSc,
  FORMULAS,
  periodFor,
  reportFileName,
  reportSheets,
  type PeriodPreset,
  type Report,
  type ReportRow,
} from './report-model';

const PRESETS: [PeriodPreset, string][] = [
  ['3', '3 bulan'],
  ['6', '6 bulan'],
  ['12', '12 bulan'],
  ['tahun', 'Tahun ini'],
];

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="surface flex flex-col gap-1 p-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{hint}</span>
    </div>
  );
}

function StatsTable({ caption, head, rows }: { caption: string; head: string; rows: ReportRow[] }) {
  if (rows.length === 0)
    return <p className="text-muted-foreground">Belum ada IB pada periode ini.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-120 border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b-(length:--bw)">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {head}
            </th>
            {['Layanan IB', 'Bunting', 'Belum ada hasil', 'S/C', 'CR'].map((h) => (
              <th key={h} scope="col" className="px-2 py-2 text-right font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b-(length:--bw) last:border-b-0">
              <th scope="row" className="py-2 pr-3 font-normal">
                {r.label}
              </th>
              <td className="px-2 py-2 text-right tabular-nums">{r.stats.services}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.stats.conceptions}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.stats.pending}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">
                {formatSc(r.stats.sc)}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">
                {formatCr(r.stats.cr)}
                <span className="block text-xs font-normal text-muted-foreground">
                  {r.stats.firstConceived}/{r.stats.firstKnown}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Satu seri (permintaan IB per bulan): batang tipis, judul panel = nama seri, tabel di bawah. */
function TrendChart({ trend }: { trend: Report['trend'] }) {
  const max = Math.max(1, ...trend.map((t) => t.requests));
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="flex h-40 items-end gap-0.5 border-b-(length:--bw) border-border"
        role="img"
        aria-label={`Permintaan IB per bulan: ${trend.map((t) => `${t.label} ${String(t.requests)}`).join(', ')}`}
      >
        {trend.map((t) => (
          <div
            key={t.month}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${t.label}: ${String(t.requests)} permintaan${t.rejected ? `, ${String(t.rejected)} ditolak` : ''}`}
          >
            <span className="text-xs text-muted-foreground tabular-nums group-hover:text-foreground">
              {t.requests > 0 ? t.requests : ''}
            </span>
            <span
              className="w-full max-w-10 rounded-t-[4px] bg-primary group-hover:opacity-80"
              style={{
                height: `${String((t.requests / max) * 85)}%`,
                minHeight: t.requests ? 2 : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 text-xs text-muted-foreground">
        {trend.map((t, i) => (
          <span key={t.month} className="min-w-0 flex-1 truncate text-center">
            {trend.length > 6 && i % 2 === 1 ? '' : t.label.replace(/ 20(\d\d)$/, ' $1')}
          </span>
        ))}
      </div>
    </figure>
  );
}

function ReportBody({ report, compact = false }: { report: Report; compact?: boolean }) {
  const id = (name: string) => (compact ? `cetak-${name}` : name);
  const t = report.total;
  return (
    <>
      <div className={cn('grid gap-3', compact ? 'grid-cols-4' : 'grid-cols-2 lg:grid-cols-4')}>
        <Tile
          label="S/C"
          value={formatSc(t.sc)}
          hint={`${String(t.known)} layanan ÷ ${String(t.conceptions)} bunting`}
        />
        <Tile
          label="CR IB pertama"
          value={formatCr(t.cr)}
          hint={`${String(t.firstConceived)} dari ${String(t.firstKnown)} IB pertama`}
        />
        <Tile
          label="Layanan IB"
          value={String(t.services)}
          hint={`${String(t.pending)} belum ada hasil`}
        />
        <Tile
          label="Waktu respons"
          value={formatDays(report.response.medianDays)}
          hint={`median, ${String(report.response.count)} permintaan`}
        />
      </div>
      <Panel title="Per petugas" titleId={id('per-petugas')}>
        <StatsTable caption="S/C dan CR per petugas" head="Petugas" rows={report.byInseminator} />
      </Panel>
      <Panel title="Per desa" titleId={id('per-desa')}>
        <StatsTable caption="S/C dan CR per desa" head="Desa" rows={report.byVillage} />
      </Panel>
      <Panel title="Per bulan IB" titleId={id('per-bulan')}>
        <StatsTable caption="S/C dan CR per bulan" head="Bulan" rows={report.byMonth} />
      </Panel>
      <Panel title="Permintaan IB per bulan" titleId={id('tren')}>
        <TrendChart trend={report.trend} />
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Permintaan IB per bulan</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 font-semibold">
                Bulan
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Permintaan
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Ditolak
              </th>
            </tr>
          </thead>
          <tbody>
            {report.trend.map((r) => (
              <tr key={r.month} className="border-t-(length:--bw)">
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right tabular-nums">{r.requests}</td>
                <td className="py-1 text-right tabular-nums">{r.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Waktu respons petugas" titleId={id('respons')}>
        <p className="text-muted-foreground">
          Rata-rata {formatDays(report.response.meanDays)}, median{' '}
          {formatDays(report.response.medianDays)} dari permintaan sampai IB.
        </p>
        {report.responseByInseminator.length > 0 && (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Waktu respons per petugas</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 font-semibold">
                  Petugas
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  IB
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Rata-rata
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Median
                </th>
              </tr>
            </thead>
            <tbody>
              {report.responseByInseminator.map((r) => (
                <tr key={r.key} className="border-t-(length:--bw)">
                  <td className="py-1">{r.label}</td>
                  <td className="py-1 text-right tabular-nums">{r.stats.count}</td>
                  <td className="py-1 text-right tabular-nums">{formatDays(r.stats.meanDays)}</td>
                  <td className="py-1 text-right tabular-nums">{formatDays(r.stats.medianDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title="Cara menghitung" titleId={id('rumus')}>
        <dl className="grid gap-2 sm:grid-cols-2">
          {FORMULAS.map((f) => (
            <div key={f.term}>
              <dt className="font-semibold">{f.term}</dt>
              <dd className="text-muted-foreground">{f.text}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}

export function ReportsPage() {
  const layer = useDataLayer();
  const data = useReportData();
  const session = useSession();
  const locations = useLocations();
  const [preset, setPreset] = useState<PeriodPreset>('12');
  const [printing, setPrinting] = useState(false);

  if (!data || !session) return <ListSkeleton label="Menghitung laporan…" />;
  const now = layer.now();
  const report = buildReport(data, periodFor(preset, now));
  const region = locations?.find((l) => l.id === session.user.locationId)?.name ?? 'Semua wilayah';

  function exportXlsx() {
    downloadBytes(
      reportFileName(report.period, now),
      buildXlsx(reportSheets(report, region), new Date(now)),
      XLSX_MIME,
    );
  }

  function print() {
    // Tampilan cetak dilepas setelah dialog cetak ditutup (afterprint).
    window.addEventListener(
      'afterprint',
      () => {
        setPrinting(false);
      },
      { once: true },
    );
    flushSync(() => {
      setPrinting(true);
    });
    window.print();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">
            {region} · {report.period.label}
          </p>
          <div role="radiogroup" aria-label="Periode" className="flex flex-wrap gap-2">
            {PRESETS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={preset === key}
                onClick={() => {
                  setPreset(key);
                }}
                className={cn(
                  'min-h-11 rounded-full border-(length:--bw) px-4 font-semibold',
                  preset === key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet aria-hidden="true" />
            Unduh Excel
          </Button>
          <Button variant="outline" onClick={print}>
            <Printer aria-hidden="true" />
            Cetak / PDF
          </Button>
        </div>
      </div>

      <ReportBody report={report} />

      <p className="text-sm text-muted-foreground">
        Dihitung dari data di perangkat ini ({formatDateTime(now)}). Data yang belum terkirim dari
        HP petugas belum ikut terhitung.
      </p>

      {printing &&
        createPortal(
          <div className="print-root">
            <div className="report-print flex flex-col gap-3">
              <header className="border-b-(length:--bw) pb-2">
                <h1 className="text-2xl font-bold">Laporan IB · {region}</h1>
                <p>
                  {report.period.label} · dicetak {formatDateTime(now)}
                </p>
              </header>
              <ReportBody report={report} compact />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
