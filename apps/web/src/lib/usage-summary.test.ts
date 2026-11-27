import { describe, expect, it } from 'vitest';

import type { UsageRow } from '@/data/db';

import { median, summarizeUsage, usageCsv, usageFileName } from './usage-summary';

const row = (r: Partial<UsageRow> & Pick<UsageRow, 'kind' | 'name'>): UsageRow => ({
  at: Date.UTC(2026, 10, 27, 3),
  day: '2026-11-27',
  ...r,
});

describe('summarizeUsage', () => {
  it('menghitung event per jenis, lama mengisi per form, batal, dan hari aktif', () => {
    const s = summarizeUsage([
      row({ kind: 'form_done', name: 'record', eventType: 'IB', durationMs: 30_000 }),
      row({ kind: 'form_done', name: 'record', eventType: 'IB', durationMs: 50_000 }),
      row({
        kind: 'form_done',
        name: 'record',
        eventType: 'BH',
        durationMs: 10_000,
        day: '2026-11-28',
      }),
      row({ kind: 'form_done', name: 'record', eventType: 'PKB', durationMs: null }),
      row({ kind: 'form_cancel', name: 'request', durationMs: 5_000 }),
      row({ kind: 'screen', name: 'home' }),
      row({ kind: 'screen', name: 'home' }),
    ]);
    expect(s.total).toBe(7);
    expect(s.activeDays).toBe(2);
    expect(s.eventsByType).toEqual({ IB: 2, BH: 1, PKB: 1 });
    expect(s.screens).toEqual({ home: 2 });
    expect(s.forms).toEqual([
      { name: 'record', done: 4, cancelled: 0, medianMs: 30_000, meanMs: 30_000 },
      { name: 'request', done: 0, cancelled: 1, medianMs: null, meanMs: null },
    ]);
  });

  it('kosong', () => {
    expect(summarizeUsage([])).toMatchObject({ total: 0, firstAt: null, activeDays: 0 });
  });

  it('median genap dan ganjil', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(3);
    expect(median([])).toBeNull();
  });
});

describe('ekspor', () => {
  it('CSV dengan kolom tetap dan waktu ISO; tanpa id pengguna', () => {
    const csv = usageCsv([
      row({ kind: 'form_done', name: 'record', eventType: 'IB', durationMs: 1234 }),
    ]);
    expect(csv).toBe(
      'kind,name,eventType,durationMs,at,day\r\nform_done,record,IB,1234,2026-11-27T03:00:00.000Z,2026-11-27\r\n',
    );
  });

  it('nama file hanya berisi waktu unduh', () => {
    expect(usageFileName(Date.UTC(2026, 10, 27, 3, 4, 5), 'csv')).toBe(
      'ib-ternak-pemakaian-2026-11-27-030405.csv',
    );
  });
});
