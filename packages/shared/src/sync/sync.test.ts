import { describe, expect, it } from 'vitest';

import {
  compareCursor,
  decodeCursor,
  encodeCursor,
  isAfterCursor,
  scopeKey,
  type SyncCursor,
} from './cursor';
import { clampChangeTime, mergeFieldVersions } from './merge';
import { syncPushRequestSchema } from './schemas';

const T = 1_764_000_000_000;

describe('mergeFieldVersions (konflik profil per kolom)', () => {
  const row = { name: 'Melati', breed: 'PO', phone: '0811' };

  it('kolom berbeda dari dua HP: keduanya dipakai', () => {
    // HP B (lebih baru) sudah mengubah breed; HP A (lebih lama) mengubah name.
    const afterB = mergeFieldVersions(row, {}, { breed: 'Bali' }, T + 20, T);
    const afterA = mergeFieldVersions(
      { ...row, ...afterB.apply },
      afterB.times,
      { name: 'Mawar' },
      T + 10,
      T,
    );
    expect(afterA.apply).toEqual({ name: 'Mawar' });
    expect(afterA.lost).toEqual({});
    expect({ ...row, ...afterB.apply, ...afterA.apply }).toEqual({
      name: 'Mawar',
      breed: 'Bali',
      phone: '0811',
    });
  });

  it('kolom sama: versi lebih baru menang; yang kalah dikembalikan untuk audit', () => {
    const newer = mergeFieldVersions(row, {}, { phone: '0822' }, T + 20, T);
    expect(newer.apply).toEqual({ phone: '0822' });
    expect(newer.previous).toEqual({ phone: '0811' });
    const older = mergeFieldVersions(
      { ...row, phone: '0822' },
      newer.times,
      { phone: '0833', name: 'Mawar' },
      T + 10,
      T,
    );
    expect(older.apply).toEqual({ name: 'Mawar' });
    expect(older.lost).toEqual({ phone: '0833' });
    expect(older.kept).toEqual({ phone: '0822' });
    expect(older.times).toMatchObject({ phone: T + 20, name: T + 10 });
  });

  it('waktu sama: kiriman yang tiba belakangan menang', () => {
    const r = mergeFieldVersions(row, { phone: T + 5 }, { phone: '0899' }, T + 5, T);
    expect(r.apply).toEqual({ phone: '0899' });
  });

  it('baris lama tanpa catatan waktu kolom memakai updated_at sebagai patokan', () => {
    expect(mergeFieldVersions(row, {}, { name: 'X' }, T - 1, T).lost).toEqual({ name: 'X' });
    expect(mergeFieldVersions(row, {}, { name: 'X' }, T + 1, T).apply).toEqual({ name: 'X' });
  });

  it('nilai sama tidak dianggap perubahan, null boleh', () => {
    const r = mergeFieldVersions(row, {}, { name: 'Melati', breed: null }, T + 1, T);
    expect(r.apply).toEqual({ breed: null });
    expect(r.previous).toEqual({ breed: 'PO' });
  });

  it('waktu HP di masa depan dipotong menjadi waktu server', () => {
    expect(clampChangeTime(T + 99_999, T)).toBe(T);
    expect(clampChangeTime(T - 5, T)).toBe(T - 5);
    expect(clampChangeTime(undefined, T)).toBe(T);
    expect(clampChangeTime(0, T)).toBe(T);
  });
});

describe('cursor pull', () => {
  const c: SyncCursor = { t: T, tb: 3, id: '0193f000-0000-7000-8000-000000000001' };

  it('encode/decode bolak-balik; kosong = dari awal; rusak = error', () => {
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(() => decodeCursor('abc')).toThrow();
  });

  it('urutan (updated_at, tabel, id)', () => {
    expect(isAfterCursor({ ...c, t: T + 1, tb: 0 }, c)).toBe(true);
    expect(isAfterCursor({ ...c, tb: 4, id: '0' }, c)).toBe(true);
    expect(isAfterCursor({ ...c, id: `${c.id.slice(0, -1)}2` }, c)).toBe(true);
    expect(isAfterCursor(c, c)).toBe(false);
    expect(isAfterCursor({ ...c, t: T - 1, tb: 9 }, c)).toBe(false);
    expect(isAfterCursor(c, null)).toBe(true);
    expect(compareCursor({ ...c, t: T - 1 }, c)).toBeLessThan(0);
  });
});

describe('scopeKey', () => {
  it('tidak bergantung urutan dan duplikat; berubah bila isi berubah', () => {
    expect(scopeKey(['b', 'a', 'a'])).toBe(scopeKey(['a', 'b']));
    expect(scopeKey(['a', 'b'])).not.toBe(scopeKey(['a', 'b', 'c']));
    expect(scopeKey(['ab', 'c'])).not.toBe(scopeKey(['a', 'bc']));
    expect(scopeKey([])).toMatch(/^0-[0-9a-f]{16}$/);
  });
});

describe('syncPushRequestSchema', () => {
  it('1–50 perubahan, jenis dari daftar putih', () => {
    const change = {
      id: '0193f000-0000-7000-8000-000000000001',
      kind: 'event.create',
      method: 'POST',
      path: '/api/animals/x/events',
      body: {},
      at: T,
    };
    expect(syncPushRequestSchema.safeParse({ changes: [change] }).success).toBe(true);
    expect(syncPushRequestSchema.safeParse({ changes: [] }).success).toBe(false);
    expect(
      syncPushRequestSchema.safeParse({ changes: Array.from({ length: 51 }, () => change) })
        .success,
    ).toBe(false);
    expect(
      syncPushRequestSchema.safeParse({ changes: [{ ...change, kind: 'user.create' }] }).success,
    ).toBe(false);
  });
});
