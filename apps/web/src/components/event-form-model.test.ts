import { describe, expect, it } from 'vitest';

import type { StockView } from '@/data';

import {
  buildInput,
  initialFields,
  localDate,
  trimesterFor,
  type CalfField,
} from './event-form-model';

const NOW = new Date(2026, 10, 25, 9, 30).getTime();
const stock = (id: string, strawCode: string, receivedAt: string): StockView => ({
  id,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  deviceId: 'x',
  holderId: 'u',
  strawCode,
  bullId: `BULL-${strawCode}`,
  bullName: null,
  breed: null,
  batch: 'B1',
  quantityReceived: 10,
  receivedAt,
  remaining: 5,
});

const extra = (over: Partial<{ calves: CalfField[]; serviceRequestId: string | null }> = {}) => ({
  signs: [],
  calves: [],
  serviceRequestId: null,
  now: NOW,
  ...over,
});

describe('initialFields: isian bawaan dari data terakhir', () => {
  it('IB: stok yang dipakai di IB terakhir didahulukan', () => {
    const f = initialFields(
      {
        stocks: [stock('a', 'SIM-1', '2026-02-01'), stock('b', 'LIM-2', '2026-01-01')],
        lastIb: { strawCode: 'LIM-2', bullId: 'BULL-LIM-2', batch: 'B1', semenStockId: 'b' },
      },
      NOW,
    );
    expect(f).toMatchObject({ date: localDate(NOW), semenStockId: 'b', strawCode: 'LIM-2' });
  });

  it('tanpa stok: kode straw dari IB terakhir', () => {
    const f = initialFields(
      { lastIb: { strawCode: 'X-9', bullId: 'B-9', batch: 'Z', semenStockId: null } },
      NOW,
    );
    expect(f).toMatchObject({ semenStockId: '', strawCode: 'X-9', bullId: 'B-9', batch: 'Z' });
  });

  it('cara PKB dan cara timbang terakhir; trimester dari umur kebuntingan', () => {
    const f = initialFields(
      { lastPkbMethod: 'usg', lastWeightMethod: 'tape', gestationMonths: 5 },
      NOW,
    );
    expect(f).toMatchObject({ pkbMethod: 'usg', weightMethod: 'tape', trimester: '2' });
    expect([trimesterFor(2), trimesterFor(7), trimesterFor(undefined)]).toEqual(['1', '3', '']);
  });
});

describe('buildInput', () => {
  it('IB dengan tugas: serviceRequestId dan stok ikut terkirim', () => {
    const { input, errors } = buildInput(
      'IB',
      { date: localDate(NOW), semenStockId: 's1', strawCode: 'S', bullId: 'B', batch: 'C' },
      extra({ serviceRequestId: 'req-1' }),
    );
    expect(errors).toEqual({});
    expect(input).toMatchObject({
      type: 'IB',
      occurredAt: NOW,
      serviceRequestId: 'req-1',
      semenStockId: 's1',
    });
  });

  it('KGG wajib trimester', () => {
    expect(buildInput('KGG', { date: localDate(NOW) }, extra()).errors.trimester).toBeDefined();
    expect(
      buildInput('KGG', { date: localDate(NOW), trimester: '2' }, extra()).input,
    ).toMatchObject({
      payload: { trimester: 2 },
    });
  });

  it('LH: anak kembar, berat opsional, berat tidak wajar ditolak', () => {
    const calves: CalfField[] = [
      { sex: 'F', condition: 'alive', weightKg: '28,5' },
      { sex: 'M', condition: 'stillborn', weightKg: '' },
    ];
    const ok = buildInput('LH', { date: localDate(NOW) }, extra({ calves }));
    expect(ok.input).toMatchObject({
      payload: {
        calves: [
          { sex: 'F', condition: 'alive', weightKg: 28.5 },
          { sex: 'M', condition: 'stillborn' },
        ],
      },
    });
    const bad = buildInput(
      'LH',
      { date: localDate(NOW) },
      extra({ calves: [{ sex: 'F', condition: 'alive', weightKg: '500' }] }),
    );
    expect(bad.errors.calf0).toMatch(/antara 1 dan 199/);
  });

  it('tanggal kemarin memakai pukul 12.00', () => {
    const yesterday = localDate(NOW - 86_400_000);
    const { input } = buildInput('BH', { date: yesterday }, extra());
    expect(new Date(input?.occurredAt ?? 0).getHours()).toBe(12);
  });
});
