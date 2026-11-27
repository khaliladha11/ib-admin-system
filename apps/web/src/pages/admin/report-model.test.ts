import { describe, expect, it } from 'vitest';

import type { ReportData } from '@/data';
import {
  DAY,
  IDS,
  makeAnimal,
  makeEvent,
  makeFarmer,
  makeLocation,
  TODAY,
  ibBody,
  pkbPregnant,
} from '@/test/data-fixtures';

import {
  buildReport,
  formatCr,
  formatSc,
  periodFor,
  reportFileName,
  reportSheets,
} from './report-model';

describe('periodFor (WIB, sampai akhir bulan berjalan)', () => {
  const now = Date.UTC(2026, 10, 25, 3); // 25 Nov 2026
  it('12 bulan = Des 2025 – Nov 2026', () => {
    const p = periodFor('12', now);
    expect(p.label).toBe('Des 2025 – Nov 2026');
    expect(p.from).toBe(Date.UTC(2025, 10, 30, 17)); // 1 Des 2025 00.00 WIB
    expect(p.to).toBe(Date.UTC(2026, 10, 30, 17)); // 1 Des 2026 00.00 WIB
  });
  it('tahun ini dan 3 bulan', () => {
    expect(periodFor('tahun', now).label).toBe('Jan 2026 – Nov 2026');
    expect(periodFor('3', now).label).toBe('Sep 2026 – Nov 2026');
  });
});

describe('buildReport', () => {
  const location = makeLocation();
  const farmer = makeFarmer(location.id);
  const a = makeAnimal(farmer.id, { name: 'A' });
  const b = makeAnimal(farmer.id, { name: 'B' });
  // A: IB 100 hari lalu → IB lagi 79 hari lalu (tidak bunting) → PKB bunting. B: IB → bunting.
  const events = [
    makeEvent(a.id, 100, ibBody),
    makeEvent(a.id, 79, ibBody),
    makeEvent(a.id, 20, pkbPregnant),
    makeEvent(b.id, 60, ibBody),
    makeEvent(b.id, 5, pkbPregnant),
  ];
  const request = {
    id: 'req-1',
    createdAt: TODAY - 61 * DAY,
    updatedAt: TODAY,
    deletedAt: null,
    deviceId: 'x',
    farmerId: farmer.id,
    animalId: b.id,
    type: 'IB' as const,
    status: 'done' as const,
    requestedBy: IDS.farmerUser,
    preferredDate: null,
    notes: null,
    rejectionReason: null,
    resultEventId: null,
  };
  const ibB = events[3];
  if (ibB) ibB.serviceRequestId = request.id;
  const data: ReportData = {
    events,
    requests: [request],
    animals: [a, b],
    farmers: [farmer],
    locations: [location],
    users: [
      {
        id: IDS.inseminator,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
        deviceId: 'x',
        name: 'Andi',
        email: null,
        phone: null,
        role: 'inseminator',
        locationId: null,
        isActive: true,
      },
    ],
  };

  it('angka sama dengan hitungan manual', () => {
    const report = buildReport(data, periodFor('12', TODAY));
    // Layanan A1 (tidak bunting), A2 (bunting), B1 (bunting): S/C 3 ÷ 2 = 1,5; CR 1 ÷ 2 = 50%.
    expect(report.total).toMatchObject({ services: 3, known: 3, conceptions: 2, sc: 1.5, cr: 50 });
    expect(formatSc(report.total.sc)).toBe('1,50');
    expect(formatCr(report.total.cr)).toBe('50%');
    expect(report.byInseminator.map((r) => [r.label, r.stats.services])).toEqual([['Andi', 3]]);
    expect(report.byVillage.map((r) => r.label)).toEqual(['KTT Contoh']);
    // Permintaan 61 hari lalu, IB 60 hari lalu.
    expect(report.response).toEqual({ count: 1, meanDays: 1, medianDays: 1 });
    expect(report.trend).toHaveLength(12);
    expect(report.trend.reduce((n, t) => n + t.requests, 0)).toBe(1);
  });

  it('isi Excel: ringkasan + 4 sheet, angka sebagai angka', () => {
    const report = buildReport(data, periodFor('12', TODAY));
    const sheets = reportSheets(report, 'KTT Contoh');
    expect(sheets.map((s) => s.name)).toEqual([
      'Ringkasan',
      'Per petugas',
      'Per desa',
      'Per bulan',
      'Permintaan',
    ]);
    expect(sheets[1]?.rows[1]).toEqual(['Andi', 3, 3, 2, 0, 1.5, 2, 1, 50]);
    expect(reportFileName(report.period, TODAY)).toBe(
      'laporan-ib-2025-12-sd-2026-11-2026-11-25.xlsx',
    );
  });
});
