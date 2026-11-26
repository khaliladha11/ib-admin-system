import { describe, expect, it } from 'vitest';

import { batchStore } from './batch-store';
import { cameraProblemOf, CAMERA_PROBLEM_TEXT } from './camera';
import { nativeDetectorClass } from './detector';

const domError = (name: string) => new DOMException('x', name);

describe('cameraProblemOf', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'notFound'],
    ['OverconstrainedError', 'notFound'],
    ['NotReadableError', 'busy'],
    ['InsecureContextError', 'insecure'],
    ['UnsupportedError', 'unsupported'],
    ['WeirdError', 'other'],
  ])('%s → %s', (name, problem) => {
    expect(cameraProblemOf(domError(name))).toBe(problem);
  });

  it('nilai bukan error: other; semua masalah punya teks', () => {
    expect(cameraProblemOf('x')).toBe('other');
    for (const text of Object.values(CAMERA_PROBLEM_TEXT)) {
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.body).not.toMatch(/Error/);
    }
  });
});

describe('nativeDetectorClass', () => {
  const fake = (formats: string[] | Error) =>
    Object.assign(
      function BarcodeDetector() {
        // tiruan: hanya getSupportedFormats yang dipakai
      },
      {
        getSupportedFormats: () =>
          formats instanceof Error ? Promise.reject(formats) : Promise.resolve(formats),
      },
    );

  it('dipakai bila browser mendukung qr_code', async () => {
    expect(
      await nativeDetectorClass({ BarcodeDetector: fake(['qr_code', 'ean_13']) }),
    ).not.toBeNull();
  });

  it('cadangan ZXing bila tidak ada, tidak mendukung QR, atau error', async () => {
    expect(await nativeDetectorClass({})).toBeNull();
    expect(await nativeDetectorClass({ BarcodeDetector: fake(['ean_13']) })).toBeNull();
    expect(await nativeDetectorClass({ BarcodeDetector: fake(new Error('x')) })).toBeNull();
  });
});

describe('batchStore', () => {
  it('kode sama tidak menambah baris, hanya menghitung', () => {
    batchStore.clear();
    expect(batchStore.add('IB-7K2QM', 'IB-7K2QM', 1)).toBe(true);
    expect(batchStore.add('IB-8M3RN', 'IB-8M3RN', 2)).toBe(true);
    expect(batchStore.add('IB-7K2QM', 'ib-7k2qm', 3)).toBe(false);
    expect(batchStore.get().map((i) => [i.key, i.count])).toEqual([
      ['IB-8M3RN', 1],
      ['IB-7K2QM', 2],
    ]);
    batchStore.remove('IB-8M3RN');
    expect(batchStore.get()).toHaveLength(1);
    batchStore.clear();
    expect(batchStore.get()).toEqual([]);
  });
});
