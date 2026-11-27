// Data contoh dengan hasil yang dihitung manual (lihat komentar di setiap tes).
import { describe, expect, it } from 'vitest';

import { DAY, TODAY } from '../domain/test-helpers';
import type { EventBody } from '../schemas/events';
import {
  fertilityBy,
  fertilityStats,
  inPeriod,
  serviceRecords,
  type RecordedEvent,
} from './fertility';
import { monthKey, monthsBetween, requestTrend, responseStats, responseTimes } from './requests';

const X = 'petugas-x';
const Y = 'petugas-y';
let n = 0;
function e(
  animalId: string,
  daysAgo: number,
  body: EventBody,
  recordedBy = X,
  extra: Partial<RecordedEvent & { serviceRequestId: string | null }> = {},
): RecordedEvent & { serviceRequestId: string | null } {
  n += 1;
  return {
    id: `0193f000-0000-7000-8000-${String(n).padStart(12, '0')}`,
    animalId,
    occurredAt: TODAY - daysAgo * DAY,
    voidsEventId: null,
    deletedAt: null,
    recordedBy,
    serviceRequestId: null,
    ...body,
    ...extra,
  } as RecordedEvent & { serviceRequestId: string | null };
}
const IB: EventBody = { type: 'IB', payload: { strawCode: 'S', bullId: 'B', batch: '1' } };
const POS: EventBody = { type: 'PKB', payload: { result: 'pregnant', fetalAgeMonths: 2 } };
const NEG: EventBody = { type: 'PKB', payload: { result: 'not_pregnant' } };
const BH: EventBody = { type: 'BH', payload: {} };
const KGG: EventBody = { type: 'KGG', payload: { trimester: 1 } };
const LH: EventBody = { type: 'LH', payload: { calves: [{ sex: 'F', condition: 'alive' }] } };
const EXIT: EventBody = { type: 'EXIT', payload: { reason: 'sold' } };

const eVoided = e('E', 40, IB, X);
const events = [
  // A (petugas X): IB pertama → birahi lagi (tidak bunting); IB ke-2 + IB ulang di birahi yang
  // sama (tetap satu layanan) → PKB bunting; lahir.
  e('A', 300, IB),
  e('A', 279, BH),
  e('A', 278, IB),
  e('A', 277.6, IB),
  e('A', 219, POS),
  e('A', 0, LH),
  // B (Y): IB pertama → bunting.
  e('B', 200, IB, Y),
  e('B', 140, POS, Y),
  // C (X): IB pertama → IB lagi 21 hari kemudian (tidak bunting) → PKB negatif → IB ke-3 belum ada hasil.
  e('C', 100, IB),
  e('C', 79, IB),
  e('C', 20, NEG),
  e('C', 10, IB),
  // D (Y): IB pertama → keguguran (berarti sempat bunting); siklus baru, IB pertama lagi, belum ada hasil.
  e('D', 50, IB, Y),
  e('D', 20, KGG, Y),
  e('D', 5, IB, Y),
  // E: IB oleh X dikoreksi (dibatalkan) menjadi IB oleh Y; sapi dijual tanpa hasil.
  eVoided,
  e('E', 38, IB, Y, { voidsEventId: eVoided.id }),
  e('E', 10, EXIT, Y),
  // Event terhapus tidak dihitung.
  e('F', 30, IB, X, { deletedAt: TODAY }),
];

