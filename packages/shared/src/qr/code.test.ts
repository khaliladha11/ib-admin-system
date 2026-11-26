import { describe, expect, it } from 'vitest';

import { QR_CODE_PATTERN } from '../schemas/entities';
import {
  generateQrCode,
  generateUniqueQrCodes,
  parseQrCode,
  QR_ALPHABET,
  QrCodeExhaustedError,
  qrPayload,
  type RandomFill,
} from './code';

/** Sumber acak deterministik (xorshift) agar tes stabil. */
function seeded(seed = 42): RandomFill {
  let x = seed >>> 0 || 1;
  return (bytes) => {
    for (let i = 0; i < bytes.length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      bytes[i] = (x >>> 0) & 0xff;
    }
    return bytes;
  };
}

/** Mengembalikan byte yang sudah ditentukan, berulang. */
const fixed =
  (...values: number[]): RandomFill =>
  (bytes) => {
    bytes.forEach((_, i) => (bytes[i] = values[i % values.length] ?? 0));
    return bytes;
  };

describe('QR_ALPHABET', () => {
  it('32 simbol unik tanpa O, 0, I, 1', () => {
    expect(QR_ALPHABET).toHaveLength(32);
    expect(new Set(QR_ALPHABET).size).toBe(32);
    for (const ch of 'O0I1') expect(QR_ALPHABET).not.toContain(ch);
  });

  it('sama persis dengan pola QR_CODE_PATTERN', () => {
    for (const ch of QR_ALPHABET) expect(QR_CODE_PATTERN.test(`IB-${ch.repeat(5)}`)).toBe(true);
    for (const ch of 'O0I1a-') expect(QR_CODE_PATTERN.test(`IB-${ch.repeat(5)}`)).toBe(false);
  });
});

describe('generateQrCode', () => {
  it('format IB-XXXXX', () => {
    const fill = seeded();
    for (let i = 0; i < 1000; i++) expect(generateQrCode(fill)).toMatch(QR_CODE_PATTERN);
  });

  it('byte dipetakan ke simbol tanpa berat sebelah (byte & 31)', () => {
    expect(generateQrCode(fixed(0, 31, 32, 255, 8))).toBe('IB-2Z2ZA');
  });

  it('semua simbol muncul dengan frekuensi yang mirip', () => {
    const fill = seeded(7);
    const counts = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) {
      for (const ch of generateQrCode(fill).slice(3)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(counts.size).toBe(32);
    const expected = (20_000 * 5) / 32;
    for (const n of counts.values()) expect(Math.abs(n - expected) / expected).toBeLessThan(0.1);
  });
});

describe('generateUniqueQrCodes', () => {
  it('menghasilkan kode yang berbeda satu sama lain', () => {
    const codes = generateUniqueQrCodes(5000, () => false, seeded(3));
    expect(codes).toHaveLength(5000);
    expect(new Set(codes).size).toBe(5000);
  });

  it('melewati kode yang sudah dipakai di perangkat', () => {
    const taken = new Set(generateUniqueQrCodes(200, () => false, seeded(9)));
    // Sumber acak yang sama: 200 kode pertama pasti bentrok dan harus dilewati.
    const fresh = generateUniqueQrCodes(50, (c) => taken.has(c), seeded(9));
    expect(fresh).toHaveLength(50);
    for (const c of fresh) expect(taken.has(c)).toBe(false);
  });

  it('kode ganda dari sumber acak tidak dipakai dua kali', () => {
    // Sumber acak yang mengulang dua kode bergantian.
    let flip = false;
    const fill: RandomFill = (bytes) => {
      flip = !flip;
      return fixed(flip ? 1 : 2)(bytes);
    };
    expect(generateUniqueQrCodes(2, () => false, fill)).toEqual(['IB-33333', 'IB-44444']);
  });

  it('berhenti dengan error bila tidak ada kode baru', () => {
    expect(() => generateUniqueQrCodes(1, () => true, seeded(), 50)).toThrow(QrCodeExhaustedError);
  });
});

describe('qrPayload', () => {
  it('tanpa base URL: hanya kode', () => {
    expect(qrPayload('IB-7K2QM')).toBe('IB-7K2QM');
    expect(qrPayload('IB-7K2QM', '  ')).toBe('IB-7K2QM');
  });

  it('dengan base URL: https://domain/t/KODE, tanpa garis miring ganda', () => {
    expect(qrPayload('IB-7K2QM', 'https://ib.contoh.test/')).toBe(
      'https://ib.contoh.test/t/IB-7K2QM',
    );
  });
});

describe('parseQrCode', () => {
  it.each([
    ['IB-7K2QM', 'IB-7K2QM'],
    [' ib-7k2qm ', 'IB-7K2QM'],
    ['7k2qm', 'IB-7K2QM'],
    ['https://ib.contoh.test/t/IB-7K2QM', 'IB-7K2QM'],
    ['https://ib.contoh.test/t/ib-7k2qm/?ref=label', 'IB-7K2QM'],
  ])('%s → %s', (input, code) => {
    expect(parseQrCode(input)).toBe(code);
  });

  it.each(['', 'IB-7K2Q', 'IB-7K2QO', 'IB-11111', 'https://contoh.test/x/IB-7K2QM', 'Melati'])(
    'bukan kode: %s',
    (input) => {
      expect(parseQrCode(input)).toBeNull();
    },
  );
});
