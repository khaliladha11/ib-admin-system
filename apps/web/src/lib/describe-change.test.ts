import { describe, expect, it } from 'vitest';

import { animalIdOf } from '@/data/outbox';

import { describeChange } from './describe-change';

const ID = '0193f000-0000-7000-8000-000000000001';
const T = Date.UTC(2026, 10, 26, 3);

describe('describeChange', () => {
  it('event: jenis + nama sapi + tanggal kejadian', () => {
    const s = describeChange(
      { kind: 'event.create', body: { type: 'BB', occurredAt: T }, createdAt: T + 99 },
      'Melati',
    );
    expect(s.title).toBe('Berat badan');
    expect(s.detail).toMatch(/^Melati · 26 Nov/);
  });

  it('jenis lain memakai teks sederhana', () => {
    expect(describeChange({ kind: 'qrCode.reserve', body: {}, createdAt: T }, null).title).toBe(
      'Label QR baru',
    );
    expect(
      describeChange({ kind: 'animal.create', body: { name: 'Kirana' }, createdAt: T }, null)
        .detail,
    ).toMatch(/^Kirana · /);
  });

  it('animalIdOf: dari alamat atau baris ternak baru', () => {
    expect(
      animalIdOf({ kind: 'event.create', path: `/api/animals/${ID}/events`, rowId: 'x' }),
    ).toBe(ID);
    expect(animalIdOf({ kind: 'animal.create', path: '/api/animals', rowId: ID })).toBe(ID);
    expect(animalIdOf({ kind: 'qrCode.reserve', path: '/api/qr-codes', rowId: 'x' })).toBeNull();
  });
});
