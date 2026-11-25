import { describe, expect, it } from 'vitest';

import { EVENT_TYPES } from '../enums';
import { uuidv7 } from '../ids';
import { eventBodySchema, eventPayloadSchemas, eventSchema } from './events';

const calfId = uuidv7();

/** Contoh payload valid per jenis, sama dengan contoh di rancangan langkah 1.2. */
const validPayloads = {
  BH: { signs: ['lendir_bening', 'gelisah', 'menaiki_sapi_lain'], notes: 'Terlihat pagi hari' },
  IB: {
    strawCode: 'SIM-2026-0412',
    bullId: 'BULL-SIM-07',
    bullName: 'Jago',
    breed: 'Simental',
    batch: 'B2026-04',
  },
  PKB: { result: 'pregnant', fetalAgeMonths: 3, method: 'palpation' },
  KGG: { trimester: 2, notes: 'Janin keluar, induk sehat' },
  LH: { calves: [{ sex: 'M', condition: 'alive', calfAnimalId: calfId, weightKg: 28 }] },
  BB: { weightKg: 342.5, method: 'tape' },
  HEALTH: { condition: 'Mastitis ringan', treatment: 'Antibiotik intramammary' },
  EXIT: { reason: 'sold', notes: 'Dijual ke pedagang desa sebelah' },
} as const;

function parse(type: keyof typeof eventPayloadSchemas, payload: unknown) {
  return eventPayloadSchemas[type].safeParse(payload);
}

describe('payload event', () => {
  it('punya skema untuk setiap kode event', () => {
    expect(Object.keys(eventPayloadSchemas).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it.each(EVENT_TYPES)('menerima contoh payload %s', (type) => {
    expect(parse(type, validPayloads[type]).success).toBe(true);
  });

  it.each(EVENT_TYPES)('menolak field yang tidak dikenal di %s', (type) => {
    expect(parse(type, { ...validPayloads[type], tidakDikenal: 1 }).success).toBe(false);
  });

  it('BH boleh tanpa isi, tetapi tanda birahi harus dari daftar', () => {
    expect(parse('BH', {}).success).toBe(true);
    expect(parse('BH', { signs: ['mengantuk'] }).success).toBe(false);
  });

  it('IB wajib kode straw, ID pejantan, dan batch', () => {
    expect(parse('IB', { strawCode: 'S1', bullId: 'B1' }).success).toBe(false);
    expect(parse('IB', { strawCode: '  ', bullId: 'B1', batch: 'X' }).success).toBe(false);
    expect(parse('IB', { strawCode: 'S1', bullId: 'B1', batch: 'X' }).success).toBe(true);
  });

  it('PKB bunting wajib umur janin 1-10 bulan', () => {
    expect(parse('PKB', { result: 'pregnant' }).success).toBe(false);
    expect(parse('PKB', { result: 'pregnant', fetalAgeMonths: 0 }).success).toBe(false);
    expect(parse('PKB', { result: 'pregnant', fetalAgeMonths: 11 }).success).toBe(false);
    expect(parse('PKB', { result: 'pregnant', fetalAgeMonths: 2.5 }).success).toBe(false);
    expect(parse('PKB', { result: 'pregnant', fetalAgeMonths: 10 }).success).toBe(true);
  });

  it('PKB tidak bunting tanpa umur janin', () => {
    expect(parse('PKB', { result: 'not_pregnant' }).success).toBe(true);
    expect(parse('PKB', { result: 'not_pregnant', fetalAgeMonths: 2 }).success).toBe(false);
  });

  it('KGG hanya trimester 1, 2, atau 3', () => {
    for (const t of [1, 2, 3]) expect(parse('KGG', { trimester: t }).success).toBe(true);
    for (const t of [0, 4, '2']) expect(parse('KGG', { trimester: t }).success).toBe(false);
  });

  it('LH: anak hidup wajib punya calfAnimalId, anak mati lahir boleh tanpa', () => {
    expect(parse('LH', { calves: [{ sex: 'F', condition: 'alive' }] }).success).toBe(false);
    expect(parse('LH', { calves: [{ sex: 'F', condition: 'stillborn' }] }).success).toBe(true);
    expect(parse('LH', { calves: [] }).success).toBe(false);
  });

  it('LH bisa mencatat kelahiran kembar', () => {
    const twins = {
      calves: [
        { sex: 'F', condition: 'alive', calfAnimalId: uuidv7() },
        { sex: 'M', condition: 'stillborn' },
      ],
    };
    expect(parse('LH', twins).success).toBe(true);
  });

  it('BB harus lebih dari 0 dan kurang dari 2000 kg', () => {
    for (const w of [0, -5, 2000]) expect(parse('BB', { weightKg: w }).success).toBe(false);
    expect(parse('BB', { weightKg: 1999.9 }).success).toBe(true);
  });

  it('HEALTH wajib kondisi; teks kosong dianggap tidak diisi', () => {
    expect(parse('HEALTH', { condition: '' }).success).toBe(false);
    const r = parse('HEALTH', { condition: 'Diare', treatment: '' });
    expect(r.success && r.data).toEqual({ condition: 'Diare' });
  });

  it('EXIT hanya alasan dari daftar', () => {
    expect(parse('EXIT', { reason: 'died' }).success).toBe(true);
    expect(parse('EXIT', { reason: 'hilang' }).success).toBe(false);
  });
});

describe('eventBodySchema', () => {
  it('memilih skema payload berdasarkan type', () => {
    expect(eventBodySchema.safeParse({ type: 'BB', payload: { weightKg: 300 } }).success).toBe(
      true,
    );
    // Payload BB dikirim dengan type IB: ditolak.
    expect(eventBodySchema.safeParse({ type: 'IB', payload: { weightKg: 300 } }).success).toBe(
      false,
    );
    expect(eventBodySchema.safeParse({ type: 'XX', payload: {} }).success).toBe(false);
  });
});

describe('eventSchema', () => {
  const now = Date.UTC(2026, 10, 25);
  const base = {
    id: uuidv7(now),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: 'hp-andi',
    animalId: uuidv7(),
    occurredAt: now - 86_400_000,
    recordedBy: uuidv7(),
    serviceRequestId: null,
    semenStockId: null,
    voidsEventId: null,
  };

  it('menerima event lengkap', () => {
    expect(eventSchema.safeParse({ ...base, type: 'IB', payload: validPayloads.IB }).success).toBe(
      true,
    );
  });

  it('stok straw hanya boleh ditautkan ke IB', () => {
    const semenStockId = uuidv7();
    expect(
      eventSchema.safeParse({ ...base, semenStockId, type: 'IB', payload: validPayloads.IB })
        .success,
    ).toBe(true);
    expect(
      eventSchema.safeParse({ ...base, semenStockId, type: 'BB', payload: validPayloads.BB })
        .success,
    ).toBe(false);
  });

  it('event tidak bisa membatalkan dirinya sendiri', () => {
    expect(
      eventSchema.safeParse({ ...base, voidsEventId: base.id, type: 'BH', payload: {} }).success,
    ).toBe(false);
  });
});
