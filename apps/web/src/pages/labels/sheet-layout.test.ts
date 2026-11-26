import { describe, expect, it } from 'vitest';

import { fitsA4, paginate, qrSizeMm, SHEET_LAYOUTS, type LabelItem } from './sheet-layout';

const items = (n: number): LabelItem[] =>
  Array.from({ length: n }, (_, i) => ({ code: `IB-2222${String(i)}`, name: null }));

describe('tata letak label A4', () => {
  it.each([24, 40] as const)('%i label: kolom × baris = jumlah label, muat di A4', (n) => {
    const layout = SHEET_LAYOUTS[n];
    expect(layout.columns * layout.rows).toBe(n);
    expect(fitsA4(layout)).toBe(true);
  });

  it('QR minimal 25 mm agar mudah dipindai kamera HP', () => {
    for (const layout of Object.values(SHEET_LAYOUTS)) {
      expect(qrSizeMm(layout)).toBeGreaterThanOrEqual(25);
      expect(qrSizeMm(layout)).toBeLessThan(layout.labelHeight);
    }
  });

  it('paginate: lembar penuh, sisa diisi sel kosong', () => {
    const pages = paginate(items(30), SHEET_LAYOUTS[24]);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(24);
    expect(pages[1]?.filter(Boolean)).toHaveLength(6);
    expect(pages[1]).toHaveLength(24);
    expect(paginate([], SHEET_LAYOUTS[40])).toEqual([]);
    expect(paginate(items(40), SHEET_LAYOUTS[40])).toHaveLength(1);
  });
});
