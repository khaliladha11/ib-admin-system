import { describe, expect, it } from 'vitest';

import { createTestLayer } from '@/test/data-fixtures';

import { isUnlocked, lockApp } from './lock';
import { clearPin, hasPin, PIN_MAX_FAILURES, setPin, verifyPin } from './pin';

describe('PIN perangkat', () => {
  it('hanya hash yang disimpan; PIN benar membuka aplikasi', async () => {
    const t = await createTestLayer();
    lockApp();
    await setPin(t.db, '2468');
    expect(isUnlocked()).toBe(true);
    lockApp();
    const record = await t.db.getMeta('pin');
    expect(JSON.stringify(record)).not.toContain('2468');
    expect(await verifyPin(t.db, '2468')).toEqual({ ok: true });
    expect(isUnlocked()).toBe(true);
  });

  it('format PIN 4–6 angka', async () => {
    const t = await createTestLayer();
    await expect(setPin(t.db, '12')).rejects.toThrow('PIN harus 4 sampai 6 angka.');
    await expect(setPin(t.db, '12ab')).rejects.toThrow();
    await expect(setPin(t.db, '1234567')).rejects.toThrow();
  });

  it('salah berkali-kali: sisa percobaan berkurang, lalu PIN dan sesi dihapus', async () => {
    const t = await createTestLayer();
    await setPin(t.db, '1357');
    lockApp();
    expect(await verifyPin(t.db, '0000')).toEqual({ ok: false, reason: 'wrong', attemptsLeft: 4 });
    for (let i = 2; i < PIN_MAX_FAILURES; i++) await verifyPin(t.db, '0000');
    expect(await verifyPin(t.db, '0000')).toEqual({ ok: false, reason: 'reset' });
    expect(await hasPin(t.db)).toBe(false);
    expect(await t.db.getMeta('session')).toBeUndefined();
    expect(isUnlocked()).toBe(false);
  });

  it('PIN benar menghapus hitungan salah; clearPin menghapus PIN', async () => {
    const t = await createTestLayer();
    await setPin(t.db, '1357');
    await verifyPin(t.db, '9999');
    await verifyPin(t.db, '1357');
    expect((await t.db.getMeta('pin'))?.failures).toBe(0);
    await clearPin(t.db);
    expect(await hasPin(t.db)).toBe(false);
  });

  it('tanpa sesi: PIN tidak bisa dipasang', async () => {
    const t = await createTestLayer();
    await t.db.meta.delete('session');
    await expect(setPin(t.db, '1234')).rejects.toThrow(/Masuk dengan password/);
  });
});
