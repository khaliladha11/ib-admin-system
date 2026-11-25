import { describe, expect, it } from 'vitest';
import { idSchema } from './schemas/common';
import { uuidv7, uuidv7Timestamp } from './ids';

const zeros = (n: number) => new Uint8Array(n);
const ones = (n: number) => new Uint8Array(n).fill(0xff);

describe('uuidv7', () => {
  it('menghasilkan UUID versi 7 varian RFC yang valid', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idSchema.safeParse(id).success).toBe(true);
  });

  it('menyimpan waktu pembuatan di 48 bit pertama', () => {
    const now = Date.UTC(2026, 10, 25, 3, 0, 0);
    expect(uuidv7Timestamp(uuidv7(now))).toBe(now);
  });

  it('memasang bit versi dan varian walau byte acak bernilai ekstrem', () => {
    expect(uuidv7(0, zeros)).toBe('00000000-0000-7000-8000-000000000000');
    expect(uuidv7(0, ones)).toBe('00000000-0000-7fff-bfff-ffffffffffff');
  });

  it('terurut menurut waktu saat dibandingkan sebagai teks', () => {
    const a = uuidv7(1_000, ones);
    const b = uuidv7(1_001, zeros);
    expect(a < b).toBe(true);
  });

  it('tidak bertabrakan pada pembuatan beruntun', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });

  it.each([-1, 1.5, 2 ** 48])('menolak waktu %d', (now) => {
    expect(() => uuidv7(now)).toThrow(RangeError);
  });
});