describe('serviceRecords', () => {
  const records = serviceRecords(events);
  const of = (animal: string) =>
    records.filter((r) => r.animalId === animal).map((r) => [r.serviceNumber, r.outcome, r.first]);

  it('hasil setiap layanan', () => {
    expect(of('A')).toEqual([
      [1, 'not_conceived', true],
      [2, 'conceived', false],
    ]);
    expect(of('B')).toEqual([[1, 'conceived', true]]);
    expect(of('C')).toEqual([
      [1, 'not_conceived', true],
      [2, 'not_conceived', false],
      [3, 'pending', false],
    ]);
    expect(of('D')).toEqual([
      [1, 'conceived', true],
      [1, 'pending', true],
    ]);
    expect(of('E')).toEqual([[1, 'pending', true]]);
    expect(of('F')).toEqual([]);
    // IB yang dikoreksi dihitung atas nama petugas di catatan pengganti.
    expect(records.find((r) => r.animalId === 'E')?.inseminatorId).toBe(Y);
  });

  it('total: S/C = 6 layanan berhasil diketahui ÷ 3 bunting = 2; CR = 2 ÷ 4 = 50%', () => {
    // Layanan: A1 A2 B1 C1 C2 C3 D1 D2 E1 = 9; belum tahu: C3 D2 E1 = 3; diketahui 6.
    // Bunting: A2 B1 D1 = 3. IB pertama: A1 B1 C1 D1 D2 E1 = 6, diketahui A1 B1 C1 D1 = 4,
    // bunting B1 D1 = 2.
    expect(fertilityStats(records)).toEqual({
      services: 9,
      known: 6,
      conceptions: 3,
      pending: 3,
      firstServices: 6,
      firstKnown: 4,
      firstConceived: 2,
      sc: 2,
      cr: 50,
    });
  });

  it('per petugas', () => {
    const by = fertilityBy(records, (r) => r.inseminatorId);
    // X: A1 A2 C1 C2 C3 → diketahui 4, bunting 1 → S/C 4; IB pertama diketahui A1 C1, bunting 0 → CR 0.
    // Y: B1 D1 D2 E1 → diketahui 2, bunting 2 → S/C 1; IB pertama diketahui B1 D1 → CR 100.
    expect(by.map((g) => [g.key, g.stats.sc, g.stats.cr])).toEqual([
      [X, 4, 0],
      [Y, 1, 100],
    ]);
  });

  it('tanpa kebuntingan: S/C dan CR kosong, bukan 0 atau tak hingga', () => {
    expect(fertilityStats([])).toMatchObject({ sc: null, cr: null, services: 0 });
    const onlyPending = serviceRecords([e('G', 5, IB)]);
    expect(fertilityStats(onlyPending)).toMatchObject({ sc: null, cr: null, pending: 1 });
  });

  it('periode memakai tanggal IB', () => {
    const lastQuarter = inPeriod(records, TODAY - 90 * DAY, TODAY + 1);
    // C2 (79), C3 (10), D1 (50), D2 (5), E1 (38)
    expect(lastQuarter).toHaveLength(5);
  });
});

describe('tren dan waktu respons', () => {
  const T = Date.UTC(2026, 0, 31, 18, 0, 0); // 1 Feb 2026 01.00 WIB
  it('bulan memakai WIB', () => {
    expect(monthKey(T)).toBe('2026-02');
    expect(monthKey(T, 0)).toBe('2026-01');
    expect(monthsBetween(Date.UTC(2025, 10, 15), Date.UTC(2026, 1, 1))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  const req = (id: string, createdAt: number, type: 'IB' | 'PKB' = 'IB', status = 'done') => ({
    id,
    type,
    status,
    createdAt,
  });
  const from = Date.UTC(2025, 10, 30, 17); // 1 Des 2025 00.00 WIB
  const to = Date.UTC(2026, 1, 28, 17); // 1 Mar 2026 00.00 WIB
  const requests = [
    req('r1', Date.UTC(2025, 11, 3)),
    req('r2', Date.UTC(2025, 11, 20), 'IB', 'rejected'),
    req('r3', Date.UTC(2026, 1, 2)),
    req('r4', Date.UTC(2026, 1, 9)),
    req('p1', Date.UTC(2026, 1, 9), 'PKB'),
    req('old', Date.UTC(2025, 9, 1)),
  ];

  it('permintaan IB per bulan, bulan kosong tetap ada', () => {
    expect(requestTrend(requests, from, to)).toEqual([
      { month: '2025-12', requests: 2, rejected: 1 },
      { month: '2026-01', requests: 0, rejected: 0 },
      { month: '2026-02', requests: 2, rejected: 0 },
    ]);
  });

  it('waktu respons dari permintaan sampai IB: rata-rata 1,5 hari, median 2', () => {
    const h = 3_600_000;
    const evs = [
      // r1: 12 jam; r3: 2 hari (Y); r4: 3 hari, tetapi IB-nya dikoreksi menjadi 2 hari.
      e('A', 0, IB, X, { occurredAt: Date.UTC(2025, 11, 3) + 12 * h, serviceRequestId: 'r1' }),
      e('B', 0, IB, Y, { occurredAt: Date.UTC(2026, 1, 4), serviceRequestId: 'r3' }),
    ];
    const wrong = e('C', 0, IB, X, { occurredAt: Date.UTC(2026, 1, 12), serviceRequestId: 'r4' });
    evs.push(
      wrong,
      e('C', 0, IB, X, {
        occurredAt: Date.UTC(2026, 1, 11),
        serviceRequestId: 'r4',
        voidsEventId: wrong.id,
      }),
    );
    const times = responseTimes(requests, evs, from, to);
    expect(times.map((t) => [t.requestId, t.inseminatorId, t.days])).toEqual([
      ['r1', X, 0.5],
      ['r3', Y, 2],
      ['r4', X, 2],
    ]);
    // (0,5 + 2 + 2) ÷ 3 = 1,5; median 2.
    expect(responseStats(times)).toEqual({ count: 3, meanDays: 1.5, medianDays: 2 });
    expect(responseStats(times.slice(0, 2)).medianDays).toBe(1.25);
    expect(responseStats([])).toEqual({ count: 0, meanDays: null, medianDays: null });
  });
});
